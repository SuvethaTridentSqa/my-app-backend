const { body } = require("express-validator");

const createUrlValidation = [
  body("originalUrl")
    .exists()
    .withMessage("Original URL is required.")
    .bail()
    .isString()
    .withMessage("Original URL must be a string.")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("Original URL is required."),
  body("alias")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("Custom alias must be a string."),
  body("password")
    .optional({ values: "falsy" })
    .custom((value) => ["string", "number"].includes(typeof value))
    .withMessage("Password must be a string or number."),
  body("expiresAt")
    .optional({ values: "falsy" })
    .custom(
      (value) =>
        ["string", "number"].includes(typeof value) &&
        !Number.isNaN(new Date(value).getTime()),
    )
    .withMessage("Expiration date is invalid."),
  body("title")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("Title must be a string."),
  body("description")
    .optional({ values: "falsy" })
    .isString()
    .withMessage("Description must be a string."),
];

module.exports = { createUrlValidation };
