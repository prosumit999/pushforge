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
    const brandName = process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";

    if (!transporter) {
      console.warn("Gmail service notice: GMAIL_USER or GMAIL_APP_PASSWORD missing in env. Skipping email dispatch.");
      return { success: false, reason: "Email service not configured in environment" };
    }

    const mailOptions = {
      from: `"${brandName}" <${process.env.GMAIL_USER}>`,
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

const buildVerificationEmailHtml = ({ name, otpCode, planName = "Starter (Free)" }) => {
  const brandName = process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your ${brandName} Account</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0f172a; padding: 40px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 36px 30px; border-bottom: 3px solid #7c3aed;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 8px 16px; border-radius: 8px; color: #ffffff; font-weight: 800; font-size: 20px; letter-spacing: -0.5px;">
                    ${brandName}
                  </div>
                  <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 16px 0 0 0; letter-spacing: -0.3px;">
                    Email Verification Required
                  </h1>
                </td>
              </tr>

              <!-- Body Content -->
              <tr>
                <td style="padding: 40px 36px; background-color: #ffffff;">
                  <p style="font-size: 16px; line-height: 1.6; color: #0f172a; margin: 0 0 16px 0;">
                    Hello <strong>${name}</strong>,
                  </p>
                  <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                    Welcome to <strong>${brandName}</strong>! Your admin account has been initialized and assigned to the <strong>${planName}</strong> plan by default.
                  </p>
                  <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                    Please enter the 6-digit verification code below to confirm your email and activate your console access:
                  </p>

                  <!-- OTP Display Box -->
                  <div style="text-align: center; margin: 28px 0;">
                    <div style="display: inline-block; background: #f8fafc; border: 2px dashed #7c3aed; border-radius: 10px; padding: 16px 32px;">
                      <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #7c3aed; font-family: monospace;">
                        ${otpCode}
                      </span>
                    </div>
                  </div>

                  <p style="font-size: 13px; color: #64748b; text-align: center; margin: 0 0 28px 0;">
                    This code will expire in <strong>15 minutes</strong>.
                  </p>

                  <div style="background-color: #f1f5f9; border-left: 4px solid #7c3aed; padding: 14px 18px; border-radius: 4px; font-size: 13px; color: #475569; margin-bottom: 24px;">
                    <strong>Starter Plan Included:</strong> Full access to domain setup, subscriber WebPush token collection, and Go Worker Engine dispatching.
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                  <p style="margin: 0 0 6px 0; color: #64748b; font-weight: 600;">
                    ${brandName} Self-Hosted Notification Engine
                  </p>
                  <p style="margin: 0;">
                    If you did not create this account, please ignore this email.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const buildPasswordResetEmailHtml = ({ name = "Admin", otpCode }) => {
  const brandName = process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your ${brandName} Password</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #0f172a; padding: 40px 0;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 36px 30px; border-bottom: 3px solid #e11d48;">
                  <div style="display: inline-block; background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); padding: 8px 16px; border-radius: 8px; color: #ffffff; font-weight: 800; font-size: 20px; letter-spacing: -0.5px;">
                    ${brandName}
                  </div>
                  <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 16px 0 0 0; letter-spacing: -0.3px;">
                    Password Reset Request
                  </h1>
                </td>
              </tr>

              <!-- Body Content -->
              <tr>
                <td style="padding: 40px 36px; background-color: #ffffff;">
                  <p style="font-size: 16px; line-height: 1.6; color: #0f172a; margin: 0 0 16px 0;">
                    Hello <strong>${name}</strong>,
                  </p>
                  <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                    We received a request to reset your password for your <strong>${brandName}</strong> instance.
                  </p>
                  <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                    Use the 6-digit verification code below to authorize your new password:
                  </p>

                  <!-- OTP Display Box -->
                  <div style="text-align: center; margin: 28px 0;">
                    <div style="display: inline-block; background: #fff1f2; border: 2px dashed #e11d48; border-radius: 10px; padding: 16px 32px;">
                      <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #e11d48; font-family: monospace;">
                        ${otpCode}
                      </span>
                    </div>
                  </div>

                  <p style="font-size: 13px; color: #64748b; text-align: center; margin: 0 0 28px 0;">
                    This code will expire in <strong>15 minutes</strong>.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                  <p style="margin: 0 0 6px 0; color: #64748b; font-weight: 600;">
                    ${brandName} Self-Hosted Console
                  </p>
                  <p style="margin: 0;">
                    If you did not request a password reset, please secure your account immediately.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

module.exports = {
  sendEmail,
  buildVerificationEmailHtml,
  buildPasswordResetEmailHtml
};
