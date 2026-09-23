const express = require("express");
const router = express.Router();
const authController = require("../Controllers/auth.controller");
const authenticate = require("../Middlewares/auth.middleware");
const validate = require("../Middlewares/validate.middleware");
const { registerSchema, loginSchema } = require("../Validators/schemas");

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.get("/me", authenticate, authController.getProfile);
router.post("/logout", authController.logout);

module.exports = router;
