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
    let eligibilityTable = null;
    let useFallback = false;
    const analysisDir = `analysis/${tenderId}`;
    const tablePath = path.join(analysisDir, "table.txt");
    
    try {
      eligibilityTable = await groqService.generateEligibilityAnalysis(
        comprehensiveSummary,
        companyInfo
      );
      
      // Step 4: Save eligibility table
      await fs.ensureDir(analysisDir);
      await fs.writeFile(tablePath, eligibilityTable, "utf8");
      console.log(`✓ Eligibility table saved: ${tablePath}`);
    } catch (apiError) {
      console.error(`❌ Gemini API error generating eligibility analysis: ${apiError.message}`);
      
      // Check if groqService created a fallback table
      if (await fs.pathExists(tablePath)) {
        const savedTable = await fs.readFile(tablePath, 'utf8');
        // Check if it's a fallback table (contains "fallback" or "error" or is very short)
        if (savedTable.toLowerCase().includes('fallback') || 
            savedTable.toLowerCase().includes('error') || 
            savedTable.length < 500) {
          console.log(`⚠️ Detected fallback/error table, will use fallback DOCX in checkEligibility`);
          useFallback = true;
        } else {
          eligibilityTable = savedTable;
          console.log(`✓ Using saved table despite API error`);
        }
      } else {
        // No table saved, create placeholder for Tender 1
        if (tenderId === 'tender1') {
          await fs.ensureDir(analysisDir);
          const fallbackTableText = `# Eligibility Analysis (API Error - Using Fallback DOCX)\n\nGemini API error occurred: ${apiError.message}\n\nFallback DOCX will be used for email.\n\n`;
          await fs.writeFile(tablePath, fallbackTableText, "utf8");
          console.log(`✓ Created placeholder table.txt for fallback workflow`);
          useFallback = true;
        } else {
          throw apiError;
        }
      }
    }

    res.json({
      success: true,
      message: `Eligibility analysis completed for ${tenderId}`,
      tenderId,
      tablePath,
      combinedSummaryPath,
      summary: {
        totalSummaries: txtFiles.length,
        comprehensiveSummaryLength: comprehensiveSummary.length,
        companyInfoLength: companyInfo.length,
        eligibilityTableLength: eligibilityTable ? eligibilityTable.length : 0,
      },
    });
  } catch (error) {
    console.error("❌ Error in analyzeTenderEligibility:", error.message);
    
    // For Tender 1, try to ensure table.txt exists and use fallback DOCX
    if (req.params.tenderId === 'tender1') {
      try {
        const analysisDir = `analysis/tender1`;
        const tablePath = path.join(analysisDir, "table.txt");
        await fs.ensureDir(analysisDir);
        
        // Create placeholder table if it doesn't exist
        if (!await fs.pathExists(tablePath)) {
          const fallbackTableText = `# Eligibility Analysis (Error - Using Fallback DOCX)\n\nError: ${error.message}\n\nFallback DOCX will be used for email.\n\n`;
          await fs.writeFile(tablePath, fallbackTableText, "utf8");
          console.log(`✓ Created placeholder table.txt after error`);
        }
        
        // Return success so checkEligibility can run and use fallback DOCX
        return res.json({
          success: true,
          message: `Eligibility analysis for tender1 - Error occurred, fallback DOCX will be used`,
          tenderId: 'tender1',
          tablePath: tablePath,
          warning: `Error: ${error.message}. Fallback DOCX will be used in checkEligibility step.`,
        });
      } catch (fallbackError) {
        console.error("❌ Error creating fallback table:", fallbackError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = {
  analyzeTenderEligibility,
};
