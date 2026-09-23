const { Subscriber, AnalyticsEvent } = require("../Models");

const registerPublicSubscriber = async (website, data) => {
  const { endpoint, keys, device, location, referrer, firstSeenPage, tags } = data;

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    const error = new Error("Invalid push subscription endpoint or keys");
    error.statusCode = 400;
    throw error;
  }

  const subscriber = await Subscriber.findOneAndUpdate(
    { website: website._id, endpoint },
    {
      website: website._id,
      siteKey: website.siteKey,
      endpoint,
      keys,
      device: device || {},
      location: location || {},
      referrer,
      firstSeenPage,
      tags: tags || [],
      isActive: true
    },
    { upsert: true, new: true, runValidators: true }
  );

  return subscriber;
};

const logPublicAnalyticsEvent = async (website, data) => {
  const { visitorId, subscriberId, eventType, path, duration, referrer, location, device } = data;

  if (!eventType) {
    const error = new Error("eventType is required");
    error.statusCode = 400;
    throw error;
  }

  const event = await AnalyticsEvent.create({
    website: website._id,
    siteKey: website.siteKey,
    visitorId,
    subscriber: subscriberId || null,
    eventType,
    path: path || "/",
    duration: duration || 0,
    referrer: referrer || "",
    location: location || {},
    device: device || {}
  });

  return event;
};

module.exports = {
  registerPublicSubscriber,
  logPublicAnalyticsEvent
};
