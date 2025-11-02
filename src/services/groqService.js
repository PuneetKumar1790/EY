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
      max_tokens: 16384,
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
 * Generate eligibility analysis table with UPDATED prompt
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

    const maxTenderLength = 50000;
    const maxCompanyLength = 40000;

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

    // UPDATED PROMPT 2
    const prompt = `You are a tender eligibility analyst. You have been provided with two things:

1. **TENDER DOCUMENT long summary**: A comprehensive summary of tender requirements
2. **COMPANY INFORMATION DOCUMENT**: A detailed company profile

## TENDER DOCUMENT:
${truncatedTender}

## COMPANY INFORMATION DOCUMENT:
${truncatedCompany}

---

## CRITICAL INSTRUCTION - EXCLUDE THESE FROM ANALYSIS:

**DO NOT include the following in your eligibility table as they are procedural/submission items:**

1. **Payment Confirmations**: Tender fee paid, EMD paid, Bank Guarantee submitted, etc. → Only verify CAPABILITY to pay

2. **Document Submission Items**: Forms filled, documents sealed & signed, scanned copies uploaded, physical submission, etc.

3. **Standard Acceptance Items**: Acceptance of price variation clause, payment terms, delivery terms, penalty terms, performance guarantee terms, etc. → These are automatically accepted by bidding

4. **Procedural Documents**: Notarized declarations, stamp papers, power of attorney, authorized representative declaration, etc. → Standard compliance items

5. **Application Process Items**: Online submission, preliminary stage uploads, technical stage uploads, format compliance, etc.

6. **Standard Technical Specs for Manufactured Products**: If company already manufactures the product type, don't verify granular specs like insulation thickness, conductor resistance, etc. → Only verify PRODUCT TYPE match

7. **Bid Validity**: 120 days validity → Assumed compliance

8. **Agreement Execution**: Willingness to sign agreement → Assumed if bidding

**IMPORTANT**: Treat operational, commercial and procedural issues as advisory ONLY and NOT as mandatory disqualifiers. Specifically exclude delivery schedule / capacity ramping / subcontracting, bank/BG exposure limits, procedural submission items (EMD/tender-fee proof, notarized declarations, signed forms), acceptance of standard commercial clauses, and granular manufacturing spec details from the mandatory YES/NO decision. Only evaluate the defined MANDATORY CHECKLIST (Registration & Core Certifications; Product & Technical Capability — product family match + required BIS/type-tests; Financial Capability; Experience & Compliance).

---

## FOCUS ONLY ON THESE CRITICAL ELIGIBILITY FACTORS:

### A. Registration & Core Certifications
- Manufacturer status with GST
- **Vendor Registration with SPECIFIC required entity** (e.g., PGVCL vs DGVCL)
- Factory License
- ISO Certification (if mandatory)

### B. Product & Technical Capability
- **Does company manufacture the EXACT product type required?** (e.g., XLPE vs PVC insulation)
- **BIS License for the SPECIFIC product** (not just category)
- **Type Test Reports for the SPECIFIC product variant**
- Conformance to required IS standards

### C. Production Capacity
- **Minimum Tendering Quantity**: Can company fulfill MTQ for each item?
- **Delivery Schedule**: Can company meet the timeline?
- **Current capacity utilization**: Can accommodate new order?

### D. Financial Capability (Capability, not actual payment)
- **Tender Fee**: Can afford? (Just verify financial capability)
- **EMD Amount**: Can arrange? (Check bank guarantee limits/working capital)
- **Financial Turnover**: Meets any minimum threshold?

### E. Experience
- Experience in manufacturing the product
- **Past orders with required entity** (if mandated)
- Performance track record

### F. Critical Compliance
- Not blacklisted/stop-deal
- MSME status (if benefits claimed)
- Country border restrictions compliance
- Conflict of interest declaration

---

## OUTPUT FORMAT:

Create ONLY a table with the following structure (use proper markdown table formatting):

| Sr. No. | Critical Tender Requirement | Fulfilled? | Company's Status/Information | Reference in Company Info Doc |
|---------|---------------------------|------------|------------------------------|-------------------------------|
| [number] | [Exact requirement from tender] | [✅ YES / ❌ NO / ⚠️ PARTIAL] | [Specific data/information from company doc] | [Exact section/page reference] |

**Guidelines:**
- ✅ YES = Fully met with evidence
- ❌ NO = Not met or missing
- ⚠️ PARTIAL = Partially met or needs verification

**ONLY include items from the MANDATORY CHECKLIST above. DO NOT include procedural/submission items.**

After the table, provide:
- **OVERALL ELIGIBILITY**: State clearly ✅ ELIGIBLE or ❌ NOT ELIGIBLE
- **CRITICAL DISQUALIFYING FACTORS** (if not eligible): List 3-5 key reasons
- **STRENGTHS** (if eligible): List 3-5 key factors

Output will be only table and decision sections - nothing else.`;

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
 * Check final eligibility (YES/NO) with UPDATED prompt
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

    // UPDATED PROMPT 3
    const prompt = `You are a tender eligibility analyst.

Based on the eligibility analysis table already prepared (which compares tender requirements vs. company information), output only one word:

**Output "YES"** — if the company is eligible for the tender (i.e., all mandatory requirements are fulfilled).

**Output "NO"** — if the company is not eligible (i.e., any mandatory requirement is missing, invalid, or uncertain).

## ELIGIBILITY ANALYSIS TABLE:
${tableExcerpt}

Do not provide explanations, tables, or reasoning.

Return only YES or NO as the final output.

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
      max_tokens: 65536,
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

/**
 * Generate comprehensive summary using the exact tender summarization prompt (Step 1 & 3)
 * @param {string} pdfTextOrCombinedSummary - PDF text for Step 1, or combined_summary.txt for Step 3
 * @returns {Promise<string>} Comprehensive summary
 */
async function generateComprehensiveTenderSummary(pdfTextOrCombinedSummary) {
  try {
    console.log(
      "🤖 Generating comprehensive tender summary using exact prompt..."
    );

    const truncatedText =
      pdfTextOrCombinedSummary.length > 50000
        ? pdfTextOrCombinedSummary.substring(0, 50000) +
          "\n\n[... content truncated ...]"
        : pdfTextOrCombinedSummary;

    const prompt = `You are a Tender Document Summarization Agent for Asian Wires Pvt. Ltd.

