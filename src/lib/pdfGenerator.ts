import { jsPDF } from 'jspdf';
import type { PosStoreState, SaleTransaction, SubscriptionInvoiceRecord, ShopTenantSummary } from '../types/pos';
import { formatBDT } from '../i18n/translations';

/**
 * Generates and triggers download of a professional 80mm thermal receipt PDF.
 * Formatted to standard POS receipt printer roll dimensions (80mm width).
 */
export function downloadPosReceiptPdf(params: {
  sale: SaleTransaction;
  state: PosStoreState;
}): void {
  const { sale, state } = params;

  // Standard 80mm POS thermal roll width. Calculate height based on line items
  const rollWidthMm = 80;
  const baseHeightMm = 110;
  const itemsHeightMm = Math.max(20, sale.items.length * 9);
  const totalHeightMm = Math.max(140, baseHeightMm + itemsHeightMm);

  const doc = new jsPDF({
    unit: 'mm',
    format: [rollWidthMm, totalHeightMm],
    orientation: 'portrait',
  });

  doc.setFont('courier', 'normal');

  let y = 8;
  const centerX = rollWidthMm / 2;
  const leftX = 5;
  const rightX = rollWidthMm - 5;

  // Header: Shop Name (ASCII safe transliteration + clean header)
  doc.setFontSize(11);
  doc.setFont('courier', 'bold');
  const shopNameHeader = state.shopNameEn || state.shopNameBn || 'MHS POS RETAIL';
  doc.text(shopNameHeader.toUpperCase(), centerX, y, { align: 'center' });
  y += 4.5;

  doc.setFontSize(8);
  doc.setFont('courier', 'normal');
  if (state.businessType) {
    doc.text(state.businessType, centerX, y, { align: 'center' });
    y += 3.5;
  }
  if (state.phone || state.address) {
    const contactLine = [state.phone, state.address].filter(Boolean).join(' | ');
    doc.text(contactLine.slice(0, 36), centerX, y, { align: 'center' });
    y += 3.5;
  }

  // Divider
  doc.text('------------------------------------------', centerX, y, { align: 'center' });
  y += 4;

  // Invoice & Cashier details
  doc.setFontSize(7.5);
  doc.text(`INVOICE: ${sale.invoiceNo}`, leftX, y);
  y += 3.5;
  doc.text(`DATE   : ${sale.date} ${sale.timestamp.slice(11, 16)}`, leftX, y);
  y += 3.5;
  const cashierDisplay = sale.sellerPhone
    ? `CASHIER: ${sale.cashierName || 'Staff'} (${sale.sellerPhone})`
    : `CASHIER: ${sale.cashierName || 'Staff'}`;
  doc.text(cashierDisplay, leftX, y);
  y += 3.5;
  doc.text(`PAYMENT: ${sale.paymentMethod || 'Cash'}`, leftX, y);
  y += 3.5;

  if (sale.customerName || sale.customerPhone) {
    doc.text(`CUSTOMER: ${sale.customerName || 'Walk-in'} (${sale.customerPhone || 'N/A'})`, leftX, y);
    y += 3.5;
  }

  // Table Header
  doc.text('==========================================', centerX, y, { align: 'center' });
  y += 3.5;
  doc.setFont('courier', 'bold');
  doc.text('ITEM', leftX, y);
  doc.text('QTY', rightX - 25, y, { align: 'right' });
  doc.text('TOTAL(TK)', rightX, y, { align: 'right' });
  y += 3;
  doc.setFont('courier', 'normal');
  doc.text('------------------------------------------', centerX, y, { align: 'center' });
  y += 4;

  // Item Rows
  sale.items.forEach((item) => {
    const itemName = item.name.length > 20 ? item.name.slice(0, 19) + '.' : item.name;
    doc.text(itemName, leftX, y);
    doc.text(String(item.quantity), rightX - 25, y, { align: 'right' });
    doc.text(item.subtotal.toFixed(0), rightX, y, { align: 'right' });
    y += 4;
  });

  // Totals Divider
  doc.text('------------------------------------------', centerX, y, { align: 'center' });
  y += 4;

  // Totals Section
  doc.text('SUBTOTAL:', leftX + 15, y);
  doc.text(`TK ${sale.subtotal.toFixed(0)}`, rightX, y, { align: 'right' });
  y += 3.5;

  if (sale.discount > 0) {
    doc.text('DISCOUNT:', leftX + 15, y);
    doc.text(`-TK ${sale.discount.toFixed(0)}`, rightX, y, { align: 'right' });
    y += 3.5;
  }

  if (sale.serviceFee > 0) {
    doc.text('SERVICE/EXTRA:', leftX + 15, y);
    doc.text(`+TK ${sale.serviceFee.toFixed(0)}`, rightX, y, { align: 'right' });
    y += 3.5;
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('GRAND TOTAL:', leftX + 15, y);
  doc.text(`TK ${sale.totalAmount.toFixed(0)}`, rightX, y, { align: 'right' });
  y += 4.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text('PAID AMOUNT:', leftX + 15, y);
  doc.text(`TK ${sale.paidAmount.toFixed(0)}`, rightX, y, { align: 'right' });
  y += 3.5;

  if (sale.dueAmount > 0) {
    doc.setFont('courier', 'bold');
    doc.text('BALANCE DUE (DUE):', leftX + 15, y);
    doc.text(`TK ${sale.dueAmount.toFixed(0)}`, rightX, y, { align: 'right' });
    y += 4;
    doc.setFont('courier', 'normal');
  }

  // Footer & Barcode mock
  y += 2;
  doc.text('==========================================', centerX, y, { align: 'center' });
  y += 4;

  doc.setFontSize(7);
  doc.text('* THANK YOU! VISIT AGAIN *', centerX, y, { align: 'center' });
  y += 3.5;
  doc.text('MHS POS · Smart Cloud Retail System', centerX, y, { align: 'center' });
  y += 4;

  // Visual pseudo-barcode block
  doc.text(`||||| ||| ||||||| |||| |||||| |||||`, centerX, y, { align: 'center' });
  y += 3;
  doc.text(`*${sale.invoiceNo}*`, centerX, y, { align: 'center' });

  // Trigger browser download
  doc.save(`MHS_POS_Receipt_${sale.invoiceNo}.pdf`);
}

/**
 * Generates and downloads a clean, professional full A4 PDF Cash Memo / Retail Invoice
 * for standard office/home laser/inkjet printers.
 */
export function downloadA4CashMemoPdf(params: {
  sale: SaleTransaction;
  state: PosStoreState;
}): void {
  const { sale, state } = params;

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  const pageWidth = 210;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner Background (Deep Slate)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 44, 'F');

  // Accent Stripe (Emerald)
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 44, pageWidth, 3, 'F');

  // Brand / Shop Name Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  const shopTitle = state.shopNameEn || state.shopNameBn || 'RETAIL STORE';
  doc.text(shopTitle.toUpperCase(), margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  if (state.businessType) {
    doc.text(state.businessType, margin, 24);
  }
  const contactParts = [state.address, state.phone].filter(Boolean);
  if (contactParts.length > 0) {
    doc.text(contactParts.join(' | ').slice(0, 70), margin, 30);
  }
  doc.text('Official Retail Cash Memo / Customer Bill', margin, 36);

  // Document Title & Invoice Meta (Right side of banner)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('CASH MEMO', pageWidth - margin, 18, { align: 'right' });

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129); // emerald-400
  doc.text(`INVOICE: ${sale.invoiceNo}`, pageWidth - margin, 25, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.text(`DATE: ${sale.date} ${sale.timestamp ? sale.timestamp.slice(11, 16) : ''}`, pageWidth - margin, 31, { align: 'right' });
  const a4Cashier = sale.sellerPhone
    ? `CASHIER: ${sale.cashierName || 'Staff'} (${sale.sellerPhone})`
    : `CASHIER: ${sale.cashierName || 'Staff'}`;
  doc.text(a4Cashier, pageWidth - margin, 37, { align: 'right' });

  // Body Meta Cards
  let y = 57;

  // Left Card: Customer / Billed To
  const cardWidth = (contentWidth - 6) / 2;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, cardWidth, 27, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('BILLED TO / CUSTOMER DETAILS:', margin + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42); // slate-900
  const custName = sale.customerName || 'Walk-in Customer';
  doc.text(custName.slice(0, 32), margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Mobile: ${sale.customerPhone || 'N/A'}`, margin + 4, y + 18);
  doc.text(`Sales Channel: ${sale.channel || 'Walk-in Counter'}`, margin + 4, y + 23);

  // Right Card: Payment & Order Details
  const rightCardX = margin + cardWidth + 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightCardX, y, cardWidth, 27, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT & TRANSACTION INFO:', rightCardX + 4, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Payment Method: ${sale.paymentMethod || 'Cash'}`, rightCardX + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Transaction Status: ${sale.dueAmount > 0 ? 'Partial Payment / Due Balance' : 'Paid in Full'}`, rightCardX + 4, y + 18);
  doc.text(`Terminal: Counter Register POS`, rightCardX + 4, y + 23);

  // Items Table Header
  y += 33;
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, y, contentWidth, 8, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y + 8, margin + contentWidth, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('#', margin + 3, y + 5.5);
  doc.text('ITEM DESCRIPTION', margin + 12, y + 5.5);
  doc.text('CATEGORY', margin + 92, y + 5.5);
  doc.text('QTY', margin + 128, y + 5.5, { align: 'right' });
  doc.text('UNIT PRICE (TK)', margin + 155, y + 5.5, { align: 'right' });
  doc.text('TOTAL (TK)', margin + contentWidth - 3, y + 5.5, { align: 'right' });
  y += 8;

  // Items Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  sale.items.forEach((item, index) => {
    // Alternating row background for clean readability
    if (index % 2 === 1) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentWidth, 7.5, 'F');
    }

    doc.text(String(index + 1), margin + 3, y + 5.2);
    doc.text(item.name.slice(0, 42), margin + 12, y + 5.2);
    doc.text((item.category || '-').slice(0, 18), margin + 92, y + 5.2);
    doc.text(String(item.quantity), margin + 128, y + 5.2, { align: 'right' });
    doc.text(item.unitPrice.toFixed(0), margin + 155, y + 5.2, { align: 'right' });
    doc.text(item.subtotal.toFixed(0), margin + contentWidth - 3, y + 5.2, { align: 'right' });

    y += 7.5;
    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y, margin + contentWidth, y);
  });

  y += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  // Financial Summary Breakdown (Right Aligned)
  const totalsLeft = margin + contentWidth - 80;
  const totalsRight = margin + contentWidth - 3;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', totalsLeft, y);
  doc.text(`Tk ${sale.subtotal.toFixed(0)}`, totalsRight, y, { align: 'right' });
  y += 5;

  if (sale.discount > 0) {
    doc.text('Discount:', totalsLeft, y);
    doc.text(`-Tk ${sale.discount.toFixed(0)}`, totalsRight, y, { align: 'right' });
    y += 5;
  }

  if (sale.serviceFee > 0) {
    doc.text('Servicing / Extra:', totalsLeft, y);
    doc.text(`+Tk ${sale.serviceFee.toFixed(0)}`, totalsRight, y, { align: 'right' });
    y += 5;
  }

  // Grand Total Highlight Box
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.roundedRect(totalsLeft - 4, y - 1, 84, 9, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text('GRAND TOTAL:', totalsLeft, y + 5.5);
  doc.text(`Tk ${sale.totalAmount.toFixed(0)}`, totalsRight, y + 5.5, { align: 'right' });
  y += 12;

  // Paid & Due
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Paid Amount:', totalsLeft, y);
  doc.text(`Tk ${sale.paidAmount.toFixed(0)}`, totalsRight, y, { align: 'right' });
  y += 5;

  if (sale.dueAmount > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28); // rose-700
    doc.text('Balance Due (বাকি):', totalsLeft, y);
    doc.text(`Tk ${sale.dueAmount.toFixed(0)}`, totalsRight, y, { align: 'right' });
    y += 6;
  }

  // Terms & Conditions (Left Bottom)
  const termsY = Math.max(y, 235);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TERMS & CONDITIONS:', margin, termsY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Goods once sold can be exchanged within 7 days upon presentation of this original cash memo.', margin, termsY + 4.5);
  doc.text('2. No cash refund will be accepted. Electrical goods carry standard manufacturer warranty where applicable.', margin, termsY + 8.5);
  doc.text('3. For customer support or warranty inquiries, please preserve this invoice receipt.', margin, termsY + 12.5);

  // Signatures
  const sigY = 265;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, sigY, margin + 45, sigY);
  doc.line(pageWidth - margin - 50, sigY, pageWidth - margin, sigY);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Customer Signature', margin + 6, sigY + 4.5);
  doc.text('Authorized Signature & Seal', pageWidth - margin - 46, sigY + 4.5);

  // Footer bar
  const footerY = 282;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, margin + contentWidth, footerY);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Thank you for shopping with us! · Powered by MHS Smart Cloud POS', margin, footerY + 5);
  doc.text(`Generated on ${sale.date} · Invoice #${sale.invoiceNo}`, margin + contentWidth, footerY + 5, { align: 'right' });

  // Save PDF
  doc.save(`MHS_Cash_Memo_${sale.invoiceNo}.pdf`);
}

/**
 * Generates and downloads a clean, professional A4 PDF subscription invoice
 * for Super Admin and Shop Owners.
 */
export function downloadSubscriptionInvoicePdf(params: {
  invoice: SubscriptionInvoiceRecord;
  shop?: ShopTenantSummary;
  superAdminEmail?: string;
}): void {
  const { invoice, shop, superAdminEmail = 'mhsumon670@gmail.com' } = params;

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  // Header Banner Background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Accent Line
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 42, pageWidth, 3, 'F');

  // Brand Title & Tagline
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('MHS POS', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('Smart Retail Point of Sale & Multi-Shop SaaS Platform', margin, 24);
  doc.text(`Issuer Contact: ${superAdminEmail}`, margin, 30);

  // Invoice Title Right Aligned
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SUBSCRIPTION INVOICE', pageWidth - margin, 18, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129); // emerald-400
  doc.text(`RECEIPT: ${invoice.receiptNo || invoice.id}`, pageWidth - margin, 25, { align: 'right' });
  doc.setTextColor(203, 213, 225);
  doc.text(`BILLING MONTH: ${invoice.monthKey}`, pageWidth - margin, 31, { align: 'right' });

  // Main Body
  let y = 56;
  doc.setTextColor(15, 23, 42);

  // Left: Bill To
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILLED TO (SHOP OWNER):', margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const shopLabel = shop
    ? `${shop.shopNameEn || shop.shopNameBn}`
    : `${invoice.shopNameEn || invoice.shopNameBn}`;
  doc.text(shopLabel, margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  if (shop?.businessType) {
    doc.text(`Business Type: ${shop.businessType}`, margin, y);
    y += 4.5;
  }
  doc.text(`Account Email: ${invoice.ownerEmail}`, margin, y);
  y += 4.5;
  if (shop?.phone) {
    doc.text(`Phone: ${shop.phone}`, margin, y);
    y += 4.5;
  }
  if (shop?.address) {
    doc.text(`Address: ${shop.address}`, margin, y);
    y += 4.5;
  }

  // Right: Status Stamp & Invoice Metadata
  const rightBoxX = 135;
  let statusY = 56;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('INVOICE SUMMARY:', rightBoxX, statusY);
  statusY += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice Date: ${new Date().toISOString().slice(0, 10)}`, rightBoxX, statusY);
  statusY += 4.5;
  doc.text(`Due Date: ${invoice.dueDate || '5th of month'}`, rightBoxX, statusY);
  statusY += 4.5;
  doc.text(`Payment Method: ${invoice.paymentMethod || 'bKash / Nagad / Bank'}`, rightBoxX, statusY);
  statusY += 5.5;

  // Status Badge Box
  const isPaid = invoice.status === 'Paid';
  const isOverdue = invoice.status === 'Overdue';
  doc.setFillColor(isPaid ? 236 : isOverdue ? 254 : 254, isPaid ? 253 : isOverdue ? 242 : 249, isPaid ? 245 : isOverdue ? 242 : 195);
  doc.setDrawColor(isPaid ? 5 : isOverdue ? 225 : 217, isPaid ? 150 : isOverdue ? 29 : 119, isPaid ? 105 : isOverdue ? 72 : 6);
  doc.roundedRect(rightBoxX, statusY, 55, 9, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(isPaid ? 4 : isOverdue ? 190 : 180, isPaid ? 120 : isOverdue ? 18 : 83, isPaid ? 87 : isOverdue ? 60 : 9);
  doc.text(`STATUS: ${invoice.status.toUpperCase()}`, rightBoxX + 27.5, statusY + 6.2, { align: 'center' });

  // Move down to Service Table
  y = Math.max(y, statusY + 16);

  // Table Header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, y, contentWidth, 9, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y + 9, margin + contentWidth, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('SERVICE DESCRIPTION', margin + 4, y + 6);
  doc.text('PLAN TIER', margin + 95, y + 6);
  doc.text('PERIOD', margin + 130, y + 6);
  doc.text('FEE (BDT)', margin + contentWidth - 4, y + 6, { align: 'right' });
  y += 9;

  // Table Row
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  const planName = invoice.plan || 'Business';
  const planFeatures =
    planName === 'Enterprise'
      ? 'Includes: Camera Barcode Scanning, Multi-User POS, Smart Cloud Storage Sync, E-Commerce Integration, Audit Logs'
      : planName === 'Business'
      ? 'Includes: Multi-User POS, Smart Cloud Storage Sync, Customer Credit Ledger, Profit Analytics'
      : 'Includes: Core Counter Billing, Product Inventory, Smart Cloud Storage Sync';

  doc.setFont('helvetica', 'bold');
  doc.text(`MHS POS SaaS Subscription — ${planName} Plan`, margin + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(planFeatures.slice(0, 68), margin + 4, y + 11);
  if (planFeatures.length > 68) {
    doc.text(planFeatures.slice(68, 130), margin + 4, y + 15);
  }

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(planName, margin + 95, y + 6);
  doc.text(invoice.monthKey, margin + 130, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.text(`BDT ${invoice.amount.toFixed(0)}`, margin + contentWidth - 4, y + 6, { align: 'right' });

  y += 22;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  // Totals Box
  const totalsX = 120;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', totalsX, y);
  doc.text(`BDT ${invoice.amount.toFixed(0)}`, margin + contentWidth - 4, y, { align: 'right' });
  y += 5;

  doc.text('Taxes & Surcharges (0%):', totalsX, y);
  doc.text('BDT 0', margin + contentWidth - 4, y, { align: 'right' });
  y += 6;

  doc.setFillColor(248, 250, 252);
  doc.rect(totalsX - 4, y - 4, contentWidth - (totalsX - margin) + 4, 11, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL DUE:', totalsX, y + 3.5);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`BDT ${invoice.amount.toFixed(0)}`, margin + contentWidth - 4, y + 3.5, { align: 'right' });
  y += 18;

  // Notes & Payment Instructions
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('NOTES & PAYMENT INSTRUCTIONS:', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const noteText = invoice.note || 'Monthly POS platform subscription fee. Thank you for partnering with MHS POS.';
  doc.text(noteText, margin, y);
  y += 4.5;
  doc.text('bKash / Nagad Personal: 01714-605024 (Reference: Shop ID or Receipt No)', margin, y);
  y += 4.5;
  doc.text('For billing inquiries or enterprise customizations, contact mhsumon670@gmail.com', margin, y);

  // Footer Signature Line
  const footerY = 270;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY, margin + contentWidth, footerY);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('MHS POS · Multi-Tenant Retail Point-of-Sale System · Automated Cloud Billing', margin, footerY + 6);
  doc.text(`Generated on ${new Date().toISOString().slice(0, 10)}`, margin + contentWidth, footerY + 6, { align: 'right' });

  // Save PDF
  doc.save(`MHS_Subscription_Invoice_${invoice.receiptNo || invoice.id}.pdf`);
}
