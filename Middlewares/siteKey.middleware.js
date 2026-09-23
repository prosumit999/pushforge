const { Website } = require("../Models");

const validateSiteKey = async (req, res, next) => {
  try {
    const siteKey = req.headers["x-site-key"] || req.query.siteKey || req.body.siteKey;

    if (!siteKey) {
      return res.status(400).json({ error: "Missing x-site-key parameter" });
    }

    const website = await Website.findOne({ siteKey });

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
