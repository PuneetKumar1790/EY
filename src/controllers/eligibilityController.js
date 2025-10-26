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
    const result = await groqService.checkFinalEligibility(eligibilityTable);
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

    // Step 3: If NOT eligible, generate DOCX and send email
    if (!isEligible) {
      console.log('📧 Company is not eligible - generating report and sending email...');
      
      // Generate DOCX
      const docxPath = await docService.createDocxFromTable(eligibilityTable, tenderId);
      console.log(`✓ DOCX report generated: ${docxPath}`);
      
      // Send email
      await emailService.sendEligibilityEmail(docxPath, tenderId);
      console.log(`✓ Email sent successfully`);
      
      response.emailSent = true;
      response.docxPath = docxPath;
    } else {
      response.emailSent = false;
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Error in checkEligibility:', error.message);
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

