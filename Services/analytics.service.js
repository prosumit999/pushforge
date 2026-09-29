const { Website, Subscriber, Notification, AnalyticsEvent } = require("../Models");

// Page analytics are keyed by pathname. Click events arrive with an absolute
// URL while notification targets may be absolute or site-relative, so both are
// reduced to a pathname before they are joined.
const toPathname = (value) => {
  if (!value) return "/";
  try {
    return new URL(value).pathname || "/";
  } catch (e) {
    return value.startsWith("/") ? value : `/${value}`;
  }
};

const verifyWebsiteOwnership = async (userId, websiteId) => {
  const website = await Website.findOne({ _id: websiteId, user: userId });
  if (!website) {
    const error = new Error("Website not found or unauthorized");
    error.statusCode = 404;
    throw error;
  }
  return website;
};

const getWebsiteOverview = async (userId, websiteId) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const totalSubscribers = await Subscriber.countDocuments({ website: websiteId });
  const activeSubscribers = await Subscriber.countDocuments({ website: websiteId, isActive: true });

  const notifications = await Notification.find({ website: websiteId });
  let notificationsSent = 0;
  let totalDelivered = 0;
  let totalClicked = 0;

  notifications.forEach((n) => {
    if (n.stats) {
      notificationsSent += n.stats.sent || 0;
      totalDelivered += n.stats.delivered || 0;
      totalClicked += n.stats.clicked || 0;
    }
  });

  const ctr = totalDelivered > 0 ? ((totalClicked / totalDelivered) * 100).toFixed(2) : 0;

  const totalEvents = await AnalyticsEvent.countDocuments({ website: websiteId });
  const bounceEvents = await AnalyticsEvent.countDocuments({ website: websiteId, eventType: "session_end", duration: { $lt: 10 } });
  const bounceRate = totalEvents > 0 ? ((bounceEvents / totalEvents) * 100).toFixed(2) : 0;

  return {
    totalSubscribers,
    activeSubscribers,
    notificationsSent,
    ctr: parseFloat(ctr),
    bounceRate: parseFloat(bounceRate)
  };
};

