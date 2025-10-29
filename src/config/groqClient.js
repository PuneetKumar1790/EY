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
 * Execute a function with automatic API key rotation ON EVERY ERROR
 * @param {Function} fn - Function to execute
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the function
 */
async function executeWithRotation(fn, maxRetries = API_KEYS.length * 3) {
  let lastError;
  const attemptedKeys = new Set();

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

      // Success - return immediately
      console.log(`✅ Request successful with API key ${currentKeyIndex + 1}`);
      attemptedKeys.clear();
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

      // Track which keys we've tried
      attemptedKeys.add(currentKeyIndex);

      // If we've tried all keys, throw error
      if (attemptedKeys.size >= API_KEYS.length && API_KEYS.length > 1) {
        console.error(
          `❌ All ${API_KEYS.length} API keys have been tried and failed`
        );
        throw new Error(
          `All API keys exhausted. Last error: ${lastError.message}`
        );
      }

      // If last attempt, throw error
      if (attempt === maxRetries - 1) {
        throw new Error(
          `Max retries (${maxRetries}) reached. Last error: ${lastError.message}`
        );
      }

      // ROTATE ON EVERY ERROR (this is the key change)
      if (API_KEYS.length > 1) {
        console.log(`🔄 Error detected - rotating to next API key`);
        rotateApiKey();

        // Short delay after key rotation to avoid rate limits
        await sleep(1000);
        continue;
      }

      // If only one key, use exponential backoff
      const backoffDelay = Math.min(2000 * Math.pow(2, attempt), 30000);
      const jitter = Math.random() * 1000;
      const delay = backoffDelay + jitter;

      console.log(
        `⏳ Only 1 API key available. Waiting ${(delay / 1000).toFixed(
          1
        )}s before retry...`
      );
      await sleep(delay);
    }
  }

  throw new Error(
    `Max retries (${maxRetries}) reached. Last error: ${lastError.message}`
  );
}

const MODEL = "gemini-2.5-flash";

/**
 * Wrapper for Gemini API that handles rotation ON EVERY ERROR
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
          const timeoutMs = prompt.length > 50000 ? 420000 : 420000; // 7 minutes

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
        }, API_KEYS.length * 3); // Max retries = 3x number of keys
      },
    },
  },
};

console.log(
  `✅ Google Gemini client initialized with ${API_KEYS.length} API key(s)`
);
console.log(`🤖 Using model: ${MODEL}`);
console.log(`📊 Default max output tokens: 65,536`);
console.log(`🔄 AGGRESSIVE ROTATION: Switches to next key on EVERY error`);
console.log(`⏱️ Adaptive timeout: 7 minutes for all prompts`);
console.log(`🔑 Max retries: ${API_KEYS.length * 3} attempts`);

module.exports = { gemini, MODEL, getCurrentApiKey, rotateApiKey };
