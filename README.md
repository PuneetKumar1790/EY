# Tender Eligibility Analyzer API

A Node.js backend API that automates tender eligibility analysis using Google Gemini 2.5 Flash AI. The system processes multiple tender PDFs, analyzes company eligibility, performs SKU matching, calculates pricing, and sends automated email notifications with detailed reports.

## Features

- 📄 Extract text from PDF and DOCX documents
- 🤖 AI-powered summarization using Google Gemini 2.5 Flash
- 📊 Comprehensive eligibility analysis and table generation
- 🔄 Advanced 9-step workflow for Tender 2 processing
- 🎯 SKU matching with intelligent scoring algorithm
- 💰 Automated pricing calculations with real value extraction
- ✉️ Automated email notifications with DOCX/CSV reports
- 🚀 RESTful API with 6 main endpoints
- 🔑 Multi-key API rotation (supports up to 4 Gemini API keys)
- 📦 Postman collection for easy testing

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Gemini API keys (1-4 keys recommended for better rate limit handling)
- SendGrid account with API key (free tier: 100 emails/day)

## Installation

1. **Clone or download this project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory (or copy from `.env.example`):
   ```
   PORT=3000
   GEMINI_API_KEY_1=your_first_gemini_api_key
   GEMINI_API_KEY_2=your_second_gemini_api_key
   GEMINI_API_KEY_3=your_third_gemini_api_key
   GEMINI_API_KEY_4=your_fourth_gemini_api_key
   SENDGRID_API_KEY=your_sendgrid_api_key
   SENDGRID_FROM_EMAIL=your_verified_sender@example.com
   EMAIL_TO=recipient@example.com
   ```
   
   **API Key Rotation (Aggressive Strategy):**
   - The system supports up to 4 Gemini API keys for optimal performance
   - **Aggressive rotation**: Switches to next key on EVERY error (not just rate limits)
   - Maximum retries: 3x the number of configured keys
   - Automatic exponential backoff with jitter for single-key setups
   - You can use 1-4 keys; more keys = better reliability and throughput
   
   **Important:**
   - Get your Gemini API keys from [Google AI Studio](https://ai.google.dev/)
   - Configure 2-4 API keys for optimal performance and rate limit handling
   - For SendGrid:
     - Sign up at [SendGrid](https://sendgrid.com/) (free tier: 100 emails/day)
     - Create an API key from Settings → API Keys
     - Verify a sender email address from Settings → Sender Authentication
     - Use the API key for `SENDGRID_API_KEY` and verified email for `SENDGRID_FROM_EMAIL`

4. **Start the server**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## API Endpoints

### 1. Upload Tender PDFs
**POST** `/api/upload-tender/:tenderId`

Upload up to 5 tender PDFs. The system will:
- Extract text from each PDF
- Generate detailed summaries using AI
- Save summaries in `summaries/tenderId/`

**Example:**
```bash
curl -X POST http://localhost:3000/api/upload-tender/tender1 \
  -F "pdfs=@document1.pdf" \
  -F "pdfs=@document2.pdf"
```

**Parameters:**
- `tenderId`: tender1 or tender2
- `pdfs`: Array of PDF files (multipart/form-data)

---

### 2. Upload Company Information
**POST** `/api/upload-company`

Upload company information document (PDF or DOCX).

**Example:**
```bash
curl -X POST http://localhost:3000/api/upload-company \
  -F "document=@company_info.docx"
```

**Parameters:**
- `document`: PDF or DOCX file (multipart/form-data)

---

### 3. Analyze Tender Eligibility
**POST** `/api/analyze-tender/:tenderId`

Analyzes tender eligibility by:
1. Concatenating all 5 PDF summaries
2. Cross-referencing with company info
3. Generating eligibility analysis table

**Example:**
```bash
curl -X POST http://localhost:3000/api/analyze-tender/tender1
```

**Response:**
```json
{
  "success": true,
  "message": "Eligibility analysis completed for tender1",
  "tenderId": "tender1",
  "tablePath": "analysis/tender1/table.txt",
  "summary": {
    "totalSummaries": 5,
    "comprehensiveSummaryLength": 15234,
    "companyInfoLength": 8921,
    "eligibilityTableLength": 3456
  }
}
```

---

### 4. Check Eligibility
**POST** `/api/check-eligibility/:tenderId`

Checks final eligibility (YES/NO) and:
- If NO: Generates DOCX report and sends email
- If YES: Returns eligibility status

**Example:**
```bash
curl -X POST http://localhost:3000/api/check-eligibility/tender1
```

**Response:**
```json
{
  "success": true,
  "message": "Company is NOT eligible for tender1",
  "tenderId": "tender1",
  "eligible": false,
  "decision": "NO",
  "emailSent": true,
  "docxPath": "analysis/tender1/eligibility_report.docx"
}
```

---

### 5. Process All Tenders
**POST** `/api/process-all`

Automates the entire workflow for both tenders sequentially.

**Example:**
```bash
curl -X POST http://localhost:3000/api/process-all
```

**Response:**
```json
{
  "success": true,
  "message": "All tenders processed",
  "summary": {
    "eligible": 0,
    "notEligible": 2,
    "total": 2
  },
  "results": {
    "tender1": {
      "success": true,
      "eligible": false,
      "decision": "NO",
      "emailSent": true
    },
    "tender2": {
      "success": true,
      "eligible": false,
      "decision": "NO",
      "emailSent": true
    }
  }
}
```

---

### 6. Process Tender 2 Workflow (Advanced 9-Step Pipeline)
**POST** `/api/process-tender2-workflow`

Complete automated workflow for Tender 2 with advanced features:
1. **Process 5 PDFs** → Generate individual summaries
2. **Concatenate summaries** → Combine all summaries
3. **Generate comprehensive summary** → Create unified analysis
4. **Eligibility check** → YES/NO decision
5. **Build Table B1** → Matching operations table (if eligible)
6. **Match SKUs** → Intelligent SKU matching with scoring
7. **Calculate pricing** → Real value extraction and pricing
8. **Generate holistic table** → Combined summary table
9. **Email result** → Send appropriate report

**Example:**
```bash
curl -X POST http://localhost:3000/api/process-tender2-workflow
```

**Response (Eligible):**
```json
{
  "success": true,
  "message": "Tender 2 workflow completed successfully",
  "eligibility": "YES",
  "emailSent": true,
  "workflowDir": "workflows/tender2",
  "outputs": {
    "summary1": "workflows/tender2/summary_1.txt",
    "comprehensiveSummary": "workflows/tender2/comprehensive_summary.txt",
    "eligibilityResult": "workflows/tender2/eligibility_result.txt",
    "tableB1": "workflows/tender2/table_b1.csv",
    "matchedSKUs": "workflows/tender2/matched_skus.txt",
    "pricingTable": "workflows/tender2/pricing_table.csv",
    "holisticTable": "workflows/tender2/holistic_summary_table.csv"
  }
}
```

**Response (Not Eligible):**
```json
{
  "success": true,
  "message": "Tender 2 workflow completed - Company NOT eligible",
  "eligibility": "NO",
  "emailSent": true,
  "docxPath": "analysis/tender2/eligibility_report.docx",
  "workflowDir": "workflows/tender2"
}
```

**Required Input Files:**
- 5 PDFs in `Tendor-2/` directory
- `Tender_SKU_Matching_Descriptions.txt` (SKU master file)
- `company_profile.json` (company information)

**Key Features:**
- Conditional execution: Steps 5-9 only run if eligible
- Real value extraction from documents (no placeholders)
- CSV table outputs for structured data
- Intelligent SKU matching with weighted scoring
- Automated pricing calculations

## Testing with Postman

1. Import `postman_collection.json` into Postman
2. Configure environment variables if needed
3. Start testing the endpoints

## Project Structure

```
project-root/
├── src/
│   ├── controllers/
│   │   ├── tenderController.js              # Tender PDF upload handling
│   │   ├── companyController.js             # Company info upload handling
│   │   ├── analysisController.js            # Eligibility analysis logic
│   │   ├── eligibilityController.js         # Final eligibility check & email
│   │   └── tender2WorkflowController.js     # 9-step Tender 2 workflow
│   ├── services/
│   │   ├── pdfService.js                    # PDF text extraction
│   │   ├── docxService.js                   # DOCX text extraction
│   │   ├── groqService.js                   # Gemini AI integration (all prompts)
│   │   ├── emailService.js                  # Email sending with attachments
│   │   └── docService.js                    # DOCX report generation
│   ├── utils/
│   │   ├── csvUtils.js                      # CSV conversion utilities
│   │   ├── distanceUtils.js                 # Distance calculation utilities
│   │   └── docxTableUtils.js                # DOCX table formatting
│   ├── routes/
│   │   └── apiRoutes.js                     # API endpoint definitions
│   └── config/
│       └── groqClient.js                    # Gemini client with key rotation
├── uploads/                                  # Uploaded files (auto-generated)
│   ├── tender1/
│   ├── tender2/
│   └── company/
├── summaries/                                # Generated summaries (auto-generated)
│   ├── tender1/
│   └── tender2/
├── analysis/                                 # Analysis results (auto-generated)
│   ├── tender1/
│   └── tender2/
├── workflows/                                # Tender 2 workflow outputs (auto-generated)
│   └── tender2/
├── Tendor-1/                                 # Tender 1 input PDFs
├── Tendor-2/                                 # Tender 2 input PDFs
├── server.js                                 # Express server entry point
├── package.json                              # Dependencies and scripts
├── .env                                      # Environment variables (create from template)
├── env.template                              # Environment variables template
├── .gitignore                                # Git ignore rules
├── README.md                                 # Main documentation (this file)
├── TENDER2_WORKFLOW_README.md                # Detailed Tender 2 workflow docs
├── QUICK_START.md                            # Quick start guide
├── INSTALL.md                                # Installation guide
├── POSTMAN_SETUP_GUIDE.md                    # Postman testing guide
├── postman_collection.json                   # Postman API collection
└── Tender_SKU_Matching_Descriptions.txt      # SKU master file for matching
```

## Workflows

### Standard Workflow (Tender 1 & 2)
1. **Upload Tender PDFs** → System extracts text and generates summaries
2. **Upload Company Info** → System extracts and saves text
3. **Analyze Tender** → System creates eligibility analysis table
4. **Check Eligibility** → System decides YES/NO and emails if NO
5. **Process All** → Automated workflow for both tenders

### Advanced Tender 2 Workflow (9-Step Pipeline)
1. **Process 5 PDFs** → Individual summaries generated
2. **Concatenate Summaries** → Combined into single document
3. **Comprehensive Summary** → Unified analysis created
4. **Eligibility Check** → YES/NO decision made
5. **Build Table B1** → Matching operations table (if YES)
6. **Match SKUs** → Intelligent matching with scoring (if YES)
7. **Calculate Pricing** → Real value extraction and pricing (if YES)
8. **Generate Holistic Table** → Combined summary table (if YES)
9. **Email Result** → Appropriate report sent based on eligibility

## AI Model

The system uses Google's **Gemini 2.5 Flash** model with:
- Ultra-large context window (2M tokens support)
- Fast and efficient inference
- Cost-effective for large documents
- Excellent for summarization, analysis, and complex reasoning tasks
- Enhanced capabilities over previous versions

**Current Model:** `gemini-2.5-flash` (configured in `src/config/groqClient.js`)

**Model Configuration:**
- Default max output tokens: 65,536
- Adaptive timeout: 7 minutes for all requests
- Temperature: 0.3-0.7 (depending on task)
- Safety settings: Configured to BLOCK_NONE for all categories

**Note:** You can change the model in `src/config/groqClient.js` line 140.

## Email Configuration

### Not Eligible (Standard Workflow)
- **Subject:** "Tender Eligibility Analysis Result - NOT ELIGIBLE - {TENDER_ID}"
- **Body:** "Please find attached the detailed eligibility analysis report."
- **Attachment:** DOCX file with eligibility table

### Eligible (Tender 2 Workflow)
- **Subject:** "Tender 2 - Holistic Summary Table - ELIGIBLE"
- **Body:** "Company is eligible for Tender 2. Please find attached the holistic summary table."
- **Attachment:** CSV file with holistic summary table

### Not Eligible (Tender 2 Workflow)
- **Subject:** "Tender 2 Eligibility Analysis Result - NOT ELIGIBLE"
- **Body:** "Please find attached the detailed eligibility analysis report."
- **Attachment:** DOCX file with eligibility analysis

## API Key Rotation System

The system implements an **aggressive rotation strategy** for optimal reliability:

### Key Features
- **Multi-key support:** Configure 1-4 Gemini API keys
- **Aggressive rotation:** Switches to next key on EVERY error (not just rate limits)
- **Smart retry logic:** Maximum retries = 3x number of configured keys
- **Exponential backoff:** For single-key setups with jitter
- **Automatic recovery:** Seamlessly handles quota exhaustion and rate limits

### How It Works
1. System starts with API key #1
2. On any error (rate limit, quota, timeout, etc.), immediately rotates to next key
3. Tracks which keys have been attempted to avoid infinite loops
4. After trying all keys, throws error with detailed message
5. Short delay (1 second) after rotation to avoid cascading rate limits

### Configuration
```env
GEMINI_API_KEY_1=your_first_key    # Required
GEMINI_API_KEY_2=your_second_key   # Optional
GEMINI_API_KEY_3=your_third_key    # Optional
GEMINI_API_KEY_4=your_fourth_key   # Optional
```

**Recommendation:** Use all 4 keys for maximum reliability and throughput.

## Error Handling

All endpoints include comprehensive error handling and logging:
- `console.log` for successful operations
- `console.error` for errors with detailed stack traces
- Structured JSON error responses
- Automatic API key rotation on failures
- Graceful degradation with fallback mechanisms

## Dependencies

- **express**: Web framework
- **multer**: File upload handling
- **@google/generative-ai**: Google Gemini AI API integration
- **nodemailer**: Email functionality with attachment support
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX text extraction
- **docx**: Generate DOCX reports with tables
- **fs-extra**: Enhanced file system operations
- **dotenv**: Environment variables management

### Dev Dependencies
- **nodemon**: Auto-reload during development

## Additional Documentation

For more detailed information, refer to these guides:
- **[TENDER2_WORKFLOW_README.md](TENDER2_WORKFLOW_README.md)** - Detailed Tender 2 workflow documentation
- **[QUICK_START.md](QUICK_START.md)** - Quick start guide
- **[INSTALL.md](INSTALL.md)** - Detailed installation instructions
- **[POSTMAN_SETUP_GUIDE.md](POSTMAN_SETUP_GUIDE.md)** - Postman testing guide

## Key Features Summary

### 🔄 Advanced Workflows
- **Standard workflow**: Upload → Analyze → Check → Email
- **Tender 2 workflow**: 9-step pipeline with SKU matching and pricing

### 🤖 AI-Powered Analysis
- Comprehensive tender summarization
- Eligibility criteria extraction and matching
- Intelligent SKU matching with weighted scoring
- Real value extraction from documents

### 🔑 Robust API Key Management
- Support for up to 4 Gemini API keys
- Aggressive rotation on every error
- Automatic retry with exponential backoff
- Maximum reliability and throughput

### 📊 Data Processing
- PDF and DOCX text extraction
- CSV table generation
- DOCX report creation with formatted tables
- Real-time distance and pricing calculations

### ✉️ Automated Notifications
- Email reports for eligible and non-eligible cases
- DOCX and CSV attachments
- Customizable email templates

## Troubleshooting

### Common Issues

**API Key Errors:**
- Ensure all API keys are valid and active
- Check quota limits on Google AI Studio
- Verify `.env` file is properly configured

**File Upload Issues:**
- Check file size limits (default: no limit set)
- Ensure directories have write permissions
- Verify file formats (PDF, DOCX supported)

**Email Not Sending:**
- Verify SendGrid API key is correct and active
- Check sender email is verified in SendGrid dashboard
- Ensure SENDGRID_API_KEY and SENDGRID_FROM_EMAIL are set correctly
- Check SendGrid dashboard for delivery logs and errors

**Workflow Failures:**
- Check all required input files exist
- Review console logs for detailed error messages
- Verify API keys have sufficient quota

## Performance Optimization

### With 4 API Keys
- **Throughput**: ~4x higher than single key
- **Reliability**: Automatic failover on errors
- **Rate Limits**: Distributed across multiple keys
- **Recommended for**: Production environments

### With 1 API Key
- **Throughput**: Standard rate limits apply
- **Reliability**: Exponential backoff on errors
- **Rate Limits**: Single key quota
- **Recommended for**: Development/testing

## Support

For issues or questions:
- Check console logs for detailed error messages
- Review output files in respective directories
- Verify API response messages
- Check the additional documentation files

## Quick Reference

### Environment Variables (4 API Keys)
```env
PORT=3000
GEMINI_API_KEY_1=your_first_gemini_api_key
GEMINI_API_KEY_2=your_second_gemini_api_key
GEMINI_API_KEY_3=your_third_gemini_api_key
GEMINI_API_KEY_4=your_fourth_gemini_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=your_verified_sender@example.com
EMAIL_TO=recipient@example.com
```

### Quick Start Commands
```bash
# Install dependencies
npm install

# Start server
npm start

# Development mode (auto-reload)
npm run dev

# Test Gemini API
curl http://localhost:3000/api/test-gemini

# Health check
curl http://localhost:3000/health
```

### API Endpoints Summary
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload-tender/:tenderId` | POST | Upload tender PDFs |
| `/api/upload-company` | POST | Upload company info |
| `/api/analyze-tender/:tenderId` | POST | Analyze eligibility |
| `/api/check-eligibility/:tenderId` | POST | Check & email result |
| `/api/process-all` | POST | Process all tenders |
| `/api/process-tender2-workflow` | POST | Run Tender 2 pipeline |
| `/api/test-gemini` | GET | Test Gemini API |
| `/health` | GET | Health check |

### Directory Structure Quick Reference
```
uploads/        → Uploaded PDFs and documents
summaries/      → AI-generated summaries
analysis/       → Eligibility analysis results
workflows/      → Tender 2 workflow outputs
Tendor-1/       → Tender 1 input PDFs
Tendor-2/       → Tender 2 input PDFs
```

## License

ISC

