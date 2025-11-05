const express = require("express");
const router = express.Router();
const tenderController = require("../controllers/tenderController");
const companyController = require("../controllers/companyController");
const analysisController = require("../controllers/analysisController");
const eligibilityController = require("../controllers/eligibilityController");
const tender2WorkflowController = require("../controllers/tender2WorkflowController");
const tenderInfoController = require("../controllers/tenderInfoController");
const workflowController = require("../controllers/workflowController");

/**
 * @swagger
 * /api/test-gemini:
 *   get:
 *     summary: Test Gemini API connection
 *     description: Verifies that the Gemini API is working correctly by sending a test request
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Successful API test
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GeminiTestResponse'
 *       500:
 *         description: API test failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/upload-tender/{tenderId}:
 *   post:
 *     summary: Upload tender PDFs
 *     description: Upload up to 5 tender PDFs. The system extracts text from each PDF and generates AI summaries using Google Gemini.
 *     tags: [Tender Management]
 *     parameters:
 *       - in: path
 *         name: tenderId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [tender1, tender2]
 *         description: The tender identifier
 *         example: tender1
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - pdfs
 *             properties:
 *               pdfs:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Array of PDF files (maximum 5 files, each max 50MB)
 *           encoding:
 *             pdfs:
 *               contentType: application/pdf
 *     responses:
 *       200:
 *         description: PDFs processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TenderUploadResponse'
 *       400:
 *         description: Bad request (no files uploaded or invalid tender ID)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/upload-tender/:tenderId", tenderController.uploadTenderPDFs);

/**
 * @swagger
 * /api/upload-company:
 *   post:
 *     summary: Upload company information document
 *     description: Upload a company information document (PDF or DOCX). The system extracts text and saves it for eligibility analysis.
 *     tags: [Company Management]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Company information document (PDF or DOCX, max 50MB)
 *     responses:
 *       200:
 *         description: Company information uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CompanyUploadResponse'
 *       400:
 *         description: Bad request (no file uploaded or invalid file type)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/upload-company", companyController.uploadCompanyInfo);

/**
 * @swagger
 * /api/analyze-tender/{tenderId}:
 *   post:
 *     summary: Analyze tender eligibility
 *     description: Analyzes tender eligibility by concatenating all PDF summaries, cross-referencing with company info, and generating an eligibility analysis table using AI.
 *     tags: [Analysis]
 *     parameters:
 *       - in: path
 *         name: tenderId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [tender1, tender2]
 *         description: The tender identifier
 *         example: tender1
 *     responses:
 *       200:
 *         description: Eligibility analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalysisResponse'
 *       400:
 *         description: Bad request (no summaries found or company info missing)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/analyze-tender/:tenderId",
  analysisController.analyzeTenderEligibility
);

/**
 * @swagger
 * /api/check-eligibility/{tenderId}:
 *   post:
 *     summary: Check final eligibility and send email
 *     description: Checks final eligibility (YES/NO) using AI. If NOT eligible, generates a DOCX report and sends an automated email with the attachment. If eligible, returns status without sending email.
 *     tags: [Eligibility]
 *     parameters:
 *       - in: path
 *         name: tenderId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [tender1, tender2]
 *         description: The tender identifier
 *         example: tender1
 *     responses:
 *       200:
 *         description: Eligibility check completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EligibilityCheckResponse'
 *       400:
 *         description: Bad request (eligibility table not found)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/check-eligibility/:tenderId",
  eligibilityController.checkEligibility
);

/**
 * @swagger
 * /api/process-all:
 *   post:
 *     summary: Process all tenders sequentially
 *     description: Automates the entire workflow for both tender1 and tender2. Processes each tender's analysis, checks eligibility, and sends emails if not eligible.
 *     tags: [Eligibility]
 *     responses:
 *       200:
 *         description: All tenders processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProcessAllResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/process-all", eligibilityController.processAllTenders);

/**
 * @swagger
 * /api/process-tender2-workflow:
 *   post:
 *     summary: Process Tender 2 complete workflow (9-step pipeline)
 *     description: |
 *       Complete automated workflow for Tender 2:
 *       1. Process 5 PDFs → Individual summaries
 *       2. Concatenate summaries
 *       3. Generate comprehensive summary
 *       4. Check eligibility (YES/NO)
 *       5. Build Table B1 (Matching Operations Table) - only if YES
 *       6. Match SKUs to company inventory - only if YES
 *       7. Calculate pricing with formulas - only if YES
 *       8. Generate holistic summary table - only if YES
 *       9. Send email (eligibility doc if NO, holistic table if YES)
 *       
 *       **Required files:**
 *       - 5 PDFs in `Tendor-2/` directory
 *       - `Tender_SKU_Matching_Descriptions.txt` in root
 *       - Company info uploaded via `/api/upload-company`
 *     tags: [Workflow]
 *     responses:
 *       200:
 *         description: Tender 2 workflow completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Tender2WorkflowResponse'
 *       400:
 *         description: Bad request (missing required files)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/process-tender2-workflow", tender2WorkflowController.processTender2Workflow);

/**
 * @swagger
 * /api/tenders:
 *   get:
 *     summary: Get list of all tenders
 *     description: Returns a list of all available tenders with their names and deadlines
 *     tags: [Tender Management]
 *     responses:
 *       200:
 *         description: List of tenders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 tenders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       deadline:
 *                         type: string
 *                       hasSummaries:
 *                         type: boolean
 */
router.get("/tenders", tenderInfoController.getTendersList);

/**
 * @swagger
 * /api/tender-info/{tenderId}:
 *   get:
 *     summary: Get tender information
 *     description: Returns detailed information about a specific tender including name and deadline
 *     tags: [Tender Management]
 *     parameters:
 *       - in: path
 *         name: tenderId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [tender1, tender2]
 *     responses:
 *       200:
 *         description: Tender information retrieved successfully
 */
router.get("/tender-info/:tenderId", tenderInfoController.getTenderInfo);

/**
 * @swagger
 * /api/process-workflow/{tenderId}:
 *   post:
 *     summary: Start workflow processing for a tender
 *     description: Starts the workflow processing for a specific tender. Returns immediately and processes in background. Use status endpoint to track progress.
 *     tags: [Workflow]
 *     parameters:
 *       - in: path
 *         name: tenderId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [tender1, tender2]
 *     responses:
 *       200:
 *         description: Workflow started successfully
 */
router.post("/process-workflow/:tenderId", workflowController.processWorkflow);

/**
 * @swagger
 * /api/workflow-status/{tenderId}:
 *   get:
 *     summary: Get workflow status
 *     description: Returns the current status of workflow processing for a tender
 *     tags: [Workflow]
 *     parameters:
 *       - in: path
 *         name: tenderId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [tender1, tender2]
 *     responses:
 *       200:
 *         description: Workflow status retrieved successfully
 */
router.get("/workflow-status/:tenderId", workflowController.getWorkflowStatus);

/**
 * @swagger
 * /api/eligibility-report/{tenderId}:
 *   get:
 *     summary: Get eligibility report
 *     description: Returns the eligibility analysis table/report for a tender
 *     tags: [Workflow]
 *     parameters:
 *       - in: path
 *         name: tenderId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [tender1, tender2]
 *     responses:
 *       200:
 *         description: Eligibility report retrieved successfully
 *       404:
 *         description: Report not found
 */
router.get("/eligibility-report/:tenderId", workflowController.getEligibilityReport);

module.exports = router;
