const { User, PromoCode, PayoutRequest, AffiliateTransaction, Invoice } = require("../Models");
const { normalizePlanName } = require("../Utils/planUtils");

const generateRandom5Char = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const getUnique5CharAffiliateCode = async () => {
  let attempts = 0;
  while (attempts < 20) {
    const code = generateRandom5Char();
    const existingUser = await User.findOne({ affiliateCode: code });
    const existingPromo = await PromoCode.findOne({ code });
    if (!existingUser && !existingPromo) return code;
    attempts++;
  }
  return "PF" + Math.floor(10 + Math.random() * 90);
};

// Helper to mask email for privacy (e.g. s***@gmail.com)
const maskEmail = (email) => {
  if (!email || !email.includes("@")) return "u***@domain.com";
  const [name, domain] = email.split("@");
  return `${name[0]}***@${domain}`;
};

// 1. Get current user's affiliate details, transactions & payout requests
const getUserAffiliateDetails = async (req, res, next) => {
  try {
    let user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Auto-generate affiliateCode if not present
    if (!user.affiliateCode) {
      const code = await getUnique5CharAffiliateCode();
      user.affiliateCode = code;
      await user.save();

      // Ensure PromoCode entry exists
      try {
        await PromoCode.create({
          code,
          discountType: "percentage",
          discountValue: 10,
          ownerUser: user._id,
          createdByType: "user"
        });
      } catch (e) {
        // Ignore duplicate
      }
    }

    // Fetch transactions & payout requests
    const transactionsList = await AffiliateTransaction.find({ affiliateUser: user._id })
      .populate("referredUser", "email name")
      .sort({ createdAt: -1 })
      .limit(50);

    const formattedTransactions = transactionsList.map((tx) => ({
      _id: tx._id,
      date: tx.createdAt,
      customerEmailMask: maskEmail(tx.referredUser?.email),
      planId: tx.planId,
      planName: tx.planName,
      saleAmount: tx.saleAmount,
      discountAmount: tx.discountAmount,
      commissionAmount: tx.commissionAmount,
      status: tx.status
    }));

    const payoutRequests = await PayoutRequest.find({ user: user._id }).sort({ createdAt: -1 });

    res.status(200).json({
      affiliateCode: user.affiliateCode,
      referralLink: `${process.env.APP_URL || "https://purplepush.com"}?ref=${user.affiliateCode}`,
      affiliateClicks: user.affiliateClicks || 0,
      affiliateSignups: user.affiliateSignups || 0,
      affiliateSales: user.affiliateSales || 0,
      affiliateEarnings: user.affiliateEarnings || 0,
      commissionRate: "30%",
      payoutMethod: user.payoutMethod || "none",
      payoutDetails: user.payoutDetails || {},
      transactions: formattedTransactions,
      payoutRequests
    });
  } catch (error) {
    next(error);
  }
};

