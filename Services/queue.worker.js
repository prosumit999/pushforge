const { Notification } = require("../Models");
const queueService = require("./queue.service");
const workerService = require("./worker.service");
const { queuePollMs, queueConcurrency } = require("../Config/queue.config");
const { logSecurityEvent } = require("./superadmin.service");

let pollTimer = null;
let isDraining = false;
let activeCount = 0;
let processedSinceRecovery = 0;

const runJob = async (job) => {
  try {
    // A test send is interactive and side-effect free, so it must not move the
    // campaign out of its terminal state.
    if (job.type !== "test") {
      await Notification.findOneAndUpdate(
        { _id: job.notification, status: "queued" },
        { $set: { status: "sending" } }
      );
    }

    const { result } = await workerService.processDispatchJob(job);

    await queueService.completeJob(job._id, result);
    console.log(
      `Queue: job ${job._id} (${job.type}) for notification ${job.notification} completed via ${result.handledBy} ` +
      `- delivered ${result.delivered}, failed ${result.failed}.`
    );

    if (result.failed > 0) {
      logSecurityEvent({
        type: "PUSH_FAILED",
        title: "Push Notification Delivery Alert",
        detail: `Delivery failed for ${result.failed} endpoints during push dispatch`,
        severity: "danger"
      });
    }

    logSecurityEvent({
      type: "ADMIN_PUSH_DISPATCH",
      title: "Broadcast Push Notification Dispatched",
      detail: `Push dispatch completed. Delivered to ${result.delivered || 0} subscribers via ${result.handledBy || "Go Worker Engine"}`,
      severity: "info"
    });
  } catch (error) {
    console.error(`Queue: job ${job._id} failed on attempt ${job.attempts}: ${error.message}`);

    logSecurityEvent({
      type: "PUSH_FAILED",
      title: "Push Dispatch Error Failure",
      detail: `Dispatch job ${job._id} failed: ${error.message}`,
      severity: "danger"
    });

    // A missing notification is not worth retrying; park the job immediately.
    if (error.permanent) {
      await Notification.findByIdAndUpdate(job.notification, { $set: { status: "failed" } });
      await queueService.completeJob(job._id, {});
      return;
    }

    const updated = await queueService.failJob(job._id, error);

    if (updated && updated.status === "failed" && job.type !== "test") {
      await Notification.findByIdAndUpdate(job.notification, { $set: { status: "failed" } });
    }
  }
};

// Claims and runs jobs until the queue has nothing due. Concurrency is bounded
// so a large broadcast cannot starve the API process of connections.
const drainQueue = async () => {
  if (isDraining) {
    return;
  }
  isDraining = true;

  try {
    while (activeCount < queueConcurrency) {
      const job = await queueService.claimNextJob();
      if (!job) {
        break;
      }

      activeCount++;
      runJob(job)
        .catch((error) => console.error(`Queue: unhandled job error: ${error.message}`))
        .finally(() => {
          activeCount--;
        });
    }

    // Recovery is amortised rather than run on every poll.
    processedSinceRecovery++;
    if (processedSinceRecovery >= 50) {
      processedSinceRecovery = 0;
      await queueService.recoverStaleJobs();
    }
  } catch (error) {
    console.error(`Queue: drain error: ${error.message}`);
  } finally {
    isDraining = false;
  }
};

const startQueueWorker = () => {
  if (pollTimer) {
    console.log("Queue: consumer is already running.");
    return;
  }

  pollTimer = setInterval(() => {
    drainQueue();
  }, queuePollMs);

  // Do not hold the process open purely for the poll loop.
  if (typeof pollTimer.unref === "function") {
    pollTimer.unref();
  }

  console.log(`Queue: consumer started (poll ${queuePollMs}ms, concurrency ${queueConcurrency}, worker ${queueService.WORKER_ID}).`);
};

const stopQueueWorker = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log("Queue: consumer stopped.");
  }
};

module.exports = {
  startQueueWorker,
  stopQueueWorker,
  drainQueue,
  getActiveCount: () => activeCount
};
