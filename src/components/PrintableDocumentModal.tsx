import React from 'react';
import { Printer, X } from 'lucide-react';
import type { LanguageCode, PosStoreState, SaleTransaction } from '../types/pos';
import { formatBDT, formatPct } from '../i18n/translations';
import { AppPopupModal } from './AppPopupModal';

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

  const handlePrint = () => {
    window.print();
  };

  if (mode === 'receipt' && receiptSale) {
    return (
      <AppPopupModal
        isOpen={true}
        onClose={onClose}
        maxWidthClass="max-w-3xl"
        heightMode="screen"
        ariaLabel={lang === 'bn' ? 'বিক্রির রশিদ (POS Receipt)' : 'POS Thermal Receipt'}
      >
        <div className="no-print shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {lang === 'bn' ? 'বিক্রির রশিদ (POS Receipt)' : 'POS Thermal Receipt'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {receiptSale.invoiceNo} · {receiptSale.date}
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

        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100/75 dark:bg-slate-950/70 p-4 sm:p-6 flex items-start justify-center">
          <div
            id="printable-report-area"
            className="w-full max-w-md rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white text-slate-900 p-4 sm:p-5 font-mono text-xs shadow-sm"
          >
            <div className="text-center border-b border-dashed border-slate-300 pb-3">
              <div className="text-base font-bold font-display">{state.shopNameBn}</div>
              <div className="text-[11px] text-slate-600">{state.shopNameEn} — MHS POS</div>
              <div className="mt-1 text-[11px] text-slate-500">
                Invoice: {receiptSale.invoiceNo} · {receiptSale.date}
              </div>
              <div className="text-[11px] text-slate-500">
                Cashier: {receiptSale.cashierName} · {receiptSale.paymentMethod}
              </div>
              {receiptSale.customerName && (
                <div className="mt-1 text-[11px] font-semibold">
                  Customer: {receiptSale.customerName} ({receiptSale.customerPhone || 'N/A'})
                </div>
              )}
            </div>

            <table className="w-full mt-3 text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-[11px]">
                  <th className="py-1.5 pr-2 font-semibold leading-snug">Item</th>
                  <th className="w-12 py-1.5 px-1.5 text-right font-semibold whitespace-nowrap">Qty</th>
                  <th className="w-24 py-1.5 pl-2 text-right font-semibold whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody>
                {receiptSale.items.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 leading-snug break-words">{item.name}</td>
                    <td className="py-1.5 px-1.5 text-right tabular-nums whitespace-nowrap">{item.quantity}</td>
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
                <div className="flex justify-between font-semibold text-red-700">
                  <span>Balance Due (বাকি)</span>
                  <span>{formatBDT(receiptSale.dueAmount)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 text-center text-[11px] text-slate-500 border-t border-dashed border-slate-300 pt-2">
              ধন্যবাদ, আবার আসবেন! · Synced with Google Sheets
            </div>
          </div>
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

