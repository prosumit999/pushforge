const express = require("express");
const router = express.Router();
const publicController = require("../Controllers/public.controller");
const validateSiteKey = require("../Middlewares/siteKey.middleware");
const validate = require("../Middlewares/validate.middleware");
const {
  publicSubscribeSchema,
  publicEventSchema,
  publicClickSchema,
  publicSubscriptionChangeSchema
} = require("../Validators/schemas");

const emailController = require("../Controllers/email.controller");

router.get("/vapid-key", publicController.getVapidKey);

router.use(validateSiteKey);

router.get("/config", publicController.getConfig);

router.post("/subscribe", validate(publicSubscribeSchema), publicController.subscribe);
router.post("/event", validate(publicEventSchema), publicController.logEvent);
router.post("/click", validate(publicClickSchema), publicController.trackClick);
router.post("/subscription-change", validate(publicSubscriptionChangeSchema), publicController.handleSubscriptionChange);
router.post("/email-collect", emailController.collectEmailPublic);

module.exports = router;

