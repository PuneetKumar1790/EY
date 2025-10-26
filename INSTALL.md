# Installation Instructions

## Quick Start Guide

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy `env.template` to `.env` and fill in your credentials:

```bash
cp env.template .env
```

Or manually create a `.env` file:

```
PORT=3000
GROQ_API_KEY_1=your_first_groq_api_key
GROQ_API_KEY_2=your_second_groq_api_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_TO=puneetk49081@gmail.com
```

**Note:** You can use just one API key (`GROQ_API_KEY_1`), but two keys provide better rate limit handling.

**How to get your Groq API Key:**
1. Visit https://console.groq.com/
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key
5. Copy and paste it into `.env` file

**How to set up Gmail App Password:**
1. Go to your Google Account settings
2. Navigate to Security → 2-Step Verification
3. Scroll down to "App passwords"
4. Generate a new app password for "Mail"
5. Use this password (not your Gmail password) in `.env` file

### Step 3: Start the Server
```bash
npm start
```

The server will be running at: `http://localhost:3000`

### Step 4: Test with Postman
1. Import `postman_collection.json` into Postman
2. Test the `/health` endpoint first to verify server is running
3. Follow the workflow:
   - Upload Tender 1 PDFs
   - Upload Tender 2 PDFs
   - Upload Company Information
   - Analyze each tender
   - Check eligibility

## Project Structure
```
├── src/
│   ├── controllers/    # API route handlers
│   ├── services/      # Business logic services
│   ├── routes/        # API routes
│   └── config/        # Configuration files
├── server.js          # Entry point
├── package.json       # Dependencies
├── .env              # Environment variables (create this)
└── README.md         # Full documentation
```

## Testing Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### Upload Tender PDFs
```bash
curl -X POST http://localhost:3000/api/upload-tender/tender1 \
  -F "pdfs=@document1.pdf" \
  -F "pdfs=@document2.pdf"
```

### Upload Company Info
```bash
curl -X POST http://localhost:3000/api/upload-company \
  -F "document=@company_info.docx"
```

### Analyze Tender
```bash
curl -X POST http://localhost:3000/api/analyze-tender/tender1
```

### Check Eligibility
```bash
curl -X POST http://localhost:3000/api/check-eligibility/tender1
```

## Troubleshooting

### Error: Cannot find module
Run `npm install` again to ensure all dependencies are installed.

### Error: Missing environment variables
Make sure your `.env` file exists and contains all required variables.

### Error: Email sending failed
Verify your Gmail app password is correct and 2-Step Verification is enabled.

### Error: Groq API error
Check that your Groq API key is valid and hasn't reached rate limits.

## Support
See README.md for detailed API documentation and usage examples.

