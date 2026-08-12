const ChatConversation = require("../models/ChatConversation");
function titleFromPrompt(prompt) {
  const trimmed = prompt.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 37)}...` : trimmed;
}
async function getConversations(req, res) {
  try {
    const conversations = await ChatConversation.find({
      user: req.user.id,
    })
      .sort({ updatedAt: -1 })
      .select("title updatedAt createdAt messages");

    res.json({ conversations });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load conversations.",
      error: error.message,
    });
  }
}

async function getConversationById(req, res) {
  try {
    const { id } = req.params;

    const conversation = await ChatConversation.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found.",
      });
    }

    res.json({ conversation });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load conversation.",
      error: error.message,
    });
  }
}

async function sendChatMessage(req, res) {
  try {
    const {
      prompt,
      conversationId,
      assistantResponse,
      assistantStatus = "completed",
    } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        message: "Prompt text is required.",
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        message: "Conversation ID is required.",
      });
    }

    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      user: req.user.id,
    });

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found.",
      });
    }

    conversation.messages.push({
      role: "user",
      content: prompt.trim(),
      status: "completed",
    });

    conversation.messages.push({
      role: "assistant",
      content:
        typeof assistantResponse === "string"
          ? assistantResponse.trim()
          : "AI failed to generate a response.",
      status: assistantStatus === "failed" ? "failed" : "completed",
    });

    if (!conversation.title || conversation.title === "New Chat") {
      conversation.title = titleFromPrompt(prompt);
    }

    conversation.updatedAt = new Date();

    await conversation.save();

    res.status(201).json({
      conversation,
      assistantResponse,
    });
  } catch (error) {
    console.error("AI chat save failed:", error);

    res.status(500).json({
      message: "Failed to save chat.",
      error: error.message,
    });
  }
}

async function getAIHealth(req, res) {
  try {
    const result = await checkAIHealth();

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "AI service unavailable.",
      error: error.message,
    });
  }
}

async function createConversation(req, res) {
  try {
    const conversation = await ChatConversation.create({
      user: req.user.id,
      title: "New Chat",
      messages: [],
    });

    res.status(201).json({
      conversation,
    });
  } catch (error) {
    console.error("Create conversation failed:", error);

    res.status(500).json({
      message: "Failed to create conversation.",
      error: error.message,
    });
  }
}

module.exports = {
  getConversations,
  getConversationById,
  sendChatMessage,
  createConversation,
};
