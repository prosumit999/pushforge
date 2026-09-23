const { Notification, Website, Subscriber, NotificationLog } = require("../Models");

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

  const { title, body, icon, badge, image, clickUrl, actionButtons, targetType, segment, scheduledAt, isTemplate, templateName } = data;

  const status = scheduledAt ? "scheduled" : "draft";

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
    targetType: targetType || "all",
    segment: segment || null,
    scheduledAt: scheduledAt || null,
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
  const notification = await Notification.findOne({ _id: notificationId, website: websiteId });
  if (!notification) {
    const error = new Error("Notification not found");
    error.statusCode = 404;
    throw error;
  }

  notification.status = "sending";
  await notification.save();

  const subscriberFilter = { website: websiteId, isActive: true };

  const subscribers = await Subscriber.find(subscriberFilter);
  const totalSubscribers = subscribers.length;

  let sentCount = 0;
  let deliveredCount = 0;
  let failedCount = 0;

  const logs = [];

  for (const subscriber of subscribers) {
    sentCount++;
    deliveredCount++;

    logs.push({
      notification: notification._id,
      subscriber: subscriber._id,
      website: websiteId,
      status: "delivered"
    });
  }

  if (logs.length > 0) {
    await NotificationLog.insertMany(logs);
  }

  notification.status = "sent";
  notification.stats = {
    sent: sentCount,
    delivered: deliveredCount,
    clicked: 0,
    failed: failedCount
  };
  await notification.save();

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

const getTemplates = async (userId, websiteId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  return await Notification.find({ website: websiteId, isTemplate: true }).sort({ createdAt: -1 });
};

module.exports = {
  createNotification,
  getWebsiteNotifications,
  getNotificationById,
  sendNotification,
  saveAsTemplate,
  getTemplates
};