Your job is to read all uploaded tender-related PDFs (Tender Notice, Schedule/BOQ, Commercial Terms, Technical Specifications, etc.) and produce one comprehensive, descriptive summary that captures every key detail required for downstream eligibility, product matching, and pricing analysis.

The output must be a single, long-form summary (not a table) written in clear, labeled sections, so that every detail can later be referenced for the holistic table and pricing computations.

Each section below must include 3–4 lines of explanation defining what data to extract, why it matters, and an example of the kind of value expected.



1. Tender Overview

Summarize the basic identity of the tender.

Tender ID / Reference No. → e.g., "PGVCL/PROC/LT AB Cable/1228." Used as the anchor for all subsequent documents and tracking.

Tender Title / Name → e.g., "Procurement of LT Aerial Bunched Cable (3C×35 + 1C×16 + 25 mm²)." Gives a one-line summary of scope for founders to instantly understand the product category.

Organization / Issuing Authority → e.g., "Paschim Gujarat Vij Company Ltd. (PGVCL)." Important for eligibility checks (vendor registration and regional compliance).

Tender Portal / URL → Extract any portal name or website (like nProcure or GeM). Ensures cross-verification and access for future amendments.



2. Key Dates and Timeline

Capture all critical timeline data for scheduling and compliance.

Issue Date / Publication Date → When tender was announced. Example: "10-Oct-2025."

Submission Deadline / Closing Date & Time → e.g., "10-Nov-2025, 18:00 hrs." Used to prioritize tender actions.

Bid Opening Date / Technical Evaluation Date → If mentioned. Helps plan internal approval flow.

Bid Validity Period → e.g., "120 days from opening." Confirms assumed compliance period.



3. Tender Scope and Items (BOQ / Schedule-A)

Summarize all items requested in the tender BOQ.

Extract each line item, including product description, specification, quantity (in km), and any reference drawing or code. Example: "LT AB Cable, 3C×35mm² + 1C×16mm² + 25mm² messenger — Quantity: 100 km."

Include unit of measurement (km, nos, set) and total quantities.

If multiple product categories exist (e.g., cables + accessories), list each with its group heading.



4. Delivery & Logistics Details

Extract every mention of delivery, consignee, or dispatch locations.

