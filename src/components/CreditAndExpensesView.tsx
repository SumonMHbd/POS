import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  Plus,
  Search,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import {
  UserRole,
  type CreditHistoryEntry,
  type CustomerCredit,
  type ExpenseEntry,
  type LanguageCode,
  type SaleTransaction,
  type SeasonalMonthDatum,
  type StaffDashboardPermissions,
} from '../types/pos';
import { ensureCustomerCreditHistory } from '../lib/storeDefaults';
import { formatBDT, formatPct, UI_TEXT } from '../i18n/translations';
import {
  exportCreditsCsv,
  exportDueHistoryCsv,
  exportExpensesCsv,
  exportMonthlyCostSummaryCsv,
  type MonthlyCostCsvRow,
} from '../lib/exportReports';
import { AppPopupModal } from './AppPopupModal';

interface CreditAndExpensesViewProps {
  credits: CustomerCredit[];
  expenses: ExpenseEntry[];
  sales?: SaleTransaction[];
  seasonalHistory?: SeasonalMonthDatum[];
  monthKey: string;
  lang: LanguageCode;
  activeRole: UserRole;
  permissions?: StaffDashboardPermissions;
  onCollectCreditPayment: (
    customerId: string,
    collectedAmount: number,
    paymentDate?: string,
    paymentMethod?: string,
    note?: string
  ) => void;
  onAddCustomerDue: (payload: {
    existingCustomerId?: string;
    name: string;
    phone: string;
    dueAmount: number;
    date: string;
    dueDate: string;
    note: string;
  }) => void;
  onAddExpenseEntry: (entry: Omit<ExpenseEntry, 'id'>) => void;
}

const MONTH_NAMES_BN: Record<string, string> = {
  '01': 'জানুয়ারি',
  '02': 'ফেব্রুয়ারি',
  '03': 'মার্চ',
  '04': 'এপ্রিল',
  '05': 'মে',
  '06': 'জুন',
  '07': 'জুলাই',
  '08': 'আগস্ট',
  '09': 'সেপ্টেম্বর',
  '10': 'অক্টোবর',
  '11': 'নভেম্বর',
  '12': 'ডিসেম্বর',
};

const MONTH_NAMES_EN: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

function toBnDigits(input: string): string {
  return input.replace(/\d/g, (d) => BN_DIGITS[Number(d)] || d);
}

function formatMonthLabel(mk: string, lang: LanguageCode): string {
  if (!mk || !/^\d{4}-\d{2}$/.test(mk)) return mk || '—';
  const [yr, mm] = mk.split('-');
  if (lang === 'bn') {
    const mName = MONTH_NAMES_BN[mm] || mm;
    return `${mName} ${toBnDigits(yr)}`;
  }
  const mName = MONTH_NAMES_EN[mm] || mm;
  return `${mName} ${yr}`;
}

function resolveDefaultDateForMonth(targetMonthKey: string): string {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (!targetMonthKey || !/^\d{4}-\d{2}$/.test(targetMonthKey)) {
    return todayIso;
  }
  if (todayIso.startsWith(targetMonthKey)) {
    return todayIso;
  }
  return `${targetMonthKey}-01`;
}

function parseCategoryInput(raw: string): { bn: string; en: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.+?)\s*\(([^()]+)\)$/);
  if (match) {
    return {
      bn: match[1].trim(),
      en: match[2].trim(),
    };
  }
  return { bn: trimmed, en: trimmed };
}

interface MonthlyCostSummaryItem extends MonthlyCostCsvRow {
  year: string;
  servicingIncome: number;
  detailItems: ExpenseEntry[];
}

