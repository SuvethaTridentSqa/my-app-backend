// services/ragService.js

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

exports.searchSimilarChunks = async ({ embedding, userId, limit = 5 }) => {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array.");
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

  const chunks = await RagChunk.find({
    user: userId,
    embedding: {
      $exists: true,
      $type: "array",
    },
  })
    .select("text document metadata chunkIndex embedding")
    .lean();

  console.log(`[RAG] Loaded ${chunks.length} chunks for similarity search.`);

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

  console.log(
    "[RAG] Top similarity scores:",
    results.map((result) => result.score),
  );

  return results;
};
