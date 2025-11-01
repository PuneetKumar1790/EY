/**
 * Calculate distance between two locations
 * This is a simplified implementation. For production, use a proper geocoding API
 * like Google Maps Distance Matrix API, OpenRouteService, or similar.
 * 
 * @param {string} origin - Origin location (e.g., "Vapi, Gujarat")
 * @param {string} destination - Destination location (e.g., "Rajkot, Gujarat")
 * @returns {Promise<number>} Distance in kilometers
 */
async function calculateDistance(origin, destination) {
  // Default manufacturing location
  const DEFAULT_ORIGIN = 'Vapi, Gujarat';
  
  const originLoc = origin || DEFAULT_ORIGIN;
  
  // For now, return a default distance based on common Indian city pairs
  // In production, replace this with actual geocoding API call
  
  const cityDistances = {
    // Gujarat cities from Vapi
    'Rajkot': 350,
    'Ahmedabad': 200,
    'Surat': 50,
    'Vadodara': 250,
    'Gandhinagar': 220,
    // Add more common destinations as needed
  };

  // Try to extract city name from destination
  const destCity = destination.split(',')[0].trim();
  
  if (cityDistances[destCity]) {
    console.log(`📍 Using predefined distance: ${originLoc} to ${destination} = ${cityDistances[destCity]} km`);
    return cityDistances[destCity];
  }

  // Default fallback - use a reasonable estimate
  console.log(`⚠️ Distance not found for ${destination}. Using default estimate of 300 km`);
  console.log(`💡 For accurate distances, implement a geocoding API like Google Maps Distance Matrix`);
  
  return 300; // Default estimate in km
}

/**
 * Extract delivery location from tender summary text
 * @param {string} summaryText - Comprehensive tender summary
 * @returns {string} Delivery location string
 */
function extractDeliveryLocation(summaryText) {
  if (!summaryText) return '';
  
  // Look for common patterns
  const patterns = [
    /Delivery Location[:\s]+([^.\n]+)/i,
    /Consignee Address[:\s]+([^.\n]+)/i,
    /Delivery Address[:\s]+([^.\n]+)/i,
    /Destination[:\s]+([^.\n]+)/i,
    /Deliver to[:\s]+([^.\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = summaryText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

module.exports = {
  calculateDistance,
  extractDeliveryLocation
};

