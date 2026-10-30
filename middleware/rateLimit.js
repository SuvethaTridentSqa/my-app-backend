const rateLimit = require("express-rate-limit");

const rateLimitResponse = {
  success: false,
  message: "Too many requests. Please try again later.",
  data: null,
  meta: { code: "RATE_LIMIT_EXCEEDED", errors: [] },
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
    message: "Too many authentication attempts. Please try again later.",
    data: null,
    meta: { code: "AUTH_RATE_LIMIT_EXCEEDED", errors: [] },
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      success: false,
      message: "Too many authentication attempts. Please try again later.",
      data: null,
      meta: { code: "AUTH_RATE_LIMIT_EXCEEDED", errors: [] },
    });
  },
});

module.exports = {
  authLimiter,
  generalLimiter,
};