Delivery Location / Consignee Address → e.g., "PGVCL Central Store, Rajkot, Gujarat." Used to calculate delivery distance from the manufacturing site (Vapi, Gujarat).

Delivery Schedule / Completion Period → e.g., "Within 90 days of order." Crucial for production planning.

Inspection Agency → If mention of pre-dispatch inspection by NABL/Third Party.

Destination Jurisdiction / State-Specific Rules → Highlight state-based vendor rules or benefits.



5. Eligibility and Registration Requirements

Summarize all vendor eligibility conditions, including certificates and compliance mandates.

Manufacturer / OEM Status → e.g., "Only manufacturers of LT AB Cable are eligible."

Vendor Registration Requirement → e.g., "Supplier must be registered with PGVCL or GUVNL."

Factory License, BIS, ISO Requirements → Mention license numbers or required standards.

Experience / Past Supply Clauses → e.g., "At least 50% of similar cables supplied to any DISCOM in last 3 years."

Financial Turnover Threshold / Net Worth Criteria → e.g., "Minimum annual turnover ₹10 Cr in last 3 years."

Blacklist Declaration, MSME Benefits, and Border Compliance Clauses → Include if relevant.



6. Technical Specifications (Core Product Data)

Summarize every distinct technical specification table from the tender's technical sections (like "1 Phase LT AB Cable" or "3 Phase LT AB Cable").

Include all technical parameters such as: Cable_Type, Core_Configuration, Insulation_Type, Rated_Voltage, Applicable_Standards (IS/IEC numbers), Conductor_Material, Insulation_Thickness_min_mm, No_of_Strands, Max_DC_Resistance_Ohm_km, Tensile_Strength_min_N_mm², Messenger_Composition

Provide a compact list for each product variation (e.g., "1C×35 + 1C×16 + 25mm²") for easy SKU mapping later.



7. Commercial & Financial Terms

Extract major financial or commercial conditions.

Tender Fee, EMD, and Performance Security → Mention only amounts and capability (not procedural compliance).

Payment Terms → e.g., "Within 30 days of delivery."

Delivery Penalty or LD Clause → e.g., "0.5% per week delay, max 10%."

Price Variation / Escalation Clause → Capture whether price is firm or variable.

Price Basis → e.g., "FOR Destination / Ex-Works."



8. Evaluation Criteria

Summarize how the tender will be evaluated.

Technical Bid Evaluation Basis → e.g., "Bids will be evaluated on conformity to technical specs."

Financial Bid Evaluation Basis → e.g., "L1 will be determined on total landed cost."

Preference Clauses → e.g., "MSME preference applicable for up to 15% price margin."

Weightage or Scoring Mechanism → if any.



9. Contacts and Clarifications

Capture key communication details for escalation or queries.

Contact Person / Designation → e.g., "Chief Engineer (Procurement), PGVCL."

Email / Phone → Extract exact contact details.

Office Address → Full postal address.



10. Key Compliance Notes

Summarize important procedural and legal compliances.

Document Submission Format → e.g., "Online through nProcure portal only."

Agreement & Contract Execution Clauses → "Successful bidder shall sign contract within 30 days."

Warranty / Guarantee Period → e.g., "36 months from commissioning or 18 months from supply."

After-Sales Service Clause → If applicable.



11. Optional Attachments or Annexures

If the tender refers to drawings, appendices, or sample formats:

List their titles and purposes briefly. Example: "Annexure B: Technical GTP," "Annexure F: Price Schedule," etc.



12. Summary Conclusion

End with a concise paragraph restating:

The total number of products requested.

The primary product types (e.g., "LT AB Cables, 1C and 3C variants").

The delivery destination(s).

The overall eligibility context (e.g., "Only registered PGVCL vendors can bid"). This summary becomes the base input for eligibility analysis, SKU mapping, and pricing computations.



Output Instruction

Produce one long, continuous descriptive summary organized in labeled sections exactly as above — no tables, no bullet points outside the structure, no omitted fields. Write with full sentences and technical completeness so the data can be directly parsed for further steps.

