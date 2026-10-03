const express = require("express");
const router = express.Router();
const affiliateController = require("../Controllers/affiliate.controller");
const authMiddleware = require("../Middlewares/auth.middleware");

// Protected User Endpoints
router.get("/me", authMiddleware, affiliateController.getUserAffiliateDetails);
router.put("/promo-code", authMiddleware, affiliateController.updateCustomPromoCode);

// Public Endpoints
router.get("/public/ref/:code", affiliateController.trackReferralClick);
router.post("/public/validate-promo", affiliateController.validatePromoCode);

module.exports = router;
