import { useState, useEffect } from 'react';
import { getTenders, startWorkflow, getWorkflowStatus, uploadCompanyInfo, getEligibilityReport } from './api';
import './App.css';

// Mapping from frontend tender IDs to backend tender IDs
const TENDER_ID_MAP = {
  'TEN-001': 'tender1',
  '102130137': 'tender2'
};

// Helper function to map frontend ID to backend ID
const mapToBackendId = (frontendId) => {
  return TENDER_ID_MAP[frontendId] || frontendId;
};

// Static tender data
const STATIC_TENDERS = [
  {
    id: 'TEN-001',
    name: 'Supply of 3C LT AB Cable',
    deadline: '20-11-2025 18:00:00',
    category: 'Cabbles/wires',
    hasOperations: true
  },
  {
    id: '102130137',
    name: 'Purchase of 1C and 3C LT AB Cable',
    deadline: '10-11-2025 18:00:00',
    category: 'Cabbles/wires',
    organisation: 'ongc',
    tenderProductDesc: '3mm copper',
    hamraProductSku: 'hvhvhv',
    quantity: 'ihihih',
    price: '75757',
    hasOperations: true
  },
  {
    id: 'TEN-003',
    name: 'Supply of 4C LT PVC Cable',
    deadline: '12-10-2025 18:00:00',
    category: 'Cabbles/wires',
    hasOperations: false
  },
  {
    id: 'TEN-004',
    name: 'Supply of of 2C & 4C LT PVC Cable',
    deadline: '13-10-2025 18:00:00',
    category: 'Cabbles/wires',
    hasOperations: false
  },
  {
    id: 'TEN-005',
    name: 'Purchase of 3.5C LT PVC Cable of various sizes confirming to IS: 1554: (Part-I) 1988 and latest amendments if any under CPP for the year 2026-27 on behalf of DISCOMs of GUVNL (i.e. MGVCL, PGVCL, DGVCL and UGVCL) as per specification, terms and condition of tender',
    deadline: '10-10-2025 18:00:00',
    category: 'Cabbles/wires',
    hasOperations: false
  },
  {
    id: 'TEN-006',
    name: 'Purchase of 4Cx10mm2-650 KM and 4Cx16mm2 LT PVC Cable-600 KM',
    deadline: '10-10-2025 18:00:00',
    category: 'Cabbles/wires',
    hasOperations: false
  },
  {
    id: 'TEN-007',
    name: 'Supply of 1C LT AB Cable',
    deadline: '21-10-2025 18:00:00',
    category: 'Cabbles/wires',
    hasOperations: false
  },
  {
    id: 'TEN-008',
    name: 'Purchase of 2C x 4 sqmm, 4C x 4 sqmm, 4C x 6 sqmm LT PVC Cable',
    deadline: '10-10-2025 18:00:00',
    category: 'Cabbles/wires',
    hasOperations: false
  },
  {
    id: 'TEN-009',
    name: 'Supply of 6.6 KV EPR Insulated Flexible trailing Power copper Cable for ELECON Make Stacker Cum ReClaimer Machine of Coal Handling Plant at WTPS',
    deadline: '06-10-2025 18:00:00',
    category: 'Cabbles/wires',
    hasOperations: false
  }
];