DOCUMENT TEXT:
${truncatedText}`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.3,
      max_tokens: 65536,
    });

    const summary = completion.choices[0]?.message?.content || "";

    if (!summary || summary.trim().length === 0) {
      throw new Error("API returned empty summary");
    }

    console.log(
      `✓ Generated comprehensive summary (${summary.length} characters)`
    );
    return summary;
  } catch (error) {
    console.error("❌ Error generating comprehensive summary:", error.message);
    throw new Error(
      `Comprehensive summary generation failed: ${error.message}`
    );
  }
}

/**
 * Check eligibility from comprehensive summary and company profile (Step 4)
 * @param {string} comprehensiveSummary - Comprehensive summary text
 * @param {string} companyProfileJson - Company profile JSON string
 * @returns {Promise<string>} "YES" or "NO"
 */
async function checkEligibilityFromSummary(
  comprehensiveSummary,
  companyProfileJson
) {
  try {
    console.log("🤖 Checking eligibility from comprehensive summary...");

    const truncatedSummary =
      comprehensiveSummary.length > 50000
        ? comprehensiveSummary.substring(0, 50000) + "\n\n[... truncated ...]"
        : comprehensiveSummary;

    const prompt = `You are an eligibility evaluation agent. Compare the tender eligibility requirements from the comprehensive summary against the company profile.

COMPREHENSIVE SUMMARY (Section 5 contains eligibility requirements):
${truncatedSummary}

COMPANY PROFILE:
${companyProfileJson}

Extract all eligibility requirements from section 5 of the comprehensive summary.
Check each requirement against the company profile.
Output "YES" if all requirements are met, "NO" if any requirement is not met.

Output only "YES" or "NO" - nothing else.`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.0,
      max_tokens: 65536,
    });

    const result = (completion.choices[0]?.message?.content || "")
      .trim()
      .toUpperCase();

    if (result.includes("YES") && !result.includes("NO")) {
      return "YES";
    }
    return "NO";
  } catch (error) {
    console.error("❌ Error checking eligibility:", error.message);
    return "NO"; // Default to NO on error
  }
}

/**
 * Build Table B1 (Step 5) - Matching Operations Table
 * @param {string} comprehensiveSummary - Comprehensive summary text
 * @returns {Promise<string>} Table B1 as CSV (table only, no text)
 */
async function buildTableB1(comprehensiveSummary) {
  try {
    console.log("🤖 Building Table B1...");

    // This is the exact prompt from requirements - very long
    const prompt = `Build Table B1: Matching Operations Table (from tender PDF summaries)

From the single large summary text: a combined summary of all tender PDFs for one procurement (the number of PDFs may vary). Your goal is to produce Table B1: Matching Operations Table — a single tabular output whose columns are the 11 field headers defined below. For every line item or cable configuration mentioned in the summary, fill one row with the most authoritative extracted value for each column.

produce Table B1 rows only for cable configurations explicitly listed in the Schedule-A / BOQ (the procurement list). Follow these rules exactly:

Primary filter (absolute): Before creating any row, check the Schedule-A / BOQ (or the procurement/quantity table). If a Core_Configuration is NOT present in Schedule-A/BOQ, DO NOT create a Table B1 row for it, even if it appears in Technical Specifications, GTP, or other supporting documents.

Source precedence for cell values: For fields of a row whose Core_Configuration is in Schedule-A/BOQ, populate cells using this precedence: Technical Specification table numeric > GTP table > Schedule/BOQ line item > Tender Notice > other clauses. But do not create rows from tech/GTP alone.

Provenance mandatory: Every non-MISSING cell must append a concise provenance tag in square brackets (e.g., [Schedule-A Sr.1], [TechSpec Table-I col.5], [GTP Part-A Sr.3]).

Conflict handling: If Schedule-A/BOQ lists a Core_Configuration but the TechSpec excludes it or gives conflicting parameters, choose Schedule-A/BOQ for whether to include the row and choose the most specific technical doc for numeric values. Document the conflict in Extraction_Notes with "CONFLICT" and cite both sources.

Logging skipped configurations: If you encounter configurations present only in Technical Spec/GTP but absent from Schedule-A/BOQ, do not add them to Table B1. Instead add an entry to a separate short log row (not part of Table B1) listing the config and its provenance and the reason "SKIPPED — not listed in Schedule-A/BOQ".

Canonicalization & numeric rules: Apply the canonicalization rules exactly as specified (mm² notation, Rated_Voltage with V suffix, numeric cells as numbers, choose min of ranges, etc.). If size-dependent rules apply (e.g., insulation thickness varies by conductor size), choose the value applicable to the phase conductor in the Schedule-A Core_Configuration and note the rule in Extraction_Notes.

