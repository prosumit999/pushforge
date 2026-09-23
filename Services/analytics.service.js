const { Website, Subscriber, Notification, AnalyticsEvent } = require("../Models");

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

  const topPages = await AnalyticsEvent.aggregate([
    { $match: { website: objectId } },
    { $group: { _id: "$path", views: { $sum: 1 } } },
    { $sort: { views: -1 } },
    { $limit: 10 }
  ]);

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
    topPages: topPages.map((p) => ({ path: p._id, views: p.views })),
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
