const mongoose = require("mongoose");
const { Notification, Website, Segment, Subscriber, DispatchJob, NotificationLog } = require("../Models");
const queueService = require("./queue.service");
const { buildSubscriberQuery, estimateAudienceSize } = require("./audience.service");

const verifyWebsiteOwnership = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found or unauthorized");
    error.statusCode = 404;
    throw error;
  }
  return website;
};

const createNotification = async (userId, websiteId, data) => {
  const website = await verifyWebsiteOwnership(userId, websiteId);

  const {
    title, body, icon, badge, image, clickUrl, actionButtons,
    targetType, segment, filterRules, scheduledAt, isTemplate, templateName
  } = data;

  const validSegment = (segment && mongoose.Types.ObjectId.isValid(segment)) ? segment : null;
  const resolvedTargetType = targetType || "all";

  if (resolvedTargetType === "segment" && !validSegment) {
    const error = new Error("targetType \"segment\" requires a valid segment id");
    error.statusCode = 400;
    throw error;
  }

  // Filter rules are validated against the audience allowlist at write time so
  // a bad rule fails fast here rather than at dispatch.
  let normalizedFilterRules = [];
  if (resolvedTargetType === "filter") {
    if (!Array.isArray(filterRules) || filterRules.length === 0) {
      const error = new Error("targetType \"filter\" requires at least one filter rule");
      error.statusCode = 400;
      throw error;
    }
    // Throws FilterValidationError (400) when a rule targets a disallowed field.
    buildSubscriberQuery(websiteId, filterRules);
    normalizedFilterRules = filterRules;
  }

  // A supplied schedule must be a real future instant; anything else would
  // either fail Mongoose casting or fire immediately by surprise.
  let normalizedScheduledAt = null;
  if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      const error = new Error("Invalid scheduledAt value");
      error.statusCode = 400;
      throw error;
    }
    if (when.getTime() <= Date.now()) {
      const error = new Error("scheduledAt must be a future date and time");
      error.statusCode = 400;
      throw error;
    }
    normalizedScheduledAt = when;
  }

  const status = normalizedScheduledAt ? "scheduled" : "draft";

  const notification = await Notification.create({
    website: websiteId,
    siteKey: website.siteKey,
    title,
    body,
    icon,
    badge,
    image,
    clickUrl,
    actionButtons: actionButtons || [],
    targetType: resolvedTargetType,
    segment: resolvedTargetType === "segment" ? validSegment : null,
    filterRules: normalizedFilterRules,
    scheduledAt: normalizedScheduledAt,
    status,
    isTemplate: Boolean(isTemplate),
    templateName: templateName || ""
  });

  return notification;
};

const getWebsiteNotifications = async (userId, websiteId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  return await Notification.find({ website: websiteId, isTemplate: false }).sort({ createdAt: -1 });
};

const getNotificationById = async (userId, websiteId, notificationId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const notification = await Notification.findOne({ _id: notificationId, website: websiteId })
    .populate("segment", "name rules estimatedCount");
  if (!notification) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }
  return notification;
};

const sendNotification = async (userId, websiteId, notificationId) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const existing = await Notification.findOne({ _id: notificationId, website: websiteId });
  if (!existing) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }

  if (await queueService.hasLiveJob(existing._id)) {
    const error = new Error("A dispatch for this notification is already queued or running");
    error.statusCode = 409;
    throw error;
  }

  // Atomic claim so a manual send cannot race the scheduler or fire twice on a
  // double click. A manual send also resets the attempt budget.
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, website: websiteId, status: { $nin: ["queued", "sending"] } },
    { $set: { status: "queued", dispatchAttempts: 0 } },
    { returnDocument: "after" }
  );

  if (!notification) {
    const error = new Error("Notification is already queued or being dispatched");
    error.statusCode = 409;
    throw error;
  }

  const job = await queueService.enqueue({
    notification: notification._id,
    website: notification.website,
    type: "broadcast"
  });

  return {
    message: "Notification queued for delivery",
    notification,
    jobId: job._id
  };
};

const reschedulableStatuses = ["draft", "scheduled", "failed", "cancelled"];

const scheduleNotification = async (userId, websiteId, notificationId, scheduledAt) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) {
    const error = new Error("Invalid scheduledAt value");
    error.statusCode = 400;
    throw error;
  }
  if (when.getTime() <= Date.now()) {
    const error = new Error("scheduledAt must be a future date and time");
    error.statusCode = 400;
    throw error;
  }

  // Status is part of the filter so a notification already claimed by the
  // scheduler cannot be rescheduled out from under an in-flight dispatch.
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, website: websiteId, isTemplate: false, status: { $in: reschedulableStatuses } },
    {
      $set: { status: "scheduled", scheduledAt: when, cancelledAt: null, dispatchAttempts: 0 }
    },
    { returnDocument: "after" }
  );

  if (!notification) {
    const error = new Error("Notification not found or is not in a schedulable state");
    error.statusCode = 409;
    throw error;
  }

  return notification;
};

