const mongoose = require("mongoose");

function errorHandler(err, req, res, next) {
  console.error("API ERROR:", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id,
  });
  if (res.headersSent) {
    return next(err);
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Invalid data.",
      errors: Object.values(err.errors).map((error) => ({
        field: error.path,
        message: error.message,
      })),
    });
  }

  // Invalid MongoDB ObjectId
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ID",
      message: "Invalid resource ID.",
    });
  }

  // Duplicate MongoDB key
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      code: "DUPLICATE_RESOURCE",
      message: "A resource with this value already exists.",
    });
  }

  // JSON parsing error
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      code: "INVALID_JSON",
      message: "Invalid JSON request body.",
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const safeStatusCode =
    statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  return res.status(safeStatusCode).json({
    success: false,
    code: err.code || "INTERNAL_SERVER_ERROR",
    message:
      safeStatusCode >= 500
        ? "An unexpected server error occurred."
        : err.message || "Request failed.",
  });
}

module.exports = errorHandler;
