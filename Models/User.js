const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "admin"
    },
    plan: {
      type: String,
      default: "Starter"
    },
    status: {
      type: String,
      enum: ["active", "suspended", "pending_verification"],
      default: "pending_verification"
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: {
      type: String,
      default: null
    },
    verificationExpires: {
      type: Date,
      default: null
    },
    resetPasswordToken: {
      type: String,
      default: null
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    },

    // ── Affiliate & Referral Program Fields ──
    affiliateCode: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 5,
      minlength: 5,
      default: null
    },
    affiliateClicks: {
      type: Number,
      default: 0
    },
    affiliateSignups: {
      type: Number,
      default: 0
    },
    affiliateSales: {
      type: Number,
      default: 0
    },
    affiliateEarnings: {
      type: Number,
      default: 0
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    payoutMethod: {
      type: String,
      enum: ["paypal", "stripe", "bank", "upi", "none"],
      default: "none"
    },
    payoutDetails: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
