import type {
  CreditHistoryEntry,
  CustomerCredit,
  ExpenseEntry,
  PosStoreState,
  Product,
  SaleTransaction,
  ShopCategoryItem,
  ShopTenantSummary,
  SubscriptionInvoiceRecord,
} from '../types/pos';

function escapeCsvCell(val: string | number | boolean | null | undefined): string {
  if (val == null) return '';
  if (typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  let s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadUtf8Csv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): void {
  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(',')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSalesCsv(sales: SaleTransaction[], monthKey: string): void {
  downloadUtf8Csv(
    `MHS_POS_Sales_${monthKey}.csv`,
    ['Invoice No', 'Date', 'Channel', 'Payment Method', 'Items', 'Total (BDT)', 'Gross Profit (BDT)', 'Paid (BDT)', 'Due (BDT)', 'Customer', 'Cashier'],
    sales.map((s) => [
      s.invoiceNo,
      s.date,
      s.channel,
      s.paymentMethod,
      s.items.map((i) => `${i.name} x${i.quantity}`).join('; '),
      s.totalAmount,
      s.grossProfit,
      s.paidAmount,
      s.dueAmount,
      s.customerName || 'Walk-in',
      s.cashierName,
    ])
  );
}

export function exportInventoryCsv(products: Product[]): void {
  downloadUtf8Csv(
    `MHS_POS_Inventory_Valuation.csv`,
    ['SKU', 'Product Name', 'Category (BN)', 'Category (EN)', 'Buy Price (BDT)', 'Sell Price (BDT)', 'Current Stock', 'Min Stock', 'Unit', 'Stock Value (BDT)', 'Status'],
    products.map((p) => [
      p.sku,
      p.name,
      p.category,
      p.categoryEn,
      p.buyPrice,
      p.sellPrice,
      p.stock,
      p.minStock,
      p.unit,
      p.buyPrice * p.stock,
      p.stock === 0 ? 'OUT_OF_STOCK' : p.stock <= p.minStock ? 'LOW_STOCK' : 'IN_STOCK',
    ])
  );
}

export function exportSalesHistoryCsv(
  sales: SaleTransaction[],
  categories?: ShopCategoryItem[]
): void {
  const sortedAsc = [...sales].sort(
    (a, b) => a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp)
  );
  const resolveCat = (catBn: string) => {
    if (!categories || categories.length === 0) return catBn;
    const found = categories.find((c) => c.bn === catBn || c.en === catBn);
    return found ? `${found.bn} (${found.en})` : catBn;
  };

  downloadUtf8Csv(
    `MHS_POS_Sales_History_${new Date().toISOString().slice(0, 10)}.csv`,
    [
      'Date',
      'Invoice No',
      'Product Name',
      'Category',
      'Quantity',
      'Payment Method',
      'Discount (BDT)',
      'Total Bill (BDT)',
      'Customer Name',
      'Due Bill Amount (BDT)',
    ],
    sortedAsc.map((s) => [
      s.date,
      s.invoiceNo,
      s.items.map((i) => (s.items.length > 1 ? `${i.name} (x${i.quantity})` : i.name)).join(', '),
      Array.from(new Set(s.items.map((i) => resolveCat(i.category)))).join(', '),
      s.items.reduce((sum, i) => sum + i.quantity, 0),
      s.paymentMethod,
      s.discount || 0,
      s.totalAmount,
      s.customerName || 'Walk-in Customer',
      s.dueAmount > 0 ? s.dueAmount : '',
    ])
  );
}

export function exportCreditsCsv(credits: CustomerCredit[]): void {
  downloadUtf8Csv(
    `MHS_POS_Credit_Ledger_Bakir_Khata.csv`,
    ['Customer Name (BN)', 'Customer Name (EN)', 'Mobile', 'Total Credit (BDT)', 'Total Paid (BDT)', 'Balance Due (BDT)', 'Due Date', 'Overdue'],
    credits.map((c) => [
      c.name,
      c.nameEn,
      c.phone,
      c.totalCreditSales,
      c.totalPaid,
      c.balanceDue,
      c.dueDate,
      c.isOverdue ? 'OVERDUE' : 'CURRENT',
    ])
  );
}

export function exportDueHistoryCsv(entries: CreditHistoryEntry[]): void {
  const sortedAsc = [...entries].sort(
    (a, b) => a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp)
  );
  downloadUtf8Csv(
    `MHS_POS_Due_Payment_History_${new Date().toISOString().slice(0, 10)}.csv`,
    [
      'Date',
      'Customer Name',
      'Mobile',
      'Transaction Type',
      'Previous Due (BDT)',
      'New Due Added (BDT)',
      'Paid Amount (BDT)',
      'Remaining Due (BDT)',
      'Payment Method / Reference',
    ],
    sortedAsc.map((h) => [
      h.date,
      h.customerName,
      h.customerPhone,
      h.type === 'due_payment'
        ? 'Due Payment Received'
        : h.type === 'opening_due'
        ? 'Previous / Opening Due'
        : 'New Credit Sale Due',
      h.previousDue,
      h.creditAdded > 0 ? h.creditAdded : '',
      h.paidAmount > 0 ? h.paidAmount : '',
      h.balanceAfter,
      [h.paymentMethod, h.invoiceNo, h.note].filter(Boolean).join(' · '),
    ])
  );
}

