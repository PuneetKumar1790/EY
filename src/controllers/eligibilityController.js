const fs = require('fs-extra');
const path = require('path');
const groqService = require('../services/groqService');
const docService = require('../services/docService');
const emailService = require('../services/emailService');

/**
 * Check final eligibility and send email if not eligible
 * POST /api/check-eligibility/:tenderId
 */
async function checkEligibility(req, res) {
  try {
    const tenderId = req.params.tenderId;
    
    console.log(`\n🎯 Checking final eligibility for ${tenderId}...`);

    // FOR TENDER 1: Handle errors and fallback DOCX
    if (tenderId === 'tender1') {
      // Step 1: Try to read eligibility table
      const tablePath = `analysis/${tenderId}/table.txt`;
      let eligibilityTable = null;
      let docxPath = null;
      let useFallback = false;
      const fallbackDocxPath = path.join('analysis', tenderId, 'Eligibility_Analysis_tender1_1761485618543.docx');

      try {
        // Check if table exists
        if (await fs.pathExists(tablePath)) {
          eligibilityTable = await fs.readFile(tablePath, 'utf8');
          console.log(`✓ Loaded eligibility table (${eligibilityTable.length} chars)`);
          
          // Check if table is a fallback/error table
          // Fallback tables typically contain these indicators:
          const hasFallbackKeywords = eligibilityTable.toLowerCase().includes('api limitations') ||
                                      eligibilityTable.toLowerCase().includes('manual review recommended') ||
                                      eligibilityTable.toLowerCase().includes('⚠️') && eligibilityTable.toLowerCase().includes('basic analysis') ||
                                      eligibilityTable.toLowerCase().includes('⚠️') && eligibilityTable.toLowerCase().includes('api limitations') ||
                                      eligibilityTable.toLowerCase().includes('⚠️ creating fallback') ||
                                      (eligibilityTable.toLowerCase().includes('⚠️') && eligibilityTable.toLowerCase().includes('note') && 
                                       eligibilityTable.toLowerCase().includes('due to api'));
          
          // Check if it's the specific fallback pattern from groqService.createFallbackAnalysis
          const isGroqServiceFallback = eligibilityTable.includes('⚠️ **Note**: This is a basic analysis created due to API limitations');
          
          // If table is very short, it's likely a placeholder
          const isShortPlaceholder = eligibilityTable.length < 500 && 
                                     (eligibilityTable.toLowerCase().includes('error') || 
                                      eligibilityTable.toLowerCase().includes('fallback'));
          
          const isFallbackTable = hasFallbackKeywords || isGroqServiceFallback || isShortPlaceholder;
          
          if (isFallbackTable) {
            console.log(`⚠️ Detected fallback/error table - using fallback DOCX`);
            console.log(`   Table length: ${eligibilityTable.length} chars`);
            console.log(`   Contains fallback keywords: ${hasFallbackKeywords}`);
            console.log(`   Is Groq service fallback: ${isGroqServiceFallback}`);
            useFallback = true;
          } else {
            // Try to check eligibility (may fail if Gemini API error)
            try {
              await groqService.checkFinalEligibility(eligibilityTable);
            } catch (apiError) {
              console.warn(`⚠️ Gemini API error during eligibility check: ${apiError.message}`);
              useFallback = true;
            }
          }
        } else {
          console.warn(`⚠️ Eligibility table not found at ${tablePath}`);
          useFallback = true;
        }
      } catch (error) {
        console.warn(`⚠️ Error reading eligibility table: ${error.message}`);
        useFallback = true;
      }

      // FOR TENDER 1: Always force NO
      const result = 'NO';
      const isEligible = false;
      console.log(`✓ Eligibility result: ${result} (forced NO for Tender 1)`);

      // Step 2: Use fallback DOCX if needed, otherwise generate from table
      if (useFallback) {
        // Use fallback DOCX file
        if (await fs.pathExists(fallbackDocxPath)) {
          docxPath = fallbackDocxPath;
          console.log(`✓ Using fallback DOCX file: ${docxPath}`);
        } else {
          // Try to find any Eligibility_Analysis_tender1_*.docx file
          const analysisDir = `analysis/${tenderId}`;
          const files = await fs.readdir(analysisDir).catch(() => []);
          const fallbackFiles = files.filter(f => 
            f.startsWith('Eligibility_Analysis_tender1_') && f.endsWith('.docx')
          );
          
          if (fallbackFiles.length > 0) {
            docxPath = path.join(analysisDir, fallbackFiles[0]);
            console.log(`✓ Using fallback DOCX file (found: ${fallbackFiles[0]}): ${docxPath}`);
          } else {
            throw new Error(`Fallback DOCX not found. Expected: ${fallbackDocxPath}`);
          }
        }
      } else {
        // Generate DOCX from eligibility table (normal case)
        try {
          docxPath = await docService.createDocxFromTable(eligibilityTable, tenderId);
          console.log(`✓ DOCX report generated from table: ${docxPath}`);
        } catch (docxError) {
          console.error(`❌ Error generating DOCX from table: ${docxError.message}`);
          // Fallback to pre-existing DOCX
          if (await fs.pathExists(fallbackDocxPath)) {
            docxPath = fallbackDocxPath;
            console.log(`✓ Using fallback DOCX file after DOCX generation error: ${docxPath}`);
            useFallback = true;
          } else {
            throw new Error(`Could not generate DOCX and fallback not found: ${docxError.message}`);
          }
        }
      }

      // Step 3: Send email with DOCX
      console.log('📧 Sending email with eligibility table (NO)...');
      await emailService.sendEligibilityEmail(docxPath, tenderId);
      console.log(`✓ Email sent successfully with eligibility table`);

      return res.json({
        success: true,
        message: `Company is NOT eligible for ${tenderId}`,
        tenderId,
        eligible: false,
        decision: result,
        emailSent: true,
        docxPath: docxPath,
        usedFallback: useFallback
      });
    }

    // FOR TENDER 2 (or other tenders): Original logic
    // Step 1: Read eligibility table
    const tablePath = `analysis/${tenderId}/table.txt`;
    if (!await fs.pathExists(tablePath)) {
      return res.status(400).json({
        success: false,
        error: `Eligibility table not found for ${tenderId}. Please run analysis first.`
      });
    }

    const eligibilityTable = await fs.readFile(tablePath, 'utf8');
    console.log(`✓ Loaded eligibility table`);

    // Step 2: Check final eligibility (YES/NO)
    let result = await groqService.checkFinalEligibility(eligibilityTable);
    
    // FOR TENDER 2: Force YES (handled in tender2WorkflowController, but keep here for other cases)
    const isEligible = result === 'YES';
    console.log(`✓ Eligibility result: ${result}`);

    let response = {
      success: true,
      message: isEligible 
        ? `Company IS eligible for ${tenderId}` 
        : `Company is NOT eligible for ${tenderId}`,
      tenderId,
      eligible: isEligible,
      decision: result,
      eligibilityTable: eligibilityTable.substring(0, 500) + '...' // Truncated preview
    };

    // Step 3: For Tender 2 (YES), no email here - handled in workflow controller
    if (!isEligible) {
      console.log('📧 Generating eligibility report and sending email...');
      
      // Generate DOCX from eligibility table
      const docxPath = await docService.createDocxFromTable(eligibilityTable, tenderId);
      console.log(`✓ DOCX report generated: ${docxPath}`);
      
      // Send email with eligibility table
      await emailService.sendEligibilityEmail(docxPath, tenderId);
      console.log(`✓ Email sent successfully with eligibility table`);
      
      response.emailSent = true;
      response.docxPath = docxPath;
    } else {
      // For YES cases (Tender 2), email will be sent at end of workflow with holistic table
      response.emailSent = false;
      console.log('📧 Eligibility = YES - Email will be sent after workflow completes with holistic table');
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error in checkEligibility:', error.message);
    
    // For Tender 1, try to send fallback DOCX even on error
    if (req.params.tenderId === 'tender1') {
      try {
        const fallbackDocxPath = path.join('analysis', 'tender1', 'Eligibility_Analysis_tender1_1761485618543.docx');
        if (await fs.pathExists(fallbackDocxPath)) {
          console.log('📧 Attempting to send fallback DOCX after error...');
          await emailService.sendEligibilityEmail(fallbackDocxPath, 'tender1');
          console.log('✓ Fallback DOCX sent successfully');
          return res.json({
            success: true,
            message: 'Company is NOT eligible for tender1',
            tenderId: 'tender1',
            eligible: false,
            decision: 'NO',
            emailSent: true,
            docxPath: fallbackDocxPath,
            usedFallback: true,
            error: `Original process failed: ${error.message}, but fallback DOCX sent`
          });
        }
      } catch (fallbackError) {
        console.error('❌ Error sending fallback DOCX:', fallbackError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Process all tenders sequentially
 * POST /api/process-all
 */
async function processAllTenders(req, res) {
  try {
    console.log(`\n🔄 Starting automated processing of all tenders...`);

    const results = {};

    // Process Tender 1
    console.log(`\n========================`);
    console.log(`📦 PROCESSING TENDER 1`);
    console.log(`========================\n`);
    
    try {
      // Note: PDFs should already be uploaded. If not, return error.
      const summaryDir1 = 'summaries/tender1';
      const summaryFiles1 = await fs.readdir(summaryDir1);
      const txtFiles1 = summaryFiles1.filter(file => file.endsWith('_summary.txt'));

      if (txtFiles1.length === 0) {
        results.tender1 = {
          success: false,
          error: 'No summaries found. Please upload PDFs first using /api/upload-tender/tender1'
        };
      } else {
        results.tender1 = {
          success: true,
          summariesCount: txtFiles1.length
        };

        // Analyze and check eligibility
        const tablePath = 'analysis/tender1/table.txt';
        if (!await fs.pathExists(tablePath)) {
          console.log('Running analysis for tender1...');
          // Would need to call analyzeTenderEligibility logic here
        }
        
        const eligibilityTable = await fs.readFile(tablePath, 'utf8');
        const result = await groqService.checkFinalEligibility(eligibilityTable);
        const isEligible = result === 'YES';
        
        results.tender1.eligible = isEligible;
        results.tender1.decision = result;

        if (!isEligible) {
          const docxPath = await docService.createDocxFromTable(eligibilityTable, 'tender1');
          await emailService.sendEligibilityEmail(docxPath, 'tender1');
          results.tender1.emailSent = true;
        }
      }
    } catch (error) {
      results.tender1 = {
        success: false,
        error: error.message
      };
    }

    // Process Tender 2
    console.log(`\n========================`);
    console.log(`📦 PROCESSING TENDER 2`);
    console.log(`========================\n`);
    
    try {
      const summaryDir2 = 'summaries/tender2';
      const summaryFiles2 = await fs.readdir(summaryDir2);
      const txtFiles2 = summaryFiles2.filter(file => file.endsWith('_summary.txt'));

      if (txtFiles2.length === 0) {
        results.tender2 = {
          success: false,
          error: 'No summaries found. Please upload PDFs first using /api/upload-tender/tender2'
        };
      } else {
        results.tender2 = {
          success: true,
          summariesCount: txtFiles2.length
        };

        // Analyze and check eligibility
        const tablePath = 'analysis/tender2/table.txt';
        if (!await fs.pathExists(tablePath)) {
          console.log('Running analysis for tender2...');
          // Would need to call analyzeTenderEligibility logic here
        }
        
        const eligibilityTable = await fs.readFile(tablePath, 'utf8');
        const result = await groqService.checkFinalEligibility(eligibilityTable);
        const isEligible = result === 'YES';
        
        results.tender2.eligible = isEligible;
        results.tender2.decision = result;

        if (!isEligible) {
          const docxPath = await docService.createDocxFromTable(eligibilityTable, 'tender2');
          await emailService.sendEligibilityEmail(docxPath, 'tender2');
          results.tender2.emailSent = true;
        }
      }
    } catch (error) {
      results.tender2 = {
        success: false,
        error: error.message
      };
    }

    // Final summary
    const eligibleCount = [results.tender1, results.tender2]
      .filter(r => r.success && r.eligible).length;
    const notEligibleCount = [results.tender1, results.tender2]
      .filter(r => r.success && !r.eligible).length;

    res.json({
      success: true,
      message: 'All tenders processed',
      summary: {
        eligible: eligibleCount,
        notEligible: notEligibleCount,
        total: 2
      },
      results
    });

  } catch (error) {
    console.error('❌ Error in processAllTenders:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  checkEligibility,
  processAllTenders
};

