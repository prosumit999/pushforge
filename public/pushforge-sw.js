// The API host is supplied by the SDK at registration time via the script URL
// query string, because this worker runs on the customer's origin rather than
// the PushForge API origin.
function resolveApiHost() {
  try {
    var apiHost = new URL(self.location.href).searchParams.get("apiHost");
    if (apiHost) return apiHost;
  } catch (e) {}
  return null;
}

self.addEventListener("push", function (event) {
  var data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "New Notification", body: event.data.text() };
    }
  } else {
    data = { title: "Push Notification", body: "You have a new update!" };
  }

  var title = data.title || "Notification";
  var isSticky = Boolean(data.requireInteraction || data.sticky || data.isSticky);

  var options = {
    body: data.body || "",
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    image: data.image || null,
    requireInteraction: isSticky,
    data: {
      url: data.clickUrl || data.url || "/",
      button1Url: data.button1Url || (data.actionButtons && data.actionButtons[0] ? data.actionButtons[0].url : null),
      button2Url: data.button2Url || (data.actionButtons && data.actionButtons[1] ? data.actionButtons[1].url : null),
      campaignId: data.campaignId || data._id || null,
      siteKey: data.siteKey || null,
      host: data.host || self.location.origin
    },
    actions: data.actionButtons || []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var notificationData = event.notification.data || {};
  var actionClicked = event.action || "default";

  // Route to specific action button URL if clicked
  var targetUrl = notificationData.url || "/";
  if ((actionClicked === "action_1" || actionClicked === "button1") && notificationData.button1Url) {
    targetUrl = notificationData.button1Url;
  } else if ((actionClicked === "action_2" || actionClicked === "button2") && notificationData.button2Url) {
    targetUrl = notificationData.button2Url;
  }

  // Fast background click analytics telemetry
  var targetHost = notificationData.host || resolveApiHost() || self.location.origin;

  if (notificationData.siteKey) {
    // Report this device's own push endpoint so the click can be attributed to
    // the subscriber that actually received the notification.
    event.waitUntil(
      self.registration.pushManager
        .getSubscription()
        .then(function (sub) { return sub ? sub.endpoint : null; })
        .catch(function () { return null; })
        .then(function (endpoint) {
          var clickPayload = JSON.stringify({
            eventType: "click",
            campaignId: notificationData.campaignId || null,
            action: actionClicked,
            url: targetUrl,
            endpoint: endpoint,
            timestamp: new Date().toISOString()
          });

          return fetch(targetHost + "/api/v1/public/click", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-site-key": notificationData.siteKey
            },
            body: clickPayload
          }).catch(function (err) {
            console.warn("PushForge SW: Click analytics telemetry failed", err);
          });
        })
    );
  }

  // Focus existing open window or open target URL in new window
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Auto-Renew Push Subscriptions when token rotates/expires in background
self.addEventListener("pushsubscriptionchange", function (event) {
  event.waitUntil(
    self.registration.pushManager.subscribe(
      event.oldSubscription ? event.oldSubscription.options : { userVisibleOnly: true }
    )
      .then(function (newSubscription) {
        console.log("PushForge SW: Push subscription auto-renewed successfully");
        var apiHost = self.location.origin;
        return fetch(apiHost + "/api/v1/public/subscription-change", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
            newSubscription: newSubscription
          })
        }).catch(function (err) {
          console.warn("PushForge SW: Token renewal sync failed", err);
        });
      })
      .catch(function (err) {
        console.error("PushForge SW: Auto-renewal failed", err);
      })
  );
});
