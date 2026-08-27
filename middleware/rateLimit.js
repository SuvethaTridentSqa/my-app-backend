const rateLimit = require("express-rate-limit");

const rateLimitResponse = {
  success: false,
  code: "RATE_LIMIT_EXCEEDED",
  message: "Too many requests. Please try again later.",
};

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: rateLimitResponse,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(rateLimitResponse);
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    code: "AUTH_RATE_LIMIT_EXCEEDED",
    message: "Too many authentication attempts. Please try again later.",
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      success: false,
      code: "AUTH_RATE_LIMIT_EXCEEDED",
      message: "Too many authentication attempts. Please try again later.",
    });
  },
});

module.exports = {
  authLimiter,
  generalLimiter,
};
