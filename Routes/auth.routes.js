const express = require("express");
const router = express.Router();
const authController = require("../Controllers/auth.controller");
const authenticate = require("../Middlewares/auth.middleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.getProfile);
router.post("/logout", authController.logout);

module.exports = router;
