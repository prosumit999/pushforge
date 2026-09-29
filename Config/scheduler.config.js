const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// Cron expression for how often the scheduler looks for due notifications.
const schedulerCron = process.env.SCHEDULER_CRON || "*/30 * * * * *";

// A notification stuck in "sending" longer than this is assumed to be
// orphaned by a crashed process and is released for retry.
const stuckSendingThresholdMs = parsePositiveInt(
  process.env.SCHEDULER_STUCK_THRESHOLD_MS,
  15 * 60 * 1000
);

// A "sending" notification may only be reclaimed this many times before it
// is marked failed, so a poison payload cannot loop forever.
const maxDispatchAttempts = parsePositiveInt(process.env.SCHEDULER_MAX_ATTEMPTS, 3);

// How late a notification may be and still be dispatched. Notifications that
// missed their window by more than this are marked failed instead of being
// blasted out long after the fact.
const maxDispatchDelayMs = parsePositiveInt(
  process.env.SCHEDULER_MAX_DELAY_MS,
  24 * 60 * 60 * 1000
);

module.exports = {
  schedulerCron,
  stuckSendingThresholdMs,
  maxDispatchAttempts,
  maxDispatchDelayMs
};
