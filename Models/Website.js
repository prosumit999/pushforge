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
    },
    promptConfig: {
      promptMode: {
        type: String,
        enum: ["push-only", "email-only", "combined-dual", "push-fallback-email"],
        default: "push-only"
      },
      promptStyle: {
        type: String,
        enum: ["glass-modal", "email-capture", "browser-native", "bell-widget"],
        default: "glass-modal"
      },
      cardPosition: {
        type: String,
        enum: ["top-center", "center", "bottom-center"],
        default: "bottom-center"
      },
      headline: {
        type: String,
        default: "Get Instant Updates & Flash Alerts"
      },
      description: {
        type: String,
        default: "Subscribe to get real-time price drop alerts, news, and exclusive offers directly in your browser."
      },
      allowText: {
        type: String,
        default: "Allow Notifications"
      },
      dismissText: {
        type: String,
        default: "Later"
      },
      autoPrompt: {
        type: Boolean,
        default: true
      },
      delaySeconds: {
        type: Number,
        default: 1
      }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Website", websiteSchema);
