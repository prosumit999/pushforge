(function () {
  "use strict";

  var currentScript = document.currentScript || document.querySelector("script[data-site-key]");
  var siteKey = currentScript ? currentScript.getAttribute("data-site-key") : null;
  var host = currentScript ? (currentScript.getAttribute("data-host") || new URL(currentScript.src).origin) : window.location.origin;

  if (!siteKey) {
    console.error("PushForge SDK Error: Missing data-site-key attribute on script tag");
    return;
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function detectDevice() {
    var ua = navigator.userAgent;
    var deviceType = "Desktop";
    if (/tablet|ipad|playbook|silk/i.test(ua)) deviceType = "Tablet";
    else if (/Mobile|Android|iP(hone|od)/i.test(ua)) deviceType = "Mobile";

    var browser = "Unknown";
    if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";
    else if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("MSIE") > -1 || ua.indexOf("Edge") > -1) browser = "Edge";

    var os = "Unknown";
    if (ua.indexOf("Win") > -1) os = "Windows";
    else if (ua.indexOf("Mac") > -1) os = "MacOS";
    else if (ua.indexOf("Linux") > -1) os = "Linux";
    else if (ua.indexOf("Android") > -1) os = "Android";
    else if (ua.indexOf("like Mac") > -1) os = "iOS";

    var timezone = "";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch (e) {}

    return {
      browser: browser,
      os: os,
      deviceType: deviceType,
      screen: window.screen ? window.screen.width + "x" + window.screen.height : "",
      screenWidth: window.screen ? window.screen.width : 0,
      screenHeight: window.screen ? window.screen.height : 0,
      language: navigator.language || "",
      timezone: timezone,
      landingPage: window.location.href,
      referrer: document.referrer || ""
    };
  }

  function sendEvent(eventType, additionalData) {
    var payload = Object.assign({
      eventType: eventType,
      path: window.location.pathname,
      landingPage: window.location.href,
      referrer: document.referrer || "",
      device: detectDevice()
    }, additionalData || {});

    fetch(host + "/api/v1/public/event", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-key": siteKey
      },
      body: JSON.stringify(payload)
    }).catch(function (err) {
      console.warn("PushForge event log error:", err.message);
    });
  }

  function registerServiceWorkerWithFallback() {
    if ("serviceWorker" in navigator) {
      return navigator.serviceWorker.getRegistrations().then(function (registrations) {
        if (registrations && registrations.length > 0) {
          var activeReg = registrations.find(function (r) { return r.active; }) || registrations[0];
          if (activeReg) return activeReg;
        }

        var swPaths = ["/pushforge-sw.js", "/sw.js", "/service-worker.js"];
        function tryNext(index) {
          if (index >= swPaths.length) {
            return Promise.reject(new Error("No valid service worker found at /pushforge-sw.js, /sw.js, or /service-worker.js"));
          }
          return navigator.serviceWorker.register(swPaths[index], { scope: "/" })
            .catch(function () {
              return tryNext(index + 1);
            });
        }
        return tryNext(0);
      });
    }
    return Promise.reject(new Error("ServiceWorker not supported"));
  }

  function getCachedVapidKey() {
    try {
      return localStorage.getItem("pushforge_vapid_key_" + siteKey);
    } catch (e) {
      return null;
    }
  }

  function setCachedVapidKey(key) {
    try {
      localStorage.setItem("pushforge_vapid_key_" + siteKey, key);
    } catch (e) {}
  }

  function fetchVapidPublicKey() {
    var cached = getCachedVapidKey();
    if (cached) {
      fetch(host + "/api/v1/public/vapid-key")
        .then(function (res) { return res.json(); })
        .then(function (data) { if (data.publicKey) setCachedVapidKey(data.publicKey); })
        .catch(function () {});
      return Promise.resolve(cached);
    }

    return fetch(host + "/api/v1/public/vapid-key")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.publicKey) throw new Error("VAPID public key not retrieved");
        setCachedVapidKey(data.publicKey);
        return data.publicKey;
      });
  }

  function subscribeUser() {
    if (window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      var insecureErr = "Web Push requires HTTPS or localhost context. Browsers block Push Notifications on plain HTTP IP addresses (e.g. " + window.location.origin + "). Use localhost or HTTPS (ngrok).";
      console.warn("PushForge SDK:", insecureErr);
      return Promise.reject(new Error(insecureErr));
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("PushForge SDK: Push notifications not supported by browser");
      return Promise.reject(new Error("Push notifications not supported by this browser"));
    }

    return fetchVapidPublicKey()
      .then(function (pubKey) {
        var applicationServerKey = urlBase64ToUint8Array(pubKey);

        return registerServiceWorkerWithFallback()
          .then(function (registration) {
            var doSubscribe = function () {
              return registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
              });
            };

            return registration.pushManager.getSubscription()
              .then(function (existingSub) {
                if (existingSub) {
                  return existingSub.unsubscribe().then(doSubscribe).catch(doSubscribe);
                }
                return doSubscribe();
              })
              .catch(function () {
                return registration.pushManager.getSubscription()
                  .then(function (sub) { if (sub) return sub.unsubscribe(); })
                  .then(doSubscribe);
              });
          });
      })
      .then(function (subscription) {
        var subObj = subscription.toJSON();
        var payload = {
          endpoint: subObj.endpoint,
          keys: subObj.keys,
          device: detectDevice(),
          referrer: document.referrer || "",
          firstSeenPage: window.location.pathname
        };

        return fetch(host + "/api/v1/public/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-site-key": siteKey
          },
          body: JSON.stringify(payload)
        });
      })
      .then(function (res) {
        return res.json().then(function (resData) {
          if (!res.ok) {
            throw new Error(resData.error || "Subscription request failed with status " + res.status);
          }
          console.log("PushForge: Subscriber registered successfully", resData);
          return resData;
        });
      });
  }

  function isSnoozed() {
    try {
      var until = localStorage.getItem("pushforge_snooze_until");
      return until ? Date.now() < parseInt(until, 10) : false;
    } catch (e) {
      return false;
    }
  }

  function snoozePrompt(days) {
    try {
      var snoozeMs = (days || 7) * 24 * 60 * 60 * 1000;
      localStorage.setItem("pushforge_snooze_until", (Date.now() + snoozeMs).toString());
    } catch (e) {}
  }

  function attachMobileFirstGestureTrigger(callback) {
    var isMobile = /Mobile|Android|iP(hone|od)/i.test(navigator.userAgent);
    if (!isMobile) return;

    var triggered = false;
    function onGesture() {
      if (triggered) return;
      triggered = true;
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("click", onGesture);
      if (typeof callback === "function") callback();
    }

    window.addEventListener("touchstart", onGesture, { passive: true, once: true });
    window.addEventListener("click", onGesture, { once: true });
  }

  function showCustomPrompt(opts) {
    if (isSnoozed()) {
      console.log("PushForge: Opt-in prompt currently snoozed by visitor");
      return;
    }

    if (Notification.permission === "granted" || Notification.permission === "denied") {
      return;
    }

    opts = opts || {};
    var title = opts.title || "Get Instant Notifications";
    var message = opts.message || "Stay updated with important announcements and updates directly in your browser.";
    var acceptText = opts.acceptText || "Allow Notifications";
    var cancelText = opts.cancelText || "Later";

    var modal = document.createElement("div");
    modal.id = "pushforge-prompt-modal";
    modal.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:999999;max-width:380px;background:#ffffff;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);border-radius:16px;padding:20px;font-family:system-ui,-apple-system,sans-serif;color:#1e293b;border:1px solid #e2e8f0;transition:all 0.3s ease;";

    modal.innerHTML = '<div style="display:flex;align-items:flex-start;gap:14px;">' +
      '<div style="background:#6366f1;color:#ffffff;width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
      '</div>' +
      '<div style="flex:1;">' +
      '<h4 style="margin:0 0 4px 0;font-size:15px;font-weight:600;color:#0f172a;">' + title + '</h4>' +
      '<p style="margin:0 0 16px 0;font-size:13px;line-height:1.4;color:#64748b;">' + message + '</p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
      '<button id="pf-prompt-dismiss" style="background:#f1f5f9;color:#475569;border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;">' + cancelText + '</button>' +
      '<button id="pf-prompt-allow" style="background:#6366f1;color:#ffffff;border:none;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">' + acceptText + '</button>' +
      '</div>' +
      '</div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById("pf-prompt-dismiss").onclick = function () {
      snoozePrompt(7);
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    document.getElementById("pf-prompt-allow").onclick = function () {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
      PushForge.requestPermissionAndSubscribe().catch(function (err) {
        console.warn("PushForge permission error:", err);
      });
    };
  }

  function init() {
    sendEvent("pageview");

    attachMobileFirstGestureTrigger(function () {
      console.log("PushForge SDK: First mobile gesture detected");
    });

    var startTime = Date.now();
    window.addEventListener("beforeunload", function () {
      var duration = Math.round((Date.now() - startTime) / 1000);
      sendEvent("session_end", { duration: duration });
    });
  }

  window.PushForge = {
    init: init,
    subscribe: subscribeUser,
    prompt: showCustomPrompt,
    snoozePrompt: snoozePrompt,
    isSnoozed: isSnoozed,
    requestPermissionAndSubscribe: function () {
      return Notification.requestPermission().then(function (permission) {
        if (permission === "granted") {
          return subscribeUser();
        } else {
          throw new Error("Notification permission denied");
        }
      });
    }
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    window.addEventListener("DOMContentLoaded", init);
  }
})();
