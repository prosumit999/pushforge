const mongoose = require("mongoose");

const payoutRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 50
    },
    payoutMethod: {
      type: String,
      required: true
    },
    payoutDetails: {
      type: Object,
      default: {}
    },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending"
    },
    transactionId: {
      type: String,
      default: ""
    },
    rejectionReason: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("PayoutRequest", payoutRequestSchema);