Ambiguity fallback: If a field cannot be found anywhere (Schedule-A, TechSpec, GTP, Tender Notice), mark it MISSING and state where you searched in Extraction_Notes. Prefer MISSING over guessing.

Output: Output only Table B1 (CSV/markdown) with rows for the configurations from Schedule-A/BOQ, using required columns and provenance tags. Do not output rows for any configuration absent in Schedule-A/BOQ.

Output format

Produce Table B1 (CSV or markdown table) with columns in this exact order:

Cable_Type
Core_Configuration
Insulation_Type
Rated_Voltage
Applicable_Standards
Conductor_Material
Insulation_Thickness_min_mm
No_of_Strands
Max_DC_Resistance_Ohm_km
Tensile_Strength_min_N_mm2
Messenger_Composition
Extraction_Notes (free text)

Each non-MISSING cell must include a provenance tag in square brackets appended to the cell value (e.g., XLPE [TechSpec clause 5.1]). Numeric columns should contain numeric values (units not included) — add provenance inside square brackets in the same cell (e.g., 1.2 [Table-I col.6]).

COMPREHENSIVE SUMMARY:
${comprehensiveSummary.substring(0, 60000)}

Output ONLY the table in clean CSV- or Markdown-table format — absolutely no text, no preamble, no explanation, no JSON, no code block syntax hint, nothing else.`;

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

    const table = completion.choices[0]?.message?.content || "";

    if (!table || table.trim().length === 0) {
      throw new Error("API returned empty table");
    }

    console.log(`✓ Generated Table B1 (${table.length} characters)`);
    return table;
  } catch (error) {
    console.error("❌ Error building Table B1:", error.message);
    throw new Error(`Table B1 generation failed: ${error.message}`);
  }
}

/**
 * Match SKUs (Step 6)
 * @param {string} tableB1Csv - Table B1 CSV content
 * @param {string} skuMasterTxt - SKU master descriptions text
 * @returns {Promise<string>} SKU codes only, one per line
 */
async function matchSKUs(tableB1Csv, skuMasterTxt) {
  try {
    console.log("🤖 Matching SKUs...");

    // This is the exact prompt from requirements
    const prompt = `Single-shot Prompt — Best-Match Selector (strict output: only SKU codes, one per demanded product, nothing else)

Inputs available to the agent:

From the above Matching Operations Table — one canonical row per tender line item (the products demanded by the tender). Each row contains the 11 canonical fields (in this order): Cable_Type, Core_Configuration, Insulation_Type, Rated_Voltage, Applicable_Standards, Conductor_Material, Insulation_Thickness_min_mm, No_of_Strands, Max_DC_Resistance_Ohm_km, Tensile_Strength_min_N_mm2, Messenger_Composition. Values are canonicalized and include provenance tags where available. Table B1 defines the demand for each item.

TXT_SKU_List — the plain text file you previously produced where each SKU in the vendor master (the TXT entries) is described in full sentences and explicitly contains all available technical attributes. Use this as the SKU master/reference.

Goal: For each tender line item (each row in Table B1), find the single best matched SKU from TXT_SKU_List. Output only the SKU codes — one SKU code per line — in the same order as the items appear in Table B1. No extra text, labels, punctuation, explanation, confirmations, or questions. Only raw SKU_CODE strings, one per line (for N tender items, output N lines).

Scoring overview (global weights; sum = 100):

Cable_Type — 15 points
Core_Configuration — 25 points
Insulation_Type — 10 points
Rated_Voltage — 8 points
Applicable_Standards — 12 points
Conductor_Material — 10 points
Insulation_Thickness_min_mm — 5 points
No_of_Strands — 5 points
Max_DC_Resistance_Ohm_km — 5 points
Tensile_Strength_min_N_mm2 — 3 points
Messenger_Composition — 2 points

Tie-break rules:

Higher Total_Score.
Higher Core_Configuration score.
Higher Cable_Type score.
Alphabetical lower SKU code (deterministic final tie-break).

Hard output constraint: The final output must be only SKU codes (one per line, in order of Table B1). If unable to determine any match for an item, output the text MISSING for that item's line (still obey the single-line-per-item requirement). Do not ask any questions. Do not output any other text.

TABLE B1:
${tableB1Csv.substring(0, 30000)}

