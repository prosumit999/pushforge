const notificationService = require("../Services/notification.service");
const reportService = require("../Services/report.service");
const queueService = require("../Services/queue.service");

const createNotification = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const { title, body } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Notification title and body are required" });
    }

    const notification = await notificationService.createNotification(req.user.id, websiteId, req.body);
    res.status(201).json(notification);
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const notifications = await notificationService.getWebsiteNotifications(req.user.id, websiteId);
    res.status(200).json(notifications);
  } catch (error) {
    next(error);
  }
};

const getNotification = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const notification = await notificationService.getNotificationById(req.user.id, websiteId, id);
    res.status(200).json(notification);
  } catch (error) {
    next(error);
  }
};

const sendNotification = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const result = await notificationService.sendNotification(req.user.id, websiteId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const scheduleNotification = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const { scheduledAt } = req.body;
    const notification = await notificationService.scheduleNotification(req.user.id, websiteId, id, scheduledAt);
    res.status(200).json({
      message: "Notification scheduled successfully",
      notification
    });
  } catch (error) {
    next(error);
  }
};

const cancelScheduledNotification = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const notification = await notificationService.cancelScheduledNotification(req.user.id, websiteId, id);
    res.status(200).json({
      message: "Scheduled notification cancelled",
      notification
    });
  } catch (error) {
    next(error);
  }
};

const saveAsTemplate = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const { templateName } = req.body;
    const template = await notificationService.saveAsTemplate(req.user.id, websiteId, id, templateName);
    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
};

const getTemplates = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const templates = await notificationService.getTemplates(req.user.id, websiteId);
    res.status(200).json(templates);
  } catch (error) {
    next(error);
  }
};

const updateTemplate = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const template = await notificationService.updateTemplate(req.user.id, websiteId, id, req.body);
    res.status(200).json(template);
  } catch (error) {
    next(error);
  }
};

const createFromTemplate = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const notification = await notificationService.createFromTemplate(req.user.id, websiteId, id, req.body);
    res.status(201).json(notification);
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const result = await notificationService.deleteNotification(req.user.id, websiteId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getDeliveryReport = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const report = await reportService.getDeliveryReport(req.user.id, websiteId, id, req.query);
    res.status(200).json(report);
  } catch (error) {
    next(error);
  }
};

const retryFailedDeliveries = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const result = await reportService.retryFailed(req.user.id, websiteId, id);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

const sendTestNotification = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const { subscriberId } = req.body;
    const result = await reportService.sendTestPush(req.user.id, websiteId, id, { subscriberId });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// Audience preview for the composer: works for saved segments and ad-hoc
// filter rules without persisting anything.
const previewAudience = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const preview = await notificationService.previewAudience(req.user.id, websiteId, req.body);
    res.status(200).json(preview);
  } catch (error) {
    next(error);
  }
};

const getQueueStatus = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    // Ownership check before exposing any queue counters for the website.
    await notificationService.getWebsiteNotifications(req.user.id, websiteId);
    const stats = await queueService.getQueueStats(websiteId);
    res.status(200).json({ queue: stats, workerId: queueService.WORKER_ID });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNotification,
  getNotifications,
  getNotification,
  sendNotification,
  scheduleNotification,
  cancelScheduledNotification,
  saveAsTemplate,
  updateTemplate,
  createFromTemplate,
  getTemplates,
  deleteNotification,
  getDeliveryReport,
  retryFailedDeliveries,
  sendTestNotification,
  previewAudience,
  getQueueStatus
};
