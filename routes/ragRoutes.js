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
const validate = require("../middleware/validate");
const {
  ragDocumentIdValidation,
  searchRAGValidation,
  uploadDocumentValidation,
} = require("../validators/ragValidators");
const router = express.Router();

// console.log("[RAG ROUTES] searchRAG:", typeof searchRAG);
// console.log("[RAG ROUTES] uploadDocument:", typeof uploadDocument);
// console.log("[RAG ROUTES] authenticate:", typeof authenticate);

router.get(
  "/documents/:id/full-text",
  authenticate,
  ragDocumentIdValidation,
  validate,
  getDocumentFullText,
);
router.post("/search", authenticate, searchRAGValidation, validate, searchRAG);
router.post("/extract", authenticate, upload.single("file"), extractDocument);
router.post(
  "/documents",
  authenticate,
  uploadDocumentValidation,
  validate,
  uploadDocument,
);
router.get("/documents", authenticate, listDocuments);
router.delete(
  "/documents/:id",
  authenticate,
  ragDocumentIdValidation,
  validate,
  deleteDocument,
);

module.exports = router;
