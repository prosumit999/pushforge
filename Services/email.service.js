const nodemailer = require("nodemailer");

const createTransporter = () => {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass
    }
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();

    if (!transporter) {
      console.warn("Gmail service notice: GMAIL_USER or GMAIL_APP_PASSWORD missing in env. Skipping email dispatch.");
      return { success: false, reason: "Email service not configured in environment" };
    }

    const mailOptions = {
      from: `"PushForge" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: text || "",
      html: html || text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}: Message ID ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send email via Gmail service:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail
};
