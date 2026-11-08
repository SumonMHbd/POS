import React, { useState } from 'react';
import { Check, Download, FileSpreadsheet, FileText, Printer, Receipt, X } from 'lucide-react';
import type { LanguageCode, PosStoreState, SaleTransaction, ShopReceiptPaperFormat } from '../types/pos';
import { formatBDT, formatPct } from '../i18n/translations';
import { AppPopupModal } from './AppPopupModal';
import { downloadA4CashMemoPdf, downloadPosReceiptPdf } from '../lib/pdfGenerator';

interface PrintableDocumentModalProps {
  mode: 'receipt' | 'audit' | null;
  receiptSale: SaleTransaction | null;
  state: PosStoreState;
  lang: LanguageCode;
  onClose: () => void;
}

export const PrintableDocumentModal: React.FC<PrintableDocumentModalProps> = ({
  mode,
  receiptSale,
  state,
  lang,
  onClose,
}) => {
  if (!mode) return null;

  // Default to shop's configured paper size ('pos_thermal' or 'a4_invoice')
  const defaultFormat: ShopReceiptPaperFormat =
    state.receiptFormat === 'a4_invoice' ? 'a4_invoice' : 'pos_thermal';
  const [selectedFormat, setSelectedFormat] = useState<ShopReceiptPaperFormat>(defaultFormat);

  const handlePrint = () => {
    try {
      window.print();
    } catch {
      // If physical print fails or printer is not connected, fallback to PDF download
      if (mode === 'receipt' && receiptSale) {
        if (selectedFormat === 'a4_invoice') {
          downloadA4CashMemoPdf({ sale: receiptSale, state });
        } else {
          downloadPosReceiptPdf({ sale: receiptSale, state });
        }
      }
    }
  };

  const handleDownloadPdf = () => {
    if (receiptSale) {
      if (selectedFormat === 'a4_invoice') {
        downloadA4CashMemoPdf({ sale: receiptSale, state });
      } else {
        downloadPosReceiptPdf({ sale: receiptSale, state });
      }
    }
  };

  if (mode === 'receipt' && receiptSale) {
    const isA4 = selectedFormat === 'a4_invoice';

    return (
      <AppPopupModal
        isOpen={true}
        onClose={onClose}
        maxWidthClass={isA4 ? 'max-w-4xl' : 'max-w-2xl'}
        heightMode="screen"
        ariaLabel={
          isA4
            ? lang === 'bn'
              ? 'এ৪ সাইজ ক্যাশ মেমো বিল (A4 Cash Memo)'
              : 'A4 Retail Cash Memo Invoice'
            : lang === 'bn'
            ? 'পস মেশিন সাইজ রশিদ (80mm POS Roll)'
            : '80mm POS Thermal Receipt'
        }
      >
        <div className="no-print shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex flex-wrap items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {isA4
                ? lang === 'bn'
                  ? 'এ৪ সাইজ ক্যাশ মেমো বিল'
                  : 'A4 Retail Cash Memo Invoice'
                : lang === 'bn'
                ? 'পস মেশিন সাইজ রশিদ'
                : 'POS 80mm Thermal Receipt'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {receiptSale.invoiceNo} · {receiptSale.date} · {receiptSale.paymentMethod}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Paper Size Format Toggle */}
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5 text-xs font-semibold shadow-xs">
              <button
                type="button"
                onClick={() => setSelectedFormat('pos_thermal')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-colors ${
                  selectedFormat === 'pos_thermal'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title={lang === 'bn' ? '৮০মিমি পস মেশিন পেপার' : '80mm POS Thermal Roll'}
              >
                <Receipt className="h-3.5 w-3.5" />
                <span>80mm POS</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('a4_invoice')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-colors ${
                  selectedFormat === 'a4_invoice'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
                title={lang === 'bn' ? 'এ৪ সাইজ ইনভয়েস পেপার' : 'Full A4 Invoice Paper'}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>A4 Paper</span>
              </button>
            </div>

            {/* Direct PDF Download Button (Formatted to active size) */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              title={
                isA4
                  ? lang === 'bn'
                    ? 'প্রফেশনাল এ৪ সাইজ PDF ডাউনলোড'
                    : 'Download Professional A4 PDF Invoice'
                  : lang === 'bn'
                  ? '৮০মিমি রোল সাইজ PDF ডাউনলোড'
                  : 'Download 80mm Thermal Roll PDF'
              }
              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{isA4 ? (lang === 'bn' ? 'A4 PDF ডাউনলোড' : 'Download A4 PDF') : (lang === 'bn' ? '80mm PDF ডাউনলোড' : 'Download 80mm PDF')}</span>
            </button>

            {/* Print Button (POS or A4) */}
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[34px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'bn' ? 'প্রিন্ট করুন' : 'Print'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100/75 dark:bg-slate-950/70 p-4 sm:p-6 flex items-start justify-center">
          {/* OPTION 1: POS 80MM THERMAL ROLL PREVIEW */}
          {!isA4 && (
            <div
              id="printable-report-area"
              className="w-full max-w-sm rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white text-slate-900 p-4 sm:p-5 font-mono text-xs shadow-md"
            >
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <div className="text-base font-bold font-display">{state.shopNameBn}</div>
                <div className="text-[11px] text-slate-600">{state.shopNameEn} — MHS POS</div>
                {state.businessType && (
                  <div className="text-[10px] text-slate-500">{state.businessType}</div>
                )}
                {(state.phone || state.address) && (
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {[state.phone, state.address].filter(Boolean).join(' · ')}
                  </div>
                )}
                <div className="mt-2 text-[11px] font-semibold text-slate-700">
                  INVOICE: {receiptSale.invoiceNo}
                </div>
                <div className="text-[10px] text-slate-500">
                  {receiptSale.date} {receiptSale.timestamp ? receiptSale.timestamp.slice(11, 16) : ''}
                </div>
                <div className="text-[10px] text-slate-500">
                  Cashier / Seller: {receiptSale.sellerName || receiptSale.cashierName || 'Staff'}
                  {receiptSale.sellerPhone ? ` · Tel: ${receiptSale.sellerPhone}` : ''} · {receiptSale.paymentMethod}
                </div>
                {(receiptSale.customerName || receiptSale.customerPhone) && (
                  <div className="mt-1 text-[11px] font-semibold text-slate-800">
                    Customer: {receiptSale.customerName || 'Walk-in'}
                    {receiptSale.customerPhone ? ` (${receiptSale.customerPhone})` : ''}
                  </div>
                )}
              </div>

              <table className="w-full mt-3 text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-[11px]">
                    <th className="py-1.5 pr-2 font-semibold leading-snug">Item</th>
                    <th className="w-10 py-1.5 px-1 text-right font-semibold whitespace-nowrap">Qty</th>
                    <th className="w-20 py-1.5 pl-2 text-right font-semibold whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptSale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-slate-100 text-[11px]">
                      <td className="py-1.5 pr-2 leading-snug break-words">{item.name}</td>
                      <td className="py-1.5 px-1 text-right tabular-nums whitespace-nowrap">{item.quantity}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">{formatBDT(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 space-y-1 border-t border-dashed border-slate-300 pt-2 text-xs tabular-nums">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatBDT(receiptSale.subtotal)}</span>
                </div>
                {receiptSale.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>-{formatBDT(receiptSale.discount)}</span>
                  </div>
                )}
                {receiptSale.serviceFee > 0 && (
                  <div className="flex justify-between">
                    <span>Servicing / Extra</span>
                    <span>+{formatBDT(receiptSale.serviceFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1">
                  <span>Grand Total</span>
                  <span>{formatBDT(receiptSale.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid</span>
                  <span>{formatBDT(receiptSale.paidAmount)}</span>
                </div>
                {receiptSale.dueAmount > 0 && (
                  <div className="flex justify-between font-semibold text-rose-700">
                    <span>Balance Due (বাকি)</span>
                    <span>{formatBDT(receiptSale.dueAmount)}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 text-center text-[11px] text-slate-500 border-t border-dashed border-slate-300 pt-2 space-y-1">
                <div>ধন্যবাদ, আবার আসবেন!</div>
                <div className="text-[9px] text-slate-400">MHS Smart Cloud Retail System</div>
                <div className="font-mono text-[10px] tracking-widest text-slate-600 mt-1">
                  ||||| ||| ||||||| |||| |||||| |||||
                </div>
                <div className="text-[9px] font-mono text-slate-400">*{receiptSale.invoiceNo}*</div>
              </div>
            </div>
          )}

          {/* OPTION 2: PROFESSIONAL FULL A4 RETAIL CASH MEMO INVOICE PREVIEW */}
          {isA4 && (
            <div
              id="printable-report-area"
              className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white text-slate-900 p-6 sm:p-8 font-sans shadow-lg text-xs leading-normal"
            >
              {/* A4 Header Letterhead */}
              <div className="border-b-2 border-emerald-500 pb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      {state.shopNameBn}
                    </h1>
                    <div className="text-sm font-semibold text-slate-700">
                      {state.shopNameEn}
                    </div>
                    {state.businessType && (
                      <div className="text-xs text-slate-500 mt-0.5">{state.businessType}</div>
                    )}
                    {(state.address || state.phone) && (
                      <div className="text-xs text-slate-600 mt-1">
                        {[state.address, state.phone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="inline-block rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                      {lang === 'bn' ? 'ক্যাশ মেমো / ইনভয়েস' : 'Cash Memo / Retail Bill'}
                    </span>
                    <div className="mt-2 text-xs font-mono font-bold text-slate-900">
                      #{receiptSale.invoiceNo}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {receiptSale.date} {receiptSale.timestamp ? receiptSale.timestamp.slice(11, 16) : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Two Balanced Info Cards */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {lang === 'bn' ? 'ক্রেতার তথ্য (Billed To)' : 'Billed To / Customer'}
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {receiptSale.customerName || (lang === 'bn' ? 'কাউন্টার কাস্টমার' : 'Walk-in Customer')}
                  </div>
                  <div className="text-xs text-slate-600">
                    Mobile: <span className="font-mono">{receiptSale.customerPhone || 'N/A'}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Sales Channel: <span className="font-semibold">{receiptSale.channel || 'Walk-in POS'}</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {lang === 'bn' ? 'বিল ও পেমেন্ট বিবরণ' : 'Payment & Register Details'}
                  </div>
                  <div className="text-xs text-slate-700">
                    Payment Method: <span className="font-bold text-slate-900">{receiptSale.paymentMethod}</span>
                  </div>
                  <div className="text-xs text-slate-700">
                    Cashier / Seller: <span className="font-medium text-slate-900">{receiptSale.sellerName || receiptSale.cashierName || 'Staff'}</span>
                    {receiptSale.sellerPhone && (
                      <span className="font-mono text-slate-500 ml-1.5">(Tel: {receiptSale.sellerPhone})</span>
                    )}
                  </div>
                  <div className="text-xs">
                    Status:{' '}
                    <span
                      className={`inline-block font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                        receiptSale.dueAmount > 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {receiptSale.dueAmount > 0
                        ? lang === 'bn'
                          ? 'বকেয়া বিল (Due)'
                          : 'Partial / Due'
                        : lang === 'bn'
                        ? 'পরিশোধিত (Paid)'
                        : 'Paid in Full'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 text-slate-700 text-[11px] font-bold border-b border-slate-200">
                      <th className="py-2 px-3 w-8">#</th>
                      <th className="py-2 px-3">{lang === 'bn' ? 'পণ্যের বিবরণ' : 'Item Description'}</th>
                      <th className="py-2 px-3">{lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'bn' ? 'পরিমাণ' : 'Qty'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'bn' ? 'দর (৳)' : 'Unit Price (৳)'}</th>
                      <th className="py-2 px-3 text-right">{lang === 'bn' ? 'মোট (৳)' : 'Total (৳)'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {receiptSale.items.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">{item.name}</td>
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{item.category || '-'}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{item.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums">{formatBDT(item.unitPrice)}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold tabular-nums">{formatBDT(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals Block */}
              <div className="mt-5 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="text-[11px] text-slate-500 space-y-1 max-w-xs">
                  <div className="font-bold text-slate-700">নিয়মাবলী ও শর্ত (Terms):</div>
                  <div>১. বিক্রিত পণ্য মেমো প্রদর্শনের মাধ্যমে ৭ দিনের মধ্যে পরিবর্তনযোগ্য।</div>
                  <div>২. কোনো নগদ অর্থ ফেরতযোগ্য নয়। মেমোটি সংরক্ষণ করুন।</div>
                </div>

                <div className="w-full sm:w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono tabular-nums">{formatBDT(receiptSale.subtotal)}</span>
                  </div>
                  {receiptSale.discount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Discount:</span>
                      <span className="font-mono tabular-nums text-rose-600">-{formatBDT(receiptSale.discount)}</span>
                    </div>
                  )}
                  {receiptSale.serviceFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Servicing / Extra:</span>
                      <span className="font-mono tabular-nums">+{formatBDT(receiptSale.serviceFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t-2 border-emerald-500 pt-2 text-emerald-900 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg">
                    <span>Grand Total:</span>
                    <span className="font-mono tabular-nums text-emerald-700">{formatBDT(receiptSale.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Paid Amount:</span>
                    <span className="font-mono tabular-nums">{formatBDT(receiptSale.paidAmount)}</span>
                  </div>
                  {receiptSale.dueAmount > 0 && (
                    <div className="flex justify-between font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded">
                      <span>Balance Due (বাকি):</span>
                      <span className="font-mono tabular-nums">{formatBDT(receiptSale.dueAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Signature Lines */}
              <div className="mt-12 pt-4 border-t border-slate-200 flex items-center justify-between text-slate-500 text-[11px]">
                <div className="text-center w-40">
                  <div className="border-t border-slate-400 pt-1">ক্রেতার স্বাক্ষর (Customer)</div>
                </div>
                <div className="text-center w-48">
                  <div className="border-t border-slate-400 pt-1">শপ সিল ও স্বাক্ষর (Authorized)</div>
                </div>
              </div>

              {/* Brand Footer */}
              <div className="mt-6 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-3">
                ধন্যবাদ, আবার আসবেন! · Powered by MHS Smart Cloud Retail POS
              </div>
            </div>
          )}
        </div>
      </AppPopupModal>
    );
  }


  // Monthly Audit-Ready Financial Report Mode
  const monthSales = state.sales.filter((s) => s.monthKey === state.selectedMonthKey);
  const totalSales = monthSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const grossProfit = monthSales.reduce((acc, s) => acc + s.grossProfit, 0);
  const opExList = state.expenses.filter(
    (e) => e.monthKey === state.selectedMonthKey && e.type === 'expense' && e.amount > 0
  );
  const totalOpEx = opExList.reduce((acc, e) => acc + e.amount, 0);
  const otherIncome = state.expenses
    .filter((e) => e.monthKey === state.selectedMonthKey && e.type === 'other_income')
    .reduce((acc, e) => acc + e.amount, 0);
  const purchases = state.expenses
    .filter((e) => e.monthKey === state.selectedMonthKey && e.type === 'inventory_purchase')
    .reduce((acc, e) => acc + e.amount, 0);
  const netProfit = grossProfit + otherIncome - totalOpEx;
  const stockValuation = state.products.reduce((acc, p) => acc + p.buyPrice * p.stock, 0);
  const totalReceivable = state.credits.reduce((acc, c) => acc + c.balanceDue, 0);

  return (
    <AppPopupModal
      isOpen={true}
      onClose={onClose}
      maxWidthClass="max-w-6xl"
      heightMode="screen"
      ariaLabel={
        lang === 'bn'
          ? 'মাসিক অডিট-রেডি আর্থিক প্রতিবেদন (PDF)'
          : 'Monthly Audit-Ready Financial Statement'
      }
    >
      <div className="no-print shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {lang === 'bn'
              ? 'মাসিক অডিট-রেডি আর্থিক প্রতিবেদন (PDF)'
              : 'Monthly Audit-Ready Financial Statement'}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-0.5">
            {lang === 'bn'
              ? 'প্রিন্ট ডায়ালগ থেকে "Save as PDF" নির্বাচন করে সংরক্ষণ করুন'
              : 'Select "Save as PDF" in browser print dialog to archive'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5 shrink-0" />
            <span>{lang === 'bn' ? 'প্রিন্ট / PDF' : 'Print / PDF'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100/75 dark:bg-slate-950/70 p-3.5 sm:p-5">
        <div
          id="printable-report-area"
          className="bg-white text-slate-900 p-4 sm:p-6 rounded-xl border border-slate-200 max-w-5xl mx-auto shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-300 pb-3">
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">
                {state.shopNameBn} — Audit Statement
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 truncate">
                {state.shopNameEn} · {state.selectedMonthKey} · {new Date().toLocaleDateString()}
              </p>
            </div>
            <div className="text-right text-[11px] sm:text-xs font-mono whitespace-nowrap">
              <div>MHS POS Audit Engine</div>
              <div className="text-slate-500">
                {state.sheetConfig.spreadsheetId
                  ? `Sheet ID: ${state.sheetConfig.spreadsheetId.slice(0, 14)}...`
                  : 'Local IndexedDB Verified'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5">
            <div className="border border-slate-200 rounded-lg p-2.5 sm:p-3 min-w-0">
              <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                মোট বিক্রি / Sales
              </div>
              <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums whitespace-nowrap">
                {formatBDT(totalSales)}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                {monthSales.length} entries
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-2.5 sm:p-3 min-w-0">
              <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                গ্রস লাভ / Gross
              </div>
              <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums whitespace-nowrap">
                {formatBDT(grossProfit)}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Margin {totalSales > 0 ? formatPct((grossProfit / totalSales) * 100) : '0.0%'}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-2.5 sm:p-3 min-w-0">
              <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                মোট খরচ / Expenses
              </div>
              <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums whitespace-nowrap">
                {formatBDT(totalOpEx)}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Other: {formatBDT(otherIncome)}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-2.5 sm:p-3 min-w-0">
              <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">
                নিট লাভ / Net Profit
              </div>
              <div className="mt-0.5 text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                {formatBDT(netProfit)}
              </div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Net {totalSales > 0 ? formatPct((netProfit / totalSales) * 100) : '0.0%'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5 leading-snug">
                পরিচালন খরচ / Operating Expense Breakdown
              </h4>
              <table className="pro-table mt-2 border border-slate-200 rounded-lg overflow-hidden">
                <tbody>
                  {opExList.map((e) => (
                    <tr key={e.id}>
                      <td className="break-words">
                        {e.categoryBn} ({e.categoryEn})
                      </td>
                      <td className="w-28 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatBDT(e.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-slate-50">
                    <td>Total Operating Expenses</td>
                    <td className="w-28 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatBDT(totalOpEx)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5 leading-snug">
                মজুদ ও পাওনা সারাংশ / Balance Sheet Snapshot
              </h4>
              <table className="pro-table mt-2 border border-slate-200 rounded-lg overflow-hidden">
                <tbody>
                  <tr>
                    <td className="break-words">
                      Closing Stock Valuation ({state.products.length} SKUs)
                    </td>
                    <td className="w-28 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatBDT(stockValuation)}
                    </td>
                  </tr>
                  <tr>
                    <td className="break-words">
                      Monthly Wholesale Purchases (মালামাল ক্রয়)
                    </td>
                    <td className="w-28 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatBDT(purchases)}
                    </td>
                  </tr>
                  <tr>
                    <td className="break-words">
                      Customer Receivables (বাকির খাতা — {state.credits.length} accounts)
                    </td>
                    <td className="w-28 text-right font-mono tabular-nums whitespace-nowrap">
                      {formatBDT(totalReceivable)}
                    </td>
                  </tr>
                  <tr>
                    <td className="break-words">Out-of-Stock / Low-Stock SKUs</td>
                    <td className="w-28 text-right font-mono tabular-nums whitespace-nowrap">
                      {state.products.filter((p) => p.stock === 0).length} Out ·{' '}
                      {state.products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length}{' '}
                      Low
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppPopupModal>
  );
};

