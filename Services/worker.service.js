const { webpush, getVapidPublicKey, getVapidPrivateKey } = require("../Config/vapid.config");
const { Notification, Subscriber, NotificationLog, Segment } = require("../Models");

const GO_WORKER_URL = process.env.GO_WORKER_URL || "http://127.0.0.1:8080/dispatch";

const buildSegmentQuery = (rules, websiteId) => {
  const query = { website: websiteId, isActive: true };
  if (!Array.isArray(rules) || rules.length === 0) return query;

  rules.forEach((rule) => {
    const { field, operator, value } = rule;
    if (!field || !operator) return;

    if (operator === "equals") query[field] = value;
    else if (operator === "not_equals") query[field] = { $ne: value };
    else if (operator === "contains") query[field] = new RegExp(value, "i");
    else if (operator === "in" && Array.isArray(value)) query[field] = { $in: value };
    else if (operator === "greater_than") query[field] = { $gt: value };
    else if (operator === "less_than") query[field] = { $lt: value };
  });

  return query;
};

const dispatchNotification = async (notificationId) => {
  try {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      console.error(`Worker error: Notification ${notificationId} not found`);
      return;
    }

    // ── STEP 1: Attempt High-Speed Go Worker Engine Dispatch ──
    try {
      const vapidPublicKey = getVapidPublicKey();
      const vapidPrivateKey = getVapidPrivateKey();
      const goResponse = await fetch(GO_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: notification._id.toString(),
          websiteId: notification.website.toString(),
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@pushforge.com",
          concurrency: 500
        }),
        signal: AbortSignal.timeout(600000)
      });

      if (goResponse.ok) {
        const goData = await goResponse.json();
        console.log(`⚡ [GO-WORKER ENGINE SUCCESS] Dispatched via Golang (500 Goroutines): ${goData.message} in ${goData.durationMs}ms`);
        return;
      }
    } catch (goErr) {
      console.log(`ℹ️ Go Worker Engine unavailable on ${GO_WORKER_URL}. Falling back to Node.js async batch worker.`);
    }

    // ── STEP 2: Node.js Fallback Worker ──
    let subscriberQuery = { website: notification.website, isActive: true };

    if (notification.targetType === "segment" && notification.segment) {
      const segment = await Segment.findById(notification.segment);
      if (segment) {
        subscriberQuery = buildSegmentQuery(segment.rules, notification.website);
      }
    }

    const subscribers = await Subscriber.find(subscriberQuery);
    const totalSubscribers = subscribers.length;

    const payloadObj = {
      title: notification.title,
      body: notification.body,
      icon: notification.icon || "/favicon.ico",
      badge: notification.badge || "/favicon.ico",
      image: notification.image || null,
      clickUrl: notification.clickUrl || "/",
      actionButtons: notification.actionButtons || []
    };
    const payloadStr = JSON.stringify(payloadObj);

    let sentCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;

    const logs = [];
    const batchSize = 50;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (subscriber) => {
          sentCount++;
          const pushSubscription = {
            endpoint: subscriber.endpoint,
            keys: {
              p256dh: subscriber.keys.p256dh,
              auth: subscriber.keys.auth
            }
          };

          try {
            await webpush.sendNotification(pushSubscription, payloadStr);
            deliveredCount++;
            logs.push({
              notification: notification._id,
              subscriber: subscriber._id,
              website: notification.website,
              status: "delivered"
            });
          } catch (error) {
            failedCount++;
            const isExpired = error.statusCode === 410 || error.statusCode === 404;

            if (isExpired) {
              await Subscriber.findByIdAndUpdate(subscriber._id, { isActive: false });
            }

            logs.push({
              notification: notification._id,
              subscriber: subscriber._id,
              website: notification.website,
              status: "failed",
              errorMessage: error.message || `HTTP ${error.statusCode}`
            });
          }
        })
      );
    }

    if (logs.length > 0) {
      await NotificationLog.insertMany(logs);
    }

    notification.status = "sent";
    notification.stats = {
      sent: sentCount,
      delivered: deliveredCount,
      clicked: notification.stats ? notification.stats.clicked || 0 : 0,
      failed: failedCount
    };
    await notification.save();

    console.log(`Worker: Notification ${notificationId} processed. Total: ${totalSubscribers}, Delivered: ${deliveredCount}, Failed: ${failedCount}`);
  } catch (error) {
    console.error(`Worker execution error for notification ${notificationId}:`, error.message);
    await Notification.findByIdAndUpdate(notificationId, { status: "failed" });
  }
};

module.exports = {
  dispatchNotification
};
