const nodemailer = require('nodemailer');
const fs = require('fs-extra');

/**
 * Create Nodemailer transporter
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

/**
 * Send email with DOCX attachment
 * @param {string} docxFilePath - Path to the DOCX file to attach
 * @param {string} tenderId - Tender ID (tender1 or tender2)
 * @returns {Promise<boolean>} Success status
 */
async function sendEligibilityEmail(docxFilePath, tenderId) {
  try {
    console.log(`📧 Preparing to send email for ${tenderId}...`);
    
    const transporter = createTransporter();
    
    // Verify file exists
    if (!await fs.pathExists(docxFilePath)) {
      throw new Error(`DOCX file not found: ${docxFilePath}`);
    }
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: `Tender Eligibility Analysis Result - NOT ELIGIBLE - ${tenderId.toUpperCase()}`,
      text: 'Please find attached the detailed eligibility analysis report.',
      html: '<p>Please find attached the detailed eligibility analysis report.</p>',
      attachments: [
        {
          filename: `Eligibility_Analysis_${tenderId}_${Date.now()}.docx`,
          path: docxFilePath
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent successfully to ${process.env.EMAIL_TO}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    throw new Error(`Email sending failed: ${error.message}`);
  }
}

module.exports = {
  sendEligibilityEmail
};

