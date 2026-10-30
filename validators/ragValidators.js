const { body, param } = require("express-validator");
const { EMBEDDING_DIMENSIONS } = require("../services/ragService");

const ragDocumentIdValidation = [
  param("id").isMongoId().withMessage("Invalid document ID."),
];

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
    .isArray({ min: EMBEDDING_DIMENSIONS, max: EMBEDDING_DIMENSIONS })
    .withMessage(`Embedding must contain ${EMBEDDING_DIMENSIONS} values.`),
  body("embedding.*")
    .optional()
    .isFloat()
    .withMessage("Embedding values must be numbers."),
  body("limit")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("Limit must be between 1 and 20.")
    .toInt(),
  body("documentId")
    .optional()
    .isMongoId()
    .withMessage("Invalid document ID."),
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
  body("chunks.*.text")
    .isString()
    .withMessage("Each chunk must contain text."),
  body("chunks.*.embedding")
    .isArray({ min: EMBEDDING_DIMENSIONS, max: EMBEDDING_DIMENSIONS })
    .withMessage(
      `Each chunk embedding must contain ${EMBEDDING_DIMENSIONS} values.`,
    ),
  body("chunks.*.embedding.*")
    .isFloat()
    .withMessage("Embedding values must be numbers."),
];

module.exports = {
  ragDocumentIdValidation,
  searchRAGValidation,
  uploadDocumentValidation,
};
