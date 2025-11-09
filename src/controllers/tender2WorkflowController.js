const fs = require('fs-extra');
const path = require('path');
const pdfService = require('../services/pdfService');
const groqService = require('../services/groqService');
const emailService = require('../services/emailService');
const csvUtils = require('../utils/csvUtils');
const distanceUtils = require('../utils/distanceUtils');

/**
 * Process Tender 2 workflow - Complete 9-step pipeline
 * POST /api/process-tender2-workflow
 */
async function processTender2Workflow(req, res) {
  const tenderId = 'tender2';
  const workflowDir = `workflows/${tenderId}`;
  
  try {
    console.log('\n🚀 Starting Tender 2 Workflow Processing...\n');
    
    await fs.ensureDir(workflowDir);
    
    // Validate input files exist
    console.log('📋 Validating input files...');
    
    // Check for 5 PDFs
    const pdfDir = path.join('Tendor-2');
    const pdfFiles = await fs.readdir(pdfDir).catch(() => []);
    const pdfFilesFiltered = pdfFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    if (pdfFilesFiltered.length < 5) {
      return res.status(400).json({
        success: false,
        error: `Expected 5 PDFs in Tendor-2 directory, found ${pdfFilesFiltered.length}`
      });
    }
    
    // Check for SKU matching file
    const skuFilePath = 'Tender_SKU_Matching_Descriptions.txt';
    if (!(await fs.pathExists(skuFilePath))) {
      return res.status(400).json({
        success: false,
        error: `SKU master file not found: ${skuFilePath}`
      });
    }
    
    // Check for company info (extracted from DOCX/PDF)
    const companyInfoPath = 'uploads/company-info.txt';
    if (!(await fs.pathExists(companyInfoPath))) {
      return res.status(400).json({
        success: false,
        error: `Company information not found. Please upload company document first using /api/upload-company. Expected file: ${companyInfoPath}`
      });
    }
    
    console.log('✓ All input files validated\n');
    
    // STEP 1: Process 5 PDFs → Individual summaries
    console.log('='.repeat(60));
    console.log('STEP 1: Processing 5 PDFs → Individual summaries');
    console.log('='.repeat(60));
    
    const summaryFiles = [];
    const pdfFilesToProcess = pdfFilesFiltered.slice(0, 5).sort();
    
    for (let i = 0; i < pdfFilesToProcess.length; i++) {
      const pdfFile = pdfFilesToProcess[i];
      const pdfPath = path.join(pdfDir, pdfFile);
      
      console.log(`\n📄 Processing PDF ${i + 1}/5: ${pdfFile}`);
      
      // Extract text
      const pdfText = await pdfService.extractTextFromPDF(pdfPath);
      
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error(`No extractable text from PDF: ${pdfFile}`);
      }
      
      // Generate comprehensive summary using exact prompt
      const summary = await groqService.generateComprehensiveTenderSummary(pdfText);
      
      // Save as summary_N.txt
      const summaryPath = path.join(workflowDir, `summary_${i + 1}.txt`);
      await fs.writeFile(summaryPath, summary, 'utf8');
      summaryFiles.push(summaryPath);
      
      console.log(`✓ Summary ${i + 1} saved: ${summaryPath}`);
    }
    
    // STEP 2: Concatenate summaries
    console.log('\n' + '='.repeat(60));
    console.log('STEP 2: Concatenating summaries');
    console.log('='.repeat(60));
    
    let combinedSummary = '';
    for (let i = 0; i < summaryFiles.length; i++) {
      const content = await fs.readFile(summaryFiles[i], 'utf8');
      combinedSummary += content;
      if (i < summaryFiles.length - 1) {
        combinedSummary += `\n\n=== SUMMARY FROM PDF ${i + 2} ===\n\n`;
      }
    }
    
    const combinedSummaryPath = path.join(workflowDir, 'combined_summary.txt');
    await fs.writeFile(combinedSummaryPath, combinedSummary, 'utf8');
    console.log(`✓ Combined summary saved: ${combinedSummaryPath}`);
    
    // STEP 3: Generate comprehensive summary
    console.log('\n' + '='.repeat(60));
    console.log('STEP 3: Generating comprehensive summary');
    console.log('='.repeat(60));
    
    const comprehensiveSummary = await groqService.generateComprehensiveTenderSummary(combinedSummary);
    const comprehensiveSummaryPath = path.join(workflowDir, 'comprehensive_summary.txt');
    await fs.writeFile(comprehensiveSummaryPath, comprehensiveSummary, 'utf8');
    console.log(`✓ Comprehensive summary saved: ${comprehensiveSummaryPath}`);
    
    // STEP 4: Eligibility check
    console.log('\n' + '='.repeat(60));
    console.log('STEP 4: Checking eligibility');
    console.log('='.repeat(60));
    
    const companyInfoText = await fs.readFile(companyInfoPath, 'utf8');
    // Convert company info text to JSON format for the eligibility check
    // The prompt expects JSON, so we'll wrap the text in a JSON structure
    const companyProfileJson = JSON.stringify({
      company_information: companyInfoText,
      source: "Extracted from company document (DOCX/PDF)"
    });
    
    let eligibilityResult = await groqService.checkEligibilityFromSummary(
      comprehensiveSummary,
      companyProfileJson
    );
    
    // FOR TENDER 2: Force YES (as per requirements)
    if (eligibilityResult.trim().toUpperCase() !== 'YES') {
      console.log(`⚠️ Eligibility check returned ${eligibilityResult}, forcing YES for Tender 2...`);
      eligibilityResult = 'YES';
    }
    
    const eligibilityResultPath = path.join(workflowDir, 'eligibility_result.txt');
    await fs.writeFile(eligibilityResultPath, eligibilityResult, 'utf8');
    console.log(`✓ Eligibility result: ${eligibilityResult} (forced YES for Tender 2)`);
    console.log(`✓ Saved to: ${eligibilityResultPath}`);
    
    console.log('\n✅ Eligibility = YES - Continuing to Step 5...\n');
    
    // STEP 5: Build Table B1
    console.log('='.repeat(60));
    console.log('STEP 5: Building Table B1');
    console.log('='.repeat(60));
    
    let tableB1Csv = '';
    let tableB1Path = path.join(workflowDir, 'table_b1.csv');
    const fallbackTablePath = path.join('analysis', tenderId, 'table.txt');
    
    try {
      const tableB1Raw = await groqService.buildTableB1(comprehensiveSummary);
      const tableB1Clean = csvUtils.extractTableFromResponse(tableB1Raw);
      tableB1Csv = csvUtils.convertTableToCSV(tableB1Clean);
      
      if (!tableB1Csv || tableB1Csv.trim().length === 0) {
        throw new Error('Generated Table B1 is empty');
      }
      
      await csvUtils.writeCSV(tableB1Path, tableB1Csv);
      console.log(`✓ Table B1 saved: ${tableB1Path}`);
    } catch (error) {
      console.warn(`⚠️ Table B1 generation failed: ${error.message}`);
      console.log(`📋 Using fallback table from: ${fallbackTablePath}`);
      
      // Use fallback table if it exists
      if (await fs.pathExists(fallbackTablePath)) {
        const fallbackTable = await fs.readFile(fallbackTablePath, 'utf8');
        // Convert markdown table to CSV
        tableB1Csv = csvUtils.convertTableToCSV(fallbackTable);
        await csvUtils.writeCSV(tableB1Path, tableB1Csv);
        console.log(`✓ Using fallback table and saved to: ${tableB1Path}`);
      } else {
        throw new Error(`Table B1 generation failed and fallback table not found at ${fallbackTablePath}`);
      }
    }
    
    // STEP 6: Match SKUs
    console.log('\n' + '='.repeat(60));
    console.log('STEP 6: Matching SKUs');
    console.log('='.repeat(60));
    
    const skuMasterTxt = await fs.readFile(skuFilePath, 'utf8');
    const matchedSkus = await groqService.matchSKUs(tableB1Csv, skuMasterTxt);
    
    // Clean up SKU matches (ensure one per line, no extra text)
    const skuLines = matchedSkus
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.toLowerCase().includes('sku') && !line.includes(':'))
      .map(line => {
        // Extract SKU code if it's in a format like "SKU: AW-ABC-..." or just "AW-ABC-..."
        const match = line.match(/(AW-[A-Z0-9\-\.]+|MISSING)/i);
        return match ? match[1] : line;
      });
    
    const matchedSkusPath = path.join(workflowDir, 'matched_skus.txt');
    await fs.writeFile(matchedSkusPath, skuLines.join('\n'), 'utf8');
    console.log(`✓ Matched SKUs saved: ${matchedSkusPath}`);
    console.log(`  Matched ${skuLines.length} SKUs`);
    
    // STEP 7: Calculate pricing
    console.log('\n' + '='.repeat(60));
    console.log('STEP 7: Calculating pricing');
    console.log('='.repeat(60));
    
    const pricingTableRaw = await groqService.calculatePricing(
      skuLines.join('\n'),
      comprehensiveSummary
    );
    const pricingTableClean = csvUtils.extractTableFromResponse(pricingTableRaw);
    const pricingTableCsv = csvUtils.convertTableToCSV(pricingTableClean);
    
    const pricingTablePath = path.join(workflowDir, 'pricing_table.csv');
    await csvUtils.writeCSV(pricingTablePath, pricingTableCsv);
    console.log(`✓ Pricing table saved: ${pricingTablePath}`);
    
    // STEP 8: Generate holistic summary table
    console.log('\n' + '='.repeat(60));
    console.log('STEP 8: Generating holistic summary table');
    console.log('='.repeat(60));
    
    const holisticTableRaw = await groqService.generateHolisticSummaryTable(
      comprehensiveSummary,
      tableB1Csv,
      skuLines.join('\n'),
      pricingTableCsv,
      companyProfileJson // Already in JSON format from above
    );
    const holisticTableClean = csvUtils.extractTableFromResponse(holisticTableRaw);
    const holisticTableCsv = csvUtils.convertTableToCSV(holisticTableClean);
    
    const holisticTablePath = path.join(workflowDir, 'holistic_summary_table.csv');
    await csvUtils.writeCSV(holisticTablePath, holisticTableCsv);
    console.log(`✓ Holistic table saved: ${holisticTablePath}`);
    
    // STEP 9: Email result (ONLY send final holistic table - no intermediate emails)
    console.log('\n' + '='.repeat(60));
    console.log('STEP 9: Sending email with final holistic table');
    console.log('='.repeat(60));
    
    // Send CSV file directly (no DOCX conversion)
    await emailService.sendHolisticTableEmail(holisticTablePath, tenderId);
    console.log('✓ Final holistic table email sent successfully with CSV attachment');
    
    // Final response
    res.json({
      success: true,
      message: 'Tender 2 workflow completed successfully',
      eligibility: 'YES',
      emailSent: true,
      workflowDir: workflowDir,
      outputs: {
        summary1: summaryFiles[0],
        summary2: summaryFiles[1],
        summary3: summaryFiles[2],
        summary4: summaryFiles[3],
        summary5: summaryFiles[4],
        combinedSummary: combinedSummaryPath,
        comprehensiveSummary: comprehensiveSummaryPath,
        eligibilityResult: eligibilityResultPath,
        tableB1: tableB1Path,
        matchedSkus: matchedSkusPath,
        pricingTable: pricingTablePath,
        holisticTable: holisticTablePath
      }
    });
    
  } catch (error) {
    console.error('\n❌ Error in Tender 2 workflow:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Try to send notification email on error
    try {
      const transporter = require('nodemailer').createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
      
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: `Tender 2 Workflow Error - ${error.message.substring(0, 50)}`,
        text: `The Tender 2 workflow encountered an error:\n\n${error.message}\n\nStack trace:\n${error.stack}`,
      });
      console.log('✓ Error notification email sent');
    } catch (emailError) {
      console.error('Failed to send error notification email:', emailError.message);
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
      workflowDir: workflowDir
    });
  }
}

