const axios = require("axios");

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gpt-4o-mini";

async function sendMessageToOllama(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("AI request requires at least one message.");
  }

  const payload = {
    model: OLLAMA_MODEL,
    messages,
  };

  const response = await axios.post(
    `${OLLAMA_URL}/v1/chat/completions`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 120000,
    },
  );

  if (!response?.data?.choices?.length) {
    throw new Error("AI provider did not return a valid response.");
  }

  const assistantMessage = response.data.choices[0].message?.content || "";
  return assistantMessage;
}
async function checkAIHealth() {
  const response = await fetch("http://127.0.0.1:11434/api/tags");

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  return {
    provider: "ollama",
    available: true,
  };
}

module.exports = { sendMessageToOllama, checkAIHealth };
