const express = require("express");
const router = express.Router();
const notificationController = require("../Controllers/notification.controller");
const authenticate = require("../Middlewares/auth.middleware");
const validate = require("../Middlewares/validate.middleware");
const { createNotificationSchema } = require("../Validators/schemas");

router.use(authenticate);

router.post("/website/:websiteId", validate(createNotificationSchema), notificationController.createNotification);
router.get("/website/:websiteId", notificationController.getNotifications);
router.get("/website/:websiteId/templates", notificationController.getTemplates);
router.get("/website/:websiteId/:id", notificationController.getNotification);
router.post("/website/:websiteId/:id/send", notificationController.sendNotification);
router.post("/website/:websiteId/:id/template", notificationController.saveAsTemplate);
router.delete("/website/:websiteId/:id", notificationController.deleteNotification);

module.exports = router;
