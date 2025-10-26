const { GoogleGenerativeAI } = require("@google/generative-ai");

// API key rotation configuration for Google Gemini
const API_KEYS = [
  process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY,
].filter((key) => key && key.trim() !== "");

let currentKeyIndex = 0;
let requestCount = 0;

/**
 * Get the current API key
 * @returns {string} Current API key
 */
function getCurrentApiKey() {
  if (API_KEYS.length === 0) {
    throw new Error(
      "No Gemini API keys configured. Please set GEMINI_API_KEY_1 and GEMINI_API_KEY_2 in .env"
    );
  }
  return API_KEYS[currentKeyIndex];
}

/**
 * Rotate to the next API key
 */
function rotateApiKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  requestCount++;
  console.log(
    `🔄 Rotating to Gemini API key ${currentKeyIndex + 1}/${
      API_KEYS.length
    } (Request #${requestCount})`
  );
}

/**
 * Create a new Gemini client with the current API key
 * @returns {GoogleGenerativeAI} Gemini client instance
 */
function createGeminiClient() {
  return new GoogleGenerativeAI(getCurrentApiKey());
}

/**
 * Execute a function with automatic API key rotation on error
 * @param {Function} fn - Function to execute
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the function
 */
async function executeWithRotation(fn, maxRetries = 2) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const client = createGeminiClient();
      return await fn(client);
    } catch (error) {
      console.error(
        `❌ Error with Gemini API key ${currentKeyIndex + 1}:`,
        error.message
      );

      // If it's a rate limit error or authentication error, rotate keys
      const errorMsg = error.message?.toLowerCase() || "";
      if (
        errorMsg.includes("rate limit") ||
        errorMsg.includes("quota") ||
        errorMsg.includes("429") ||
        errorMsg.includes("401") ||
        errorMsg.includes("403") ||
        errorMsg.includes("authentication") ||
        attempt < maxRetries - 1
      ) {
        rotateApiKey();
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries reached for Gemini API key rotation");
}

// Automatic rotation every N requests (optional)
const ROTATION_INTERVAL = 50;

function shouldRotateAutomatically() {
  if (
    requestCount > 0 &&
    requestCount % ROTATION_INTERVAL === 0 &&
    API_KEYS.length > 1
  ) {
    rotateApiKey();
  }
}

// ✅ Fixed model name (v1-compatible)
const MODEL = "gemini-2.5-flash"; // updated from gemini-1.5-flash

/**
 * Wrapper for Gemini API that handles rotation
 * Provides a chat interface compatible with the existing code
 */
const gemini = {
  chat: {
    completions: {
      create: async (params) => {
        shouldRotateAutomatically();
        requestCount++;

        return await executeWithRotation(async (client) => {
          const { messages, model, temperature, max_tokens } = params;

          const geminiModel = model || MODEL;
          const genModel = client.getGenerativeModel({ model: geminiModel });

          // Convert messages format
          const systemInstructions = messages
            .filter((msg) => msg.role === "system")
            .map((msg) => msg.content)
            .join("\n");

          const userMessages = messages
            .filter((msg) => msg.role === "user")
            .map((msg) => msg.content)
            .join("\n");

          const prompt = systemInstructions
            ? `${systemInstructions}\n\n${userMessages}`
            : userMessages;

          // ✅ Corrected API call for v1 (moved generationConfig here)
          const result = await genModel.generateContent({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: temperature || 0.7,
              maxOutputTokens: max_tokens || 8192,
            },
          });

          const response = result.response;
          const text = response.text();

          return {
            choices: [
              {
                message: {
                  content: text,
                },
              },
            ],
          };
        });
      },
    },
  },
};

console.log(
  `✅ Google Gemini client initialized with ${API_KEYS.length} API key(s)`
);
console.log(`🔄 API key rotation: Every ${ROTATION_INTERVAL} requests`);
console.log(`🤖 Using model: ${MODEL}`);

module.exports = { gemini, MODEL, getCurrentApiKey, rotateApiKey };
