# Postman Collection Setup Guide

## Quick Start

1. **Import Collection**
   - Open Postman
   - Click "Import" button
   - Select `postman_collection.json` file
   - Collection will be imported with folders organized by workflow type

2. **Configure Base URL** (Optional)
   - The collection uses `http://localhost:3000` by default
   - You can modify the `base_url` variable in the collection if needed

## Collection Structure

### 📁 Setup & Configuration
- **Health Check** - Verify API is running
- **Test Gemini API** - Test API connectivity
- **Upload Company Information** ⭐ **REQUIRED FIRST**

### 📁 Tender 2 Workflow (Complete Pipeline) ⭐ **NEW**
- **Upload Tender 2 PDFs** (Optional - if PDFs not in directory)
- **Process Tender 2 Complete Workflow** ⭐ **Main Endpoint**

### 📁 Tender 1 Workflow (Legacy)
- Individual step endpoints for Tender 1

### 📁 Tender 2 Individual Steps (Legacy)
- Individual step endpoints (for testing/debugging)

### 📁 Bulk Operations
- Process All Tenders (legacy workflow)

## Testing Tender 2 Workflow

### Step-by-Step Process:

1. **Prerequisites Check**
   - Ensure server is running: `npm start`
   - Verify 5 PDFs exist in `Tendor-2/` directory OR upload them
   - Ensure `Tender_SKU_Matching_Descriptions.txt` exists in root

2. **Upload Company Information** ⭐ **MUST DO FIRST**
   - Go to: **Setup & Configuration → Upload Company Information**
   - Select your company DOCX or PDF file
   - Click "Send"
   - Verify response shows `success: true`
   - This extracts text automatically and saves it

3. **Run Complete Workflow**
   - Go to: **Tender 2 Workflow → Process Tender 2 Complete Workflow**
   - Click "Send"
   - **Wait** - This is a long-running process (5-10 minutes)
   - Monitor server console for progress logs

4. **Check Results**
   - Response will include all output file paths
   - Check `workflows/tender2/` directory for all generated files
   - Check email inbox for final result email

## Expected Response (Success - Eligible)

```json
{
  "success": true,
  "message": "Tender 2 workflow completed successfully",
  "eligibility": "YES",
  "emailSent": true,
  "workflowDir": "workflows/tender2",
  "outputs": {
    "summary1": "workflows/tender2/summary_1.txt",
    "summary2": "workflows/tender2/summary_2.txt",
    "summary3": "workflows/tender2/summary_3.txt",
    "summary4": "workflows/tender2/summary_4.txt",
    "summary5": "workflows/tender2/summary_5.txt",
    "combinedSummary": "workflows/tender2/combined_summary.txt",
    "comprehensiveSummary": "workflows/tender2/comprehensive_summary.txt",
    "eligibilityResult": "workflows/tender2/eligibility_result.txt",
    "tableB1": "workflows/tender2/table_b1.csv",
    "matchedSkus": "workflows/tender2/matched_skus.txt",
    "pricingTable": "workflows/tender2/pricing_table.csv",
    "holisticTable": "workflows/tender2/holistic_summary_table.csv"
  }
}
```

## Expected Response (Success - Not Eligible)

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

## Troubleshooting

### Error: "Company information not found"
- **Solution**: Upload company document first using **Setup & Configuration → Upload Company Information**

### Error: "Expected 5 PDFs in Tendor-2 directory, found X"
- **Solution**: Either:
  - Place 5 PDF files in `Tendor-2/` directory, OR
  - Use **Tender 2 Workflow → Upload Tender 2 PDFs** endpoint first

### Error: "SKU master file not found"
- **Solution**: Ensure `Tender_SKU_Matching_Descriptions.txt` exists in project root directory

### Workflow takes too long
- This is normal - the workflow processes 5 PDFs through multiple AI calls
- Typical duration: 5-10 minutes
- Monitor server console for progress

### No email received
- Check `.env` file has correct email configuration:
  - `EMAIL_USER=your_email@gmail.com`
  - `EMAIL_PASS=your_app_password`
  - `EMAIL_TO=recipient@email.com`
- Check server logs for email sending errors

## File Locations

### Input Files (Required)
- `Tendor-2/*.pdf` - 5 PDF files (or upload via endpoint)
- `Tender_SKU_Matching_Descriptions.txt` - SKU master file
- Company DOCX/PDF - Upload via `/api/upload-company`

### Output Files (Generated)
- `workflows/tender2/` - All workflow outputs
- `analysis/tender2/` - Eligibility reports (if not eligible)
- `uploads/company-info.txt` - Extracted company text

## Tips

1. **Use Collection Runner** for automated testing:
   - Select collection folder
   - Click "Run" button
   - Configure run order and iterations

2. **Save Responses** for debugging:
   - Right-click request → "Save Response"
   - Use "Save as Example" for documentation

3. **Environment Variables** (Optional):
   - Create environment for different servers (dev/staging/prod)
   - Update `base_url` variable accordingly

4. **Monitor Progress**:
   - Keep server console open to see step-by-step progress
   - Each step logs its completion status

## Support

For issues or questions:
1. Check server console logs
2. Verify all prerequisites are met
3. Review error messages in Postman response
4. Check `TENDER2_WORKFLOW_README.md` for detailed workflow documentation

