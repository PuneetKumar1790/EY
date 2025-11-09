/**
 * Test script to verify SKU upload endpoint
 * Run with: node test-sku-upload.js
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testSKUUpload() {
  console.log('\n🧪 Testing SKU Upload Endpoint...\n');

  // Check if SKU file exists
  const skuFilePath = 'Tender_SKU_Matching_Descriptions.txt';
  
  if (!fs.existsSync(skuFilePath)) {
    console.error(`❌ SKU file not found: ${skuFilePath}`);
    console.log('Please ensure the file exists in the root directory.');
    return;
  }

  console.log(`✓ Found SKU file: ${skuFilePath}`);
  
  // Create form data
  const formData = new FormData();
  formData.append('skuFile', fs.createReadStream(skuFilePath));

  try {
    console.log('\n📤 Uploading to http://localhost:3000/api/upload-sku-list...');
    
    const response = await fetch('http://localhost:3000/api/upload-sku-list', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders()
    });

    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const text = await response.text();
      console.error(`\n❌ Upload failed!`);
      console.error(`Response: ${text.substring(0, 500)}...`);
      return;
    }

    const result = await response.json();
    
    console.log('\n✅ Upload successful!');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Backend is not running!');
      console.error('Start it with: npm start');
    }
  }
}

// Run test
testSKUUpload();
