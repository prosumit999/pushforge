const express = require("express");
const router = express.Router();
const authController = require("../Controllers/auth.controller");
const authenticate = require("../Middlewares/auth.middleware");
const validate = require("../Middlewares/validate.middleware");
const { registerSchema, loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } = require("../Validators/schemas");

router.post("/register", validate(registerSchema), authController.register);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);
router.post("/login", validate(loginSchema), authController.login);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);

router.get("/me", authenticate, authController.getProfile);
router.put("/change-password", authenticate, validate(changePasswordSchema), authController.changePassword);
router.post("/logout", authController.logout);

module.exports = router;
