const mongoose = require("mongoose");

const affiliateTransactionSchema = new mongoose.Schema(
  {
    affiliateUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    promoCode: {
      type: String,
      uppercase: true,
      default: ""
    },
    planId: {
      type: String,
      required: true
    },
    planName: {
      type: String,
      required: true
    },
    saleAmount: {
      type: Number,
      required: true
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    commissionAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "settled"],
      default: "settled"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("AffiliateTransaction", affiliateTransactionSchema);
