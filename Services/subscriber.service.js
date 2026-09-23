const { Subscriber, Website } = require("../Models");

const verifyWebsiteOwnership = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found or unauthorized");
    error.statusCode = 404;
    throw error;
  }
  return website;
};

const getWebsiteSubscribers = async (userId, websiteId, queryParams) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = { website: websiteId };

  if (queryParams.browser) {
    filter["device.browser"] = new RegExp(queryParams.browser, "i");
  }
  if (queryParams.deviceType) {
    filter["device.deviceType"] = queryParams.deviceType;
  }
  if (queryParams.country) {
    filter["location.country"] = queryParams.country;
  }
  if (queryParams.tag) {
    filter.tags = queryParams.tag;
  }
  if (queryParams.search) {
    filter.$or = [
      { "location.ip": new RegExp(queryParams.search, "i") },
      { "location.city": new RegExp(queryParams.search, "i") },
      { referrer: new RegExp(queryParams.search, "i") }
    ];
  }

  const subscribers = await Subscriber.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Subscriber.countDocuments(filter);

  return {
    subscribers,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

const getSubscriberById = async (userId, websiteId, subscriberId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const subscriber = await Subscriber.findOne({ _id: subscriberId, website: websiteId });
  if (!subscriber) {
    const error = new Error("Subscriber not found");
    error.statusCode = 404;
    throw error;
  }
  return subscriber;
};

const updateSubscriberTags = async (userId, websiteId, subscriberId, tags) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const subscriber = await Subscriber.findOneAndUpdate(
    { _id: subscriberId, website: websiteId },
    { tags: Array.isArray(tags) ? tags : [] },
    { new: true }
  );

  if (!subscriber) {
    const error = new Error("Subscriber not found");
    error.statusCode = 404;
    throw error;
  }
  return subscriber;
};

const deleteSubscriber = async (userId, websiteId, subscriberId) => {
  await verifyWebsiteOwnership(userId, websiteId);
  const subscriber = await Subscriber.findOneAndDelete({ _id: subscriberId, website: websiteId });
  if (!subscriber) {
    const error = new Error("Subscriber not found");
    error.statusCode = 404;
    throw error;
  }
  return { message: "Subscriber removed successfully" };
};

module.exports = {
  getWebsiteSubscribers,
  getSubscriberById,
  updateSubscriberTags,
  deleteSubscriber
};
