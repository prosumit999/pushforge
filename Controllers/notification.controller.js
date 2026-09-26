const notificationService = require("../Services/notification.service");

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

const deleteNotification = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const result = await notificationService.deleteNotification(req.user.id, websiteId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNotification,
  getNotifications,
  getNotification,
  sendNotification,
  saveAsTemplate,
  getTemplates,
  deleteNotification
};
