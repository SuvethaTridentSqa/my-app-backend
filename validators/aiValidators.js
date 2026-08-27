const { body, param, query } = require("express-validator");
const conversationIdValidation = [
  param("id").isMongoId().withMessage("Invalid conversation ID."),
];

const createConversationValidation = [];
const sendChatValidation = [
  body("prompt")
    .isString()
    .withMessage("Prompt must be a string.")
    .trim()
    .notEmpty()
    .withMessage("Prompt text is required.")
    .isLength({ max: 10000 })
    .withMessage("Prompt cannot exceed 10,000 characters."),
  body("conversationId").isMongoId().withMessage("Invalid conversation ID."),
  body("assistantResponse")
    .optional()
    .isString()
    .withMessage("Assistant response must be a string.")
    .isLength({ max: 50000 })
    .withMessage("Assistant response is too large."),
  body("assistantStatus")
    .optional()
    .isIn(["completed", "failed"])
    .withMessage("Invalid assistant status."),
];

const conversationListValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer.")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50.")
    .toInt(),
];

module.exports = {
  conversationIdValidation,
  createConversationValidation,
  sendChatValidation,
  conversationListValidation,
};
