const express = require("express");
const router = express.Router();
const websiteController = require("../Controllers/website.controller");
const authenticate = require("../Middlewares/auth.middleware");

router.use(authenticate);

router.post("/", websiteController.createWebsite);
router.get("/", websiteController.getWebsites);
router.get("/:id", websiteController.getWebsite);
router.post("/:id/verify", websiteController.verifyWebsite);
router.put("/:id", websiteController.updateWebsite);
router.delete("/:id", websiteController.deleteWebsite);

module.exports = router;
