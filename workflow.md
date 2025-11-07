# 🔄 Tender Management System - Complete Workflow

## 🎯 Overview

Welcome to the **Tender Eligibility Analyzer** - an intelligent, automated system designed to revolutionize how Asian Wires Pvt. Ltd. discovers, analyzes, and responds to tender opportunities in the cables and wires industry. This document outlines the complete workflow of our production-ready system.

---

## 🏗️ System Architecture

### Tech Stack
- **Frontend**: React.js (Modern UI with real-time updates)
- **Backend**: Node.js + Express.js (RESTful API)
- **Database**: MongoDB (Flexible document storage for tenders)
- **AI/ML**: Groq API (Document analysis and summarization)
- **Automation**: Cron Jobs (Scheduled tasks)
- **Web Scraping**: Puppeteer/Cheerio (Tender data extraction)

---

## 📊 Complete Workflow Pipeline

### Phase 1: Tender Discovery & Collection 🕷️

#### 1.1 Web Scraping Engine
Our system continuously monitors popular tender portals to discover relevant opportunities:

**Target Platforms:**
- 🐅 **Tender Tiger** - Primary source for government and private tenders
- 🏛️ **GeM (Government e-Marketplace)** - Government procurement portal
- 📋 **nProcure** - State government tender portal
- 🌐 **Other regional tender portals** - State-specific platforms

**Scraping Strategy:**
```
┌─────────────────────────────────────────┐
│  Daily Scraping Schedule (Cron Job)     │
├─────────────────────────────────────────┤
│  1. Connect to tender portals           │
│  2. Search for keywords:                │
│     - "cable"                           │
│     - "wire"                            │
│     - "LT AB Cable"                     │
│     - "Aerial Bunched Cable"            │
│     - "Power Cable"                     │
│  3. Extract tender metadata:            │
│     - Tender ID/Reference Number        │
│     - Title & Description               │
│     - Organization/Issuing Authority    │
│     - Publication Date                  │
│     - Submission Deadline               │
│     - Tender Portal URL                 │
│  4. Download PDF documents              │
│  5. Store in MongoDB database           │
└─────────────────────────────────────────┘
```

**Data Structure in MongoDB:**
```javascript
{
  tenderId: "TEN-001",
  referenceNumber: "PGVCL/PROC/LT AB Cable/1228",
  title: "Procurement of LT Aerial Bunched Cable",
  organization: "Paschim Gujarat Vij Company Ltd.",
  portal: "Tender Tiger",
  portalUrl: "https://...",
  publicationDate: ISODate("2025-01-10"),
  submissionDeadline: ISODate("2025-04-15"),
  status: "active",
  pdfs: [
    {
      filename: "tender_notice.pdf",
      path: "/uploads/tenders/TEN-001/tender_notice.pdf",
      type: "Tender Notice"
    },
    {
      filename: "technical_spec.pdf",
      path: "/uploads/tenders/TEN-001/technical_spec.pdf",
      type: "Technical Specification"
    }
  ],
  scrapedAt: ISODate("2025-01-15T10:30:00Z"),
  lastUpdated: ISODate("2025-01-15T10:30:00Z")
}
```

---

### Phase 2: Database Management & Cleanup 🗄️

#### 2.1 Automated Tender Lifecycle Management

**Daily Cron Job - Tender Cleanup & Refresh:**
```javascript
// Runs every day at 2:00 AM
0 2 * * * node scripts/tenderCleanup.js
```

