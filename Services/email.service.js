const nodemailer = require("nodemailer");

const createTransporter = (customSmtp) => {
  if (customSmtp && customSmtp.enabled && customSmtp.host && customSmtp.user && customSmtp.pass) {
    const port = Number(customSmtp.port) || 587;
    const isSecure = Boolean(customSmtp.secure || port === 465);
    return nodemailer.createTransport({
      host: customSmtp.host.trim(),
      port: port,
      secure: isSecure,
      auth: {
        user: customSmtp.user.trim(),
        pass: customSmtp.pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;

  if (!user || !pass) {
    return null;
  }

  if (host) {
    return nodemailer.createTransport({
      host: host.trim(),
      port: port,
      secure: port === 465,
      auth: { user: user.trim(), pass: pass },
      tls: { rejectUnauthorized: false }
    });
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: user.trim(),
      pass: pass
    }
  });
};

const sendEmail = async ({ to, subject, html, text, customSmtp, fromName, fromEmail }) => {
  try {
    const transporter = createTransporter(customSmtp);
    const brandName = process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";

    if (!transporter) {
      console.warn("SMTP notice: No SMTP configuration found (custom or env). Skipping email dispatch.");
      return { success: false, reason: "Email service not configured" };
    }

    const senderName = fromName || customSmtp?.fromName || brandName;
    const senderEmail = fromEmail || customSmtp?.fromEmail || customSmtp?.user || process.env.SMTP_USER || process.env.GMAIL_USER;

    const mailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to,
      subject,
      text: text || "",
      html: html || text
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}: Message ID ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send email via SMTP service:", error.message);
    return { success: false, error: error.message };
  }
};

const verifySmtpConnection = async (customSmtp) => {
  try {
    const transporter = createTransporter(customSmtp);
    if (!transporter) {
      return { success: false, error: "Missing required SMTP credentials (Host, Username/Email, App Password)" };
    }
    await transporter.verify();
    return { success: true, message: "SMTP server credentials verified successfully!" };
  } catch (error) {
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

const buildPaymentReceiptEmailHtml = ({ name, invoiceNumber, planName, amount, date, paymentMethod }) => {
  const brandName = process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Payment Receipt - ${invoiceNumber}</title></head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: sans-serif; color: #334155;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 40px 0;">
        <tr><td align="center">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 12px; overflow: hidden;">
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); padding: 30px; color: #fff;">
                <h1 style="margin: 0; font-size: 22px;">Payment Receipt</h1>
                <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Invoice ${invoiceNumber}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <p style="font-size: 15px; color: #0f172a;">Hello <strong>${name}</strong>,</p>
                <p style="font-size: 14px; color: #475569;">Thank you for your purchase! Here is your payment summary for upgrading to <strong>${planName}</strong>:</p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;"><span>Invoice Number:</span><strong>${invoiceNumber}</strong></div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;"><span>Plan Tier:</span><strong>${planName}</strong></div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px;"><span>Payment Method:</span><strong style="text-transform: uppercase;">${paymentMethod}</strong></div>
                  <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #7c3aed; padding-top: 8px; border-top: 1px solid #cbd5e1;"><span>Total Amount Paid:</span><span>$${Number(amount).toFixed(2)} USD</span></div>
                </div>
                <p style="font-size: 13px; color: #64748b;">You can view and download full HTML receipts in your account dashboard anytime.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
};

const buildQuotaWarningEmailHtml = ({ name, websiteName, currentCount, maxLimit }) => {
  const brandName = process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";
  const pct = Math.round((currentCount / maxLimit) * 100);
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Subscriber Quota Alert</title></head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 40px 0;">
        <tr><td align="center">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 12px; overflow: hidden;">
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 26px; color: #fff;">
                <h1 style="margin: 0; font-size: 20px;">Subscriber Quota Alert (${pct}%)</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <p style="font-size: 15px; color: #0f172a;">Hello <strong>${name}</strong>,</p>
                <p style="font-size: 14px; color: #475569;">Your website <strong>${websiteName}</strong> has reached <strong>${currentCount}</strong> of <strong>${maxLimit}</strong> push subscribers (${pct}% of limit).</p>
                <p style="font-size: 14px; color: #475569;">Consider upgrading your license plan to maintain uninterrupted push notification delivery to all visitors.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
};

const buildWeeklyDigestEmailHtml = ({ name, totalSubscribers, totalSent, totalClicks, avgCtr }) => {
  const brandName = process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Weekly Analytics Digest</title></head>
    <body style="margin: 0; padding: 0; background-color: #0f172a; font-family: sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="padding: 40px 0;">
        <tr><td align="center">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background: #ffffff; border-radius: 12px; overflow: hidden;">
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); padding: 30px; color: #fff; border-bottom: 3px solid #7c3aed;">
                <h1 style="margin: 0; font-size: 20px;">Weekly Push Analytics Digest</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <p style="font-size: 15px; color: #0f172a;">Hello <strong>${name}</strong>,</p>
                <p style="font-size: 14px; color: #475569;">Here is your weekly performance summary for your Web Push Notifications:</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0;">
                  <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <span style="font-size: 12px; color: #64748b; display: block;">Total Push Subscribers</span>
                    <strong style="font-size: 20px; color: #7c3aed;">${totalSubscribers}</strong>
                  </div>
                  <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <span style="font-size: 12px; color: #64748b; display: block;">Notifications Sent</span>
                    <strong style="font-size: 20px; color: #0f172a;">${totalSent}</strong>
                  </div>
                  <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <span style="font-size: 12px; color: #64748b; display: block;">Total Clicks</span>
                    <strong style="font-size: 20px; color: #10b981;">${totalClicks}</strong>
                  </div>
                  <div style="background: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <span style="font-size: 12px; color: #64748b; display: block;">Average CTR</span>
                    <strong style="font-size: 20px; color: #3b82f6;">${avgCtr}%</strong>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
};

module.exports = {
  sendEmail,
  verifySmtpConnection,
  buildVerificationEmailHtml,
  buildPasswordResetEmailHtml,
  buildPaymentReceiptEmailHtml,
  buildQuotaWarningEmailHtml,
  buildWeeklyDigestEmailHtml
};
