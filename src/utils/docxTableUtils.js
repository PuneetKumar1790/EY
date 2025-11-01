const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
} = require("docx");
const fs = require("fs-extra");

/**
 * Parse CSV properly handling quoted fields with commas
 * @param {string} csvText - CSV content
 * @returns {Array} Array of row arrays
 */
function parseCSV(csvText) {
  const rows = [];
  const lines = csvText.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    const cells = [];
    let currentCell = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        // End of cell
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    
    // Add last cell
    if (currentCell.length > 0 || line.endsWith(',')) {
      cells.push(currentCell.trim());
    }
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  return rows;
}

/**
 * Create a table cell for DOCX
 * @param {string} text - Cell text
 * @param {boolean} isHeader - Whether this is a header cell
 * @returns {TableCell} DOCX table cell
 */
function createTableCell(text, isHeader = false) {
  // Truncate very long text
  const maxLength = 500;
  const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: truncatedText,
            bold: isHeader,
            size: isHeader ? 20 : 18,
          }),
        ],
        alignment: AlignmentType.LEFT,
      }),
    ],
    margins: {
      top: 60,
      bottom: 60,
      left: 80,
      right: 80,
    },
  });
}

/**
 * Create a table row for DOCX
 * @param {Array} cells - Array of cell contents
 * @param {boolean} isHeader - Whether this is a header row
 * @returns {TableRow} DOCX table row
 */
function createTableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map((cell, index) => createTableCell(cell || '', isHeader)),
  });
}

/**
 * Convert CSV table to DOCX document
 * @param {string} csvContent - CSV content
 * @param {string} outputPath - Path to save DOCX file
 * @param {string} title - Document title (optional)
 * @returns {Promise<string>} Path to generated DOCX file
 */
async function csvToDocx(csvContent, outputPath, title = "Holistic Summary Table") {
  try {
    console.log(`📝 Converting CSV to DOCX: ${outputPath}`);
    
    // Parse CSV
    const rows = parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error("CSV is empty or could not be parsed");
    }
    
    console.log(`📊 Parsed ${rows.length} rows from CSV`);
    
    // Create document children
    const docChildren = [];
    
    // Title
    if (title) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: title,
              bold: true,
              size: 32,
              color: "1F4E78",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );
      
      // Date
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on: ${new Date().toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "full",
                timeStyle: "short",
              })}`,
              italics: true,
              size: 20,
              color: "666666",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );
    }
    
    // Create table
    if (rows.length > 0) {
      const headerRow = rows[0];
      const dataRows = rows.slice(1);
      
      // Create table rows
      const tableRowsForDoc = [
        createTableRow(headerRow, true),
        ...dataRows.map((row) => createTableRow(row, false)),
      ];
      
      // Split into multiple tables if too large (>100 rows)
      if (tableRowsForDoc.length > 100) {
        console.log(`⚠️ Large table detected (${tableRowsForDoc.length} rows). Splitting into multiple tables...`);
        
        const chunkSize = 50;
        for (let i = 0; i < tableRowsForDoc.length; i += chunkSize) {
          const chunk = tableRowsForDoc.slice(i, i + chunkSize);
          
          // Add header row to each chunk except the first
          if (i > 0) {
            chunk.unshift(createTableRow(headerRow, true));
          }
          
          docChildren.push(
            new Table({
              rows: chunk,
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "2E5C8A" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "2E5C8A" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "2E5C8A" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "2E5C8A" },
                insideHorizontal: {
                  style: BorderStyle.SINGLE,
                  size: 1,
                  color: "DDDDDD",
                },
                insideVertical: {
                  style: BorderStyle.SINGLE,
                  size: 1,
                  color: "DDDDDD",
                },
              },
            })
          );
          
          // Add spacing between table chunks
          if (i + chunkSize < tableRowsForDoc.length) {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: "— continued —",
                    italics: true,
                    size: 16,
                    color: "999999",
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 200 },
              })
            );
          }
        }
      } else {
        // Normal single table for smaller datasets
        docChildren.push(
          new Table({
            rows: tableRowsForDoc,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "2E5C8A" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "2E5C8A" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "2E5C8A" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "2E5C8A" },
              insideHorizontal: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: "DDDDDD",
              },
              insideVertical: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: "DDDDDD",
              },
            },
          })
        );
      }
    }
    
    // Create DOCX document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: docChildren,
        },
      ],
    });
    
    // Generate DOCX file
    await fs.ensureDir(require('path').dirname(outputPath));
    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(outputPath, buffer);
    
    console.log(`✓ DOCX file created: ${outputPath}`);
    console.log(`  - Table rows: ${rows.length}`);
    console.log(`  - File size: ${(buffer.length / 1024).toFixed(2)} KB`);
    
    return outputPath;
  } catch (error) {
    console.error("❌ Error converting CSV to DOCX:", error.message);
    throw new Error(`CSV to DOCX conversion failed: ${error.message}`);
  }
}

module.exports = {
  csvToDocx,
  parseCSV,
};

