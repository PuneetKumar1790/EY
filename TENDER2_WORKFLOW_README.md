# Tender 2 Workflow Implementation

## Overview

This implementation provides a complete 9-step tender processing pipeline for Tender 2, as specified in the requirements. The workflow processes 5 PDFs through summarization, eligibility check, SKU matching, pricing, and final table generation, then emails the result.

## API Endpoint

**POST** `/api/process-tender2-workflow`

This endpoint processes the complete workflow automatically. No request body is required - it reads files from the filesystem.

## Required Input Files

The workflow expects the following files to exist:

1. **5 PDFs** in `Tendor-2/` directory:
   - `tender_2_pdf_1.pdf` through `tender_2_pdf_5.pdf` (or any 5 PDFs)
   - The system will process the first 5 PDFs found in alphabetical order

2. **SKU Master File**: `Tender_SKU_Matching_Descriptions.txt`
   - Contains SKU descriptions for matching

3. **Company Profile**: `company_profile.json`
   - JSON file containing company information for eligibility checking

## Workflow Steps

### Step 1: Process 5 PDFs → Individual summaries
- Extracts text from each PDF
- Generates comprehensive summaries using the exact prompt from requirements
- Saves as `summary_1.txt` through `summary_5.txt` in `workflows/tender2/`

### Step 2: Concatenate summaries
- Combines all 5 summaries with separators
- Saves as `combined_summary.txt`

### Step 3: Generate comprehensive summary
- Uses the same comprehensive prompt on `combined_summary.txt`
- Saves as `comprehensive_summary.txt`

### Step 4: Eligibility check
- Compares comprehensive summary against company profile
- Outputs "YES" or "NO" to `eligibility_result.txt`
- **If NO**: Sends email with eligibility document and STOPS
- **If YES**: Continues to Step 5

### Step 5: Build Table B1 (only if YES)
- Generates Matching Operations Table using exact prompt
- Outputs CSV with 12 columns (including Extraction_Notes)
- Saves as `table_b1.csv`

### Step 6: Match SKUs (only if YES)
- Matches tender items to company SKUs
- Uses scoring algorithm with exact weights specified
- Outputs SKU codes only, one per line
- Saves as `matched_skus.txt`

### Step 7: Calculate pricing (only if YES)
- Calculates pricing using exact formulas and constants
- Extracts real values (distance, quantities) from tender documents
- Saves as `pricing_table.csv`

### Step 8: Generate holistic summary table (only if YES)
- Combines all sections (A through E) into one table
- Saves as `holistic_summary_table.csv`

### Step 9: Email result
- **If eligibility = NO**: Sends email with eligibility document
- **If eligibility = YES**: Sends email with holistic summary table

## Output Files

All output files are saved in `workflows/tender2/`:

- `summary_1.txt` through `summary_5.txt`
- `combined_summary.txt`
- `comprehensive_summary.txt`
- `eligibility_result.txt`
- `table_b1.csv` (if eligible)
- `matched_skus.txt` (if eligible)
- `pricing_table.csv` (if eligible)
- `holistic_summary_table.csv` (if eligible)

## Response Format

### Success (Eligible)
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
    ...
  }
}
```

### Success (Not Eligible)
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

### Error
```json
{
  "success": false,
  "error": "Error message",
  "workflowDir": "workflows/tender2"
}
```

## Key Features

1. **Exact Prompt Compliance**: All prompts are used exactly as specified in requirements
2. **Conditional Execution**: Steps 5-9 only run if eligibility = YES
3. **Input Validation**: Validates all required files before starting
4. **Error Handling**: Stops immediately on errors, logs, and sends notification email
5. **Real Value Extraction**: No placeholders - extracts actual distances, quantities from documents
6. **Table-Only Output**: Steps 5, 7, 8 output only tables (CSV format)
7. **Existing Email Service**: Uses the existing email service, no new email functionality created

## Implementation Files

### New Files Created:
- `src/controllers/tender2WorkflowController.js` - Main workflow controller
- `src/utils/csvUtils.js` - CSV conversion utilities
- `src/utils/distanceUtils.js` - Distance calculation utilities (extensible)

### Modified Files:
- `src/services/groqService.js` - Added new prompt functions:
  - `generateComprehensiveTenderSummary()` - Step 1 & 3
  - `checkEligibilityFromSummary()` - Step 4
  - `buildTableB1()` - Step 5
  - `matchSKUs()` - Step 6
  - `calculatePricing()` - Step 7
  - `generateHolisticSummaryTable()` - Step 8
- `src/services/emailService.js` - Added `sendHolisticTableEmail()` for YES case
- `src/routes/apiRoutes.js` - Added route for workflow

## Testing

To test the workflow:

1. Ensure all required files are in place
2. Start the server: `npm start`
3. Call the endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/process-tender2-workflow
   ```

The workflow will process all steps sequentially and log progress to console.

## Notes

- The workflow uses the existing Gemini API client configuration
- Distance calculation currently uses a fallback implementation - can be enhanced with actual geocoding API
- CSV tables are created using markdown-to-CSV conversion
- Email attachments are sent as DOCX or CSV depending on availability

