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

    return { browser: browser, os: os, deviceType: deviceType };
  }

  function sendEvent(eventType, additionalData) {
    var payload = Object.assign({
      eventType: eventType,
      path: window.location.pathname,
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

    return fetch(host + "/api/v1/public/vapid-key")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.publicKey) throw new Error("VAPID public key not retrieved");
        var applicationServerKey = urlBase64ToUint8Array(data.publicKey);

        return navigator.serviceWorker.register("/pushforge-sw.js", { scope: "/" })
          .then(function (registration) {
            var doSubscribe = function() {
              return registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
              });
            };

            return registration.pushManager.getSubscription()
              .then(function (existingSub) {
                if (existingSub) {
                  return existingSub.unsubscribe()
                    .then(doSubscribe)
                    .catch(doSubscribe);
                }
                return doSubscribe();
              })
              .catch(function (err) {
                return registration.pushManager.getSubscription()
                  .then(function (sub) {
                    if (sub) return sub.unsubscribe();
                  })
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
        return res.json().then(function(resData) {
          if (!res.ok) {
            throw new Error(resData.error || "Subscription request failed with status " + res.status);
          }
          console.log("PushForge: Subscriber registered successfully", resData);
          return resData;
        });
      });
  }

  function init() {
    sendEvent("pageview");

    var startTime = Date.now();
    window.addEventListener("beforeunload", function () {
      var duration = Math.round((Date.now() - startTime) / 1000);
      sendEvent("session_end", { duration: duration });
    });
  }

  window.PushForge = {
    init: init,
    subscribe: subscribeUser,
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
