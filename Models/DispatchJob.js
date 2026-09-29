const mongoose = require("mongoose");

const dispatchJobSchema = new mongoose.Schema(
  {
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true
    },
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["broadcast", "retry_failed", "test"],
      default: "broadcast"
    },
    status: {
      type: String,
      enum: ["queued", "active", "completed", "failed"],
      default: "queued",
      index: true
    },
    // Lower numbers are claimed first; runAt then orders within a priority.
    priority: {
      type: Number,
      default: 5
    },
    runAt: {
      type: Date,
      default: Date.now
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    lockedAt: Date,
    lockedBy: String,
    lastError: String,
    // Explicit subscriber list for retry/test jobs; empty means "resolve the
    // audience from the notification".
    subscriberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscriber"
      }
    ],
    result: {
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 }
    },
    completedAt: Date
  },
  {
    timestamps: true
  }
);

// Supports the claim query: status + runAt, ordered by priority then runAt.
dispatchJobSchema.index({ status: 1, runAt: 1, priority: 1 });
// Supports "is there still work for this notification" lookups.
dispatchJobSchema.index({ notification: 1, status: 1 });

module.exports = mongoose.model("DispatchJob", dispatchJobSchema);
