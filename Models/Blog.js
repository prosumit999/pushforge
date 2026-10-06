const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Blog title is required"],
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    category: {
      type: String,
      default: "Growth & Retention",
      trim: true
    },
    readTime: {
      type: String,
      default: "5 min read"
    },
    date: {
      type: String,
      default: () => new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })
    },
    author: {
      type: String,
      default: "Sumit"
    },
    authorRole: {
      type: String,
      default: "Founder & Core Architect"
    },
    image: {
      type: String,
      default: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
    },
    gradient: {
      type: String,
      default: "from-purple-600 to-indigo-600"
    },
    excerpt: {
      type: String,
      required: [true, "Blog excerpt is required"]
    },
    content: {
      type: String,
      required: [true, "Blog content is required"]
    },
    featured: {
      type: Boolean,
      default: false
    },
    published: {
      type: Boolean,
      default: true
    },
    views: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