function App() {
  const [tenders, setTenders] = useState([]);
  const [filteredTenders, setFilteredTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingTender, setProcessingTender] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState({});
  const [companyInfo, setCompanyInfo] = useState({
    uploaded: false,
    uploading: false,
    fileName: null,
    error: null,
    textLength: null
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState('all');
  const [reportModal, setReportModal] = useState({
    isOpen: false,
    tenderId: null,
    report: null,
    loading: false
  });
  const [shownReports, setShownReports] = useState(new Set());

  useEffect(() => {
    loadTenders();
  }, []);

  // Poll for status updates when processing
  useEffect(() => {
    if (!processingTender) return;

    const interval = setInterval(async () => {
      try {
        // Map frontend ID to backend ID for API call
        const backendId = mapToBackendId(processingTender);
        const response = await getWorkflowStatus(backendId);
        if (response.success) {
          const status = response.status;
          setWorkflowStatus(prev => ({
            ...prev,
            [processingTender]: status // Store status using frontend ID
          }));

          // Check if report is available and show modal
          if (status.reportGenerated && status.eligibilityTable) {
            // Only show modal if we haven't shown it for this tender yet
            setShownReports(prev => {
              if (!prev.has(processingTender)) {
                setReportModal({
                  isOpen: true,
                  tenderId: processingTender,
                  report: status.eligibilityTable,
                  loading: false
                });
                return new Set([...prev, processingTender]);
              }
              return prev;
            });
          }

          // Stop polling if completed or error
          if (status.completed) {
            setProcessingTender(null);
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Error fetching status:', error);
        // On error, stop polling and mark as error
        setWorkflowStatus(prev => ({
          ...prev,
          [processingTender]: {
            ...prev[processingTender],
            status: 'error',
            error: error.message,
            completed: true,
            message: `Error: ${error.message}`
          }
        }));
        setProcessingTender(null);
        clearInterval(interval);
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [processingTender]);

  const loadTenders = async () => {
    try {
      setLoading(true);
      // Use static tender data
      setTenders(STATIC_TENDERS);
      setFilteredTenders(STATIC_TENDERS);
    } catch (error) {
      console.error('Error loading tenders:', error);
      // Fallback to static data on error
      setTenders(STATIC_TENDERS);
      setFilteredTenders(STATIC_TENDERS);
    } finally {
      setLoading(false);
    }
  };

  // Filter tenders based on search and deadline
  useEffect(() => {
    let filtered = [...tenders];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tender => 
        tender.name.toLowerCase().includes(query) ||
        tender.id.toLowerCase().includes(query) ||
        (tender.deadline && tender.deadline.toLowerCase().includes(query))
      );
    }

    // Apply deadline filter
    if (deadlineFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(tender => {
        if (!tender.deadline || tender.deadline === 'Not specified') return false;
        
        try {
          // Parse deadline date (format: "20-11-2025, 18:00" or similar)
          const deadlineStr = tender.deadline.replace(/\*\*/g, '').trim();
          const deadlineMatch = deadlineStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
          if (!deadlineMatch) return false;
          
          const [, day, month, year] = deadlineMatch;
          const deadlineDate = new Date(year, month - 1, day);
          const monthsDiff = (deadlineDate - now) / (1000 * 60 * 60 * 24 * 30);
          
          switch(deadlineFilter) {
            case 'this-month':
              return monthsDiff >= 0 && monthsDiff <= 1;
            case 'next-3-months':
              return monthsDiff >= 0 && monthsDiff <= 3;
            case 'next-6-months':
              return monthsDiff >= 0 && monthsDiff <= 6;
            case 'next-12-months':
              return monthsDiff >= 0 && monthsDiff <= 12;
            case 'past':
              return monthsDiff < 0;
            default:
              return true;
          }
        } catch (e) {
          return false;
        }
      });
    }

    setFilteredTenders(filtered);
  }, [tenders, searchQuery, deadlineFilter]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      const validExtensions = ['.pdf', '.docx'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        setCompanyInfo({
          ...companyInfo,
          error: 'Please select a PDF or DOCX file'
        });
        setSelectedFile(null);
        return;
      }

      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        setCompanyInfo({
          ...companyInfo,
          error: 'File size must be less than 50MB'
        });
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setCompanyInfo({
        ...companyInfo,
        error: null
      });
    }
  };

  const handleUploadCompanyInfo = async () => {
    if (!selectedFile) {
      setCompanyInfo({
        ...companyInfo,
        error: 'Please select a file first'
      });
      return;
    }

    try {
      setCompanyInfo({
        ...companyInfo,
        uploading: true,
        error: null
      });

      const response = await uploadCompanyInfo(selectedFile);
      
      if (response.success) {
        setCompanyInfo({
          uploaded: true,
          uploading: false,
          fileName: response.file,
          error: null,
          textLength: response.textLength
        });
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('company-file-input');
        if (fileInput) fileInput.value = '';
      } else {
        setCompanyInfo({
          ...companyInfo,
          uploading: false,
          error: response.error || 'Upload failed'
        });
      }
    } catch (error) {
      console.error('Error uploading company info:', error);
      setCompanyInfo({
        ...companyInfo,
        uploading: false,
        error: error.message || 'Failed to upload company information'
      });
    }
  };

  const handleStartOperations = async (tenderId) => {
    try {
      // Reset status if retrying after error
      setProcessingTender(tenderId);
      setWorkflowStatus(prev => ({
        ...prev,
        [tenderId]: {
          status: 'processing',
          message: 'Starting workflow...',
          progress: 0,
          completed: false,
          error: null
        }
      }));

      // Map frontend ID to backend ID for API call
      const backendId = mapToBackendId(tenderId);
      await startWorkflow(backendId);
    } catch (error) {
      console.error('Error starting workflow:', error);
      setWorkflowStatus(prev => ({
        ...prev,
        [tenderId]: {
          status: 'error',
          message: `Error: ${error.message}`,
          completed: true,
          error: error.message
        }
      }));
      setProcessingTender(null);
    }
  };

  const getStatusMessage = (tenderId) => {
    const status = workflowStatus[tenderId];
    if (!status) return null;

    // Use the actual message from backend, or provide a fallback
    if (status.message) {
      return status.message;
    }

    // Fallback messages if backend doesn't provide one
    const stepMessages = {
      'analyzing': 'Analyzing PDFs and generating summaries...',
      'checking_eligibility': 'Checking eligibility status...',
      'generating_report': 'Generating report...',
      'sending_email': 'Sending email notification...',
      'completed': 'Workflow completed',
      'error': 'Error occurred'
    };

    return stepMessages[status.currentStep] || 'Processing...';
  };

  const getStatusColor = (status) => {
    if (!status) return 'default';
    if (status.status === 'completed') return 'success';
    if (status.status === 'error') return 'error';
    if (status.status === 'processing') return 'processing';
    return 'default';
  };

  const handleOpenReport = async (tenderId) => {
    try {
      setReportModal({
        isOpen: true,
        tenderId: tenderId,
        report: null,
        loading: true
      });

      // Map frontend ID to backend ID
      const backendId = mapToBackendId(tenderId);
      const response = await getEligibilityReport(backendId);
      
      if (response.success) {
        setReportModal(prev => ({
          ...prev,
          report: response.report,
          loading: false
        }));
      } else {
        setReportModal(prev => ({
          ...prev,
          report: 'Error loading report: ' + (response.error || 'Unknown error'),
          loading: false
        }));
      }
    } catch (error) {
      console.error('Error fetching report:', error);
      setReportModal(prev => ({
        ...prev,
        report: 'Error loading report: ' + error.message,
        loading: false
      }));
    }
  };

  const handleCloseReportModal = () => {
    setReportModal({
      isOpen: false,
      tenderId: null,
      report: null,
      loading: false
    });
  };

  // Helper function to convert markdown to HTML
  const markdownToHtml = (text) => {
    if (!text) return '';
    
    // First convert **bold** to <strong> (process double asterisks first)
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Then convert *italic* to <em> (single asterisks that aren't part of bold)
    // Use a simpler approach: replace *text* that doesn't have adjacent *
    html = html.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>');
    
    // Convert ✅ to styled span
    html = html.replace(/✅/g, '<span class="status-yes">✅</span>');
    
    // Convert ❌ to styled span
    html = html.replace(/❌/g, '<span class="status-no">❌</span>');
    
    // Convert ⚠️ to styled span
    html = html.replace(/⚠️/g, '<span class="status-partial">⚠️</span>');
    
    return html;
  };

  // Helper function to render markdown table as HTML
  const renderReportContent = (reportText) => {
    if (!reportText) return null;

    // Split by lines
    const lines = reportText.split('\n');
    const elements = [];
    let inTable = false;
    let tableRows = [];
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detect markdown table
      if (line.includes('|') && line.split('|').length > 2) {
        if (!inTable) {
          // Close any pending paragraph
          if (currentParagraph.length > 0) {
            const paragraphText = markdownToHtml(currentParagraph.join(' '));
            elements.push(
              <p key={`p-${i}`} className="report-paragraph" dangerouslySetInnerHTML={{ __html: paragraphText }} />
            );
            currentParagraph = [];
          }
          inTable = true;
          tableRows = [];
        }
        tableRows.push(line);
      } else {
        if (inTable && tableRows.length > 0) {
          // Render table
          const tableHtml = renderMarkdownTable(tableRows);
          if (tableHtml) {
            elements.push(
              <div key={`table-${i}`} className="report-table-wrapper" dangerouslySetInnerHTML={{ __html: tableHtml }} />
            );
          }
          tableRows = [];
          inTable = false;
        }
        
        if (line.length > 0) {
          // Check for headers
          if (line.startsWith('# ')) {
            const headingText = markdownToHtml(line.substring(2));
            elements.push(<h2 key={`h-${i}`} className="report-heading" dangerouslySetInnerHTML={{ __html: headingText }} />);
          } else if (line.startsWith('## ')) {
            const headingText = markdownToHtml(line.substring(3));
            elements.push(<h3 key={`h-${i}`} className="report-subheading" dangerouslySetInnerHTML={{ __html: headingText }} />);
          } else if (line.startsWith('### ')) {
            const headingText = markdownToHtml(line.substring(4));
            elements.push(<h3 key={`h-${i}`} className="report-subheading" dangerouslySetInnerHTML={{ __html: headingText }} />);
          } else if (line.match(/^\*\*.*\*\*$/)) {
            // Line that's entirely bold
            const boldText = markdownToHtml(line);
            elements.push(<p key={`p-${i}`} className="report-bold" dangerouslySetInnerHTML={{ __html: boldText }} />);
          } else {
            currentParagraph.push(line);
            // If next line is empty or different type, push paragraph
            if (i === lines.length - 1 || (lines[i + 1] && lines[i + 1].trim().length === 0)) {
              if (currentParagraph.length > 0) {
                const paragraphText = markdownToHtml(currentParagraph.join(' '));
                elements.push(
                  <p key={`p-${i}`} className="report-paragraph" dangerouslySetInnerHTML={{ __html: paragraphText }} />
                );
                currentParagraph = [];
              }
            }
          }
        }
      }
    }

    // Handle remaining table
    if (inTable && tableRows.length > 0) {
      const tableHtml = renderMarkdownTable(tableRows);
      if (tableHtml) {
        elements.push(
          <div key="table-final" className="report-table-wrapper" dangerouslySetInnerHTML={{ __html: tableHtml }} />
        );
      }
    }

    // Handle remaining paragraph
    if (currentParagraph.length > 0) {
      const paragraphText = markdownToHtml(currentParagraph.join(' '));
      elements.push(
        <p key="p-final" className="report-paragraph" dangerouslySetInnerHTML={{ __html: paragraphText }} />
      );
    }

    return elements.length > 0 ? elements : <pre className="report-pre">{reportText}</pre>;
  };

  const renderMarkdownTable = (rows) => {
    if (rows.length < 2) return null;

    let html = '<table class="report-table"><thead><tr>';
    
    // Parse header
    const headerRow = rows[0].split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
    headerRow.forEach(cell => {
      html += `<th>${escapeHtml(cell)}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Skip separator row (second row) and parse data rows
    let hasDataRows = false;
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i].trim();
      // Skip empty rows
      if (!row || row.length === 0) continue;
      
      const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
      // Only process rows that have the same number of cells as headers (or at least 1 cell)
      if (cells.length > 0) {
        hasDataRows = true;
        html += '<tr>';
        // Ensure we have the right number of cells
        for (let j = 0; j < headerRow.length; j++) {
          const cellContent = cells[j] || '';
          // First escape HTML to prevent XSS
          const escaped = escapeHtml(cellContent);
          // Convert markdown bold (**text**) to HTML
          let formattedCell = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          // Then add emoji formatting (emojis are safe)
          formattedCell = formattedCell
            .replace(/✅/g, '<span class="status-yes">✅</span>')
            .replace(/❌/g, '<span class="status-no">❌</span>')
            .replace(/⚠️/g, '<span class="status-partial">⚠️</span>');
          html += `<td>${formattedCell}</td>`;
        }
        html += '</tr>';
      }
    }

    // If no data rows, add a placeholder
    if (!hasDataRows) {
      html += `<tr><td colspan="${headerRow.length}" style="text-align: center; color: #8b949e; padding: 2rem;">No data available</td></tr>`;
    }

    html += '</tbody></table>';
    return html;
  };

  const escapeHtml = (text) => {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">Loading tenders...</div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Tender Eligibility Analyzer</h1>
        <p>Automated tender processing and eligibility analysis</p>
      </header>

      {/* Company Information Upload Section */}
      <div className="company-upload-section">
        <div className="company-upload-card">
          <div className="company-upload-header">
            <h2>Company Information</h2>
            {companyInfo.uploaded && (
              <span className="upload-status-badge uploaded">Uploaded</span>
            )}
            {!companyInfo.uploaded && (
              <span className="upload-status-badge required">Required</span>
            )}
          </div>
          
          <div className="company-upload-content">
            {companyInfo.uploaded ? (
              <div className="upload-success">
                <div className="upload-info">
                  <p><strong>File:</strong> {companyInfo.fileName}</p>
                  {companyInfo.textLength && (
                    <p><strong>Text Length:</strong> {companyInfo.textLength.toLocaleString()} characters</p>
                  )}
                </div>
                <button
                  className="change-file-button"
                  onClick={() => setCompanyInfo({
                    uploaded: false,
                    uploading: false,
                    fileName: null,
                    error: null,
                    textLength: null
                  })}
                >
                  Change File
                </button>
              </div>
            ) : (
              <div className="upload-form">
                <div className="file-input-wrapper">
                  <input
                    type="file"
                    id="company-file-input"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileSelect}
                    className="file-input"
                  />
                  <label htmlFor="company-file-input" className="file-input-label">
                    {selectedFile ? selectedFile.name : 'Choose PDF or DOCX file'}
                  </label>
                </div>
                
                {selectedFile && (
                  <div className="file-info">
                    <p>Selected: <strong>{selectedFile.name}</strong></p>
                    <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    )}

                {companyInfo.error && (
                  <div className="upload-error">
                    {companyInfo.error}
                  </div>
                )}

                <button
                  className="upload-button"
                  onClick={handleUploadCompanyInfo}
                  disabled={!selectedFile || companyInfo.uploading}
                >
                  {companyInfo.uploading ? 'Uploading...' : 'Upload Company Information'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="tenders-container">
        <div className="tenders-header">
          <h2>Tender Management</h2>
          <div className="tenders-filters">
            <div className="search-bar-wrapper">
              <input
                type="text"
                placeholder="Search tenders by name, ID, or deadline..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <span className="search-icon">⌕</span>
            </div>
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
              className="deadline-filter"
            >
              <option value="all">All Deadlines</option>
              <option value="this-month">This Month</option>
              <option value="next-3-months">Next 3 Months</option>
              <option value="next-6-months">Next 6 Months</option>
              <option value="next-12-months">Next 12 Months</option>
              <option value="past">Past Deadlines</option>
            </select>
          </div>
        </div>

        <div className="tenders-table-wrapper">
          <table className="tenders-table">
            <thead>
              <tr>
                <th>Tender ID</th>
                <th>Tender Name</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Eligibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="no-results">
                    {searchQuery || deadlineFilter !== 'all' 
                      ? 'No tenders match your filters' 
                      : 'No tenders available'}
                  </td>
                </tr>
              ) : (
                filteredTenders.map((tender) => {
                  const status = workflowStatus[tender.id];
                  const isProcessing = processingTender === tender.id;
                  const statusColor = getStatusColor(status);
                  const statusText = status ? getStatusMessage(tender.id) : 'Not Started';

                  return (
                    <tr key={tender.id} className={`tender-row ${isProcessing ? 'processing-row' : ''}`}>
                      <td>
                        <span className="tender-id-badge">{tender.id}</span>
                      </td>
                      <td>
                        <div className="tender-name-cell">
                          <strong>{tender.name}</strong>
                          {status?.error && (
                            <div className="error-text-small">{status.error}</div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="deadline-cell">{tender.deadline || 'Not specified'}</span>
                      </td>
                      <td>
                        {status ? (
                          <span className={`status-badge status-${statusColor}`}>
                            <span className="status-dot"></span>
                            {status.status === 'processing' ? 'Processing' : 
                             status.status === 'completed' ? 'Completed' : 
                             status.status === 'error' ? 'Error' : 'Pending'}
                          </span>
                        ) : (
                          <span className="status-badge status-default">
                            <span className="status-dot"></span>
                            Pending
                          </span>
                        )}
                      </td>
                      <td>
                        {isProcessing && status?.progress !== undefined && status.status !== 'error' ? (
                          <div className="table-progress-wrapper">
                            <div className="table-progress">
                              <div className="table-progress-bar">
                                <div 
                                  className="table-progress-fill" 
                                  style={{ width: `${status.progress}%` }}
                                ></div>
                              </div>
                              <span className="table-progress-text">{status.progress}%</span>
                            </div>
                            {status?.message && (
                              <div className="progress-status-message">
                                {status.message}
                              </div>
                            )}
                          </div>
                        ) : status?.progress !== undefined && status.status === 'completed' ? (
                          <div className="table-progress">
                            <div className="table-progress-bar">
                              <div 
                                className="table-progress-fill" 
                                style={{ width: '100%' }}
                              ></div>
                            </div>
                            <span className="table-progress-text">100%</span>
                          </div>
                        ) : status?.status === 'error' ? (
                          <span className="error-indicator">—</span>
                        ) : (
                          <span className="no-progress">—</span>
                        )}
                      </td>
                      <td>
                        {status?.eligible !== undefined ? (
                          <span className={`eligibility-badge ${status.eligible ? 'eligible' : 'not-eligible'}`}>
                            {status.eligible ? 'Eligible' : 'Not Eligible'}
                          </span>
                        ) : (
                          <span className="eligibility-badge unknown">—</span>
                        )}
                      </td>
                      <td>
                        <div className="action-buttons">
                          {status?.reportGenerated && (
                            <button
                              className="table-action-button open-report-button"
                              onClick={() => handleOpenReport(tender.id)}
                              title="View eligibility report"
                            >
                              Open Report
                            </button>
                          )}
                          {tender.hasOperations && (
                            <button
                              className={`table-action-button ${isProcessing ? 'processing' : ''} ${status?.status === 'error' ? 'error' : ''} ${!companyInfo.uploaded ? 'disabled-missing-company' : ''}`}
                              onClick={() => handleStartOperations(tender.id)}
                              disabled={isProcessing || (status && status.completed && status.status !== 'error') || !companyInfo.uploaded}
                              title={!companyInfo.uploaded ? 'Please upload company information first' : ''}
                            >
                              {isProcessing 
                                ? 'Processing...' 
                                : status?.status === 'error' 
                                  ? 'Retry' 
                                  : status?.completed && status.status !== 'error'
                                    ? 'Completed' 
                                    : 'Run Operations'}
                            </button>
                          )}
                          {!tender.hasOperations && !status?.reportGenerated && (
                            <span className="no-actions">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
            );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Report Modal */}
      {reportModal.isOpen && (
        <div className="modal-overlay" onClick={handleCloseReportModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Eligibility Report</h2>
              <button className="modal-close-button" onClick={handleCloseReportModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {reportModal.loading ? (
                <div className="modal-loading">Loading report...</div>
              ) : reportModal.report ? (
                <div className="report-content">
                  {renderReportContent(reportModal.report)}
                </div>
              ) : (
                <div className="modal-error">No report available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
