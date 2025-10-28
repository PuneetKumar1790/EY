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
  const lines = tableText.split("\n").filter((line) => line.trim());
  const tableRows = [];

  for (const line of lines) {
    // Skip separator lines (|---|---|) or lines with only = or -
    if (line.includes("---") || /^[=\-\s|]+$/.test(line)) continue;

    // Extract cells from markdown table row
    if (line.includes("|")) {
      const cells = line
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0);

      if (cells.length > 0) {
        tableRows.push(cells);
      }
    }
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

  // Try to find table portion - look for markdown table structure
  const tableRegex = /\|[\s\S]*?\|(?=\n\n|$)/;
  const tableMatch = text.match(tableRegex);

  if (tableMatch) {
    sections.tableText = tableMatch[0];
  } else {
    // Fallback: try to extract everything between first | and last section header
    const startIndex = text.indexOf("|");
    const endMarkers = [
      "### OVERALL ELIGIBILITY",
      "## OVERALL ELIGIBILITY",
      "OVERALL ELIGIBILITY",
    ];
    let endIndex = -1;

    for (const marker of endMarkers) {
      const idx = text.indexOf(marker);
      if (idx > startIndex && idx !== -1) {
        endIndex = idx;
        break;
      }
    }

    if (startIndex !== -1 && endIndex !== -1) {
      sections.tableText = text.substring(startIndex, endIndex);
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