export function exportExpensesCsv(expenses: ExpenseEntry[], monthKey: string): void {
  downloadUtf8Csv(
    `MHS_POS_Expenses_${monthKey}.csv`,
    ['Category (BN)', 'Category (EN)', 'Type', 'Amount (BDT)', 'Date', 'Note', 'Recorded By'],
    expenses.map((e) => [
      e.categoryBn,
      e.categoryEn,
      e.type,
      e.amount,
      e.date,
      e.note,
      e.recordedBy,
    ])
  );
}

export interface MonthlyCostCsvRow {
  monthKey: string;
  monthLabel: string;
  operatingCost: number;
  stockPurchaseCost: number;
  totalCost: number;
  monthlySales: number;
  opExSharePct: number | null;
  entriesCount: number;
  majorHeadsSummary: string;
}

export function exportMonthlyCostSummaryCsv(rows: MonthlyCostCsvRow[]): void {
  downloadUtf8Csv(
    `MHS_POS_Monthly_Cost_Summary_${new Date().toISOString().slice(0, 10)}.csv`,
    [
      'Month Key',
      'Month',
      'Operating Cost (BDT)',
      'Stock Purchase Cost (BDT)',
      'Total Monthly Cost (BDT)',
      'Monthly Sales (BDT)',
      'OpEx % of Sales',
      'Cost Entries',
      'Major Cost Heads',
    ],
    rows.map((r) => [
      r.monthKey,
      r.monthLabel,
      r.operatingCost,
      r.stockPurchaseCost,
      r.totalCost,
      r.monthlySales,
      r.opExSharePct !== null ? `${r.opExSharePct.toFixed(1)}%` : '',
      r.entriesCount,
      r.majorHeadsSummary,
    ])
  );
}

