# 🚀 Quick Start Guide

## What This Project Does

This is a **Tender Eligibility Analyzer** that:
1. 📄 Processes multiple tender PDFs (extracts text, generates AI summaries)
2. 📊 Analyzes company eligibility against tender requirements
3. ✉️ Sends automated emails with detailed reports when NOT eligible
4. 🤖 Uses Google Gemini 1.5 Flash for intelligent analysis

## Setup (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Create `.env` file
Create a `.env` file in the root directory with:
```
PORT=3000
GEMINI_API_KEY_1=your_first_gemini_api_key_here
GEMINI_API_KEY_2=your_second_gemini_api_key_here
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_TO=puneetk49081@gmail.com
```

**API Key Rotation:**
- You can use one or two API keys (two is recommended for better rate limits)
- System rotates keys every 50 requests automatically
- On quota errors, automatically switches to the next key

**Get Gemini API Keys:** https://ai.google.dev/  
**Setup Gmail App Password:** Google Account → Security → 2-Step Verification → App passwords

### 3. Start Server
```bash
npm start
```

Server runs on: `http://localhost:3000`

## Testing Workflow

### Option A: Using Postman (Recommended)

1. **Import Collection**
   - Open Postman
   - Import `postman_collection.json`
   
2. **Follow This Order:**
   - ✅ Upload Tender 1 PDFs (5 files)
   - ✅ Upload Tender 2 PDFs (5 files)
   - ✅ Upload Company Information (PDF or DOCX)
   - ✅ Analyze Tender 1 Eligibility
   - ✅ Analyze Tender 2 Eligibility
   - ✅ Check Tender 1 Eligibility
   - ✅ Check Tender 2 Eligibility
   - 🎯 OR use "Process All Tenders" to automate everything

### Option B: Using cURL

**1. Upload Tender 1 PDFs:**
```bash
curl -X POST http://localhost:3000/api/upload-tender/tender1 \
  -F "pdfs=@path/to/pdf1.pdf" \
  -F "pdfs=@path/to/pdf2.pdf" \
  -F "pdfs=@path/to/pdf3.pdf" \
  -F "pdfs=@path/to/pdf4.pdf" \
  -F "pdfs=@path/to/pdf5.pdf"
```

**2. Upload Company Info:**
```bash
curl -X POST http://localhost:3000/api/upload-company \
  -F "document=@company.docx"
```

**3. Analyze & Check:**
```bash
# Analyze
curl -X POST http://localhost:3000/api/analyze-tender/tender1

# Check eligibility (will send email if NOT eligible)
curl -X POST http://localhost:3000/api/check-eligibility/tender1
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload-tender/:tenderId` | Upload 5 tender PDFs |
| POST | `/api/upload-company` | Upload company info |
| POST | `/api/analyze-tender/:tenderId` | Generate eligibility table |
| POST | `/api/check-eligibility/:tenderId` | Check YES/NO + send email if NO |
| POST | `/api/process-all` | Automate everything |
| GET | `/health` | Health check |

## What Happens Automatically

### When Company is NOT Eligible:
1. ✅ Eligibility analysis table is generated
2. ✅ DOCX report is created
3. ✅ Email is sent with attachment to `EMAIL_TO`
4. ✅ Subject: "Tender Eligibility Analysis Result - NOT ELIGIBLE"
5. ✅ Body: "Please find attached the detailed eligibility analysis report."

### When Company IS Eligible:
1. ✅ Eligibility status is returned
2. ✅ No email is sent
3. ✅ Process continues to next tender

## File Structure

```
├── src/
│   ├── controllers/      # API handlers
│   │   ├── tenderController.js
│   │   ├── companyController.js
│   │   ├── analysisController.js
│   │   └── eligibilityController.js
│   ├── services/         # Business logic
│   │   ├── pdfService.js
│   │   ├── groqService.js
│   │   ├── emailService.js
│   │   ├── docService.js
│   │   └── docxService.js
│   ├── routes/           # API routes
│   └── config/           # Configuration
│       └── groqClient.js
├── server.js             # Entry point
├── package.json          # Dependencies
├── .env                  # Configuration (create this!)
├── postman_collection.json
└── README.md             # Full documentation
```

## Important Notes

1. **PDFs**: Each tender needs 5 PDF documents
2. **Summaries**: System generates AI summaries for each PDF (no re-summarization)
3. **Concatenation**: All 5 summaries are combined into one comprehensive summary
4. **Analysis**: Eligibility table is generated comparing tender vs company
5. **Email**: Only sent when company is NOT eligible

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot find module` | Run `npm install` |
| `Missing .env` | Create `.env` file with required variables |
| `Email failed` | Check Gmail app password setup |
| `Groq API error` | Verify API key and check rate limits |
| `Empty PDF text` | Ensure PDF has extractable text (not scanned images) |

## Next Steps

1. ✅ Configure `.env` with your credentials
2. ✅ Run `npm install`
3. ✅ Start server with `npm start`
4. ✅ Test with Postman collection
5. ✅ Upload your actual tender PDFs
6. ✅ Check results and emails

## Support

See `README.md` for detailed API documentation and advanced usage.

