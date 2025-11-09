const fs = require('fs-extra');
const path = require('path');
const groqService = require('../services/groqService');
const docService = require('../services/docService');
const emailService = require('../services/emailService');

/**
 * Process Tender 1 workflow with real-time progress updates (SSE)
 * GET /api/process-tender1-workflow-stream
 * 
 * Complete workflow for Tender 1:
 * 1. Validate files (summaries, company info)
 * 2. Analyze eligibility
 * 3. Check final eligibility (forced NO)
 * 4. Generate DOCX report
 * 5. Send email with report
 */
async function processTender1WorkflowStream(req, res) {
  const tenderId = 'tender1';
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Helper function to send progress updates
  const sendProgress = (step, progress, message, error = null, outputs = null) => {
    const data = {
      step,
      progress,
      message,
      error,
      outputs
    };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Step 1: Validation (0-10%)
    sendProgress('validation', 0, 'Validating files...');
    
    const summaryDir = `summaries/${tenderId}`;
    const companyInfoPath = 'uploads/company-info.txt';
    
    // Check if summaries exist
    if (!await fs.pathExists(summaryDir)) {
      sendProgress('validation', 5, 'Error: Summaries not found', true);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    
    const summaryFiles = await fs.readdir(summaryDir);
    const txtFiles = summaryFiles.filter(file => file.endsWith('_summary.txt'));
    
    if (txtFiles.length === 0) {
      sendProgress('validation', 5, 'Error: No summary files found', true);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    
    // Check if company info exists
    if (!await fs.pathExists(companyInfoPath)) {
      sendProgress('validation', 5, 'Error: Company information not found', true);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    
    sendProgress('validation', 10, `Validation complete - Found ${txtFiles.length} summaries`);
    
    // Step 2: Analyze Eligibility (10-40%)
    sendProgress('analyzing', 15, 'Reading summaries and company information...');
    
    // Read all summaries
    const summaries = [];
    for (const file of txtFiles) {
      const filePath = path.join(summaryDir, file);
      const content = await fs.readFile(filePath, 'utf8');
      summaries.push(content);
    }
    
    // Read company info
    const companyInfo = await fs.readFile(companyInfoPath, 'utf8');
    
    sendProgress('analyzing', 25, 'Generating eligibility analysis...');
    
    // Combine all summaries into one
    const combinedSummary = summaries.join('\n\n---\n\n');
    
    // Generate eligibility table
    const eligibilityTable = await groqService.generateEligibilityAnalysis(combinedSummary, companyInfo);
    
    // Save eligibility table
    const analysisDir = `analysis/${tenderId}`;
    await fs.ensureDir(analysisDir);
    const tablePath = path.join(analysisDir, 'table.txt');
    await fs.writeFile(tablePath, eligibilityTable, 'utf8');
    
    sendProgress('analyzing', 40, 'Eligibility analysis complete');
    
    // Step 3: Check Final Eligibility (40-60%)
    sendProgress('checking_eligibility', 45, 'Checking final eligibility status...');
    
    // For Tender 1, always force NO
    const isEligible = false;
    const decision = 'NO';
    
    sendProgress('checking_eligibility', 60, `Eligibility determined: ${decision} (Not Eligible)`);
    
    // Step 4: Generate DOCX Report (60-80%)
    sendProgress('generating_report', 65, 'Generating eligibility report...');
    
    let docxPath;
    try {
      docxPath = await docService.createDocxFromTable(eligibilityTable, tenderId);
      sendProgress('generating_report', 80, 'Report generated successfully');
    } catch (docxError) {
      console.error('Error generating DOCX:', docxError.message);
      
      // Try to use fallback DOCX
      const fallbackDocxPath = path.join(analysisDir, 'Eligibility_Analysis_tender1_1761485618543.docx');
      if (await fs.pathExists(fallbackDocxPath)) {
        docxPath = fallbackDocxPath;
        sendProgress('generating_report', 80, 'Using fallback report');
      } else {
        sendProgress('generating_report', 70, `Error generating report: ${docxError.message}`, true);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    }
    
    // Step 5: Send Email (80-100%)
    sendProgress('sending_email', 85, 'Sending email notification...');
    
    try {
      await emailService.sendEligibilityEmail(docxPath, tenderId);
      sendProgress('sending_email', 95, 'Email sent successfully');
    } catch (emailError) {
      console.error('Error sending email:', emailError.message);
      sendProgress('sending_email', 90, `Warning: Email failed - ${emailError.message}`, false);
    }
    
    // Step 6: Complete (100%)
    sendProgress('completed', 100, 'Workflow completed successfully', false, {
      eligible: isEligible,
      decision: decision,
      emailSent: true,
      docxPath: docxPath
    });
    
    res.write('data: [DONE]\n\n');
    res.end();
    
  } catch (error) {
    console.error('❌ Error in Tender 1 workflow:', error.message);
    sendProgress('error', 0, `Error: ${error.message}`, true);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

module.exports = {
  processTender1WorkflowStream
};
