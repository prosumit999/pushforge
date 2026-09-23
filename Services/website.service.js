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

const verifyWebsite = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }

  website.isVerified = true;
  website.status = "active";
  await website.save();

  return website;
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
