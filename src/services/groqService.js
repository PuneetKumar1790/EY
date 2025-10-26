const { gemini, MODEL } = require("../config/groqClient");
const fs = require("fs-extra");
const path = require("path");

/**
 * Generate a detailed summary for a PDF document
 * @param {string} pdfText - Extracted text from PDF
 * @returns {Promise<string>} Detailed summary
 */
async function generateSummary(pdfText) {
  try {
    console.log("🤖 Generating summary using gemini API...");

    // Truncate if text is too long (keep first 30000 chars)
    const truncatedText =
      pdfText.length > 30000
        ? pdfText.substring(0, 30000) + "\n\n[... content truncated ...]"
        : pdfText;

    const prompt = `You are a tender document analyst. Analyze the following tender document and create a comprehensive, detailed summary.

FOCUS ON:
1. Tender eligibility criteria (mandatory and desirable)
2. Technical specifications and requirements
3. Financial requirements (EMD, bid amounts, turnover thresholds)
4. Documentation requirements
5. Submission deadlines and procedures
6. Evaluation criteria
7. Any compliance requirements or certifications needed

DOCUMENT TEXT:
${truncatedText}

OUTPUT FORMAT:
Provide a detailed, structured summary covering all the above points. Be specific and thorough. Do not miss any eligibility criteria or requirements mentioned in the document.`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert tender document analyst. Provide detailed, comprehensive summaries of tender requirements.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 8192,
    });

    const summary = completion.choices[0]?.message?.content || "";

    if (!summary || summary.trim().length === 0) {
      throw new Error("Gemini API returned empty summary");
    }

    console.log(`✓ Generated summary (${summary.length} characters)`);
    return summary;
  } catch (error) {
    console.error("❌ Error generating summary:", error.message);
    throw new Error(`Summary generation failed: ${error.message}`);
  }
}

/**
 * Generate eligibility analysis table (with retry and simpler prompt)
 * @param {string} tenderSummary - Comprehensive tender summary (concatenated from all PDF summaries)
 * @param {string} companyInfo - Company information text
 * @returns {Promise<string>} Eligibility analysis table
 */
async function generateEligibilityAnalysis(tenderSummary, companyInfo) {
  try {
    console.log("🤖 Generating eligibility analysis using gemini API...");
    console.log(
      `📊 Input sizes - Tender: ${tenderSummary.length} chars, Company: ${companyInfo.length} chars`
    );

    // With 1M+ input tokens, we can use full inputs without truncation
    const maxTenderLength = 100000; // ~25K tokens
    const maxCompanyLength = 80000; // ~20K tokens

    const truncatedTender =
      tenderSummary.length > maxTenderLength
        ? tenderSummary.substring(0, maxTenderLength) +
          "\n\n[... content truncated for length ...]"
        : tenderSummary;

    const truncatedCompany =
      companyInfo.length > maxCompanyLength
        ? companyInfo.substring(0, maxCompanyLength) +
          "\n\n[... content truncated for length ...]"
        : companyInfo;

    console.log(
      `📊 Processing - Tender: ${truncatedTender.length} chars, Company: ${truncatedCompany.length} chars`
    );

    // Comprehensive prompt for complete analysis
    const prompt = `You are analyzing tender eligibility. Compare the tender requirements with company information.

TENDER REQUIREMENTS:
${truncatedTender}

COMPANY INFORMATION:
${truncatedCompany}

TASK: Create a COMPLETE eligibility analysis table covering ALL requirements mentioned in the tender document.

Table format (markdown):
| Sr. No. | Requirement | Status | Company Evidence | Notes |

Where:
- Requirement: Brief description of the tender requirement
- Status: ✅ YES (fulfilled) / ❌ NO (not fulfilled) / ⚠️ PARTIAL (partially fulfilled or unclear)
- Company Evidence: Specific data/information from company document
- Notes: Any additional clarifications or concerns

IMPORTANT: 
- Include ALL eligibility criteria, technical specs, financial requirements, documentation needs
- Be thorough and complete - do not skip any requirements
- Provide specific evidence from company documents
- If information is missing or unclear in company docs, mark as ❌ NO or ⚠️ PARTIAL

Start the table now:`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 65536, // Maximum output tokens for gemini-2.5-flash
    });

    const analysis = completion.choices[0]?.message?.content || "";

    console.log(`📝 Raw API response length: ${analysis.length} characters`);

    if (!analysis || analysis.trim().length === 0) {
      console.error("❌ Gemini API returned empty analysis");
      console.error("🔍 Trying alternative approach with smaller inputs...");

      // Fallback: Try with even smaller inputs
      return await generateEligibilityAnalysisSimple(
        truncatedTender.substring(0, 10000),
        truncatedCompany.substring(0, 8000)
      );
    }

    console.log(
      `✓ Generated eligibility analysis (${analysis.length} characters)`
    );
    return analysis;
  } catch (error) {
    console.error("❌ Error generating eligibility analysis:", error.message);
    console.error("Stack trace:", error.stack);

    // Final fallback: create a simple table manually
    console.log("🔄 Attempting fallback analysis...");
    return createFallbackAnalysis(tenderSummary, companyInfo);
  }
}

/**
 * Simplified eligibility analysis with minimal prompt
 */
