const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const groqService = require('../services/groqService');
const csvUtils = require('../utils/csvUtils');
const emailService = require('../services/emailService');

// Configure multer for SKU file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/sku';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'sku_list.txt');
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only TXT files are allowed'));
    }
  }
});

/**
 * Upload SKU list file
 * POST /api/upload-sku-list
 */
const uploadSKUList = [
  upload.single('skuFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No SKU file uploaded'
        });
      }

      console.log(`\n📄 SKU list uploaded: ${req.file.originalname}`);

      // Copy to root as Tender_SKU_Matching_Descriptions.txt
      const targetPath = 'Tender_SKU_Matching_Descriptions.txt';
      await fs.copy(req.file.path, targetPath);
      
      console.log(`✓ SKU list saved: ${targetPath}`);

      res.json({
        success: true,
        message: 'SKU list uploaded successfully',
        file: req.file.originalname,
        targetPath
      });
    } catch (error) {
      console.error('❌ Error uploading SKU list:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
];

/**
 * Build Table B1 (Matching Operations Table)
 * POST /api/build-table-b1/:tenderId
 */
async function buildTableB1(req, res) {
  try {
    const tenderId = req.params.tenderId;
    console.log(`\n🔨 Building Table B1 for ${tenderId}...`);

    // Read comprehensive summary - try multiple locations
    let comprehensiveSummary = '';
    
    // Try workflow directory first
    const comprehensiveSummaryPath = `workflows/${tenderId}/comprehensive_summary.txt`;
    if (await fs.pathExists(comprehensiveSummaryPath)) {
      comprehensiveSummary = await fs.readFile(comprehensiveSummaryPath, 'utf8');
    } else {
      // Try summaries directory
      const fallbackSummaryPath = `summaries/${tenderId}/combined_summary.txt`;
      if (await fs.pathExists(fallbackSummaryPath)) {
        comprehensiveSummary = await fs.readFile(fallbackSummaryPath, 'utf8');
      } else {
        // Try to concatenate individual summaries
        const summaryDir = `summaries/${tenderId}`;
        if (await fs.pathExists(summaryDir)) {
          const summaryFiles = await fs.readdir(summaryDir);
          const txtFiles = summaryFiles.filter(f => f.endsWith('_summary.txt'));
          
          if (txtFiles.length > 0) {
            for (const file of txtFiles) {
              const filePath = path.join(summaryDir, file);
              const content = await fs.readFile(filePath, 'utf8');
              comprehensiveSummary += `\n\n--- ${file} ---\n\n${content}`;
            }
          } else {
            throw new Error('Comprehensive summary not found. Please run eligibility analysis first.');
          }
        } else {
          throw new Error('Comprehensive summary not found. Please run eligibility analysis first.');
        }
      }
    }

    // Build Table B1
    const tableB1Raw = await groqService.buildTableB1(comprehensiveSummary);
    const tableB1Clean = csvUtils.extractTableFromResponse(tableB1Raw);
    const tableB1Csv = csvUtils.convertTableToCSV(tableB1Clean);

    // Save Table B1
    const workflowDir = `workflows/${tenderId}`;
    await fs.ensureDir(workflowDir);
    const tableB1Path = path.join(workflowDir, 'table_b1.csv');
    await csvUtils.writeCSV(tableB1Path, tableB1Csv);

    console.log(`✓ Table B1 saved: ${tableB1Path}`);

    res.json({
      success: true,
      message: 'Table B1 built successfully',
      tableB1Path,
      tableB1: tableB1Csv
    });
  } catch (error) {
    console.error('❌ Error building Table B1:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Match SKUs
 * POST /api/match-skus/:tenderId
 */
async function matchSKUs(req, res) {
  try {
    const tenderId = req.params.tenderId;
    console.log(`\n🔍 Matching SKUs for ${tenderId}...`);

    // Read Table B1
    const tableB1Path = `workflows/${tenderId}/table_b1.csv`;
    if (!(await fs.pathExists(tableB1Path))) {
      throw new Error('Table B1 not found. Please build Table B1 first.');
    }
    const tableB1Csv = await fs.readFile(tableB1Path, 'utf8');

    // Read SKU master file - check multiple locations
    let skuFilePath = 'Tender_SKU_Matching_Descriptions.txt';
    if (!(await fs.pathExists(skuFilePath))) {
      // Try uploads directory
      skuFilePath = 'uploads/sku/sku_list.txt';
      if (!(await fs.pathExists(skuFilePath))) {
        throw new Error('SKU master file not found. Please upload SKU list first.');
      }
    }
    const skuMasterTxt = await fs.readFile(skuFilePath, 'utf8');

    // Match SKUs
    const matchedSkus = await groqService.matchSKUs(tableB1Csv, skuMasterTxt);

    // Clean up SKU matches
    const skuLines = matchedSkus
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.toLowerCase().includes('sku') && !line.includes(':'))
      .map(line => {
        const match = line.match(/(AW-[A-Z0-9\-\.]+|MISSING)/i);
        return match ? match[1] : line;
      });

    // Save matched SKUs
    const workflowDir = `workflows/${tenderId}`;
    await fs.ensureDir(workflowDir);
    const matchedSkusPath = path.join(workflowDir, 'matched_skus.txt');
    await fs.writeFile(matchedSkusPath, skuLines.join('\n'), 'utf8');

    console.log(`✓ Matched SKUs saved: ${matchedSkusPath}`);
    console.log(`  Matched ${skuLines.length} SKUs`);

    res.json({
      success: true,
      message: 'SKUs matched successfully',
      matchedSkusPath,
      matchedSkus: skuLines,
      count: skuLines.length
    });
  } catch (error) {
    console.error('❌ Error matching SKUs:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Calculate pricing
 * POST /api/calculate-pricing/:tenderId
 */
async function calculatePricing(req, res) {
  try {
    const tenderId = req.params.tenderId;
    console.log(`\n💰 Calculating pricing for ${tenderId}...`);

    // Read matched SKUs
    const matchedSkusPath = `workflows/${tenderId}/matched_skus.txt`;
    if (!(await fs.pathExists(matchedSkusPath))) {
      throw new Error('Matched SKUs not found. Please match SKUs first.');
    }
    const matchedSkus = await fs.readFile(matchedSkusPath, 'utf8');

    // Read comprehensive summary - try multiple locations
    let comprehensiveSummary = '';
    
    // Try workflow directory first
    const comprehensiveSummaryPath = `workflows/${tenderId}/comprehensive_summary.txt`;
    if (await fs.pathExists(comprehensiveSummaryPath)) {
      comprehensiveSummary = await fs.readFile(comprehensiveSummaryPath, 'utf8');
    } else {
      // Try summaries directory
      const fallbackSummaryPath = `summaries/${tenderId}/combined_summary.txt`;
      if (await fs.pathExists(fallbackSummaryPath)) {
        comprehensiveSummary = await fs.readFile(fallbackSummaryPath, 'utf8');
      } else {
        // Try to concatenate individual summaries
        const summaryDir = `summaries/${tenderId}`;
        if (await fs.pathExists(summaryDir)) {
          const summaryFiles = await fs.readdir(summaryDir);
          const txtFiles = summaryFiles.filter(f => f.endsWith('_summary.txt'));
          
          if (txtFiles.length > 0) {
            for (const file of txtFiles) {
              const filePath = path.join(summaryDir, file);
              const content = await fs.readFile(filePath, 'utf8');
              comprehensiveSummary += `\n\n--- ${file} ---\n\n${content}`;
            }
          } else {
            throw new Error('Comprehensive summary not found.');
          }
        } else {
          throw new Error('Comprehensive summary not found.');
        }
      }
    }

    // Calculate pricing
    const pricingTableRaw = await groqService.calculatePricing(matchedSkus, comprehensiveSummary);
    const pricingTableClean = csvUtils.extractTableFromResponse(pricingTableRaw);
    const pricingTableCsv = csvUtils.convertTableToCSV(pricingTableClean);

    // Save pricing table
    const workflowDir = `workflows/${tenderId}`;
    await fs.ensureDir(workflowDir);
    const pricingTablePath = path.join(workflowDir, 'pricing_table.csv');
    await csvUtils.writeCSV(pricingTablePath, pricingTableCsv);

    console.log(`✓ Pricing table saved: ${pricingTablePath}`);

    res.json({
      success: true,
      message: 'Pricing calculated successfully',
      pricingTablePath,
      pricingTable: pricingTableCsv
    });
  } catch (error) {
    console.error('❌ Error calculating pricing:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Generate holistic summary table
 * POST /api/generate-holistic-summary/:tenderId
 */
async function generateHolisticSummary(req, res) {
  try {
    const tenderId = req.params.tenderId;
    console.log(`\n📊 Generating holistic summary for ${tenderId}...`);

    // Read all required files
    const workflowDir = `workflows/${tenderId}`;
    
    const tableB1Path = path.join(workflowDir, 'table_b1.csv');
    const matchedSkusPath = path.join(workflowDir, 'matched_skus.txt');
    const pricingTablePath = path.join(workflowDir, 'pricing_table.csv');
    const companyInfoPath = 'uploads/company-info.txt';

    // Validate required files exist
    const requiredFiles = [
      { path: tableB1Path, name: 'Table B1' },
      { path: matchedSkusPath, name: 'Matched SKUs' },
      { path: pricingTablePath, name: 'Pricing table' },
      { path: companyInfoPath, name: 'Company info' }
    ];

    for (const file of requiredFiles) {
      if (!(await fs.pathExists(file.path))) {
        throw new Error(`${file.name} not found at ${file.path}`);
      }
    }

    // Read comprehensive summary - try multiple locations
    let comprehensiveSummary = '';
    const comprehensiveSummaryPath = path.join(workflowDir, 'comprehensive_summary.txt');
    if (await fs.pathExists(comprehensiveSummaryPath)) {
      comprehensiveSummary = await fs.readFile(comprehensiveSummaryPath, 'utf8');
    } else {
      // Try summaries directory
      const fallbackSummaryPath = `summaries/${tenderId}/combined_summary.txt`;
      if (await fs.pathExists(fallbackSummaryPath)) {
        comprehensiveSummary = await fs.readFile(fallbackSummaryPath, 'utf8');
      } else {
        // Try to concatenate individual summaries
        const summaryDir = `summaries/${tenderId}`;
        if (await fs.pathExists(summaryDir)) {
          const summaryFiles = await fs.readdir(summaryDir);
          const txtFiles = summaryFiles.filter(f => f.endsWith('_summary.txt'));
          
          if (txtFiles.length > 0) {
            for (const file of txtFiles) {
              const filePath = path.join(summaryDir, file);
              const content = await fs.readFile(filePath, 'utf8');
              comprehensiveSummary += `\n\n--- ${file} ---\n\n${content}`;
            }
          } else {
            throw new Error('Comprehensive summary not found. Please run eligibility analysis first.');
          }
        } else {
          throw new Error('Comprehensive summary not found. Please run eligibility analysis first.');
        }
      }
    }

    // Read other files
    const tableB1Csv = await fs.readFile(tableB1Path, 'utf8');
    const matchedSkus = await fs.readFile(matchedSkusPath, 'utf8');
    const pricingTableCsv = await fs.readFile(pricingTablePath, 'utf8');
    const companyInfo = await fs.readFile(companyInfoPath, 'utf8');
    
    // Convert company info to JSON format
    const companyProfileJson = JSON.stringify({
      company_information: companyInfo,
      source: "Extracted from company document"
    });

    // Generate holistic summary
    const holisticTableRaw = await groqService.generateHolisticSummaryTable(
      comprehensiveSummary,
      tableB1Csv,
      matchedSkus,
      pricingTableCsv,
      companyProfileJson
    );
    const holisticTableClean = csvUtils.extractTableFromResponse(holisticTableRaw);
    const holisticTableCsv = csvUtils.convertTableToCSV(holisticTableClean);

    // Save holistic table
    const holisticTablePath = path.join(workflowDir, 'holistic_summary_table.csv');
    await csvUtils.writeCSV(holisticTablePath, holisticTableCsv);

    console.log(`✓ Holistic table saved: ${holisticTablePath}`);

    // Send email with holistic table
    try {
      await emailService.sendHolisticTableEmail(holisticTablePath, tenderId);
      console.log('✓ Email sent with holistic table');
    } catch (emailError) {
      console.warn('⚠️ Email sending failed:', emailError.message);
    }

    res.json({
      success: true,
      message: 'Holistic summary generated successfully',
      holisticTablePath,
      holisticTable: holisticTableCsv,
      emailSent: true
    });
  } catch (error) {
    console.error('❌ Error generating holistic summary:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get workflow result file
 * GET /api/workflow-result/:tenderId/:resultType
 */
async function getWorkflowResult(req, res) {
  try {
    const tenderId = req.params.tenderId;
    const resultType = req.params.resultType; // table_b1, matched_skus, pricing_table, holistic_summary

    const fileMap = {
      'table_b1': 'table_b1.csv',
      'matched_skus': 'matched_skus.txt',
      'pricing_table': 'pricing_table.csv',
      'holistic_summary': 'holistic_summary_table.csv'
    };

    const fileName = fileMap[resultType];
    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: `Invalid result type: ${resultType}. Valid types: ${Object.keys(fileMap).join(', ')}`
      });
    }

    const filePath = `workflows/${tenderId}/${fileName}`;
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({
        success: false,
        error: `Result file not found: ${fileName}`
      });
    }

    const content = await fs.readFile(filePath, 'utf8');

    res.json({
      success: true,
      resultType,
      fileName,
      content
    });
  } catch (error) {
    console.error('❌ Error getting workflow result:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  uploadSKUList,
  buildTableB1,
  matchSKUs,
  calculatePricing,
  generateHolisticSummary,
  getWorkflowResult
};

