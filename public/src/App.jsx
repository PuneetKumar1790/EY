import { useState, useEffect } from 'react';
import { 
  getTenders, 
  startWorkflow, 
  getWorkflowStatus, 
  uploadCompanyInfo, 
  getEligibilityReport,
  uploadSKUList,
  buildTableB1,
  matchSKUs,
  calculatePricing,
  generateHolisticSummary,
  getWorkflowResult,
  processTender2Workflow
} from './api';
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
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [processingQueue, setProcessingQueue] = useState([]);
  const [shouldStopOperations, setShouldStopOperations] = useState(false); // Flag to stop all operations
  
  // Advanced workflow state
  const [skuList, setSkuList] = useState({
    uploaded: false,
    uploading: false,
    fileName: null,
    error: null
  });
  const [selectedSkuFile, setSelectedSkuFile] = useState(null);
  const [advancedWorkflow, setAdvancedWorkflow] = useState({}); // { tenderId: { step1: {...}, step2: {...}, ... } }
  const [workflowResults, setWorkflowResults] = useState({}); // { tenderId: { tableB1: '', matchedSkus: '', pricing: '', holistic: '' } }
  const [activeWorkflowModal, setActiveWorkflowModal] = useState({
    isOpen: false,
    tenderId: null,
    step: null,
    data: null
  });
  const [expandedWorkflows, setExpandedWorkflows] = useState(new Set()); // Track which workflows are expanded
  
  // Tender 2 specific workflow state
  const [tender2Workflow, setTender2Workflow] = useState({
    isProcessing: false,
    progress: 0,
    currentStep: '',
    currentMessage: '',
    error: null,
    completed: false,
    results: null
  });

  useEffect(() => {
    loadTenders();
    // Check if SKU file already exists
    checkExistingSKUFile();
  }, []);

  const checkExistingSKUFile = async () => {
    // Check if SKU file exists by trying to match SKUs (will fail gracefully if file doesn't exist)
    // For now, we'll let the user upload or use existing file
  };

  const handleUseExistingSKUFile = () => {
    // Mark SKU as uploaded if file exists in codebase
    setSkuList({
      uploaded: true,
      uploading: false,
      fileName: 'Tender_SKU_Matching_Descriptions.txt (Existing)',
      error: null
    });
  };

  // Poll for status updates when processing (but not when processing all - that's handled separately)
  useEffect(() => {
    if (!processingTender || isProcessingAll) return;

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
  }, [processingTender, isProcessingAll]);

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

  const handleStopAllOperations = () => {
    setShouldStopOperations(true);
    setIsProcessingAll(false);
    setProcessingTender(null);
    setProcessingQueue([]);
  };

  const handleStartAllOperations = async () => {
    // Get all tenders that have operations enabled
    const tendersToProcess = STATIC_TENDERS.filter(tender => tender.hasOperations);
    
    if (tendersToProcess.length === 0) {
      alert('No tenders available for processing');
      return;
    }

    if (!companyInfo.uploaded) {
      alert('Please upload company information first');
      return;
    }

    if (!skuList.uploaded) {
      alert('Please upload SKU list first');
      return;
    }

    // Reset stop flag
    setShouldStopOperations(false);
    setIsProcessingAll(true);
    setProcessingQueue(tendersToProcess.map(t => t.id));

    // Process each tender sequentially
    for (let i = 0; i < tendersToProcess.length; i++) {
      // Check if stop was requested
      if (shouldStopOperations) {
        console.log('Operations stopped by user');
        break;
      }

      const tender = tendersToProcess[i];
      
      try {
        // Set current processing tender
        setProcessingTender(tender.id);
        
        // Initialize status
        setWorkflowStatus(prev => ({
          ...prev,
          [tender.id]: {
            status: 'processing',
            message: 'Starting eligibility analysis...',
            progress: 0,
            completed: false,
            error: null
          }
        }));

        // Map frontend ID to backend ID for API call
        const backendId = mapToBackendId(tender.id);
        await startWorkflow(backendId);

        // Wait for eligibility check to complete
        await waitForTenderCompletion(tender.id);

        // Check if stop was requested
        if (shouldStopOperations) {
          console.log('Operations stopped by user');
          break;
        }

        // Check if tender is eligible - get fresh status after completion
        const backendIdForStatus = mapToBackendId(tender.id);
        const statusResponse = await getWorkflowStatus(backendIdForStatus);
        const currentStatus = statusResponse.success ? statusResponse.status : workflowStatus[tender.id];
        
        if (currentStatus?.eligible && currentStatus?.reportGenerated) {
          // Automatically run advanced workflow steps
          console.log(`Tender ${tender.id} is eligible, starting advanced workflow...`);
          
          let tableB1Success = false;
          let skuMatchSuccess = false;
          let pricingSuccess = false;
          
          // Step 1: Build Table B1
          if (!shouldStopOperations) {
            setWorkflowStatus(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                message: 'Building Table B1...',
                progress: 60
              }
            }));
            
            setAdvancedWorkflow(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                buildingTableB1: true
              }
            }));

            try {
              const tableB1Response = await buildTableB1(backendId);
              if (tableB1Response.success && !shouldStopOperations) {
                tableB1Success = true;
                setAdvancedWorkflow(prev => ({
                  ...prev,
                  [tender.id]: {
                    ...prev[tender.id],
                    buildingTableB1: false,
                    tableB1Complete: true
                  }
                }));
                setWorkflowResults(prev => ({
                  ...prev,
                  [tender.id]: {
                    ...prev[tender.id],
                    tableB1: tableB1Response.tableB1
                  }
                }));
              }
            } catch (error) {
              console.error('Error building Table B1:', error);
              setAdvancedWorkflow(prev => ({
                ...prev,
                [tender.id]: {
                  ...prev[tender.id],
                  buildingTableB1: false,
                  tableB1Error: error.message
                }
              }));
            }
          }

          // Step 2: Match SKUs
          if (!shouldStopOperations && tableB1Success) {
            setWorkflowStatus(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                message: 'Matching SKUs...',
                progress: 70
              }
            }));

            setAdvancedWorkflow(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                matchingSKUs: true
              }
            }));

            try {
              const skuMatchResponse = await matchSKUs(backendId);
              if (skuMatchResponse.success && !shouldStopOperations) {
                skuMatchSuccess = true;
                setAdvancedWorkflow(prev => ({
                  ...prev,
                  [tender.id]: {
                    ...prev[tender.id],
                    matchingSKUs: false,
                    skuMatchComplete: true
                  }
                }));
                setWorkflowResults(prev => ({
                  ...prev,
                  [tender.id]: {
                    ...prev[tender.id],
                    matchedSkus: skuMatchResponse.matchedSkus
                  }
                }));
              }
            } catch (error) {
              console.error('Error matching SKUs:', error);
              setAdvancedWorkflow(prev => ({
                ...prev,
                [tender.id]: {
                  ...prev[tender.id],
                  matchingSKUs: false,
                  skuMatchError: error.message
                }
              }));
            }
          }

          // Step 3: Calculate Pricing
          if (!shouldStopOperations && skuMatchSuccess) {
            setWorkflowStatus(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                message: 'Calculating pricing...',
                progress: 85
              }
            }));

            setAdvancedWorkflow(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                calculatingPricing: true
              }
            }));

            try {
              const pricingResponse = await calculatePricing(backendId);
              if (pricingResponse.success && !shouldStopOperations) {
                pricingSuccess = true;
                setAdvancedWorkflow(prev => ({
                  ...prev,
                  [tender.id]: {
                    ...prev[tender.id],
                    calculatingPricing: false,
                    pricingComplete: true
                  }
                }));
                setWorkflowResults(prev => ({
                  ...prev,
                  [tender.id]: {
                    ...prev[tender.id],
                    pricing: pricingResponse.pricingTable
                  }
                }));
              }
            } catch (error) {
              console.error('Error calculating pricing:', error);
              setAdvancedWorkflow(prev => ({
                ...prev,
                [tender.id]: {
                  ...prev[tender.id],
                  calculatingPricing: false,
                  pricingError: error.message
                }
              }));
            }
          }

          // Step 4: Generate Holistic Summary
          if (!shouldStopOperations && pricingSuccess) {
            setWorkflowStatus(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                message: 'Generating holistic summary...',
                progress: 95
              }
            }));

            setAdvancedWorkflow(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                generatingHolistic: true
              }
            }));

            try {
              const holisticResponse = await generateHolisticSummary(backendId);
              if (holisticResponse.success && !shouldStopOperations) {
                setAdvancedWorkflow(prev => ({
                  ...prev,
                  [tender.id]: {
                    ...prev[tender.id],
                    generatingHolistic: false,
                    holisticComplete: true
                  }
                }));
                setWorkflowResults(prev => ({
                  ...prev,
                  [tender.id]: {
                    ...prev[tender.id],
                    holistic: holisticResponse.holisticTable
                  }
                }));
              }
            } catch (error) {
              console.error('Error generating holistic summary:', error);
              setAdvancedWorkflow(prev => ({
                ...prev,
                [tender.id]: {
                  ...prev[tender.id],
                  generatingHolistic: false,
                  holisticError: error.message
                }
              }));
            }
          }

          // Mark as fully complete
          if (!shouldStopOperations) {
            setWorkflowStatus(prev => ({
              ...prev,
              [tender.id]: {
                ...prev[tender.id],
                message: 'All operations completed',
                progress: 100
              }
            }));
          }
        }
        
      } catch (error) {
        console.error(`Error processing tender ${tender.id}:`, error);
        setWorkflowStatus(prev => ({
          ...prev,
          [tender.id]: {
            status: 'error',
            message: `Error: ${error.message}`,
            completed: true,
            error: error.message
          }
        }));
        // Continue with next tender even if one fails (unless stopped)
        if (shouldStopOperations) break;
      }
    }

    setIsProcessingAll(false);
    setProcessingQueue([]);
    setProcessingTender(null);
    setShouldStopOperations(false);
  };

  const waitForTenderCompletion = async (tenderId) => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        // Check if stop was requested
        if (shouldStopOperations) {
          clearInterval(checkInterval);
          resolve();
          return;
        }

        try {
          const backendId = mapToBackendId(tenderId);
          const response = await getWorkflowStatus(backendId);
          
          if (response.success && response.status) {
            const status = response.status;
            
            // Update status
            setWorkflowStatus(prev => ({
              ...prev,
              [tenderId]: status
            }));

            // Check if report is available and show modal
            if (status.reportGenerated && status.eligibilityTable) {
              setShownReports(prev => {
                if (!prev.has(tenderId)) {
                  setReportModal({
                    isOpen: true,
                    tenderId: tenderId,
                    report: status.eligibilityTable,
                    loading: false
                  });
                  return new Set([...prev, tenderId]);
                }
                return prev;
              });
            }

            // If completed or error, stop waiting
            if (status.completed || status.status === 'error') {
              clearInterval(checkInterval);
              resolve();
            }
          }
        } catch (error) {
          console.error('Error checking status:', error);
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000); // Check every second
    });
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

  // Advanced workflow handlers
  const handleSkuFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.txt')) {
        setSkuList({
          ...skuList,
          error: 'Please select a TXT file'
        });
        setSelectedSkuFile(null);
        return;
      }
      setSelectedSkuFile(file);
      setSkuList({
        ...skuList,
        error: null
      });
    }
  };

  const handleUploadSKUList = async () => {
    if (!selectedSkuFile) {
      setSkuList({
        ...skuList,
        error: 'Please select a file first'
      });
      return;
    }

    try {
      setSkuList({
        ...skuList,
        uploading: true,
        error: null
      });

      const response = await uploadSKUList(selectedSkuFile);
      
      if (response.success) {
        setSkuList({
          uploaded: true,
          uploading: false,
          fileName: response.file,
          error: null
        });
        setSelectedSkuFile(null);
        const fileInput = document.getElementById('sku-file-input');
        if (fileInput) fileInput.value = '';
      } else {
        setSkuList({
          ...skuList,
          uploading: false,
          error: response.error || 'Upload failed'
        });
      }
    } catch (error) {
      console.error('Error uploading SKU list:', error);
      setSkuList({
        ...skuList,
        uploading: false,
        error: error.message || 'Failed to upload SKU list'
      });
    }
  };

  const handleBuildTableB1 = async (tenderId) => {
    try {
      const backendId = mapToBackendId(tenderId);
      setAdvancedWorkflow(prev => ({
        ...prev,
        [tenderId]: {
          ...prev[tenderId],
          buildingTableB1: true,
          tableB1Error: null
        }
      }));

      const response = await buildTableB1(backendId);
      
      if (response.success) {
        setAdvancedWorkflow(prev => ({
          ...prev,
          [tenderId]: {
            ...prev[tenderId],
            buildingTableB1: false,
            tableB1Complete: true,
            tableB1Error: null
          }
        }));
        setWorkflowResults(prev => ({
          ...prev,
          [tenderId]: {
            ...prev[tenderId],
            tableB1: response.tableB1
          }
        }));
      } else {
        throw new Error(response.error || 'Failed to build Table B1');
      }
    } catch (error) {
      console.error('Error building Table B1:', error);
      setAdvancedWorkflow(prev => ({
        ...prev,
        [tenderId]: {
          ...prev[tenderId],
          buildingTableB1: false,
          tableB1Error: error.message
        }
      }));
    }
  };

  const handleMatchSKUs = async (tenderId) => {
    try {
      const backendId = mapToBackendId(tenderId);
      setAdvancedWorkflow(prev => ({
        ...prev,
        [tenderId]: {
          ...prev[tenderId],
          matchingSKUs: true,
          skuMatchError: null
        }
      }));

      const response = await matchSKUs(backendId);
      
      if (response.success) {
        setAdvancedWorkflow(prev => ({
          ...prev,
          [tenderId]: {
            ...prev[tenderId],
            matchingSKUs: false,
            skuMatchComplete: true,
            skuMatchError: null
          }
        }));
        setWorkflowResults(prev => ({
          ...prev,
          [tenderId]: {
            ...prev[tenderId],
            matchedSkus: response.matchedSkus
          }
        }));
      } else {
        throw new Error(response.error || 'Failed to match SKUs');
      }
    } catch (error) {
      console.error('Error matching SKUs:', error);
      setAdvancedWorkflow(prev => ({
        ...prev,
        [tenderId]: {
          ...prev[tenderId],
          matchingSKUs: false,
          skuMatchError: error.message
        }
      }));
    }
  };

  const handleCalculatePricing = async (tenderId) => {
    try {
      const backendId = mapToBackendId(tenderId);
      setAdvancedWorkflow(prev => ({
        ...prev,
        [tenderId]: {
          ...prev[tenderId],
          calculatingPricing: true,
          pricingError: null
        }
      }));

      const response = await calculatePricing(backendId);
      
      if (response.success) {
        setAdvancedWorkflow(prev => ({
          ...prev,
          [tenderId]: {
            ...prev[tenderId],
            calculatingPricing: false,
            pricingComplete: true,
            pricingError: null
          }
        }));
        setWorkflowResults(prev => ({
          ...prev,
          [tenderId]: {
            ...prev[tenderId],
            pricing: response.pricingTable
          }
        }));
      } else {
        throw new Error(response.error || 'Failed to calculate pricing');
      }
    } catch (error) {
      console.error('Error calculating pricing:', error);
      setAdvancedWorkflow(prev => ({
        ...prev,
        [tenderId]: {
          ...prev[tenderId],
          calculatingPricing: false,
          pricingError: error.message
        }
      }));
    }
  };

  const handleGenerateHolisticSummary = async (tenderId) => {
    try {
      const backendId = mapToBackendId(tenderId);
      setAdvancedWorkflow(prev => ({
        ...prev,
        [tenderId]: {
          ...prev[tenderId],
          generatingHolistic: true,
          holisticError: null
        }
      }));

      const response = await generateHolisticSummary(backendId);
      
      if (response.success) {
        setAdvancedWorkflow(prev => ({
          ...prev,
          [tenderId]: {
            ...prev[tenderId],
            generatingHolistic: false,
            holisticComplete: true,
            holisticError: null
          }
        }));
        setWorkflowResults(prev => ({
          ...prev,
          [tenderId]: {
            ...prev[tenderId],
            holistic: response.holisticTable
          }
        }));
      } else {
        throw new Error(response.error || 'Failed to generate holistic summary');
      }
    } catch (error) {
      console.error('Error generating holistic summary:', error);
      setAdvancedWorkflow(prev => ({
        ...prev,
        [tenderId]: {
          ...prev[tenderId],
          generatingHolistic: false,
          holisticError: error.message
        }
      }));
    }
  };

  const handleViewWorkflowResult = async (tenderId, resultType) => {
    try {
      const backendId = mapToBackendId(tenderId);
      setActiveWorkflowModal({
        isOpen: true,
        tenderId,
        step: resultType,
        data: null,
        loading: true
      });

      const response = await getWorkflowResult(backendId, resultType);
      
      if (response.success) {
        setActiveWorkflowModal(prev => ({
          ...prev,
          data: response.content,
          loading: false
        }));
      } else {
        throw new Error(response.error || 'Failed to load result');
      }
    } catch (error) {
      console.error('Error loading workflow result:', error);
      setActiveWorkflowModal(prev => ({
        ...prev,
        data: 'Error loading result: ' + error.message,
        loading: false
      }));
    }
  };

  const handleCloseWorkflowModal = () => {
    setActiveWorkflowModal({
      isOpen: false,
      tenderId: null,
      step: null,
      data: null
    });
  };

  // Handler for Tender 2 workflow with real-time progress
  const handleStartTender2Workflow = async () => {
    setTender2Workflow({
      isProcessing: true,
      progress: 0,
      currentStep: 'init',
      currentMessage: 'Initializing workflow...',
      error: null,
      completed: false,
      results: null
    });

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
      const baseUrl = apiBaseUrl.replace('/api', ''); // Remove /api suffix if present
      const eventSource = new EventSource(`${baseUrl}/api/process-tender2-workflow-stream`);
      
      eventSource.onmessage = (event) => {
        if (event.data === '[DONE]') {
          eventSource.close();
          return;
        }
        
        try {
          const data = JSON.parse(event.data);
          
          setTender2Workflow(prev => ({
            ...prev,
            progress: data.progress,
            currentStep: data.step,
            currentMessage: data.message,
            error: data.error ? data.message : null,
            completed: data.step === 'completed',
            results: data.outputs || prev.results,
            isProcessing: data.step !== 'completed' && !data.error
          }));
        } catch (e) {
          console.error('Error parsing SSE data:', e);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        eventSource.close();
        setTender2Workflow(prev => ({
          ...prev,
          isProcessing: false,
          error: 'Connection error. Please try again.',
          completed: false
        }));
      };
      
    } catch (error) {
      console.error('Error starting Tender 2 workflow:', error);
      setTender2Workflow(prev => ({
        ...prev,
        isProcessing: false,
        error: error.message,
        completed: false
      }));
    }
  };

  // Helper function to get step label for Tender 2 workflow
  const getStepLabel = (step) => {
    const labels = {
      'init': 'Initializing',
      'validation': 'Validating Files',
      'extracting': 'Extracting PDF Data',
      'summarizing': 'Generating Summaries',
      'combining': 'Combining Summaries',
      'analyzing': 'Analyzing Tender',
      'eligibility': 'Checking Eligibility',
      'table_b1': 'Building Table B1',
      'matching': 'Matching SKUs',
      'pricing': 'Calculating Pricing',
      'holistic': 'Generating Final Report',
      'email': 'Sending Email',
      'completed': 'Completed'
    };
    return labels[step] || 'Processing';
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
      {/* Floating Start/Stop Operations Button */}
      {companyInfo.uploaded && (
        <>
          {!isProcessingAll ? (
            <button
              className="floating-start-button"
              onClick={handleStartAllOperations}
              disabled={!skuList.uploaded}
              title={!skuList.uploaded ? 'Please upload SKU list first' : 'Start operations on all tenders'}
            >
              <span>▶</span>
              Start All Operations
            </button>
          ) : (
            <button
              className="floating-start-button processing stop-button"
              onClick={handleStopAllOperations}
              title="Stop all operations"
              style={{ background: '#da3633' }}
            >
              <span>⏹</span>
              Stop Operations
            </button>
          )}
        </>
      )}

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

      {/* SKU List Upload Section */}
      {companyInfo.uploaded && (
        <div className="company-upload-section">
          <div className="company-upload-card">
            <div className="company-upload-header">
              <h2>SKU List</h2>
              {skuList.uploaded && (
                <span className="upload-status-badge uploaded">Uploaded</span>
              )}
              {!skuList.uploaded && (
                <span className="upload-status-badge required">Required for Advanced Workflow</span>
              )}
            </div>
            
            <div className="company-upload-content">
              {skuList.uploaded ? (
                <div className="upload-success">
                  <div className="upload-info">
                    <p><strong>File:</strong> {skuList.fileName}</p>
                  </div>
                  <button
                    className="change-file-button"
                    onClick={() => setSkuList({
                      uploaded: false,
                      uploading: false,
                      fileName: null,
                      error: null
                    })}
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="upload-form">
                  <div style={{ marginBottom: '1rem', padding: '1rem', background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
                    <p style={{ color: '#8b949e', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      SKU file may already exist in the codebase. You can either:
                    </p>
                    <button
                      className="change-file-button"
                      onClick={handleUseExistingSKUFile}
                      style={{ width: '100%', marginBottom: '0.5rem' }}
                    >
                      Use Existing SKU File (Tender_SKU_Matching_Descriptions.txt)
                    </button>
                    <p style={{ color: '#8b949e', fontSize: '0.85rem', textAlign: 'center', margin: 0 }}>
                      OR
                    </p>
                  </div>

                  <div className="file-input-wrapper">
                    <input
                      type="file"
                      id="sku-file-input"
                      accept=".txt,text/plain"
                      onChange={handleSkuFileSelect}
                      className="file-input"
                    />
                    <label htmlFor="sku-file-input" className="file-input-label">
                      {selectedSkuFile ? selectedSkuFile.name : 'Choose TXT file (SKU List)'}
                    </label>
                  </div>
                  
                  {selectedSkuFile && (
                    <div className="file-info">
                      <p>Selected: <strong>{selectedSkuFile.name}</strong></p>
                      <p>Size: {(selectedSkuFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  )}

                  {skuList.error && (
                    <div className="upload-error">
                      {skuList.error}
                    </div>
                  )}

                  <button
                    className="upload-button"
                    onClick={handleUploadSKUList}
                    disabled={!selectedSkuFile || skuList.uploading}
                  >
                    {skuList.uploading ? 'Uploading...' : 'Upload SKU List'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                          {/* Special button for Tender 2 */}
                          {tender.id === '102130137' && companyInfo.uploaded && skuList.uploaded && (
                            <button
                              className="table-action-button"
                              onClick={handleStartTender2Workflow}
                              disabled={tender2Workflow.isProcessing}
                              style={{ 
                                background: tender2Workflow.isProcessing ? '#6e7681' : '#238636',
                                marginBottom: '0.5rem'
                              }}
                              title="Start complete Tender 2 workflow with real-time progress"
                            >
                              {tender2Workflow.isProcessing ? 'Processing...' : 'Start Tender 2 Workflow'}
                            </button>
                          )}
                          
                          {status?.reportGenerated && (
                            <>
                              <button
                                className="table-action-button open-report-button"
                                onClick={() => handleOpenReport(tender.id)}
                                title="View eligibility report"
                              >
                                Open Report
                              </button>
                              {status?.eligible && skuList.uploaded && (
                                <button
                                  className="table-action-button"
                                  onClick={() => {
                                    // Expand and show advanced workflow section
                                    setExpandedWorkflows(prev => new Set([...prev, tender.id]));
                                    setTimeout(() => {
                                      const workflowSection = document.getElementById(`workflow-${tender.id}`);
                                      if (workflowSection) {
                                        workflowSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }
                                    }, 100);
                                  }}
                                  title="View advanced workflow"
                                  style={{ background: '#d29922', marginTop: '0.5rem' }}
                                >
                                  Advanced Workflow
                                </button>
                              )}
                            </>
                          )}
                          {!status?.reportGenerated && tender.hasOperations && tender.id !== '102130137' && (
                            <span className="pending-operation">Pending</span>
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

        {/* Tender 2 Workflow Progress Section */}
        {(tender2Workflow.isProcessing || tender2Workflow.completed || tender2Workflow.error) && (
          <div style={{ 
            marginTop: '2rem', 
            padding: '2rem', 
            background: '#161b22', 
            border: '2px solid #238636', 
            borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(35, 134, 54, 0.2)'
          }}>
            <h3 style={{ color: '#ffffff', marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🚀</span>
              Tender 2 Workflow Progress
            </h3>
            
            {/* Progress Bar */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: '#8b949e', fontSize: '0.9rem' }}>
                  {tender2Workflow.currentMessage}
                </span>
                <span style={{ color: '#ffffff', fontWeight: 'bold' }}>
                  {tender2Workflow.progress}%
                </span>
              </div>
              <div style={{ 
                width: '100%', 
                height: '24px', 
                background: '#0d1117', 
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid #30363d'
              }}>
                <div style={{ 
                  width: `${tender2Workflow.progress}%`, 
                  height: '100%', 
                  background: tender2Workflow.error 
                    ? 'linear-gradient(90deg, #f85149, #da3633)' 
                    : 'linear-gradient(90deg, #238636, #2ea043)',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: '0.5rem'
                }}>
                  {tender2Workflow.progress > 10 && (
                    <span style={{ color: '#ffffff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                      {tender2Workflow.progress}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Current Step Indicator */}
            <div style={{ 
              padding: '1rem', 
              background: '#0d1117', 
              borderRadius: '8px',
              border: '1px solid #30363d',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%',
                  background: tender2Workflow.error 
                    ? '#f85149' 
                    : tender2Workflow.completed 
                      ? '#3fb950' 
                      : '#1f6feb',
                  animation: tender2Workflow.isProcessing ? 'pulse 2s infinite' : 'none'
                }}></div>
                <div>
                  <div style={{ color: '#e6edf3', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    {tender2Workflow.error 
                      ? 'Error' 
                      : tender2Workflow.completed 
                        ? 'Completed' 
                        : getStepLabel(tender2Workflow.currentStep)}
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '0.85rem' }}>
                    {tender2Workflow.currentMessage}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {tender2Workflow.error && (
              <div style={{ 
                padding: '1rem', 
                background: '#1c1011', 
                border: '1px solid #f85149',
                borderRadius: '8px',
                marginBottom: '1.5rem'
              }}>
                <div style={{ color: '#f85149', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  ❌ Error Occurred
                </div>
                <div style={{ color: '#e6edf3', fontSize: '0.9rem' }}>
                  {tender2Workflow.error}
                </div>
              </div>
            )}

            {/* Results Display */}
            {tender2Workflow.completed && tender2Workflow.results && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ color: '#3fb950', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>✅</span>
                  Workflow Completed Successfully
                </h4>
                
                {/* Results Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <button
                    className="table-action-button"
                    onClick={() => setActiveWorkflowModal({
                      isOpen: true,
                      tenderId: '102130137',
                      step: 'tender2_table_b1',
                      data: tender2Workflow.results.tableB1,
                      loading: false
                    })}
                    style={{ background: '#1f6feb' }}
                  >
                    📊 View Table B1
                  </button>
                  <button
                    className="table-action-button"
                    onClick={() => setActiveWorkflowModal({
                      isOpen: true,
                      tenderId: '102130137',
                      step: 'tender2_matched_skus',
                      data: tender2Workflow.results.matchedSkus,
                      loading: false
                    })}
                    style={{ background: '#1f6feb' }}
                  >
                    🔗 View Matched SKUs
                  </button>
                  <button
                    className="table-action-button"
                    onClick={() => setActiveWorkflowModal({
                      isOpen: true,
                      tenderId: '102130137',
                      step: 'tender2_pricing',
                      data: tender2Workflow.results.pricingTable,
                      loading: false
                    })}
                    style={{ background: '#1f6feb' }}
                  >
                    💰 View Pricing Table
                  </button>
                  <button
                    className="table-action-button"
                    onClick={() => setActiveWorkflowModal({
                      isOpen: true,
                      tenderId: '102130137',
                      step: 'tender2_holistic',
                      data: tender2Workflow.results.holisticTable,
                      loading: false
                    })}
                    style={{ background: '#238636' }}
                  >
                    📋 View Final Report
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Advanced Workflow Sections */}
        {filteredTenders.map((tender) => {
          const status = workflowStatus[tender.id];
          const workflow = advancedWorkflow[tender.id] || {};
          const results = workflowResults[tender.id] || {};

          // Only show advanced workflow for eligible tenders that have completed eligibility check
          if (!status || status.status !== 'completed' || !status.eligible || !status.reportGenerated || !skuList.uploaded) {
            return null;
          }

          const isExpanded = expandedWorkflows.has(tender.id);

          return (
            <div key={`workflow-${tender.id}`} id={`workflow-${tender.id}`} className="advanced-workflow-section" style={{ marginTop: '2rem', padding: '2rem', background: '#161b22', border: '1px solid #30363d', borderRadius: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', cursor: 'pointer' }} onClick={() => {
                setExpandedWorkflows(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(tender.id)) {
                    newSet.delete(tender.id);
                  } else {
                    newSet.add(tender.id);
                  }
                  return newSet;
                });
              }}>
                <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1.5rem' }}>
                  Advanced Workflow - {tender.name}
                </h3>
                <span style={{ color: '#8b949e', fontSize: '1.2rem' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </div>

              {isExpanded && (
                <div>
                  {isProcessingAll && processingTender === tender.id && (
                    <div style={{ 
                      padding: '1rem', 
                      marginBottom: '1.5rem', 
                      background: '#1c2128', 
                      border: '1px solid #f79000', 
                      borderRadius: '8px',
                      color: '#f79000'
                    }}>
                      <strong>🔄 Automatic Processing Active</strong> - All steps will run automatically. You can stop using the Stop button.
                    </div>
                  )}
                  
                  {/* Step 1: Build Table B1 */}
              <div className="workflow-step" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ color: '#e6edf3', margin: 0 }}>Step 1: Build Table B1 (Matching Operations Table)</h4>
                  {workflow.tableB1Complete && <span style={{ color: '#3fb950', fontSize: '0.9rem' }}>✓ Complete</span>}
                </div>
                {workflow.tableB1Error && (
                  <div style={{ color: '#f85149', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Error: {workflow.tableB1Error}</div>
                )}
                {!workflow.tableB1Complete && (
                  <button
                    className="table-action-button"
                    onClick={() => handleBuildTableB1(tender.id)}
                    disabled={workflow.buildingTableB1 || (isProcessingAll && processingTender === tender.id)}
                    style={{ background: '#1f6feb' }}
                    title={isProcessingAll && processingTender === tender.id ? 'Automatic processing in progress' : ''}
                  >
                    {workflow.buildingTableB1 ? 'Building...' : 'Build Table B1'}
                  </button>
                )}
                {workflow.tableB1Complete && (
                  <button
                    className="table-action-button"
                    onClick={() => handleViewWorkflowResult(tender.id, 'table_b1')}
                    style={{ background: '#238636' }}
                  >
                    View Table B1
                  </button>
                )}
              </div>

              {/* Step 2: Match SKUs */}
              <div className="workflow-step" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ color: '#e6edf3', margin: 0 }}>Step 2: Match SKUs</h4>
                  {workflow.skuMatchComplete && <span style={{ color: '#3fb950', fontSize: '0.9rem' }}>✓ Complete</span>}
                </div>
                {workflow.skuMatchError && (
                  <div style={{ color: '#f85149', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Error: {workflow.skuMatchError}</div>
                )}
                {!workflow.skuMatchComplete && (
                  <button
                    className="table-action-button"
                    onClick={() => handleMatchSKUs(tender.id)}
                    disabled={!workflow.tableB1Complete || workflow.matchingSKUs || (isProcessingAll && processingTender === tender.id)}
                    style={{ background: '#1f6feb' }}
                    title={isProcessingAll && processingTender === tender.id ? 'Automatic processing in progress' : ''}
                  >
                    {workflow.matchingSKUs ? 'Matching...' : 'Match SKUs'}
                  </button>
                )}
                {workflow.skuMatchComplete && (
                  <button
                    className="table-action-button"
                    onClick={() => handleViewWorkflowResult(tender.id, 'matched_skus')}
                    style={{ background: '#238636' }}
                  >
                    View Matched SKUs
                  </button>
                )}
              </div>

              {/* Step 3: Calculate Pricing */}
              <div className="workflow-step" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ color: '#e6edf3', margin: 0 }}>Step 3: Calculate Pricing</h4>
                  {workflow.pricingComplete && <span style={{ color: '#3fb950', fontSize: '0.9rem' }}>✓ Complete</span>}
                </div>
                {workflow.pricingError && (
                  <div style={{ color: '#f85149', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Error: {workflow.pricingError}</div>
                )}
                {!workflow.pricingComplete && (
                  <button
                    className="table-action-button"
                    onClick={() => handleCalculatePricing(tender.id)}
                    disabled={!workflow.skuMatchComplete || workflow.calculatingPricing || (isProcessingAll && processingTender === tender.id)}
                    style={{ background: '#1f6feb' }}
                    title={isProcessingAll && processingTender === tender.id ? 'Automatic processing in progress' : ''}
                  >
                    {workflow.calculatingPricing ? 'Calculating...' : 'Calculate Pricing'}
                  </button>
                )}
                {workflow.pricingComplete && (
                  <button
                    className="table-action-button"
                    onClick={() => handleViewWorkflowResult(tender.id, 'pricing_table')}
                    style={{ background: '#238636' }}
                  >
                    View Pricing Table
                  </button>
                )}
              </div>

              {/* Step 4: Generate Holistic Summary */}
              <div className="workflow-step" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0d1117', borderRadius: '8px', border: '1px solid #30363d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ color: '#e6edf3', margin: 0 }}>Step 4: Generate Holistic Summary</h4>
                  {workflow.holisticComplete && <span style={{ color: '#3fb950', fontSize: '0.9rem' }}>✓ Complete</span>}
                </div>
                {workflow.holisticError && (
                  <div style={{ color: '#f85149', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Error: {workflow.holisticError}</div>
                )}
                {!workflow.holisticComplete && (
                  <button
                    className="table-action-button"
                    onClick={() => handleGenerateHolisticSummary(tender.id)}
                    disabled={!workflow.pricingComplete || workflow.generatingHolistic || (isProcessingAll && processingTender === tender.id)}
                    style={{ background: '#1f6feb' }}
                    title={isProcessingAll && processingTender === tender.id ? 'Automatic processing in progress' : ''}
                  >
                    {workflow.generatingHolistic ? 'Generating...' : 'Generate Holistic Summary'}
                  </button>
                )}
                {workflow.holisticComplete && (
                  <button
                    className="table-action-button"
                    onClick={() => handleViewWorkflowResult(tender.id, 'holistic_summary')}
                    style={{ background: '#238636' }}
                  >
                    View Holistic Summary
                  </button>
                )}
              </div>
                </div>
              )}
            </div>
          );
        })}
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

      {/* Workflow Result Modal */}
      {activeWorkflowModal.isOpen && (
        <div className="modal-overlay" onClick={handleCloseWorkflowModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {activeWorkflowModal.step === 'table_b1' && 'Table B1 - Matching Operations Table'}
                {activeWorkflowModal.step === 'matched_skus' && 'Matched SKUs'}
                {activeWorkflowModal.step === 'pricing_table' && 'Pricing Table'}
                {activeWorkflowModal.step === 'holistic_summary' && 'Holistic Summary Table'}
                {activeWorkflowModal.step === 'tender2_table_b1' && 'Tender 2 - Table B1'}
                {activeWorkflowModal.step === 'tender2_matched_skus' && 'Tender 2 - Matched SKUs'}
                {activeWorkflowModal.step === 'tender2_pricing' && 'Tender 2 - Pricing Table'}
                {activeWorkflowModal.step === 'tender2_holistic' && 'Tender 2 - Final Report'}
              </h2>
              <button className="modal-close-button" onClick={handleCloseWorkflowModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {activeWorkflowModal.loading ? (
                <div className="modal-loading">Loading result...</div>
              ) : activeWorkflowModal.data ? (
                <div className="report-content">
                  {(activeWorkflowModal.step === 'matched_skus' || activeWorkflowModal.step === 'tender2_matched_skus') ? (
                    <pre className="report-pre" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {activeWorkflowModal.data}
                    </pre>
                  ) : (
                    <div>
                      {renderCSVTable(activeWorkflowModal.data)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="modal-error">No data available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to render CSV table
function renderCSVTable(csvContent) {
  if (!csvContent) return null;

  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length === 0) return <div className="modal-error">No data in table</div>;

  // Parse CSV (handle quoted values)
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rows = lines.map(line => parseCSVLine(line));
  const headerRow = rows[0] || [];
  const dataRows = rows.slice(1);

  return (
    <div className="report-table-wrapper">
      <table className="report-table">
        <thead>
          <tr>
            {headerRow.map((cell, idx) => (
              <th key={idx}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {headerRow.map((_, colIdx) => (
                <td key={colIdx}>{row[colIdx] || ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
