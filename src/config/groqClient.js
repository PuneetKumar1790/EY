const { GoogleGenerativeAI } = require("@google/generative-ai");

// API key rotation configuration for Google Gemini - SUPPORTS 4 KEYS
const API_KEYS = [
  process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
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
      "No Gemini API keys configured. Please set GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3, and GEMINI_API_KEY_4 in .env"
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
    "invalid api key",
    "api_key_invalid",
  ];

  return rotationTriggers.some((trigger) =>
    errorMsg.toLowerCase().includes(trigger)
  );
}

/**
 * Execute a function with automatic API key rotation ONLY on errors
 * @param {Function} fn - Function to execute
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the function
 */
async function executeWithRotation(fn, maxRetries = API_KEYS.length * 2) {
  let lastError;
  let consecutiveFailures = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const client = createGeminiClient();

      console.log(
        `🔑 Using API key ${currentKeyIndex + 1}/${API_KEYS.length} (Attempt ${
          attempt + 1
        }/${maxRetries})`
      );

      // Execute the function and WAIT for completion
      const result = await fn(client);

      // Success - reset failure counter and return immediately
      consecutiveFailures = 0;
      console.log(`✅ Request successful with API key ${currentKeyIndex + 1}`);
      return result;
    } catch (error) {
      lastError = error;
      consecutiveFailures++;
      const errorMsg = error.message?.toLowerCase() || "";

      console.error(
        `❌ Error with API key ${currentKeyIndex + 1} (Attempt ${
          attempt + 1
        }/${maxRetries}):`,
        error.message
      );

      // Check if it's a retryable error
      const isKeyError = shouldRotateKey(errorMsg);
      const isServiceError =
        errorMsg.includes("503") ||
        errorMsg.includes("overloaded") ||
        errorMsg.includes("timeout") ||
        errorMsg.includes("network") ||
        errorMsg.includes("fetch failed");

      // Non-retryable errors - stop immediately
      if (!isKeyError && !isServiceError) {
        console.error("❌ Non-retryable error - stopping immediately");
        throw error;
      }

      // Rotate key ONLY if it's an API key specific error
      if (isKeyError && API_KEYS.length > 1) {
        console.log(`🔑 API key error detected - rotating to next key`);
        rotateApiKey();
        consecutiveFailures = 0; // Reset after rotation

        // Short delay after key rotation
        await sleep(500);
        continue;
      }

      // For service errors, retry with same key after backoff
      if (isServiceError) {
        console.log(
          `⚠️ Service/network error - retrying with same key after backoff`
        );
      }

      // If last attempt, throw error
      if (attempt === maxRetries - 1) {
        throw new Error(
          `Max retries (${maxRetries}) reached. Last error: ${lastError.message}`
        );
      }

      // Exponential backoff with jitter for service errors
      const baseDelay = Math.min(
        1000 * Math.pow(2, consecutiveFailures),
        30000
      );
      const jitter = Math.random() * 1000;
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
 * Wrapper for Gemini API that handles rotation ONLY on errors
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

          // INCREASED: Default max output tokens to handle longer responses
          const maxOutputTokens = max_tokens || 65536;

          // Adaptive timeout based on prompt size
          const timeoutMs = prompt.length > 50000 ? 420000 : 420000; // 7 minutes for all prompts
          console.log(`⏱️ Request timeout set to ${timeoutMs / 1000}s`);
          console.log(`📊 Max output tokens: ${maxOutputTokens}`);

          // Generate content with timeout
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
            console.warn(
              `⚠️ Response truncated due to MAX_TOKENS limit (limit: ${maxOutputTokens})`
            );
            console.warn(
              `⚠️ Consider increasing max_tokens in the request or simplifying the prompt`
            );
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

          // Handle MAX_TOKENS case - still return partial response
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
        }, API_KEYS.length * 2); // Max retries = 2x number of keys
      },
    },
  },
};

console.log(
  `✅ Google Gemini client initialized with ${API_KEYS.length} API key(s)`
);
console.log(`🤖 Using model: ${MODEL}`);
console.log(`📊 Default max output tokens: 65,536`);
console.log(
  `🔄 Smart rotation: Rotates keys ONLY on API key errors (401/403/429)`
);
console.log(`⏱️ Sticky keys: Waits for completion on each key before rotating`);
console.log(`⏱️ Adaptive timeout: 2min (normal) / 3min (large prompts)`);

module.exports = { gemini, MODEL, getCurrentApiKey, rotateApiKey };
