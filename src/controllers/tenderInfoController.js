const fs = require('fs-extra');
const path = require('path');
const pdfService = require('../services/pdfService');
const groqService = require('../services/groqService');

/**
 * Extract tender info from summaries if available
 */
async function extractTenderInfoFromSummaries(tenderId) {
  const summaryDir = `summaries/${tenderId}`;
  
  try {
    if (!(await fs.pathExists(summaryDir))) {
      return null;
    }

    const files = await fs.readdir(summaryDir);
    const summaryFiles = files.filter(f => f.endsWith('_summary.txt') || f === 'combined_summary.txt');
    
    if (summaryFiles.length === 0) {
      return null;
    }

    // Read the first summary or combined summary
    let summaryText = '';
    const combinedSummaryPath = path.join(summaryDir, 'combined_summary.txt');
    
    if (await fs.pathExists(combinedSummaryPath)) {
      summaryText = await fs.readFile(combinedSummaryPath, 'utf8');
    } else if (summaryFiles.length > 0) {
      summaryText = await fs.readFile(path.join(summaryDir, summaryFiles[0]), 'utf8');
    }

    if (!summaryText) {
      return null;
    }

    // Extract tender name and deadline from summary
    const nameMatch = summaryText.match(/Tender Title[:\s]+([^\n]+)/i) || 
                     summaryText.match(/Tender Name[:\s]+([^\n]+)/i) ||
                     summaryText.match(/Procurement of ([^\n]+)/i);
    
    const deadlineMatch = summaryText.match(/Submission Deadline[:\s]+([^\n]+)/i) ||
                         summaryText.match(/Closing Date[:\s]+([^\n]+)/i) ||
                         summaryText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);

    return {
      name: nameMatch ? nameMatch[1].trim() : null,
      deadline: deadlineMatch ? deadlineMatch[1].trim() : null
    };
  } catch (error) {
    console.error(`Error extracting tender info: ${error.message}`);
    return null;
  }
}

/**
 * Get tender information
 * GET /api/tender-info/:tenderId
 */
async function getTenderInfo(req, res) {
  try {
    const tenderId = req.params.tenderId;
    
    // Default tender names based on folder names
    const defaultNames = {
      tender1: '3C LT AB Cable Procurement',
      tender2: '1 Phase LT AB Cable Procurement'
    };

    // Try to extract from summaries
    const extractedInfo = await extractTenderInfoFromSummaries(tenderId);
    
    const info = {
      id: tenderId,
      name: extractedInfo?.name || defaultNames[tenderId] || `Tender ${tenderId}`,
      deadline: extractedInfo?.deadline || 'Not specified',
      hasSummaries: extractedInfo !== null
    };

    res.json({
      success: true,
      tender: info
    });
  } catch (error) {
    console.error('Error getting tender info:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get list of all tenders
 * GET /api/tenders
 */
async function getTendersList(req, res) {
  try {
    const tenders = [];
    
    // Check both tenders
    for (const tenderId of ['tender1', 'tender2']) {
      const defaultNames = {
        tender1: '3C LT AB Cable Procurement',
        tender2: '1 Phase LT AB Cable Procurement'
      };

      const extractedInfo = await extractTenderInfoFromSummaries(tenderId);
      
      tenders.push({
        id: tenderId,
        name: extractedInfo?.name || defaultNames[tenderId] || `Tender ${tenderId}`,
        deadline: extractedInfo?.deadline || 'Not specified',
        hasSummaries: extractedInfo !== null
      });
    }

    res.json({
      success: true,
      tenders
    });
  } catch (error) {
    console.error('Error getting tenders list:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

module.exports = {
  getTenderInfo,
  getTendersList
};

