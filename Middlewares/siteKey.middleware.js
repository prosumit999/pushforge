const { Website } = require("../Models");

const validateSiteKey = async (req, res, next) => {
  try {
    const siteKey = req.headers["x-site-key"] || req.query.siteKey || req.body.siteKey;

    if (!siteKey) {
      return res.status(400).json({ error: "Missing x-site-key parameter" });
    }

    let website = await Website.findOne({ siteKey });

    // Auto-create/fetch fallback website for default demo key pf_live_demo_key_123456789
    if (!website && (siteKey === "pf_live_demo_key_123456789" || siteKey.includes("demo"))) {
      website = await Website.findOne({ siteKey: "pf_live_demo_key_123456789" }) || await Website.findOne({ domain: "localhost:5000" });
      if (!website) {
        website = await Website.create({
          name: "PushForge Demo Store",
          domain: "localhost:5000",
          siteKey: "pf_live_demo_key_123456789",
          status: "active",
          isVerified: true,
          verificationMethod: "meta_tag"
        });
      }
    }

    if (!website) {
      return res.status(404).json({ error: "Invalid website site key" });
    }

    if (website.status === "paused") {
      return res.status(403).json({ error: "Website push collection is currently paused" });
    }

    req.website = website;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = validateSiteKey;