// 2. Update user's custom 5-character alphanumeric promo code
const updateCustomPromoCode = async (req, res, next) => {
  try {
    const { newCode } = req.body;

    if (!newCode || typeof newCode !== "string") {
      return res.status(400).json({ error: "Promo code is required" });
    }

    const formattedCode = newCode.trim().toUpperCase();

    // Enforce exact 5-character alphanumeric rule
    if (!/^[A-Z0-9]{5}$/.test(formattedCode)) {
      return res.status(400).json({
        error: "Promo code must be exactly 5 alphanumeric characters (A-Z, 0-9)"
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const oldCode = user.affiliateCode;

    // Check if newCode is already taken by another user or code
    const existingUser = await User.findOne({
      affiliateCode: formattedCode,
      _id: { $ne: user._id }
    });

    const existingPromo = await PromoCode.findOne({
      code: formattedCode,
      ownerUser: { $ne: user._id }
    });

    if (existingUser || existingPromo) {
      return res.status(400).json({
        error: `Promo code "${formattedCode}" is already taken. Please try another 5-character code.`
      });
    }

    // Update User
    user.affiliateCode = formattedCode;
    await user.save();

    // Update or create PromoCode record
    if (oldCode) {
      await PromoCode.deleteMany({ ownerUser: user._id });
    }

    await PromoCode.create({
      code: formattedCode,
      discountType: "percentage",
      discountValue: 10,
      ownerUser: user._id,
      createdByType: "user"
    });

    res.status(200).json({
      message: "Promo code updated successfully!",
      affiliateCode: formattedCode,
      referralLink: `${process.env.APP_URL || "https://purplepush.com"}?ref=${formattedCode}`
    });
  } catch (error) {
    next(error);
  }
};

// 3. Update Payout Method & Details
const updatePayoutMethod = async (req, res, next) => {
  try {
    const { payoutMethod, payoutDetails } = req.body;

    if (!payoutMethod || !["paypal", "stripe", "bank", "upi", "none"].includes(payoutMethod)) {
      return res.status(400).json({ error: "Invalid payout method selection" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.payoutMethod = payoutMethod;
    user.payoutDetails = payoutDetails || {};
    await user.save();

    res.status(200).json({
      message: "Payout method updated successfully!",
      payoutMethod: user.payoutMethod,
      payoutDetails: user.payoutDetails
    });
  } catch (error) {
    next(error);
  }
};

// 4. Request Affiliate Payout
const requestPayout = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const reqAmount = Number(amount);

    if (!reqAmount || reqAmount < 50) {
      return res.status(400).json({ error: "Minimum payout threshold is $50" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.payoutMethod === "none" || !user.payoutMethod) {
      return res.status(400).json({ error: "Please configure your payout method (PayPal, Bank, UPI, or Stripe) before requesting a payout." });
    }

    if (user.affiliateEarnings < reqAmount) {
      return res.status(400).json({
        error: `Insufficient balance. Available earnings: $${user.affiliateEarnings.toFixed(2)}, Requested: $${reqAmount.toFixed(2)}`
      });
    }

    // Check if there is already a pending payout request
    const pendingReq = await PayoutRequest.findOne({ user: user._id, status: "pending" });
    if (pendingReq) {
      return res.status(400).json({ error: "You already have a pending payout request under review by superadmin." });
    }

    const newRequest = await PayoutRequest.create({
      user: user._id,
      amount: reqAmount,
      payoutMethod: user.payoutMethod,
      payoutDetails: user.payoutDetails
    });

    res.status(201).json({
      message: `Payout request for $${reqAmount.toFixed(2)} submitted successfully!`,
      payoutRequest: newRequest
    });
  } catch (error) {
    next(error);
  }
};

// 5. Process Plan Checkout & Credit Affiliate
const processCheckout = async (req, res, next) => {
  try {
    const { planId, planName, price, promoCode, paymentId, invoiceId } = req.body;

    if (!paymentId && !invoiceId) {
      return res.status(400).json({ error: "Verified payment ID or invoice ID is required for checkout processing" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify payment invoice exists and belongs to this user
    let verifiedInvoice = null;
    if (invoiceId) {
      verifiedInvoice = await Invoice.findOne({ _id: invoiceId, user: user._id, status: "paid" });
    } else if (paymentId) {
      verifiedInvoice = await Invoice.findOne({ paymentId, user: user._id, status: "paid" });
    }

    if (!verifiedInvoice) {
      return res.status(400).json({ error: "No verified paid invoice found for the specified payment" });
    }

    // Deduplicate: check if affiliate commission was already recorded for this invoice/paymentId
    const existingTx = await AffiliateTransaction.findOne({ paymentId: verifiedInvoice.paymentId || String(verifiedInvoice._id) });
    if (existingTx) {
      return res.status(200).json({
        message: "Affiliate transaction already recorded for this payment",
        plan: user.plan
      });
    }

    const basePrice = verifiedInvoice.amount || Number(price) || 0;
    let discountAmount = 0;
    let promo = null;
    let affiliateUser = null;

    if (promoCode && typeof promoCode === "string") {
      const formatted = promoCode.trim().toUpperCase();
      promo = await PromoCode.findOne({ code: formatted, isActive: true });

      if (promo) {
        if (promo.discountType === "percentage") {
          discountAmount = (basePrice * (promo.discountValue / 100));
        } else {
          discountAmount = promo.discountValue;
        }

        if (promo.ownerUser) {
          affiliateUser = await User.findById(promo.ownerUser);
        }

        promo.usageCount = (promo.usageCount || 0) + 1;
        const finalPrice = Math.max(0, basePrice - discountAmount);
        promo.salesGenerated = (promo.salesGenerated || 0) + finalPrice;
        await promo.save();
      }
    }

    if (!affiliateUser && user.referredBy) {
      affiliateUser = await User.findById(user.referredBy);
    }

    const finalAmount = Math.max(0, basePrice - discountAmount);
    let commissionAmount = 0;

    // Prevent self-referral / self-commission fraud
    if (affiliateUser && String(affiliateUser._id) !== String(user._id)) {
      commissionAmount = Math.round((finalAmount * 0.3) * 100) / 100;

      await AffiliateTransaction.create({
        affiliateUser: affiliateUser._id,
        referredUser: user._id,
        promoCode: promo ? promo.code : "",
        planId: planId || "plan",
        planName: verifiedInvoice.planName || planName,
        saleAmount: finalAmount,
        discountAmount,
        commissionAmount,
        paymentId: verifiedInvoice.paymentId || String(verifiedInvoice._id),
        status: "settled"
      });

      affiliateUser.affiliateSales = (affiliateUser.affiliateSales || 0) + finalAmount;
      affiliateUser.affiliateEarnings = (affiliateUser.affiliateEarnings || 0) + commissionAmount;
      if (!user.referredBy) {
        user.referredBy = affiliateUser._id;
        affiliateUser.affiliateSignups = (affiliateUser.affiliateSignups || 0) + 1;
      }
      await affiliateUser.save();
    }

    res.status(200).json({
      message: `Successfully processed affiliate credit for ${verifiedInvoice.planName || planName}`,
      plan: user.plan,
      basePrice,
      discountAmount,
      finalAmount,
      commissionAmount
    });
  } catch (error) {
    next(error);
  }
};

// 6. Public Referral Click Tracker
const trackReferralClick = async (req, res, next) => {
  try {
    const { code } = req.params;
    if (code) {
      const formatted = code.trim().toUpperCase();
      const user = await User.findOne({ affiliateCode: formatted });
      if (user) {
        user.affiliateClicks = (user.affiliateClicks || 0) + 1;
        await user.save();
      }
    }
    res.status(200).json({ success: true, tracked: true });
  } catch (error) {
    next(error);
  }
};

// 7. Public Promo Code Validator
const validatePromoCode = async (req, res, next) => {
  try {
    const { promoCode } = req.body;
    if (!promoCode) {
      return res.status(400).json({ error: "Promo code is required" });
    }

    const formatted = promoCode.trim().toUpperCase();
    const promo = await PromoCode.findOne({ code: formatted });

    if (!promo || !promo.isActive) {
      return res.status(404).json({ error: "Invalid or expired promo code" });
    }

    if (promo.maxUsage && promo.usageCount >= promo.maxUsage) {
      return res.status(400).json({ error: "This promo code has reached its maximum usage limit" });
    }

    if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
      return res.status(400).json({ error: "This promo code has expired" });
    }

    res.status(200).json({
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserAffiliateDetails,
  updateCustomPromoCode,
  updatePayoutMethod,
  requestPayout,
  processCheckout,
  trackReferralClick,
  validatePromoCode
};
