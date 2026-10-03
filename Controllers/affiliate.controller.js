const { User, PromoCode } = require("../Models");

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

// 1. Get current user's affiliate details
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

    res.status(200).json({
      affiliateCode: user.affiliateCode,
      referralLink: `${process.env.APP_URL || "https://purplepush.com"}?ref=${user.affiliateCode}`,
      affiliateClicks: user.affiliateClicks || 0,
      affiliateSignups: user.affiliateSignups || 0,
      affiliateSales: user.affiliateSales || 0,
      affiliateEarnings: user.affiliateEarnings || 0,
      commissionRate: "30%"
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

// 3. Public Referral Click Tracker
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

// 4. Public Promo Code Validator
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
  trackReferralClick,
  validatePromoCode
};
