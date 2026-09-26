const express = require("express");
const router = express.Router();
const subscriberController = require("../Controllers/subscriber.controller");
const authenticate = require("../Middlewares/auth.middleware");

router.use(authenticate);

router.get("/website/:websiteId", subscriberController.getSubscribers);
router.post("/website/:websiteId/import", subscriberController.importSubscribers);
router.get("/website/:websiteId/:id", subscriberController.getSubscriber);
router.put("/website/:websiteId/:id/tags", subscriberController.updateTags);
router.delete("/website/:websiteId/:id", subscriberController.deleteSubscriber);

module.exports = router;
