const express = require("express");
const router = express.Router();
const tenderController = require("../controllers/tenderController");
const companyController = require("../controllers/companyController");
const analysisController = require("../controllers/analysisController");
const eligibilityController = require("../controllers/eligibilityController");
const tender2WorkflowController = require("../controllers/tender2WorkflowController");

// Test endpoint to verify Gemini API is working
router.get("/test-gemini", async (req, res) => {
  try {
    console.log("\n🧪 Testing Gemini API...");
    const { gemini, MODEL } = require("../config/groqClient");

    const result = await gemini.chat.completions.create({
      messages: [
        {
          role: "user",
          content:
            'Say "Hello, Gemini API is working!" in exactly those words.',
        },
      ],
      model: MODEL,
      temperature: 0.1,
      max_tokens: 50,
    });

    const response = result.choices[0].message.content;

    res.json({
      success: true,
      model: MODEL,
      response: response,
      length: response.length,
    });
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
    });
  }
});

// Upload tender PDFs
// POST /api/upload-tender/:tenderId
// Body: multipart/form-data with 'pdfs' field (max 5 files)
router.post("/upload-tender/:tenderId", tenderController.uploadTenderPDFs);

// Upload company information document
// POST /api/upload-company
// Body: multipart/form-data with 'document' field (PDF or DOCX)
router.post("/upload-company", companyController.uploadCompanyInfo);

// Upload SKU list file
// POST /api/upload-sku-list
// Body: multipart/form-data with 'skuFile' field (TXT file)
router.post("/upload-sku-list", companyController.uploadSKUList);

// Analyze tender eligibility
// POST /api/analyze-tender/:tenderId
// Reads summaries, company info, and generates eligibility table
router.post(
  "/analyze-tender/:tenderId",
  analysisController.analyzeTenderEligibility
);

// Check final eligibility and send email if not eligible
// POST /api/check-eligibility/:tenderId
// Checks eligibility and sends email with DOCX attachment if NOT eligible
router.post(
  "/check-eligibility/:tenderId",
  eligibilityController.checkEligibility
);

// Process all tenders sequentially
// POST /api/process-all
// Automates the entire workflow for both tenders
router.post("/process-all", eligibilityController.processAllTenders);

// Process Tender 2 workflow (9-step pipeline)
// POST /api/process-tender2-workflow
// Complete workflow: PDFs → Summaries → Eligibility → Table B1 → SKU Matching → Pricing → Holistic Table → Email
router.post("/process-tender2-workflow", tender2WorkflowController.processTender2Workflow);

// Process Tender 2 workflow with real-time progress updates (SSE)
// GET /api/process-tender2-workflow-stream
// Same as above but streams progress updates in real-time
router.get("/process-tender2-workflow-stream", tender2WorkflowController.processTender2WorkflowStream);

module.exports = router;
