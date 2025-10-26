const express = require('express');
const router = express.Router();
const tenderController = require('../controllers/tenderController');
const companyController = require('../controllers/companyController');
const analysisController = require('../controllers/analysisController');
const eligibilityController = require('../controllers/eligibilityController');

// Upload tender PDFs
// POST /api/upload-tender/:tenderId
// Body: multipart/form-data with 'pdfs' field (max 5 files)
router.post('/upload-tender/:tenderId', tenderController.uploadTenderPDFs);

// Upload company information document
// POST /api/upload-company
// Body: multipart/form-data with 'document' field (PDF or DOCX)
router.post('/upload-company', companyController.uploadCompanyInfo);

// Analyze tender eligibility
// POST /api/analyze-tender/:tenderId
// Reads summaries, company info, and generates eligibility table
router.post('/analyze-tender/:tenderId', analysisController.analyzeTenderEligibility);

// Check final eligibility and send email if not eligible
// POST /api/check-eligibility/:tenderId
// Checks eligibility and sends email with DOCX attachment if NOT eligible
router.post('/check-eligibility/:tenderId', eligibilityController.checkEligibility);

// Process all tenders sequentially
// POST /api/process-all
// Automates the entire workflow for both tenders
router.post('/process-all', eligibilityController.processAllTenders);

module.exports = router;

