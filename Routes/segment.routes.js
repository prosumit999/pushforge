const express = require("express");
const router = express.Router();
const segmentController = require("../Controllers/segment.controller");
const authenticate = require("../Middlewares/auth.middleware");

router.use(authenticate);

router.post("/website/:websiteId", segmentController.createSegment);
router.get("/website/:websiteId", segmentController.getSegments);
router.get("/website/:websiteId/:id", segmentController.getSegment);
router.post("/website/:websiteId/estimate", segmentController.estimateAudience);
router.put("/website/:websiteId/:id", segmentController.updateSegment);
router.delete("/website/:websiteId/:id", segmentController.deleteSegment);

module.exports = router;
