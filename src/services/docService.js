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
  HeadingLevel,
} = require("docx");
const fs = require("fs-extra");
const path = require("path");

/**
 * Parse markdown table to structured data
 * @param {string} tableText - Markdown table text
 * @returns {Array} Array of row arrays
 */
function parseMarkdownTable(tableText) {
  if (!tableText || tableText.trim().length === 0) {
    console.warn("⚠️ Empty table text provided to parseMarkdownTable");
    return [];
  }

  const lines = tableText.split("\n");
  const tableRows = [];
  let headerRowFound = false;
  let seenSeparator = false;

  console.log(`📊 Parsing ${lines.length} lines for table...`);
  console.log(`📊 Table text preview: ${tableText.substring(0, 500)}`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip completely empty lines
    if (trimmedLine.length === 0) {
      continue;
    }
    
    // Check for separator line (|---|---|) - this separates header from data
    if (trimmedLine.includes("---") || /^[=\-\s|:]+$/.test(trimmedLine)) {
      seenSeparator = true;
      console.log(`   Line ${i + 1}: Skipping separator line`);
      continue;
    }

    // Extract cells from markdown table row
    if (trimmedLine.includes("|")) {
      // Split by | and clean up
      const rawCells = trimmedLine.split("|");
      const cells = rawCells
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      // Need at least 2 columns to be a valid row
      if (cells.length >= 2) {
        // First row with cells is the header (if we haven't seen separator yet)
        if (!headerRowFound && !seenSeparator) {
          headerRowFound = true;
          console.log(`   Line ${i + 1}: Header row found with ${cells.length} columns: ${cells.join(', ')}`);
        } else if (headerRowFound && seenSeparator) {
          console.log(`   Line ${i + 1}: Data row found with ${cells.length} columns`);
        }
        
        tableRows.push(cells);
        console.log(`   Line ${i + 1}: Added row with ${cells.length} cells`);
      } else {
        console.log(`   Line ${i + 1}: Skipping row with only ${cells.length} cells (too few)`);
      }
    } else {
      // If we've seen a table row and now see a non-table line, we might have reached the end
      // But continue in case there are more rows
      if (tableRows.length > 0 && trimmedLine.length > 0) {
        console.log(`   Line ${i + 1}: Non-table line encountered: "${trimmedLine.substring(0, 50)}"`);
      }
    }
  }

  console.log(`✓ Parsed ${tableRows.length} table rows (including header)`);
  console.log(`✓ Header found: ${headerRowFound}, Separator found: ${seenSeparator}`);
  
  if (tableRows.length === 0) {
    console.error("❌ No table rows parsed from text!");
    console.error("   Full table text:", tableText);
  } else if (tableRows.length === 1) {
    console.warn("⚠️ Only header row found, no data rows!");
    console.warn("   Full table text:", tableText);
  } else {
    console.log(`✓ Successfully parsed ${tableRows.length - 1} data rows after header`);
  }

  return tableRows;
}

/**
 * Create a professional table cell (optimized)
 * @param {string} text - Cell text
 * @param {boolean} isHeader - Whether this is a header cell
 * @param {number} colIndex - Column index for width
 * @returns {TableCell} DOCX table cell
 */
function createTableCell(text, isHeader = false, colIndex = 0) {
  // Column widths (percentages)
  const widths = {
    0: 8, // Sr. No.
    1: 30, // Tender Requirement
    2: 12, // Fulfilled?
    3: 30, // Company's Status/Information
    4: 20, // Reference
  };

  // Truncate very long text for performance
  const maxLength = 500;
  const truncatedText =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

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
        alignment:
          colIndex === 0 || colIndex === 2
            ? AlignmentType.CENTER
            : AlignmentType.LEFT,
      }),
    ],
    width: {
      size: widths[colIndex] || 20,
      type: WidthType.PERCENTAGE,
    },
    shading: {
      fill: isHeader ? "2E5C8A" : "FFFFFF",
    },
    margins: {
      top: 60,
      bottom: 60,
      left: 80,
      right: 80,
    },
  });
}

/**
 * Create a professional table row (optimized)
 * @param {Array} cells - Array of cell contents
 * @param {boolean} isHeader - Whether this is a header row
 * @returns {TableRow} DOCX table row
 */
function createTableRow(cells, isHeader = false) {
  // Ensure we have exactly 5 columns
  while (cells.length < 5) {
    cells.push("");
  }

  return new TableRow({
    children: cells
      .slice(0, 5)
      .map((cell, index) => createTableCell(cell, isHeader, index)),
  });
}

