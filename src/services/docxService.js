const mammoth = require('mammoth');
const fs = require('fs-extra');
const path = require('path');

/**
 * Extract text from a DOCX file
 * @param {string} filePath - Path to the DOCX file
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromDOCX(filePath) {
  try {
    console.log(`📄 Extracting text from DOCX: ${filePath}`);
    const result = await mammoth.extractRawText({ path: filePath });
    const text = result.value;
    
    if (!text || text.trim().length === 0) {
      console.warn(`⚠️ Warning: DOCX ${filePath} appears to contain no extractable text`);
      return '';
    }
    
    console.log(`✓ Successfully extracted ${text.length} characters from DOCX`);
    return text;
  } catch (error) {
    console.error(`❌ Error extracting text from DOCX ${filePath}:`, error.message);
    throw new Error(`DOCX text extraction failed: ${error.message}`);
  }
}

module.exports = {
  extractTextFromDOCX
};

