const express = require("express");
const { authenticate } = require("../middleware/auth");
const {
  getConversations,
  getConversationById,
  sendChatMessage,
  createConversation,
} = require("../controllers/aiController");

const router = express.Router();

router.use(authenticate);

router.get("/conversations", getConversations);
router.get("/conversations/:id", getConversationById);
router.post("/chat", sendChatMessage);
router.post("/conversations", createConversation);

// router.get("/health", getAIHealth);

module.exports = router;