/**
 * Extract sections from the eligibility text
 * @param {string} text - Full eligibility analysis text
 * @returns {Object} Structured sections
 */
function extractSections(text) {
  const sections = {
    tableText: "",
    overallEligibility: "",
    criticalFactors: "",
    strengths: "",
  };

  console.log(`📝 Extracting sections from text (${text.length} chars)`);
  console.log(`📝 First 500 chars: ${text.substring(0, 500)}`);

  // Improved table extraction - look for markdown table structure
  // First, try to find a complete table with multiple rows
  // Look for pattern: | header | header | ... followed by |---| and then data rows
  
  // Find all lines that contain table markers
  const lines = text.split('\n');
  let tableStartIndex = -1;
  let tableEndIndex = -1;
  
  // Find the start of the table (first line with |)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.includes('|') && line.split('|').length > 3) {
      // Check if it looks like a header row (has multiple columns)
      const cells = line.split('|').filter(c => c.trim().length > 0);
      if (cells.length >= 3) {
        tableStartIndex = i;
        break;
      }
    }
  }

  if (tableStartIndex !== -1) {
    // Find the end of the table - look for OVERALL ELIGIBILITY or empty line followed by section
    for (let i = tableStartIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim().toUpperCase();
      
      // Stop if we hit OVERALL ELIGIBILITY section
      if (line.includes('OVERALL ELIGIBILITY') && 
          (line.includes('##') || line.includes('###') || line.includes('**'))) {
        tableEndIndex = i;
        break;
      }
      
      // Stop if we hit CRITICAL DISQUALIFYING FACTORS
      if (line.includes('CRITICAL DISQUALIFYING FACTORS')) {
        tableEndIndex = i;
        break;
      }
      
      // Stop if we hit STRENGTHS
      if (line.includes('STRENGTHS') && 
          (line.includes('##') || line.includes('###') || line.includes('**'))) {
        tableEndIndex = i;
        break;
      }
      
      // Stop if we have 2+ consecutive empty lines (section break)
      if (i > tableStartIndex + 2 && 
          lines[i].trim() === '' && 
          lines[i-1].trim() === '' && 
          lines[i-2].trim() !== '') {
        // Check if next non-empty line is a section header
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine.length > 0) {
            if (nextLine.startsWith('#') || nextLine.toUpperCase().includes('OVERALL ELIGIBILITY')) {
              tableEndIndex = i;
              break;
            }
            break;
          }
        }
        if (tableEndIndex !== -1) break;
      }
    }

    // Extract table lines
    if (tableEndIndex === -1) {
      tableEndIndex = lines.length;
    }
    
    const tableLines = lines.slice(tableStartIndex, tableEndIndex);
    sections.tableText = tableLines.join('\n').trim();
    
    console.log(`✓ Extracted table text (${sections.tableText.length} chars, ${tableLines.length} lines)`);
    console.log(`📊 Table preview (first 1000 chars): ${sections.tableText.substring(0, 1000)}`);
  } else {
    // Fallback: try regex approach
    const tableStartPattern = /(\|[^\n]*\|[\s\S]*?)(?=\n\s*(?:###?\s*)?OVERALL ELIGIBILITY|$)/i;
    const tableMatch = text.match(tableStartPattern);

    if (tableMatch && tableMatch[1]) {
      sections.tableText = tableMatch[1].trim();
      console.log(`✓ Extracted table text via regex (${sections.tableText.length} chars)`);
    } else {
      // Last resort: try to extract everything between first | and last section header
      const startIndex = text.indexOf("|");
      const endMarkers = [
        "### OVERALL ELIGIBILITY",
        "## OVERALL ELIGIBILITY",
        "**OVERALL ELIGIBILITY**",
        "OVERALL ELIGIBILITY",
        "CRITICAL DISQUALIFYING FACTORS",
        "STRENGTHS"
      ];
      let endIndex = -1;

      for (const marker of endMarkers) {
        const idx = text.indexOf(marker, startIndex);
        if (idx > startIndex && idx !== -1) {
          if (endIndex === -1 || idx < endIndex) {
            endIndex = idx;
          }
        }
      }

      if (startIndex !== -1) {
        if (endIndex !== -1) {
          sections.tableText = text.substring(startIndex, endIndex).trim();
        } else {
          // If no end marker found, take everything from first | to end
          sections.tableText = text.substring(startIndex).trim();
          // But stop at any obvious section break (3+ consecutive newlines)
          const stopPattern = /\n\s*\n\s*\n/;
          const stopMatch = sections.tableText.match(stopPattern);
          if (stopMatch) {
            sections.tableText = sections.tableText.substring(0, stopMatch.index).trim();
          }
        }
        console.log(`✓ Extracted table text via fallback (${sections.tableText.length} chars)`);
      } else {
        console.warn(`⚠️ No table found in text (no '|' character found)`);
        console.warn(`   Full text preview: ${text.substring(0, 1000)}`);
      }
    }
  }

  // Extract OVERALL ELIGIBILITY
  const eligibilityMatch = text.match(
    /###?\s*OVERALL ELIGIBILITY[:\s]*([\s\S]*?)(?=###?\s*CRITICAL|###?\s*STRENGTHS|$)/i
  );
  if (eligibilityMatch) {
    sections.overallEligibility = eligibilityMatch[1].trim();
  }

  // Extract CRITICAL DISQUALIFYING FACTORS
  const criticalMatch = text.match(
    /###?\s*CRITICAL DISQUALIFYING FACTORS[:\s]*([\s\S]*?)(?=###?\s*STRENGTHS|###?\s*COMPANY STRENGTHS|$)/i
  );
  if (criticalMatch) {
    sections.criticalFactors = criticalMatch[1].trim();
  }

  // Extract STRENGTHS
  const strengthsMatch = text.match(
    /###?\s*(?:COMPANY )?STRENGTHS[:\s]*([\s\S]*?)$/i
  );
  if (strengthsMatch) {
    sections.strengths = strengthsMatch[1].trim();
  }

  return sections;
}

/**
 * Parse eligibility table from text and create professional DOCX document
 * @param {string} tableText - Text containing the eligibility table
 * @param {string} tenderId - Tender ID
 * @returns {Promise<string>} Path to generated DOCX file
 */
async function createDocxFromTable(tableText, tenderId) {
  try {
    console.log(`📝 Creating professional DOCX report for ${tenderId}...`);

    const outputPath = path.join(
      __dirname,
      `../../analysis/${tenderId}/eligibility_report.docx`
    );
    await fs.ensureDir(path.dirname(outputPath));

    // Extract structured sections
    const sections = extractSections(tableText);

    console.log(`📊 Extracted sections:`);
    console.log(`   - Table text: ${sections.tableText.length} chars`);
    console.log(
      `   - Overall eligibility: ${sections.overallEligibility.length} chars`
    );
    console.log(
      `   - Critical factors: ${sections.criticalFactors.length} chars`
    );
    console.log(`   - Strengths: ${sections.strengths.length} chars`);

    // Parse table data
    const tableRows = parseMarkdownTable(sections.tableText || tableText);

    console.log(`📊 Parsed ${tableRows.length} table rows`);
    
    if (tableRows.length === 0) {
      console.error("❌ No table rows parsed! Table text was:");
      console.error("   First 1000 chars:", (sections.tableText || tableText).substring(0, 1000));
      console.error("   Full sections.tableText length:", sections.tableText?.length || 0);
      console.error("   Full tableText length:", tableText?.length || 0);
    }

    // Create document children
    const docChildren = [];

    // Title (optimized - removed font specification)
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `TENDER ELIGIBILITY ANALYSIS REPORT`,
            bold: true,
            size: 32,
            color: "1F4E78",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 300 },
      })
    );

    // Tender ID (optimized)
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Tender: ${tenderId.toUpperCase()}`,
            bold: true,
            size: 26,
            color: "2E5C8A",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      })
    );

    // Generated date (optimized)
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

    // Simplified divider
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "═".repeat(80),
            color: "CCCCCC",
          }),
        ],
        spacing: { after: 400 },
      })
    );

    // Main table (optimized for performance)
    if (tableRows.length > 1) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(1);
      
      console.log(`📊 Creating table with ${dataRows.length} data rows`);

      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Detailed Eligibility Analysis",
              bold: true,
              size: 24,
              color: "1F4E78",
            }),
          ],
          spacing: { after: 200 },
        })
      );

      // For performance: if table has >50 rows, add a note
      if (dataRows.length > 50) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `⚠️ Large table with ${dataRows.length} rows. Document may take a moment to load.`,
                italics: true,
                size: 18,
                color: "FF6600",
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }

      // Create table rows with performance optimization
      const tableRowsForDoc = [
        createTableRow(headerRow, true),
        ...dataRows.map((row) => createTableRow(row, false)),
      ];

      // Split into multiple tables if too large (>100 rows)
      if (tableRowsForDoc.length > 100) {
        console.log(
          `⚠️ Large table detected (${tableRowsForDoc.length} rows). Splitting into multiple tables...`
        );

        // Split every 50 rows
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

      docChildren.push(
        new Paragraph({
          text: "",
          spacing: { after: 400 },
        })
      );
    } else {
      // No table rows found - add error message
      console.error("❌ No table rows to display in DOCX!");
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "⚠️ ERROR: Eligibility table could not be generated or parsed.",
              bold: true,
              size: 20,
              color: "FF0000",
            }),
          ],
          spacing: { after: 200 },
        })
      );
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Please check the eligibility analysis response from the AI service.",
              size: 18,
              color: "666666",
            }),
          ],
          spacing: { after: 400 },
        })
      );
      
      // Try to show raw table text as fallback
      if (sections.tableText && sections.tableText.length > 0) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Raw table text (for debugging):",
                bold: true,
                size: 18,
              }),
            ],
            spacing: { after: 200 },
          })
        );
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: sections.tableText.substring(0, 2000),
                size: 14,
                font: "Courier New",
              }),
            ],
            spacing: { after: 400 },
          })
        );
      }
    }

    // Overall Eligibility Section
    if (sections.overallEligibility) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "═".repeat(100),
              color: "CCCCCC",
              font: "Calibri",
            }),
          ],
          spacing: { before: 200, after: 200 },
        })
      );

      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "OVERALL ELIGIBILITY DECISION",
              bold: true,
              size: 24,
              color: "1F4E78",
              font: "Calibri",
            }),
          ],
          spacing: { after: 200 },
          heading: HeadingLevel.HEADING_2,
        })
      );

      const isEligible =
        sections.overallEligibility.toUpperCase().includes("ELIGIBLE") &&
        !sections.overallEligibility.toUpperCase().includes("NOT ELIGIBLE");

      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: sections.overallEligibility.replace(/[#*]/g, "").trim(),
              bold: true,
              size: 26,
              color: isEligible ? "008000" : "CC0000",
              font: "Calibri",
            }),
          ],
          spacing: { after: 300 },
          alignment: AlignmentType.CENTER,
        })
      );
    }

    // Critical Disqualifying Factors
    if (sections.criticalFactors) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "CRITICAL DISQUALIFYING FACTORS",
              bold: true,
              size: 22,
              color: "CC0000",
              font: "Calibri",
            }),
          ],
          spacing: { before: 300, after: 200 },
          heading: HeadingLevel.HEADING_3,
        })
      );

      // Split by numbered items or bullet points
      const factorLines = sections.criticalFactors
        .split(/\n+/)
        .map((line) => line.replace(/^[\d.)\-*]+\s*/, "").trim())
        .filter((line) => line.length > 0 && !line.match(/^[#*\-=]+$/));

      factorLines.forEach((line) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 20,
                color: "333333",
                font: "Calibri",
              }),
            ],
            spacing: { after: 150 },
            bullet: { level: 0 },
          })
        );
      });
    }

    // Strengths
    if (sections.strengths) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "COMPANY STRENGTHS",
              bold: true,
              size: 22,
              color: "008000",
              font: "Calibri",
            }),
          ],
          spacing: { before: 300, after: 200 },
          heading: HeadingLevel.HEADING_3,
        })
      );

      // Split by numbered items or bullet points
      const strengthLines = sections.strengths
        .split(/\n+/)
        .map((line) => line.replace(/^[\d.)\-*]+\s*/, "").trim())
        .filter(
          (line) =>
            line.length > 0 &&
            !line.match(/^[#*\-=\(\)]+$/) &&
            !line.includes("Despite Ineligibility")
        );

      strengthLines.forEach((line) => {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 20,
                color: "333333",
                font: "Calibri",
              }),
            ],
            spacing: { after: 150 },
            bullet: { level: 0 },
          })
        );
      });
    }

    // Footer
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "═".repeat(100),
            color: "CCCCCC",
            font: "Calibri",
          }),
        ],
        spacing: { before: 400, after: 200 },
      })
    );

    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "End of Report",
            italics: true,
            size: 20,
            color: "999999",
            font: "Calibri",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
      })
    );

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
    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(outputPath, buffer);

    console.log(`✓ Professional DOCX report created: ${outputPath}`);
    console.log(`  - Table rows: ${tableRows.length}`);
    console.log(`  - File size: ${(buffer.length / 1024).toFixed(2)} KB`);

    return outputPath;
  } catch (error) {
    console.error("❌ Error creating DOCX:", error.message);
    console.error("Stack trace:", error.stack);
    throw new Error(`DOCX generation failed: ${error.message}`);
  }
}

module.exports = {
  createDocxFromTable,
};
