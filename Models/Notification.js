const mongoose = require("mongoose");

const actionButtonSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    title: { type: String, required: true },
    icon: { type: String }
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    icon: String,
    badge: String,
    image: String,
    clickUrl: String,
    actionButtons: [actionButtonSchema],
    targetType: {
      type: String,
      enum: ["all", "segment", "filter"],
      default: "all"
    },
    segment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Segment"
    },
    scheduledAt: Date,
    status: {
      type: String,
      enum: ["draft", "scheduled", "sending", "sent", "failed"],
      default: "draft"
    },
    isTemplate: {
      type: Boolean,
      default: false
    },
    templateName: String,
    stats: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      failed: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
