(function () {
  "use strict";

  var currentScript = document.currentScript || document.querySelector("script[data-site-key]") || document.querySelector("script[data-tracking-id]") || document.querySelector("script[src*='sdk.js']");
  var siteKey = currentScript ? (currentScript.getAttribute("data-site-key") || currentScript.getAttribute("data-tracking-id")) : null;
  var host = currentScript ? (currentScript.getAttribute("data-host") || new URL(currentScript.src).origin) : window.location.origin;

  if (!siteKey) {
    console.error("PushForge SDK Error: Missing data-site-key or data-tracking-id attribute on script tag");
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
        // The service worker runs on this site's origin but must post click
        // telemetry to the PushForge API, so the API host travels along in the
        // registration URL where the worker can read it.
        var swQuery = "?apiHost=" + encodeURIComponent(host);
        function tryNext(index) {
          if (index >= swPaths.length) {
            return Promise.reject(new Error("No valid service worker found at /pushforge-sw.js, /sw.js, or /service-worker.js"));
          }
          return navigator.serviceWorker.register(swPaths[index] + swQuery, { scope: "/" })
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
    var hostname = window.location.hostname || "";
    var isLocalDev = hostname === "localhost" ||
                     hostname === "127.0.0.1" ||
                     hostname.endsWith(".local") ||
                     hostname.endsWith(".test") ||
                     hostname.endsWith(".dev");

    if (window.location.protocol === "http:" && !isLocalDev) {
      var insecureErr = "Web Push requires HTTPS or local development context (e.g. " + window.location.origin + "). Use HTTPS or localhost.";
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

  function isForcePreview() {
    try {
      var s = window.location.search || "";
      return s.indexOf("reset_snooze=1") > -1 || s.indexOf("pf_preview=1") > -1 || s.indexOf("reset_prompt=1") > -1;
    } catch (e) {
      return false;
    }
  }

  function resetSnooze() {
    try {
      localStorage.removeItem("pushforge_snooze_until");
      console.log("PushForge: Opt-in prompt snooze cleared from localStorage!");
    } catch (e) {}
  }

  function isSnoozed() {
    if (isForcePreview()) {
      resetSnooze();
      return false;
    }
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
      console.log("PushForge: Opt-in prompt currently snoozed by visitor. Call PushForge.resetSnooze() or append ?reset_snooze=1 to test.");
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

  function collectEmail(email, name, source) {
    if (!email || !email.includes("@")) {
      return Promise.reject(new Error("Valid email is required"));
    }
    return fetch(host + "/api/v1/public/email-collect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-key": siteKey
      },
      body: JSON.stringify({
        email: email,
        name: name || "",
        source: source || "SDK Prompt",
        device: detectDevice()
      })
    }).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || "Email collection failed");
        return data;
      });
    });
  }

  function showEmailPrompt(opts) {
    opts = opts || {};
    var title = opts.title || "Join Our VIP Updates & Notifications";
    var message = opts.message || "Enter your email to receive exclusive offers, updates, and push notifications directly to your inbox and browser.";
    var placeholder = opts.placeholder || "Enter your email address...";
    var buttonText = opts.buttonText || "Subscribe Now";
    var cancelText = opts.cancelText || "No thanks";

    var existingModal = document.getElementById("pushforge-email-prompt-modal");
    if (existingModal && existingModal.parentNode) {
      existingModal.parentNode.removeChild(existingModal);
    }

    var modal = document.createElement("div");
    modal.id = "pushforge-email-prompt-modal";
    modal.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:999999;width:380px;max-width:calc(100vw - 32px);background:#ffffff;box-shadow:0 25px 50px -12px rgba(124,58,237,0.25), 0 10px 15px -3px rgba(0,0,0,0.1);border-radius:20px;padding:24px;font-family:system-ui,-apple-system,sans-serif;color:#1e293b;border:1px solid #e2e8f0;transition:all 0.3s ease;";

    modal.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="background:linear-gradient(135deg, #7c3aed, #4f46e5);color:#ffffff;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(124,58,237,0.3);">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>' +
      '</div>' +
      '<h4 style="margin:0;font-size:15px;font-weight:700;color:#0f172a;letter-spacing:-0.01em;">' + title + '</h4>' +
      '</div>' +
      '<button id="pf-email-close" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:0;line-height:1;">&times;</button>' +
      '</div>' +
      '<p style="margin:0;font-size:13px;line-height:1.45;color:#64748b;">' + message + '</p>' +
      '<form id="pf-email-form" style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">' +
      '<input type="email" id="pf-email-input" placeholder="' + placeholder + '" required style="width:100%;box-sizing:border-box;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:13px;outline:none;transition:border-color 0.2s;" />' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
      '<button type="button" id="pf-email-cancel" style="background:#f1f5f9;color:#64748b;border:none;padding:9px 14px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;">' + cancelText + '</button>' +
      '<button type="submit" id="pf-email-submit" style="background:linear-gradient(135deg, #7c3aed, #4f46e5);color:#ffffff;border:none;padding:9px 16px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,0.3);">' + buttonText + '</button>' +
      '</div>' +
      '</form>' +
      '<div id="pf-email-status" style="display:none;font-size:12px;margin-top:2px;"></div>' +
      '</div>';

    document.body.appendChild(modal);

    var closeBtn = document.getElementById("pf-email-close");
    var cancelBtn = document.getElementById("pf-email-cancel");
    var form = document.getElementById("pf-email-form");
    var statusDiv = document.getElementById("pf-email-status");
    var submitBtn = document.getElementById("pf-email-submit");

    var removeModal = function () {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    var snoozeAndCloseModal = function () {
      snoozePrompt(7);
      removeModal();
    };

    if (closeBtn) closeBtn.onclick = snoozeAndCloseModal;
    if (cancelBtn) cancelBtn.onclick = snoozeAndCloseModal;

    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var emailInput = document.getElementById("pf-email-input");
        var val = emailInput ? emailInput.value.trim() : "";
        if (!val || !val.includes("@")) {
          statusDiv.style.display = "block";
          statusDiv.style.color = "#ef4444";
          statusDiv.innerText = "Please enter a valid email address.";
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Saving...";

        collectEmail(val, "", opts.source || "Email Opt-in Prompt")
          .then(function () {
            statusDiv.style.display = "block";
            statusDiv.style.color = "#10b981";
            statusDiv.innerText = "Thank you! Email registered successfully.";
            setTimeout(function () {
              removeModal();
              if (opts.enablePushAlso !== false && Notification.permission !== "granted") {
                PushForge.requestPermissionAndSubscribe().catch(function () {});
              }
            }, 1200);
          })
          .catch(function (err) {
            submitBtn.disabled = false;
            submitBtn.innerText = buttonText;
            statusDiv.style.display = "block";
            statusDiv.style.color = "#ef4444";
            statusDiv.innerText = err.message || "Failed to save email. Please try again.";
          });
      };
    }
  }

  function renderBellWidget(opts) {
    if (document.getElementById("pushforge-bell-widget")) return;
    opts = opts || {};
    var title = opts.headline || "Get Instant Notifications";
    var message = opts.description || "Stay updated with important announcements.";

    var bellWrap = document.createElement("div");
    bellWrap.id = "pushforge-bell-widget";
    bellWrap.style.cssText = "position:fixed;bottom:24px;left:24px;z-index:999999;font-family:system-ui,-apple-system,sans-serif;";

    bellWrap.innerHTML = '<div id="pf-bell-btn" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg, #7c3aed, #4f46e5);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 25px rgba(124,58,237,0.4);cursor:pointer;position:relative;">' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
      '<span style="position:absolute;top:2px;right:2px;width:10px;height:10px;background:#ef4444;border-radius:50%;border:2px solid #fff;"></span>' +
      '</div>' +
      '<div id="pf-bell-card" style="display:none;position:absolute;bottom:60px;left:0;width:300px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);color:#1e293b;">' +
      '<h4 style="margin:0 0 6px 0;font-size:14px;font-weight:700;">' + title + '</h4>' +
      '<p style="margin:0 0 12px 0;font-size:12px;color:#64748b;line-height:1.4;">' + message + '</p>' +
      '<button id="pf-bell-allow-btn" style="width:100%;background:#7c3aed;color:#fff;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">' + (opts.allowText || "Subscribe Now") + '</button>' +
      '</div>';

    document.body.appendChild(bellWrap);

    var bellBtn = document.getElementById("pf-bell-btn");
    var bellCard = document.getElementById("pf-bell-card");
    var allowBtn = document.getElementById("pf-bell-allow-btn");

    if (bellBtn && bellCard) {
      bellBtn.onclick = function () {
        bellCard.style.display = bellCard.style.display === "none" ? "block" : "none";
      };
    }
    if (allowBtn) {
      allowBtn.onclick = function () {
        bellCard.style.display = "none";
        PushForge.requestPermissionAndSubscribe().catch(function () {});
      };
    }
  }

  function showCombinedDualPrompt(opts) {
    opts = opts || {};
    var title = opts.headline || opts.title || "Get VIP Updates & Notifications";
    var message = opts.description || opts.message || "Enter your email to receive exclusive offers, and click allow to get push notifications!";
    var acceptText = opts.allowText || opts.acceptText || "Subscribe & Allow Notifications";
    var cancelText = opts.dismissText || opts.cancelText || "Later";

    var existingModal = document.getElementById("pushforge-combined-modal");
    if (existingModal && existingModal.parentNode) {
      existingModal.parentNode.removeChild(existingModal);
    }

    var modal = document.createElement("div");
    modal.id = "pushforge-combined-modal";
    modal.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:999999;width:380px;max-width:calc(100vw - 32px);background:#ffffff;box-shadow:0 25px 50px -12px rgba(124,58,237,0.25), 0 10px 15px -3px rgba(0,0,0,0.1);border-radius:20px;padding:24px;font-family:system-ui,-apple-system,sans-serif;color:#1e293b;border:1px solid #e2e8f0;transition:all 0.3s ease;";

    modal.innerHTML = '<div style="display:flex;flex-direction:column;gap:14px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="background:linear-gradient(135deg, #7c3aed, #4f46e5);color:#ffffff;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(124,58,237,0.3);">' +
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>' +
      '</div>' +
      '<h4 style="margin:0;font-size:15px;font-weight:700;color:#0f172a;">' + title + '</h4>' +
      '</div>' +
      '<button id="pf-dual-close" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:0;line-height:1;">&times;</button>' +
      '</div>' +
      '<p style="margin:0;font-size:13px;line-height:1.45;color:#64748b;">' + message + '</p>' +
      '<form id="pf-dual-form" style="display:flex;flex-direction:column;gap:10px;margin-top:4px;">' +
      '<input type="email" id="pf-dual-email" placeholder="Enter your email address..." style="width:100%;box-sizing:border-box;padding:10px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:13px;outline:none;" />' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px;">' +
      '<button type="button" id="pf-dual-cancel" style="background:#f1f5f9;color:#64748b;border:none;padding:9px 14px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;">' + cancelText + '</button>' +
      '<button type="submit" id="pf-dual-submit" style="background:linear-gradient(135deg, #7c3aed, #4f46e5);color:#ffffff;border:none;padding:9px 16px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(124,58,237,0.3);">' + acceptText + '</button>' +
      '</div>' +
      '</form>' +
      '<div id="pf-dual-status" style="display:none;font-size:12px;margin-top:2px;"></div>' +
      '</div>';

    document.body.appendChild(modal);

    var closeBtn = document.getElementById("pf-dual-close");
    var cancelBtn = document.getElementById("pf-dual-cancel");
    var form = document.getElementById("pf-dual-form");
    var statusDiv = document.getElementById("pf-dual-status");
    var submitBtn = document.getElementById("pf-dual-submit");

    var removeModal = function () {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    var snoozeAndCloseModal = function () {
      snoozePrompt(7);
      removeModal();
    };

    if (closeBtn) closeBtn.onclick = snoozeAndCloseModal;
    if (cancelBtn) cancelBtn.onclick = snoozeAndCloseModal;

    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var emailInput = document.getElementById("pf-dual-email");
        var val = emailInput ? emailInput.value.trim() : "";
        var hasValidEmail = Boolean(val && val.includes("@"));

        submitBtn.disabled = true;
        submitBtn.innerText = "Saving...";

        var emailSaved = false;

        var saveEmail = function () {
          if (hasValidEmail) {
            return collectEmail(val, "", "Combined Dual Prompt")
              .then(function () {
                emailSaved = true;
              })
              .catch(function (err) {
                console.warn("PushForge email collection fallback:", err.message || err);
              });
          }
          return Promise.resolve();
        };

        saveEmail()
          .then(function () {
            if (hasValidEmail || emailSaved) {
              statusDiv.style.display = "block";
              statusDiv.style.color = "#10b981";
              statusDiv.innerText = "Thank you! Email registered successfully.";
            }

            if (Notification.permission === "denied") {
              console.log("PushForge: Browser push permission is denied. Email collected successfully.");
              setTimeout(removeModal, 1500);
              return;
            }

            return PushForge.requestPermissionAndSubscribe()
              .then(function () {
                statusDiv.style.display = "block";
                statusDiv.style.color = "#10b981";
                statusDiv.innerText = "Thank you! Subscribed to updates & notifications.";
                setTimeout(removeModal, 1200);
              })
              .catch(function (pushErr) {
                console.log("PushForge push permission note:", pushErr.message || pushErr);
                if (emailSaved || hasValidEmail) {
                  statusDiv.style.display = "block";
                  statusDiv.style.color = "#10b981";
                  statusDiv.innerText = "Thank you! Email registered successfully.";
                  setTimeout(removeModal, 1500);
                } else {
                  statusDiv.style.display = "block";
                  statusDiv.style.color = "#ef4444";
                  statusDiv.innerText = "Please enter a valid email address.";
                  submitBtn.disabled = false;
                  submitBtn.innerText = acceptText;
                }
              });
          })
          .catch(function (err) {
            console.warn("PushForge form submit handler note:", err);
            setTimeout(removeModal, 1500);
          });
      };
    }
  }

  function fetchSiteConfigAndAutoPrompt() {
    fetch(host + "/api/v1/public/config", {
      headers: { "x-site-key": siteKey }
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.publicKey) setCachedVapidKey(data.publicKey);
        var config = data.promptConfig || {};

        if (config.autoPrompt === false) return;

        if (isSnoozed() && !isForcePreview()) {
          console.log("PushForge: Opt-in prompt is currently snoozed in browser localStorage. Add ?reset_snooze=1 to URL or run PushForge.resetSnooze() to display again.");
          return;
        }

        var delay = (config.delaySeconds || 1) * 1000;
        setTimeout(function () {
          var mode = config.promptMode || "push-only";
          var style = config.promptStyle || "glass-modal";

          if (mode === "email-only") {
            showEmailPrompt(config);
            return;
          }

          if (mode === "combined-dual") {
            showCombinedDualPrompt(config);
            return;
          }

          if (mode === "push-fallback-email") {
            if (Notification.permission === "denied" || !("Notification" in window)) {
              showEmailPrompt(config);
              return;
            }

            showCustomPrompt({
              title: config.headline,
              message: config.description,
              acceptText: config.allowText,
              cancelText: config.dismissText,
              cardPosition: config.cardPosition,
              onDismiss: function () {
                showEmailPrompt(config);
              }
            });
            return;
          }

          // Default: push-only
          if (style === "email-capture") {
            showEmailPrompt(config);
          } else if (style === "browser-native") {
            if (Notification.permission === "default") {
              PushForge.requestPermissionAndSubscribe().catch(function () {});
            }
          } else if (style === "bell-widget") {
            renderBellWidget(config);
          } else {
            showCustomPrompt({
              title: config.headline,
              message: config.description,
              acceptText: config.allowText,
              cancelText: config.dismissText,
              cardPosition: config.cardPosition
            });
          }
        }, delay);
      })
      .catch(function (err) {
        console.warn("PushForge SDK config fetch fallback:", err.message);
      });
  }

  function init() {
    sendEvent("pageview");
    fetchSiteConfigAndAutoPrompt();

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
    emailPrompt: showEmailPrompt,
    combinedPrompt: showCombinedDualPrompt,
    collectEmail: collectEmail,
    snoozePrompt: snoozePrompt,
    resetSnooze: resetSnooze,
    isSnoozed: isSnoozed,
    requestPermissionAndSubscribe: function () {
      if (!("Notification" in window)) {
        return Promise.reject(new Error("Notifications are not supported by this browser"));
      }
      if (Notification.permission === "granted") {
        return subscribeUser();
      }
      return new Promise(function (resolve, reject) {
        try {
          var req = Notification.requestPermission(function (permission) {
            if (permission === "granted") {
              subscribeUser().then(resolve).catch(reject);
            } else {
              reject(new Error("Notification permission denied"));
            }
          });
          if (req && typeof req.then === "function") {
            req.then(function (permission) {
              if (permission === "granted") {
                subscribeUser().then(resolve).catch(reject);
              } else {
                reject(new Error("Notification permission denied"));
              }
            }).catch(reject);
          }
        } catch (e) {
          reject(e);
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
