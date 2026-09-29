const mongoose = require("mongoose");

const notificationLogSchema = new mongoose.Schema(
  {
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
      index: true
    },
    subscriber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscriber",
      required: true,
      index: true
    },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "clicked", "failed"],
      required: true
    },
    errorMessage: String,
    // Set on the first click from this subscriber. Its presence is what makes
    // the unique-click count idempotent; later clicks only bump clickCount.
    clickedAt: {
      type: Date,
      default: null
    },
    clickCount: {
      type: Number,
      default: 0
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

notificationLogSchema.index({ notification: 1, subscriber: 1 });

module.exports = mongoose.model("NotificationLog", notificationLogSchema);
