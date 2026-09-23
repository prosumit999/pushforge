const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

const helmetMiddleware = helmet();

const securityMiddleware = (req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  helmetMiddleware(req, res, (err) => {
    if (err) return next(err);
    rateLimiter(req, res, next);
  });
};

module.exports = securityMiddleware;
