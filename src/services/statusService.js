/**
 * Status tracking service for workflow operations
 * Stores status in memory for real-time updates
 */

const statusStore = new Map();

/**
 * Get status for a tender operation
 */
function getStatus(tenderId) {
  return statusStore.get(tenderId) || {
    tenderId,
    status: 'idle',
    currentStep: null,
    progress: 0,
    message: 'Ready to start',
    error: null,
    completed: false
  };
}

/**
 * Update status for a tender operation
 */
function updateStatus(tenderId, updates) {
  const current = getStatus(tenderId);
  const updated = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };
  statusStore.set(tenderId, updated);
  return updated;
}

/**
 * Clear status for a tender
 */
function clearStatus(tenderId) {
  statusStore.delete(tenderId);
}

/**
 * Reset status to idle
 */
function resetStatus(tenderId) {
  statusStore.set(tenderId, {
    tenderId,
    status: 'idle',
    currentStep: null,
    progress: 0,
    message: 'Ready to start',
    error: null,
    completed: false,
    updatedAt: new Date().toISOString()
  });
}

module.exports = {
  getStatus,
  updateStatus,
  clearStatus,
  resetStatus
};

