# Tender Eligibility Analyzer API

A Node.js backend API that automates tender eligibility analysis using Google Gemini 1.5 Flash AI. The system processes multiple tender PDFs, analyzes company eligibility, and sends automated email notifications with detailed reports.

## Features

- 📄 Extract text from PDF and DOCX documents
- 🤖 AI-powered summarization using Google Gemini 1.5 Flash
- 📊 Comprehensive eligibility analysis and table generation
- ✉️ Automated email notifications with DOCX reports
- 🚀 RESTful API with 5 main endpoints
- 📦 Postman collection for easy testing

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Groq API key ([Get it here](https://console.groq.com/))
- Gmail account with App Password enabled

## Installation

1. **Clone or download this project**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory with the following content:
   ```
   PORT=3000
   GEMINI_API_KEY_1=your_first_gemini_api_key
   GEMINI_API_KEY_2=your_second_gemini_api_key
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_TO=puneetk49081@gmail.com
   ```
   
   **API Key Rotation:**
   - The system automatically rotates between two API keys every 50 requests
   - On rate limit/quota errors, it automatically switches to the next key
   - You can use just one key (`GEMINI_API_KEY_1`), or both for better rate limits
   
   **Important:**
   - Get your Gemini API keys from [Google AI Studio](https://ai.google.dev/)
   - Create two API keys for optimal performance and rate limit handling
   - For Gmail, enable "App Password" in your Google Account settings:
     - Go to Google Account → Security → 2-Step Verification → App passwords
     - Generate an app password and use it for `EMAIL_PASS`

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

## Testing with Postman

1. Import `postman_collection.json` into Postman
2. Configure environment variables if needed
3. Start testing the endpoints

## Project Structure

```
project-root/
├── src/
│   ├── controllers/
│   │   ├── tenderController.js
│   │   ├── companyController.js
│   │   ├── analysisController.js
│   │   └── eligibilityController.js
│   ├── services/
│   │   ├── pdfService.js
│   │   ├── groqService.js
│   │   ├── emailService.js
│   │   └── docService.js
│   ├── routes/
│   │   └── apiRoutes.js
│   ├── config/
│   │   └── groqClient.js
│   ├── uploads/       (auto-generated)
│   ├── summaries/     (auto-generated)
│   └── analysis/       (auto-generated)
├── server.js
├── package.json
├── .env
├── .gitignore
└── README.md
```

## Workflow

1. **Upload Tender PDFs** → System extracts text and generates summaries
2. **Upload Company Info** → System extracts and saves text
3. **Analyze Tender** → System creates eligibility analysis table
4. **Check Eligibility** → System decides YES/NO and emails if NO
5. **Process All** → Automated workflow for both tenders

## AI Model

The system uses Google's **Gemini 1.5 Flash** model with:
- Large context window (1M tokens support)
- Fast and efficient inference
- Cost-effective for large documents
- Excellent for summarization and analysis tasks

**Available Models:**
- `gemini-1.5-flash` (default) - Fast and efficient
- `gemini-1.5-pro` - More capable, slower
- `gemini-1.5-flash-latest` - Latest version

**Note:** You can change the model in `src/config/groqClient.js` line 99.

## Email Configuration

When the company is NOT eligible:
- **Subject:** "Tender Eligibility Analysis Result - NOT ELIGIBLE - {TENDER_ID}"
- **Body:** "Please find attached the detailed eligibility analysis report."
- **Attachment:** DOCX file with eligibility table

## Error Handling

All endpoints include comprehensive error handling and logging:
- `console.log` for successful operations
- `console.error` for errors
- Structured JSON error responses

## Dependencies

- **express**: Web framework
- **multer**: File upload handling
- **groq-sdk**: Groq AI API integration
- **nodemailer**: Email functionality
- **pdf-parse**: PDF text extraction
- **mammoth**: DOCX text extraction
- **docx**: Generate DOCX reports
- **fs-extra**: File system operations
- **dotenv**: Environment variables

## Support

For issues or questions, please check:
- Logs in the console for detailed error messages
- Uploaded/saved files in their respective directories
- API response messages for specific errors

## License

ISC

