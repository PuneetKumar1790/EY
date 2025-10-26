const pdfParse = require('pdf-parse');
const fs = require('fs-extra');
const path = require('path');

/**
 * Extract text from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} Extracted text content
 */
async function extractTextFromPDF(filePath) {
  try {
    console.log(`📄 Extracting text from PDF: ${filePath}`);
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    if (!data.text || data.text.trim().length === 0) {
      console.warn(`⚠️ Warning: PDF ${filePath} appears to contain no extractable text`);
      return '';
    }
    
    console.log(`✓ Successfully extracted ${data.text.length} characters from PDF`);
    return data.text;
  } catch (error) {
    console.error(`❌ Error extracting text from PDF ${filePath}:`, error.message);
    throw new Error(`PDF text extraction failed: ${error.message}`);
  }
}

/**
 * Extract text from multiple PDFs in a directory
 * @param {string} directory - Directory containing PDF files
 * @returns {Promise<Array>} Array of { filename, text } objects
 */
async function extractTextFromMultiplePDFs(directory) {
  try {
    const files = await fs.readdir(directory);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    console.log(`📚 Found ${pdfFiles.length} PDF files in ${directory}`);
    
    const results = [];
    for (const filename of pdfFiles) {
      const filePath = path.join(directory, filename);
      const text = await extractTextFromPDF(filePath);
      results.push({ filename, text });
    }
    
    console.log(`✓ Successfully extracted text from ${results.length} PDFs`);
    return results;
  } catch (error) {
    console.error(`❌ Error extracting text from PDFs in ${directory}:`, error.message);
    throw error;
  }
}

module.exports = {
  extractTextFromPDF,
  extractTextFromMultiplePDFs
};