export function exportMonthlyAuditCsv(state: PosStoreState): void {
  const monthSales = state.sales.filter((s) => s.monthKey === state.selectedMonthKey);
  const totalSales = monthSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const grossProfit = monthSales.reduce((acc, s) => acc + s.grossProfit, 0);
  const opEx = state.expenses
    .filter((e) => e.monthKey === state.selectedMonthKey && e.type === 'expense')
    .reduce((acc, e) => acc + e.amount, 0);
  const otherInc = state.expenses
    .filter((e) => e.monthKey === state.selectedMonthKey && e.type === 'other_income')
    .reduce((acc, e) => acc + e.amount, 0);
  const purchases = state.expenses
    .filter((e) => e.monthKey === state.selectedMonthKey && e.type === 'inventory_purchase')
    .reduce((acc, e) => acc + e.amount, 0);
  const netProfit = grossProfit + otherInc - opEx;
  const stockValue = state.products.reduce((acc, p) => acc + p.buyPrice * p.stock, 0);
  const totalReceivable = state.credits.reduce((acc, c) => acc + c.balanceDue, 0);

  downloadUtf8Csv(
    `MHS_POS_Monthly_Audit_${state.selectedMonthKey}.csv`,
    ['Audit Section', 'Metric (BN)', 'Metric (EN)', 'Value (BDT / Count)'],
    [
      ['Shop Info', state.shopNameBn, state.shopNameEn, state.selectedMonthKey],
      ['Revenue', 'মোট বিক্রি', 'Total Sales Revenue', totalSales],
      ['Revenue', 'বিক্রির এন্ট্রি সংখ্যা', 'Sales Transaction Count', monthSales.length],
      ['Profit', 'মোট গ্রস লাভ', 'Gross Profit', grossProfit],
      ['Income', 'অন্যান্য আয় (সার্ভিসিং)', 'Servicing & Other Income', otherInc],
      ['Expenses', 'মোট পরিচালন খরচ', 'Operating Expenses', opEx],
      ['Profit', 'নিট লাভ', 'Net Profit', netProfit],
      ['Inventory', 'মালামাল ক্রয় (এই মাসে)', 'Monthly Stock Purchases', purchases],
      ['Inventory', 'বর্তমান স্টকের ক্রয়মূল্য', 'Closing Inventory Value', stockValue],
      ['Receivables', 'মোট বাকি পাওনা', 'Total Customer Dues', totalReceivable],
    ]
  );
}

export function exportSuperAdminShopsSummaryCsv(shops: ShopTenantSummary[]): void {
  downloadUtf8Csv(
    `MHS_POS_All_Shops_Summary_${new Date().toISOString().slice(0, 10)}.csv`,
    [
      'Shop ID',
      'Shop Name (BN)',
      'Shop Name (EN)',
      'Business Type',
      'Owner Name',
      'Owner Email',
      'Phone',
      'Status',
      'Plan',
      'Monthly Fee (BDT)',
      'Billing Status',
      'SKUs',
      'Stock Value (BDT)',
      'Monthly Sales (BDT)',
      'Monthly Gross Profit (BDT)',
      'Monthly Net Profit (BDT)',
      'Receivable Due (BDT)',
      'Staff Count',
      'Google Sheet Title',
      'Google Sheet URL',
    ],
    shops.map((s) => [
      s.shopId,
      s.shopNameBn,
      s.shopNameEn,
      s.businessType,
      s.ownerName,
      s.ownerEmail,
      s.phone,
      s.status,
      s.plan,
      s.monthlySubscriptionFee,
      s.billingStatus,
      s.metrics.skuCount,
      s.metrics.stockValue,
      s.metrics.monthlySales,
      s.metrics.monthlyGrossProfit,
      s.metrics.monthlyNetProfit,
      s.metrics.totalReceivable,
      s.metrics.staffCount,
      s.sheetConfig.spreadsheetTitle,
      s.sheetConfig.spreadsheetUrl || 'Pending Connection',
    ])
  );
}

export function exportSuperAdminSubscriptionsCsv(invoices: SubscriptionInvoiceRecord[]): void {
  downloadUtf8Csv(
    `MHS_POS_Monthly_Subscriptions_${new Date().toISOString().slice(0, 10)}.csv`,
    [
      'Invoice / Receipt No',
      'Month',
      'Shop Name (BN)',
      'Shop Name (EN)',
      'Owner Email',
      'Plan',
      'Subscription Fee (BDT)',
      'Payment Status',
      'Due Date',
      'Paid At',
      'Payment Method',
      'Notes',
    ],
    invoices.map((inv) => [
      inv.receiptNo || inv.id,
      inv.monthKey,
      inv.shopNameBn,
      inv.shopNameEn,
      inv.ownerEmail,
      inv.plan,
      inv.amount,
      inv.status,
      inv.dueDate,
      inv.paidAt || '',
      inv.paymentMethod || '',
      inv.note || '',
    ])
  );
}
