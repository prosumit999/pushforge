const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const isProd = process.env.NODE_ENV === "production";

// 1. Production Helmet Headers (cross-origin enabled for public SDK & SW files)
const helmetMiddleware = helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
  referrerPolicy: { policy: "no-referrer-when-downgrade" },
  frameguard: { action: "deny" },
  xssFilter: true,
  noSniff: true
});

// 2. Production Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP. Please try again after 15 minutes." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 authentication attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again after 15 minutes." }
});

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // High throughput for SDK subscriber collection & tracking
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Rate limit exceeded for public SDK telemetry." }
});

// Main global security middleware: Active ONLY in production
const securityMiddleware = (req, res, next) => {
  if (!isProd) {
    return next();
  }

  helmetMiddleware(req, res, (err) => {
    if (err) return next(err);
    globalLimiter(req, res, next);
  });
};

const productionAuthLimiter = (req, res, next) => {
  if (!isProd) return next();
  authLimiter(req, res, next);
};

const productionPublicLimiter = (req, res, next) => {
  if (!isProd) return next();
  publicLimiter(req, res, next);
};

module.exports = {
  securityMiddleware,
  productionAuthLimiter,
  productionPublicLimiter
};
