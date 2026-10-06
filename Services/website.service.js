const crypto = require("crypto");
const { Website, Subscriber, Notification, AnalyticsEvent, DispatchJob, NotificationLog } = require("../Models");
const { logSecurityEvent } = require("./superadmin.service");

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

  logSecurityEvent({
    type: "WEBSITE_PROVISIONED",
    title: "New Website Domain Configured",
    detail: `Domain ${website.domain} (${website.name}) registered with VAPID keys`,
    severity: "info"
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
  // Queue jobs and per-send logs reference the deleted notifications, so they
  // must go too or they linger as orphans.
  await DispatchJob.deleteMany({ website: websiteId });
  await NotificationLog.deleteMany({ website: websiteId });

  return { message: "Website and associated data successfully deleted" };
};

const updatePromptConfig = async (userId, websiteId, promptConfig) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }

  website.promptConfig = {
    ...(website.promptConfig || {}),
    ...promptConfig
  };

  await website.save();
  return website;
};

const getSmtpConfig = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }
  return website.smtpConfig || {
    enabled: false,
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    fromName: "",
    fromEmail: ""
  };
};

const updateSmtpConfig = async (userId, websiteId, smtpConfig) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }

  website.smtpConfig = {
    ...(website.smtpConfig || {}),
    ...smtpConfig,
    port: Number(smtpConfig.port) || 587,
    enabled: Boolean(smtpConfig.enabled)
  };

  await website.save();
  return website.smtpConfig;
};

const testSmtpConnection = async (userId, websiteId, testConfig) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }

  const smtpConfig = testConfig && testConfig.host ? testConfig : (website.smtpConfig || {});
  if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
    const error = new Error("Please fill out SMTP Host, Username/Email, and App Password.");
    error.statusCode = 400;
    throw error;
  }

  const { verifySmtpConnection, sendEmail } = require("./email.service");
  const testRes = await verifySmtpConnection(smtpConfig);

  if (!testRes.success) {
    const error = new Error(testRes.error || "Failed to verify SMTP credentials");
    error.statusCode = 400;
    throw error;
  }

  const User = require("../Models/User");
  const userObj = await User.findById(userId);

  if (userObj && userObj.email) {
    await sendEmail({
      to: userObj.email,
      subject: `PushForge SMTP Test - Verified for ${website.name}`,
      text: `Congratulations! Your custom SMTP connection (${smtpConfig.host}) for ${website.name} is working properly.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: #fff; border-radius: 12px;">
          <h2 style="color: #10b981; margin: 0 0 10px 0;">✓ Custom SMTP Verified Successfully!</h2>
          <p style="color: #cbd5e1; font-size: 14px;">Your SMTP configuration for <strong>${website.name}</strong> (${website.domain}) is working.</p>
          <ul style="color: #94a3b8; font-size: 13px;">
            <li><strong>SMTP Server:</strong> ${smtpConfig.host}:${smtpConfig.port || 587}</li>
            <li><strong>Sender Email:</strong> ${smtpConfig.fromEmail || smtpConfig.user}</li>
            <li><strong>Sender Display Name:</strong> ${smtpConfig.fromName || website.name}</li>
          </ul>
        </div>
      `,
      customSmtp: smtpConfig,
      fromName: smtpConfig.fromName || website.name,
      fromEmail: smtpConfig.fromEmail || smtpConfig.user
    });
  }

  return { success: true, message: "SMTP credentials verified! Test message sent to your admin email." };
};

const sendEmailBroadcast = async (userId, websiteId, { subject, content, senderName, senderEmail }) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found");
    error.statusCode = 404;
    throw error;
  }

  const CollectedEmail = require("../Models/CollectedEmail");
  const subscribers = await CollectedEmail.find({
    $or: [{ website: website._id }, { siteKey: website.siteKey }, { siteKey: website.domain }],
    status: "active"
  });

  if (!subscribers || subscribers.length === 0) {
    const error = new Error("No active collected email subscribers found for this website.");
    error.statusCode = 400;
    throw error;
  }

  const { sendEmail } = require("./email.service");
  const smtpConfig = website.smtpConfig || {};

  let sentCount = 0;
  let failCount = 0;

  for (const sub of subscribers) {
    const res = await sendEmail({
      to: sub.email,
      subject: subject,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #0f172a; margin-top: 0;">${subject}</h2>
          <div style="font-size: 15px; color: #334155; line-height: 1.6; white-space: pre-wrap;">${content}</div>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e2e8f0;" />
          <p style="font-size: 12px; color: #94a3b8; margin: 0;">You received this email because you subscribed to updates on ${website.name} (${website.domain}).</p>
        </div>
      `,
      text: content,
      customSmtp: smtpConfig,
      fromName: senderName || smtpConfig.fromName || website.name,
      fromEmail: senderEmail || smtpConfig.fromEmail || smtpConfig.user
    });

    if (res.success) {
      sentCount++;
    } else {
      failCount++;
    }
  }

  return {
    success: true,
    message: `Broadcast completed. ${sentCount} email(s) sent successfully.${failCount > 0 ? ` (${failCount} failed)` : ""}`,
    sentCount,
    failCount,
    totalCount: subscribers.length
  };
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
  updatePromptConfig,
  deleteWebsite,
  getSmtpConfig,
  updateSmtpConfig,
  testSmtpConnection,
  sendEmailBroadcast
};
