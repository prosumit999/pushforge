const mongoose = require("mongoose");

const websiteSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    domain: {
      type: String,
      required: true,
      trim: true
    },
    siteKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    siteSecret: {
      type: String,
      required: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationMethod: {
      type: String,
      enum: ["meta_tag", "file_upload", "dns"],
      default: "meta_tag"
    },
    verificationToken: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["unverified", "active", "paused"],
      default: "unverified"
    },
    timezone: {
      type: String,
      default: "UTC"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Website", websiteSchema);
