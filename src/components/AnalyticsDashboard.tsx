import React, { useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  Coins,
  Download,
  FileSpreadsheet,
  Filter,
  GripVertical,
  Package,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  Truck,
  Upload,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import {
  PaymentMethod,
  SalesChannel,
  UserRole,
  type ActiveFilterChip,
  type LanguageCode,
  type PosStoreState,
  type StaffDashboardPermissions,
  type WorkspaceTab,
} from '../types/pos';
import {
  DEFAULT_SHOP_CATEGORIES,
  formatBDT,
  formatPct,
  translateCategory,
  UI_TEXT,
} from '../i18n/translations';
import { exportMonthlyAuditCsv, exportSalesCsv } from '../lib/exportReports';

interface AnalyticsDashboardProps {
  state: PosStoreState;
  lang: LanguageCode;
  activeRole: UserRole;
  permissions?: StaffDashboardPermissions;
  onNavigateTab: (tab: WorkspaceTab) => void;
  onOpenAuditPrint: () => void;
  onReloadUploadedCsv: (customCsvText?: string) => void;
  onChangeMonth: (monthKey: string) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  state,
  lang,
  activeRole,
  permissions,
  onNavigateTab,
  onOpenAuditPrint,
  onReloadUploadedCsv,
  onChangeMonth,
}) => {
  const t = UI_TEXT[lang];
  const canViewFinancials = permissions
    ? permissions.canViewProfit
    : activeRole === UserRole.OWNER ||
      activeRole === UserRole.SUPER_ADMIN ||
      activeRole === UserRole.MANAGER;

  const activeCategories =
    state.categories && state.categories.length > 0 ? state.categories : DEFAULT_SHOP_CATEGORIES;

  const [activeFilters, setActiveFilters] = useState<ActiveFilterChip[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectableMonths = useMemo(() => {
    const set = new Set<string>([
      state.selectedMonthKey,
      new Date().toISOString().slice(0, 7),
      '2026-10',
      '2026-11',
    ]);
    for (const s of state.sales) set.add(s.monthKey);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [state.selectedMonthKey, state.sales]);

  const availableChips: ActiveFilterChip[] = useMemo(() => {
    const catChips: ActiveFilterChip[] = activeCategories.map((c) => ({
      id: `cat:${c.bn}`,
      dimension: 'category',
      value: c.bn,
      labelBn: c.bn,
      labelEn: c.en,
    }));

    const paymentChips: ActiveFilterChip[] = [
      {
        id: 'pay:Cash',
        dimension: 'payment',
        value: PaymentMethod.CASH,
        labelBn: 'নগদ (Cash)',
        labelEn: 'Cash',
      },
      {
        id: 'pay:Mobile',
        dimension: 'payment',
        value: PaymentMethod.MOBILE_BANKING,
        labelBn: 'বিকাশ / নগদ',
        labelEn: 'bKash / Nagad',
      },
      {
        id: 'pay:Credit',
        dimension: 'payment',
        value: PaymentMethod.CREDIT,
        labelBn: 'বাকিতে বিক্রি',
        labelEn: 'Credit (Due)',
      },
    ];

    const channelChips: ActiveFilterChip[] = [
      {
        id: 'ch:Walk-in POS',
        dimension: 'channel',
        value: SalesChannel.WALK_IN,
        labelBn: 'দোকান কাউন্টার',
        labelEn: 'Walk-in POS',
      },
      {
        id: 'ch:Shopify',
        dimension: 'channel',
        value: SalesChannel.SHOPIFY,
        labelBn: 'Shopify',
        labelEn: 'Shopify',
      },
      {
        id: 'ch:WooCommerce',
        dimension: 'channel',
        value: SalesChannel.WOOCOMMERCE,
        labelBn: 'WooCommerce',
        labelEn: 'WooCommerce',
      },
    ];

    return [...catChips, ...paymentChips, ...channelChips];
  }, [activeCategories]);

  const toggleFilterChip = (chip: ActiveFilterChip) => {
    setActiveFilters((prev) => {
      const exists = prev.some((c) => c.id === chip.id);
      if (exists) return prev.filter((c) => c.id !== chip.id);
      return [...prev, chip];
    });
  };

  const handleDragStart = (e: React.DragEvent, chip: ActiveFilterChip) => {
    e.dataTransfer.setData('application/json', JSON.stringify(chip));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const chip = JSON.parse(raw) as ActiveFilterChip;
      setActiveFilters((prev) => (prev.some((c) => c.id === chip.id) ? prev : [...prev, chip]));
    } catch {
      // ignore invalid drag payload
    }
  };

  const filteredSales = useMemo(() => {
    const catValues = activeFilters.filter((f) => f.dimension === 'category').map((f) => f.value);
    const chanValues = activeFilters.filter((f) => f.dimension === 'channel').map((f) => f.value);
    const payValues = activeFilters.filter((f) => f.dimension === 'payment').map((f) => f.value);

    return state.sales.filter((sale) => {
      if (sale.monthKey !== state.selectedMonthKey) return false;
      if (chanValues.length > 0 && !chanValues.includes(sale.channel)) return false;
      if (payValues.length > 0 && !payValues.includes(sale.paymentMethod)) return false;
      if (catValues.length > 0) {
        const hasCat = sale.items.some((it) => catValues.includes(it.category));
        if (!hasCat) return false;
      }
      return true;
    });
  }, [state.sales, state.selectedMonthKey, activeFilters]);

  const filteredProducts = useMemo(() => {
    const catValues = activeFilters.filter((f) => f.dimension === 'category').map((f) => f.value);
    if (catValues.length === 0) return state.products;
    return state.products.filter((p) => catValues.includes(p.category));
  }, [state.products, activeFilters]);

  const metrics = useMemo(() => {
    const catValues = activeFilters.filter((f) => f.dimension === 'category').map((f) => f.value);

    let totalSales = 0;
    let grossProfit = 0;
    let creditSales = 0;

    for (const s of filteredSales) {
      if (catValues.length > 0) {
        for (const it of s.items) {
          if (catValues.includes(it.category)) {
            totalSales += it.subtotal;
            grossProfit += it.profit;
          }
        }
      } else {
        totalSales += s.totalAmount;
        grossProfit += s.grossProfit;
      }
      if (s.dueAmount > 0) {
        creditSales += s.dueAmount;
      }
    }

    const monthExpenses = state.expenses.filter((e) => e.monthKey === state.selectedMonthKey);
    const totalOpEx = monthExpenses
      .filter((e) => e.type === 'expense')
      .reduce((acc, e) => acc + e.amount, 0);
    const otherIncome = monthExpenses
      .filter((e) => e.type === 'other_income')
      .reduce((acc, e) => acc + e.amount, 0);

    const netProfit =
      activeFilters.length > 0 ? grossProfit : grossProfit + otherIncome - totalOpEx;

    const todayIso = new Date().toISOString().slice(0, 10);
    const todaySales = state.sales
      .filter((s) => s.date === todayIso)
      .reduce((acc, s) => acc + s.totalAmount, 0);

    const totalReceivable = state.credits.reduce((acc, c) => acc + c.balanceDue, 0);
    const stockValue = filteredProducts.reduce((acc, p) => acc + p.buyPrice * p.stock, 0);
    const outOfStockCount = filteredProducts.filter((p) => p.stock === 0).length;
    const lowStockCount = filteredProducts.filter(
      (p) => p.stock > 0 && p.stock <= p.minStock
    ).length;

    const byDate = new Map<
      string,
      { date: string; dayShort: string; sales: number; profit: number }
    >();
    for (const s of filteredSales) {
      const prev = byDate.get(s.date) || {
        date: s.date,
        dayShort: s.date.slice(5),
        sales: 0,
        profit: 0,
      };
      prev.sales += s.totalAmount;
      prev.profit += s.grossProfit;
      byDate.set(s.date, prev);
    }

    const dailySeries = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    const activeDays = dailySeries.filter((d) => d.sales > 0);
    const avgDaily = activeDays.length > 0 ? Math.round(totalSales / activeDays.length) : 0;

    return {
      totalSales,
      grossProfit,
      totalOpEx,
      otherIncome,
      netProfit,
      creditSales,
      todaySales,
      totalReceivable,
      stockValue,
      outOfStockCount,
      lowStockCount,
      dailySeries,
      avgDaily,
    };
  }, [
    filteredSales,
    filteredProducts,
    state.expenses,
    state.credits,
    state.sales,
    state.selectedMonthKey,
    activeFilters,
  ]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { categoryBn: string; label: string; sales: number; profit: number }
    >();
    for (const s of filteredSales) {
      for (const it of s.items) {
        const cur = map.get(it.category) || {
          categoryBn: it.category,
          label: translateCategory(it.category, lang, activeCategories),
          sales: 0,
          profit: 0,
        };
        cur.sales += it.subtotal;
        cur.profit += it.profit;
        map.set(it.category, cur);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
  }, [filteredSales, lang, activeCategories]);

  const topSellingProducts = useMemo(() => {
    return [...filteredProducts]
      .sort((a, b) => b.soldThisMonth - a.soldThisMonth)
      .slice(0, 5);
  }, [filteredProducts]);

  const recentSales = useMemo(() => {
    return [...filteredSales].slice(0, 5);
  }, [filteredSales]);

  const shippingMetrics = useMemo(() => {
    const orders = state.ecommerceOrders;
    const total = orders.length;
    const onTimeCount = orders.filter((o) => o.onTime).length;
    const onTimePct = total > 0 ? (onTimeCount / total) * 100 : 100;
    const avgHours =
      total > 0 ? orders.reduce((acc, o) => acc + o.dispatchHours, 0) / total : 0;

    return {
      total,
      onTimePct,
      avgHours,
    };
  }, [state.ecommerceOrders]);

  const handleCustomCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onReloadUploadedCsv(reader.result);
      }
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      {/* 1. Shop Owner 1-Click Daily Quick Actions + Month & Export Bar */}
      <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => onNavigateTab('pos')}
            className="min-h-[38px] sm:min-h-[42px] inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-emerald-600 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 shadow-xs"
          >
            <ShoppingCart className="h-4 w-4 shrink-0" />
            <span>{lang === 'bn' ? '+ নতুন বিক্রি (ক্যাশ মেমো)' : '+ New Sale (POS)'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('inventory')}
            className="min-h-[38px] sm:min-h-[42px] inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-violet-200 dark:border-violet-800/70 bg-violet-50/70 dark:bg-violet-950/35 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-violet-800 dark:text-violet-300 hover:bg-violet-100/80 dark:hover:bg-violet-950/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Package className="h-4 w-4 shrink-0" />
            <span>{lang === 'bn' ? 'পণ্য ও স্টক যোগ' : 'Products & Stock'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('credit_expenses')}
            className="min-h-[38px] sm:min-h-[42px] inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/35 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-950/60 transition-colors whitespace-nowrap shrink-0"
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span>{lang === 'bn' ? 'বাকির খাতা ও খরচ' : 'Dues & Expenses'}</span>
          </button>
        </div>

        {/* Right Side: Month Picker & Clean Reports */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <select
            value={state.selectedMonthKey}
            onChange={(e) => onChangeMonth(e.target.value)}
            aria-label="Select Month"
            className="min-h-[36px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 focus:border-emerald-600 focus:outline-none shrink-0"
          >
            {selectableMonths.map((mk) => (
              <option key={mk} value={mk}>
                {mk}
              </option>
            ))}
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleCustomCsvFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={lang === 'bn' ? 'CSV ফাইল ইম্পোর্ট করুন' : 'Import CSV dataset'}
            className="min-h-[36px] sm:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{lang === 'bn' ? 'CSV ইম্পোর্ট' : 'Import'}</span>
          </button>

          <button
            type="button"
            onClick={() => exportSalesCsv(filteredSales, state.selectedMonthKey)}
            className="min-h-[36px] sm:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span>CSV</span>
          </button>

          {canViewFinancials && (
            <button
              type="button"
              onClick={onOpenAuditPrint}
              className="min-h-[36px] sm:min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'bn' ? 'PDF রিপোর্ট' : 'PDF Report'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Fresh New Shop 3-Step Easy Onboarding Guide (Only when shop has 0 products) */}
      {state.products.length === 0 && (
        <div className="neu-box-static rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {lang === 'bn'
                  ? 'স্বাগতম! মাত্র ৩টি সহজ ধাপে আপনার দোকানের হিসাব শুরু করুন'
                  : 'Welcome! Start Running Your Shop in 3 Simple Steps'}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                {lang === 'bn'
                  ? 'আপনার দোকানের সব হিসাব স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে।'
                  : 'Every product, sale, and customer balance is saved automatically.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('inventory')}
              className="neu-flat neu-box cursor-pointer text-left rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-violet-400 flex items-start justify-between gap-3"
            >
              <div>
                <div className="text-xs font-mono font-bold text-violet-600 dark:text-violet-400">
                  {lang === 'bn' ? 'ধাপ ১' : 'STEP 01'}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === 'bn' ? 'ক্যাটাগরি ও পণ্য যোগ করুন' : 'Add Categories & Products'}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'পণ্যের নাম, কেনা দাম, বিক্রয় মূল্য ও স্টক লিখুন'
                    : 'Enter product names, prices, and opening stock'}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-violet-600 shrink-0 mt-1" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('pos')}
              className="neu-flat neu-box cursor-pointer text-left rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-emerald-400 flex items-start justify-between gap-3"
            >
              <div>
                <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {lang === 'bn' ? 'ধাপ ২' : 'STEP 02'}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === 'bn' ? 'দ্রুত বিক্রি ও রিসিট প্রিন্ট' : 'Make Daily Counter Sales'}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'নগদ, বিকাশ/নগদ অথবা বাকিতে বিক্রি করুন'
                    : 'Sell via Cash, bKash/Nagad, or Customer Credit'}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-emerald-600 shrink-0 mt-1" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('reports_admin')}
              className="neu-flat neu-box cursor-pointer text-left rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400 flex items-start justify-between gap-3"
            >
              <div>
                <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {lang === 'bn' ? 'ধাপ ৩' : 'STEP 03'}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === 'bn' ? 'ম্যানেজার ও ক্যাশিয়ার যোগ' : 'Add Manager or Cashier'}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'কর্মচারীদের জন্য আলাদা লগইন তৈরি করুন'
                    : 'Create separate staff logins with custom access'}
                </div>
              </div>
              <UserPlus className="h-4 w-4 text-indigo-600 shrink-0 mt-1" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Tastefully Colored Minimal KPI Cards (4 Core Shop Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Sales (Emerald Tint) */}
        <div className="neu-box rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/55 dark:bg-emerald-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-900/80 dark:text-emerald-300 leading-snug">
              {t.monthlySales}
            </span>
            <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {formatBDT(metrics.totalSales)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
            {lang === 'bn'
              ? `আজ বিক্রি: ${formatBDT(metrics.todaySales)} · ${filteredSales.length} টি মেমো`
              : `Today: ${formatBDT(metrics.todaySales)} · ${filteredSales.length} sales`}
          </div>
        </div>

        {/* Card 2: Net Profit (Sky Tint) */}
        <div className="neu-box rounded-2xl border border-sky-200/80 dark:border-sky-900/50 bg-sky-50/55 dark:bg-sky-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-sky-900/80 dark:text-sky-300 leading-snug">
              {canViewFinancials
                ? t.netProfit
                : lang === 'bn'
                ? 'দৈনিক গড় বিক্রি'
                : 'Daily Average Sales'}
            </span>
            <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          {canViewFinancials ? (
            <>
              <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {formatBDT(metrics.netProfit)}
              </div>
              <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
                {lang === 'bn'
                  ? `মোট লাভ: ${formatBDT(metrics.grossProfit)} (${
                      metrics.totalSales > 0
                        ? formatPct((metrics.netProfit / metrics.totalSales) * 100)
                        : '0%'
                    })`
                  : `Gross: ${formatBDT(metrics.grossProfit)} (${
                      metrics.totalSales > 0
                        ? formatPct((metrics.netProfit / metrics.totalSales) * 100)
                        : '0%'
                    })`}
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {formatBDT(metrics.avgDaily)}
              </div>
              <div className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug">
                {lang === 'bn' ? 'সক্রিয় বিক্রির দিনের গড়' : 'Average per active sales day'}
              </div>
            </>
          )}
        </div>

        {/* Card 3: Inventory Stock Valuation (Violet Tint — Clickable) */}
        <button
          type="button"
          onClick={() => onNavigateTab('inventory')}
          className="neu-flat neu-box cursor-pointer text-left rounded-2xl border border-violet-200/80 dark:border-violet-900/50 bg-violet-50/55 dark:bg-violet-950/25 p-3.5 sm:p-5 hover:border-violet-400 dark:hover:border-violet-700 min-w-0"
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-violet-900/80 dark:text-violet-300 leading-snug">
              {t.stockValue}
            </span>
            <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-violet-600/15 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0">
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {formatBDT(metrics.stockValue)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
            {lang === 'bn'
              ? `মোট ${filteredProducts.length} ধরন পণ্য · স্টক শেষ: ${metrics.outOfStockCount}`
              : `${filteredProducts.length} SKUs · Out of stock: ${metrics.outOfStockCount}`}
          </div>
        </button>

        {/* Card 4: Customer Dues & Shop Expenses (Amber Tint — Clickable) */}
        <button
          type="button"
          onClick={() => onNavigateTab('credit_expenses')}
          className="neu-flat neu-box cursor-pointer text-left rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/55 dark:bg-amber-950/25 p-3.5 sm:p-5 hover:border-amber-400 dark:hover:border-amber-700 min-w-0"
        >
          <div className="flex items-start justify-between gap-1.5">
            <span className="text-[11px] sm:text-xs font-semibold text-amber-900/80 dark:text-amber-300 leading-snug">
              {lang === 'bn' ? 'মোট বকেয়া পাওনা (বাকির খাতা)' : 'Customer Dues Receivable'}
            </span>
            <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-amber-600/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </span>
          </div>
          <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {formatBDT(metrics.totalReceivable)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
            {canViewFinancials
              ? lang === 'bn'
                ? `মাসিক খরচ: ${formatBDT(metrics.totalOpEx)} · সার্ভিস আয়: ${formatBDT(metrics.otherIncome)}`
                : `OpEx: ${formatBDT(metrics.totalOpEx)} · Extra Inc: ${formatBDT(metrics.otherIncome)}`
              : lang === 'bn'
              ? `বাকিদার ক্রেতা: ${state.credits.length} জন`
              : `Credit accounts: ${state.credits.length}`}
          </div>
        </button>
      </div>

      {/* 4. Minimal Stock Alert Banner (Shown only when items need restock) */}
      {(metrics.outOfStockCount > 0 || metrics.lowStockCount > 0) && (
        <div className="neu-box rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/65 dark:bg-rose-950/25 px-3.5 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2 text-xs min-w-0 flex-1">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
            <span className="font-medium text-slate-800 dark:text-slate-200 leading-snug">
              {lang === 'bn' ? (
                <>
                  স্টক সতর্কতা: <strong className="font-mono text-rose-700 dark:text-rose-400">{metrics.outOfStockCount}</strong> টি পণ্য শেষ এবং{' '}
                  <strong className="font-mono text-amber-700 dark:text-amber-400">{metrics.lowStockCount}</strong> টি পণ্যের স্টক কম আছে।
                </>
              ) : (
                <>
                  Stock Alert: <strong className="font-mono text-rose-700 dark:text-rose-400">{metrics.outOfStockCount}</strong> out-of-stock and{' '}
                  <strong className="font-mono text-amber-700 dark:text-amber-400">{metrics.lowStockCount}</strong> low-stock items need reorder.
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('inventory')}
            className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700 whitespace-nowrap shrink-0"
          >
            <span>{lang === 'bn' ? 'স্টক যোগ করুন' : 'Restock Items'}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      )}

      {/* 5. Minimal 1-Tap & Drag-and-Drop Quick Filter Bar */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDropZone}
        className={`neu-box-static rounded-2xl border p-3.5 sm:p-4 transition-colors ${
          isDraggingOver
            ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
            : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Filter className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
              {lang === 'bn' ? 'ক্যাটাগরি ও পেমেন্ট ফিল্টার' : 'Quick Filter'}
            </span>
            <span className="text-slate-400 hidden sm:inline truncate">
              ·{' '}
              {lang === 'bn'
                ? 'যেকোনো বাটনে ট্যাপ করুন বা টেনে আনুন'
                : 'Tap or drag any tag to filter charts'}
            </span>
          </div>

          {activeFilters.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilters([])}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3 w-3 shrink-0" />
              <span>{t.resetFilters}</span>
            </button>
          )}
        </div>

        {activeFilters.length > 0 && (
          <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 border-b border-slate-100 dark:border-slate-800">
            {activeFilters.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => toggleFilterChip(chip)}
                className="min-h-[30px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
              >
                <span>{lang === 'bn' ? chip.labelBn : chip.labelEn}</span>
                <X className="h-3 w-3 shrink-0" />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {availableChips.map((chip) => {
            const isSelected = activeFilters.some((c) => c.id === chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                draggable
                onDragStart={(e) => handleDragStart(e, chip)}
                onClick={() => toggleFilterChip(chip)}
                className={`min-h-[34px] inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <GripVertical className="h-3 w-3 text-slate-400 hidden sm:inline" />
                <span>{lang === 'bn' ? chip.labelBn : chip.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Interactive Colored Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {t.dailySalesChart}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                {lang === 'bn' ? 'প্রতিদিনের বিক্রি ও লাভের ধারা' : 'Daily revenue & gross profit trend'}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-semibold whitespace-nowrap shrink-0">
              {metrics.dailySeries.length} {lang === 'bn' ? 'দিন' : 'days'}
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.dailySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis dataKey="dayShort" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatBDT(Number(value || 0)),
                    name === 'sales'
                      ? lang === 'bn'
                        ? 'বিক্রি'
                        : 'Sales'
                      : lang === 'bn'
                      ? 'লাভ'
                      : 'Profit',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#059669"
                  strokeWidth={2.25}
                  fill="url(#salesGrad)"
                />
                {canViewFinancials && (
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="#0284c7"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {t.seasonalChart}
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                {lang === 'bn' ? 'মাসভিত্তিক বিক্রি ও নিট লাভের তুলনা' : 'Monthly sales vs. net profit'}
              </p>
            </div>
            <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold whitespace-nowrap shrink-0">
              {state.selectedYear}
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={state.seasonalHistory} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                <XAxis
                  dataKey={lang === 'bn' ? 'monthLabelBn' : 'monthLabelEn'}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatBDT(Number(value || 0)),
                    String(name),
                  ]}
                />
                <Bar dataKey="sales" name="Monthly Sales" fill="#6366f1" radius={[6, 6, 0, 0]} />
                {canViewFinancials && (
                  <Line
                    type="monotone"
                    dataKey="netProfit"
                    name="Net Profit"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 7. Category Breakdown + Top Selling Products + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="neu-box lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
              {t.categorySalesTitle}
            </h3>
            <span className="text-xs text-slate-500 whitespace-nowrap shrink-0">
              {lang === 'bn' ? 'ক্লিক করে ফিল্টার করুন' : 'Click row to filter'}
            </span>
          </div>

          {categoryBreakdown.length > 0 ? (
            <>
              <div className="h-52 w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryBreakdown}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 12, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.28} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: unknown) => formatBDT(Number(v || 0))} />
                    <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th className="text-left">
                        {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                      </th>
                      <th className="w-24 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'বিক্রি' : 'Sales'}
                      </th>
                      {canViewFinancials && (
                        <th className="w-24 text-right whitespace-nowrap">
                          {lang === 'bn' ? 'লাভ' : 'Profit'}
                        </th>
                      )}
                      <th className="w-16 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'অংশ' : 'Share'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryBreakdown.map((c) => (
                      <tr
                        key={c.categoryBn}
                        onClick={() =>
                          toggleFilterChip({
                            id: `cat:${c.categoryBn}`,
                            dimension: 'category',
                            value: c.categoryBn,
                            labelBn: c.categoryBn,
                            labelEn: translateCategory(c.categoryBn, 'en', activeCategories),
                          })
                        }
                        className="hover:bg-emerald-50/40 dark:hover:bg-slate-800/40 cursor-pointer"
                      >
                        <td className="font-medium text-slate-800 dark:text-slate-200 break-words">
                          {c.label}
                        </td>
                        <td className="text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                          {formatBDT(c.sales)}
                        </td>
                        {canViewFinancials && (
                          <td className="text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatBDT(c.profit)}
                          </td>
                        )}
                        <td className="text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {metrics.totalSales > 0
                            ? formatPct((c.sales / metrics.totalSales) * 100)
                            : '0.0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              {lang === 'bn'
                ? 'এই মাসে এখনো কোনো বিক্রির হিসাব নেই।'
                : 'No category sales recorded in this period yet.'}
            </div>
          )}

          {/* Recent Counter Sales Mini-Ledger */}
          {recentSales.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-snug">
                  {lang === 'bn' ? 'সর্বশেষ বিক্রির মেমো' : 'Recent Counter Sales'}
                </h4>
                <button
                  type="button"
                  onClick={() => onNavigateTab('pos')}
                  className="px-2.5 py-1 rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0"
                >
                  {lang === 'bn' ? '+ নতুন মেমো' : '+ New Sale'}
                </button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {recentSales.map((s) => (
                  <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 leading-snug">
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {s.invoiceNo}
                      </span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-500">
                        {s.date} · {s.paymentMethod}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                      {formatBDT(s.totalAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Top 5 Products + Online Order Delivery + Monthly Audit */}
        <div className="lg:col-span-5 space-y-5">
          <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {t.topProductsTitle}
              </h3>
              <button
                type="button"
                onClick={() => onNavigateTab('inventory')}
                className="px-2.5 py-1 rounded-lg border border-violet-200/80 dark:border-violet-900/60 bg-violet-50/80 dark:bg-violet-950/40 text-xs font-semibold text-violet-700 dark:text-violet-400 whitespace-nowrap shrink-0"
              >
                {lang === 'bn' ? 'সব পণ্য' : 'View All'}
              </button>
            </div>
            {topSellingProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                {lang === 'bn' ? 'কোনো পণ্য যোগ করা হয়নি।' : 'No products added yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th className="w-8 text-left whitespace-nowrap">#</th>
                      <th className="text-left">
                        {lang === 'bn' ? 'পণ্যের নাম' : 'Product'}
                      </th>
                      <th className="w-16 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'পিস' : 'Units'}
                      </th>
                      <th className="w-24 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'বিক্রি' : 'Revenue'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSellingProducts.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {idx + 1}
                        </td>
                        <td className="font-medium text-slate-800 dark:text-slate-200 break-words">
                          {lang === 'bn' ? p.nameBn || p.name : p.name}
                        </td>
                        <td className="text-right font-mono tabular-nums whitespace-nowrap">
                          {p.soldThisMonth}
                        </td>
                        <td className="text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                          {formatBDT(p.revenueThisMonth)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Truck className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {t.shippingEfficiencyTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('ecommerce')}
                className="px-2.5 py-1 rounded-lg border border-cyan-200/80 dark:border-cyan-900/60 bg-cyan-50/80 dark:bg-cyan-950/40 text-xs font-semibold text-cyan-700 dark:text-cyan-400 whitespace-nowrap shrink-0"
              >
                {lang === 'bn' ? 'অনলাইন অর্ডার' : 'Manage'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500 leading-snug">
                {lang === 'bn' ? 'সময়মতো ডেলিভারি হার' : 'On-Time Delivery Rate'}
              </span>
              <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                {formatPct(shippingMetrics.onTimePct)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 py-2 text-xs">
              <span className="text-slate-500 leading-snug">
                {lang === 'bn' ? 'মোট অনলাইন অর্ডার ও গড় সময়' : 'Orders & Avg Dispatch'}
              </span>
              <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0">
                {shippingMetrics.total} orders · {shippingMetrics.avgHours.toFixed(1)}h
              </span>
            </div>

            {canViewFinancials && (
              <button
                type="button"
                onClick={() => exportMonthlyAuditCsv(state)}
                className="mt-3 min-h-[38px] w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap truncate"
              >
                {lang === 'bn' ? 'মাসিক অডিট রিপোর্ট (CSV) ডাউনলোড' : 'Download Monthly Audit CSV'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
