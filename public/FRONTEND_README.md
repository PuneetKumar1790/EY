# Frontend Setup Guide

## Overview

The React frontend provides a user-friendly interface to:
- View all available tenders with their names and deadlines
- Start workflow operations for each tender
- Monitor real-time progress with status updates

## Setup

### 1. Install Dependencies

```bash
cd public
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or another port if 5173 is taken)

### 3. Start Backend Server

In a separate terminal, make sure the backend is running:

```bash
cd ..  # Go back to project root
npm start
```

The backend should run on `http://localhost:3000`

## Features

### Tender List
- Displays all available tenders (tender1 and tender2)
- Shows tender name and deadline
- Extracts information from PDF summaries if available

### Start Operations
- Click "Start Operations" button to begin workflow
- Button becomes disabled during processing
- Real-time status updates shown below

### Status Display
- **Processing**: Shows current step and progress percentage
- **Progress Bar**: Visual indicator of completion
- **Status Messages**: 
  - "Analyzing PDFs and generating summaries..."
  - "Eligibility analysis completed..."
  - "Checking final eligibility status..."
  - "Generating eligibility report..."
  - "Sending email notification..."
- **Final Result**: Shows eligibility status (Eligible/Not Eligible)

## API Endpoints Used

- `GET /api/tenders` - Get list of all tenders
- `POST /api/process-workflow/:tenderId` - Start workflow
- `GET /api/workflow-status/:tenderId` - Get current status (polled every 1 second)

## Configuration

The API base URL is set in `src/api.js`:
```javascript
const API_BASE_URL = 'http://localhost:3000/api';
```

If your backend runs on a different port, update this value.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` folder.

