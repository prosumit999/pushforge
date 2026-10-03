const authService = require("../Services/auth.service");

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const result = await authService.registerUser({ name, email, password });

    if (result.token) {
      res.cookie("token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { email, otpCode } = req.body;
    if (!email || !otpCode) {
      return res.status(400).json({ error: "Email and 6-digit verification code are required" });
    }

    const result = await authService.verifyEmailOtp({ email, otpCode });

    if (result.token) {
      res.cookie("token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const result = await authService.resendVerificationOtp(email);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await authService.loginUser({ email, password });

    if (result.token) {
      res.cookie("token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getUserProfile(req.user.id);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changeUserPassword(req.user.id, { currentPassword, newPassword });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.requestForgotPassword(email);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    const result = await authService.resetPasswordWithToken({ email, token, newPassword });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
};

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  login,
  getProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  logout
};
