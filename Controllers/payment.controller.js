const crypto = require("crypto");
const Razorpay = require("razorpay");
const paymentService = require("../Services/payment.service");

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || "rzp_test_PushForge2026";
  const key_secret = process.env.RAZORPAY_KEY_SECRET || "PushForgeSecret2026Key";
  return new Razorpay({ key_id, key_secret });
};

const getInvoices = async (req, res, next) => {
  try {
    const invoices = await paymentService.getUserInvoices(req.user.id);
    res.status(200).json(invoices);
  } catch (error) {
    next(error);
  }
};

const downloadInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const html = await paymentService.getInvoiceReceiptHtml(id, req.user.id);

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${id}.html`);
    res.status(200).send(html);
  } catch (error) {
    next(error);
  }
};

// ── Razorpay Order Creation ──
const createRazorpayOrder = async (req, res, next) => {
  try {
    const { amount, currency = "INR", planName = "Business Pro", planId = "pro" } = req.body;
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_PushForge2026";

    // Amount in paise (1 INR = 100 paise) or cents (1 USD = 100 cents)
    const amountInSubunits = Math.round((amount || 100) * 100);

    try {
      const razorpay = getRazorpayInstance();
      const options = {
        amount: amountInSubunits,
        currency: currency.toUpperCase(),
        receipt: `receipt_${Date.now()}`,
        notes: {
          planName,
          planId,
          userId: req.user ? req.user.id : "guest"
        }
      };

      const order = await razorpay.orders.create(options);
      return res.status(200).json({
        success: true,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: keyId,
        planName
      });
    } catch (rzpErr) {
      console.warn("Razorpay API fallback order creation:", rzpErr.message);
      // Fallback for test mode without live API key
      const fallbackOrderId = `order_test_${Date.now()}`;
      return res.status(200).json({
        success: true,
        orderId: fallbackOrderId,
        amount: amountInSubunits,
        currency: currency.toUpperCase(),
        key: keyId,
        planName
      });
    }
  } catch (error) {
    next(error);
  }
};

// ── Razorpay Payment Verification & Invoice Generation ──
const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planName = "Business Pro Plan",
      amount = 100,
      currency = "INR"
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing mandatory Razorpay payment verification parameters (order_id, payment_id, signature)"
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && !secret) {
      return res.status(500).json({
        success: false,
        message: "Server configuration error: RAZORPAY_KEY_SECRET missing in production"
      });
    }

    const effectiveSecret = secret || "PushForgeSecret2026Key";

    // Strict HMAC SHA256 Signature Verification
    const bodyData = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", effectiveSecret)
      .update(bodyData.toString())
      .digest("hex");

    let isValidSignature = false;
    try {
      isValidSignature = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, "utf8"),
        Buffer.from(razorpay_signature, "utf8")
      );
    } catch (err) {
      isValidSignature = false;
    }

    // Allow test bypass only in non-production environments when orderId starts with order_test_
    if (!isValidSignature && !isProduction && razorpay_order_id.startsWith("order_test_")) {
      console.warn("⚠️ [DEV NOTICE] Allowing order_test_ fallback payment signature in non-production mode.");
      isValidSignature = true;
    }

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: "Razorpay payment signature verification failed. Invalid HMAC signature."
      });
    }

    const userId = req.user ? req.user.id : null;
    let invoice = null;

    if (userId) {
      // Check for duplicate invoice processing
      const existingInvoices = await paymentService.getUserInvoices(userId);
      const duplicate = existingInvoices.find((inv) => inv.paymentId === razorpay_payment_id);

      if (duplicate) {
        return res.status(200).json({
          success: true,
          message: "Razorpay payment already processed",
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          invoice: duplicate
        });
      }

      invoice = await paymentService.createInvoice({
        userId,
        planName,
        amount: Number(amount),
        paymentMethod: "razorpay",
        paymentId: razorpay_payment_id
      });
    }

    return res.status(200).json({
      success: true,
      message: "Razorpay payment verified successfully!",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      invoice
    });
  } catch (error) {
    next(error);
  }
};

const handleStripeWebhook = async (req, res, next) => {
  try {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event = req.body;

    if (webhookSecret) {
      if (!sig || !req.rawBody) {
        return res.status(400).json({ error: "Missing Stripe signature header or raw request body" });
      }
      try {
        const Stripe = require("stripe");
        const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
      } catch (err) {
        console.error("Stripe Webhook Signature Verification Failed:", err.message);
        return res.status(400).json({ error: `Webhook Signature Verification Failed: ${err.message}` });
      }
    } else if (process.env.NODE_ENV === "production") {
      return res.status(400).json({ error: "Stripe webhook signature verification requires STRIPE_WEBHOOK_SECRET in production" });
    }

    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.userId;
      const planName = session.metadata?.planName || "Business Pro";
      const amount = (session.amount_total || session.amount || 10000) / 100;
      const paymentId = session.id || session.payment_intent;

      if (userId && paymentId) {
        const userInvoices = await paymentService.getUserInvoices(userId);
        const duplicate = userInvoices.find((inv) => inv.paymentId === paymentId);
        if (!duplicate) {
          await paymentService.createInvoice({
            userId,
            planName,
            amount,
            paymentMethod: "stripe",
            paymentId
          });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error.message);
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getInvoices,
  downloadInvoice,
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleStripeWebhook
};
