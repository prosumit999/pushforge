const express = require("express");
const router = express.Router();
const paymentController = require("../Controllers/payment.controller");
const authMiddleware = require("../Middlewares/auth.middleware");

// User Invoice Endpoints
router.get("/invoices", authMiddleware, paymentController.getInvoices);
router.get("/invoices/:id/download", authMiddleware, paymentController.downloadInvoice);

// Razorpay Payment Endpoints
router.post("/razorpay/create-order", authMiddleware, paymentController.createRazorpayOrder);
router.post("/razorpay/verify-payment", authMiddleware, paymentController.verifyRazorpayPayment);

// Stripe & Razorpay Webhooks (Public)
router.post("/webhook/stripe", paymentController.handleStripeWebhook);

module.exports = router;
