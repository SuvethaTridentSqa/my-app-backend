const mongoose = require("mongoose");

const RagDocumentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    source: {
      type: String,
      default: "upload",
    },

    fileName: {
      type: String,
    },

    mimeType: {
      type: String,
    },

    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("RagDocument", RagDocumentSchema);