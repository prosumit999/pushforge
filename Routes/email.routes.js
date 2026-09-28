const express = require("express");
const router = express.Router();
const emailController = require("../Controllers/email.controller");
const authMiddleware = require("../Middlewares/auth.middleware");

// Authenticated Admin Routes for Collected Emails
router.get("/website/:websiteId", authMiddleware, emailController.getCollectedEmails);
router.post("/website/:websiteId", authMiddleware, emailController.addCollectedEmail);
router.delete("/website/:websiteId/:id", authMiddleware, emailController.deleteCollectedEmail);

module.exports = router;
