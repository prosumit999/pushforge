const { Notification, NotificationLog, Subscriber, Website } = require("../Models");
const queueService = require("./queue.service");
const workerService = require("./worker.service");

const DEFAULT_LOG_LIMIT = 50;
const MAX_LOG_LIMIT = 200;

const verifyWebsiteOwnership = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found or unauthorized");
    error.statusCode = 404;
    throw error;
  }
  return website;
};

const loadOwnedNotification = async (userId, websiteId, notificationId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const notification = await Notification.findOne({ _id: notificationId, website: websiteId });
  if (!notification) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }
  return notification;
};

const parsePagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const rawLimit = Number.parseInt(query.limit, 10) || DEFAULT_LOG_LIMIT;
  const limit = Math.min(Math.max(1, rawLimit), MAX_LOG_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
};

// Per-send report: aggregate counters from the notification itself (populated
// by both engines) plus the per-subscriber detail that only the Node worker
// writes.
const getDeliveryReport = async (userId, websiteId, notificationId, query = {}) => {
  const notification = await loadOwnedNotification(userId, websiteId, notificationId);
  const { page, limit, skip } = parsePagination(query);

  const logFilter = { notification: notification._id };
  if (query.status) {
    logFilter.status = query.status;
  }

  const [statusBreakdown, clickTotals, logs, totalLogs, jobs] = await Promise.all([
    NotificationLog.aggregate([
      { $match: { notification: notification._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    // Total clicks including repeats, as opposed to unique clicking subscribers.
    NotificationLog.aggregate([
      { $match: { notification: notification._id } },
      { $group: { _id: null, total: { $sum: "$clickCount" } } }
    ]),
    NotificationLog.find(logFilter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("subscriber", "endpoint device location isActive")
      .lean(),
    NotificationLog.countDocuments(logFilter),
    queueService.getJobsForNotification(notification._id)
  ]);

  const breakdown = { sent: 0, delivered: 0, clicked: 0, failed: 0 };
  statusBreakdown.forEach((row) => {
    if (row._id in breakdown) breakdown[row._id] = row.count;
  });
  const totalClickCount = clickTotals.length > 0 ? clickTotals[0].total || 0 : 0;

  const stats = notification.stats || { sent: 0, delivered: 0, clicked: 0, failed: 0 };
  const ctr = stats.delivered > 0 ? Number(((stats.clicked / stats.delivered) * 100).toFixed(2)) : 0;

  return {
    notification: {
      _id: notification._id,
      title: notification.title,
      status: notification.status,
      targetType: notification.targetType,
      handledBy: notification.handledBy,
      scheduledAt: notification.scheduledAt,
      sentAt: notification.sentAt,
      createdAt: notification.createdAt
    },
    stats: { ...stats, ctr },
    // "clicked" rows were delivered too, so they are reported separately rather
    // than being folded into the delivered bucket.
    logSummary: {
      delivered: breakdown.delivered,
      clicked: breakdown.clicked,
      failed: breakdown.failed,
      deliveredIncludingClicks: breakdown.delivered + breakdown.clicked,
      totalClicks: totalClickCount
    },
    // Explains why the per-subscriber table can be empty on a Go-dispatched send.
    perSubscriberDetailAvailable: notification.handledBy === "node" || totalLogs > 0,
    logs,
    pagination: { page, limit, total: totalLogs, pages: Math.ceil(totalLogs / limit) || 1 },
    jobs: jobs.map((job) => ({
      _id: job._id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      lastError: job.lastError,
      result: job.result,
      runAt: job.runAt,
      completedAt: job.completedAt,
      createdAt: job.createdAt
    }))
  };
};

// Re-sends only the subscribers whose most recent attempt failed.
const retryFailed = async (userId, websiteId, notificationId) => {
  const notification = await loadOwnedNotification(userId, websiteId, notificationId);

  const failedLogs = await NotificationLog.find({ notification: notification._id, status: "failed" })
    .select("subscriber")
    .lean();

  // A subscriber can accumulate several failed rows, and one who later
  // succeeded must not be retried, so the failed set is reduced to subscribers
  // with no successful row.
  const failedIds = failedLogs.map((log) => log.subscriber).filter(Boolean);

  if (failedIds.length === 0) {
    const error = new Error("This notification has no failed deliveries to retry");
    error.statusCode = 409;
    throw error;
  }

  const deliveredIds = await NotificationLog.find({
    notification: notification._id,
    subscriber: { $in: failedIds },
    status: { $in: ["delivered", "clicked"] }
  })
    .select("subscriber")
    .lean();

  const deliveredSet = new Set(deliveredIds.map((log) => String(log.subscriber)));
  const retryIds = [...new Set(failedIds.map(String))].filter((id) => !deliveredSet.has(id));

  if (retryIds.length === 0) {
    const error = new Error("Every previously failed subscriber has since been delivered to");
    error.statusCode = 409;
    throw error;
  }

  if (await queueService.hasLiveJob(notification._id)) {
    const error = new Error("A dispatch for this notification is already queued or running");
    error.statusCode = 409;
    throw error;
  }

  const job = await queueService.enqueue({
    notification: notification._id,
    website: notification.website,
    type: "retry_failed",
    subscriberIds: retryIds
  });

  notification.status = "queued";
  await notification.save();

  return { queued: retryIds.length, jobId: job._id, message: `Retrying delivery for ${retryIds.length} subscriber(s)` };
};

// Sends the notification to one subscriber without touching campaign stats, so
// a test never corrupts the real delivery numbers.
const sendTestPush = async (userId, websiteId, notificationId, { subscriberId }) => {
  const notification = await loadOwnedNotification(userId, websiteId, notificationId);

  const subscriber = await Subscriber.findOne({ _id: subscriberId, website: websiteId });
  if (!subscriber) {
    const error = new Error("Subscriber not found for this website");
    error.statusCode = 404;
    throw error;
  }
  if (!subscriber.isActive) {
    const error = new Error("That subscriber is marked inactive and would reject a push");
    error.statusCode = 409;
    throw error;
  }

  const result = await workerService.executeDispatch(notification, {
    type: "test",
    subscriberIds: [subscriber._id]
  });

  return {
    delivered: result.delivered,
    failed: result.failed,
    handledBy: result.handledBy,
    subscriberId: subscriber._id,
    message: result.delivered > 0 ? "Test push delivered" : "Test push failed to deliver"
  };
};

module.exports = {
  getDeliveryReport,
  retryFailed,
  sendTestPush
};