SKU MASTER:
${skuMasterTxt.substring(0, 50000)}

Strict instruction: Do not output any additional text, explanation, JSON, tables, questions, or errors. If you cannot run or if an input is empty, still output MISSING lines for each Table B1 row.`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.1,
      max_tokens: 16384,
    });

    const result = completion.choices[0]?.message?.content || "";

    if (!result || result.trim().length === 0) {
      throw new Error("API returned empty SKU matches");
    }

    console.log(`✓ Generated SKU matches (${result.length} characters)`);
    return result.trim();
  } catch (error) {
    console.error("❌ Error matching SKUs:", error.message);
    throw new Error(`SKU matching failed: ${error.message}`);
  }
}

/**
 * Calculate pricing (Step 7)
 * @param {string} matchedSkusTxt - Matched SKUs text (one per line)
 * @param {string} comprehensiveSummary - Comprehensive summary
 * @returns {Promise<string>} Pricing table as CSV (table only)
 */
async function calculatePricing(matchedSkusTxt, comprehensiveSummary) {
  try {
    console.log("🤖 Calculating pricing...");

    const prompt = `You are the Pricing Agent for Asian Wires Pvt. Ltd. Your job is to calculate the final price per km and total price for each SKU received from the Sales Agent and Matching Agent using the given parameters and SKU master data. Use these constants: Copper_Price_per_kg = ₹870, Aluminium_Price_per_kg = ₹230, XLPE_Price_per_kg = ₹140, Labor_Cost_per_km = ₹3,636, Power_Cost_per_km = ₹2,424, Base_Logistics_Rate_per_ton_km = ₹6, Overhead_pct = 8%, Margin_pct = 12%, Manufacturing_Location = Vapi, Gujarat, Aluminium_Density_kg_per_m3 = 2700, and Copper_Density_kg_per_m3 = 8960. If the delivery distance (Distance_km) is not provided but the delivery location is given, calculate the distance between the Manufacturing Location (Vapi, Gujarat) and the given delivery location, set it as a constant, and use that distance throughout the computation. Use the following formulas: Material Cost per km = (Conductor_Mass × Metal_Price) + (XLPE_Mass × XLPE_Price); Conversion Cost per km = Labor_Cost_per_km + Power_Cost_per_km; Logistics Cost per km = Base_Logistics_Rate_per_ton_km × Distance × (Total_Weight ÷ 1000); Overhead per km = (Material + Conversion) × Overhead_pct; Total Cost per km (before scale) = Material + Conversion + Logistics + Overhead; Economy Factor = 1 − 0.15 × (Order_Quantity ÷ (Order_Quantity + 1000)); Adjusted Cost per km = Total Cost × Economy Factor; Final Price per km = Adjusted Cost × (1 + Margin_pct); and Total Price = Final Price × Order Quantity.

Use the following SKU master data for all calculations:

