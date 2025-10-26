const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const pdfService = require('../services/pdfService');
const docxService = require('../services/docxService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/company';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `company_info.${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF or DOCX files are allowed'));
    }
  }
});

/**
 * Upload company information document
 * POST /api/upload-company
 */
const uploadCompanyInfo = [
  upload.single('document'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No document uploaded' 
        });
      }

      console.log(`\n📄 Processing company document: ${req.file.originalname}`);

      let text = '';

      // Extract text based on file type
      if (req.file.mimetype === 'application/pdf') {
        text = await pdfService.extractTextFromPDF(req.file.path);
      } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await docxService.extractTextFromDOCX(req.file.path);
      } else {
        throw new Error('Unsupported file type');
      }

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No extractable text in the document'
        });
      }

      // Save extracted text
      const textPath = 'uploads/company-info.txt';
      await fs.writeFile(textPath, text, 'utf8');
      
      console.log(`✓ Company info saved: ${textPath}`);
      console.log(`  Text length: ${text.length} characters`);

      res.json({
        success: true,
        message: 'Company information uploaded successfully',
        file: req.file.originalname,
        textPath,
        textLength: text.length
      });

    } catch (error) {
      console.error('❌ Error in uploadCompanyInfo:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
];

module.exports = {
  uploadCompanyInfo
};

