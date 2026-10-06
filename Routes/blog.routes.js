const express = require("express");
const router = express.Router();
const blogController = require("../Controllers/blog.controller");

// Public Blog Routes
router.get("/", blogController.getAllBlogsPublic);
router.get("/:slug", blogController.getBlogBySlug);

module.exports = router;
