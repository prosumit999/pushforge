const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema(
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
    visitorId: {
      type: String,
      index: true
    },
    subscriber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscriber"
    },
    eventType: {
      type: String,
      enum: ["pageview", "session_start", "session_end", "click"],
      required: true
    },
    path: String,
    duration: Number,
    referrer: String,
    location: {
      country: String,
      city: String
    },
    device: {
      browser: String,
      os: String,
      deviceType: String
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

analyticsEventSchema.index({ siteKey: 1, timestamp: -1 });

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);
