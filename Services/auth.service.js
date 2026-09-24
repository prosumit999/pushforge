const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../Models");
const { sendEmail } = require("./email.service");

const seedDefaultAdmin = async () => {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || "admin@123";

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await User.create({
        name: "Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin"
      });
      console.log(`Default admin account initialized from env: ${adminEmail}`);
    }
  } catch (error) {
    console.error("Failed to seed default admin account:", error.message);
  }
};

const registerUser = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const error = new Error("User with this email already exists");
    error.statusCode = 400;
    throw error;
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword
  });

  const token = generateToken(user);
  return { user: formatUserResponse(user), token };
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error("Invalid email or password");
    error.statusCode = 401;
    throw error;
  }

  const token = generateToken(user);
  return { user: formatUserResponse(user), token };
};

const getUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }
  return formatUserResponse(user);
};

const changeUserPassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    const error = new Error("Current password is incorrect");
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  await user.save();

  return { message: "Password updated successfully" };
};

const requestForgotPassword = async (emailInput) => {
  const targetEmail = (emailInput || process.env.ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
  const user = await User.findOne({ email: targetEmail });

  if (!user) {
    const error = new Error("No account found with this email address");
    error.statusCode = 404;
    throw error;
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiration = new Date(Date.now() + 15 * 60 * 1000);

  user.resetPasswordToken = otpCode;
  user.resetPasswordExpires = expiration;
  await user.save();

  const emailResult = await sendEmail({
    to: user.email,
    subject: "PushForge Admin Password Reset Code",
    html: `
      <div style="font-family: sans-serif; padding: 20px; color: #0f172a;">
        <h2>PushForge Admin Password Reset</h2>
        <p>You requested a password reset for your self-hosted PushForge instance.</p>
        <p>Your 6-digit verification code is:</p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #2563eb; background: #f8fafc; padding: 12px 20px; border-radius: 8px; display: inline-block; margin: 10px 0;">
          ${otpCode}
        </div>
        <p style="color: #64748b; font-size: 14px;">This code will expire in 15 minutes.</p>
      </div>
    `
  });

  return {
    message: "Password reset code generated",
    emailSent: emailResult.success,
    otpCode: process.env.NODE_ENV === "development" ? otpCode : undefined
  };
};

const resetPasswordWithToken = async ({ email, token, newPassword }) => {
  const targetEmail = (email || process.env.ADMIN_EMAIL || "admin@gmail.com").toLowerCase();
  const user = await User.findOne({
    email: targetEmail,
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() }
  });

  if (!user) {
    const error = new Error("Invalid or expired password reset verification code");
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  user.password = hashedPassword;
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  await user.save();

  return { message: "Admin password successfully reset. You can now log in." };
};

const generateToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET || "supersecretkey_change_me_in_production";
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: "7d" }
  );
};

const formatUserResponse = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
};

module.exports = {
  seedDefaultAdmin,
  registerUser,
  loginUser,
  getUserProfile,
  changeUserPassword,
  requestForgotPassword,
  resetPasswordWithToken
};
