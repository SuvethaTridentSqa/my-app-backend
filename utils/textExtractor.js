const pdfParseModule = require("pdf-parse");
const pdfParse =
  typeof pdfParseModule === "function"
    ? pdfParseModule
    : pdfParseModule.default;

const mammoth = require("mammoth");

async function extractText(file) {
  const { mimetype, buffer, originalname } = file;

  if (mimetype === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (mimetype === "application/pdf") {
    if (typeof pdfParse !== "function") {
      throw new Error(
        "PDF parser failed to load correctly. Try reinstalling pdf-parse.",
      );
    }
    const result = await pdfParse(buffer);
    return result.text;
  }

  if (
    mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Cannot extract text from file: ${originalname}`);
}

module.exports = { extractText };
