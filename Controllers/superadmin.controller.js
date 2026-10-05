const superadminService = require("../Services/superadmin.service");

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const result = await superadminService.loginSuperadmin({ email, password, ip });

    if (result.token) {
      res.cookie("superadminToken", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 12 * 60 * 60 * 1000
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { email, otpCode } = req.body;
    if (!email || !otpCode) {
      return res.status(400).json({ error: "Email and 6-digit OTP code are required" });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    const result = await superadminService.verifySuperadminOtp({ email, otpCode, ip });

    res.cookie("superadminToken", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 12 * 60 * 60 * 1000
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res) => {
  res.status(200).json({
    user: req.superadmin
  });
};

const getOverview = async (req, res, next) => {
  try {
    const data = await superadminService.getOverviewStats();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const data = await superadminService.getUsersList();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const updateUserPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan, status } = req.body;
    const result = await superadminService.updateUserPlan(id, { plan, status });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getSubscribers = async (req, res, next) => {
  try {
    const { page, limit, search } = req.query;
    const data = await superadminService.getAllSubscribers({ page, limit, search });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const exportSubscribers = async (req, res, next) => {
  try {
    const data = await superadminService.exportSubscribers();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const importSubscribers = async (req, res, next) => {
  try {
    const { subscribers, websiteId } = req.body;
    const result = await superadminService.importSubscribers(subscribers, websiteId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getNotifications = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const data = await superadminService.getAllNotifications({ page, limit });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const getPayments = async (req, res, next) => {
  try {
    const data = await superadminService.getPaymentStats();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const getSecurity = async (req, res, next) => {
  try {
    const data = await superadminService.getSecurityLogs();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const getAffiliateMetrics = async (req, res, next) => {
  try {
    const data = await superadminService.getAffiliatesAndPromoMetrics();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const createPromoCode = async (req, res, next) => {
  try {
    const { code, discountType, discountValue, maxUsage, expiresAt } = req.body;
    const promo = await superadminService.createSuperadminPromoCode({
      code,
      discountType,
      discountValue,
      maxUsage,
      expiresAt
    });
    res.status(201).json({ message: "Promo code created successfully", promo });
  } catch (error) {
    next(error);
  }
};

const togglePromoCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const promo = await superadminService.togglePromoCodeStatus(id);
    res.status(200).json({ message: "Promo code status updated", promo });
  } catch (error) {
    next(error);
  }
};

const deletePromoCode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await superadminService.deletePromoCode(id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getPayoutRequests = async (req, res, next) => {
  try {
    const requests = await superadminService.getPayoutRequests();
    res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
};

const updatePayoutStatus = async (id, req, res, next) => {
  try {
    const { status, transactionId, rejectionReason } = req.body;
    const reqItem = await superadminService.updatePayoutStatus(req.params.id, {
      status,
      transactionId,
      rejectionReason
    });
    res.status(200).json({ message: "Payout status updated successfully", reqItem });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) => {
  res.clearCookie("superadminToken");
  res.status(200).json({ message: "Superadmin logged out successfully" });
};

module.exports = {
  login,
  verifyOtp,
  getProfile,
  getOverview,
  getUsers,
  updateUserPlan,
  getSubscribers,
  exportSubscribers,
  importSubscribers,
  getNotifications,
  getPayments,
  getSecurity,
  getAffiliateMetrics,
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
  getPayoutRequests,
  updatePayoutStatus,
  logout
};