async function generateEligibilityAnalysisSimple(tenderSummary, companyInfo) {
  console.log("🔄 Attempting simplified analysis...");

  const prompt = `Create brief eligibility comparison table.

TENDER: ${tenderSummary.substring(0, 8000)}

COMPANY: ${companyInfo.substring(0, 6000)}

Table format:
| Requirement | Status | Evidence |
List top 10 requirements only.`;

  const completion = await gemini.chat.completions.create({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    model: MODEL,
    temperature: 0.5,
    max_tokens: 65536, // Maximum for complete response
  });

  const analysis = completion.choices[0]?.message?.content || "";

  if (analysis && analysis.trim().length > 0) {
    console.log(
      `✓ Simplified analysis generated (${analysis.length} characters)`
    );
    return analysis;
  }

  throw new Error("All API attempts returned empty responses");
}

/**
 * Create a basic fallback analysis when API fails
 */
function createFallbackAnalysis(tenderSummary, companyInfo) {
  console.log("⚠️ Creating fallback analysis table...");

  const fallbackTable = `# Eligibility Analysis Table

⚠️ Note: This is a basic analysis created due to API limitations. Manual review recommended.

## Tender Summary
${tenderSummary.substring(0, 5000)}

## Company Information
${companyInfo.substring(0, 3000)}

## Analysis Status
| Sr. No. | Category | Status | Notes |
|---------|----------|--------|-------|
| 1 | General Eligibility | ⚠ REVIEW REQUIRED | Manual verification needed |
| 2 | Technical Requirements | ⚠ REVIEW REQUIRED | Manual verification needed |
| 3 | Financial Requirements | ⚠ REVIEW REQUIRED | Manual verification needed |
| 4 | Documentation | ⚠ REVIEW REQUIRED | Manual verification needed |

**IMPORTANT**: This automated analysis could not be completed. Please manually review the tender requirements against company information.

Tender Document Length: ${tenderSummary.length} characters
Company Info Length: ${companyInfo.length} characters
`;

  return fallbackTable;
}

/**
 * Check final eligibility (YES/NO) - With rule-based fallback
 * @param {string} eligibilityTable - Eligibility analysis table
 * @returns {Promise<string>} "YES" or "NO"
 */
async function checkFinalEligibility(eligibilityTable) {
  try {
    console.log("🤖 Checking final eligibility using Gemini API...");

    if (!eligibilityTable || eligibilityTable.trim().length === 0) {
      throw new Error("Empty eligibility table provided");
    }

    console.log(`📊 Full table length: ${eligibilityTable.length} characters`);

    // Count status symbols in the table for quick assessment
    const yesCount = (eligibilityTable.match(/✅/g) || []).length;
    const noCount = (eligibilityTable.match(/❌/g) || []).length;
    const partialCount = (eligibilityTable.match(/⚠️/g) || []).length;

    console.log(
      `📊 Status summary - ✅ YES: ${yesCount}, ❌ NO: ${noCount}, ⚠️ PARTIAL: ${partialCount}`
    );

    // Rule-based check first
    if (noCount > 0) {
      console.log(
        `❌ Found ${noCount} NO statuses - Company NOT eligible (rule-based decision)`
      );
      return "NO";
    }

    if (partialCount > yesCount) {
      console.log(
        `⚠️ More PARTIAL (${partialCount}) than YES (${yesCount}) - Company NOT eligible (rule-based decision)`
      );
      return "NO";
    }

    if (yesCount > 0 && noCount === 0 && partialCount <= 2) {
      console.log(
        `✅ Mostly YES with minimal PARTIAL - Company IS eligible (rule-based decision)`
      );
      return "YES";
    }

    // If unclear, use AI for detailed analysis
    console.log(`🤖 Status unclear - using AI for detailed analysis...`);

    // Use focused excerpt
    const tableExcerpt = eligibilityTable.substring(0, 15000);

    const prompt = `Analyze this eligibility table and determine if the company is eligible.

ELIGIBILITY TABLE:
${tableExcerpt}

DECISION RULES:
- If ANY requirement shows ❌ NO status → Company is NOT eligible
- If MOST requirements show ⚠️ PARTIAL → Company is NOT eligible  
- If MOST requirements show ✅ YES with few/no ❌ → Company IS eligible

Respond with ONLY one word: YES or NO

Your decision:`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.0,
      max_tokens: 1000,
    });

    console.log(`📊 AI analysis complete`);

    const rawResult = (completion.choices[0]?.message?.content || "").trim();
    console.log(`📝 AI response: "${rawResult}"`);

    // Extract YES or NO
    const resultUpper = rawResult.toUpperCase();
    let finalResult = "NO"; // Default to NO for safety

    if (resultUpper.includes("YES") && !resultUpper.includes("NO")) {
      finalResult = "YES";
    } else if (resultUpper.includes("NO")) {
      finalResult = "NO";
    } else {
      console.warn(`⚠️ Unclear AI response. Defaulting to NO for safety.`);
    }

    console.log(`✅ Final eligibility decision: ${finalResult}`);
    return finalResult;
  } catch (error) {
    console.error("❌ Error in checkFinalEligibility:", error.message);
    // On error, default to NO for safety
    console.log("⚠️ Error occurred - defaulting to NO for safety");
    return "NO";
  }
}

module.exports = {
  generateSummary,
  generateEligibilityAnalysis,
  checkFinalEligibility,
};
