const analyticsService = require("../Services/analytics.service");

const getOverview = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const overview = await analyticsService.getWebsiteOverview(req.user.id, websiteId);
    res.status(200).json(overview);
  } catch (error) {
    next(error);
  }
};

const getSubscriberGrowth = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const growth = await analyticsService.getSubscriberGrowth(req.user.id, websiteId);
    res.status(200).json(growth);
  } catch (error) {
    next(error);
  }
};

const getVisitorAnalytics = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const analytics = await analyticsService.getWebsiteVisitorAnalytics(req.user.id, websiteId);
    res.status(200).json(analytics);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getSubscriberGrowth,
  getVisitorAnalytics
};
