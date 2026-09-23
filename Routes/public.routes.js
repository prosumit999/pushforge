const express = require("express");
const router = express.Router();
const publicController = require("../Controllers/public.controller");
const validateSiteKey = require("../Middlewares/siteKey.middleware");

router.use(validateSiteKey);

router.post("/subscribe", publicController.subscribe);
router.post("/event", publicController.logEvent);

module.exports = router;