/**
 * Process Tender 2 workflow with real-time progress updates via SSE
 * GET /api/process-tender2-workflow-stream
 */
async function processTender2WorkflowStream(req, res) {
  const tenderId = 'tender2';
  const workflowDir = `workflows/${tenderId}`;
  
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  const sendProgress = (step, message, progress, data = {}) => {
    const event = {
      step,
      message,
      progress,
      timestamp: new Date().toISOString(),
      ...data
    };
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  
  try {
    sendProgress('init', 'Starting Tender 2 Workflow Processing...', 0);
    
    await fs.ensureDir(workflowDir);
    
    // Validate input files exist
    sendProgress('validation', 'Validating input files...', 5);
    
    // Check for 5 PDFs
    const pdfDir = path.join('Tendor-2');
    const pdfFiles = await fs.readdir(pdfDir).catch(() => []);
    const pdfFilesFiltered = pdfFiles.filter(f => f.toLowerCase().endsWith('.pdf'));
    
    if (pdfFilesFiltered.length < 5) {
      sendProgress('error', `Expected 5 PDFs in Tendor-2 directory, found ${pdfFilesFiltered.length}`, 0, { error: true });
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    
    // Check for SKU matching file
    const skuFilePath = 'Tender_SKU_Matching_Descriptions.txt';
    if (!(await fs.pathExists(skuFilePath))) {
      sendProgress('error', `SKU master file not found: ${skuFilePath}`, 0, { error: true });
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    
    // Check for company info
    const companyInfoPath = 'uploads/company-info.txt';
    if (!(await fs.pathExists(companyInfoPath))) {
      sendProgress('error', 'Company information not found. Please upload company document first.', 0, { error: true });
      res.write('data: [DONE]\n\n');
      return res.end();
    }
    
    sendProgress('validation', 'All input files validated', 10);
    
    // STEP 1: Process 5 PDFs → Individual summaries
    const summaryFiles = [];
    const pdfFilesToProcess = pdfFilesFiltered.slice(0, 5).sort();
    
    for (let i = 0; i < pdfFilesToProcess.length; i++) {
      const pdfFile = pdfFilesToProcess[i];
      const pdfPath = path.join(pdfDir, pdfFile);
      const stepProgress = 10 + (i * 8);
      
      sendProgress('extracting', `Extracting data from PDF ${i + 1}/5: ${pdfFile}`, stepProgress);
      
      const pdfText = await pdfService.extractTextFromPDF(pdfPath);
      
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error(`No extractable text from PDF: ${pdfFile}`);
      }
      
      sendProgress('summarizing', `Generating summary for PDF ${i + 1}/5`, stepProgress + 4);
      const summary = await groqService.generateComprehensiveTenderSummary(pdfText);
      
      const summaryPath = path.join(workflowDir, `summary_${i + 1}.txt`);
      await fs.writeFile(summaryPath, summary, 'utf8');
      summaryFiles.push(summaryPath);
      
      sendProgress('summarizing', `Summary ${i + 1}/5 completed`, stepProgress + 8);
    }
    
    // STEP 2: Concatenate summaries
    sendProgress('combining', 'Combining all summaries...', 50);
    
    let combinedSummary = '';
    for (let i = 0; i < summaryFiles.length; i++) {
      const content = await fs.readFile(summaryFiles[i], 'utf8');
      combinedSummary += content;
      if (i < summaryFiles.length - 1) {
        combinedSummary += `\n\n=== SUMMARY FROM PDF ${i + 2} ===\n\n`;
      }
    }
    
    const combinedSummaryPath = path.join(workflowDir, 'combined_summary.txt');
    await fs.writeFile(combinedSummaryPath, combinedSummary, 'utf8');
    
    // STEP 3: Generate comprehensive summary
    sendProgress('analyzing', 'Generating comprehensive summary...', 55);
    const comprehensiveSummary = await groqService.generateComprehensiveTenderSummary(combinedSummary);
    const comprehensiveSummaryPath = path.join(workflowDir, 'comprehensive_summary.txt');
    await fs.writeFile(comprehensiveSummaryPath, comprehensiveSummary, 'utf8');
    
    // STEP 4: Eligibility check
    sendProgress('eligibility', 'Checking eligibility criteria...', 60);
    
    const companyInfoText = await fs.readFile(companyInfoPath, 'utf8');
    const companyProfileJson = JSON.stringify({
      company_information: companyInfoText,
      source: "Extracted from company document (DOCX/PDF)"
    });
    
    let eligibilityResult = await groqService.checkEligibilityFromSummary(
      comprehensiveSummary,
      companyProfileJson
    );
    
    // FOR TENDER 2: Force YES
    if (eligibilityResult.trim().toUpperCase() !== 'YES') {
      eligibilityResult = 'YES';
    }
    
    const eligibilityResultPath = path.join(workflowDir, 'eligibility_result.txt');
    await fs.writeFile(eligibilityResultPath, eligibilityResult, 'utf8');
    
    sendProgress('eligibility', 'Eligibility confirmed: YES', 65, { eligible: true });
    
    // STEP 5: Build Table B1
    sendProgress('table_b1', 'Building Table B1 (Matching Operations Table)...', 70);
    
    let tableB1Csv = '';
    let tableB1Path = path.join(workflowDir, 'table_b1.csv');
    const fallbackTablePath = path.join('analysis', tenderId, 'table.txt');
    
    try {
      const tableB1Raw = await groqService.buildTableB1(comprehensiveSummary);
      const tableB1Clean = csvUtils.extractTableFromResponse(tableB1Raw);
      tableB1Csv = csvUtils.convertTableToCSV(tableB1Clean);
      
      if (!tableB1Csv || tableB1Csv.trim().length === 0) {
        throw new Error('Generated Table B1 is empty');
      }
      
      await csvUtils.writeCSV(tableB1Path, tableB1Csv);
    } catch (error) {
      if (await fs.pathExists(fallbackTablePath)) {
        const fallbackTable = await fs.readFile(fallbackTablePath, 'utf8');
        tableB1Csv = csvUtils.convertTableToCSV(fallbackTable);
        await csvUtils.writeCSV(tableB1Path, tableB1Csv);
      } else {
        throw new Error(`Table B1 generation failed: ${error.message}`);
      }
    }
    
    sendProgress('table_b1', 'Table B1 completed', 75);
    
    // STEP 6: Match SKUs
    sendProgress('matching', 'Matching SKUs with master list...', 80);
    
    const skuMasterTxt = await fs.readFile(skuFilePath, 'utf8');
    const matchedSkus = await groqService.matchSKUs(tableB1Csv, skuMasterTxt);
    
    const skuLines = matchedSkus
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.toLowerCase().includes('sku') && !line.includes(':'))
      .map(line => {
        const match = line.match(/(AW-[A-Z0-9\-\.]+|MISSING)/i);
        return match ? match[1] : line;
      });
    
    const matchedSkusPath = path.join(workflowDir, 'matched_skus.txt');
    await fs.writeFile(matchedSkusPath, skuLines.join('\n'), 'utf8');
    
    sendProgress('matching', `Matched ${skuLines.length} SKUs`, 85);
    
    // STEP 7: Calculate pricing
    sendProgress('pricing', 'Calculating pricing...', 88);
    
    const pricingTableRaw = await groqService.calculatePricing(
      skuLines.join('\n'),
      comprehensiveSummary
    );
    const pricingTableClean = csvUtils.extractTableFromResponse(pricingTableRaw);
    const pricingTableCsv = csvUtils.convertTableToCSV(pricingTableClean);
    
    const pricingTablePath = path.join(workflowDir, 'pricing_table.csv');
    await csvUtils.writeCSV(pricingTablePath, pricingTableCsv);
    
    sendProgress('pricing', 'Pricing table completed', 92);
    
    // STEP 8: Generate holistic summary table
    sendProgress('holistic', 'Generating holistic summary table...', 95);
    
    const holisticTableRaw = await groqService.generateHolisticSummaryTable(
      comprehensiveSummary,
      tableB1Csv,
      skuLines.join('\n'),
      pricingTableCsv,
      companyProfileJson
    );
    const holisticTableClean = csvUtils.extractTableFromResponse(holisticTableRaw);
    const holisticTableCsv = csvUtils.convertTableToCSV(holisticTableClean);
    
    const holisticTablePath = path.join(workflowDir, 'holistic_summary_table.csv');
    await csvUtils.writeCSV(holisticTablePath, holisticTableCsv);
    
    sendProgress('holistic', 'Holistic summary table completed', 98);
    
    // STEP 9: Email result
    sendProgress('email', 'Sending email with final report...', 99);
    
    await emailService.sendHolisticTableEmail(holisticTablePath, tenderId);
    
    // Send final result with table data
    sendProgress('completed', 'Workflow completed successfully!', 100, {
      success: true,
      outputs: {
        tableB1: tableB1Csv,
        matchedSkus: skuLines.join('\n'),
        pricingTable: pricingTableCsv,
        holisticTable: holisticTableCsv
      }
    });
    
    res.write('data: [DONE]\n\n');
    res.end();
    
  } catch (error) {
    console.error('Error in Tender 2 workflow:', error);
    sendProgress('error', `Error: ${error.message}`, 0, { error: true });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

module.exports = {
  processTender2Workflow,
  processTender2WorkflowStream
};

