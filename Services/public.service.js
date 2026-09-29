const { Subscriber, AnalyticsEvent, Notification, NotificationLog } = require("../Models");

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

// Records a click from a notification. Clicks are attributed to a subscriber
// by the push endpoint reported by the service worker, and only the first click
// per subscriber per notification counts toward the unique click total.
const recordNotificationClick = async (website, notificationId, subscriber, now) => {
  if (!notificationId) {
    return { attributed: false, deduped: false };
  }

  const notification = await Notification.findOne({ _id: notificationId, website: website._id });
  if (!notification) {
    return { attributed: false, deduped: false };
  }

  if (!subscriber) {
    // The click is real but cannot be tied to a subscriber, so it is counted
    // without dedupe rather than silently dropped.
    await Notification.findByIdAndUpdate(notification._id, { $inc: { "stats.clicked": 1 } });
    return { attributed: false, deduped: false };
  }

  // Atomic first-click claim: matches only a row for this subscriber that has
  // not been clicked yet, so concurrent duplicate clicks cannot both win.
  const claimedRow = await NotificationLog.findOneAndUpdate(
    { notification: notification._id, subscriber: subscriber._id, clickedAt: null },
    { $set: { status: "clicked", clickedAt: now }, $inc: { clickCount: 1 } },
    { sort: { timestamp: -1 }, new: true }
  );

  if (claimedRow) {
    await Notification.findByIdAndUpdate(notification._id, { $inc: { "stats.clicked": 1 } });
    return { attributed: true, deduped: false };
  }

  const existingRow = await NotificationLog.findOne({
    notification: notification._id,
    subscriber: subscriber._id
  }).sort({ timestamp: -1 });

  if (existingRow) {
    // Already clicked once; record the repeat without inflating the unique
    // click statistic.
    await NotificationLog.updateOne({ _id: existingRow._id }, { $inc: { clickCount: 1 } });
    return { attributed: true, deduped: true };
  }

  // No log row exists, which happens for sends handled by the Go engine (it
  // writes no per-subscriber rows). Create one so the click is attributed.
  await NotificationLog.create({
    notification: notification._id,
    subscriber: subscriber._id,
    website: website._id,
    status: "clicked",
    clickedAt: now,
    clickCount: 1
  });
  await Notification.findByIdAndUpdate(notification._id, { $inc: { "stats.clicked": 1 } });
  return { attributed: true, deduped: false };
};

const handlePublicClick = async (website, data) => {
  const { campaignId, action, url, endpoint } = data;
  const now = new Date();

  // The service worker reports its own push endpoint so the click can be tied
  // back to the subscriber that received it.
  let subscriber = null;
  if (endpoint) {
    subscriber = await Subscriber.findOne({ website: website._id, endpoint });
  }

  // Store a pathname rather than a full URL so click events line up with the
  // page analytics they are joined against.
  let clickPath = "/";
  if (url) {
    try {
      clickPath = new URL(url).pathname || "/";
    } catch (e) {
      clickPath = url.startsWith("/") ? url : `/${url}`;
    }
  }

  const event = await AnalyticsEvent.create({
    website: website._id,
    siteKey: website.siteKey,
    subscriber: subscriber ? subscriber._id : null,
    eventType: "click",
    path: clickPath,
    action: action || "default"
  });

  let click = { attributed: false, deduped: false };
  try {
    click = await recordNotificationClick(website, campaignId, subscriber, now);
  } catch (err) {
    console.warn("PushForge handlePublicClick: failed to record click attribution", err.message);
  }

  return {
    logged: true,
    eventId: event._id,
    attributed: click.attributed,
    deduped: click.deduped
  };
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
