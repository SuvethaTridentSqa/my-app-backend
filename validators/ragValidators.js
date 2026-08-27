const { body } = require("express-validator");

const searchRAGValidation = [
  body("query")
    .optional()
    .isString()
    .withMessage("Query must be a string.")
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Query cannot exceed 5,000 characters."),
  body("embedding")
    .optional()
    .isArray({ min: 1 })
    .withMessage("Embedding must be an array."),
  body("embedding.*")
    .optional()
    .isFloat()
    .withMessage("Embedding values must be numbers."),
  body("limit")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Limit must be between 1 and 20.")
    .toInt(),
];

const uploadDocumentValidation = [
  body("title")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Title is required.")
    .isLength({ max: 500 })
    .withMessage("Title cannot exceed 500 characters."),
  body("fileName")
    .optional()
    .isString()
    .withMessage("File name must be a string."),
  body("chunks")
    .isArray({ min: 1 })
    .withMessage("At least one chunk is required."),
  body("chunks.*").isObject().withMessage("Each chunk must be an object."),
];

module.exports = {
  searchRAGValidation,
  uploadDocumentValidation,
};
