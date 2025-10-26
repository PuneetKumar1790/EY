require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listAvailableModels() {
  try {
    const apiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("❌ No API key found. Set GEMINI_API_KEY in .env");
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    console.log("🔍 Fetching available Gemini models...\n");

    // Try to list models
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    const data = await response.json();

    if (data.models) {
      console.log("✅ Available models:");
      console.log("=".repeat(80));

      data.models.forEach((model) => {
        console.log(`\n📦 Model: ${model.name}`);
        console.log(`   Display Name: ${model.displayName}`);
        console.log(`   Description: ${model.description}`);
        console.log(
          `   Supported Methods: ${model.supportedGenerationMethods?.join(
            ", "
          )}`
        );
        console.log(`   Input Token Limit: ${model.inputTokenLimit}`);
        console.log(`   Output Token Limit: ${model.outputTokenLimit}`);
      });

      console.log("\n" + "=".repeat(80));
      console.log("\n💡 Recommended models for your use case:");

      const recommendedModels = data.models
        .filter((m) =>
          m.supportedGenerationMethods?.includes("generateContent")
        )
        .sort((a, b) => b.inputTokenLimit - a.inputTokenLimit);

      recommendedModels.slice(0, 5).forEach((model) => {
        const modelName = model.name.replace("models/", "");
        console.log(`   - ${modelName}`);
      });
    } else {
      console.error("❌ Error:", data);
    }
  } catch (error) {
    console.error("❌ Error listing models:", error.message);
  }
}

listAvailableModels();
