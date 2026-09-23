const express = require("express");
const router = express.Router();
const segmentController = require("../Controllers/segment.controller");
const authenticate = require("../Middlewares/auth.middleware");
const validate = require("../Middlewares/validate.middleware");
const { createSegmentSchema } = require("../Validators/schemas");

router.use(authenticate);

router.post("/website/:websiteId", validate(createSegmentSchema), segmentController.createSegment);
router.get("/website/:websiteId", segmentController.getSegments);
router.get("/website/:websiteId/:id", segmentController.getSegment);
router.post("/website/:websiteId/estimate", segmentController.estimateAudience);
router.put("/website/:websiteId/:id", segmentController.updateSegment);
router.delete("/website/:websiteId/:id", segmentController.deleteSegment);

module.exports = router;