AW-ABC-1C-XLPE-16-16-25: Aluminium, 86.4, 17.3, 103.7;
AW-ABC-1C-XLPE-16-25-25: Aluminium, 110.7, 22.1, 132.8;
AW-ABC-1C-XLPE-25-16-25: Aluminium, 110.7, 22.1, 132.8;
AW-ABC-1C-XLPE-25-25-25: Aluminium, 135, 27.0, 162.0;
AW-ABC-1C-XLPE-35-16-25: Aluminium, 137.7, 27.5, 165.2;
AW-ABC-1C-XLPE-35-25-25: Aluminium, 162, 32.4, 194.4;
AW-ABC-1C-XLPE-50-25-35: Aluminium, 202.5, 40.5, 243.0;
AW-ABC-1C-XLPE-50-35-35: Aluminium, 229.5, 45.9, 275.4;
AW-ABC-1C-XLPE-70-35-35: Aluminium, 283.5, 56.7, 340.2;
AW-ABC-1C-XLPE-95-50-50: Aluminium, 391.5, 78.3, 469.8;
AW-ABC-3C-XLPE-16-16-25: Aluminium, 118.8, 23.8, 142.6;
AW-ABC-3C-XLPE-16-25-25: Aluminium, 140.4, 28.1, 168.5;
AW-ABC-3C-XLPE-25-16-25: Aluminium, 157.5, 31.5, 189.0;
AW-ABC-3C-XLPE-25-25-25: Aluminium, 175.5, 35.1, 210.6;
AW-ABC-3C-XLPE-35-16-25: Aluminium, 202.5, 40.5, 243.0;
AW-ABC-3C-XLPE-35-25-25: Aluminium, 220.5, 44.1, 264.6;
AW-ABC-3C-XLPE-50-25-35: Aluminium, 256.5, 51.3, 307.8;
AW-ABC-3C-XLPE-50-35-35: Aluminium, 283.5, 56.7, 340.2;
AW-ABC-3C-XLPE-70-35-35: Aluminium, 337.5, 67.5, 405.0;
AW-ABC-3C-XLPE-95-50-50: Aluminium, 454.5, 90.9, 545.4;
AW-ABC-4C-XLPE-16-16-25: Aluminium, 129.6, 25.9, 155.5;
AW-ABC-4C-XLPE-25-25-25: Aluminium, 175.5, 35.1, 210.6;
AW-ABC-4C-XLPE-35-25-35: Aluminium, 229.5, 45.9, 275.4;
AW-LT-1C-16: Aluminium, 43.2, 8.6, 51.8;
AW-LT-1C-25: Aluminium, 67.5, 13.5, 81.0;
AW-LT-1C-35: Aluminium, 94.5, 18.9, 113.4;
AW-LT-1C-50: Aluminium, 135.0, 27.0, 162.0;
AW-LT-2C-16: Aluminium, 86.4, 17.3, 103.7;
AW-LT-2C-25: Aluminium, 135.0, 27.0, 162.0;
AW-LT-3C-16: Aluminium, 129.6, 25.9, 155.5;
AW-LT-3C-25: Aluminium, 202.5, 40.5, 243.0;
AW-LT-3C-35: Aluminium, 283.5, 56.7, 340.2;
AW-LT-3C-50: Aluminium, 405.0, 81.0, 486.0;
AW-LT-4C-16: Aluminium, 172.8, 34.6, 207.4;
AW-LT-4C-25: Aluminium, 270.0, 54.0, 324.0;
AW-BW-1.5: Copper, 13.4, 2.7, 16.1;
AW-BW-2.5: Copper, 22.4, 4.5, 26.9;
AW-BW-4.0: Copper, 35.8, 7.2, 43.0;
AW-BW-6.0: Copper, 53.8, 10.8, 64.6;
AW-BW-10: Copper, 89.6, 17.9, 107.5;
AW-BW-16: Copper, 143.4, 28.7, 172.1;
AW-FL-0.75-2C: Copper, 13.4, 2.7, 16.1;
AW-FL-1.0-2C: Copper, 17.9, 3.6, 21.5;
AW-FL-1.5-2C: Copper, 26.9, 5.4, 32.3;
AW-FL-0.75-3C: Copper, 20.1, 4.0, 24.1;
AW-FL-1.0-3C: Copper, 26.8, 5.4, 32.2;
AW-FL-1.5-3C: Copper, 40.3, 8.1, 48.4;
AW-SUB-4C-4: Copper, 35.8, 7.2, 43.0;
AW-SUB-4C-6: Copper, 53.8, 10.8, 64.6;
AW-SUB-4C-10: Copper, 89.6, 17.9, 107.5;
AW-SUB-4C-16: Copper, 143.4, 28.7, 172.1;
AW-CC-4C-1.5: Copper, 26.9, 5.4, 32.3;
AW-CC-7C-1.5: Copper, 47.0, 9.4, 56.4;
AW-CC-12C-1.5: Copper, 80.6, 16.1, 96.7;
AW-CC-19C-1.5: Copper, 127.7, 25.5, 153.2.

When calculating prices for any tender, you must always extract the following parameters directly from the tender document long summary and company profile — never assume or use placeholders.

MANDATORY EXTRACTION STEPS (BEFORE CALCULATION)

Manufacturing Location:

Always extract from the Company Profile.

For Asian Wires Pvt. Ltd., this is Vapi, Gujarat (use as the fixed manufacturing origin for logistics).

Delivery Location / Consignee Address:

Extract from the Tender Documents (usually in the "Delivery", "Destination", or "Consignee" clause).

If multiple delivery locations exist, calculate distance for each item based on its destination.

Do NOT use placeholder distances.

Distance Calculation:

Compute the road distance (in km) between Vapi, Gujarat and the extracted delivery location(s).

