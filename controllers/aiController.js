const ChatConversation = require("../models/ChatConversation");
const ActivityLog = require("../models/ActivityLog");

function titleFromPrompt(prompt) {
  const trimmed = prompt.trim();
  return trimmed.length > 40 ? `${trimmed.slice(0, 37)}...` : trimmed;
}
async function getConversations(req, res, next) {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const filter = {
      user: req.user.id,
    };
    const [conversations, total] = await Promise.all([
      ChatConversation.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("title updatedAt createdAt")
        .lean(),
      ChatConversation.countDocuments(filter),
    ]);
    const totalPages = Math.ceil(total / limit);
    res.status(200).json({
      success: true,
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function getConversationById(req, res, next) {
  try {
    const { id } = req.params;
    const conversation = await ChatConversation.findOne({
      _id: id,
      user: req.user.id,
    });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation not found.",
      });
    }
    return res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

async function sendChatMessage(req, res, next) {
  try {
    const {
      prompt,
      conversationId,
      assistantResponse,
      assistantStatus = "completed",
    } = req.body;
    const conversation = await ChatConversation.findOne({
      _id: conversationId,
      user: req.user.id,
    });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation not found.",
      });
    }
    const lastMessage = conversation.messages.at(-1);
    const responseContent =
      typeof assistantResponse === "string"
        ? assistantResponse.trim()
        : "AI failed to generate a response.";

    if (assistantStatus === "pending") {
      conversation.messages.push({
        role: "user",
        content: prompt,
        status: "completed",
      });
      conversation.messages.push({
        role: "assistant",
        content: "AI response pending...",
        status: "pending",
      });
    } else if (
      lastMessage?.role === "assistant" &&
      lastMessage.status === "pending"
    ) {
      lastMessage.content =
        responseContent || "AI failed to generate a response.";
      lastMessage.status =
        assistantStatus === "failed" ? "failed" : "completed";
    } else {
      conversation.messages.push({
        role: "user",
        content: prompt,
        status: "completed",
      });
      conversation.messages.push({
        role: "assistant",
        content: responseContent || "AI failed to generate a response.",
        status: assistantStatus === "failed" ? "failed" : "completed",
      });
    }
    if (!conversation.title || conversation.title === "New Chat") {
      conversation.title = titleFromPrompt(prompt);
    }
    conversation.updatedAt = new Date();
    await conversation.save();
    await ActivityLog.create({
      user: req.user.id,
      type: "usage",
      action: "chat_with_ai",
    });
    return res.status(200).json({
      success: true,
      data: {
        conversation,
        assistantResponse,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function createConversation(req, res, next) {
  try {
    const conversation = await ChatConversation.create({
      user: req.user.id,
      title: "New Chat",
      messages: [],
    });
    return res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
}

const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await ChatConversation.findOneAndDelete({
      _id: id,
      user: req.user.id,
    });
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found.",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Conversation deleted successfully.",
      conversationId: id,
    });
  } catch (error) {
    console.error("[CHAT] Delete conversation error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to delete conversation.",
    });
  }
};

module.exports = {
  getConversations,
  getConversationById,
  sendChatMessage,
  createConversation,
  deleteConversation,
};
