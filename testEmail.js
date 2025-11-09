require("dotenv").config();
const nodemailer = require("nodemailer");

async function sendMail() {
  // Setup transporter for SendGrid
  const transporter = nodemailer.createTransport({
    service: "SendGrid",
    auth: {
      user: "apikey", // fixed value for SendGrid
      pass: process.env.SENDGRID_API_KEY,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SENDGRID_FROM_EMAIL, // must be your verified sender
      to: process.env.EMAIL_TO, // recipient email
      subject: "SendGrid Email Test",
      text: "This is a test email sent using Nodemailer + SendGrid + environment variables.",
    });

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);
  } catch (error) {
    console.error("❌ Email sending failed:", error);
  }
}

sendMail();
