const Blog = require("../Models/Blog");

const INITIAL_SEED_BLOGS = [
  {
    id: "grow-and-maintain-website-with-push",
    title: "How WebPush Notifications Help Grow and Retain Website Traffic",
    slug: "grow-and-maintain-website-with-push",
    category: "Growth & Retention",
    readTime: "5 min read",
    date: "Oct 02, 2026",
    author: "Sumit",
    authorRole: "Founder & Core Architect",
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
    gradient: "from-purple-600 to-indigo-600",
    featured: true,
    published: true,
    views: 142,
    excerpt: "Discover how automated web push notifications bypass noisy social algorithms, boost repeat visitor traffic by 40%, and lower customer churn without paid ad spend.",
    content: `### Why Web Push is the #1 Retention Channel for Modern Websites
Acquiring new visitors through SEO and paid ads is expensive. However, keeping those visitors coming back to your site is where sustainable growth happens. Web push notifications deliver instant, direct-to-screen alerts on desktop and mobile browsers without requiring an app download or email signup.

### 1. Instant Direct-to-Screen Delivery (80%+ Delivery Rates)
Unlike email newsletters that land in Spam or Promo tabs, web push notifications pop up directly on the user's desktop or mobile device. Average click-through rates (CTR) for push notifications range between 8% to 15%—over 4x higher than standard email marketing.

### 2. Automated Traffic Re-Engagement
With automated campaign triggers, you can instantly notify subscribers when:
- A new blog post or news article is published.
- A flash sale or product drop goes live.
- An abandoned cart item drops in price.

### 3. Lower Churn & Higher Lifetime Value (LTV)
By establishing a direct communication link with your audience, you build brand recall. Returning visitors spend 3x more time on site and convert at a significantly higher rate than first-time visitors.

### 4. Zero Ad Spend Needed
Once a user clicks 'Allow' on your website's push prompt, you can reach them indefinitely without paying per impression or per click on Google or Meta ads.`
  },
  {
    id: "purplepush-features-free-vs-pro",
    title: "PurplePush Features Guide: Free Starter Plan vs Pro & Self-Hosted",
    slug: "purplepush-features-free-vs-pro",
    category: "Platform Features",
    readTime: "6 min read",
    date: "Sep 30, 2026",
    author: "Sumit",
    authorRole: "Founder & Core Architect",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80",
    gradient: "from-indigo-600 to-blue-600",
    featured: false,
    published: true,
    views: 98,
    excerpt: "A complete breakdown of our Free Starter plan versus Pro and Self-Hosted instances—including Golang concurrency dispatch, VAPID key controls, and subscriber export options.",
    content: `### Building the Ultimate Notification Engine
PurplePush (PushForge) was built to give creators, developers, and enterprise platforms full control over their browser notifications. Here is a breakdown of what is included in our Free Starter plan vs Self-Hosted / Pro editions.

### Free Starter Plan Features
Every new admin account registered on PurplePush is automatically assigned to our **Starter (Free)** plan by default:
- **Instant Domain & Website Setup**: Connect your website in 1 click and download ready-to-use \`pushforge-sdk.js\` and \`pushforge-sw.js\`.
- **Subscriber Token Collection**: Collect Chrome, Firefox, Edge, Safari, and Opera WebPush tokens securely.
- **Custom Campaign Dispatcher**: Broadcast instant push campaigns with custom titles, messages, action links, and custom icons.
- **6-Digit Email OTP Security**: Built-in 2-Factor email verification and password recovery.

### Pro & Self-Hosted Edition Features
For scaling teams and privacy-focused businesses:
- **Unlimited Subscribers**: Store millions of subscribers without monthly per-subscriber SaaS tier taxes.
- **High-Speed Golang Worker Engine**: Dispatch up to 18,500 notifications per second using 500+ parallel Go routines.
- **CSV & JSON Database Backups**: Export local backups of your subscriber database for offline archival.
- **Custom VAPID Key Pair Generator**: Use your own custom VAPID public and private RSA keys.
- **Superadmin Security Audit Logs**: Complete security tracking for admin logins, credential changes, and system events.`
  },
  {
    id: "advantages-of-self-hosted-push",
    title: "The Advantages of Self-Hosted Push: Full Privacy & Zero Subscriber Caps",
    slug: "advantages-of-self-hosted-push",
    category: "Self-Hosting",
    readTime: "5 min read",
    date: "Sep 28, 2026",
    author: "Sumit",
    authorRole: "Founder & Core Architect",
    image: "https://images.unsplash.com/photo-1618401471353-b98aedd04e11?auto=format&fit=crop&w=800&q=80",
    gradient: "from-blue-600 to-cyan-600",
    featured: false,
    published: true,
    views: 76,
    excerpt: "Why privacy-conscious SaaS platforms and high-traffic publishers are switching to self-hosted push notifications to own their data and bypass SaaS subscriber tier taxes.",
    content: `### The Hidden Costs of Cloud Push SaaS
Most third-party push notification services lure developers with a small free tier, but penalize growth. As soon as your subscriber database grows past 50,000 tokens, monthly bills quickly escalate to hundreds of dollars per month.

### 1. 100% Data Ownership & Privacy
When using third-party SaaS push vendors, your users' WebPush subscription tokens, P256dh keys, and Auth keys are stored on external servers. With self-hosted PurplePush:
- All cryptographic keys remain strictly inside your private MongoDB instance.
- No third-party data tracking or cross-site user profiling occurs.

### 2. Eliminating Subscriber Tier Taxes
Why pay $300/month to store subscription strings? A self-hosted PurplePush instance running on a $10/month VPS can easily manage over 500,000 active subscribers with zero extra charges.`
  }
];

