const cron = require("node-cron");
const { Notification } = require("../Models");
const queueService = require("./queue.service");
const {
  schedulerCron,
  maxDispatchAttempts,
  maxDispatchDelayMs,
  stuckSendingThresholdMs
} = require("../Config/scheduler.config");

let scheduledTask = null;
let isTickRunning = false;

// Atomically move a due notification into the queue so two ticks (or two server
// instances) can never enqueue the same send twice.
const claimDueNotification = async (notificationId) => {
  const now = new Date();
  return Notification.findOneAndUpdate(
    { _id: notificationId, status: "scheduled" },
    {
      $set: { status: "queued" },
      $inc: { dispatchAttempts: 1 }
    },
    { new: true }
  );
};

const processScheduledNotifications = async () => {
  if (isTickRunning) {
    return;
  }
  isTickRunning = true;

  try {
    const now = new Date();
    const dueNotifications = await Notification.find({
      isTemplate: false,
      status: "scheduled",
      scheduledAt: { $lte: now }
    })
      .select("_id title scheduledAt dispatchAttempts")
      .lean();

    if (dueNotifications.length === 0) {
      return;
    }
    console.log(`Scheduler: ${dueNotifications.length} notification(s) due for dispatch.`);

    for (const notif of dueNotifications) {
      const overdueMs = now.getTime() - new Date(notif.scheduledAt).getTime();

      // Notifications that missed their window badly are abandoned rather than
      // delivered stale, which would surprise subscribers.
      if (overdueMs > maxDispatchDelayMs) {
        await Notification.updateOne({ _id: notif._id, status: "scheduled" }, { $set: { status: "failed" } });
        console.warn(`Scheduler: notification ${notif._id} exceeded the dispatch window and was marked failed.`);
        continue;
      }

      if ((notif.dispatchAttempts || 0) >= maxDispatchAttempts) {
        await Notification.updateOne({ _id: notif._id, status: "scheduled" }, { $set: { status: "failed" } });
        console.warn(`Scheduler: notification ${notif._id} hit the retry limit and was marked failed.`);
        continue;
      }

      const claimed = await claimDueNotification(notif._id);
      if (!claimed) {
        continue;
      }

      await queueService.enqueue({
        notification: claimed._id,
        website: claimed.website,
        type: "broadcast"
      });

      console.log(`Scheduler: queued "${claimed.title}" (${claimed._id}) for dispatch.`);
    }
  } catch (error) {
    console.error(`Scheduler error while processing scheduled notifications: ${error.message}`);
  } finally {
    isTickRunning = false;
  }
};

// A notification left in "queued"/"sending" with no live job means the enqueue
// or the consumer died. Requeue it while the attempt budget lasts, otherwise
// park it as failed so it stops looking in-progress forever.
const reconcileOrphanedNotifications = async () => {
  try {
    const cutoff = new Date(Date.now() - stuckSendingThresholdMs);
    const orphans = await Notification.find({
      isTemplate: false,
      status: { $in: ["queued", "sending"] },
      updatedAt: { $lte: cutoff }
    })
      .select("_id dispatchAttempts status")
      .lean();

    for (const notif of orphans) {
      if (await queueService.hasLiveJob(notif._id)) {
        continue;
      }

      if ((notif.dispatchAttempts || 0) >= maxDispatchAttempts) {
        await Notification.updateOne({ _id: notif._id, status: notif.status }, { $set: { status: "failed" } });
        console.warn(`Scheduler: orphaned notification ${notif._id} hit the retry limit and was marked failed.`);
        continue;
      }

      const claimed = await Notification.findOneAndUpdate(
        { _id: notif._id, status: notif.status },
        { $set: { status: "queued" }, $inc: { dispatchAttempts: 1 } },
        { new: true }
      );

      if (claimed) {
        await queueService.enqueue({ notification: claimed._id, website: claimed.website, type: "broadcast" });
        console.warn(`Scheduler: recovered orphaned notification ${notif._id} and requeued it.`);
      }
    }
  } catch (error) {
    console.error(`Scheduler error while reconciling orphaned notifications: ${error.message}`);
  }
};

const runOnce = async () => {
  await reconcileOrphanedNotifications();
  await processScheduledNotifications();
};

const startScheduler = () => {
  if (scheduledTask) {
    console.log("Scheduler: notification scheduler is already running.");
    return;
  }

  scheduledTask = cron.schedule(schedulerCron, () => {
    runOnce();
  });

  console.log(`Scheduler: push notification scheduler started (cron "${schedulerCron}").`);
};

const stopScheduler = () => {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("Scheduler: notification scheduler stopped.");
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
  processScheduledNotifications,
  reconcileOrphanedNotifications,
  runOnce
};
