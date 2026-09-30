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
    { returnDocument: "after" }
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

const importSubscribers = async (userId, websiteId, subscribersList) => {
  const website = await verifyWebsiteOwnership(userId, websiteId);

  if (!Array.isArray(subscribersList) || subscribersList.length === 0) {
    const error = new Error("No subscriber data provided for import");
    error.statusCode = 400;
    throw error;
  }

  const operations = subscribersList.map((sub, idx) => {
    const endpoint = sub.endpoint || `https://push.imported.com/sub-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
    const p256dh = sub.keys?.p256dh || sub.p256dh || `imported_p256dh_${Math.random().toString(36).substring(2)}`;
    const auth = sub.keys?.auth || sub.auth || `imported_auth_${Math.random().toString(36).substring(2)}`;

    return {
      updateOne: {
        filter: { website: websiteId, endpoint },
        update: {
          $set: {
            website: websiteId,
            siteKey: website.siteKey,
            endpoint,
            keys: { p256dh, auth },
            device: {
              browser: sub.device?.browser || sub.browser || "Chrome",
              os: sub.device?.os || sub.os || "Windows",
              deviceType: sub.device?.deviceType || sub.deviceType || "desktop"
            },
            location: {
              ip: sub.location?.ip || sub.ip || "127.0.0.1",
              country: sub.location?.country || sub.country || "United States",
              city: sub.location?.city || sub.city || "New York"
            },
            referrer: sub.referrer || "",
            firstSeenPage: sub.firstSeenPage || "/",
            tags: Array.isArray(sub.tags) ? sub.tags : (sub.tags ? [sub.tags] : []),
            isActive: sub.isActive !== undefined ? Boolean(sub.isActive) : true
          }
        },
        upsert: true
      }
    };
  });

  const result = await Subscriber.bulkWrite(operations);
  return {
    message: `Successfully processed ${subscribersList.length} subscribers`,
    upsertedCount: result.upsertedCount || 0,
    modifiedCount: result.modifiedCount || 0
  };
};

module.exports = {
  getWebsiteSubscribers,
  getSubscriberById,
  updateSubscriberTags,
  deleteSubscriber,
  importSubscribers
};
