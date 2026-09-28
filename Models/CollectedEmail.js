const mongoose = require("mongoose");

const collectedEmailSchema = new mongoose.Schema(
  {
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true
    },
    siteKey: {
      type: String,
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      trim: true,
      default: ""
    },
    source: {
      type: String,
      trim: true,
      default: "Opt-in Prompt"
    },
    device: {
      browser: { type: String, default: "Unknown" },
      os: { type: String, default: "Unknown" },
      deviceType: { type: String, default: "desktop" }
    },
    location: {
      ip: { type: String, default: "N/A" },
      country: { type: String, default: "Global" },
      city: { type: String, default: "Unknown" }
    },
    status: {
      type: String,
      enum: ["active", "unsubscribed"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

collectedEmailSchema.index({ website: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("CollectedEmail", collectedEmailSchema);
