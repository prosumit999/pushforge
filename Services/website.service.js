const crypto = require("crypto");
const { Website, Subscriber, Notification, AnalyticsEvent } = require("../Models");

const createWebsite = async (userId, { name, domain, timezone }) => {
  const siteKey = `pf_live_${crypto.randomBytes(12).toString("hex")}`;
  const siteSecret = crypto.randomBytes(24).toString("hex");
  const verificationToken = `pf_verify_${crypto.randomBytes(16).toString("hex")}`;

  const website = await Website.create({
    user: userId,
    name,
    domain: cleanDomain(domain),
    siteKey,
    siteSecret,
    verificationToken,
    timezone: timezone || "UTC"
  });

  return website;
};

const getUserWebsites = async (userId) => {
  return await Website.find({ user: userId }).sort({ createdAt: -1 });
};

const getWebsiteById = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }
  return website;
};

const verifyWebsite = async (userId, websiteId, method) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }

  const verificationMethod = method || website.verificationMethod || "meta_tag";
  website.verificationMethod = verificationMethod;

  const targetDomain = website.domain;
  const token = website.verificationToken;
  const siteKey = website.siteKey;

  let isVerified = false;
  let failureReason = "";

  if (verificationMethod === "meta_tag" || verificationMethod === "script_tag") {
    const result = await checkMetaTag(targetDomain, token, siteKey);
    isVerified = result.success;
    failureReason = result.reason;
  } else if (verificationMethod === "file_upload") {
    const result = await checkFileUpload(targetDomain, token);
    isVerified = result.success;
    failureReason = result.reason;
  }

  if (!isVerified) {
    const error = new Error(failureReason || "Domain verification failed");
    error.statusCode = 400;
    throw error;
  }

  website.isVerified = true;
  website.status = "active";
  await website.save();

  return website;
};

const checkMetaTag = async (domain, token, siteKey) => {
  const isLocalDomain = domain.includes("localhost") || domain.includes("127.0.0.1") || domain.includes(".local");
  if (isLocalDomain) {
    return { success: true };
  }

  const paths = ["", "/demo-site.html", "/demo.html", "/index.html"];
  const protocols = ["https://", "http://"];
  const urls = [];

  for (const proto of protocols) {
    for (const path of paths) {
      urls.push(`${proto}${domain}${path}`);
    }
  }

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PushForge-DomainVerifier/1.0" },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const html = await response.text();
        const metaRegex = new RegExp(`<meta\\s+name=["']pushforge-verification["']\\s+content=["']${token}["']`, "i");
        const metaRegexAlt = new RegExp(`<meta\\s+content=["']${token}["']\\s+name=["']pushforge-verification["']`, "i");

        const hasMeta = metaRegex.test(html) || metaRegexAlt.test(html);
        const hasScriptKey = siteKey && (html.includes(siteKey) || html.includes(`data-site-key="${siteKey}"`) || html.includes(`data-site-key='${siteKey}'`));

        if (hasMeta || hasScriptKey) {
          return { success: true };
        }
      }
    } catch (e) {
      continue;
    }
  }

  return {
    success: false,
    reason: `Verification failed: Neither meta tag <meta name="pushforge-verification" content="${token}"> nor PushForge SDK script tag with siteKey found on ${domain}`
  };
};

const checkFileUpload = async (domain, token) => {
  const isLocalDomain = domain.includes("localhost") || domain.includes("127.0.0.1") || domain.includes(".local");
  if (isLocalDomain) {
    return { success: true };
  }

  const urls = [`https://${domain}/pushforge-verify.txt`, `http://${domain}/pushforge-verify.txt`];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PushForge-DomainVerifier/1.0" },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const text = await response.text();
        if (text.trim().includes(token)) {
          return { success: true };
        }
      }
    } catch (e) {
      continue;
    }
  }

  return {
    success: false,
    reason: `Verification failed: Verification file at https://${domain}/pushforge-verify.txt not reachable or token mismatched`
  };
};

const updateWebsite = async (userId, websiteId, { name, domain, timezone, status }) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }

  if (name) website.name = name;
  if (domain) website.domain = cleanDomain(domain);
  if (timezone) website.timezone = timezone;
  if (status && ["active", "paused", "unverified"].includes(status)) {
    website.status = status;
  }

  await website.save();
  return website;
};

const deleteWebsite = async (userId, websiteId) => {
  const website = await Website.findOneAndDelete({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }

  await Subscriber.deleteMany({ website: websiteId });
  await Notification.deleteMany({ website: websiteId });
  await AnalyticsEvent.deleteMany({ website: websiteId });

  return { message: "Website and associated data successfully deleted" };
};

const cleanDomain = (domain) => {
  return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
};

module.exports = {
  createWebsite,
  getUserWebsites,
  getWebsiteById,
  verifyWebsite,
  updateWebsite,
  deleteWebsite
};
