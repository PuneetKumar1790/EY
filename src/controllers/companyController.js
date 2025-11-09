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

// Configure multer for SKU file uploads
const skuStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, 'sku-list.txt');
  }
});

const skuUpload = multer({ 
  storage: skuStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only TXT files are allowed'));
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

/**
 * Upload SKU list file
 * POST /api/upload-sku-list
 */
const uploadSKUList = [
  skuUpload.single('skuFile'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'No SKU file uploaded' 
        });
      }

      console.log(`\n📋 Processing SKU list: ${req.file.originalname}`);

      // Read the file content to validate it
      const content = await fs.readFile(req.file.path, 'utf8');
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'SKU file is empty'
        });
      }

      // Count lines
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      
      console.log(`✓ SKU list uploaded: ${req.file.path}`);
      console.log(`  Total entries: ${lines.length}`);

      res.json({
        success: true,
        message: 'SKU list uploaded successfully',
        file: req.file.originalname,
        filePath: req.file.path,
        entries: lines.length
      });

    } catch (error) {
      console.error('❌ Error in uploadSKUList:', error.message);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
];

module.exports = {
  uploadCompanyInfo,
  uploadSKUList
};

