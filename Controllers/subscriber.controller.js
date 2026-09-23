const subscriberService = require("../Services/subscriber.service");

const getSubscribers = async (req, res, next) => {
  try {
    const { websiteId } = req.params;
    const result = await subscriberService.getWebsiteSubscribers(req.user.id, websiteId, req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getSubscriber = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const subscriber = await subscriberService.getSubscriberById(req.user.id, websiteId, id);
    res.status(200).json(subscriber);
  } catch (error) {
    next(error);
  }
};

const updateTags = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const { tags } = req.body;
    const subscriber = await subscriberService.updateSubscriberTags(req.user.id, websiteId, id, tags);
    res.status(200).json(subscriber);
  } catch (error) {
    next(error);
  }
};

const deleteSubscriber = async (req, res, next) => {
  try {
    const { websiteId, id } = req.params;
    const result = await subscriberService.deleteSubscriber(req.user.id, websiteId, id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSubscribers,
  getSubscriber,
  updateTags,
  deleteSubscriber
};
