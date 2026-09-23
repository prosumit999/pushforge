const express = require("express");
const router = express.Router();
const analyticsController = require("../Controllers/analytics.controller");
const authenticate = require("../Middlewares/auth.middleware");

router.use(authenticate);

router.get("/website/:websiteId/overview", analyticsController.getOverview);
router.get("/website/:websiteId/growth", analyticsController.getSubscriberGrowth);
router.get("/website/:websiteId/visitors", analyticsController.getVisitorAnalytics);

module.exports = router;
