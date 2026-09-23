const mongoose = require("mongoose");

const subscriberSchema = new mongoose.Schema(
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
    endpoint: {
      type: String,
      required: true
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    device: {
      browser: String,
      os: String,
      deviceType: String
    },
    location: {
      ip: String,
      country: String,
      city: String
    },
    referrer: String,
    firstSeenPage: String,
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

subscriberSchema.index({ website: 1, endpoint: 1 }, { unique: true });

module.exports = mongoose.model("Subscriber", subscriberSchema);
