const ragService = require("../services/ragService");
const { extractText } = require("../utils/textExtractor");
const { chunkText } = require("../utils/chunker");

exports.searchRAG = async (req, res) => {
  try {
    const { query, embedding, limit = 5, documentId } = req.body;
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
      userId: req.user.id,
      limit: safeLimit,
      documentId,
    });
    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const { title, fileName, chunks } = req.body;
    if (!req.user?._id) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (!title || !Array.isArray(chunks)) {
      return res.status(400).json({ message: "Invalid document data." });
    }
    if (chunks.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one chunk is required." });
    }

    const RagDocument = require("../models/RagDocument");
    const RagChunk = require("../models/RagChunk");
    const existing = await RagDocument.findOne({
      user: req.user._id,
      title,
    });

    if (existing) {
      await RagChunk.deleteMany({ document: existing._id });
      await RagDocument.deleteOne({ _id: existing._id });
    }

    const document = await ragService.createRagDocument({
      userId: req.user.id,
      title,
      fileName,
      chunks,
    });

    return res.status(201).json({
      message: existing
        ? "Existing document replaced with new upload."
        : "Document indexed successfully.",
      document,
    });
  } catch (error) {
    console.error("Error at Creating a document", error);
    return res.status(500).json({
      message: "Document indexing failed.",
      error: error.message,
    });
  }
};

exports.extractDocument = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Authentication required." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No file was uploaded." });
    }
    const rawText = await extractText(req.file);
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({
        message: "No readable text could be extracted from this file.",
      });
    }
    const chunks = chunkText(rawText, { chunkSize: 80, overlap: 20 }).map(
      (chunk) => ({
        ...chunk,
        metadata: {
          fileName: req.file.originalname,
          source: "upload",
        },
      }),
    );

    return res.status(200).json({
      title: req.file.originalname,
      fileName: req.file.originalname,
      chunks,
    });
  } catch (error) {
    console.error("Document extraction failed:", error.message);
    return res.status(500).json({
      message: "Failed to extract document text.",
      error: error.message,
    });
  }
};

exports.getDocumentFullText = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Authentication required." });
    }
    const text = await ragService.getFullDocumentText({
      documentId: req.params.id,
      userId: req.user._id,
    });
    return res.status(200).json({ success: true, data: { text } });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to load document.", error: error.message });
  }
};

exports.listDocuments = async (req, res) => {
  try {
    if (!req.user?._id)
      return res.status(401).json({ message: "Authentication required." });
    const RagDocument = require("../models/RagDocument");
    const documents = await RagDocument.find({ user: req.user._id })
      .select("title fileName createdAt")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to load documents.", error: error.message });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({ message: "Authentication required." });
    }
    const deleted = await ragService.deleteRagDocument({
      documentId: req.params.id,
      userId: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Document not found." });
    }
    return res.status(200).json({
      success: true,
      message: "Document deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete document.",
      error: error.message,
    });
  }
};
