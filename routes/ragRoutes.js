const express = require("express");
const { searchRAG, uploadDocument } = require("../controllers/ragController");
const { authenticate } = require("../middleware/auth");
const router = express.Router();

// console.log("[RAG ROUTES] searchRAG:", typeof searchRAG);
// console.log("[RAG ROUTES] uploadDocument:", typeof uploadDocument);
// console.log("[RAG ROUTES] authenticate:", typeof authenticate);

router.post("/search", authenticate, searchRAG);
router.post("/documents", authenticate, uploadDocument);

module.exports = router;
