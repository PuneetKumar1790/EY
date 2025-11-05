const API_BASE_URL = 'http://localhost:3000/api';

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

