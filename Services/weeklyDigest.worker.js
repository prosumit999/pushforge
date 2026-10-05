const cron = require("node-cron");
const { User, Website, Subscriber, Notification } = require("../Models");
const { sendEmail, buildWeeklyDigestEmailHtml, buildQuotaWarningEmailHtml } = require("./email.service");

// Runs every Monday morning at 09:00 AM (0 9 * * 1)
const runDigestCheck = async () => {
  console.log("Running weekly push analytics digest cron job...");
  try {
    const users = await User.find({ status: "active" });

    for (const user of users) {
      const websites = await Website.find({ user: user._id });
      if (!websites || websites.length === 0) continue;

      let totalSubscribers = 0;
      let totalSent = 0;
      let totalClicks = 0;

      for (const site of websites) {
        const subCount = await Subscriber.countDocuments({ website: site._id });
        totalSubscribers += subCount;

        const notifications = await Notification.find({ website: site._id });
        notifications.forEach((n) => {
          totalSent += n.stats?.delivered || 0;
          totalClicks += n.stats?.clicked || 0;
        });

        // Check Quota Warning (>80% limit)
        const planLimits = { Starter: 20000, "Business Pro": 1000000, Agency: 99999999, "Self-Hosted": 99999999 };
        const maxLimit = planLimits[user.plan] || 20000;
        if (subCount >= maxLimit * 0.8) {
          try {
            const warningHtml = buildQuotaWarningEmailHtml({
              name: user.name,
              websiteName: site.name || site.domain,
              currentCount: subCount,
              maxLimit
            });
            await sendEmail({
              to: user.email,
              subject: `Quota Warning: ${site.domain} reached 80%+ limit`,
              html: warningHtml
            });
          } catch (e) {
            // Ignore email dispatch errors
          }
        }
      }

      const avgCtr = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : "0.0";

      if (totalSubscribers > 0 || totalSent > 0) {
        try {
          const digestHtml = buildWeeklyDigestEmailHtml({
            name: user.name,
            totalSubscribers,
            totalSent,
            totalClicks,
            avgCtr
          });

          await sendEmail({
            to: user.email,
            subject: `Your Weekly Web Push Analytics Digest`,
            html: digestHtml
          });
        } catch (e) {
          // Ignore email error
        }
      }
    }
  } catch (err) {
    console.error("Weekly digest worker error:", err.message);
  }
};

const startWeeklyDigestWorker = () => {
  console.log("Weekly Digest & Quota Worker initialized.");
  // Check Quotas and Send Weekly Digests (runs on Mondays at 9am)
  cron.schedule("0 9 * * 1", runDigestCheck);
};

module.exports = {
  startWeeklyDigestWorker,
  runDigestCheck
};
