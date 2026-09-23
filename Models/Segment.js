const mongoose = require("mongoose");

const segmentRuleSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: true
    },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "contains", "greater_than", "less_than", "in"],
      required: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  { _id: false }
);

const segmentSchema = new mongoose.Schema(
  {
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Website",
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    rules: [segmentRuleSchema],
    estimatedCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Segment", segmentSchema);
