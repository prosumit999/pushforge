const mongoose = require("mongoose");
const { User, Invoice } = require("../Models");
const { sendEmail, buildPaymentReceiptEmailHtml } = require("./email.service");
const { normalizePlanName } = require("../Utils/planUtils");

const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${rand}`;
};

const createInvoice = async ({ userId, planName, amount, paymentMethod, paymentId }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found for invoice creation");
  }

  // Update user plan on successful payment
  user.plan = normalizePlanName(planName);
  await user.save();

  const invoiceNumber = generateInvoiceNumber();

  const invoice = await Invoice.create({
    user: user._id,
    invoiceNumber,
    planName,
    amount,
    currency: "USD",
    paymentMethod: paymentMethod || "stripe",
    paymentId: paymentId || `tx_${Date.now()}`,
    status: "paid"
  });

  // Dispatch Email Receipt
  try {
    const html = buildPaymentReceiptEmailHtml({
      name: user.name,
      invoiceNumber,
      planName,
      amount,
      date: new Date().toLocaleDateString(),
      paymentMethod: paymentMethod || "stripe"
    });

    await sendEmail({
      to: user.email,
      subject: `Payment Receipt: ${invoiceNumber} - ${planName}`,
      html
    });
  } catch (err) {
    console.warn("Could not dispatch receipt email:", err.message);
  }

  return invoice;
};

const getUserInvoices = async (userId) => {
  return await Invoice.find({ user: userId }).sort({ createdAt: -1 });
};

const getInvoiceReceiptHtml = async (invoiceId, userId, userRole = "user") => {
  let invoice = null;

  const isObjectId = mongoose.Types.ObjectId.isValid(invoiceId);
  const isSuperadmin = userRole === "superadmin" || userRole === "admin";

  if (isObjectId) {
    const query = isSuperadmin ? { _id: invoiceId } : { _id: invoiceId, user: userId };
    invoice = await Invoice.findOne(query).populate("user", "name email");
  }

  if (!invoice) {
    const query = isSuperadmin ? { invoiceNumber: invoiceId } : { invoiceNumber: invoiceId, user: userId };
    invoice = await Invoice.findOne(query).populate("user", "name email");
  }

  if (!invoice) {
    throw new Error("Invoice record not found");
  }

  const brandName = process.env.BRAND_NAME || process.env.APP_NAME || "PushForge";
  const formattedDate = new Date(invoice.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  const amountFormatted = Number(invoice.amount || 0).toFixed(2);
  const currency = (invoice.currency || "USD").toUpperCase();
  const paymentMethod = (invoice.paymentMethod || "stripe").toUpperCase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${invoice.invoiceNumber} - ${brandName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      padding: 30px 15px;
      -webkit-font-smoothing: antialiased;
    }
    .invoice-card {
      max-width: 620px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03);
      padding: 32px 36px;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #7c3aed;
      padding-bottom: 18px;
      margin-bottom: 22px;
    }
    .brand-logo {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: #7c3aed;
    }
    .brand-sub {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: block;
      margin-top: 2px;
    }
    .badge-paid {
      background-color: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 9999px;
      display: inline-block;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      background: #f8fafc;
      border: 1px solid #f1f5f9;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 22px;
    }
    .meta-col-title {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .meta-col-name {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
    }
    .meta-col-sub {
      font-size: 12px;
      color: #64748b;
      margin-top: 2px;
    }
    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .invoice-table th {
      background: #f8fafc;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 10px 14px;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      text-align: left;
    }
    .invoice-table td {
      padding: 12px 14px;
      font-size: 13px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
    }
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 20px;
    }
    .summary-box {
      width: 250px;
      background: #faf5ff;
      border: 1px solid #f3e8ff;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .summary-row.total {
      font-size: 14px;
      font-weight: 800;
      color: #7c3aed;
      border-top: 1px dashed #d8b4fe;
      padding-top: 8px;
      margin-top: 6px;
      margin-bottom: 0;
    }
    .tx-ref {
      font-size: 11px;
      color: #94a3b8;
      font-family: monospace;
      text-align: right;
      margin-bottom: 20px;
    }
    .footer-note {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-card { box-shadow: none; border: 1px solid #cbd5e1; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header-row">
      <div>
        <div class="brand-logo">${brandName}</div>
        <span class="brand-sub">Official Payment Receipt</span>
      </div>
      <span class="badge-paid">✓ PAID</span>
    </div>

    <div class="meta-grid">
      <div>
        <div class="meta-col-title">Billed To</div>
        <div class="meta-col-name">${invoice.user?.name || "Valued Customer"}</div>
        <div class="meta-col-sub">${invoice.user?.email || ""}</div>
      </div>
      <div style="text-align: right;">
        <div class="meta-col-title">Receipt Info</div>
        <div class="meta-col-name" style="font-family: monospace; color: #7c3aed;">${invoice.invoiceNumber}</div>
        <div class="meta-col-sub">Date: ${formattedDate}</div>
      </div>
    </div>

    <table class="invoice-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Payment Method</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${invoice.planName}</strong>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">One-Time Lifetime License</div>
          </td>
          <td style="font-weight: 600; color: #475569;">${paymentMethod}</td>
          <td style="text-align: right; font-weight: 700; color: #0f172a;">$${amountFormatted} ${currency}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary-section">
      <div class="summary-box">
        <div class="summary-row">
          <span>Subtotal:</span>
          <span>$${amountFormatted}</span>
        </div>
        <div class="summary-row">
          <span>Tax / Fee:</span>
          <span>$0.00</span>
        </div>
        <div class="summary-row total">
          <span>Total Paid:</span>
          <span>$${amountFormatted} ${currency}</span>
        </div>
      </div>
    </div>
    
    <div class="tx-ref">Transaction ID: ${invoice.paymentId}</div>

    <div class="footer-note">
      Thank you for your business! This official receipt serves as proof of payment for tax and accounting records.<br/>
      <strong>${brandName}</strong> • Official Billing &amp; Licensing Receipt
    </div>
  </div>
</body>
</html>`;
};

module.exports = {
  createInvoice,
  getUserInvoices,
  getInvoiceReceiptHtml
};
