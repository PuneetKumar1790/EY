const { gemini, MODEL } = require("../config/groqClient");

/**
 * Generate a detailed summary for a PDF document
 * @param {string} pdfText - Extracted text from PDF
 * @returns {Promise<string>} Detailed summary
 */
async function generateSummary(pdfText) {
  try {
    console.log("🤖 Generating summary using Gemini API...");

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
 * Create a basic fallback analysis when API fails
 */
function createFallbackAnalysis(tenderSummary, companyInfo) {
  console.log("⚠️ Creating fallback analysis table...");

  const fallbackTable = `# Eligibility Analysis Table

⚠️ **Note**: This is a basic analysis created due to API limitations. Manual review recommended.

## Tender Summary (First 5000 characters)
${tenderSummary.substring(0, 5000)}

## Company Information (First 3000 characters)
${companyInfo.substring(0, 3000)}

## Analysis Status

| Sr. No. | Category | Fulfilled? | Company's Status/Information | Reference |
|---------|----------|------------|------------------------------|-----------|
| 1 | General Eligibility | ⚠️ REVIEW REQUIRED | Manual verification needed | N/A |
| 2 | Technical Requirements | ⚠️ REVIEW REQUIRED | Manual verification needed | N/A |
| 3 | Financial Requirements | ⚠️ REVIEW REQUIRED | Manual verification needed | N/A |
| 4 | Documentation | ⚠️ REVIEW REQUIRED | Manual verification needed | N/A |

---

## OVERALL ELIGIBILITY
❌ **NOT ELIGIBLE** - Automated analysis could not be completed

## CRITICAL DISQUALIFYING FACTORS
1. Automated analysis failed - API error or limitations
2. Manual review required for all eligibility criteria
3. Cannot verify compliance without complete analysis

**IMPORTANT**: This automated analysis could not be completed. Please manually review the tender requirements against company information.

**Document Statistics:**
- Tender Document Length: ${tenderSummary.length} characters
- Company Info Length: ${companyInfo.length} characters
`;

  return fallbackTable;
}

/**
 * Generate eligibility analysis table with improved prompt
 * @param {string} tenderSummary - Comprehensive tender summary (concatenated from all PDF summaries)
 * @param {string} companyInfo - Company information text
 * @returns {Promise<string>} Eligibility analysis table
 */
async function generateEligibilityAnalysis(tenderSummary, companyInfo) {
  try {
    console.log("🤖 Generating eligibility analysis using Gemini API...");
    console.log(
      `📊 Input sizes - Tender: ${tenderSummary.length} chars, Company: ${companyInfo.length} chars`
    );

    const maxTenderLength = 50000; // Reduced from 100000
    const maxCompanyLength = 40000; // Reduced from 80000

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

    // IMPROVED PROMPT - More detailed and structured
    const prompt = `You are a tender eligibility analyst. You have been provided with two documents:

1. **TENDER DOCUMENT**: A comprehensive summary of tender requirements including all eligibility criteria, technical specifications, financial requirements, documentation needs, and submission requirements.

2. **COMPANY INFORMATION DOCUMENT**: A detailed company profile containing registrations, certifications, licenses, production capacity, financial data, experience, and all relevant business information.

## TENDER DOCUMENT:
${truncatedTender}

## COMPANY INFORMATION DOCUMENT:
${truncatedCompany}

---

Your task is to:
1. Carefully analyze ALL eligibility criteria mentioned in the tender document
2. Cross-reference each requirement with the company information document
3. Determine whether the company fulfills each specific requirement
4. Create a comprehensive eligibility analysis table

## OUTPUT FORMAT:

Create ONLY a table with the following structure (use proper markdown table formatting):

| Sr. No. | Tender Requirement | Fulfilled? | Company's Status/Information | Reference in Company Info Doc |
|---------|-------------------|------------|------------------------------|-------------------------------|
| [number] | [Exact requirement from tender] | [✅ YES / ❌ NO / ⚠️ PARTIAL/UNCERTAIN] | [Specific data/information from company doc] | [Exact section/page reference] |

## INSTRUCTIONS:

1. **Completeness**: Include EVERY eligibility criterion mentioned in the tender - registration requirements, certifications, licenses, financial criteria, technical specifications, experience requirements, documentation requirements, declarations, etc.

2. **Accuracy**: 
   - Use ✅ YES only when the requirement is FULLY met
   - Use ❌ NO when the requirement is NOT met or information is missing
   - Use ⚠️ PARTIAL/UNCERTAIN when partially met or unclear

3. **Specificity in "Company's Status/Information" column**:
   - Quote exact numbers, dates, certificate numbers, registration numbers
   - Be precise (e.g., "GSTIN: 24AABCA1234F1Z5" not just "Has GST")
   - If requirement not met, state clearly what is missing

4. **Exact References**:
   - Cite the exact section name/number from the company info document
   - If information spans multiple sections, list all relevant sections
   - If information is NOT found anywhere, state "Not mentioned in company info doc"

5. **Logical Grouping**: Organize requirements in logical groups with section headers:
   - Registration & Certifications
   - Technical Requirements (BIS, Type Tests, Product Specs)
   - Financial Requirements (Fees, EMD, Turnover)
   - Experience & Past Performance
   - Production Capacity & Infrastructure
   - Documentation & Declarations
   - Delivery & Commercial Terms

6. **For complex requirements** (like Minimum Tendering Quantity with multiple items):
   - Create separate rows for each item/variant
   - Show calculations where applicable

7. **After the table, provide**:
   - **OVERALL ELIGIBILITY**: State clearly ✅ ELIGIBLE or ❌ NOT ELIGIBLE
   - **CRITICAL DISQUALIFYING FACTORS** (if not eligible): List 3-5 key reasons why company is not eligible
   - **STRENGTHS** (if eligible): List 3-5 key factors that make the company a strong candidate

## ANALYSIS APPROACH:
- Read the entire tender document first to understand all requirements
- Read the entire company information document to understand company capabilities
- Match each tender requirement systematically against company information
- Be objective - don't assume information that isn't explicitly stated
- If a requirement is conditional (e.g., "if applicable"), note whether it applies to this company
- Pay special attention to MANDATORY vs OPTIONAL requirements

Now, analyze the provided tender and company documents and create the eligibility analysis table following the exact format specified above.`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.2,
      max_tokens: 65536,
    });

    const analysis = completion.choices[0]?.message?.content || "";

    console.log(`📝 Raw API response length: ${analysis.length} characters`);

    if (!analysis || analysis.trim().length === 0) {
      console.error("❌ Gemini API returned empty analysis");
      return createFallbackAnalysis(truncatedTender, truncatedCompany);
    }

    console.log(
      `✓ Generated eligibility analysis (${analysis.length} characters)`
    );
    return analysis;
  } catch (error) {
    console.error("❌ Error generating eligibility analysis:", error.message);
    console.error("Stack trace:", error.stack);
    console.log("🔄 Attempting fallback analysis...");
    return createFallbackAnalysis(tenderSummary, companyInfo);
  }
}

