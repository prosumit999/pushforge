const express = require("express");
const router = express.Router();
const notificationController = require("../Controllers/notification.controller");
const authenticate = require("../Middlewares/auth.middleware");
const validate = require("../Middlewares/validate.middleware");
const {
  createNotificationSchema,
  scheduleNotificationSchema,
  audiencePreviewSchema,
  testSendSchema,
  updateTemplateSchema
} = require("../Validators/schemas");

router.use(authenticate);

router.post("/website/:websiteId", validate(createNotificationSchema), notificationController.createNotification);
router.post("/website/:websiteId/audience-preview", validate(audiencePreviewSchema), notificationController.previewAudience);
router.get("/website/:websiteId", notificationController.getNotifications);
router.get("/website/:websiteId/templates", notificationController.getTemplates);
router.get("/website/:websiteId/queue", notificationController.getQueueStatus);
// Declared before "/:id" so "queue" is never captured as a notification id.
router.get("/website/:websiteId/:id", notificationController.getNotification);
router.get("/website/:websiteId/:id/report", notificationController.getDeliveryReport);
router.post("/website/:websiteId/:id/send", notificationController.sendNotification);
router.post("/website/:websiteId/:id/retry-failed", notificationController.retryFailedDeliveries);
router.post("/website/:websiteId/:id/test", validate(testSendSchema), notificationController.sendTestNotification);
router.patch("/website/:websiteId/:id/schedule", validate(scheduleNotificationSchema), notificationController.scheduleNotification);
router.post("/website/:websiteId/:id/cancel", notificationController.cancelScheduledNotification);
router.post("/website/:websiteId/:id/template", notificationController.saveAsTemplate);
router.patch("/website/:websiteId/:id/template", validate(updateTemplateSchema), notificationController.updateTemplate);
router.post("/website/:websiteId/:id/from-template", notificationController.createFromTemplate);
router.delete("/website/:websiteId/:id", notificationController.deleteNotification);

module.exports = router;
