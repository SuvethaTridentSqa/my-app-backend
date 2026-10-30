const mongoose = require("mongoose");

function errorHandler(err, req, res, next) {
  const errorLog = {
    method: req.method,
    url: req.originalUrl,
    userId: req.user?._id,
  };
  if (process.env.NODE_ENV !== "production") {
    errorLog.message = err.message;
    errorLog.stack = err.stack;
  }
  console.error("API ERROR:", errorLog);
  if (res.headersSent) {
    return next(err);
  }

  // Mongoose validation error
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      message: "Invalid data.",
      data: null,
      meta: {
        code: "VALIDATION_ERROR",
        errors: Object.values(err.errors).map((error) => ({
          field: error.path,
          message: error.message,
        })),
      },
    });
  }

  // Invalid MongoDB ObjectId
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      message: "Invalid resource ID.",
      data: null,
      meta: {
        code: "INVALID_ID",
        errors: [{ field: err.path, message: "Invalid resource ID." }],
      },
    });
  }

  // Duplicate MongoDB key
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A resource with this value already exists.",
      data: null,
      meta: { code: "DUPLICATE_RESOURCE", errors: [] },
    });
  }

  // JSON parsing error
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body.",
      data: null,
      meta: { code: "INVALID_JSON", errors: [] },
    });
  }

  if (err.name === "MulterError") {
    const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 413
          ? "Uploaded file exceeds the allowed size."
          : "File upload failed.",
      data: null,
      meta: { code: err.code || "UPLOAD_ERROR", errors: [] },
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const safeStatusCode =
    statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  return res.status(safeStatusCode).json({
    success: false,
    message:
      safeStatusCode >= 500
        ? "An unexpected server error occurred."
        : err.expose
          ? err.message
          : "Request failed.",
    data: null,
    meta: { code: err.code || "INTERNAL_SERVER_ERROR", errors: [] },
  });
}

module.exports = errorHandler;