const getSubscriberGrowth = async (userId, websiteId) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const growthData = await Subscriber.aggregate([
    {
      $match: {
        website: new (require("mongoose").Types.ObjectId)(websiteId),
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return growthData.map((item) => ({ date: item._id, count: item.count }));
};

const getWebsiteVisitorAnalytics = async (userId, websiteId) => {
  await verifyWebsiteOwnership(userId, websiteId);

  const objectId = new (require("mongoose").Types.ObjectId)(websiteId);

  // Fetch all notifications for this website to aggregate push count per target page.
  const notifications = await Notification.find({ website: websiteId });
  const pushStatsByPath = {};

  notifications.forEach((n) => {
    // clickUrl is the field the model and the worker actually use; reading a
    // non-existent "url" bucketed every notification under "/".
    const p = toPathname(n.clickUrl);
    if (!pushStatsByPath[p]) {
      pushStatsByPath[p] = { pushSent: 0, pushClicks: 0 };
    }
    pushStatsByPath[p].pushSent += n.stats?.sent || 0;
    pushStatsByPath[p].pushClicks += n.stats?.clicked || 0;
  });

  // Aggregate page analytics: views, total duration, bounce events
  const pageAnalyticsRaw = await AnalyticsEvent.aggregate([
    { $match: { website: objectId } },
    {
      $group: {
        _id: "$path",
        views: { $sum: 1 },
        totalDurationSec: { $sum: { $ifNull: ["$duration", 0] } },
        shortSessions: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ["$eventType", "session_end"] },
                  { $lt: [{ $ifNull: ["$duration", 0] }, 10] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    { $sort: { views: -1 } }
  ]);

  const pageMap = new Map();

  pageAnalyticsRaw.forEach((item) => {
    const path = toPathname(item._id);
    const views = item.views || 0;
    const totalDuration = item.totalDurationSec || 0;
    const bounces = item.shortSessions || 0;
    const pushInfo = pushStatsByPath[path] || { pushSent: 0, pushClicks: 0 };

    // Two raw buckets can normalise to the same pathname (for example a
    // relative and an absolute form of the same page), so they are merged.
    const existing = pageMap.get(path);
    const mergedViews = (existing ? existing.views : 0) + views;
    const mergedDuration = (existing ? existing.totalDurationSec : 0) + totalDuration;
    const mergedBounces = (existing ? existing._bounces : 0) + bounces;

    pageMap.set(path, {
      path,
      views: mergedViews,
      pushSent: pushInfo.pushSent,
      pushClicks: pushInfo.pushClicks,
      totalDurationSec: mergedDuration,
      avgDurationSec: mergedViews > 0 ? Math.round(mergedDuration / mergedViews) : 0,
      bounceRate: mergedViews > 0 ? parseFloat(((mergedBounces / mergedViews) * 100).toFixed(1)) : 0,
      _bounces: mergedBounces
    });
  });

  // Drop the internal accumulator before the rows leave the service.
  pageMap.forEach((row) => { delete row._bounces; });

  // A notification can target a page that has no recorded traffic yet. Those
  // pages still have real push performance, so they are listed with zero views
  // rather than being omitted entirely.
  Object.keys(pushStatsByPath).forEach((path) => {
    if (!pageMap.has(path)) {
      const pushInfo = pushStatsByPath[path];
      pageMap.set(path, {
        path,
        views: 0,
        pushSent: pushInfo.pushSent,
        pushClicks: pushInfo.pushClicks,
        totalDurationSec: 0,
        avgDurationSec: 0,
        bounceRate: 0
      });
    }
  });

  // Only pages with real recorded events are reported. Previously a set of
  // invented "default paths" with fabricated view counts was injected here,
  // which made an empty account look busy.
  const pagePushStats = Array.from(pageMap.values()).sort((a, b) => b.views - a.views);

  // Overall totals
  const totalViews = pagePushStats.reduce((acc, p) => acc + p.views, 0);
  const totalPushSent = pagePushStats.reduce((acc, p) => acc + p.pushSent, 0);
  const totalPushClicks = pagePushStats.reduce((acc, p) => acc + p.pushClicks, 0);
  const avgBounceRate = pagePushStats.length
    ? parseFloat((pagePushStats.reduce((acc, p) => acc + p.bounceRate, 0) / pagePushStats.length).toFixed(1))
    : 0;
  const avgDurationSec = pagePushStats.length
    ? Math.round(pagePushStats.reduce((acc, p) => acc + p.avgDurationSec, 0) / pagePushStats.length)
    : 0;

  // Heatmap click data. Only events that actually carry coordinates are
  // plotted; random positions are not invented for the rest, because a
  // fabricated heatmap is indistinguishable from real user behaviour.
  const clickEvents = await AnalyticsEvent.find({
    website: websiteId,
    eventType: "click",
    x: { $ne: null },
    y: { $ne: null }
  })
    .sort({ timestamp: -1 })
    .limit(200)
    .lean();

  const heatmapPoints = clickEvents.map((ev) => ({
    path: ev.path || "/",
    x: ev.x,
    y: ev.y,
    intensity: 0.6,
    device: ev.device?.deviceType || "desktop"
  }));

  const countryBreakdown = await AnalyticsEvent.aggregate([
    { $match: { website: objectId, "location.country": { $ne: null } } },
    { $group: { _id: "$location.country", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const deviceBreakdown = await AnalyticsEvent.aggregate([
    { $match: { website: objectId, "device.deviceType": { $ne: null } } },
    { $group: { _id: "$device.deviceType", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const browserBreakdown = await AnalyticsEvent.aggregate([
    { $match: { website: objectId, "device.browser": { $ne: null } } },
    { $group: { _id: "$device.browser", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  return {
    summary: {
      totalViews,
      totalPushSent,
      totalPushClicks,
      avgBounceRate,
      avgDurationSec
    },
    pagePushStats,
    heatmapPoints,
    topPages: pagePushStats.map((p) => ({ path: p.path, views: p.views })),
    countryBreakdown: countryBreakdown.map((c) => ({ country: c._id, count: c.count })),
    deviceBreakdown: deviceBreakdown.map((d) => ({ device: d._id, count: d.count })),
    browserBreakdown: browserBreakdown.map((b) => ({ browser: b._id, count: b.count }))
  };
};

module.exports = {
  getWebsiteOverview,
  getSubscriberGrowth,
  getWebsiteVisitorAnalytics
};
