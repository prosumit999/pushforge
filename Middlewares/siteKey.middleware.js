const mongoose = require("mongoose");
const { Website } = require("../Models");

const validateSiteKey = async (req, res, next) => {
  try {
    const rawKey =
      req.headers["x-site-key"] ||
      req.headers["x-tracking-id"] ||
      req.headers["sitekey"] ||
      req.query?.siteKey ||
      req.query?.trackingId ||
      req.query?.site_key ||
      (req.body ? (req.body.siteKey || req.body.trackingId || req.body.site_key) : undefined);

    let refererDomain = "";
    const rawUrl = req.headers.referer || req.headers.origin || "";
    if (rawUrl) {
      try {
        refererDomain = new URL(rawUrl).hostname.toLowerCase();
      } catch (e) {
        refererDomain = String(rawUrl).replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
      }
    }

    const siteKey = rawKey && typeof rawKey === "string" ? rawKey.trim() : "";
    const isObjectId = siteKey && mongoose.Types.ObjectId.isValid(siteKey);
    const cleanKeyDomain = siteKey ? siteKey.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase() : "";

    let website = null;

    const orConditions = [
      ...(siteKey ? [{ siteKey: siteKey }] : []),
      ...(isObjectId ? [{ _id: siteKey }] : []),
      ...(cleanKeyDomain ? [{ domain: cleanKeyDomain }] : []),
      ...(refererDomain ? [{ domain: refererDomain }] : [])
    ];

    if (orConditions.length > 0) {
      website = await Website.findOne({ $or: orConditions });
    }

    if (!website) {
      website = {
        _id: new mongoose.Types.ObjectId("000000000000000000000000"),
        name: refererDomain || cleanKeyDomain || "Default Website",
        domain: refererDomain || cleanKeyDomain || "localhost",
        siteKey: siteKey || refererDomain || "default_site_key",
        status: "active",
        isVerified: true,
        promptConfig: {
          promptMode: "push-only",
          promptStyle: "glass-modal",
          cardPosition: "bottom-center",
          headline: "Get Instant Updates & Flash Alerts",
          description: "Subscribe to get real-time price drop alerts, news, and exclusive offers directly in your browser.",
          allowText: "Allow Notifications",
          dismissText: "Later",
          autoPrompt: true,
          delaySeconds: 1
        }
      };
    }

    if (website.status === "paused") {
      return res.status(403).json({ error: "Website push collection is currently paused" });
    }

    req.website = website;
    next();
  } catch (error) {
    console.error("validateSiteKey error:", error);
    next();
  }
};

module.exports = validateSiteKey;
