const express = require("express");
const {
  searchRAG,
  uploadDocument,
  extractDocument,
  getDocumentFullText,
  listDocuments,
  deleteDocument,
} = require("../controllers/ragController");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");
const router = express.Router();

// console.log("[RAG ROUTES] searchRAG:", typeof searchRAG);
// console.log("[RAG ROUTES] uploadDocument:", typeof uploadDocument);
// console.log("[RAG ROUTES] authenticate:", typeof authenticate);

router.get("/documents/:id/full-text", authenticate, getDocumentFullText);
router.post("/search", authenticate, searchRAG);
router.post("/extract", authenticate, upload.single("file"), extractDocument);
router.post("/documents", authenticate, uploadDocument);
router.get("/documents", authenticate, listDocuments);
router.delete("/documents/:id", authenticate, deleteDocument);

module.exports = router;
