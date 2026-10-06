const express = require("express");
const router = express.Router();
const superadminController = require("../Controllers/superadmin.controller");
const blogController = require("../Controllers/blog.controller");
const { requireSuperadmin } = require("../Middlewares/superadmin.middleware");

// Auth Endpoints (Public for Superadmin)
router.post("/login", superadminController.login);
router.post("/verify-otp", superadminController.verifyOtp);

// Protected Superadmin Endpoints
router.use(requireSuperadmin);

router.get("/me", superadminController.getProfile);
router.get("/overview", superadminController.getOverview);
router.get("/users", superadminController.getUsers);
router.put("/users/:id/plan", superadminController.updateUserPlan);
router.get("/subscribers", superadminController.getSubscribers);
router.get("/subscribers/export", superadminController.exportSubscribers);
router.post("/subscribers/import", superadminController.importSubscribers);
router.get("/notifications", superadminController.getNotifications);
router.get("/payments", superadminController.getPayments);
router.get("/security", superadminController.getSecurity);
router.get("/affiliates", superadminController.getAffiliateMetrics);
router.post("/promo-codes", superadminController.createPromoCode);
router.put("/promo-codes/:id/toggle", superadminController.togglePromoCode);
router.delete("/promo-codes/:id", superadminController.deletePromoCode);
router.get("/payouts", superadminController.getPayoutRequests);
router.put("/payouts/:id/status", (req, res, next) => superadminController.updatePayoutStatus(req.params.id, req, res, next));

// Blog Management Endpoints
router.get("/blogs", blogController.getAllBlogsSuperadmin);
router.post("/blogs", blogController.createBlog);
router.put("/blogs/:id", blogController.updateBlog);
router.delete("/blogs/:id", blogController.deleteBlog);
router.put("/blogs/:id/toggle-publish", blogController.togglePublishBlog);

router.post("/logout", superadminController.logout);

module.exports = router;