Use this real distance in all logistics cost formulas.

Order Quantity (in km):

Extract directly from the Schedule-A / BOQ section of the tender (the official procurement quantity).

Do NOT assume or round values.

For each SKU, fetch the values for Conductor_Material, Conductor_Mass_kg_per_km, XLPE_Mass_kg_per_km, and Total_Weight_kg_per_km from the above data. If a SKU is not found, leave that row blank. Finally, do not write anything other than one single table containing only these columns and no text, no explanation, no title, no additional sentences: SKU_Code | Order_Qty_km | Distance_km | Conductor_Mass_kg_per_km | XLPE_Mass_kg_per_km | Unit_Material_Cost_Rs_per_km | Conversion_Cost_Rs_per_km | Logistics_Cost_Rs_per_km | Overhead_Rs_per_km | Total_Cost_Rs_per_km | Economy_Factor | Adjusted_Cost_Rs_per_km | Final_Price_Rs_per_km | Total_Price_Rs. All costs should be expressed in ₹ (Indian Rupees) and rounded to the nearest rupee. Do not include any other output before or after the table.

MATCHED SKUS:
${matchedSkusTxt.substring(0, 1000)}

COMPREHENSIVE SUMMARY:
${comprehensiveSummary.substring(0, 40000)}`;

    const completion = await gemini.chat.completions.create({
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: MODEL,
      temperature: 0.1,
      max_tokens: 65536,
    });

    const table = completion.choices[0]?.message?.content || "";

    if (!table || table.trim().length === 0) {
      throw new Error("API returned empty pricing table");
    }

    console.log(`✓ Generated pricing table (${table.length} characters)`);
    return table;
  } catch (error) {
    console.error("❌ Error calculating pricing:", error.message);
    throw new Error(`Pricing calculation failed: ${error.message}`);
  }
}

/**
 * Generate holistic summary table (Step 8)
 * @param {string} comprehensiveSummary - Comprehensive summary
 * @param {string} tableB1Csv - Table B1 CSV
 * @param {string} matchedSkusTxt - Matched SKUs
 * @param {string} pricingTableCsv - Pricing table CSV
 * @param {string} companyProfileJson - Company profile JSON
 * @returns {Promise<string>} Holistic table as CSV (table only)
 */
async function generateHolisticSummaryTable(
  comprehensiveSummary,
  tableB1Csv,
  matchedSkusTxt,
  pricingTableCsv,
  companyProfileJson
) {
  try {
    console.log("🤖 Generating holistic summary table...");

    // This prompt is from requirements - very long
    const prompt = `You are the Tender Intelligence Agent for Asian Wires Pvt. Ltd.

Your task is to generate a single holistic summary table that integrates all key sections of tender analysis — eligibility, product requirements, SKU mapping, and pricing — into one founder-readable page.

The output must be only one final table (Markdown or CSV-friendly) with no text, explanation, or commentary before or after it.

COMPREHENSIVE SUMMARY:
${comprehensiveSummary.substring(0, 40000)}

TABLE B1:
${tableB1Csv.substring(0, 20000)}

MATCHED SKUS:
${matchedSkusTxt.substring(0, 1000)}

PRICING TABLE:
${pricingTableCsv.substring(0, 15000)}

COMPANY PROFILE:
${companyProfileJson.substring(0, 10000)}

Generate a holistic table combining all sections (A through E):
- Part A: Tender Overview
- Part B: Eligibility Evaluation
- Part C: Tender Product Requirements
- Part D: Matched Company SKU Specifications
- Part E: Pricing Computation

Output only the table, no preamble or explanation.`;

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

    const table = completion.choices[0]?.message?.content || "";

    if (!table || table.trim().length === 0) {
      throw new Error("API returned empty holistic table");
    }

    console.log(`✓ Generated holistic table (${table.length} characters)`);
    return table;
  } catch (error) {
    console.error("❌ Error generating holistic table:", error.message);
    throw new Error(`Holistic table generation failed: ${error.message}`);
  }
}

// Export all functions
module.exports = {
  generateSummary,
  generateEligibilityAnalysis,
  checkFinalEligibility,
  generateComprehensiveTenderSummary,
  checkEligibilityFromSummary,
  buildTableB1,
  matchSKUs,
  calculatePricing,
  generateHolisticSummaryTable,
};
