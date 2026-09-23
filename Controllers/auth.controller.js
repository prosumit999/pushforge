const authService = require("../Services/auth.service");

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const result = await authService.registerUser({ name, email, password });
    
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json(result);
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

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

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

const logout = async (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
};

module.exports = {
  register,
  login,
  getProfile,
  logout
};
