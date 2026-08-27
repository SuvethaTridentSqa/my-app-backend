const { validationResult } = require("express-validator");
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Request validation failed.",
      errors: errors.array().map((error) => ({
        field: error.path,
        location: error.location,
        message: error.msg,
      })),
    });
  }
  next();
};

module.exports = validate;
