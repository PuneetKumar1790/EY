const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const pdfService = require('../services/pdfService');
const groqService = require('../services/groqService');
const docxService = require('../services/docxService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenderId = req.params.tenderId || 'tender1';
    const uploadDir = `uploads/${tenderId}`;
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * Upload tender PDFs
 * POST /api/upload-tender/:tenderId
 */
const uploadTenderPDFs = [
  upload.array('pdfs', 5), // Max 5 PDFs
  async (req, res) => {
    try {
      const tenderId = req.params.tenderId;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No PDF files uploaded' 
        });
      }

      console.log(`\n📦 Processing ${req.files.length} PDFs for ${tenderId}...`);

      const results = [];

      // Process each PDF: extract text and generate summary
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        console.log(`\n📄 Processing ${i + 1}/${req.files.length}: ${file.originalname}`);
        
        // Extract text
        const text = await pdfService.extractTextFromPDF(file.path);
        
        if (!text || text.trim().length === 0) {
          console.warn(`⚠️ Skipping ${file.originalname} - no text content`);
          results.push({
            filename: file.originalname,
            success: false,
            error: 'No extractable text in PDF'
          });
          continue;
        }

        // Generate summary using Groq
        const summary = await groqService.generateSummary(text);
        
        // Save summary
        const summaryDir = `summaries/${tenderId}`;
        await fs.ensureDir(summaryDir);
        const summaryPath = path.join(summaryDir, `${path.parse(file.filename).name}_summary.txt`);
        await fs.writeFile(summaryPath, summary, 'utf8');
        
        console.log(`✓ Summary saved: ${summaryPath}`);
        
        results.push({
          filename: file.originalname,
          success: true,
          summaryPath,
          summaryLength: summary.length,
          textLength: text.length
        });
      }

      res.json({
        success: true,
        message: `Successfully processed ${req.files.length} PDFs for ${tenderId}`,
        tenderId,
        results,
        summary: {
          total: req.files.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      });

    } catch (error) {
      console.error('❌ Error in uploadTenderPDFs:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
];

module.exports = {
  uploadTenderPDFs
};