function formatReadableDate(isoDate: string, lang: LanguageCode): string {
  if (!isoDate || isoDate.length < 10) return isoDate || '—';
  const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const CreditAndExpensesView: React.FC<CreditAndExpensesViewProps> = ({
  credits,
  expenses,
  sales = [],
  seasonalHistory = [],
  monthKey,
  lang,
  activeRole,
  permissions,
  onCollectCreditPayment,
  onAddCustomerDue,
  onAddExpenseEntry,
}) => {
  const t = UI_TEXT[lang];
  const canManageExpenses = permissions
    ? permissions.canManageExpenses
    : activeRole === UserRole.OWNER ||
      activeRole === UserRole.SUPER_ADMIN ||
      activeRole === UserRole.MANAGER;

  const historySectionRef = useRef<HTMLDivElement | null>(null);

  // Collect Due Payment Modal State
  const [collectTarget, setCollectTarget] = useState<CustomerCredit | null>(null);
  const [collectAmount, setCollectAmount] = useState<string>('');
  const [collectDate, setCollectDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [collectMethod, setCollectMethod] = useState<string>('Cash');
  const [collectNote, setCollectNote] = useState<string>('');

  // Add Previous / New Customer Due Modal State
  const [showAddDueModal, setShowAddDueModal] = useState(false);
  const [dueCustomerMode, setDueCustomerMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingCustId, setSelectedExistingCustId] = useState<string>('');
  const [newDueName, setNewDueName] = useState('');
  const [newDuePhone, setNewDuePhone] = useState('');
  const [newDueAmount, setNewDueAmount] = useState('');
  const [newDueEntryDate, setNewDueEntryDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [newDueRepayDate, setNewDueRepayDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const [newDueNote, setNewDueNote] = useState('');

  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expCategoryBn, setExpCategoryBn] = useState('দোকান ভাড়া (Shop Rent)');
  const [expType, setExpType] = useState<ExpenseEntry['type']>('expense');
  const [expDate, setExpDate] = useState<string>(() => resolveDefaultDateForMonth(monthKey));
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');

  // Every Month Cost Data Filters & Drill-down State
  const [costYearFilter, setCostYearFilter] = useState<string>('ALL');
  const [costSearch, setCostSearch] = useState<string>('');
  const [costSortAsc, setCostSortAsc] = useState<boolean>(true);
  const [selectedCostDetailMonth, setSelectedCostDetailMonth] = useState<string | null>(null);

  // Due Amount & Payment History Filters
  const [historyCustomerFilter, setHistoryCustomerFilter] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historySortAsc, setHistorySortAsc] = useState<boolean>(true);

  const totalDue = useMemo(
    () => credits.reduce((acc, c) => acc + c.balanceDue, 0),
    [credits]
  );
  const totalCollectedAllTime = useMemo(
    () => credits.reduce((acc, c) => acc + c.totalPaid, 0),
    [credits]
  );
  const overdueAccounts = useMemo(
    () => credits.filter((c) => c.isOverdue && c.balanceDue > 0),
    [credits]
  );

  const monthExpenses = useMemo(
    () => expenses.filter((e) => (e.monthKey || e.date.slice(0, 7)) === monthKey),
    [expenses, monthKey]
  );
  const opExTotal = useMemo(
    () => monthExpenses.filter((e) => e.type === 'expense').reduce((a, b) => a + b.amount, 0),
    [monthExpenses]
  );
  const servicingIncomeTotal = useMemo(
    () => monthExpenses.filter((e) => e.type === 'other_income').reduce((a, b) => a + b.amount, 0),
    [monthExpenses]
  );

  // Aggregate Every Month Cost Data across itemized expenses, stock purchases, and historical monthly records
  const allMonthlyCostRows = useMemo<MonthlyCostSummaryItem[]>(() => {
    const monthSet = new Set<string>();
    if (monthKey) monthSet.add(monthKey);

    for (const e of expenses) {
      const mk = e.monthKey || e.date.slice(0, 7);
      if (mk && e.amount > 0) monthSet.add(mk);
    }
    for (const m of seasonalHistory) {
      if (m.monthKey && (m.expenses > 0 || m.sales > 0)) {
        monthSet.add(m.monthKey);
      }
    }
    for (const s of sales) {
      if (s.monthKey && s.totalAmount > 0) {
        monthSet.add(s.monthKey);
      }
    }

    const rows: MonthlyCostSummaryItem[] = [];

    for (const mk of monthSet) {
      const monthEntries = expenses.filter(
        (e) => (e.monthKey || e.date.slice(0, 7)) === mk && e.amount > 0
      );
      const opExEntries = monthEntries.filter((e) => e.type === 'expense');
      const stockEntries = monthEntries.filter((e) => e.type === 'inventory_purchase');
      const incomeEntries = monthEntries.filter((e) => e.type === 'other_income');

      const itemizedOpEx = opExEntries.reduce((sum, e) => sum + e.amount, 0);
      const stockPurchaseCost = stockEntries.reduce((sum, e) => sum + e.amount, 0);
      const servicingIncome = incomeEntries.reduce((sum, e) => sum + e.amount, 0);

      const seasonalDatum = seasonalHistory.find((s) => s.monthKey === mk);
      const hasSeededItemizedOpEx = opExEntries.some((e) => /^exp-\d{1,4}$/.test(e.id));
      const historicalBaselineOpEx =
        seasonalDatum && seasonalDatum.expenses > 0 && !hasSeededItemizedOpEx
          ? seasonalDatum.expenses
          : 0;

      const operatingCost = historicalBaselineOpEx + itemizedOpEx;
      const totalCost = operatingCost + stockPurchaseCost;

      const liveMonthSales = sales
        .filter((s) => s.monthKey === mk)
        .reduce((sum, s) => sum + s.totalAmount, 0);
      const monthlySales = liveMonthSales > 0 ? liveMonthSales : seasonalDatum?.sales || 0;
      const opExSharePct = monthlySales > 0 ? (operatingCost / monthlySales) * 100 : null;

      const detailItems: ExpenseEntry[] = [];
      if (historicalBaselineOpEx > 0) {
        detailItems.push({
          id: `hist-opex-${mk}`,
          categoryBn: 'দোকান ভাড়া, বেতন ও ইউটিলিটি (মাসিক সামারি)',
          categoryEn: 'Shop Rent, Salary & Utilities (Monthly Summary)',
          amount: historicalBaselineOpEx,
          date: `${mk}-28`,
          monthKey: mk,
          type: 'expense',
          note:
            lang === 'bn'
              ? 'সংরক্ষিত মাসিক পরিচালন খরচের মোট হিসাব'
              : 'Recorded monthly operating expense total',
          recordedBy: 'Owner',
        });
      }
      for (const item of [...opExEntries, ...stockEntries].sort((a, b) =>
        a.date.localeCompare(b.date)
      )) {
        detailItems.push(item);
      }

      // Build concise top cost heads text
      let majorHeadsSummary = '—';
      const costEntriesForSummary = [...opExEntries, ...stockEntries];
      if (costEntriesForSummary.length > 0) {
        const grouped = new Map<string, number>();
        for (const ce of costEntriesForSummary) {
          const label = lang === 'bn' ? ce.categoryBn : ce.categoryEn;
          grouped.set(label, (grouped.get(label) || 0) + ce.amount);
        }
        const sortedHeads = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
        const topSlice = sortedHeads
          .slice(0, 3)
          .map(([name, val]) => `${name} ${formatBDT(val)}`);
        if (historicalBaselineOpEx > 0) {
          topSlice.unshift(
            lang === 'bn'
              ? `মাসিক পরিচালন ${formatBDT(historicalBaselineOpEx)}`
              : `Base OpEx ${formatBDT(historicalBaselineOpEx)}`
          );
        }
        majorHeadsSummary =
          sortedHeads.length > 3
            ? `${topSlice.slice(0, 3).join(' · ')} +${sortedHeads.length - 3}`
            : topSlice.join(' · ');
      } else if (historicalBaselineOpEx > 0) {
        majorHeadsSummary =
          lang === 'bn'
            ? 'দোকান ভাড়া · কর্মচারী বেতন · বিদ্যুৎ ও পরিবহন'
            : 'Shop Rent · Staff Salary · Electricity & Transport';
      }

      rows.push({
        monthKey: mk,
        year: mk.slice(0, 4),
        monthLabel: formatMonthLabel(mk, lang),
        operatingCost,
        stockPurchaseCost,
        totalCost,
        servicingIncome,
        monthlySales,
        opExSharePct,
        entriesCount: detailItems.length,
        majorHeadsSummary,
        detailItems,
      });
    }

    return rows.sort((a, b) =>
      costSortAsc
        ? a.monthKey.localeCompare(b.monthKey)
        : b.monthKey.localeCompare(a.monthKey)
    );
  }, [expenses, seasonalHistory, sales, monthKey, lang, costSortAsc]);

  const availableCostYears = useMemo(() => {
    const yrs = new Set<string>();
    for (const r of allMonthlyCostRows) {
      if (r.year) yrs.add(r.year);
    }
    return Array.from(yrs).sort((a, b) => b.localeCompare(a));
  }, [allMonthlyCostRows]);

  const filteredMonthlyCostRows = useMemo(() => {
    const q = costSearch.trim().toLowerCase();
    return allMonthlyCostRows.filter((row) => {
      if (costYearFilter !== 'ALL' && row.year !== costYearFilter) return false;
      if (q) {
        const hit =
          row.monthKey.toLowerCase().includes(q) ||
          row.monthLabel.toLowerCase().includes(q) ||
          row.majorHeadsSummary.toLowerCase().includes(q) ||
          row.detailItems.some(
            (d) =>
              d.categoryBn.toLowerCase().includes(q) ||
              d.categoryEn.toLowerCase().includes(q) ||
              d.note.toLowerCase().includes(q)
          );
        if (!hit) return false;
      }
      return true;
    });
  }, [allMonthlyCostRows, costYearFilter, costSearch]);

  const monthlyCostTotals = useMemo(() => {
    const operating = filteredMonthlyCostRows.reduce((s, r) => s + r.operatingCost, 0);
    const stock = filteredMonthlyCostRows.reduce((s, r) => s + r.stockPurchaseCost, 0);
    const total = filteredMonthlyCostRows.reduce((s, r) => s + r.totalCost, 0);
    const salesSum = filteredMonthlyCostRows.reduce((s, r) => s + r.monthlySales, 0);
    const activeOpExMonths = filteredMonthlyCostRows.filter((r) => r.operatingCost > 0).length;
    const avgMonthlyOpEx = activeOpExMonths > 0 ? Math.round(operating / activeOpExMonths) : 0;
    const overallOpExPct = salesSum > 0 ? (operating / salesSum) * 100 : null;
    return {
      operating,
      stock,
      total,
      avgMonthlyOpEx,
      overallOpExPct,
    };
  }, [filteredMonthlyCostRows]);

  const selectedMonthCostDetail = useMemo(
    () =>
      selectedCostDetailMonth
        ? allMonthlyCostRows.find((r) => r.monthKey === selectedCostDetailMonth) || null
        : null,
    [allMonthlyCostRows, selectedCostDetailMonth]
  );

  // Build unified chronological Due Amount & Payment History across all customers
  const allDueHistoryEntries = useMemo<CreditHistoryEntry[]>(() => {
    const merged: CreditHistoryEntry[] = [];
    for (const c of credits) {
      const custHistory = ensureCustomerCreditHistory(c);
      for (const h of custHistory) {
        merged.push({
          ...h,
          customerName: c.name,
          customerNameEn: c.nameEn || c.name,
          customerPhone: c.phone,
        });
      }
    }
    return merged.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp);
      return historySortAsc ? cmp : -cmp;
    });
  }, [credits, historySortAsc]);

  const filteredDueHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return allDueHistoryEntries.filter((entry) => {
      if (historyCustomerFilter !== 'ALL' && entry.customerId !== historyCustomerFilter) {
        return false;
      }
      if (q) {
        const matched =
          entry.customerName.toLowerCase().includes(q) ||
          (entry.customerNameEn || '').toLowerCase().includes(q) ||
          entry.customerPhone.toLowerCase().includes(q) ||
          entry.date.includes(q) ||
          (entry.invoiceNo || '').toLowerCase().includes(q) ||
          (entry.note || '').toLowerCase().includes(q);
        if (!matched) return false;
      }
      return true;
    });
  }, [allDueHistoryEntries, historyCustomerFilter, historySearch]);

  const selectedHistoryCustomer = useMemo(
    () =>
      historyCustomerFilter === 'ALL'
        ? null
        : credits.find((c) => c.id === historyCustomerFilter) || null,
    [credits, historyCustomerFilter]
  );

  const openCollectModalFor = (customer: CustomerCredit) => {
    setCollectTarget(customer);
    setCollectAmount(String(customer.balanceDue));
    setCollectDate(new Date().toISOString().slice(0, 10));
    setCollectMethod('Cash');
    setCollectNote('');
  };

  const handleConfirmCollect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectTarget) return;
    const amt = Math.min(collectTarget.balanceDue, Math.max(1, Number(collectAmount) || 0));
    onCollectCreditPayment(
      collectTarget.id,
      amt,
      collectDate || new Date().toISOString().slice(0, 10),
      collectMethod,
      collectNote.trim() || undefined
    );
    setCollectTarget(null);
    setCollectAmount('');
    setCollectNote('');
  };

  const handleConfirmAddDue = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(1, Math.round(Number(newDueAmount) || 0));
    if (!amt) return;

    if (dueCustomerMode === 'existing') {
      const existing = credits.find((c) => c.id === selectedExistingCustId);
      if (!existing) return;
      onAddCustomerDue({
        existingCustomerId: existing.id,
        name: existing.name,
        phone: existing.phone,
        dueAmount: amt,
        date: newDueEntryDate || new Date().toISOString().slice(0, 10),
        dueDate: newDueRepayDate || existing.dueDate,
        note: newDueNote.trim() || 'Additional credit due recorded',
      });
    } else {
      if (!newDueName.trim()) return;
      onAddCustomerDue({
        name: newDueName.trim(),
        phone: newDuePhone.trim() || 'N/A',
        dueAmount: amt,
        date: newDueEntryDate || new Date().toISOString().slice(0, 10),
        dueDate: newDueRepayDate,
        note: newDueNote.trim() || 'Previous / opening due balance',
      });
    }

    setNewDueName('');
    setNewDuePhone('');
    setNewDueAmount('');
    setNewDueNote('');
    setShowAddDueModal(false);
  };

  const openExpenseModalForMonth = (
    targetMk: string = monthKey,
    defaultType: ExpenseEntry['type'] = 'expense'
  ) => {
    setExpDate(resolveDefaultDateForMonth(targetMk));
    setExpType(defaultType);
    setShowExpenseModal(true);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Math.max(1, Number(expAmount) || 0);
    if (!amt) return;
    const resolvedDate = expDate || new Date().toISOString().slice(0, 10);
    const resolvedMonthKey = resolvedDate.slice(0, 7) || monthKey;
    const parsedCat = parseCategoryInput(expCategoryBn);

    onAddExpenseEntry({
      categoryBn: parsedCat.bn,
      categoryEn: parsedCat.en,
      amount: amt,
      date: resolvedDate,
      monthKey: resolvedMonthKey,
      type: expType,
      note: expNote.trim() || 'Recorded via MHS POS',
      recordedBy: activeRole,
    });
    if (expType !== 'other_income') {
      setSelectedCostDetailMonth(resolvedMonthKey);
    }
    setExpAmount('');
    setExpNote('');
    setShowExpenseModal(false);
  };

  const handleInspectCustomerHistory = (customerId: string) => {
    setHistoryCustomerFilter(customerId);
    historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const previewPayingAmount = collectTarget
    ? Math.min(collectTarget.balanceDue, Math.max(0, Number(collectAmount) || 0))
    : 0;
  const previewRemainingDue = collectTarget
    ? Math.max(0, collectTarget.balanceDue - previewPayingAmount)
    : 0;

  return (
    <div className="space-y-6">
      {/* Credit Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="neu-box rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/55 dark:bg-rose-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold leading-snug text-rose-900/80 dark:text-rose-300">
            {lang === 'bn' ? 'মোট বাকি পাওনা (সব সময়)' : 'Total Customer Receivable'}
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">
            {formatBDT(totalDue)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400">
            {lang === 'bn' ? `বাকিদার: ${credits.length} জন` : `Active Accounts: ${credits.length}`}
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/55 dark:bg-emerald-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold leading-snug text-emerald-900/80 dark:text-emerald-300">
            {lang === 'bn' ? 'সব সময়ে মোট আদায়' : 'All-Time Collected Dues'}
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
            {formatBDT(totalCollectedAllTime)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400">
            {lang === 'bn' ? 'আদায়কৃত হিসাব' : 'Verified collections'}
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/55 dark:bg-amber-950/25 p-3.5 sm:p-5 min-w-0">
          <div className="text-[11px] sm:text-xs font-semibold leading-snug text-amber-900/80 dark:text-amber-300">
            {lang === 'bn' ? 'মেয়াদোত্তীর্ণ বাকি' : 'Overdue Receivables'}
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">
            {overdueAccounts.length}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400">
            {lang === 'bn' ? 'তারিখ অতিক্রান্ত হিসাব' : 'Past due accounts'}
          </div>
        </div>

        {canManageExpenses && (
          <div className="neu-box rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/55 dark:bg-indigo-950/25 p-3.5 sm:p-5 min-w-0">
            <div className="text-[11px] sm:text-xs font-semibold leading-snug text-indigo-900/80 dark:text-indigo-300">
              {lang === 'bn' ? 'মাসিক খরচ ও সার্ভিসিং' : 'Monthly OpEx & Servicing'}
            </div>
            <div className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
              {formatBDT(opExTotal)}
            </div>
            <div className="mt-1 text-[11px] sm:text-xs leading-snug text-emerald-700 dark:text-emerald-400 font-mono tabular-nums font-medium">
              +{formatBDT(servicingIncomeTotal)} {lang === 'bn' ? 'সার্ভিসিং' : 'servicing'}
            </div>
          </div>
        )}
      </div>

      {/* Main Split: Credit Ledger (বাকির খাতা) & Operating Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div
          className={`neu-box-static ${
            canManageExpenses ? 'lg:col-span-7' : 'lg:col-span-12'
          } rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}
        >
          <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start sm:items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold leading-snug text-slate-900 dark:text-slate-100">
                {lang === 'bn' ? 'বাকির খাতা — ক্রেতার পাওনা তালিকা' : 'Customer Credit Ledger (Bakir Khata)'}
              </h2>
              <p className="text-[11px] sm:text-xs leading-snug text-slate-500 mt-0.5">
                {lang === 'bn'
                  ? 'কিস্তি আদায় বা নতুন বাকি যোগ করলে তারিখসহ সম্পূর্ণ হিসাব সংরক্ষিত হবে'
                  : 'Every credit entry and partial payment is recorded with date and running balance'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDueCustomerMode(credits.length > 0 ? 'new' : 'new');
                  if (credits[0] && !selectedExistingCustId) {
                    setSelectedExistingCustId(credits[0].id);
                  }
                  setShowAddDueModal(true);
                }}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                <span>{lang === 'bn' ? 'বাকি যোগ করুন' : 'Add Due'}</span>
              </button>

              <button
                type="button"
                onClick={() => exportCreditsCsv(credits)}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {credits.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {lang === 'bn'
                ? 'এখনো কোনো বাকির হিসাব নেই। পস কাউন্টারে বাকিতে বিক্রি করলে বা "বাকি যোগ করুন" বাটনে ক্লিক করলে এখানে যুক্ত হবে।'
                : 'No customer credit balances yet. Credit sales completed on POS or added manually appear here.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th className="w-8 text-left whitespace-nowrap">#</th>
                    <th className="min-w-[135px] text-left">
                      {lang === 'bn' ? 'ক্রেতা ও মোবাইল' : 'Customer'}
                    </th>
                    <th className="w-24 text-right whitespace-nowrap">
                      {lang === 'bn' ? 'মোট / জমা' : 'Total / Paid'}
                    </th>
                    <th className="w-24 text-right whitespace-nowrap">
                      {lang === 'bn' ? 'বর্তমান বাকি' : 'Balance Due'}
                    </th>
                    <th className="w-28 text-left whitespace-nowrap">
                      {lang === 'bn' ? 'লেনদেন / মেয়াদ' : 'Dates'}
                    </th>
                    <th className="w-px text-right whitespace-nowrap">
                      {lang === 'bn' ? 'অ্যাকশন' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {credits.map((c, idx) => {
                    const isHistorySelected = historyCustomerFilter === c.id;
                    return (
                      <tr
                        key={c.id}
                        className={
                          isHistorySelected
                            ? 'bg-amber-50/70 dark:bg-amber-950/25'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {idx + 1}
                        </td>
                        <td>
                          <div className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                            {lang === 'bn' ? c.name : c.nameEn}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5 break-words">
                            <span className="whitespace-nowrap">{c.phone}</span>
                            {c.notes ? ` · ${c.notes}` : ''}
                          </div>
                        </td>
                        <td className="text-right font-mono tabular-nums whitespace-nowrap">
                          <div className="text-slate-700 dark:text-slate-300">
                            {formatBDT(c.totalCreditSales)}
                          </div>
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            {lang === 'bn' ? 'জমা:' : 'Paid:'} {formatBDT(c.totalPaid)}
                          </div>
                        </td>
                        <td className="text-right font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                          {formatBDT(c.balanceDue)}
                        </td>
                        <td className="font-mono tabular-nums whitespace-nowrap">
                          <div className="text-slate-700 dark:text-slate-300">
                            {c.lastTransactionDate}
                          </div>
                          <div
                            className={`text-[11px] ${
                              c.isOverdue && c.balanceDue > 0
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            {lang === 'bn' ? 'মেয়াদ:' : 'Due:'} {c.dueDate}
                          </div>
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleInspectCustomerHistory(c.id)}
                              title={
                                lang === 'bn'
                                  ? 'এই ক্রেতার বাকির ও পরিশোধের ইতিহাস দেখুন'
                                  : 'View customer due & payment history'
                              }
                              className={`min-h-[32px] inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold whitespace-nowrap ${
                                isHistorySelected
                                  ? 'border-amber-500 bg-amber-500 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <History className="h-3.5 w-3.5 shrink-0" />
                              <span>{lang === 'bn' ? 'ইতিহাস' : 'History'}</span>
                            </button>

                            {c.balanceDue > 0 ? (
                              <button
                                type="button"
                                onClick={() => openCollectModalFor(c)}
                                className="min-h-[32px] inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                              >
                                <Wallet className="h-3.5 w-3.5 shrink-0" />
                                <span>{t.collectDue}</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium px-1.5 whitespace-nowrap">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                <span>{lang === 'bn' ? 'পরিশোধিত' : 'Paid'}</span>
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Operating Expenses & Servicing Income Panel */}
        {canManageExpenses && (
          <div className="neu-box-static lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {t.expenseBreakdownTitle}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500 font-mono">{monthKey}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportExpensesCsv(monthExpenses, monthKey)}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium whitespace-nowrap"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => openExpenseModalForMonth(monthKey, 'expense')}
                  className="min-h-[36px] inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span>{lang === 'bn' ? 'যোগ করুন' : 'Add'}</span>
                </button>
              </div>
            </div>

            {monthExpenses.filter((e) => e.type === 'expense').length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                {lang === 'bn'
                  ? 'এই মাসে কোনো খরচ যুক্ত করা হয়নি।'
                  : 'No operating expenses recorded for this month yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th className="text-left">
                        {lang === 'bn' ? 'খরচের খাত ও বিবরণ' : 'Expense Category'}
                      </th>
                      <th className="w-16 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'অংশ' : 'Share'}
                      </th>
                      <th className="w-24 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'পরিমাণ' : 'Amount'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthExpenses
                      .filter((e) => e.type === 'expense')
                      .map((e) => (
                        <tr
                          key={e.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          <td>
                            <div className="font-medium text-slate-800 dark:text-slate-200 break-words">
                              {lang === 'bn' ? e.categoryBn : e.categoryEn}
                            </div>
                            {e.note && (
                              <div className="text-[11px] text-slate-400 break-words">{e.note}</div>
                            )}
                          </td>
                          <td className="text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {opExTotal > 0 ? formatPct((e.amount / opExTotal) * 100) : '0.0%'}
                          </td>
                          <td className="text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {formatBDT(e.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 font-bold">
                      <td colSpan={2} className="text-slate-900 dark:text-slate-100">
                        {lang === 'bn' ? 'মোট পরিচালন খরচ' : 'Total Operating Expenses'}
                      </td>
                      <td className="text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatBDT(opExTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Every Month Cost Data Section */}
      {canManageExpenses && (
        <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start sm:items-center justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
                {lang === 'bn'
                  ? 'প্রতি মাসের খরচের হিসাব (Monthly Cost Data)'
                  : 'Every Month Cost Data'}
              </h2>
              <p className="text-[11px] sm:text-xs leading-snug text-slate-500 mt-0.5">
                {lang === 'bn'
                  ? 'প্রতি মাসের পরিচালন খরচ, মালামাল ক্রয় এবং মোট ব্যয়ের ধারাবাহিক বিবরণ'
                  : 'Month-by-month operating expenses, stock purchases, and total cost summary'}
              </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              <button
                type="button"
                onClick={() => setCostSortAsc((prev) => !prev)}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
              >
                <ArrowDownUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>
                  {costSortAsc
                    ? lang === 'bn'
                      ? 'মাস: পুরাতন → নতুন'
                      : 'Month: Ascending'
                    : lang === 'bn'
                    ? 'মাস: নতুন → পুরাতন'
                    : 'Month: Newest First'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => openExpenseModalForMonth(selectedCostDetailMonth || monthKey, 'expense')}
                className="min-h-[36px] inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>{lang === 'bn' ? 'খরচ যোগ করুন' : 'Add Cost'}</span>
              </button>

              <button
                type="button"
                onClick={() => exportMonthlyCostSummaryCsv(filteredMonthlyCostRows)}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-2.5 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Filter & Aggregate Summary Strip */}
          <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-slate-500 mb-1">
                  {lang === 'bn' ? 'বছর অনুযায়ী ফিল্টার' : 'Filter by Year'}
                </label>
                <select
                  value={costYearFilter}
                  onChange={(e) => setCostYearFilter(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium font-mono"
                >
                  <option value="ALL">
                    {lang === 'bn' ? 'সকল বছর (All Years)' : 'All Years'}
                  </option>
                  {availableCostYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-8 flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {lang === 'bn' ? 'মাস বা খরচের খাত খুঁজুন' : 'Search Month or Cost Category'}
                  </label>
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={costSearch}
                      onChange={(e) => setCostSearch(e.target.value)}
                      placeholder={
                        lang === 'bn'
                          ? 'যেমন: অক্টোবর, 2026-10, দোকান ভাড়া, বেতন...'
                          : 'e.g., October, 2026-10, Shop Rent, Salary...'
                      }
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs"
                    />
                  </div>
                </div>

                {(costYearFilter !== 'ALL' || costSearch.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setCostYearFilter('ALL');
                      setCostSearch('');
                    }}
                    className="min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
                  >
                    {lang === 'bn' ? 'রিসেট' : 'Reset'}
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-[11px] text-slate-500">
                  {lang === 'bn' ? 'মোট পরিচালন খরচ' : 'Total Operating Cost'}
                </div>
                <div className="mt-0.5 text-sm sm:text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {formatBDT(monthlyCostTotals.operating)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">
                  {lang === 'bn' ? 'মাসিক গড় পরিচালন খরচ' : 'Avg. Monthly OpEx'}
                </div>
                <div className="mt-0.5 text-sm sm:text-base font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                  {formatBDT(monthlyCostTotals.avgMonthlyOpEx)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">
                  {lang === 'bn' ? 'মোট মালামাল ক্রয় খরচ' : 'Total Stock Purchases'}
                </div>
                <div className="mt-0.5 text-sm sm:text-base font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">
                  {formatBDT(monthlyCostTotals.stock)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">
                  {lang === 'bn' ? 'সর্বমোট ব্যয় (সব মাস)' : 'Combined Total Cost'}
                </div>
                <div className="mt-0.5 text-sm sm:text-base font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">
                  {formatBDT(monthlyCostTotals.total)}
                </div>
              </div>
            </div>
          </div>

          {/* Month-by-Month Cost Table */}
          {filteredMonthlyCostRows.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              {lang === 'bn'
                ? 'কোনো মাসের খরচের তথ্য পাওয়া যায়নি।'
                : 'No monthly cost records match your filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="pro-table">
                <thead>
                  <tr>
                    <th className="w-8 text-left whitespace-nowrap">#</th>
                    <th className="w-36 text-left whitespace-nowrap">
                      {lang === 'bn' ? 'মাস' : 'Month'}
                    </th>
                    <th className="min-w-[160px] text-left">
                      {lang === 'bn' ? 'প্রধান খরচের খাত' : 'Major Cost Heads'}
                    </th>
                    <th className="w-28 text-right whitespace-nowrap">
                      {lang === 'bn' ? 'পরিচালন খরচ' : 'Operating Cost'}
                    </th>
                    <th className="w-28 text-right whitespace-nowrap">
                      {lang === 'bn' ? 'মালামাল ক্রয়' : 'Stock Purchase'}
                    </th>
                    <th className="w-20 text-right whitespace-nowrap">
                      {lang === 'bn' ? 'বিক্রির %' : 'OpEx %'}
                    </th>
                    <th className="w-28 text-right whitespace-nowrap">
                      {lang === 'bn' ? 'মোট খরচ' : 'Total Cost'}
                    </th>
                    <th className="w-px text-right whitespace-nowrap">
                      {lang === 'bn' ? 'বিস্তারিত' : 'Details'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMonthlyCostRows.map((row, idx) => {
                    const isExpanded = selectedCostDetailMonth === row.monthKey;
                    const isActiveWorkspaceMonth = row.monthKey === monthKey;
                    return (
                      <tr
                        key={row.monthKey}
                        className={
                          isExpanded
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/30'
                            : 'hover:bg-slate-50/75 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {idx + 1}
                        </td>

                        <td className="whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.monthLabel}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {row.monthKey}
                            {isActiveWorkspaceMonth
                              ? lang === 'bn'
                                ? ' · নির্বাচিত মাস'
                                : ' · Active'
                              : ''}
                          </div>
                        </td>

                        <td>
                          <div className="text-slate-700 dark:text-slate-300 break-words">
                            {row.majorHeadsSummary}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {lang === 'bn'
                              ? `${row.entriesCount} টি এন্ট্রি`
                              : `${row.entriesCount} record(s)`}
                            {row.monthlySales > 0
                              ? ` · ${lang === 'bn' ? 'বিক্রি' : 'Sales'} ${formatBDT(row.monthlySales)}`
                              : ''}
                          </div>
                        </td>

                        <td className="text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {formatBDT(row.operatingCost)}
                        </td>

                        <td className="text-right font-mono tabular-nums whitespace-nowrap">
                          {row.stockPurchaseCost > 0 ? (
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                              {formatBDT(row.stockPurchaseCost)}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {row.opExSharePct !== null ? formatPct(row.opExSharePct) : '—'}
                        </td>

                        <td className="text-right font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                          {formatBDT(row.totalCost)}
                        </td>

                        <td className="text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedCostDetailMonth((curr) =>
                                curr === row.monthKey ? null : row.monthKey
                              )
                            }
                            className={`min-h-[32px] inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                              isExpanded
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <span>{lang === 'bn' ? 'খাতসমূহ' : 'Items'}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/60 font-bold">
                    <td colSpan={3} className="text-slate-900 dark:text-slate-100">
                      {lang === 'bn'
                        ? `সর্বমোট (${filteredMonthlyCostRows.length} মাসের হিসাব)`
                        : `Grand Total (${filteredMonthlyCostRows.length} Months)`}
                    </td>
                    <td className="text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatBDT(monthlyCostTotals.operating)}
                    </td>
                    <td className="text-right font-mono tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">
                      {monthlyCostTotals.stock > 0 ? formatBDT(monthlyCostTotals.stock) : '—'}
                    </td>
                    <td className="text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {monthlyCostTotals.overallOpExPct !== null
                        ? formatPct(monthlyCostTotals.overallOpExPct)
                        : '—'}
                    </td>
                    <td className="text-right font-mono tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">
                      {formatBDT(monthlyCostTotals.total)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Selected Month Itemized Cost Drill-down */}
          {selectedMonthCostDetail && (
            <div className="border-t border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20">
              <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      {lang === 'bn'
                        ? `${selectedMonthCostDetail.monthLabel} — খাতওয়ারী খরচের বিস্তারিত তালিকা`
                        : `${selectedMonthCostDetail.monthLabel} — Itemized Cost Breakdown`}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {selectedMonthCostDetail.monthKey} ·{' '}
                      {lang === 'bn' ? 'মোট ব্যয়:' : 'Total Cost:'}{' '}
                      {formatBDT(selectedMonthCostDetail.totalCost)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      exportExpensesCsv(
                        selectedMonthCostDetail.detailItems,
                        selectedMonthCostDetail.monthKey
                      )
                    }
                    className="min-h-[32px] inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-medium whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openExpenseModalForMonth(selectedMonthCostDetail.monthKey, 'expense')
                    }
                    className="min-h-[32px] inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {lang === 'bn' ? 'এই মাসে খরচ যোগ' : 'Add to Month'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCostDetailMonth(null)}
                    aria-label="Close month details"
                    className="min-h-[32px] px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {selectedMonthCostDetail.detailItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'এই মাসে এখনো কোনো খরচের খাত লিপিবদ্ধ হয়নি।'
                    : 'No itemized cost entries recorded for this month yet.'}
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
                        <th className="min-w-[150px] text-left">
                          {lang === 'bn' ? 'খরচের খাত ও নোট' : 'Category & Note'}
                        </th>
                        <th className="w-36 text-left whitespace-nowrap">
                          {lang === 'bn' ? 'ব্যয়ের ধরন' : 'Cost Type'}
                        </th>
                        <th className="w-28 text-left whitespace-nowrap">
                          {lang === 'bn' ? 'লিপিবদ্ধকারী' : 'Recorded By'}
                        </th>
                        <th className="w-28 text-right whitespace-nowrap">
                          {lang === 'bn' ? 'পরিমাণ' : 'Amount'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedMonthCostDetail.detailItems.map((item, idx) => {
                        const isStockPurchase = item.type === 'inventory_purchase';
                        return (
                          <tr
                            key={item.id}
                            className="bg-white/80 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <td className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                              {idx + 1}
                            </td>
                            <td className="font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {item.date}
                            </td>
                            <td>
                              <div className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                                {lang === 'bn' ? item.categoryBn : item.categoryEn}
                              </div>
                              {item.note && (
                                <div className="text-[11px] text-slate-500 break-words mt-0.5">
                                  {item.note}
                                </div>
                              )}
                            </td>
                            <td className="whitespace-nowrap">
                              <span
                                className={
                                  isStockPurchase
                                    ? 'font-semibold text-amber-700 dark:text-amber-400'
                                    : 'font-medium text-slate-700 dark:text-slate-300'
                                }
                              >
                                {isStockPurchase
                                  ? lang === 'bn'
                                    ? 'মালামাল ক্রয়'
                                    : 'Stock Purchase'
                                  : lang === 'bn'
                                  ? 'পরিচালন খরচ'
                                  : 'Operating Expense'}
                              </span>
                            </td>
                            <td className="text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {item.recordedBy}
                            </td>
                            <td className="text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {formatBDT(item.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Chronological Due Amount & Payment History Section */}
      <div
        ref={historySectionRef}
        className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
      >
        <div className="p-3.5 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start sm:items-center justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
              {lang === 'bn'
                ? 'বাকির হিসাব ও কিস্তি পরিশোধের ইতিহাস (Due History)'
                : 'Due Amount & Installment Payment History'}
            </h2>
            <p className="text-[11px] sm:text-xs leading-snug text-slate-500 mt-0.5">
              {lang === 'bn'
                ? 'পূর্বের বাকি, কোন তারিখে কত টাকা জমা দিয়েছে এবং অবশিষ্ট বাকির ধারাবাহিক তালিকা'
                : 'Chronological record of previous dues, dated partial payments, and remaining balance'}
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setHistorySortAsc((prev) => !prev)}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0"
            >
              <ArrowDownUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {historySortAsc
                  ? lang === 'bn'
                    ? 'তারিখ: পুরাতন → নতুন'
                    : 'Date: Ascending'
                  : lang === 'bn'
                  ? 'তারিখ: নতুন → পুরাতন'
                  : 'Date: Newest First'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => exportDueHistoryCsv(filteredDueHistory)}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 px-2.5 sm:px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'bn' ? 'ইতিহাস CSV' : 'History CSV'}</span>
            </button>
          </div>
        </div>

        {/* History Filter Bar */}
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              {lang === 'bn' ? 'নির্দিষ্ট বাকিদার নির্বাচন করুন' : 'Filter by Customer Account'}
            </label>
            <select
              value={historyCustomerFilter}
              onChange={(e) => setHistoryCustomerFilter(e.target.value)}
              className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium"
            >
              <option value="ALL">
                {lang === 'bn' ? 'সকল ক্রেতার বাকির ইতিহাস' : 'All Customers Due History'}
              </option>
              {credits.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === 'bn' ? c.name : c.nameEn} ({c.phone}) —{' '}
                  {lang === 'bn' ? 'বাকি:' : 'Due:'} {formatBDT(c.balanceDue)}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-7 flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                {lang === 'bn' ? 'নাম, তারিখ বা নোট দিয়ে খুঁজুন' : 'Search by Name, Date or Note'}
              </label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: 2026-11-01, ক্রেতার নাম বা মোবাইল...'
                      : 'e.g., 2026-11-01, customer name or phone...'
                  }
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-8 pr-3 py-1.5 text-xs"
                />
              </div>
            </div>

            {historyCustomerFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setHistoryCustomerFilter('ALL')}
                className="min-h-[38px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
              >
                {lang === 'bn' ? 'সবাই দেখুন' : 'Show All'}
              </button>
            )}
          </div>
        </div>

        {/* Selected Customer Account Summary Strip */}
        {selectedHistoryCustomer && (
          <div className="px-4 py-3 border-b border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/25 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {lang === 'bn' ? selectedHistoryCustomer.name : selectedHistoryCustomer.nameEn}
              </span>
              <span className="font-mono text-slate-500">{selectedHistoryCustomer.phone}</span>
              <span className="text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                {lang === 'bn' ? 'মোট বাকি নিয়েছে:' : 'Total Credit:'}{' '}
                <strong>{formatBDT(selectedHistoryCustomer.totalCreditSales)}</strong>
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                {lang === 'bn' ? 'মোট পরিশোধ:' : 'Total Paid:'}{' '}
                <strong>{formatBDT(selectedHistoryCustomer.totalPaid)}</strong>
              </span>
              <span className="text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                {lang === 'bn' ? 'বর্তমানে অবশিষ্ট বাকি:' : 'Still Due:'}{' '}
                <strong>{formatBDT(selectedHistoryCustomer.balanceDue)}</strong>
              </span>
            </div>

            {selectedHistoryCustomer.balanceDue > 0 && (
              <button
                type="button"
                onClick={() => openCollectModalFor(selectedHistoryCustomer)}
                className="min-h-[32px] inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span>{lang === 'bn' ? 'নতুন কিস্তি জমা নিন' : 'Collect Payment'}</span>
              </button>
            )}
          </div>
        )}

        {/* Chronological Due History Table */}
        {filteredDueHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {lang === 'bn'
              ? 'বাকির কোনো লেনদেন ইতিহাস পাওয়া যায়নি।'
              : 'No due amount or payment history entries found.'}
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
                  <th className="w-40 min-w-[120px] text-left">
                    {lang === 'bn' ? 'ক্রেতার নাম' : 'Customer'}
                  </th>
                  <th className="min-w-[150px] text-left">
                    {lang === 'bn' ? 'লেনদেনের বিবরণ' : 'Transaction Details'}
                  </th>
                  <th className="w-24 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'পূর্বের বাকি' : 'Prev. Due'}
                  </th>
                  <th className="w-24 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'নতুন বাকি (+)' : 'New Due (+)'}
                  </th>
                  <th className="w-24 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'পরিশোধ (-)' : 'Paid (-)'}
                  </th>
                  <th className="w-28 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'অবশিষ্ট বাকি' : 'Remaining'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredDueHistory.map((h, idx) => {
                  const isPayment = h.type === 'due_payment';
                  return (
                    <tr
                      key={h.id}
                      className="hover:bg-slate-50/75 dark:hover:bg-slate-800/40"
                    >
                      <td className="font-mono tabular-nums text-slate-400 whitespace-nowrap">
                        {idx + 1}
                      </td>

                      <td className="whitespace-nowrap">
                        <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                          {h.date}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatReadableDate(h.date, lang)}
                        </div>
                      </td>

                      <td>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                          {lang === 'bn' ? h.customerName : h.customerNameEn || h.customerName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
                          {h.customerPhone}
                        </div>
                      </td>

                      <td>
                        <div
                          className={`font-semibold ${
                            isPayment
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {isPayment
                            ? lang === 'bn'
                              ? 'বাকি পরিশোধ / কিস্তি জমা'
                              : 'Due Payment Received'
                            : h.type === 'opening_due'
                            ? lang === 'bn'
                              ? 'পূর্বের বাকি সংযোজন'
                              : 'Previous / Opening Due'
                            : lang === 'bn'
                            ? 'বাকিতে পণ্য ক্রয়'
                            : 'Credit Sale Due'}
                        </div>
                        <div className="text-[11px] text-slate-500 break-words mt-0.5">
                          {[h.paymentMethod, h.invoiceNo, h.note].filter(Boolean).join(' · ') ||
                            '—'}
                        </div>
                      </td>

                      <td className="text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatBDT(h.previousDue)}
                      </td>

                      <td className="text-right font-mono tabular-nums whitespace-nowrap">
                        {h.creditAdded > 0 ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-400">
                            +{formatBDT(h.creditAdded)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="text-right font-mono tabular-nums whitespace-nowrap">
                        {h.paidAmount > 0 ? (
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            -{formatBDT(h.paidAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            h.balanceAfter > 0
                              ? 'text-rose-700 dark:text-rose-400'
                              : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {formatBDT(h.balanceAfter)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collect Credit Payment Modal */}
      <AppPopupModal
        isOpen={Boolean(collectTarget)}
        onClose={() => setCollectTarget(null)}
        maxWidthClass="max-w-3xl"
        heightMode="screen"
        ariaLabel={
          collectTarget
            ? `${t.collectDue}: ${lang === 'bn' ? collectTarget.name : collectTarget.nameEn}`
            : t.collectDue
        }
      >
        {collectTarget && (
          <form onSubmit={handleConfirmCollect} className="flex-1 min-h-0 flex flex-col text-xs">
            <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {t.collectDue}: {lang === 'bn' ? collectTarget.name : collectTarget.nameEn}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    {collectTarget.phone} · Due Date: {collectTarget.dueDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCollectTarget(null)}
                aria-label="Close"
                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4 space-y-4">
              {/* Live Running Balance Preview */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="neu-well rounded-xl bg-slate-100/90 dark:bg-slate-950 p-3 min-w-0">
                  <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                    {lang === 'bn' ? 'পূর্বের বাকি' : 'Previous Due'}
                  </div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatBDT(collectTarget.balanceDue)}
                  </div>
                </div>
                <div className="neu-well rounded-xl bg-emerald-50/75 dark:bg-emerald-950/35 p-3 min-w-0">
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 truncate whitespace-nowrap">
                    {lang === 'bn' ? 'আজকের জমা' : 'Paying Now'}
                  </div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    -{formatBDT(previewPayingAmount)}
                  </div>
                </div>
                <div className="neu-well rounded-xl bg-rose-50/70 dark:bg-rose-950/30 p-3 min-w-0">
                  <div className="text-[11px] text-rose-800 dark:text-rose-300 truncate whitespace-nowrap">
                    {lang === 'bn' ? 'অবশিষ্ট বাকি' : 'Still Due'}
                  </div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-rose-700 dark:text-rose-400 whitespace-nowrap">
                    {formatBDT(previewRemainingDue)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {lang === 'bn' ? 'আদায়কৃত টাকা (৳) *' : 'Amount Collected (৳) *'}
                    </label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setCollectAmount(String(Math.ceil(collectTarget.balanceDue / 2)))
                        }
                        className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-mono font-semibold whitespace-nowrap"
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => setCollectAmount(String(collectTarget.balanceDue))}
                        className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[11px] font-mono font-semibold whitespace-nowrap"
                      >
                        {lang === 'bn' ? 'পূর্ণ পরিশোধ' : 'Full Due'}
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={collectTarget.balanceDue}
                    required
                    value={collectAmount}
                    onChange={(e) => setCollectAmount(e.target.value)}
                    className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono tabular-nums text-sm font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {lang === 'bn' ? 'জমার তারিখ *' : 'Payment Date *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={collectDate}
                      onChange={(e) => setCollectDate(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {lang === 'bn' ? 'পেমেন্ট মাধ্যম' : 'Payment Method'}
                    </label>
                    <select
                      value={collectMethod}
                      onChange={(e) => setCollectMethod(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-medium"
                    >
                      <option value="Cash">{lang === 'bn' ? 'নগদ (Cash)' : 'Cash'}</option>
                      <option value="bKash / Nagad">
                        {lang === 'bn' ? 'বিকাশ / নগদ' : 'bKash / Nagad'}
                      </option>
                      <option value="Card / Bank">
                        {lang === 'bn' ? 'কার্ড / ব্যাংক' : 'Card / Bank'}
                      </option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {lang === 'bn' ? 'নোট / বিবরণ (ঐচ্ছিক)' : 'Reference Note (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={collectNote}
                    onChange={(e) => setCollectNote(e.target.value)}
                    placeholder={
                      lang === 'bn'
                        ? 'যেমন: ১ম কিস্তি পরিশোধ / আংশিক জমা'
                        : 'e.g., Installment payment received'
                    }
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCollectTarget(null)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold whitespace-nowrap"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                {t.confirmAction}
              </button>
            </div>
          </form>
        )}
      </AppPopupModal>

      {/* Add Previous / New Customer Due Modal */}
      <AppPopupModal
        isOpen={showAddDueModal}
        onClose={() => setShowAddDueModal(false)}
        maxWidthClass="max-w-3xl"
        heightMode="screen"
        ariaLabel={
          lang === 'bn'
            ? 'পূর্বের বাকি / নতুন বাকি যোগ করুন'
            : 'Record Previous or Additional Due'
        }
      >
        <form onSubmit={handleConfirmAddDue} className="flex-1 min-h-0 flex flex-col text-xs">
          <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <UserPlus className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
                  {lang === 'bn'
                    ? 'পূর্বের বাকি / নতুন বাকি যোগ করুন'
                    : 'Record Previous or Additional Due'}
                </h3>
                <p className="text-[11px] leading-snug text-slate-500">
                  {lang === 'bn'
                    ? 'নতুন ক্রেতা অথবা পুরাতন ক্রেতার বাকির খাতায় হিসাব যুক্ত করুন'
                    : 'Add opening or additional credit balance to a new or existing customer'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDueModal(false)}
              aria-label="Close"
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4 space-y-4">
            {credits.length > 0 && (
              <div className="neu-well grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-950 p-1">
                <button
                  type="button"
                  onClick={() => setDueCustomerMode('new')}
                  className={`min-h-[36px] rounded-lg font-semibold whitespace-nowrap truncate px-3 ${
                    dueCustomerMode === 'new'
                      ? 'bg-amber-600 text-white'
                      : 'neu-flat text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {lang === 'bn' ? 'নতুন বাকিদার' : 'New Customer'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDueCustomerMode('existing');
                    if (!selectedExistingCustId && credits[0]) {
                      setSelectedExistingCustId(credits[0].id);
                    }
                  }}
                  className={`min-h-[36px] rounded-lg font-semibold whitespace-nowrap truncate px-3 ${
                    dueCustomerMode === 'existing'
                      ? 'bg-amber-600 text-white'
                      : 'neu-flat text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {lang === 'bn' ? 'পুরাতন ক্রেতার খাতায়' : 'Existing Customer'}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {dueCustomerMode === 'existing' && credits.length > 0 ? (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {lang === 'bn' ? 'ক্রেতা নির্বাচন করুন *' : 'Select Customer *'}
                  </label>
                  <select
                    required
                    value={selectedExistingCustId}
                    onChange={(e) => setSelectedExistingCustId(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-medium"
                  >
                    {credits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) — {lang === 'bn' ? 'বর্তমান বাকি:' : 'Current Due:'}{' '}
                        {formatBDT(c.balanceDue)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {lang === 'bn' ? 'ক্রেতার নাম *' : 'Customer Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={newDueName}
                      onChange={(e) => setNewDueName(e.target.value)}
                      placeholder={lang === 'bn' ? 'ক্রেতার নাম লিখুন' : 'Customer full name'}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                    </label>
                    <input
                      type="text"
                      value={newDuePhone}
                      onChange={(e) => setNewDuePhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'বাকির পরিমাণ (৳) *' : 'Due Amount (৳) *'}
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newDueAmount}
                  onChange={(e) => setNewDueAmount(e.target.value)}
                  placeholder="2000"
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono tabular-nums text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {lang === 'bn' ? 'বাকির তারিখ *' : 'Entry Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueEntryDate}
                    onChange={(e) => setNewDueEntryDate(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    {lang === 'bn' ? 'পরিশোধের তারিখ' : 'Expected Due Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newDueRepayDate}
                    onChange={(e) => setNewDueRepayDate(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'নোট / পণ্যের বিবরণ' : 'Note / Details'}
                </label>
                <input
                  type="text"
                  value={newDueNote}
                  onChange={(e) => setNewDueNote(e.target.value)}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: পূর্বের খাতার বাকি / মাল ক্রয় বাবদ'
                      : 'e.g., Previous ledger due balance'
                  }
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddDueModal(false)}
              className="min-h-[38px] px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold whitespace-nowrap"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-amber-600 font-bold text-white hover:bg-amber-700 whitespace-nowrap"
            >
              {t.confirmAction}
            </button>
          </div>
        </form>
      </AppPopupModal>

      {/* Add Expense / Servicing Income Modal */}
      <AppPopupModal
        isOpen={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        maxWidthClass="max-w-3xl"
        heightMode="screen"
        ariaLabel={t.addExpense}
      >
        <form onSubmit={handleCreateExpense} className="flex-1 min-h-0 flex flex-col text-xs">
          <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
                  {t.addExpense}
                </h3>
                <p className="text-[11px] leading-snug text-slate-500">
                  {lang === 'bn'
                    ? 'দোকানের পরিচালন খরচ, মালামাল ক্রয় অথবা সার্ভিসিং আয় লিপিবদ্ধ করুন'
                    : 'Record shop operating expense, stock purchase, or servicing income'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowExpenseModal(false)}
              aria-label="Close"
              className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'হিসাবের ধরন *' : 'Entry Type *'}
                </label>
                <select
                  value={expType}
                  onChange={(e) => setExpType(e.target.value as ExpenseEntry['type'])}
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-semibold"
                >
                  <option value="expense">
                    {lang === 'bn' ? 'পরিচালন খরচ (Operating Expense)' : 'Operating Expense'}
                  </option>
                  <option value="inventory_purchase">
                    {lang === 'bn' ? 'মালামাল ক্রয় খরচ (Stock Purchase)' : 'Wholesale Stock Purchase'}
                  </option>
                  <option value="other_income">
                    {lang === 'bn' ? 'সার্ভিসিং / অন্যান্য আয় (Other Income)' : 'Servicing / Commission Income'}
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'তারিখ (মাস নির্ধারণ হবে) *' : 'Entry Date (Sets Month) *'}
                </label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 truncate">
                {lang === 'bn' ? 'খরচ / আয়ের খাত *' : 'Category Head *'}
              </label>
              <input
                type="text"
                required
                value={expCategoryBn}
                onChange={(e) => setExpCategoryBn(e.target.value)}
                className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                {[
                  'দোকান ভাড়া (Shop Rent)',
                  'স্টাফ বেতন (Staff Salary)',
                  'বিদ্যুৎ ও ইন্টারনেট (Utilities)',
                  'পরিবহন ও ডেলিভারি (Transport)',
                  'মেরামত ও রক্ষণাবেক্ষণ (Maintenance)',
                  'মালামাল ক্রয় (Stock Purchase)',
                  'সার্ভিসিং আয় (Service Income)',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setExpCategoryBn(preset)}
                    className={`min-h-[30px] px-2.5 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 ${
                      expCategoryBn === preset
                        ? 'bg-emerald-600 text-white'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                {lang === 'bn' ? 'টাকার পরিমাণ (৳) *' : 'Amount (৳) *'}
              </label>
              <input
                type="number"
                min={1}
                required
                value={expAmount}
                onChange={(e) => setExpAmount(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono tabular-nums text-sm font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                {lang === 'bn' ? 'নোট / বিবরণ (ঐচ্ছিক)' : 'Reference Note (Optional)'}
              </label>
              <input
                type="text"
                value={expNote}
                onChange={(e) => setExpNote(e.target.value)}
                placeholder={
                  lang === 'bn'
                    ? 'যেমন: নভেম্বর মাসের দোকান ভাড়া বা চালান নং'
                    : 'Optional reference note'
                }
                className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
              />
            </div>
          </div>

          <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowExpenseModal(false)}
              className="min-h-[38px] px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold whitespace-nowrap"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 whitespace-nowrap"
            >
              {t.confirmAction}
            </button>
          </div>
        </form>
      </AppPopupModal>
    </div>
  );
};
