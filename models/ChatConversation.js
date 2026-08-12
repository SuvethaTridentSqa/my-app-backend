const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: { type: String, required: true },
  },
  { timestamps: true },
);

const ChatConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "New Conversation" },
    // messages: { type: [MessageSchema], default: [] },
    messages: [
      {
        role: {
          type: String,
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["completed", "failed"],
          default: "completed",
        },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("ChatConversation", ChatConversationSchema);
