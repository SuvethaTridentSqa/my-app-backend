const RagChunk = require("../models/RagChunk");

const EMBEDDING_DIMENSIONS = 384;

function cosineSimilarity(vectorA, vectorB) {
  if (
    !Array.isArray(vectorA) ||
    !Array.isArray(vectorB) ||
    vectorA.length !== vectorB.length ||
    vectorA.length === 0
  ) {
    return 0;
  }
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    const a = Number(vectorA[i]);
    const b = Number(vectorB[i]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return 0;
    }
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

exports.searchSimilarChunks = async ({
  embedding,
  userId,
  limit = 5,
  documentId,
}) => {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array.");
  }
  const filter = {
    user: userId,
    embedding: { $exists: true, $type: "array" },
  };
  if (documentId) {
    filter.document = documentId;
  }
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid embedding dimensions. Expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}.`,
    );
  }

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const chunks = await RagChunk.find(filter)
    .select("text document metadata chunkIndex embedding")
    .lean();
  // console.log(`[RAG] Loaded ${chunks.length} chunks for similarity search.`);
  const results = chunks
    .map((chunk) => {
      const score = cosineSimilarity(embedding, chunk.embedding);
      return {
        text: chunk.text,
        document: chunk.document,
        metadata: chunk.metadata,
        chunkIndex: chunk.chunkIndex,
        score,
      };
    })
    .filter((chunk) => Number.isFinite(chunk.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit);
  return results;
};

const RagDocument = require("../models/RagDocument");

exports.createRagDocument = async ({ userId, title, fileName, chunks }) => {
  const invalidChunk = chunks.find(
    (chunk) =>
      typeof chunk.text !== "string" ||
      !Array.isArray(chunk.embedding) ||
      chunk.embedding.length !== EMBEDDING_DIMENSIONS,
  );
  if (invalidChunk) {
    throw new Error("One or more chunks are missing valid text or embedding.");
  }
  const document = await RagDocument.create({
    user: userId,
    title,
    fileName,
    source: "upload",
    content: chunks.map((c) => c.text).join("\n\n"),
  });
  const chunkDocs = chunks.map((chunk, index) => ({
    document: document._id,
    user: userId,
    text: chunk.text,
    embedding: chunk.embedding,
    chunkIndex: chunk.chunkIndex ?? index,
    metadata: chunk.metadata || {},
  }));

  await RagChunk.insertMany(chunkDocs);

  return document;
};

exports.getFullDocumentText = async ({ documentId, userId }) => {
  const chunks = await RagChunk.find({ document: documentId, user: userId })
    .sort({ chunkIndex: 1 })
    .select("text")
    .lean();
  return chunks.map((c) => c.text).join(" ");
};

exports.deleteRagDocument = async ({ documentId, userId }) => {
  const RagDocument = require("../models/RagDocument");
  const document = await RagDocument.findOne({ _id: documentId, user: userId });
  if (!document) {
    return null;
  }
  await RagChunk.deleteMany({ document: documentId, user: userId });
  await RagDocument.deleteOne({ _id: documentId });
  return document;
};