// Seed initial blogs if empty
const seedInitialBlogsIfEmpty = async () => {
  try {
    const count = await Blog.countDocuments();
    if (count === 0) {
      await Blog.insertMany(INITIAL_SEED_BLOGS);
      console.log("🌱 Successfully seeded default initial blog posts into MongoDB");
    }
  } catch (err) {
    console.error("Error seeding initial blogs:", err.message);
  }
};

// 1. Get All Public Published Blogs
exports.getAllBlogsPublic = async (req, res) => {
  try {
    await seedInitialBlogsIfEmpty();
    const { category } = req.query;
    const filter = { published: true };
    if (category && category !== "All") {
      filter.category = category;
    }
    const blogs = await Blog.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: blogs.length, blogs });
  } catch (err) {
    console.error("getAllBlogsPublic Error:", err);
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
};

// 2. Get Single Public Blog by Slug
exports.getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOneAndUpdate(
      { slug, published: true },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!blog) {
      return res.status(404).json({ error: "Blog post not found" });
    }
    res.status(200).json({ success: true, blog });
  } catch (err) {
    console.error("getBlogBySlug Error:", err);
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
};

// 3. Superadmin: Get All Blogs (including drafts)
exports.getAllBlogsSuperadmin = async (req, res) => {
  try {
    await seedInitialBlogsIfEmpty();
    const blogs = await Blog.find({}).sort({ createdAt: -1 });

    const totalCount = blogs.length;
    const publishedCount = blogs.filter((b) => b.published).length;
    const draftCount = blogs.filter((b) => !b.published).length;
    const totalViews = blogs.reduce((sum, b) => sum + (b.views || 0), 0);

    res.status(200).json({
      success: true,
      totals: {
        totalCount,
        publishedCount,
        draftCount,
        totalViews
      },
      blogs
    });
  } catch (err) {
    console.error("getAllBlogsSuperadmin Error:", err);
    res.status(500).json({ error: "Failed to fetch superadmin blogs" });
  }
};

// 4. Superadmin: Create Blog
exports.createBlog = async (req, res) => {
  try {
    const {
      title,
      slug,
      category,
      readTime,
      author,
      authorRole,
      image,
      gradient,
      excerpt,
      content,
      featured,
      published
    } = req.body;

    if (!title || !excerpt || !content) {
      return res.status(400).json({ error: "Title, excerpt, and content are required" });
    }

    const generatedSlug = (slug || title)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const existing = await Blog.findOne({ slug: generatedSlug });
    const finalSlug = existing ? `${generatedSlug}-${Date.now().toString().slice(-4)}` : generatedSlug;

    const blog = await Blog.create({
      title: title.trim(),
      slug: finalSlug,
      category: category || "Growth & Retention",
      readTime: readTime || "5 min read",
      author: author || "Sumit",
      authorRole: authorRole || "Founder & Core Architect",
      image: image || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
      gradient: gradient || "from-purple-600 to-indigo-600",
      excerpt: excerpt.trim(),
      content: content.trim(),
      featured: Boolean(featured),
      published: published !== undefined ? Boolean(published) : true
    });

    res.status(201).json({ success: true, message: "Blog post created successfully", blog });
  } catch (err) {
    console.error("createBlog Error:", err);
    res.status(500).json({ error: err.message || "Failed to create blog post" });
  }
};

// 5. Superadmin: Update Blog
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.title && !updateData.slug) {
      updateData.slug = updateData.title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-");
    }

    const blog = await Blog.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!blog) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    res.status(200).json({ success: true, message: "Blog post updated successfully", blog });
  } catch (err) {
    console.error("updateBlog Error:", err);
    res.status(500).json({ error: err.message || "Failed to update blog post" });
  }
};

// 6. Superadmin: Delete Blog
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) {
      return res.status(404).json({ error: "Blog post not found" });
    }
    res.status(200).json({ success: true, message: "Blog post deleted successfully" });
  } catch (err) {
    console.error("deleteBlog Error:", err);
    res.status(500).json({ error: "Failed to delete blog post" });
  }
};

// 7. Superadmin: Toggle Publish Status
exports.togglePublishBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
      return res.status(404).json({ error: "Blog post not found" });
    }
    blog.published = !blog.published;
    await blog.save();

    res.status(200).json({
      success: true,
      message: `Blog post ${blog.published ? "published" : "moved to draft"}`,
      published: blog.published,
      blog
    });
  } catch (err) {
    console.error("togglePublishBlog Error:", err);
    res.status(500).json({ error: "Failed to toggle blog publish status" });
  }
};
