const { Subscriber, AnalyticsEvent, Notification } = require("../Models");

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
  const { visitorId, subscriberId, campaignId, action, eventType, path, duration, referrer, location, device } = data;

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

  if (eventType === "click" && campaignId) {
    try {
      await Notification.findByIdAndUpdate(campaignId, {
        $inc: { "stats.clicked": 1 }
      });
    } catch (err) {
      console.warn("PushForge logPublicAnalyticsEvent: Failed to increment click count for campaign", campaignId, err.message);
    }
  }

  return event;
};

const handlePublicClick = async (website, data) => {
  const { campaignId, action, url } = data;

  const event = await AnalyticsEvent.create({
    website: website._id,
    siteKey: website.siteKey,
    eventType: "click",
    path: url || "/",
    action: action || "default"
  });

  if (campaignId) {
    try {
      await Notification.findByIdAndUpdate(campaignId, {
        $inc: { "stats.clicked": 1 }
      });
    } catch (err) {
      console.warn("PushForge handlePublicClick: Failed to update campaign stats", campaignId, err.message);
    }
  }

  return { logged: true, eventId: event._id };
};

const renewPublicSubscription = async (website, data) => {
  const { oldEndpoint, newSubscription } = data;
  if (!newSubscription || !newSubscription.endpoint) {
    const error = new Error("Invalid new subscription payload");
    error.statusCode = 400;
    throw error;
  }

  let updated = null;
  if (oldEndpoint) {
    updated = await Subscriber.findOneAndUpdate(
      { website: website._id, endpoint: oldEndpoint },
      {
        endpoint: newSubscription.endpoint,
        keys: newSubscription.keys || {},
        isActive: true
      },
      { new: true }
    );
  }

  if (!updated) {
    updated = await Subscriber.findOneAndUpdate(
      { website: website._id, endpoint: newSubscription.endpoint },
      {
        website: website._id,
        siteKey: website.siteKey,
        endpoint: newSubscription.endpoint,
        keys: newSubscription.keys || {},
        isActive: true
      },
      { upsert: true, new: true }
    );
  }

  return { renewed: true, subscriberId: updated._id };
};

module.exports = {
  registerPublicSubscriber,
  logPublicAnalyticsEvent,
  handlePublicClick,
  renewPublicSubscription
};
