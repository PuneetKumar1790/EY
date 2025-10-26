const { Document, Packer, Paragraph, TextRun } = require('docx');
const fs = require('fs-extra');
const path = require('path');

/**
 * Parse eligibility table from text and create DOCX document
 * @param {string} tableText - Text containing the eligibility table
 * @param {string} tenderId - Tender ID
 * @returns {Promise<string>} Path to generated DOCX file
 */
async function createDocxFromTable(tableText, tenderId) {
  try {
    console.log(`📝 Creating DOCX report for ${tenderId}...`);
    
    const outputPath = path.join(__dirname, `../../analysis/${tenderId}/eligibility_report.docx`);
    await fs.ensureDir(path.dirname(outputPath));
    
    // Split text into paragraphs for better formatting
    const textLines = tableText.split('\n').filter(line => line.trim());
    
    // Create DOCX document structure
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `Tender Eligibility Analysis Report - ${tenderId.toUpperCase()}`,
                bold: true,
                size: 32
              })
            ],
            spacing: { after: 400 }
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated on: ${new Date().toLocaleString()}`,
                italics: true,
                size: 20
              })
            ],
            spacing: { after: 400 }
          }),
          ...textLines.map(line => 
            new Paragraph({
              text: line,
              spacing: { after: 100 }
            })
          )
        ]
      }]
    });
    
    // Generate DOCX file
    const buffer = await Packer.toBuffer(doc);
    await fs.writeFile(outputPath, buffer);
    
    console.log(`✓ DOCX report created: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('❌ Error creating DOCX:', error.message);
    throw new Error(`DOCX generation failed: ${error.message}`);
  }
}

module.exports = {
  createDocxFromTable
};

