const express = require("express");

const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");

const {
  getConversations,
  getConversationById,
  sendChatMessage,
  createConversation,
} = require("../controllers/aiController");

const {
  conversationIdValidation,
  sendChatValidation,
  conversationListValidation,
} = require("../validators/aiValidators");

const router = express.Router();
router.use(authenticate);
/**
 * @swagger
 * /api/ai/conversations:
 *   get:
 *     summary: Get user's conversations
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *     responses:
 *       200:
 *         description: Conversations returned successfully
 *       401:
 *         description: Authentication required
 */
router.get(
  "/conversations",
  conversationListValidation,
  validate,
  getConversations,
);

router.get(
  "/conversations",
  conversationListValidation,
  validate,
  getConversations,
);

router.get(
  "/conversations/:id",
  conversationIdValidation,
  validate,
  getConversationById,
);

router.post("/conversations", createConversation);
/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Send a chat message
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *               - conversationId
 *             properties:
 *               prompt:
 *                 type: string
 *                 example: Explain REST APIs
 *               conversationId:
 *                 type: string
 *                 example: 65f123456789abcdef123456
 *               assistantResponse:
 *                 type: string
 *               assistantStatus:
 *                 type: string
 *                 enum:
 *                   - completed
 *                   - failed
 *     responses:
 *       200:
 *         description: Message saved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Conversation not found
 */
router.post("/chat", sendChatValidation, validate, sendChatMessage);
router.post("/chat", sendChatValidation, validate, sendChatMessage);

module.exports = router;
