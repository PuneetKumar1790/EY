require("dotenv").config();
const https = require("https");
const dns = require("dns").promises;

/**
 * Test DNS resolution
 */
async function testDNS() {
  console.log("\n🔍 Testing DNS Resolution...");
  try {
    const addresses = await dns.resolve4("generativelanguage.googleapis.com");
    console.log("✅ DNS Resolution successful");
    console.log("   IP addresses:", addresses.join(", "));
    return true;
  } catch (error) {
    console.error("❌ DNS Resolution failed:", error.message);
    console.log("   This might indicate network or DNS issues");
    return false;
  }
}

/**
 * Test HTTPS connectivity
 */
async function testHTTPS() {
  console.log("\n🔍 Testing HTTPS Connectivity...");

  return new Promise((resolve) => {
    const options = {
      hostname: "generativelanguage.googleapis.com",
      port: 443,
      path: "/v1beta/models",
      method: "GET",
      timeout: 10000,
    };

    const req = https.request(options, (res) => {
      console.log("✅ HTTPS Connection successful");
      console.log("   Status code:", res.statusCode);
      resolve(true);
    });

    req.on("error", (error) => {
      console.error("❌ HTTPS Connection failed:", error.message);
      if (error.code === "ENOTFOUND") {
        console.log("   DNS lookup failed - check internet connection");
      } else if (error.code === "ETIMEDOUT") {
        console.log("   Connection timeout - check firewall/proxy settings");
      } else if (error.code === "ECONNREFUSED") {
        console.log("   Connection refused - API might be blocked");
      }
      resolve(false);
    });

    req.on("timeout", () => {
      console.error("❌ Request timeout after 10 seconds");
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Test Gemini API with actual request
 */
async function testGeminiAPI() {
  console.log("\n🔍 Testing Gemini API...");

  const apiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ No API key found in environment variables");
    console.log("   Set GEMINI_API_KEY or GEMINI_API_KEY_1 in your .env file");
    return false;
  }

  console.log("   Using API key:", apiKey.substring(0, 10) + "...");

  try {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    console.log("   Sending test request...");
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: 'Say "Hello"' }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10,
      },
    });

    const response = result.response;
    const text = response.text();

    console.log("✅ Gemini API test successful");
    console.log("   Response:", text);
    return true;
  } catch (error) {
    console.error("❌ Gemini API test failed:", error.message);

    if (error.message?.includes("fetch failed")) {
      console.log("   This is a network connectivity issue");
      console.log("   Possible causes:");
      console.log("   - No internet connection");
      console.log("   - Firewall blocking HTTPS requests");
      console.log("   - Corporate proxy intercepting requests");
      console.log("   - VPN or network restrictions");
    } else if (error.message?.includes("API key")) {
      console.log("   Check your API key is valid");
    } else if (
      error.message?.includes("quota") ||
      error.message?.includes("429")
    ) {
      console.log("   API quota exceeded - wait or use different key");
    }

    return false;
  }
}

/**
 * Test proxy settings
 */
function testProxySettings() {
  console.log("\n🔍 Checking Proxy Settings...");

  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;

  if (httpProxy || httpsProxy) {
    console.log("⚠️  Proxy settings detected:");
    if (httpProxy) console.log("   HTTP_PROXY:", httpProxy);
    if (httpsProxy) console.log("   HTTPS_PROXY:", httpsProxy);
    if (noProxy) console.log("   NO_PROXY:", noProxy);
    console.log(
      "   If behind a corporate proxy, you may need to configure Node.js to use it"
    );
  } else {
    console.log("✅ No proxy settings detected");
  }
}

/**
 * Run all diagnostics
 */
async function runDiagnostics() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  NETWORK & GEMINI API DIAGNOSTIC TOOL");
  console.log("═══════════════════════════════════════════════════════");

  testProxySettings();

  const dnsOk = await testDNS();
  const httpsOk = await testHTTPS();
  const apiOk = await testGeminiAPI();

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  DIAGNOSTIC SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log("DNS Resolution:", dnsOk ? "✅ PASS" : "❌ FAIL");
  console.log("HTTPS Connection:", httpsOk ? "✅ PASS" : "❌ FAIL");
  console.log("Gemini API:", apiOk ? "✅ PASS" : "❌ FAIL");

  if (!dnsOk || !httpsOk || !apiOk) {
    console.log("\n⚠️  TROUBLESHOOTING STEPS:");
    console.log("1. Check your internet connection");
    console.log("2. Verify your API key is correct in .env file");
    console.log("3. Check if firewall is blocking HTTPS to googleapis.com");
    console.log("4. If behind corporate proxy, configure proxy settings");
    console.log("5. Try disabling VPN temporarily");
    console.log("6. Check if antivirus is intercepting HTTPS");
    console.log("7. Try from a different network (mobile hotspot)");
  } else {
    console.log(
      "\n✅ All tests passed! Your network and API are working correctly."
    );
  }

  console.log("═══════════════════════════════════════════════════════\n");
}

// Run diagnostics
runDiagnostics().catch(console.error);
