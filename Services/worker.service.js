const { webpush, getVapidPublicKey, getVapidPrivateKey } = require("../Config/vapid.config");
const { Notification, Subscriber, NotificationLog } = require("../Models");
const { resolveAudienceQuery } = require("./audience.service");

const GO_WORKER_URL = process.env.GO_WORKER_URL || "http://127.0.0.1:8080/dispatch";
const GO_WORKER_TIMEOUT_MS = Number.parseInt(process.env.GO_WORKER_TIMEOUT_MS, 10) || 600000;

// Public origin of this API, used by the service worker to post click telemetry
// back to the backend rather than to the customer's own site.
const PUBLIC_API_HOST = process.env.PUBLIC_API_HOST || process.env.CORS_ORIGIN || "";

const buildPayload = (notification) => ({
  title: notification.title,
  body: notification.body,
  icon: notification.icon || "/favicon.ico",
  badge: notification.badge || "/favicon.ico",
  image: notification.image || null,
  clickUrl: notification.clickUrl || "/",
  actionButtons: notification.actionButtons || [],
  // Without these the service worker cannot attribute clicks or find the API.
  campaignId: notification._id.toString(),
  siteKey: notification.siteKey,
  host: PUBLIC_API_HOST || null,
  _id: notification._id.toString()
});

// The Go engine only understands "every active subscriber". Anything that needs
// audience rules, an explicit subscriber subset, or per-subscriber log rows has
// to go through the Node worker, which is the only path that writes them.
const canUseGoWorker = (notification, job) => {
  const needsNodeOnly =
    job.type !== "broadcast" ||
    notification.targetType !== "all" ||
    (job.subscriberIds && job.subscriberIds.length > 0);

  return !needsNodeOnly;
};

const dispatchViaGoWorker = async (notification) => {
  const response = await fetch(GO_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      notificationId: notification._id.toString(),
      websiteId: notification.website.toString(),
      vapidPublicKey: getVapidPublicKey(),
      vapidPrivateKey: getVapidPrivateKey(),
      vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@pushforge.com",
      concurrency: Number.parseInt(process.env.GO_WORKER_CONCURRENCY, 10) || 500
    }),
    signal: AbortSignal.timeout(GO_WORKER_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Go worker responded with HTTP ${response.status}`);
  }

  return response.json();
};

const resolveSubscribers = async (notification, job) => {
  if (job.subscriberIds && job.subscriberIds.length > 0) {
    return Subscriber.find({ _id: { $in: job.subscriberIds }, website: notification.website });
  }
  const query = await resolveAudienceQuery(notification);
  return Subscriber.find(query);
};

const sendToSubscriber = async (subscriber, payloadStr) => {
  const pushSubscription = {
    endpoint: subscriber.endpoint,
    keys: { p256dh: subscriber.keys.p256dh, auth: subscriber.keys.auth }
  };

  await webpush.sendNotification(pushSubscription, payloadStr);
};

const dispatchViaNodeWorker = async (notification, job) => {
  const subscribers = await resolveSubscribers(notification, job);
  const payloadStr = JSON.stringify(buildPayload(notification));

  // A test send is a probe, not a campaign delivery, so it must not write log
  // rows: they would corrupt the per-send report and a failed test would be
  // picked up by retry-failed as if the campaign had failed.
  const recordLogs = job.type !== "test";

  let sentCount = 0;
  let deliveredCount = 0;
  let failedCount = 0;
  const logs = [];
  const expiredSubscriberIds = [];
  const batchSize = Number.parseInt(process.env.NODE_WORKER_BATCH_SIZE, 10) || 50;

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (subscriber) => {
        sentCount++;
        try {
          await sendToSubscriber(subscriber, payloadStr);
          deliveredCount++;
          if (recordLogs) {
            logs.push({
              notification: notification._id,
              subscriber: subscriber._id,
              website: notification.website,
              status: "delivered"
            });
          }
        } catch (error) {
          failedCount++;
          // A dead endpoint is real information regardless of why we sent.
          const isExpired = error.statusCode === 410 || error.statusCode === 404;
          if (isExpired) {
            expiredSubscriberIds.push(subscriber._id);
          }
          if (recordLogs) {
            logs.push({
              notification: notification._id,
              subscriber: subscriber._id,
              website: notification.website,
              status: "failed",
              errorMessage: error.message || `HTTP ${error.statusCode}`
            });
          }
        }
      })
    );
  }

  if (logs.length > 0) {
    await NotificationLog.insertMany(logs);
  }

  if (expiredSubscriberIds.length > 0) {
    await Subscriber.updateMany({ _id: { $in: expiredSubscriberIds } }, { $set: { isActive: false } });
  }

  return { sent: sentCount, delivered: deliveredCount, failed: failedCount, handledBy: "node" };
};

// Dispatches one job. Returns the delivery counters, or throws so the queue can
// apply its backoff policy.
const executeDispatch = async (notification, job) => {
  if (canUseGoWorker(notification, job)) {
    try {
      const goResult = await dispatchViaGoWorker(notification);
      console.log(`Go worker dispatched notification ${notification._id}: ${goResult.message}`);
      return {
        sent: goResult.total || 0,
        delivered: goResult.delivered || 0,
        failed: goResult.failed || 0,
        handledBy: "go"
      };
    } catch (goError) {
      console.warn(`Go worker unavailable (${goError.message}). Falling back to the Node worker.`);
    }
  }

  return dispatchViaNodeWorker(notification, job);
};

// Runs the job for a notification and writes the terminal state back onto the
// notification. A "test" job is deliberately side-effect free so a test send
// never rewrites campaign statistics.
const processDispatchJob = async (job) => {
  const notification = await Notification.findById(job.notification);
  if (!notification) {
    const error = new Error("Notification no longer exists");
    error.permanent = true;
    throw error;
  }

  const result = await executeDispatch(notification, job);

  if (job.type === "test") {
    return { result, notification };
  }

  const isRetry = job.type === "retry_failed";

  notification.status = "sent";
  notification.sentAt = new Date();
  notification.handledBy = result.handledBy;

  if (isRetry) {
    // A retry only re-contacts the previously failed slice, so the audience
    // size is unchanged: delivered moves up, failed moves down by the same
    // number, and anything still failing stays counted as failed.
    const previouslyFailed = notification.stats?.failed || 0;
    notification.stats = {
      sent: notification.stats?.sent || 0,
      delivered: (notification.stats?.delivered || 0) + result.delivered,
      clicked: notification.stats?.clicked || 0,
      failed: Math.max(0, previouslyFailed - result.delivered)
    };
  } else {
    notification.stats = {
      sent: result.sent,
      delivered: result.delivered,
      clicked: notification.stats?.clicked || 0,
      failed: result.failed
    };
  }

  await notification.save();

  return { result, notification };
};

// Kept for callers that dispatch a single notification outside the queue.
const dispatchNotification = async (notificationId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    console.error(`Worker error: notification ${notificationId} not found`);
    return null;
  }
  return processDispatchJob({ notification: notification._id, type: "broadcast", subscriberIds: [] });
};

module.exports = {
  dispatchNotification,
  processDispatchJob,
  executeDispatch,
  canUseGoWorker,
  buildPayload
};
