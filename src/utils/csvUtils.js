const fs = require('fs-extra');

/**
 * Convert markdown table or text table to CSV format
 * @param {string} tableText - Table text (markdown or plain text)
 * @returns {string} CSV formatted string
 */
function convertTableToCSV(tableText) {
  if (!tableText || !tableText.trim()) {
    return '';
  }

  // Try to extract CSV from markdown table first
  const lines = tableText.split('\n').filter(line => line.trim());
  const rows = [];

  for (const line of lines) {
    // Skip separator lines (|---|---|)
    if (line.match(/^[\s|:\-]+$/)) continue;
    
    // Check if it's a markdown table row
    if (line.includes('|')) {
      const cells = line
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    } else if (line.includes(',')) {
      // Already CSV-like, check if it has quotes
      rows.push(line.split(',').map(cell => cell.trim()));
    }
  }

  if (rows.length === 0) {
    return '';
  }

  // Convert to CSV format with proper escaping
  const csvRows = rows.map(row => {
    return row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const cellStr = String(cell || '').replace(/"/g, '""');
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr}"`;
      }
      return cellStr;
    }).join(',');
  });

  return csvRows.join('\n');
}

/**
 * Extract table from AI response (remove code blocks, preambles, etc.)
 * @param {string} response - AI response that may contain table
 * @returns {string} Clean table text
 */
function extractTableFromResponse(response) {
  if (!response) return '';

  // Remove code blocks
  let cleaned = response
    .replace(/```[\w]*\n?/g, '')
    .replace(/```/g, '')
    .trim();

  // Try to find table (look for pipe characters or CSV structure)
  const lines = cleaned.split('\n');
  
  // Find first line that looks like a header (contains | or multiple commas)
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('|') && lines[i].split('|').length >= 3) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) {
    // Maybe it's already CSV
    return cleaned;
  }

  // Extract table section (until we hit non-table line or empty line)
  const tableLines = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || (!line.includes('|') && !line.includes(','))) {
      break;
    }
    if (line.includes('---') && line.match(/^[\s|:\-]+$/)) {
      continue; // Skip separator
    }
    tableLines.push(line);
  }

  return tableLines.join('\n');
}

/**
 * Write CSV file
 * @param {string} filePath - Path to CSV file
 * @param {string} csvContent - CSV content
 */
async function writeCSV(filePath, csvContent) {
  await fs.ensureDir(require('path').dirname(filePath));
  await fs.writeFile(filePath, csvContent, 'utf8');
  console.log(`✓ CSV file written: ${filePath}`);
}

module.exports = {
  convertTableToCSV,
  extractTableFromResponse,
  writeCSV
};

