const os = require("os");
const mongoose = require("mongoose");
const { DispatchJob } = require("../Models");
const {
  queueLockTimeoutMs,
  queueMaxAttempts,
  queueBackoffBaseMs,
  queueBackoffMaxMs
} = require("../Config/queue.config");

const WORKER_ID = `${os.hostname()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

// Priority levels keep interactive work (test sends) ahead of bulk broadcasts.
const JOB_PRIORITY = {
  test: 1,
  retry_failed: 3,
  broadcast: 5
};

// Exponential backoff, capped, so a transient outage retries quickly at first
// and then backs off instead of hammering the push service.
const computeBackoffMs = (attempts) => {
  const delay = queueBackoffBaseMs * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(delay, queueBackoffMaxMs);
};

const enqueue = async ({ notification, website, type = "broadcast", subscriberIds = [], runAt = new Date() }) => {
  return DispatchJob.create({
    notification,
    website,
    type,
    subscriberIds,
    priority: JOB_PRIORITY[type] ?? JOB_PRIORITY.broadcast,
    runAt,
    maxAttempts: queueMaxAttempts,
    status: "queued"
  });
};

// Atomically take ownership of the next due job. The status filter inside the
// update is what guarantees two consumers can never claim the same job.
const claimNextJob = async () => {
  const now = new Date();
  return DispatchJob.findOneAndUpdate(
    { status: "queued", runAt: { $lte: now } },
    {
      $set: { status: "active", lockedAt: now, lockedBy: WORKER_ID },
      $inc: { attempts: 1 }
    },
    { sort: { priority: 1, runAt: 1 }, new: true }
  );
};

const completeJob = async (jobId, result = {}) => {
  return DispatchJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        lastError: null,
        result: {
          sent: result.sent || 0,
          delivered: result.delivered || 0,
          failed: result.failed || 0
        }
      }
    },
    { new: true }
  );
};

// Records a failed attempt. The job goes back to "queued" with a backoff delay
// until the attempt budget runs out, then it is parked as "failed".
const failJob = async (jobId, error) => {
  const job = await DispatchJob.findById(jobId);
  if (!job) {
    return null;
  }

  const message = String(error && error.message ? error.message : error).slice(0, 500);

  if (job.attempts >= job.maxAttempts) {
    return DispatchJob.findByIdAndUpdate(
      jobId,
      { $set: { status: "failed", lastError: message, lockedAt: null, lockedBy: null } },
      { new: true }
    );
  }

  return DispatchJob.findByIdAndUpdate(
    jobId,
    {
      $set: {
        status: "queued",
        lastError: message,
        lockedAt: null,
        lockedBy: null,
        runAt: new Date(Date.now() + computeBackoffMs(job.attempts))
      }
    },
    { new: true }
  );
};

// Returns jobs abandoned by a crashed consumer back to the queue.
const recoverStaleJobs = async () => {
  const cutoff = new Date(Date.now() - queueLockTimeoutMs);
  const staleJobs = await DispatchJob.find({ status: "active", lockedAt: { $lte: cutoff } }).select("_id attempts maxAttempts");

  if (staleJobs.length === 0) {
    return 0;
  }

  let recovered = 0;
  for (const job of staleJobs) {
    const exhausted = job.attempts >= job.maxAttempts;
    const update = exhausted
      ? { $set: { status: "failed", lastError: "Abandoned by a stopped consumer", lockedAt: null, lockedBy: null } }
      : { $set: { status: "queued", runAt: new Date(), lockedAt: null, lockedBy: null } };

    const res = await DispatchJob.findOneAndUpdate({ _id: job._id, status: "active" }, update, { new: true });
    if (res) {
      recovered++;
      console.warn(`Queue: recovered stale job ${job._id} (${exhausted ? "marked failed" : "requeued"}).`);
    }
  }

  return recovered;
};

// A notification may only have one live job at a time, otherwise a double click
// or a scheduler race would produce two competing broadcasts.
const hasLiveJob = async (notificationId) =>
  Boolean(await DispatchJob.exists({ notification: notificationId, status: { $in: ["queued", "active"] } }));

const getQueueStats = async (websiteId) => {
  // The website id arrives as a string from the request layer, but the stored
  // field is an ObjectId, so the match would silently return nothing without
  // an explicit cast.
  let match = {};
  if (websiteId) {
    if (!mongoose.Types.ObjectId.isValid(websiteId)) {
      const error = new Error("Invalid website id");
      error.statusCode = 400;
      throw error;
    }
    match = { website: new mongoose.Types.ObjectId(String(websiteId)) };
  }

  const rows = await DispatchJob.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  const stats = { queued: 0, active: 0, completed: 0, failed: 0 };
  rows.forEach((row) => {
    if (row._id in stats) stats[row._id] = row.count;
  });
  return stats;
};

const getJobsForNotification = async (notificationId) =>
  DispatchJob.find({ notification: notificationId }).sort({ createdAt: -1 }).limit(20);

module.exports = {
  WORKER_ID,
  JOB_PRIORITY,
  enqueue,
  claimNextJob,
  completeJob,
  failJob,
  recoverStaleJobs,
  hasLiveJob,
  getQueueStats,
  getJobsForNotification
};
