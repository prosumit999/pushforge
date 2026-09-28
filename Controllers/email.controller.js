const CollectedEmail = require("../Models/CollectedEmail");
const Website = require("../Models/Website");

// ── Public Email Collection Handler (from SDK / Web Opt-in Prompt) ──
exports.collectEmailPublic = async (req, res) => {
  try {
    const siteKey = req.headers["x-site-key"] || req.body.siteKey;
    if (!siteKey) {
      return res.status(400).json({ error: "Missing x-site-key header or siteKey parameter" });
    }

    const website = await Website.findOne({ siteKey });
    if (!website) {
      return res.status(404).json({ error: "Website not found or invalid site key" });
    }

    const { email, name, source, device, location } = req.body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Please provide a valid email address" });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existing = await CollectedEmail.findOne({ website: website._id, email: cleanEmail });

    if (existing) {
      existing.name = name || existing.name;
      existing.source = source || existing.source;
      existing.device = device || existing.device;
      existing.location = location || existing.location;
      existing.status = "active";
      await existing.save();

      return res.status(200).json({
        success: true,
        message: "Email updated successfully",
        id: existing._id
      });
    }

    const newCollected = await CollectedEmail.create({
      website: website._id,
      siteKey: website.siteKey,
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

    const website = await Website.findOne({ _id: websiteId, user: req.user._id });
    if (!website) {
      return res.status(404).json({ error: "Website not found or unauthorized access" });
    }

    const filter = { website: website._id };
    if (status) {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } },
        { source: { $regex: search, $options: "i" } }
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

    const website = await Website.findOne({ _id: websiteId, user: req.user._id });
    if (!website) {
      return res.status(404).json({ error: "Website not found or unauthorized access" });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Please enter a valid email address" });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existing = await CollectedEmail.findOne({ website: website._id, email: cleanEmail });
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

    const website = await Website.findOne({ _id: websiteId, user: req.user._id });
    if (!website) {
      return res.status(404).json({ error: "Website not found or unauthorized access" });
    }

    const deleted = await CollectedEmail.findOneAndDelete({ _id: id, website: website._id });
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
