import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Download,
  Printer,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  PaymentMethod,
  type LanguageCode,
  type Product,
  type SaleTransaction,
  type ShopCategoryItem,
} from '../types/pos';
import {
  DEFAULT_SHOP_CATEGORIES,
  formatBDT,
  translateCategory,
} from '../i18n/translations';
import { exportSalesHistoryCsv } from '../lib/exportReports';

interface SalesHistoryViewProps {
  sales: SaleTransaction[];
  products: Product[];
  categories: ShopCategoryItem[];
  lang: LanguageCode;
  onPrintReceipt: (sale: SaleTransaction) => void;
}

function localizePaymentMethod(method: PaymentMethod, lang: LanguageCode): string {
  if (lang === 'en') {
    if (method === PaymentMethod.CREDIT) return 'Credit (Due)';
    return method;
  }
  switch (method) {
    case PaymentMethod.CASH:
      return 'নগদ (Cash)';
    case PaymentMethod.MOBILE_BANKING:
      return 'বিকাশ / নগদ';
    case PaymentMethod.CREDIT:
      return 'বাকি (Due)';
    case PaymentMethod.CARD:
      return 'কার্ড / ব্যাংক';
    default:
      return method;
  }
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({
  sales,
  products,
  categories,
  lang,
  onPrintReceipt,
}) => {
  const activeCategories =
    categories && categories.length > 0 ? categories : DEFAULT_SHOP_CATEGORIES;

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [visibleLimit, setVisibleLimit] = useState<number>(250);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const filteredAndSortedSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = sales.filter((sale) => {
      if (fromDate && sale.date < fromDate) return false;
      if (toDate && sale.date > toDate) return false;

      if (paymentFilter === 'DUE_ONLY') {
        if (sale.dueAmount <= 0) return false;
      } else if (paymentFilter !== 'ALL') {
        if (sale.paymentMethod !== paymentFilter) return false;
      }

      if (categoryFilter !== 'ALL') {
        const hasCat = sale.items.some((item) => item.category === categoryFilter);
        if (!hasCat) return false;
      }

      if (q) {
        const custMatch =
          (sale.customerName || '').toLowerCase().includes(q) ||
          (sale.customerPhone || '').toLowerCase().includes(q);
        const invMatch = sale.invoiceNo.toLowerCase().includes(q) || sale.date.includes(q);
        const itemMatch = sale.items.some((item) => {
          const catalogProd = productMap.get(item.productId);
          return (
            item.name.toLowerCase().includes(q) ||
            (catalogProd?.nameBn || '').toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q) ||
            translateCategory(item.category, 'en', activeCategories).toLowerCase().includes(q) ||
            item.sku.toLowerCase().includes(q)
          );
        });
        if (!custMatch && !invMatch && !itemMatch) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [
    sales,
    searchQuery,
    categoryFilter,
    paymentFilter,
    fromDate,
    toDate,
    sortDirection,
    productMap,
    activeCategories,
  ]);

  const summary = useMemo(() => {
    let totalUnits = 0;
    let totalBill = 0;
    let totalDiscount = 0;
    let totalDueBill = 0;
    let dueCount = 0;

    for (const s of filteredAndSortedSales) {
      totalBill += s.totalAmount;
      totalDiscount += s.discount || 0;
      if (s.dueAmount > 0) {
        totalDueBill += s.dueAmount;
        dueCount += 1;
      }
      for (const item of s.items) {
        totalUnits += item.quantity;
      }
    }

    return {
      count: filteredAndSortedSales.length,
      totalUnits,
      totalBill,
      totalDiscount,
      totalDueBill,
      dueCount,
    };
  }, [filteredAndSortedSales]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    categoryFilter !== 'ALL' ||
    paymentFilter !== 'ALL' ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setPaymentFilter('ALL');
    setFromDate('');
    setToDate('');
  };

  const displayedSales = filteredAndSortedSales.slice(0, visibleLimit);

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="neu-box rounded-2xl border border-teal-200/80 dark:border-teal-900/50 bg-teal-50/55 dark:bg-teal-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold leading-snug text-teal-900/80 dark:text-teal-300">
            {lang === 'bn' ? 'মোট বিক্রির রেকর্ড' : 'Total Sales Bills'}
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-teal-700 dark:text-teal-400 whitespace-nowrap">
            {summary.count.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            {lang === 'bn'
              ? `মোট বিক্রিত পণ্য: ${summary.totalUnits.toLocaleString('en-US')} টি`
              : `Total Units Sold: ${summary.totalUnits.toLocaleString('en-US')}`}
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/55 dark:bg-emerald-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold leading-snug text-emerald-900/80 dark:text-emerald-300">
            {lang === 'bn' ? 'সর্বমোট বিল (Total Bill)' : 'Total Bill Amount'}
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
            {formatBDT(summary.totalBill)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400">
            {lang === 'bn'
              ? 'তারিখ অনুযায়ী সকল বিক্রির যোগফল'
              : 'Cumulative sales bill across records'}
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/55 dark:bg-amber-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold leading-snug text-amber-900/80 dark:text-amber-300">
            {lang === 'bn' ? 'মোট ডিসকাউন্ট ছাড়' : 'Total Discount Given'}
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">
            {formatBDT(summary.totalDiscount)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400">
            {lang === 'bn' ? 'ক্যাশ মেমোতে প্রদত্ত ছাড়' : 'Total promotional & bill discounts'}
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/55 dark:bg-rose-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold leading-snug text-rose-900/80 dark:text-rose-300">
            {lang === 'bn' ? 'মোট বাকি বিল (Due Bill)' : 'Total Due Bill Amount'}
          </div>
          <div className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">
            {formatBDT(summary.totalDueBill)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400 font-mono tabular-nums">
            {lang === 'bn'
              ? `বাকিতে বিক্রির বিল: ${summary.dueCount} টি`
              : `Credit sales invoices: ${summary.dueCount}`}
          </div>
        </div>
      </div>

      {/* Main Sales History Ledger Container */}
      <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header & Actions */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
              {lang === 'bn'
                ? 'বিক্রয় ইতিহাস — তারিখ অনুযায়ী সম্পূর্ণ তালিকা (Sales History)'
                : 'Sales History — Chronological Full Ledger'}
            </h2>
            <p className="text-[11px] sm:text-xs leading-snug text-slate-500 mt-0.5">
              {lang === 'bn'
                ? 'সকল বিক্রির তথ্য তারিখ অনুযায়ী (পুরাতন থেকে নতুন) সাজানো এবং গুগল শিটের "Sales History" ট্যাবে স্বয়ংক্রিয়ভাবে সংরক্ষিত'
                : 'Ordered by date ascending with full product, category, payment, discount, customer & due bill details — synced to Google Sheet "Sales History" tab'}
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-0.5">
            <button
              type="button"
              onClick={() => setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="min-h-[36px] sm:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <ArrowDownUp className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
              <span>
                {sortDirection === 'asc'
                  ? lang === 'bn'
                    ? 'তারিখ: পুরাতন → নতুন'
                    : 'Date: Ascending'
                  : lang === 'bn'
                  ? 'তারিখ: নতুন → পুরাতন'
                  : 'Date: Descending'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => exportSalesHistoryCsv(filteredAndSortedSales, activeCategories)}
              className="min-h-[36px] sm:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'bn' ? 'CSV ডাউনলোড' : 'Export CSV'}</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 items-end">
          <div className="sm:col-span-2 lg:col-span-4 min-w-0">
            <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate whitespace-nowrap">
              {lang === 'bn' ? 'পণ্য, ক্রেতা বা ইনভয়েস খুঁজুন' : 'Search Product, Customer or Invoice'}
            </label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'পণ্যের নাম, ক্রেতার নাম বা ইনভয়েস...'
                    : 'Product, customer, phone, invoice...'
                }
                className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs"
              />
            </div>
          </div>

          <div className="lg:col-span-2 min-w-0">
            <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate whitespace-nowrap">
              {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
            >
              <option value="ALL">{lang === 'bn' ? 'সব ক্যাটাগরি' : 'All Categories'}</option>
              {activeCategories.map((cat) => (
                <option key={cat.id} value={cat.bn}>
                  {lang === 'bn' ? cat.bn : cat.en}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2 min-w-0">
            <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate whitespace-nowrap">
              {lang === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
            >
              <option value="ALL">{lang === 'bn' ? 'সব পেমেন্ট' : 'All Payments'}</option>
              <option value="DUE_ONLY">{lang === 'bn' ? 'শুধু বাকি বিল (Due)' : 'Only Due Bills'}</option>
              <option value={PaymentMethod.CASH}>
                {lang === 'bn' ? 'নগদ (Cash)' : 'Cash'}
              </option>
              <option value={PaymentMethod.MOBILE_BANKING}>
                {lang === 'bn' ? 'বিকাশ / নগদ' : 'bKash / Nagad'}
              </option>
              <option value={PaymentMethod.CREDIT}>
                {lang === 'bn' ? 'বাকি (Credit)' : 'Credit (Due)'}
              </option>
              <option value={PaymentMethod.CARD}>
                {lang === 'bn' ? 'কার্ড / ব্যাংক' : 'Card / Bank'}
              </option>
            </select>
          </div>

          <div className="lg:col-span-2 min-w-0">
            <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate whitespace-nowrap">
              {lang === 'bn' ? 'শুরুর তারিখ' : 'From Date'}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
            />
          </div>

          <div className="lg:col-span-2 flex items-end gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-slate-500 mb-1 truncate whitespace-nowrap">
                {lang === 'bn' ? 'শেষ তারিখ' : 'To Date'}
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                title={lang === 'bn' ? 'ফিল্টার মুছুন' : 'Reset filters'}
                className="min-h-[38px] px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Full-Details Sales History Table */}
        {filteredAndSortedSales.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">
            {lang === 'bn'
              ? 'কোনো বিক্রির তথ্য পাওয়া যায়নি। নতুন বিক্রি সম্পন্ন করলে এখানে তারিখ অনুযায়ী যুক্ত হবে।'
              : 'No sales history records match the current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="pro-table">
              <thead>
                <tr>
                  <th className="w-8 text-left whitespace-nowrap">#</th>
                  <th className="w-28 text-left whitespace-nowrap">
                    {lang === 'bn' ? 'তারিখ' : 'Date'}
                  </th>
                  <th className="min-w-[145px] text-left">
                    {lang === 'bn' ? 'পণ্যের নাম' : 'Product Name'}
                  </th>
                  <th className="w-28 text-left whitespace-nowrap">
                    {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                  </th>
                  <th className="w-14 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'পরিমাণ' : 'Qty'}
                  </th>
                  <th className="w-28 text-left whitespace-nowrap">
                    {lang === 'bn' ? 'পেমেন্ট' : 'Payment'}
                  </th>
                  <th className="w-20 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'ডিসকাউন্ট' : 'Discount'}
                  </th>
                  <th className="w-24 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'মোট বিল' : 'Total Bill'}
                  </th>
                  <th className="w-36 min-w-[115px] text-left">
                    {lang === 'bn' ? 'ক্রেতার নাম' : 'Customer'}
                  </th>
                  <th className="w-24 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'বাকি বিল' : 'Due Bill'}
                  </th>
                  <th className="w-px text-right whitespace-nowrap">
                    {lang === 'bn' ? 'রশিদ' : 'Memo'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedSales.map((sale, idx) => {
                  const totalQty = sale.items.reduce((acc, item) => acc + item.quantity, 0);
                  const uniqueCategories = Array.from(
                    new Set(
                      sale.items.map((item) =>
                        translateCategory(item.category, lang, activeCategories)
                      )
                    )
                  );

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-slate-50/75 dark:hover:bg-slate-800/40"
                    >
                      <td className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        {idx + 1}
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap">
                        <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {sale.date}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {sale.invoiceNo}
                        </div>
                      </td>

                      {/* Product Name */}
                      <td>
                        <div className="space-y-0.5">
                          {sale.items.map((item, itemIdx) => {
                            const catalogProd = productMap.get(item.productId);
                            const displayName =
                              lang === 'bn'
                                ? catalogProd?.nameBn || item.name
                                : catalogProd?.name || item.name;
                            return (
                              <div
                                key={`${sale.id}-item-${itemIdx}`}
                                className="font-medium text-slate-900 dark:text-slate-100 break-words"
                              >
                                {displayName}
                                {sale.items.length > 1 && (
                                  <span className="ml-1 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                                    ×{item.quantity}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="text-slate-600 dark:text-slate-300">
                        {uniqueCategories.join(' · ')}
                      </td>

                      {/* Quantity */}
                      <td className="text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {totalQty}
                      </td>

                      {/* Payment Method */}
                      <td className="whitespace-nowrap">
                        <span
                          className={
                            sale.dueAmount > 0
                              ? 'font-semibold text-amber-700 dark:text-amber-400'
                              : 'text-slate-700 dark:text-slate-300'
                          }
                        >
                          {localizePaymentMethod(sale.paymentMethod, lang)}
                        </span>
                      </td>

                      {/* Discount */}
                      <td className="text-right font-mono tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {sale.discount > 0 ? formatBDT(sale.discount) : '৳0'}
                      </td>

                      {/* Total Bill */}
                      <td className="text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatBDT(sale.totalAmount)}
                      </td>

                      {/* Customer Name */}
                      <td>
                        {sale.customerName ? (
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                              {sale.customerName}
                            </div>
                            {sale.customerPhone && (
                              <div className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap">
                                {sale.customerPhone}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {lang === 'bn' ? 'নগদ ক্রেতা' : 'Walk-in'}
                          </span>
                        )}
                      </td>

                      {/* Due Bill Amount */}
                      <td className="text-right font-mono tabular-nums whitespace-nowrap">
                        {sale.dueAmount > 0 ? (
                          <div>
                            <div className="font-bold text-rose-700 dark:text-rose-400">
                              {formatBDT(sale.dueAmount)}
                            </div>
                            {sale.paidAmount > 0 && (
                              <div className="text-[10px] text-emerald-700 dark:text-emerald-400">
                                {lang === 'bn' ? 'জমা:' : 'Paid:'} {formatBDT(sale.paidAmount)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Print Receipt */}
                      <td className="text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onPrintReceipt(sale)}
                          title={lang === 'bn' ? 'ক্যাশ মেমো প্রিন্ট করুন' : 'View / Print Receipt'}
                          className="min-h-[30px] inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
                        >
                          <Printer className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden xl:inline">
                            {lang === 'bn' ? 'রশিদ' : 'Print'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredAndSortedSales.length > visibleLimit && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit((prev) => prev + 250)}
                  className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap"
                >
                  {lang === 'bn'
                    ? `আরও দেখুন (${filteredAndSortedSales.length - visibleLimit} টি বাকি)`
                    : `Load More (${filteredAndSortedSales.length - visibleLimit} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
