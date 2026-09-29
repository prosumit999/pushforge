const mongoose = require("mongoose");

const actionButtonSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    title: { type: String, required: true },
    icon: { type: String },
    // Target the button opens. The service worker reads this to decide the
    // click destination, so dropping it makes the button open the main URL.
    url: { type: String }
  },
  { _id: false }
);

// Mirrors Segment.rules so an ad-hoc filter can be stored inline on a
// notification. Field and operator validity is enforced by the audience
// allowlist at write and dispatch time.
const segmentRuleSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "contains", "greater_than", "less_than", "in"],
      required: true
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true }
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
    // Ad-hoc rules used when targetType is "filter". Shape matches Segment.rules
    // and is validated against the audience allowlist at dispatch time.
    filterRules: [segmentRuleSchema],
    scheduledAt: Date,
    sentAt: Date,
    cancelledAt: Date,
    // Which engine actually delivered the last send, so the report can explain
    // why per-subscriber rows may be absent for Go-dispatched broadcasts.
    handledBy: {
      type: String,
      enum: ["go", "node", null],
      default: null
    },
    dispatchAttempts: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "queued", "sending", "sent", "failed", "cancelled"],
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

notificationSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
