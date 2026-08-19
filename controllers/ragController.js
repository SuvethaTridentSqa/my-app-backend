const ragService = require("../services/ragService");
const { authenticate } = require("../middleware/auth");
const EMBEDDING_DIMENSIONS = 384;
// SEARCH RAG
exports.searchRAG = async (req, res) => {
  try {
    const { query, embedding, limit = 5 } = req.body;

    if (!req.user?._id) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    if (!query && !embedding) {
      return res.status(400).json({
        message: "Query or embedding is required.",
      });
    }

    if (!Array.isArray(embedding)) {
      return res.status(400).json({
        message: "Embedding must be an array.",
      });
    }

    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      return res.status(400).json({
        message: `Invalid embedding dimensions. Expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}.`,
      });
    }

    const invalidEmbedding = embedding.some(
      (value) => typeof value !== "number" || !Number.isFinite(value),
    );

    if (invalidEmbedding) {
      return res.status(400).json({
        message: "Embedding contains invalid numeric values.",
      });
    }

    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({
        message: "Limit must be a positive integer.",
      });
    }

    const safeLimit = Math.min(parsedLimit, 20);
    const results = await ragService.searchSimilarChunks({
      embedding,
      userId: req.user._id,
      limit: safeLimit,
    });
    // console.log("[RAG] Results:", results.length);

    return res.status(200).json({
      results,
    });
  } catch (error) {
    // console.error("[RAG] SEARCH ERROR");
    console.error("Message:", error.message);
    // console.error("Stack:", error.stack);

    return res.status(500).json({
      message: "RAG search failed.",
      error: error.message,
    });
  }
};

// UPLOAD / INDEX DOCUMENT
exports.uploadDocument = async (req, res) => {
  try {
    const { title, fileName, chunks } = req.body;

    // Authentication
    if (!req.user?._id) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // Validation
    if (!title || !Array.isArray(chunks)) {
      return res.status(400).json({
        message: "Invalid document data.",
      });
    }
    if (chunks.length === 0) {
      return res.status(400).json({
        message: "At least one chunk is required.",
      });
    }

    // Create document
    const document = await ragService.createRagDocument({
      userId: req.user._id,
      title,
      fileName,
      chunks,
    });

    return res.status(201).json({
      message: "Document indexed successfully.",
      document,
    });
  } catch (error) {
    // console.error("[RAG] Document indexing error:");
    console.error("Error at Creating a document", error);

    return res.status(500).json({
      message: "Document indexing failed.",
      error: error.message,
    });
  }
};
