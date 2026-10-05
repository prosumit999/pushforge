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

const getInvoiceReceiptHtml = async (invoiceId, userId) => {
  const invoice = await Invoice.findOne({ _id: invoiceId, user: userId }).populate("user", "name email");
  if (!invoice) {
    throw new Error("Invoice record not found");
  }

  const brandName = process.env.APP_NAME || process.env.BRAND_NAME || "PushForge";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${invoice.invoiceNumber} - ${brandName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #0f172a; max-width: 700px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #7c3aed; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: 800; color: #7c3aed; }
        .badge { background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 99px; font-weight: 800; font-size: 14px; }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .table th, .table td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
        .table th { background: #f8fafc; color: #475569; text-transform: uppercase; font-size: 12px; }
        .total-row { font-size: 18px; font-weight: 900; color: #7c3aed; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">${brandName}</div>
        <span class="badge">PAID</span>
      </div>

      <div class="details-grid">
        <div>
          <h4 style="margin: 0 0 6px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Customer Details</h4>
          <strong style="font-size: 16px;">${invoice.user?.name || "Customer"}</strong><br/>
          <span style="color: #64748b; font-size: 14px;">${invoice.user?.email || ""}</span>
        </div>
        <div style="text-align: right;">
          <h4 style="margin: 0 0 6px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Invoice Details</h4>
          <strong style="font-size: 16px;">${invoice.invoiceNumber}</strong><br/>
          <span style="color: #64748b; font-size: 14px;">Date: ${new Date(invoice.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>Description / Plan</th>
            <th>Payment Method</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>${invoice.planName}</strong> (Lifetime License)</td>
            <td style="text-transform: uppercase;">${invoice.paymentMethod}</td>
            <td style="text-align: right; font-weight: 700;">$${invoice.amount.toFixed(2)} USD</td>
          </tr>
        </tbody>
      </table>

      <div style="text-align: right; margin-top: 20px;">
        <div class="total-row">Total Paid: $${invoice.amount.toFixed(2)} USD</div>
        <p style="font-size: 12px; color: #64748b; margin-top: 6px;">Transaction ID: ${invoice.paymentId}</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  createInvoice,
  getUserInvoices,
  getInvoiceReceiptHtml
};
