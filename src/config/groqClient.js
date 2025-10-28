const { GoogleGenerativeAI } = require("@google/generative-ai");

// API key rotation configuration for Google Gemini
const API_KEYS = [
  process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY,
].filter((key) => key && key.trim() !== "");

let currentKeyIndex = 0;
let requestCount = 0;

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the current API key
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
  const oldIndex = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(
    `🔄 Rotating API key ${oldIndex + 1} → ${
      currentKeyIndex + 1
    } (Total keys: ${API_KEYS.length})`
  );
}

/**
 * Create a new Gemini client with the current API key
 */
function createGeminiClient() {
  return new GoogleGenerativeAI(getCurrentApiKey());
}

/**
 * Check if error requires API key rotation
 */
function shouldRotateKey(errorMsg) {
  const rotationTriggers = [
    "401", // Unauthorized
    "403", // Forbidden
    "429", // Rate limit
    "quota",
    "rate limit",
    "authentication",
    "api key",
  ];

  return rotationTriggers.some((trigger) =>
    errorMsg.toLowerCase().includes(trigger)
  );
}

/**
 * Execute a function with automatic API key rotation on specific errors
 * @param {Function} fn - Function to execute
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the function
 */
async function executeWithRotation(fn, maxRetries = 5) {
  let lastError;
  let attemptsSameKey = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const client = createGeminiClient();
      const result = await fn(client);

      // Success - reset counter for this key
      attemptsSameKey = 0;
      return result;
    } catch (error) {
      lastError = error;
      const errorMsg = error.message?.toLowerCase() || "";

      console.error(
        `❌ Error with API key ${currentKeyIndex + 1} (Attempt ${
          attempt + 1
        }/${maxRetries}):`,
        error.message
      );

      // Check if it's a retryable error
      const isRetryable =
        errorMsg.includes("503") ||
        errorMsg.includes("overloaded") ||
        errorMsg.includes("timeout") ||
        errorMsg.includes("network") ||
        errorMsg.includes("fetch failed") ||
        shouldRotateKey(errorMsg);

      if (!isRetryable) {
        console.error("❌ Non-retryable error - stopping");
        throw error;
      }

      // Only rotate if error is API-key specific
      if (shouldRotateKey(errorMsg) && API_KEYS.length > 1) {
        console.log(`🔑 API key error detected - rotating key`);
        rotateApiKey();
        attemptsSameKey = 0; // Reset counter after rotation
      } else {
        attemptsSameKey++;
        console.log(
          `⚠️ Service error (not key-specific) - retrying with same key`
        );
      }

      // If last attempt, throw error
      if (attempt === maxRetries - 1) {
        throw new Error(
          `Max retries (${maxRetries}) reached. Last error: ${lastError.message}`
        );
      }

      // Exponential backoff with jitter
      const baseDelay = Math.min(1000 * Math.pow(2, attemptsSameKey), 30000); // Max 30 seconds
      const jitter = Math.random() * 1000; // Add up to 1 second jitter
      const delay = baseDelay + jitter;

      console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before retry...`);
      await sleep(delay);
    }
  }

  throw new Error(
    `Max retries (${maxRetries}) reached. Last error: ${lastError.message}`
  );
}

const MODEL = "gemini-2.5-flash";

/**
 * Wrapper for Gemini API that handles rotation
 */
const gemini = {
  chat: {
    completions: {
      create: async (params) => {
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

          console.log(
            `🔍 API Request #${requestCount} - Model: ${geminiModel}, Key: ${
              currentKeyIndex + 1
            }/${API_KEYS.length}, Prompt: ${prompt.length} chars`
          );

          const maxOutputTokens = max_tokens || 65536;

          // Timeout based on prompt size (larger prompts need more time)
          const timeoutMs = prompt.length > 50000 ? 180000 : 120000; // 3 min for large, 2 min for normal
          console.log(`⏱️ Request timeout set to ${timeoutMs / 1000}s`);

          // Generate content with safety settings disabled and adaptive timeout
          const result = await Promise.race([
            genModel.generateContent({
              contents: [
                {
                  role: "user",
                  parts: [{ text: prompt }],
                },
              ],
              generationConfig: {
                temperature: temperature || 0.7,
                maxOutputTokens: maxOutputTokens,
              },
              safetySettings: [
                {
                  category: "HARM_CATEGORY_HARASSMENT",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_HATE_SPEECH",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                  threshold: "BLOCK_NONE",
                },
                {
                  category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                  threshold: "BLOCK_NONE",
                },
              ],
            }),
            // Adaptive timeout
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Request timeout after ${timeoutMs / 1000} seconds`
                    )
                  ),
                timeoutMs
              )
            ),
          ]);

          const response = result.response;

          // Check if response was blocked
          if (response.promptFeedback?.blockReason) {
            console.error("❌ Response blocked:", response.promptFeedback);
            throw new Error(
              `Content blocked: ${response.promptFeedback.blockReason}`
            );
          }

          // Get candidates
          const candidates = response.candidates;
          if (!candidates || candidates.length === 0) {
            console.error("❌ No candidates in response");
            throw new Error("No response candidates generated");
          }

          // Check finish reason
          const candidate = candidates[0];
          if (candidate.finishReason === "MAX_TOKENS") {
            console.warn(`⚠️ Response truncated due to MAX_TOKENS limit`);
          } else if (
            candidate.finishReason &&
            candidate.finishReason !== "STOP"
          ) {
            console.warn(`⚠️ Unusual finish reason: ${candidate.finishReason}`);
          }

          // Get text from the response
          let text = "";
          try {
            text = response.text();
          } catch (error) {
            console.error("❌ Error extracting text:", error.message);
            if (candidate.content && candidate.content.parts) {
              text = candidate.content.parts
                .map((part) => part.text || "")
                .join("");
            }
          }

          // Handle MAX_TOKENS case
          if (
            (!text || text.trim().length === 0) &&
            candidate.finishReason === "MAX_TOKENS"
          ) {
            console.log(
              "🔍 Trying to extract partial response from MAX_TOKENS..."
            );
            if (candidate.content && candidate.content.parts) {
              text = candidate.content.parts
                .map((part) => part.text || "")
                .join("");
              console.log(`✓ Extracted ${text.length} characters from parts`);
            }

            if (!text || text.trim().length === 0) {
              throw new Error(
                `MAX_TOKENS limit too restrictive. Requested tokens: ${maxOutputTokens}`
              );
            }
          }

          if (!text || text.trim().length === 0) {
            console.error("❌ Empty text in response");
            throw new Error(
              `Empty response text (finish reason: ${candidate.finishReason})`
            );
          }

          console.log(`✓ API Response received: ${text.length} characters`);

          return {
            choices: [
              {
                message: {
                  content: text,
                },
              },
            ],
          };
        }, 5); // 5 retries with smart backoff
      },
    },
  },
};

console.log(
  `✅ Google Gemini client initialized with ${API_KEYS.length} API key(s)`
);
console.log(`🤖 Using model: ${MODEL}`);
console.log(`📊 Max output tokens: 65,536`);
console.log(
  `🔄 Smart retry: Rotates keys only on API key errors (401/403/429)`
);
console.log(`⏱️ Adaptive timeout: 2min (normal) / 3min (large prompts)`);

module.exports = { gemini, MODEL, getCurrentApiKey, rotateApiKey };
