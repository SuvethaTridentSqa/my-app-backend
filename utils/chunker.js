function chunkText(text, { chunkSize = 600, overlap = 0 } = {}) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const words = cleaned.split(" ");
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    const chunkWords = words.slice(start, end);
    chunks.push({
      text: chunkWords.join(" "),
      chunkIndex: index,
    });
    index += 1;
    if (end === words.length) break;
    start = end - overlap;
  }

  return chunks;
}

module.exports = { chunkText };
