const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Fetch all tenders
 */
export async function getTenders() {
  const response = await fetch(`${API_BASE_URL}/tenders`);
  const data = await response.json();
  return data;
}

/**
 * Start workflow for a tender
 */
export async function startWorkflow(tenderId) {
  const response = await fetch(`${API_BASE_URL}/process-workflow/${tenderId}`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}

/**
 * Get workflow status
 */
export async function getWorkflowStatus(tenderId) {
  const response = await fetch(`${API_BASE_URL}/workflow-status/${tenderId}`);
  const data = await response.json();
  return data;
}

/**
 * Upload company information document
 */
export async function uploadCompanyInfo(file) {
  const formData = new FormData();
  formData.append('document', file);
  
  const response = await fetch(`${API_BASE_URL}/upload-company`, {
    method: 'POST',
    body: formData
  });
  const data = await response.json();
  return data;
}

/**
 * Get eligibility report
 */
export async function getEligibilityReport(tenderId) {
  const response = await fetch(`${API_BASE_URL}/eligibility-report/${tenderId}`);
  const data = await response.json();
  return data;
}

/**
 * Upload SKU list file
 */
export async function uploadSKUList(file) {
  const formData = new FormData();
  formData.append('skuFile', file);
  
  const response = await fetch(`${API_BASE_URL}/upload-sku-list`, {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${response.status} - ${text}`);
  }
  
  const data = await response.json();
  return data;
}

/**
 * Build Table B1 (Matching Operations Table)
 */
export async function buildTableB1(tenderId) {
  const response = await fetch(`${API_BASE_URL}/build-table-b1/${tenderId}`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}

/**
 * Match SKUs
 */
export async function matchSKUs(tenderId) {
  const response = await fetch(`${API_BASE_URL}/match-skus/${tenderId}`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}

/**
 * Calculate pricing
 */
export async function calculatePricing(tenderId) {
  const response = await fetch(`${API_BASE_URL}/calculate-pricing/${tenderId}`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}

/**
 * Generate holistic summary table
 */
export async function generateHolisticSummary(tenderId) {
  const response = await fetch(`${API_BASE_URL}/generate-holistic-summary/${tenderId}`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}

/**
 * Get workflow result file (Table B1, matched SKUs, pricing, holistic summary)
 */
export async function getWorkflowResult(tenderId, resultType) {
  const response = await fetch(`${API_BASE_URL}/workflow-result/${tenderId}/${resultType}`);
  const data = await response.json();
  return data;
}

/**
 * Process Tender 2 workflow (complete 9-step pipeline)
 */
export async function processTender2Workflow() {
  const response = await fetch(`${API_BASE_URL}/process-tender2-workflow`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}

