const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// How often the queue consumer polls for work when idle.
const queuePollMs = parsePositiveInt(process.env.QUEUE_POLL_MS, 2000);

// How many jobs one consumer processes concurrently.
const queueConcurrency = parsePositiveInt(process.env.QUEUE_CONCURRENCY, 2);

// A job locked longer than this is assumed abandoned by a dead consumer and is
// returned to the queue.
const queueLockTimeoutMs = parsePositiveInt(process.env.QUEUE_LOCK_TIMEOUT_MS, 10 * 60 * 1000);

// Attempts per job before it is marked failed.
const queueMaxAttempts = parsePositiveInt(process.env.QUEUE_MAX_ATTEMPTS, 3);

// Exponential backoff between attempts, capped so a job cannot sleep forever.
const queueBackoffBaseMs = parsePositiveInt(process.env.QUEUE_BACKOFF_BASE_MS, 5000);
const queueBackoffMaxMs = parsePositiveInt(process.env.QUEUE_BACKOFF_MAX_MS, 5 * 60 * 1000);

module.exports = {
  queuePollMs,
  queueConcurrency,
  queueLockTimeoutMs,
  queueMaxAttempts,
  queueBackoffBaseMs,
  queueBackoffMaxMs
};
