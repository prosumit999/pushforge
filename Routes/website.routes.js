const express = require("express");
const router = express.Router();
const websiteController = require("../Controllers/website.controller");
const authenticate = require("../Middlewares/auth.middleware");
const validate = require("../Middlewares/validate.middleware");
const { createWebsiteSchema, updateWebsiteSchema } = require("../Validators/schemas");

router.use(authenticate);

router.post("/", validate(createWebsiteSchema), websiteController.createWebsite);
router.get("/", websiteController.getWebsites);
router.get("/:id", websiteController.getWebsite);
router.post("/:id/verify", websiteController.verifyWebsite);
router.put("/:id", validate(updateWebsiteSchema), websiteController.updateWebsite);
router.delete("/:id", websiteController.deleteWebsite);

module.exports = router;