const cancelScheduledNotification = async (userId, websiteId, notificationId) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, website: websiteId, isTemplate: false, status: "scheduled" },
    {
      $set: { status: "cancelled", cancelledAt: new Date(), scheduledAt: null }
    },
    { returnDocument: "after" }
  );

  if (!notification) {
    const error = new Error("Notification not found or is not scheduled");
    error.statusCode = 409;
    throw error;
  }

  return notification;
};

const saveAsTemplate = async (userId, websiteId, notificationId, templateName) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const notification = await Notification.findOne({ _id: notificationId, website: websiteId });
  if (!notification) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }

  const template = await Notification.create({
    website: websiteId,
    siteKey: notification.siteKey,
    title: notification.title,
    body: notification.body,
    icon: notification.icon,
    badge: notification.badge,
    image: notification.image,
    clickUrl: notification.clickUrl,
    actionButtons: notification.actionButtons,
    isTemplate: true,
    templateName: templateName || notification.title,
    status: "draft"
  });

  return template;
};

// Updates a reusable template in place. Templates are never dispatched, so only
// presentation fields may change, and the status stays "draft".
const updateTemplate = async (userId, websiteId, templateId, data) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const template = await Notification.findOne({ _id: templateId, website: websiteId, isTemplate: true });
  if (!template) {
    const error = new Error("Template not found");
    error.statusCode = 404;
    throw error;
  }

  const allowedFields = ["title", "body", "icon", "badge", "image", "clickUrl", "actionButtons", "templateName"];
  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      template[field] = data[field];
    }
  });

  // A template without a name is unusable in the picker, so fall back to title.
  if (!template.templateName || !String(template.templateName).trim()) {
    template.templateName = template.title;
  }

  await template.save();
  return template;
};

// Copies a template into a real, dispatchable draft notification.
const createFromTemplate = async (userId, websiteId, templateId, overrides = {}) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const template = await Notification.findOne({ _id: templateId, website: websiteId, isTemplate: true });
  if (!template) {
    const error = new Error("Template not found");
    error.statusCode = 404;
    throw error;
  }

  const notification = await Notification.create({
    website: websiteId,
    siteKey: template.siteKey,
    title: overrides.title || template.title,
    body: overrides.body || template.body,
    icon: overrides.icon || template.icon,
    badge: overrides.badge || template.badge,
    image: overrides.image || template.image,
    clickUrl: overrides.clickUrl || template.clickUrl,
    actionButtons: overrides.actionButtons || template.actionButtons,
    targetType: overrides.targetType || "all",
    segment: overrides.segment || null,
    filterRules: overrides.filterRules || [],
    isTemplate: false,
    status: "draft"
  });

  return notification;
};

const getTemplates = async (userId, websiteId) => {
  await verifyWebsiteOwnership(userId, websiteId);  return await Notification.find({ website: websiteId, isTemplate: true }).sort({ createdAt: -1 });
};

const deleteNotification = async (userId, websiteId, notificationId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const notification = await Notification.findOneAndDelete({ _id: notificationId, website: websiteId });
  if (!notification) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }

  // Drop queued work and log rows too, otherwise the queue keeps dispatching a
  // deleted notification and the report tables grow forever.
  await Promise.all([
    DispatchJob.deleteMany({ notification: notification._id }),
    NotificationLog.deleteMany({ notification: notification._id })
  ]);

  return { message: "Notification deleted successfully" };
};

// Audience preview for the composer. Estimates against a saved segment or
// ad-hoc filter rules without persisting anything.
const previewAudience = async (userId, websiteId, { targetType, segmentId, rules } = {}) => {
  await verifyWebsiteOwnership(userId, websiteId);

  if (targetType === "segment") {
    const segment = await Segment.findOne({ _id: segmentId, website: websiteId });
    if (!segment) {
      const error = new Error("Segment not found");
      error.statusCode = 404;
      throw error;
    }
    const estimatedCount = await Subscriber.countDocuments(buildSubscriberQuery(websiteId, segment.rules));
    return { estimatedCount, source: "segment", segmentName: segment.name };
  }

  if (targetType === "filter") {
    const estimatedCount = await estimateAudienceSize(websiteId, rules || []);
    return { estimatedCount, source: "filter" };
  }

  const estimatedCount = await estimateAudienceSize(websiteId, []);
  return { estimatedCount, source: "all" };
};

module.exports = {
  createNotification,
  getWebsiteNotifications,
  getNotificationById,
  sendNotification,
  scheduleNotification,
  cancelScheduledNotification,
  previewAudience,
  saveAsTemplate,
  updateTemplate,
  createFromTemplate,
  getTemplates,
  deleteNotification
};
