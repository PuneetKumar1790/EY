const fs = require("fs-extra");
const path = require("path");
const groqService = require("../services/groqService");

/**
 * Analyze tender eligibility
 * POST /api/analyze-tender/:tenderId
 */
async function analyzeTenderEligibility(req, res) {
  try {
    const tenderId = req.params.tenderId;

    console.log(`\n🔍 Starting eligibility analysis for ${tenderId}...`);

    // Step 1: Read all summaries for the tender (concatenate them)
    const summaryDir = `summaries/${tenderId}`;
    const summaryFiles = await fs.readdir(summaryDir);
    const txtFiles = summaryFiles.filter((file) =>
      file.endsWith("_summary.txt")
    );

    if (txtFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No summaries found for ${tenderId}. Please upload and process PDFs first.`,
      });
    }

    console.log(`📚 Found ${txtFiles.length} summary files`);

    // Concatenate all summaries (NO re-summarization)
    let comprehensiveSummary = "";
    for (const file of txtFiles) {
      const filePath = path.join(summaryDir, file);
      const content = await fs.readFile(filePath, "utf8");
      comprehensiveSummary += `\n\n--- ${file} ---\n\n${content}`;
    }

    console.log(
      `✓ Concatenated comprehensive summary (${comprehensiveSummary.length} characters)`
    );

    // Step 1.5: Save the combined summary
    const combinedSummaryPath = path.join(summaryDir, "combined_summary.txt");
    await fs.writeFile(combinedSummaryPath, comprehensiveSummary, "utf8");
    console.log(`✓ Combined summary saved: ${combinedSummaryPath}`);

    // Step 2: Read company info
    const companyInfoPath = "uploads/company-info.txt";
    if (!(await fs.pathExists(companyInfoPath))) {
      return res.status(400).json({
        success: false,
        error:
          "Company information not found. Please upload company document first.",
      });
    }

    const companyInfo = await fs.readFile(companyInfoPath, "utf8");
    console.log(`✓ Loaded company info (${companyInfo.length} characters)`);

    // Step 3: Generate eligibility analysis using Groq
    const eligibilityTable = await groqService.generateEligibilityAnalysis(
      comprehensiveSummary,
      companyInfo
    );

    // Step 4: Save eligibility table
    const analysisDir = `analysis/${tenderId}`;
    await fs.ensureDir(analysisDir);
    const tablePath = path.join(analysisDir, "table.txt");
    await fs.writeFile(tablePath, eligibilityTable, "utf8");

    console.log(`✓ Eligibility table saved: ${tablePath}`);

    res.json({
      success: true,
      message: `Eligibility analysis completed for ${tenderId}`,
      tenderId,
      tablePath,
      combinedSummaryPath, // NEW: Include path to combined summary
      summary: {
        totalSummaries: txtFiles.length,
        comprehensiveSummaryLength: comprehensiveSummary.length,
        companyInfoLength: companyInfo.length,
        eligibilityTableLength: eligibilityTable.length,
      },
    });
  } catch (error) {
    console.error("❌ Error in analyzeTenderEligibility:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  analyzeTenderEligibility,
};
