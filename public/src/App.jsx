import { useState, useEffect } from 'react';
import { getTenders, startWorkflow, getWorkflowStatus, uploadCompanyInfo } from './api';
import './App.css';

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

  useEffect(() => {
    loadTenders();
  }, []);

  // Poll for status updates when processing
  useEffect(() => {
    if (!processingTender) return;

    const interval = setInterval(async () => {
      try {
        const response = await getWorkflowStatus(processingTender);
        if (response.success) {
          setWorkflowStatus(prev => ({
            ...prev,
            [processingTender]: response.status
          }));

          // Stop polling if completed or error
          if (response.status.completed) {
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
      const response = await getTenders();
      if (response.success) {
        setTenders(response.tenders);
        setFilteredTenders(response.tenders);
      }
    } catch (error) {
      console.error('Error loading tenders:', error);
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

      await startWorkflow(tenderId);
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

    const stepMessages = {
      'analyzing': status.message || 'Analyzing PDFs and generating summaries...',
      'checking_eligibility': status.message || 'Checking eligibility status...',
      'generating_report': status.message || 'Generating report...',
      'sending_email': status.message || 'Sending email notification...',
      'completed': status.message || 'Workflow completed',
      'error': status.message || 'Error occurred'
    };

    return stepMessages[status.currentStep] || status.message || 'Processing...';
  };

  const getStatusColor = (status) => {
    if (!status) return 'default';
    if (status.status === 'completed') return 'success';
    if (status.status === 'error') return 'error';
    if (status.status === 'processing') return 'processing';
    return 'default';
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
                        {status?.progress !== undefined && status.status !== 'error' ? (
                          <div className="table-progress">
                            <div className="table-progress-bar">
                              <div 
                                className="table-progress-fill" 
                                style={{ width: `${status.progress}%` }}
                              ></div>
                            </div>
                            <span className="table-progress-text">{status.progress}%</span>
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
                                : 'Start'}
                </button>
                      </td>
                    </tr>
            );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;
