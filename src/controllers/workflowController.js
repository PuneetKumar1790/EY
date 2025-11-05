const fs = require('fs-extra');
const path = require('path');
const pdfService = require('../services/pdfService');
const groqService = require('../services/groqService');
const emailService = require('../services/emailService');
const docService = require('../services/docService');
const analysisController = require('./analysisController');
const eligibilityController = require('./eligibilityController');
const statusService = require('../services/statusService');

/**
 * Process tender workflow with status updates
 * POST /api/process-workflow/:tenderId
 */
async function processWorkflow(req, res) {
  const tenderId = req.params.tenderId;
  
  // Start processing in background
  processWorkflowAsync(tenderId).catch(error => {
    console.error(`Error in workflow for ${tenderId}:`, error);
    statusService.updateStatus(tenderId, {
      status: 'error',
      error: error.message,
      completed: true
    });
  });

  // Return immediately
  res.json({
    success: true,
    message: `Workflow started for ${tenderId}`,
    tenderId
  });
}

/**
 * Async workflow processing with status updates
 */
async function processWorkflowAsync(tenderId) {
  try {
    statusService.updateStatus(tenderId, {
      status: 'processing',
      currentStep: 'analyzing',
      progress: 0,
      message: 'Starting workflow...'
    });

    // Step 1: Check if summaries exist, if not, process PDFs from folders
    statusService.updateStatus(tenderId, {
      currentStep: 'analyzing',
      progress: 10,
      message: 'Checking for existing summaries...'
    });

    const summaryDir = `summaries/${tenderId}`;
    await fs.ensureDir(summaryDir);
    
    let summaryFiles = [];
    let txtFiles = [];
    
    // Check if summaries already exist
    if (await fs.pathExists(summaryDir)) {
      summaryFiles = await fs.readdir(summaryDir);
      txtFiles = summaryFiles.filter((file) =>
        file.endsWith("_summary.txt")
      );
    }

    // If no summaries exist, process PDFs from the folder
    if (txtFiles.length === 0) {
      statusService.updateStatus(tenderId, {
        currentStep: 'analyzing',
        progress: 15,
        message: 'Processing PDFs from folder...'
      });

      // Map tender IDs to folder names
      const folderMap = {
        'tender1': 'Tendor-1',
        'tender2': 'Tendor-2'
      };

      const pdfFolder = folderMap[tenderId];
      if (!pdfFolder) {
        throw new Error(`Unknown tender ID: ${tenderId}`);
      }

      const pdfFolderPath = path.join(pdfFolder);
      
      // Check if PDF folder exists
      if (!(await fs.pathExists(pdfFolderPath))) {
        throw new Error(`PDF folder not found: ${pdfFolder}`);
      }

      // Get all PDF files from the folder
      const allFiles = await fs.readdir(pdfFolderPath);
      const pdfFiles = allFiles
        .filter(file => file.toLowerCase().endsWith('.pdf'))
        .sort()
        .slice(0, 5); // Take first 5 PDFs

      if (pdfFiles.length === 0) {
        throw new Error(`No PDF files found in ${pdfFolder} folder`);
      }

      statusService.updateStatus(tenderId, {
        currentStep: 'analyzing',
        progress: 20,
        message: `Processing ${pdfFiles.length} PDFs and generating summaries...`
      });

      // Process each PDF: extract text and generate summary
      const errors = [];
      for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i];
        const pdfPath = path.join(pdfFolderPath, pdfFile);
        
        statusService.updateStatus(tenderId, {
          currentStep: 'analyzing',
          progress: 20 + Math.floor((i / pdfFiles.length) * 15),
          message: `Processing PDF ${i + 1}/${pdfFiles.length}: ${pdfFile}...`
        });

        try {
          // Extract text from PDF
          const text = await pdfService.extractTextFromPDF(pdfPath);
          
          if (!text || text.trim().length === 0) {
            console.warn(`⚠️ Skipping ${pdfFile} - no text content`);
            continue;
          }

          // Generate summary using Groq
          const summary = await groqService.generateSummary(text);
          
          // Save summary
          const summaryFileName = `${path.parse(pdfFile).name}_summary.txt`;
          const summaryPath = path.join(summaryDir, summaryFileName);
          await fs.writeFile(summaryPath, summary, 'utf8');
          
          txtFiles.push(summaryFileName);
          console.log(`✓ Summary saved: ${summaryPath}`);
        } catch (pdfError) {
          const errorMsg = pdfError?.message || pdfError?.toString() || 'Unknown error';
          errors.push({ file: pdfFile, error: errorMsg });
          console.error(`Error processing PDF ${pdfFile}:`, errorMsg);
          // Continue with other PDFs but track the error
          // Don't fail completely if at least one PDF processes
        }
      }

      if (txtFiles.length === 0) {
        // Check if it's an API key issue
        const hasApiKeyError = errors.some(e => 
          e.error.includes('API key') || 
          e.error.includes('No Gemini API keys') ||
          e.error.includes('GEMINI_API_KEY')
        );
        
        if (hasApiKeyError) {
          throw new Error(`Failed to process PDFs: No Gemini API keys configured. Please set GEMINI_API_KEY_1 in your .env file. See env.template for instructions. Get your API key from: https://ai.google.dev/`);
        }
        
        const errorSummary = errors.length > 0 
          ? ` Errors: ${errors.map(e => `${e.file}: ${e.error}`).join('; ')}`
          : '';
        throw new Error(`Failed to process any PDFs from ${pdfFolder} folder. All ${pdfFiles.length} PDF(s) failed to process.${errorSummary}`);
      }

      statusService.updateStatus(tenderId, {
        currentStep: 'analyzing',
        progress: 35,
        message: `Successfully processed ${txtFiles.length} PDFs. Generating eligibility analysis...`
      });
    }

    // Check if analysis already exists
    const tablePath = `analysis/${tenderId}/table.txt`;
    if (!(await fs.pathExists(tablePath))) {

      // Concatenate summaries
      statusService.updateStatus(tenderId, {
        currentStep: 'analyzing',
        progress: 40,
        message: 'Combining summaries and analyzing eligibility...'
      });

      let comprehensiveSummary = "";
      for (const file of txtFiles) {
        const filePath = path.join(summaryDir, file);
        const content = await fs.readFile(filePath, "utf8");
        comprehensiveSummary += `\n\n--- ${file} ---\n\n${content}`;
      }

      // Read company info
      const companyInfoPath = "uploads/company-info.txt";
      if (!(await fs.pathExists(companyInfoPath))) {
        throw new Error("Company information not found. Please upload company document first using /api/upload-company");
      }

      statusService.updateStatus(tenderId, {
        currentStep: 'analyzing',
        progress: 50,
        message: 'Generating eligibility analysis table...'
      });

      const companyInfo = await fs.readFile(companyInfoPath, "utf8");

      // Generate eligibility analysis
      const eligibilityTable = await groqService.generateEligibilityAnalysis(
        comprehensiveSummary,
        companyInfo
      );

      // Save eligibility table
      const analysisDir = `analysis/${tenderId}`;
      await fs.ensureDir(analysisDir);
      await fs.writeFile(tablePath, eligibilityTable, "utf8");
      
      statusService.updateStatus(tenderId, {
        currentStep: 'analyzing',
        progress: 55,
        message: 'Eligibility analysis completed...'
      });
    }

    statusService.updateStatus(tenderId, {
      currentStep: 'checking_eligibility',
      progress: 60,
      message: 'Checking final eligibility status...'
    });

    // Step 2: Check eligibility based on actual table analysis
    const eligibilityTable = await fs.readFile(tablePath, 'utf8');
    let result = await groqService.checkFinalEligibility(eligibilityTable);
    
    // Use the actual analysis result (don't force NO/YES anymore)
    // The eligibility should be determined by the actual table content
    const isEligible = result === 'YES';

    statusService.updateStatus(tenderId, {
      currentStep: 'generating_report',
      progress: 75,
      message: isEligible ? 'Eligible - Generating reports...' : 'Not eligible - Generating eligibility report...'
    });

    // Step 3: Generate report and send email (if not eligible)
    let docxPath = null;
    if (!isEligible) {
      docxPath = await docService.createDocxFromTable(eligibilityTable, tenderId);
      
      // Send eligibility table to frontend before email service
      statusService.updateStatus(tenderId, {
        currentStep: 'generating_report',
        progress: 85,
        message: 'Report generated. Preparing to send...',
        eligibilityTable: eligibilityTable,
        reportGenerated: true
      });

      statusService.updateStatus(tenderId, {
        currentStep: 'sending_email',
        progress: 90,
        message: 'Sending email notification...',
        eligibilityTable: eligibilityTable,
        reportGenerated: true
      });

      // Try to send email, but don't fail if it errors
      try {
        await emailService.sendEligibilityEmail(docxPath, tenderId);
        console.log(`✓ Email sent successfully for ${tenderId}`);
      } catch (emailError) {
        console.error(`⚠️ Email service failed for ${tenderId}:`, emailError.message);
        // Don't throw error, just log it - report is already sent to frontend
        // Continue with completion
      }
    } else {
      // For eligible tenders, also send the table if it exists
      statusService.updateStatus(tenderId, {
        currentStep: 'generating_report',
        progress: 85,
        message: 'Eligibility analysis completed',
        eligibilityTable: eligibilityTable,
        reportGenerated: true
      });
    }

    statusService.updateStatus(tenderId, {
      status: 'completed',
      currentStep: 'completed',
      progress: 100,
      message: isEligible 
        ? 'Workflow completed - Company is eligible' 
        : 'Workflow completed - Report generated',
      eligible: isEligible,
      eligibilityTable: eligibilityTable,
      reportGenerated: true,
      completed: true
    });

  } catch (error) {
    console.error(`Error in workflow for ${tenderId}:`, error);
    const errorMessage = error.message || 'Unknown error occurred';
    statusService.updateStatus(tenderId, {
      status: 'error',
      error: errorMessage,
      completed: true,
      message: `Error: ${errorMessage}`,
      currentStep: 'error',
      progress: 0
    });
  }
}

/**
 * Get workflow status
 * GET /api/workflow-status/:tenderId
 */
async function getWorkflowStatus(req, res) {
  try {
    const tenderId = req.params.tenderId;
    const status = statusService.getStatus(tenderId);
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get eligibility table/report
 * GET /api/eligibility-report/:tenderId
 */
async function getEligibilityReport(req, res) {
  try {
    const tenderId = req.params.tenderId;
    const tablePath = `analysis/${tenderId}/table.txt`;
    
    // Check if table exists
    if (!(await fs.pathExists(tablePath))) {
      return res.status(404).json({
        success: false,
        error: 'Eligibility report not found. Please run the analysis first.'
      });
    }
    
    // Read and return the table
    const eligibilityTable = await fs.readFile(tablePath, 'utf8');
    
    res.json({
      success: true,
      report: eligibilityTable,
      tenderId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  processWorkflow,
  getWorkflowStatus,
  getEligibilityReport
};

