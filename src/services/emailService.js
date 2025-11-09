const nodemailer = require("nodemailer");
const fs = require("fs-extra");

/**
 * Create Nodemailer transporter using SendGrid
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: "apikey", // This is literally the string 'apikey'
      pass: process.env.SENDGRID_API_KEY,
    },
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
    if (!(await fs.pathExists(docxFilePath))) {
      throw new Error(`DOCX file not found: ${docxFilePath}`);
    }

    const mailOptions = {
      from: process.env.SENDGRID_FROM_EMAIL,
      to: process.env.EMAIL_TO,
      subject: `Tender Eligibility Analysis Result - NOT ELIGIBLE - ${tenderId.toUpperCase()}`,
      text: "Please find attached the detailed eligibility analysis report.",
      html: "<p>Please find attached the detailed eligibility analysis report.</p>",
      attachments: [
        {
          filename: `Eligibility_Analysis_${tenderId}_${Date.now()}.docx`,
          path: docxFilePath,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent successfully to ${process.env.EMAIL_TO}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    throw new Error(`Email sending failed: ${error.message}`);
  }
}

/**
 * Send email with holistic summary table (for eligibility = YES)
 * @param {string} holisticTablePath - Path to the holistic summary table CSV file
 * @param {string} tenderId - Tender ID (tender2)
 * @returns {Promise<boolean>} Success status
 */
async function sendHolisticTableEmail(holisticTablePath, tenderId) {
  try {
    console.log(`📧 Preparing to send holistic table email for ${tenderId}...`);

    const transporter = createTransporter();

    // Verify file exists
    if (!(await fs.pathExists(holisticTablePath))) {
      throw new Error(`Holistic table file not found: ${holisticTablePath}`);
    }

    // Get file extension to determine correct filename
    const fileExtension = holisticTablePath.toLowerCase().endsWith('.csv') ? 'csv' : 'txt';
    const timestamp = Date.now();

    const mailOptions = {
      from: process.env.SENDGRID_FROM_EMAIL,
      to: process.env.EMAIL_TO,
      subject: `Tender Analysis - ${tenderId.toUpperCase()} - Eligibility: YES - Complete`,
      text: `The tender analysis for ${tenderId.toUpperCase()} has been completed successfully.\n\nEligibility Status: YES\n\nPlease find the comprehensive holistic summary table attached as CSV file.`,
      html: `<p>The tender analysis for <strong>${tenderId.toUpperCase()}</strong> has been completed successfully.</p><p><strong>Eligibility Status: YES</strong></p><p>Please find the comprehensive holistic summary table attached as CSV file.</p>`,
      attachments: [
        {
          filename: `holistic_summary_table_${tenderId}_${timestamp}.${fileExtension}`,
          path: holisticTablePath,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Email sent successfully to ${process.env.EMAIL_TO} with CSV attachment`);
    return true;
  } catch (error) {
    console.error("❌ Error sending holistic table email:", error.message);
    throw new Error(`Email sending failed: ${error.message}`);
  }
}

module.exports = {
  sendEligibilityEmail,
  sendHolisticTableEmail,
};