**Cleanup Process:**
```
┌─────────────────────────────────────────────────┐
│  Step 1: Identify Expired Tenders              │
├─────────────────────────────────────────────────┤
│  Query: Find all tenders where                 │
│  submissionDeadline < (Today + 3 months)       │
│                                                 │
│  Result: List of tenders to archive/delete     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Step 2: Archive Old Tenders                   │
├─────────────────────────────────────────────────┤
│  - Move to "archived_tenders" collection       │
│  - Keep PDFs for historical reference          │
│  - Update status to "archived"                 │
│  - Log archival date                           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Step 3: Scrape Fresh Tenders                  │
├─────────────────────────────────────────────────┤
│  - Trigger web scraping engine                 │
│  - Filter: Only tenders with deadline          │
│    > (Today + 3 months)                        │
│  - Add new tenders to database                 │
│  - Download and store PDFs                     │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Step 4: Send Daily Summary                    │
├─────────────────────────────────────────────────┤
│  Email notification:                            │
│  - X tenders archived                          │
│  - Y new tenders discovered                    │
│  - Z active tenders in database                │
└─────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Always maintain fresh, relevant tenders
- ✅ Automatic cleanup prevents database bloat
- ✅ Focus on actionable opportunities (3+ months lead time)
- ✅ Historical data preserved for analysis

---

### Phase 3: Tender Analysis & Processing 🤖

#### 3.1 Automated Analysis Pipeline

Once tenders are in the database, our AI-powered analysis engine processes them:

```
┌──────────────────────────────────────────────┐
│  Tender Analysis Workflow                    │
├──────────────────────────────────────────────┤
│                                              │
│  1. Document Summarization                   │
│     ↓                                        │
│     - Extract text from PDFs                 │
│     - Generate comprehensive summary         │
│     - Identify key sections                  │
│                                              │
│  2. Eligibility Analysis                     │
│     ↓                                        │
│     - Compare with company profile           │
│     - Check registration requirements        │
│     - Verify technical capabilities          │
│     - Generate eligibility report            │
│                                              │
│  3. Product Matching (If Eligible)           │
│     ↓                                        │
│     - Build Matching Operations Table (B1)   │
│     - Match tender specs with SKU catalog    │
│     - Calculate pricing                      │
│     - Generate holistic summary table        │
│                                              │
│  4. Report Generation                        │
│     ↓                                        │
│     - Create DOCX report                     │
│     - Email to stakeholders                  │
│     - Store in database                      │
└──────────────────────────────────────────────┘
```

#### 3.2 Analysis Triggers

**Automatic Analysis:**
- ✅ New tender added to database → Queue for analysis
- ✅ Tender deadline approaching (30 days) → Re-analyze priority
- ✅ Manual trigger from frontend dashboard

**Analysis Queue System:**
```javascript
// Priority-based queue
{
  priority: "high", // high, medium, low
  tenderId: "TEN-001",
  queuedAt: ISODate("2025-01-15T10:00:00Z"),
  status: "pending", // pending, processing, completed, failed
  retryCount: 0
}
```

---

### Phase 4: User Interface & Dashboard 🖥️

#### 4.1 Frontend Features

**Tender Management Dashboard:**
- 📋 **Tender List View**
  - Filter by status, deadline, organization
  - Search functionality
  - Sort by priority, deadline, or date added
  - Real-time status updates

- 📊 **Tender Details**
  - Complete tender information
  - PDF viewer
  - Analysis results
  - Eligibility status
  - Product matching results
  - Pricing analysis

- ⚡ **Bulk Operations**
  - "Start All Operations" - Process all tenders automatically
  - Stop button to cancel operations
  - Progress tracking per tender

- 📧 **Notifications**
  - Email alerts for new tenders
  - Analysis completion notifications
  - Deadline reminders

#### 4.2 Real-time Updates

Using WebSocket or polling:
- Live progress updates during analysis
- Status changes reflected immediately
- Queue position tracking

---

### Phase 5: Reporting & Notifications 📧

#### 5.1 Automated Reports

**Daily Summary Report:**
- New tenders discovered
- Analysis completed
- Eligibility status summary
- Upcoming deadlines

**Weekly Executive Report:**
- Total opportunities analyzed
- Eligibility rate
- Estimated bid value
- Recommendations

**Email Notifications:**
- New tender matches (based on keywords)
- High-priority tenders
- Analysis completion
- Deadline reminders (7 days, 3 days, 1 day)

---

## 🔧 Technical Implementation Details

### Database Schema

**Tenders Collection:**
```javascript
{
  _id: ObjectId,
  tenderId: String (unique),
  referenceNumber: String,
  title: String,
  organization: String,
  portal: String,
  portalUrl: String,
  publicationDate: Date,
  submissionDeadline: Date,
  status: String, // active, archived, analyzed, in-progress
  pdfs: [{
    filename: String,
    path: String,
    type: String,
    uploadedAt: Date
  }],
  analysis: {
    summary: String,
    eligibilityStatus: String, // eligible, not-eligible, pending
    eligibilityReport: String,
    tableB1: String,
    matchedSKUs: [String],
    pricingTable: String,
    holisticSummary: String,
    analyzedAt: Date
  },
  metadata: {
    scrapedAt: Date,
    lastUpdated: Date,
    priority: String
  }
}
```

**Company Profile Collection:**
```javascript
{
  _id: ObjectId,
  companyName: String,
  profile: String, // Extracted from uploaded documents
  capabilities: [String],
  certifications: [String],
  registrations: [String],
  updatedAt: Date
}
```

**SKU Catalog Collection:**
```javascript
{
  _id: ObjectId,
  skuCode: String (unique),
  description: String,
  specifications: {
    cableType: String,
    coreConfiguration: String,
    insulationType: String,
    ratedVoltage: String,
    // ... other specs
  },
  pricing: {
    basePrice: Number,
    currency: String,
    lastUpdated: Date
  }
}
```

### API Endpoints

**Tender Management:**
- `GET /api/tenders` - List all tenders
- `GET /api/tenders/:id` - Get tender details
- `POST /api/tenders/analyze/:id` - Trigger analysis
- `DELETE /api/tenders/:id` - Archive tender

**Analysis:**
- `POST /api/workflow/start/:tenderId` - Start eligibility analysis
- `POST /api/workflow/build-table-b1/:tenderId` - Build matching table
- `POST /api/workflow/match-skus/:tenderId` - Match SKUs
- `POST /api/workflow/calculate-pricing/:tenderId` - Calculate pricing
- `POST /api/workflow/holistic-summary/:tenderId` - Generate summary

**Scraping:**
- `POST /api/scrape/start` - Manual scrape trigger
- `GET /api/scrape/status` - Scraping status

**Cron Jobs:**
- `POST /api/cron/cleanup` - Manual cleanup trigger
- `GET /api/cron/logs` - View cron job logs

### Cron Job Configuration

```javascript
// scripts/tenderCleanup.js
const cron = require('node-cron');
const { cleanupTenders, scrapeNewTenders } = require('./services/tenderService');

