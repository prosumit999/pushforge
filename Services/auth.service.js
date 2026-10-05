const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../Models");
const { sendEmail, buildVerificationEmailHtml, buildPasswordResetEmailHtml } = require("./email.service");
const { logSecurityEvent } = require("./superadmin.service");

const getBrandName = () => process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";

const isVerificationRequired = () => {
  if (process.env.REQUIRE_EMAIL_VERIFICATION !== undefined) {
    return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
  }
  return process.env.NODE_ENV === "production";
};

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
        role: "admin",
        plan: "Self-Hosted",
        status: "active",
        isVerified: true
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
  const requiresVerification = isVerificationRequired();

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiration = new Date(Date.now() + 15 * 60 * 1000);

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    role: "admin",
    plan: "Starter",
    status: requiresVerification ? "pending_verification" : "active",
    isVerified: !requiresVerification,
    verificationToken: requiresVerification ? otpCode : null,
    verificationExpires: requiresVerification ? expiration : null
  });

  if (!requiresVerification) {
    logSecurityEvent({
      type: "USER_REGISTERED",
      title: "New Admin Account Created (Starter Plan)",
      detail: `Account ${user.email} created with default Starter (Free) plan. Email verification bypassed in development.`,
      severity: "info"
    });

    const token = generateToken(user);
    return {
      requireVerification: false,
      user: formatUserResponse(user),
      token,
      message: "Admin account registered and activated successfully!"
    };
  }

  const emailHtml = buildVerificationEmailHtml({
    name: user.name,
    otpCode,
    planName: "Starter (Free)"
  });

  const emailResult = await sendEmail({
    to: user.email,
    subject: `Verify Your ${getBrandName()} Admin Account`,
    html: emailHtml
  });

  logSecurityEvent({
    type: "USER_REGISTERED",
    title: "New Admin Account Created (Starter Plan)",
    detail: `Account ${user.email} created with default Starter (Free) plan. Verification email sent.`,
    severity: "info"
  });

  return {
    requireVerification: true,
    email: user.email,
    message: "Admin account registered! Please check your email for the 6-digit verification code.",
    emailSent: emailResult.success,
    otpCode: process.env.NODE_ENV === "development" ? otpCode : undefined
  };
};

const verifyEmailOtp = async ({ email, otpCode }) => {
  const targetEmail = (email || "").toLowerCase().trim();
  const user = await User.findOne({ email: targetEmail });

  if (!user) {
    const error = new Error("Account not found");
    error.statusCode = 404;
    throw error;
  }

  if (user.isVerified) {
    const token = generateToken(user);
    return {
      user: formatUserResponse(user),
      token,
      message: "Account is already verified!"
    };
  }

  if (user.verificationToken !== otpCode || !user.verificationExpires || user.verificationExpires < new Date()) {
    const error = new Error("Invalid or expired 6-digit verification code");
    error.statusCode = 400;
    throw error;
  }

  user.isVerified = true;
  user.status = "active";
  user.verificationToken = null;
  user.verificationExpires = null;
  await user.save();

  logSecurityEvent({
    type: "ADMIN_LOGIN",
    title: "Email Verification Successful",
    detail: `Admin user (${user.email}) verified email address and activated console access`,
    severity: "info"
  });

  const token = generateToken(user);
  return {
    user: formatUserResponse(user),
    token,
    message: `Email verified successfully! Welcome to ${getBrandName()}.`
  };
};

const resendVerificationOtp = async (emailInput) => {
  const targetEmail = (emailInput || "").toLowerCase().trim();
  const user = await User.findOne({ email: targetEmail });

  if (!user) {
    const error = new Error("No account found with this email address");
    error.statusCode = 404;
    throw error;
  }

  if (user.isVerified) {
    return { message: "Account is already verified." };
  }

  if (!isVerificationRequired()) {
    user.isVerified = true;
    user.status = "active";
    user.verificationToken = null;
    user.verificationExpires = null;
    await user.save();
    return { message: "Email verification is disabled in development. Account activated." };
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiration = new Date(Date.now() + 15 * 60 * 1000);

  user.verificationToken = otpCode;
  user.verificationExpires = expiration;
  await user.save();

  const emailHtml = buildVerificationEmailHtml({
    name: user.name,
    otpCode,
    planName: user.plan || "Starter (Free)"
  });

  const emailResult = await sendEmail({
    to: user.email,
    subject: `Resent: Verify Your ${getBrandName()} Admin Account`,
    html: emailHtml
  });

  return {
    message: "A new 6-digit verification code has been sent to your email",
    emailSent: emailResult.success,
    otpCode: process.env.NODE_ENV === "development" ? otpCode : undefined
  };
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

  const requiresVerification = isVerificationRequired();

  if (!user.isVerified && user.role !== "superadmin") {
    if (!requiresVerification) {
      user.isVerified = true;
      user.status = "active";
      await user.save();
    } else {
      // Generate fresh OTP code if verification pending
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiration = new Date(Date.now() + 15 * 60 * 1000);
      user.verificationToken = otpCode;
      user.verificationExpires = expiration;
      await user.save();

      const emailHtml = buildVerificationEmailHtml({
        name: user.name,
        otpCode,
        planName: user.plan || "Starter (Free)"
      });

      await sendEmail({
        to: user.email,
        subject: `Verify Your ${getBrandName()} Admin Account`,
        html: emailHtml
      });

      return {
        requireVerification: true,
        email: user.email,
        message: "Email verification required before accessing console. We sent a 6-digit verification code to your email.",
        otpCode: process.env.NODE_ENV === "development" ? otpCode : undefined
      };
    }
  }

  const token = generateToken(user);
  logSecurityEvent({
    type: "ADMIN_LOGIN",
    title: "Admin Account Authenticated",
    detail: `Admin user (${user.email}) logged into ${getBrandName()} Console`,
    severity: "info"
  });
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

  logSecurityEvent({
    type: "ADMIN_PASSWORD_CHANGE",
    title: "Admin Security Credentials Updated",
    detail: `Password updated for user (${user.email})`,
    severity: "warning"
  });

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

  const emailHtml = buildPasswordResetEmailHtml({
    name: user.name,
    otpCode
  });

  const emailResult = await sendEmail({
    to: user.email,
    subject: `${getBrandName()} Admin Password Reset Code`,
    html: emailHtml
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

  logSecurityEvent({
    type: "ADMIN_PASSWORD_CHANGE",
    title: "Admin Password Reset via OTP",
    detail: `Password reset successfully completed for (${user.email})`,
    severity: "warning"
  });

  return { message: "Admin password successfully reset. You can now log in." };
};

const generateToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET || (process.env.NODE_ENV !== "production" ? "supersecretkey_change_me_in_production" : null);
  if (!jwtSecret) {
    throw new Error("Server configuration error: JWT_SECRET environment variable missing in production");
  }
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
  verifyEmailOtp,
  resendVerificationOtp,
  loginUser,
  getUserProfile,
  changeUserPassword,
  requestForgotPassword,
  resetPasswordWithToken
};
