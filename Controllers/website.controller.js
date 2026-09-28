const websiteService = require("../Services/website.service");

const createWebsite = async (req, res, next) => {
  try {
    const { name, domain, timezone } = req.body;
    if (!name || !domain) {
      return res.status(400).json({ error: "Website name and domain are required" });
    }

    const website = await websiteService.createWebsite(req.user.id, { name, domain, timezone });
    res.status(201).json(website);
  } catch (error) {
    next(error);
  }
};

const getWebsites = async (req, res, next) => {
  try {
    const websites = await websiteService.getUserWebsites(req.user.id);
    res.status(200).json(websites);
  } catch (error) {
    next(error);
  }
};

const getWebsite = async (req, res, next) => {
  try {
    const website = await websiteService.getWebsiteById(req.user.id, req.params.id);
    res.status(200).json(website);
  } catch (error) {
    next(error);
  }
};

const verifyWebsite = async (req, res, next) => {
  try {
    const { method } = req.body || {};
    const website = await websiteService.verifyWebsite(req.user.id, req.params.id, method);
    res.status(200).json(website);
  } catch (error) {
    next(error);
  }
};

const updateWebsite = async (req, res, next) => {
  try {
    const website = await websiteService.updateWebsite(req.user.id, req.params.id, req.body);
    res.status(200).json(website);
  } catch (error) {
    next(error);
  }
};

const updatePromptConfig = async (req, res, next) => {
  try {
    const website = await websiteService.updatePromptConfig(req.user.id, req.params.id, req.body);
    res.status(200).json(website);
  } catch (error) {
    next(error);
  }
};

const deleteWebsite = async (req, res, next) => {
  try {
    const result = await websiteService.deleteWebsite(req.user.id, req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createWebsite,
  getWebsites,
  getWebsite,
  verifyWebsite,
  updateWebsite,
  updatePromptConfig,
  deleteWebsite
};