// Daily at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Starting daily tender cleanup...');
  try {
    await cleanupTenders();
    await scrapeNewTenders();
    console.log('Daily cleanup completed successfully');
  } catch (error) {
    console.error('Cleanup failed:', error);
    // Send alert email
  }
});

// Weekly report on Monday at 9:00 AM
cron.schedule('0 9 * * 1', async () => {
  await generateWeeklyReport();
});
```

---

## 🚀 Deployment & Scaling

### Production Environment

**Server Requirements:**
- Node.js 18+ 
- MongoDB 6.0+
- 4GB+ RAM
- 100GB+ storage (for PDFs)

**Environment Variables:**
```env
NODE_ENV=production
MONGODB_URI=mongodb://...
GROQ_API_KEY=...
EMAIL_SERVICE_API_KEY=...
SCRAPING_PROXY_URL=...
```

### Scaling Considerations

- **Horizontal Scaling**: Multiple Node.js instances behind load balancer
- **Database**: MongoDB replica set for high availability
- **File Storage**: Use cloud storage (AWS S3, Azure Blob) for PDFs
- **Queue System**: Redis-based job queue for analysis tasks
- **Caching**: Redis cache for frequently accessed data

---

## 📈 Future Enhancements

### Phase 6: Advanced Features (Roadmap)

1. **Machine Learning Integration**
   - Predict tender win probability
   - Optimize pricing strategies
   - Identify best-fit opportunities

2. **Competitor Analysis**
   - Track competitor bidding patterns
   - Market intelligence reports

3. **Bid Preparation Automation**
   - Auto-generate bid documents
   - Compliance checking
   - Document assembly

4. **Mobile App**
   - iOS/Android apps for on-the-go access
   - Push notifications
   - Quick tender review

5. **Integration with ERP**
   - Sync with company ERP system
   - Inventory management integration
   - Financial planning integration

---

## 🎯 Success Metrics

**Key Performance Indicators (KPIs):**
- 📊 **Tender Discovery Rate**: Number of relevant tenders found per week
- ⚡ **Analysis Speed**: Average time to complete full analysis
- ✅ **Eligibility Accuracy**: Percentage of correctly identified eligible tenders
- 💰 **Win Rate**: Percentage of bids won (post-implementation tracking)
- 🎯 **Time Saved**: Reduction in manual tender review time

---

## 🔒 Security & Compliance

- **Data Encryption**: All PDFs and sensitive data encrypted at rest
- **Access Control**: Role-based access control (RBAC)
- **API Security**: JWT authentication, rate limiting
- **Scraping Ethics**: Respect robots.txt, rate limiting, user-agent headers
- **Data Privacy**: GDPR compliance for tender data handling

---

## 📝 Conclusion

This workflow represents a complete, production-ready system that automates the entire tender discovery, analysis, and response process. By combining web scraping, AI-powered analysis, and intelligent automation, we've created a solution that saves time, increases accuracy, and helps Asian Wires Pvt. Ltd. capture more business opportunities.

**The system transforms a manual, time-consuming process into an automated, intelligent workflow that works 24/7 to discover and analyze tender opportunities.**

---

*Last Updated: January 2025*
*Version: 1.0*
*Maintained by: EY Techathon Team*

