const ragService = require("../services/ragService");
exports.searchRAG = async (req, res, next) => {
  try {
    const { query, embedding, limit = 5 } = req.body;
    if (!query && !embedding) {
      return res.status(400).json({
        success: false,
        code: "RAG_INPUT_MISSING",
        message: "Query or embedding is required.",
      });
    }
    const safeLimit = Math.min(Number(limit) || 5, 20);
    const results = await ragService.searchSimilarChunks({
      embedding,
      userId: req.user._id,
      limit: safeLimit,
    });
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    const { title, fileName, chunks } = req.body;
    const document = await ragService.createRagDocument({
      userId: req.user._id,
      title,
      fileName,
      chunks,
    });
    return res.status(201).json({
      success: true,
      message: "Document indexed successfully.",
      data: document,
    });
  } catch (error) {
    next(error);
  }
};
