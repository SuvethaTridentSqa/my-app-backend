const mongoose = require("mongoose");

const RagChunkSchema = new mongoose.Schema(
  {
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RagDocument",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    text: {
      type: String,
      required: true,
    },

    embedding: {
      type: [Number],
      required: true,
    },

    chunkIndex: {
      type: Number,
      required: true,
    },

    metadata: {
      page: Number,
      source: String,
      fileName: String,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("RagChunk", RagChunkSchema);