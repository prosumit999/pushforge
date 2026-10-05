const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true
    },
    planName: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: "USD"
    },
    paymentMethod: {
      type: String,
      enum: ["stripe", "razorpay", "paypal", "instant", "simulated"],
      default: "stripe"
    },
    paymentId: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: ["paid", "pending", "failed"],
      default: "paid"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Invoice", invoiceSchema);
