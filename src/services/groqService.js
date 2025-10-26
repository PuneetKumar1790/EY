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
${pdfText}

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
    console.log(`✓ Generated summary (${summary.length} characters)`);
    return summary;
  } catch (error) {
    console.error("❌ Error generating summary:", error.message);
    throw new Error(`Summary generation failed: ${error.message}`);
  }
}

/**
 * Generate eligibility analysis table
 * @param {string} tenderSummary - Comprehensive tender summary (concatenated from all PDF summaries)
 * @param {string} companyInfo - Company information text
 * @returns {Promise<string>} Eligibility analysis table
 */
async function generateEligibilityAnalysis(tenderSummary, companyInfo) {
  try {
    console.log("🤖 Generating eligibility analysis using gemini API...");

    const prompt = `You are a tender eligibility analyst. You have been provided with two documents:

1. *TENDER DOCUMENT*: A comprehensive summary of tender requirements including all eligibility criteria, technical specifications, financial requirements, documentation needs, and submission requirements.

2. *COMPANY INFORMATION DOCUMENT*: A detailed company profile containing registrations, certifications, licenses, production capacity, financial data, experience, and all relevant business information.

Your task is to:
1. Carefully analyze ALL eligibility criteria mentioned in the tender document
2. Cross-reference each requirement with the company information document
3. Determine whether the company fulfills each specific requirement
4. Create a comprehensive eligibility analysis table

## OUTPUT FORMAT:

| Sr. No. | Tender Requirement | Fulfilled? | Company's Status/Information | Reference in Company Info Doc |
|---------|-------------------|------------|------------------------------|-------------------------------|
| [number] | [Exact requirement from tender] | [✅ YES / ❌ NO / ⚠ PARTIAL/UNCERTAIN] | [Specific data/information from company doc that addresses this requirement] | [Exact section name/number where this information is found] |

TENDER DOCUMENT:
${tenderSummary}

COMPANY INFORMATION:
${companyInfo}

Create a detailed eligibility analysis table following the format above. Include ALL requirements found in the tender document.`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert tender eligibility analyst. Create detailed eligibility analysis tables by comparing tender requirements with company information.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 4096,
    });

    const analysis = completion.choices[0]?.message?.content || "";
    console.log(
      `✓ Generated eligibility analysis (${analysis.length} characters)`
    );
    return analysis;
  } catch (error) {
    console.error("❌ Error generating eligibility analysis:", error.message);
    throw new Error(`Eligibility analysis generation failed: ${error.message}`);
  }
}

/**
 * Check final eligibility (YES/NO)
 * @param {string} eligibilityTable - Eligibility analysis table
 * @returns {Promise<string>} "YES" or "NO"
 */
async function checkFinalEligibility(eligibilityTable) {
  try {
    console.log("🤖 Checking final eligibility using Groq API...");

    const prompt = `You are a tender eligibility analyst.
Based on the eligibility analysis table already prepared (which compares tender requirements vs. company information),
output only one word:

Output "YES" — if the company is eligible for the tender (i.e., all mandatory requirements are fulfilled).
Output "NO" — if the company is not eligible (i.e., any mandatory requirement is missing, invalid, or uncertain).

Do not provide explanations, tables, or reasoning.
Return only YES or NO as the final output.

ELIGIBILITY ANALYSIS TABLE:
${eligibilityTable}`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are a tender eligibility analyst. Output only YES or NO based on the eligibility analysis.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL, // Use the configured model
      temperature: 0.1,
      max_tokens: 10,
    });

    const result = (completion.choices[0]?.message?.content || "")
      .trim()
      .toUpperCase();
    console.log(`✓ Eligibility check result: ${result}`);
    return result;
  } catch (error) {
    console.error("❌ Error checking eligibility:", error.message);
    throw new Error(`Eligibility check failed: ${error.message}`);
  }
}

module.exports = {
  generateSummary,
  generateEligibilityAnalysis,
  checkFinalEligibility,
};
