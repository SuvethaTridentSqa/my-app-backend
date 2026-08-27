const express = require("express");
const { searchRAG, uploadDocument } = require("../controllers/ragController");
const { authenticate } = require("../middleware/auth");
const validate = require("../middleware/validate");
const {
  searchRAGValidation,
  uploadDocumentValidation,
} = require("../validators/ragValidators");

const router = express.Router();
router.post("/search", authenticate, searchRAGValidation, validate, searchRAG);
router.post(
  "/documents",
  authenticate,
  uploadDocumentValidation,
  validate,
  uploadDocument,
);

module.exports = router;
