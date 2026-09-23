const express = require("express");
const router = express.Router();
const notificationController = require("../Controllers/notification.controller");
const authenticate = require("../Middlewares/auth.middleware");

router.use(authenticate);

router.post("/website/:websiteId", notificationController.createNotification);
router.get("/website/:websiteId", notificationController.getNotifications);
router.get("/website/:websiteId/templates", notificationController.getTemplates);
router.get("/website/:websiteId/:id", notificationController.getNotification);
router.post("/website/:websiteId/:id/send", notificationController.sendNotification);
router.post("/website/:websiteId/:id/template", notificationController.saveAsTemplate);

module.exports = router;