/**
 * Check final eligibility (YES/NO) with improved prompt
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

    const tableExcerpt = eligibilityTable.substring(0, 20000);

    // IMPROVED PROMPT - More precise and focused
    const prompt = `You are a tender eligibility analyst.

Based on the eligibility analysis table already prepared (which compares tender requirements vs. company information), output only one word:

**Output "YES"** — if the company is eligible for the tender (i.e., all mandatory requirements are fulfilled).

**Output "NO"** — if the company is not eligible (i.e., any mandatory requirement is missing, invalid, or uncertain).

## ELIGIBILITY ANALYSIS TABLE:
${tableExcerpt}

## DECISION RULES:
1. If ANY requirement shows ❌ NO status → Company is **NOT eligible**
2. If MOST requirements show ⚠️ PARTIAL/UNCERTAIN → Company is **NOT eligible**  
3. If MOST requirements show ✅ YES with few/no ❌ or ⚠️ → Company **IS eligible**
4. Focus on MANDATORY requirements - these are critical
5. Minor missing documentation may be acceptable if core eligibility is met

**Do not provide explanations, tables, or reasoning.**

**Return only YES or NO as the final output.**

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
      max_tokens: 10,
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
    console.log("⚠️ Error occurred - defaulting to NO for safety");
    return "NO";
  }
}

// Export all functions
module.exports = {
  generateSummary,
  generateEligibilityAnalysis,
  checkFinalEligibility,
};
