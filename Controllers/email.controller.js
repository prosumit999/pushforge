const mongoose = require("mongoose");
const CollectedEmail = require("../Models/CollectedEmail");
const Website = require("../Models/Website");

const findWebsiteAccess = async (websiteId, userId, userRole) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(websiteId);
  let website = null;

  if (isObjectId) {
    website = await Website.findById(websiteId);
  }

  if (!website) {
    website = await Website.findOne({
      $or: [{ siteKey: websiteId }, { domain: String(websiteId).toLowerCase() }]
    });
  }

  if (website && userRole !== "superadmin" && userRole !== "admin") {
    if (website.user && website.user.toString() !== String(userId)) {
      return null;
    }
  }

  return website;
};

// ── Public Email Collection Handler (from SDK / Web Opt-in Prompt) ──
exports.collectEmailPublic = async (req, res) => {
  try {
    let website = req.website;
    const siteKeyHeader = req.headers["x-site-key"] || req.body?.siteKey;

    let realWebsite = null;
    if (website && website._id && website._id.toString() !== "000000000000000000000000") {
      realWebsite = await Website.findById(website._id);
    }

    if (!realWebsite && siteKeyHeader) {
      const cleanKey = String(siteKeyHeader).trim();
      realWebsite = await Website.findOne({
        $or: [
          { siteKey: cleanKey },
          { domain: cleanKey.toLowerCase() },
          ...(mongoose.Types.ObjectId.isValid(cleanKey) ? [{ _id: cleanKey }] : [])
        ]
      });
    }

    if (!realWebsite && website && website.domain) {
      realWebsite = await Website.findOne({ domain: website.domain.toLowerCase() });
    }

    const targetWebsite = realWebsite || website;

    if (!targetWebsite) {
      return res.status(404).json({ error: "Website not found or invalid site key" });
    }

    const { email, name, source, device, location } = req.body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid email address" });
    }

    const cleanEmail = email.trim().toLowerCase();

    const searchConditions = [];
    if (targetWebsite._id && targetWebsite._id.toString() !== "000000000000000000000000") {
      searchConditions.push({ website: targetWebsite._id });
    }
    if (targetWebsite.siteKey) searchConditions.push({ siteKey: targetWebsite.siteKey });
    if (targetWebsite.domain) searchConditions.push({ siteKey: targetWebsite.domain });

    const existing = await CollectedEmail.findOne({
      $or: searchConditions.length > 0 ? searchConditions : [{ siteKey: "default_site_key" }],
      email: cleanEmail
    });

    if (existing) {
      existing.name = name || existing.name;
      existing.source = source || existing.source;
      existing.device = device || existing.device;
      existing.location = location || existing.location;
      if (targetWebsite._id && targetWebsite._id.toString() !== "000000000000000000000000") {
        existing.website = targetWebsite._id;
      }
      existing.status = "active";
      await existing.save();

      return res.status(200).json({
        success: true,
        message: "Email updated successfully",
        id: existing._id
      });
    }

    const newCollected = await CollectedEmail.create({
      website: targetWebsite._id,
      siteKey: targetWebsite.siteKey || targetWebsite.domain || "default_site_key",
      email: cleanEmail,
      name: name || "",
      source: source || "Opt-in Prompt",
      device: device || {},
      location: location || {},
      status: "active"
    });

    return res.status(201).json({
      success: true,
      message: "Email collected successfully",
      id: newCollected._id
    });
  } catch (err) {
    console.error("Public Email Collection Error:", err.message);
    return res.status(500).json({ error: "Failed to collect email" });
  }
};

// ── Admin: Get all collected emails for a website ──
exports.getCollectedEmails = async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { search, status } = req.query;

    const website = await findWebsiteAccess(websiteId, req.user._id, req.user.role);
    if (!website) {
      return res.status(404).json({ error: "Website not found or unauthorized access" });
    }

    const filter = {
      $or: [
        { website: website._id },
        { siteKey: website.siteKey },
        { siteKey: website.domain }
      ]
    };

    if (status) {
      filter.status = status;
    }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$and = [
        {
          $or: [
            { email: searchRegex },
            { name: searchRegex },
            { source: searchRegex }
          ]
        }
      ];
    }

    const emails = await CollectedEmail.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: emails.length,
      emails
    });
  } catch (err) {
    console.error("Get Collected Emails Error:", err.message);
    return res.status(500).json({ error: "Failed to fetch collected emails" });
  }
};

// ── Admin: Manually add an email ──
exports.addCollectedEmail = async (req, res) => {
  try {
    const { websiteId } = req.params;
    const { email, name, source } = req.body;

    const website = await findWebsiteAccess(websiteId, req.user._id, req.user.role);
    if (!website) {
      return res.status(404).json({ error: "Website not found or unauthorized access" });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existing = await CollectedEmail.findOne({
      $or: [{ website: website._id }, { siteKey: website.siteKey }, { siteKey: website.domain }],
      email: cleanEmail
    });

    if (existing) {
      return res.status(400).json({ error: "This email address is already collected for this site." });
    }

    const newEmail = await CollectedEmail.create({
      website: website._id,
      siteKey: website.siteKey,
      email: cleanEmail,
      name: name || "",
      source: source || "Manual Admin Entry",
      status: "active"
    });

    return res.status(201).json({
      success: true,
      message: "Email added successfully",
      email: newEmail
    });
  } catch (err) {
    console.error("Add Collected Email Error:", err.message);
    return res.status(500).json({ error: "Failed to add email" });
  }
};

// ── Admin: Delete a collected email ──
exports.deleteCollectedEmail = async (req, res) => {
  try {
    const { websiteId, id } = req.params;

    const website = await findWebsiteAccess(websiteId, req.user._id, req.user.role);
    if (!website) {
      return res.status(404).json({ error: "Website not found or unauthorized access" });
    }

    const deleted = await CollectedEmail.findOneAndDelete({
      _id: id,
      $or: [{ website: website._id }, { siteKey: website.siteKey }, { siteKey: website.domain }]
    });

    if (!deleted) {
      return res.status(404).json({ error: "Collected email record not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Collected email deleted successfully"
    });
  } catch (err) {
    console.error("Delete Collected Email Error:", err.message);
    return res.status(500).json({ error: "Failed to delete collected email" });
  }
};
