import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Barcode,
  Building2,
  CheckCircle2,
  Coins,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  History,
  Key,
  KeyRound,
  LogOut,
  Megaphone,
  Moon,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Sun,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  UserRole,
  type AuthSessionUser,
  type LanguageCode,
  type ShopAccountStatus,
  type ShopReceiptPaperFormat,
  type ShopSubscriptionPlan,
  type ShopTenantSummary,
  type SubscriptionInvoiceRecord,
  type SubscriptionPaymentStatus,
  type SuperAdminOverviewResponse,
} from '../types/pos';
import { formatBDT, formatPct } from '../i18n/translations';
import {
  GOOGLE_APPS_SCRIPT_BRIDGE_CODE,
  connectMasterAdminGoogleSheet,
  createGoogleSheetForShopAdmin,
  createNewTenantShop,
  deleteTenantShop,
  fetchSuperAdminOverview,
  generateMonthlyInvoices,
  pullCredentialsFromMasterGoogleSheet,
  recordSubscriptionPayment,
  syncMasterAdminGoogleSheet,
  updateSuperAdminSettings,
  updateTenantShop,
} from '../lib/googleWorkspace';
import {
  exportSuperAdminShopsSummaryCsv,
  exportSuperAdminSubscriptionsCsv,
} from '../lib/exportReports';
import { downloadSubscriptionInvoicePdf } from '../lib/pdfGenerator';
import { AppPopupModal } from './AppPopupModal';
import { ConfirmActionModal, type ConfirmDialogState } from './ConfirmActionModal';
import { PWAInstallButton } from './PWAInstallButton';
import { SuperAdminSkeleton } from './SkeletonScreens';

interface SuperAdminPortalProps {
  session: AuthSessionUser;
  lang: LanguageCode;
  darkMode: boolean;
  onToggleLang: () => void;
  onToggleDark: () => void;
  onLogout: () => void;
  onInspectShopPos: (shopId: string) => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

type SuperAdminTab = 'overview' | 'shops' | 'subscriptions' | 'engine_settings';

const SHOP_AVATAR_TINTS = [
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
];

// Color-preserving Neumorphism utility presets (harmonized with global button:not(.neu-flat) animations)
const NEU_SOLID_BTN = 'border border-white/20 dark:border-white/10';

const NEU_SURFACE_BTN =
  'bg-slate-50/95 dark:bg-slate-800/85 border border-white/85 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100/90 dark:hover:bg-slate-800';

const NEU_TINT_BTN = '';

const NEU_INSET_TRACK = 'neu-well';

export const SuperAdminPortal: React.FC<SuperAdminPortalProps> = ({
  session,
  lang,
  darkMode,
  onToggleLang,
  onToggleDark,
  onLogout,
  onInspectShopPos,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('overview');
  const [overview, setOverview] = useState<SuperAdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchShop, setSearchShop] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ShopAccountStatus>('ALL');

  // Create New Shop Modal / Form State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [newShopNameBn, setNewShopNameBn] = useState('');
  const [newShopNameEn, setNewShopNameEn] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('Grocery / সুপার শপ');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('123456');
  const [newPlan, setNewPlan] = useState<ShopSubscriptionPlan>('Business');
  const [newMonthlyFee, setNewMonthlyFee] = useState<string>('1000');
  const [newBillingStatus, setNewBillingStatus] = useState<SubscriptionPaymentStatus>('Paid');
  const [newAutoCreateSheet, setNewAutoCreateSheet] = useState<boolean>(true);
  const [newCustomSheetUrl, setNewCustomSheetUrl] = useState('');
  const [newReceiptFormat, setNewReceiptFormat] = useState<ShopReceiptPaperFormat>('pos_thermal');
  const [newEnableEcommerce, setNewEnableEcommerce] = useState(true);
  const [newEnableCredit, setNewEnableCredit] = useState(true);
  const [newMaxStaff, setNewMaxStaff] = useState('10');

  // Edit Existing Shop Modal State
  const [editingShop, setEditingShop] = useState<ShopTenantSummary | null>(null);
  const [editNameBn, setEditNameBn] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editBusinessType, setEditBusinessType] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editOwnerName, setEditOwnerName] = useState('');
  const [editOwnerEmail, setEditOwnerEmail] = useState('');
  const [editOwnerNewPass, setEditOwnerNewPass] = useState('');
  const [editStatus, setEditStatus] = useState<ShopAccountStatus>('Active');
  const [editPlan, setEditPlan] = useState<ShopSubscriptionPlan>('Business');
  const [editFee, setEditFee] = useState('1000');
  const [editBillingStatus, setEditBillingStatus] = useState<SubscriptionPaymentStatus>('Paid');
  const [editNextBillingDate, setEditNextBillingDate] = useState('');
  const [editSheetUrl, setEditSheetUrl] = useState('');
  const [editReceiptFormat, setEditReceiptFormat] = useState<ShopReceiptPaperFormat>('pos_thermal');
  const [editEnableEcom, setEditEnableEcom] = useState(true);
  const [editEnableCredit, setEditEnableCredit] = useState(true);
  const [editEnableExports, setEditEnableExports] = useState(true);
  const [editMaxStaff, setEditMaxStaff] = useState('10');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Subscription Billing Filter & Payment Modal
  const [invoiceMonthFilter, setInvoiceMonthFilter] = useState<string>('ALL');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'ALL' | SubscriptionPaymentStatus>('ALL');
  const [invoiceShopFilter, setInvoiceShopFilter] = useState<string>('ALL');
  const [generateMonthInput, setGenerateMonthInput] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [payingInvoice, setPayingInvoice] = useState<SubscriptionInvoiceRecord | null>(null);
  const [payStatus, setPayStatus] = useState<SubscriptionPaymentStatus>('Paid');
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('bKash / Nagad');
  const [payNote, setPayNote] = useState<string>('');
  const [payDueDate, setPayDueDate] = useState<string>('');
  const [payReceiptNo, setPayReceiptNo] = useState<string>('');
  const [payPlan, setPayPlan] = useState<ShopSubscriptionPlan>('Business');

  // Quick Password View & Edit State for Shop Owners
  const [revealedShopPasswords, setRevealedShopPasswords] = useState<Record<string, boolean>>({});
  const [quickPassShop, setQuickPassShop] = useState<ShopTenantSummary | null>(null);
  const [quickNewPassword, setQuickNewPassword] = useState<string>('');
  const [isSavingQuickPass, setIsSavingQuickPass] = useState(false);

  // Engine & Platform Settings Form State
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [masterSheetUrlInput, setMasterSheetUrlInput] = useState('');
  const [autoCreateSheetToggle, setAutoCreateSheetToggle] = useState(true);
  const [globalNoticeInput, setGlobalNoticeInput] = useState('');
  const [tierStarter, setTierStarter] = useState('500');
  const [tierBusiness, setTierBusiness] = useState('1000');
  const [tierEnterprise, setTierEnterprise] = useState('2000');
  const [tierCustom, setTierCustom] = useState('750');
  const [adminNameInput, setAdminNameInput] = useState('');
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminNewPasswordInput, setAdminNewPasswordInput] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [busyMasterAction, setBusyMasterAction] = useState<'connect' | 'sync' | 'pull' | null>(null);
  const [revealedUserIds, setRevealedUserIds] = useState<Record<string, boolean>>({});
  const [busySheetShopId, setBusySheetShopId] = useState<string | null>(null);

  // Confirm Modal State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSuperAdminOverview(session.token);
      setOverview(data);
      setAppsScriptUrl(data.googleSheetsEngine.appsScriptWebAppUrl || '');
      setMasterSheetUrlInput(data.googleSheetsEngine.masterDirectorySheetUrl || '');
      setAutoCreateSheetToggle(data.googleSheetsEngine.autoCreateSheetForNewShop);
      setGlobalNoticeInput(data.globalAnnouncement || '');
      setTierStarter(String(data.planPricing.Starter ?? 500));
      setTierBusiness(String(data.planPricing.Business ?? 1000));
      setTierEnterprise(String(data.planPricing.Enterprise ?? 2000));
      setTierCustom(String(data.planPricing.Custom ?? 750));
      setAdminNameInput(data.superAdminProfile.name);
      setAdminEmailInput(data.superAdminProfile.email);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed loading Super Admin data', true);
    } finally {
      setLoading(false);
    }
  }, [session.token, onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Platform-wide Aggregated Metrics & Monthly Subscription Summary
  const summaryStats = useMemo(() => {
    const shops = overview?.shops || [];
    const invoices = overview?.invoices || [];

    const activeShops = shops.filter((s) => s.status === 'Active').length;
    const trialShops = shops.filter((s) => s.status === 'Trial').length;
    const suspendedShops = shops.filter((s) => s.status === 'Suspended').length;

    const expectedMrr = shops
      .filter((s) => s.status !== 'Suspended')
      .reduce((acc, s) => acc + s.monthlySubscriptionFee, 0);
    const annualizedArr = expectedMrr * 12;

    const totalCollectedFees = invoices
      .filter((i) => i.status === 'Paid')
      .reduce((acc, i) => acc + i.amount, 0);
    const totalPendingOverdueFees = invoices
      .filter((i) => i.status === 'Pending' || i.status === 'Overdue')
      .reduce((acc, i) => acc + i.amount, 0);

    const billableTotal = totalCollectedFees + totalPendingOverdueFees;
    const collectionRate = billableTotal > 0 ? (totalCollectedFees / billableTotal) * 100 : 100;

    const platformMonthlySales = shops.reduce((acc, s) => acc + s.metrics.monthlySales, 0);
    const platformNetProfit = shops.reduce((acc, s) => acc + s.metrics.monthlyNetProfit, 0);
    const platformStockValue = shops.reduce((acc, s) => acc + s.metrics.stockValue, 0);
    const platformTotalSkus = shops.reduce((acc, s) => acc + s.metrics.skuCount, 0);
    const platformTotalReceivables = shops.reduce((acc, s) => acc + s.metrics.totalReceivable, 0);

    return {
      totalShops: shops.length,
      activeShops,
      trialShops,
      suspendedShops,
      expectedMrr,
      annualizedArr,
      totalCollectedFees,
      totalPendingOverdueFees,
      collectionRate,
      platformMonthlySales,
      platformNetProfit,
      platformStockValue,
      platformTotalSkus,
      platformTotalReceivables,
    };
  }, [overview]);

  const filteredShops = useMemo(() => {
    const list = overview?.shops || [];
    const q = searchShop.trim().toLowerCase();
    return list.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.shopNameBn.toLowerCase().includes(q) ||
        s.shopNameEn.toLowerCase().includes(q) ||
        s.ownerEmail.toLowerCase().includes(q) ||
        s.ownerName.toLowerCase().includes(q) ||
        s.businessType.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q)
      );
    });
  }, [overview, searchShop, statusFilter]);

  const filteredInvoices = useMemo(() => {
    const list = overview?.invoices || [];
    return list.filter((inv) => {
      if (invoiceMonthFilter !== 'ALL' && inv.monthKey !== invoiceMonthFilter) return false;
      if (invoiceStatusFilter !== 'ALL' && inv.status !== invoiceStatusFilter) return false;
      if (invoiceShopFilter !== 'ALL' && inv.shopId !== invoiceShopFilter) return false;
      return true;
    });
  }, [overview, invoiceMonthFilter, invoiceStatusFilter, invoiceShopFilter]);

  const uniqueInvoiceMonths = useMemo(() => {
    const set = new Set<string>((overview?.invoices || []).map((i) => i.monthKey));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [overview]);

  const openEditShopModal = (shop: ShopTenantSummary) => {
    setEditingShop(shop);
    setEditNameBn(shop.shopNameBn);
    setEditNameEn(shop.shopNameEn);
    setEditBusinessType(shop.businessType);
    setEditPhone(shop.phone);
    setEditAddress(shop.address);
    setEditOwnerName(shop.ownerName);
    setEditOwnerEmail(shop.ownerEmail);
    setEditOwnerNewPass('');
    setEditStatus(shop.status);
    setEditPlan(shop.plan);
    setEditFee(String(shop.monthlySubscriptionFee));
    setEditBillingStatus(shop.billingStatus);
    setEditNextBillingDate(shop.nextBillingDate);
    setEditSheetUrl(shop.sheetConfig.spreadsheetUrl || '');
    setEditReceiptFormat(shop.receiptFormat || 'pos_thermal');
    setEditEnableEcom(shop.entitlements.enableEcommerce);
    setEditEnableCredit(shop.entitlements.enableCreditLedger);
    setEditEnableExports(shop.entitlements.enableAuditExports);
    setEditMaxStaff(String(shop.entitlements.maxStaffAccounts || 10));
  };

  const handleCreateShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopNameBn.trim() && !newShopNameEn.trim()) return;
    setIsCreatingShop(true);
    try {
      const res = await createNewTenantShop(session.token, {
        shopNameBn: newShopNameBn.trim() || newShopNameEn.trim(),
        shopNameEn: newShopNameEn.trim() || newShopNameBn.trim(),
        businessType: newBusinessType.trim(),
        address: newAddress.trim(),
        phone: newPhone.trim(),
        ownerName: newOwnerName.trim() || `${newShopNameEn || newShopNameBn} Owner`,
        ownerEmail: newOwnerEmail.trim().toLowerCase(),
        ownerPassword: newOwnerPassword.trim(),
        plan: newPlan,
        monthlySubscriptionFee: Math.max(0, Number(newMonthlyFee) || 0),
        billingStatus: newBillingStatus,
        receiptFormat: newReceiptFormat,
        autoCreateGoogleSheet: newAutoCreateSheet,
        customSheetUrl: newCustomSheetUrl.trim() || undefined,
        entitlements: {
          enableEcommerce: newEnableEcommerce,
          enableCreditLedger: newEnableCredit,
          enableAuditExports: true,
          maxStaffAccounts: Math.max(1, Number(newMaxStaff) || 10),
        },
      });

      onNotify(
        lang === 'bn'
          ? `নতুন দোকান "${res.shop.shopNameBn}" তৈরি সম্পন্ন! মালিক ইমেইল: ${res.shop.ownerEmail}`
          : `Created new shop "${res.shop.shopNameEn}"! ${res.sheetCreationNote}`
      );
      setNewShopNameBn('');
      setNewShopNameEn('');
      setNewPhone('');
      setNewAddress('');
      setNewOwnerName('');
      setNewOwnerEmail('');
      setNewCustomSheetUrl('');
      setNewReceiptFormat('pos_thermal');
      setShowCreateModal(false);
      await loadData();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed creating shop', true);
    } finally {
      setIsCreatingShop(false);
    }
  };

  const handleSaveShopEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop) return;
    setIsSavingEdit(true);
    try {
      await updateTenantShop(session.token, editingShop.shopId, {
        shopNameBn: editNameBn,
        shopNameEn: editNameEn,
        businessType: editBusinessType,
        phone: editPhone,
        address: editAddress,
        ownerName: editOwnerName,
        ownerEmail: editOwnerEmail,
        ownerPassword: editOwnerNewPass.trim() || undefined,
        status: editStatus,
        plan: editPlan,
        monthlySubscriptionFee: Math.max(0, Number(editFee) || 0),
        billingStatus: editBillingStatus,
        nextBillingDate: editNextBillingDate,
        sheetUrl: editSheetUrl,
        receiptFormat: editReceiptFormat,
        entitlements: {
          enableEcommerce: editEnableEcom,
          enableCreditLedger: editEnableCredit,
          enableAuditExports: editEnableExports,
          maxStaffAccounts: Math.max(1, Number(editMaxStaff) || 10),
        },
      });
      onNotify(
        lang === 'bn'
          ? `"${editNameBn}" দোকানের তথ্য ও মাসিক ফি আপডেট হয়েছে।`
          : `Updated shop "${editNameEn}" and subscription settings.`
      );
      setEditingShop(null);
      await loadData();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed updating shop', true);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRequestDeleteShop = (shop: ShopTenantSummary) => {
    setConfirmDialog({
      isOpen: true,
      title:
        lang === 'bn'
          ? `"${shop.shopNameBn}" দোকানটি স্থায়ীভাবে মুছে ফেলবেন?`
          : `Delete Shop "${shop.shopNameEn}" Permanently?`,
      description:
        lang === 'bn'
          ? 'দোকানটির POS ড্যাশবোর্ড, মালিক ও স্টাফ লগইন অ্যাকাউন্ট এবং সাবস্ক্রিপশন রেকর্ড মুছে যাবে (আপনার গুগল ড্রাইভের শিট নিরাপদ থাকবে)।'
          : 'This removes the shop workspace, staff login accounts, and billing records from the platform (any existing Google Sheet in Drive remains untouched).',
      affectedSummary: `${shop.shopNameEn} · Owner: ${shop.ownerEmail} · ${shop.metrics.skuCount} SKUs`,
      confirmLabel: lang === 'bn' ? 'দোকান ডিলিট করুন' : 'Delete Shop',
      variant: 'danger',
      onConfirm: async () => {
        await deleteTenantShop(session.token, shop.shopId);
        onNotify(
          lang === 'bn'
            ? `"${shop.shopNameBn}" মুছে ফেলা হয়েছে।`
            : `Deleted shop "${shop.shopNameEn}".`
        );
        await loadData();
      },
    });
  };

  const handleProvisionGoogleSheetNow = async (shop: ShopTenantSummary) => {
    setBusySheetShopId(shop.shopId);
    try {
      const res = await createGoogleSheetForShopAdmin(session.token, shop.shopId);
      onNotify(
        lang === 'bn'
          ? `নতুন গুগল শিট তৈরি ও সংযুক্ত হয়েছে: ${res.sheetConfig.spreadsheetTitle}`
          : `Auto-created Google Sheet: ${res.sheetConfig.spreadsheetTitle}`
      );
      await loadData();
    } catch (err: unknown) {
      onNotify(
        err instanceof Error ? err.message : 'Sheet auto-creation requires Apps Script URL',
        true
      );
      setActiveTab('engine_settings');
    } finally {
      setBusySheetShopId(null);
    }
  };

  const getShopOwnerPassword = useCallback(
    (shopId: string): string => {
      if (!overview?.credentialVault) return '';
      const item = overview.credentialVault.find(
        (c) => c.shopId === shopId && c.role === UserRole.OWNER
      );
      return item?.passwordPlain || '';
    },
    [overview?.credentialVault]
  );

  const handleSaveQuickPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPassShop || !quickNewPassword.trim()) return;
    setIsSavingQuickPass(true);
    try {
      await updateTenantShop(session.token, quickPassShop.shopId, {
        ownerPassword: quickNewPassword.trim(),
      });
      onNotify(
        lang === 'bn'
          ? `"${quickPassShop.shopNameBn}" এর পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!`
          : `Password updated successfully for "${quickPassShop.shopNameEn}"!`
      );
      setQuickPassShop(null);
      setQuickNewPassword('');
      await loadData();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed updating password', true);
    } finally {
      setIsSavingQuickPass(false);
    }
  };

  const handleSavePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice) return;
    try {
      await recordSubscriptionPayment(session.token, {
        invoiceId: payingInvoice.id,
        status: payStatus,
        amount: Math.max(0, Number(payAmount) || 0),
        paymentMethod: payMethod,
        note: payNote,
        dueDate: payDueDate,
        receiptNo: payReceiptNo,
        plan: payPlan,
      });
      onNotify(
        lang === 'bn'
          ? 'সাবস্ক্রিপশন ইনভয়েস সফলভাবে সংরক্ষিত হয়েছে!'
          : 'Subscription invoice updated and saved successfully!'
      );
      setPayingInvoice(null);
      await loadData();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed updating invoice', true);
    }
  };

  const handleGenerateMonthBills = async () => {
    try {
      const res = await generateMonthlyInvoices(session.token, generateMonthInput);
      onNotify(
        lang === 'bn'
          ? `${generateMonthInput} মাসের জন্য ${res.createdCount} টি নতুন সাবস্ক্রিপশন বিল তৈরি হয়েছে।`
          : `Generated ${res.createdCount} new monthly subscription invoice(s) for ${generateMonthInput}.`
      );
      await loadData();
    } catch (err: unknown) {
      onNotify(
        err instanceof Error ? err.message : 'Failed generating monthly invoices',
        true
      );
    }
  };

  const handleConnectMasterSheetNow = async () => {
    if (!appsScriptUrl.trim()) {
      onNotify(
        lang === 'bn'
          ? 'প্রথমে ধাপ ১-৩ অনুসরণ করে Google Apps Script Web App URL পেস্ট করুন।'
          : 'Paste your Google Apps Script Web App URL (from Steps 1-3) first.',
        true
      );
      return;
    }
    setBusyMasterAction('connect');
    try {
      const res = await connectMasterAdminGoogleSheet(session.token, {
        appsScriptWebAppUrl: appsScriptUrl.trim(),
        masterSheetUrlOrId: masterSheetUrlInput.trim() || undefined,
      });
      onNotify(res.message);
      await loadData();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Master Sheet connection failed', true);
    } finally {
      setBusyMasterAction(null);
    }
  };

  const handleSyncMasterSheetNow = async () => {
    setBusyMasterAction('sync');
    try {
      const res = await syncMasterAdminGoogleSheet(session.token);
      onNotify(
        lang === 'bn'
          ? `মাস্টার গুগল শিটে ${res.syncedUsersCount}টি লগইন পাসওয়ার্ড ও ${res.syncedShopsCount}টি দোকানের তথ্য সিঙ্ক হয়েছে!`
          : `Synced ${res.syncedUsersCount} login password(s) and ${res.syncedShopsCount} shop(s) to Master Google Sheet!`
      );
      await loadData();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Sync failed', true);
    } finally {
      setBusyMasterAction(null);
    }
  };

  const handlePullMasterSheetCredentials = async () => {
    setBusyMasterAction('pull');
    try {
      const res = await pullCredentialsFromMasterGoogleSheet(session.token);
      onNotify(res.message);
      await loadData();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Pull from Google Sheet failed', true);
    } finally {
      setBusyMasterAction(null);
    }
  };

  const handleSaveEngineAndSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await updateSuperAdminSettings(session.token, {
        globalAnnouncement: globalNoticeInput,
        planPricing: {
          Starter: Math.max(0, Number(tierStarter) || 500),
          Business: Math.max(0, Number(tierBusiness) || 1000),
          Enterprise: Math.max(0, Number(tierEnterprise) || 2000),
          Custom: Math.max(0, Number(tierCustom) || 750),
        },
        googleSheetsEngine: {
          appsScriptWebAppUrl: appsScriptUrl.trim(),
          masterDirectorySheetUrl: masterSheetUrlInput.trim(),
          autoCreateSheetForNewShop: autoCreateSheetToggle,
        },
        adminName: adminNameInput.trim(),
        adminEmail: adminEmailInput.trim(),
        adminNewPassword: adminNewPasswordInput.trim() || undefined,
      });
      setAdminNewPasswordInput('');
      onNotify(
        lang === 'bn'
          ? 'গুগল শিট ইঞ্জিন ও প্ল্যাটফর্ম সেটিংস সংরক্ষিত হয়েছে!'
          : 'Google Sheets Engine and Super Admin settings saved!'
      );
      await loadData();
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Failed saving settings', true);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDownloadJsonBackup = () => {
    if (!overview) return;
    const blob = new Blob([JSON.stringify(overview, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MHS_POS_SuperAdmin_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const executeConfirmDialog = async () => {
    if (!confirmDialog) return;
    setIsConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Action failed', true);
    } finally {
      setIsConfirmBusy(false);
    }
  };

  const chartData = useMemo(
    () =>
      (overview?.shops || []).map((s) => ({
        name: lang === 'bn' ? s.shopNameBn.slice(0, 18) : s.shopNameEn.slice(0, 18),
        sales: s.metrics.monthlySales,
        stockValue: s.metrics.stockValue,
        fee: s.monthlySubscriptionFee,
      })),
    [overview, lang]
  );

  const isSheetsConnected = Boolean(overview?.googleSheetsEngine.appsScriptWebAppUrl);

  const superAdminNavItems: Array<{
    id: SuperAdminTab;
    label: string;
    shortLabel: string;
    accentBg: string;
    accentText: string;
    activeClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'overview',
      label: lang === 'bn' ? 'সার্বিক চিত্র (Overview)' : 'Overview',
      shortLabel: lang === 'bn' ? 'ওভারভিউ' : 'Overview',
      accentBg: 'bg-indigo-50 dark:bg-indigo-950/40',
      accentText: 'text-indigo-600 dark:text-indigo-400',
      activeClass: 'bg-indigo-600 text-white',
      icon: Building2,
    },
    {
      id: 'shops',
      label: lang === 'bn' ? 'দোকানসমূহ (Shops)' : 'Manage Shops',
      shortLabel: lang === 'bn' ? 'দোকানসমূহ' : 'Shops',
      accentBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      activeClass: 'bg-emerald-600 text-white',
      icon: Store,
    },
    {
      id: 'subscriptions',
      label: lang === 'bn' ? 'মাসিক সাবস্ক্রিপশন ফি' : 'Subscriptions',
      shortLabel: lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Billing',
      accentBg: 'bg-sky-50 dark:bg-sky-950/40',
      accentText: 'text-sky-600 dark:text-sky-400',
      activeClass: 'bg-sky-600 text-white',
      icon: CreditCard,
    },
    {
      id: 'engine_settings',
      label: lang === 'bn' ? 'গুগল শিট ও সেটিংস' : 'Sheets & Settings',
      shortLabel: lang === 'bn' ? 'সেটিংস' : 'Settings',
      accentBg: 'bg-violet-50 dark:bg-violet-950/40',
      accentText: 'text-violet-600 dark:text-violet-400',
      activeClass: 'bg-violet-600 text-white',
      icon: Settings,
    },
  ];

  const activeNavIndex = Math.max(
    0,
    superAdminNavItems.findIndex((item) => item.id === activeTab)
  );
  const activeNavObj = superAdminNavItems[activeNavIndex] || superAdminNavItems[0];
  const mobileAdminTranslateClass =
    activeNavIndex === 1
      ? 'translate-x-full'
      : activeNavIndex === 2
      ? 'translate-x-[200%]'
      : activeNavIndex === 3
      ? 'translate-x-[300%]'
      : 'translate-x-0';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-100/75 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Left Sidebar (Aligned Like Shop Dashboard + Neumorphic Buttons) */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-slate-200/80 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900 sticky top-0 h-screen">
        <div className="h-14 px-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-[2px_2px_5px_rgba(15,23,42,0.18),inset_1px_1px_1px_rgba(255,255,255,0.35)]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight font-display text-slate-900 dark:text-slate-100 truncate">
              MHS POS
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {session.name} · Super Admin
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3.5 py-5 space-y-2.5 overflow-y-auto">
          {superAdminNavItems.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                  active ? `${tab.activeClass} ${NEU_SOLID_BTN}` : NEU_SURFACE_BTN
                }`}
              >
                <span
                  key={active ? 'sa-active' : 'sa-idle'}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    active
                      ? 'bg-white/20 text-white animate-nav-pop'
                      : `${tab.accentBg} ${tab.accentText}`
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: PWA Install + Registered Shops Summary + Neumorphic Theme Toggle */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <PWAInstallButton lang={lang} variant="sidebar" />

          <div
            className={`flex items-center justify-between rounded-xl bg-slate-100/90 dark:bg-slate-950/60 px-3 py-2 text-[11px] ${NEU_INSET_TRACK}`}
          >
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium truncate">
              <Store className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>
                {lang === 'bn' ? 'মোট দোকান' : 'Total Shops'}:{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {summaryStats.totalShops}
                </strong>
              </span>
            </span>

            <button
              type="button"
              onClick={onToggleDark}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
              className={`h-7 w-7 inline-flex items-center justify-center rounded-lg shrink-0 ${NEU_SURFACE_BTN}`}
            >
              {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Minimal Top Heading: Super Admin Title (Left) | Add Shop + BN/EN + Logout (Right) */}
        <header className="h-14 sticky top-0 z-30 flex items-center justify-between gap-3 px-4 lg:px-8 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="lg:hidden h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight font-display text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
                {lang === 'bn' ? 'MHS POS · সুপার অ্যাডমিন' : 'MHS POS · Super Admin'}{' '}
                <span className="hidden sm:inline font-normal text-slate-400">·</span>{' '}
                <span className="hidden sm:inline text-xs sm:text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {activeNavObj.label}
                </span>
              </h1>
              {isSheetsConnected && (
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold truncate whitespace-nowrap">
                  Google Sheet Synced
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap ${NEU_SOLID_BTN}`}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">
                {lang === 'bn' ? 'নতুন দোকান' : 'Add Shop'}
              </span>
            </button>

            <div
              role="group"
              aria-label="Language switcher"
              className={`inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 gap-1 ${NEU_INSET_TRACK}`}
            >
              <button
                type="button"
                onClick={() => lang !== 'bn' && onToggleLang()}
                className={`min-h-[28px] px-2.5 rounded-lg text-xs font-bold ${
                  lang === 'bn'
                    ? `bg-indigo-600 text-white ${NEU_SOLID_BTN}`
                    : 'neu-flat text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                }`}
              >
                BN
              </button>
              <button
                type="button"
                onClick={() => lang !== 'en' && onToggleLang()}
                className={`min-h-[28px] px-2.5 rounded-lg text-xs font-bold ${
                  lang === 'en'
                    ? `bg-indigo-600 text-white ${NEU_SOLID_BTN}`
                    : 'neu-flat text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleDark}
              className={`lg:hidden min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl ${NEU_SURFACE_BTN}`}
              aria-label="Toggle theme"
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onLogout}
              title={lang === 'bn' ? 'লগ আউট' : 'Log Out'}
              aria-label={lang === 'bn' ? 'লগ আউট' : 'Log Out'}
              className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/85 dark:bg-rose-950/45 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/70 ${NEU_TINT_BTN}`}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 lg:px-8 space-y-6">
        {loading ? <SuperAdminSkeleton lang={lang} /> : null}

        {/* Guided Callout only if Master Google Sheet is not connected yet */}
        {!loading && overview && !isSheetsConnected && activeTab !== 'engine_settings' && (
          <div className="neu-box rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/75 dark:bg-emerald-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {lang === 'bn'
                    ? 'আপনার মাস্টার Google Sheet সংযোগ করুন'
                    : 'Connect Your Master Google Sheet'}
                </div>
                <div className="text-slate-600 dark:text-slate-300 mt-0.5">
                  {lang === 'bn'
                    ? 'সকল লগইন পাসওয়ার্ড গুগল শিটে সংরক্ষণ এবং নতুন দোকানের জন্য অটো শিট তৈরি সক্রিয় করুন।'
                    : 'Store all login credentials in Google Sheets and auto-provision new shop workbooks.'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('engine_settings')}
              className={`min-h-[38px] rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shrink-0 ${NEU_SOLID_BTN}`}
            >
              {lang === 'bn' ? 'সংযোগ করুন →' : 'Connect Sheet →'}
            </button>
          </div>
        )}

        {/* TAB 1: EXECUTIVE OVERVIEW & SUMMARY OF EVERY SHOP */}
        {!loading && overview && activeTab === 'overview' && (
          <div className="space-y-6 animate-view-enter">
            {/* 4 Tastefully Colored Minimal Executive KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Indigo KPI: Total Registered Shops */}
              <div className="neu-box rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/55 dark:bg-indigo-950/25 p-3.5 sm:p-5 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-indigo-900/80 dark:text-indigo-300 leading-snug">
                    {lang === 'bn' ? 'মোট নিবন্ধিত দোকান' : 'Registered Shops'}
                  </span>
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-indigo-600/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                </div>
                <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {summaryStats.totalShops}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 leading-snug">
                  Active: <strong className="font-mono">{summaryStats.activeShops}</strong> · Trial:{' '}
                  <strong className="font-mono">{summaryStats.trialShops}</strong> · Suspended:{' '}
                  <strong className="font-mono">{summaryStats.suspendedShops}</strong>
                </div>
              </div>

              {/* Emerald KPI: Monthly Subscription MRR */}
              <div className="neu-box rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/55 dark:bg-emerald-950/25 p-3.5 sm:p-5 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-emerald-900/80 dark:text-emerald-300 leading-snug">
                    {lang === 'bn' ? 'মাসিক সাবস্ক্রিপশন আয় (MRR)' : 'Monthly Subscription MRR'}
                  </span>
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                </div>
                <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  {formatBDT(summaryStats.expectedMrr)}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
                  Collected: {formatBDT(summaryStats.totalCollectedFees)} · Due:{' '}
                  {formatBDT(summaryStats.totalPendingOverdueFees)}
                </div>
              </div>

              {/* Sky KPI: All-Shops Monthly Sales GMV */}
              <div className="neu-box rounded-2xl border border-sky-200/80 dark:border-sky-900/50 bg-sky-50/55 dark:bg-sky-950/25 p-3.5 sm:p-5 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-sky-900/80 dark:text-sky-300 leading-snug">
                    {lang === 'bn' ? 'সকল দোকানের মাসিক বিক্রি' : 'All-Shops Monthly Sales'}
                  </span>
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                </div>
                <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {formatBDT(summaryStats.platformMonthlySales)}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-sky-700 dark:text-sky-400 font-medium leading-snug">
                  Net Profit: {formatBDT(summaryStats.platformNetProfit)}
                </div>
              </div>

              {/* Violet KPI: Platform Stock Valuation */}
              <div className="neu-box rounded-2xl border border-violet-200/80 dark:border-violet-900/50 bg-violet-50/55 dark:bg-violet-950/25 p-3.5 sm:p-5 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-violet-900/80 dark:text-violet-300 leading-snug">
                    {lang === 'bn' ? 'সকল দোকানের মোট স্টক ভ্যালু' : 'Platform Stock Valuation'}
                  </span>
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-violet-600/15 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0">
                    <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                </div>
                <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {formatBDT(summaryStats.platformStockValue)}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
                  {summaryStats.platformTotalSkus} SKUs · Dues{' '}
                  {formatBDT(summaryStats.platformTotalReceivables)}
                </div>
              </div>
            </div>

            {/* Cross-Shop Colored Comparison Chart */}
            {chartData.length > 0 && (
              <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {lang === 'bn'
                        ? 'দোকানভিত্তিক মাসিক বিক্রি ও স্টক ভ্যালু'
                        : 'Shop-by-Shop Monthly Sales vs. Inventory Value'}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {lang === 'bn'
                        ? 'যেকোনো দোকানের লাইভ POS ওপেন করতে নিচের টেবিল থেকে "Open POS" ক্লিক করুন'
                        : 'Inspect any tenant shop live by clicking "Open POS" in the directory below'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500" />
                        <span>Sales</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-xs bg-indigo-500" />
                        <span>Stock</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => exportSuperAdminShopsSummaryCsv(overview.shops)}
                      className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${NEU_SURFACE_BTN}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{lang === 'bn' ? 'CSV ডাউনলোড' : 'Export CSV'}</span>
                    </button>
                  </div>
                </div>

                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(v: unknown) => formatBDT(Number(v || 0))} />
                      <Bar
                        dataKey="sales"
                        name="Monthly Sales (৳)"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="stockValue"
                        name="Stock Value (৳)"
                        fill="#6366f1"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Summary of Every Shop Table */}
            <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchShop}
                      onChange={(e) => setSearchShop(e.target.value)}
                      placeholder={
                        lang === 'bn'
                          ? 'দোকান, মালিকের ইমেইল বা ফোন খুঁজুন...'
                          : 'Search shop name, owner email, phone...'
                      }
                      className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ShopAccountStatus)}
                    className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-medium"
                  >
                    <option value="ALL">{lang === 'bn' ? 'সব স্ট্যাটাস' : 'All Statuses'}</option>
                    <option value="Active">Active</option>
                    <option value="Trial">Trial</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={loadData}
                  className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium ${NEU_SURFACE_BTN}`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th className="min-w-[170px] text-left">
                        {lang === 'bn' ? 'দোকান ও মালিক' : 'Shop & Owner'}
                      </th>
                      <th className="w-36 text-left whitespace-nowrap">
                        Google Sheet
                      </th>
                      <th className="w-36 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'মালিকের পাসওয়ার্ড' : 'Owner Password'}
                      </th>
                      <th className="w-28 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'প্ল্যান' : 'Plan'}
                      </th>
                      <th className="w-28 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'মাসিক ফি' : 'Monthly Fee'}
                      </th>
                      <th className="w-32 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'বিক্রি ও স্টক' : 'Sales & Stock'}
                      </th>
                      <th className="w-px text-right whitespace-nowrap">
                        {lang === 'bn' ? 'অ্যাকশন' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShops.map((shop, idx) => {
                      const tint = SHOP_AVATAR_TINTS[idx % SHOP_AVATAR_TINTS.length];
                      const initial = (shop.shopNameEn || shop.shopNameBn || 'S')
                        .trim()
                        .charAt(0)
                        .toUpperCase();
                      const ownerPass = getShopOwnerPassword(shop.shopId);
                      const isPassShown = Boolean(revealedShopPasswords[shop.shopId]);
                      const isEnterprise = shop.plan === 'Enterprise' || Boolean(shop.entitlements?.enableBarcodeScanner);

                      return (
                        <tr
                          key={shop.shopId}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        >
                          {/* Shop & Owner */}
                          <td>
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${tint}`}
                              >
                                {initial}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-slate-100 break-words flex items-center gap-1.5 flex-wrap">
                                  <span>{shop.shopNameBn}</span>
                                  <span className="font-normal text-slate-500">
                                    ({shop.shopNameEn})
                                  </span>
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase ${
                                      shop.status === 'Suspended'
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                        : shop.status === 'Trial'
                                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    }`}
                                  >
                                    {shop.status}
                                  </span>
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 mt-0.5 break-all sm:break-normal">
                                  {shop.ownerName} · {shop.ownerEmail} {shop.phone ? `· ${shop.phone}` : ''}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  {shop.businessType} · Staff: {shop.metrics.staffCount}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Google Sheet Link & Bill Format */}
                          <td>
                            {shop.sheetConfig.spreadsheetUrl ? (
                              <div className="space-y-1 max-w-[210px]">
                                <a
                                  href={shop.sheetConfig.spreadsheetUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold hover:underline text-xs group"
                                  title={shop.sheetConfig.spreadsheetUrl}
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  <span className="truncate max-w-[140px]">
                                    {shop.sheetConfig.spreadsheetTitle || `${shop.shopNameEn} Sheet`}
                                  </span>
                                  <ExternalLink className="h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100" />
                                </a>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <a
                                    href={shop.sheetConfig.spreadsheetUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-mono text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 truncate max-w-[110px]"
                                    title={shop.sheetConfig.spreadsheetUrl}
                                  >
                                    docs.google.com/...
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(shop.sheetConfig.spreadsheetUrl);
                                      onNotify(lang === 'bn' ? 'গুগল শিট লিঙ্ক কপি হয়েছে!' : 'Google Sheet URL copied!');
                                    }}
                                    className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-semibold whitespace-nowrap"
                                  >
                                    {lang === 'bn' ? 'কপি' : 'Copy'}
                                  </button>
                                </div>
                                <div className="pt-0.5">
                                  <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    shop.receiptFormat === 'a4_invoice'
                                      ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}>
                                    {shop.receiptFormat === 'a4_invoice' ? '📄 A4 Invoice' : '🧾 80mm POS'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={busySheetShopId === shop.shopId}
                                onClick={() => handleProvisionGoogleSheetNow(shop)}
                                className={`inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/30 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 whitespace-nowrap ${NEU_TINT_BTN}`}
                              >
                                <FileSpreadsheet className="h-3 w-3 shrink-0" />
                                <span>
                                  {busySheetShopId === shop.shopId
                                    ? 'Creating...'
                                    : lang === 'bn'
                                    ? '+ অটো শিট'
                                    : '+ Auto Sheet'}
                                </span>
                              </button>
                            )}
                          </td>

                          {/* Shop Owner Password (View & Quick Edit) */}
                          <td className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {isPassShown ? ownerPass || '123456' : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedShopPasswords((prev) => ({
                                    ...prev,
                                    [shop.shopId]: !prev[shop.shopId],
                                  }))
                                }
                                title={isPassShown ? 'Hide Password' : 'Show Password'}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                              >
                                {isPassShown ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickPassShop(shop);
                                  setQuickNewPassword(ownerPass || '123456');
                                }}
                                title={lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Edit Password'}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                              >
                                <Key className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              </button>
                            </div>
                          </td>

                          {/* Subscription Plan & Barcode scanner support */}
                          <td className="whitespace-nowrap">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                  isEnterprise
                                    ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
                                    : shop.plan === 'Business'
                                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                                    : 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30'
                                }`}
                              >
                                {shop.plan}
                              </span>
                              {isEnterprise && (
                                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <Barcode className="w-3 h-3" />
                                  <span>Barcode Active</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Monthly Fee & Billing */}
                          <td className="text-right font-mono tabular-nums whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {formatBDT(shop.monthlySubscriptionFee)}/mo
                            </div>
                            <div
                              className={`text-[11px] font-semibold ${
                                shop.billingStatus === 'Paid'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : shop.billingStatus === 'Overdue'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {shop.billingStatus}
                            </div>
                          </td>

                          {/* Sales & Stock */}
                          <td className="text-right font-mono tabular-nums whitespace-nowrap">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatBDT(shop.metrics.monthlySales)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Stock: {formatBDT(shop.metrics.stockValue)}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onInspectShopPos(shop.shopId)}
                                className={`min-h-[30px] inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap ${NEU_SOLID_BTN}`}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>{lang === 'bn' ? 'POS' : 'Open POS'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setInvoiceShopFilter(shop.shopId);
                                  setActiveTab('subscriptions');
                                }}
                                className={`min-h-[30px] inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-semibold whitespace-nowrap ${NEU_SURFACE_BTN}`}
                                title={lang === 'bn' ? 'সাবস্ক্রিপশন পেমেন্ট হিস্ট্রি দেখুন' : 'View Subscription Payment History'}
                              >
                                <History className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>{lang === 'bn' ? 'হিস্ট্রি' : 'History'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditShopModal(shop)}
                                className={`min-h-[30px] p-1.5 rounded-xl ${NEU_SURFACE_BTN}`}
                                title="Edit Shop & Monthly Fee"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteShop(shop)}
                                className={`min-h-[30px] p-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/35 text-rose-600 dark:text-rose-400 hover:bg-rose-100/80 dark:hover:bg-rose-950/60 ${NEU_TINT_BTN}`}
                                title="Delete Shop"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MANAGE SHOPS (ADD NEW SHOP + FRESH POS + AUTO GOOGLE SHEET) */}
        {!loading && overview && activeTab === 'shops' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-view-enter">
            <form
              onSubmit={handleCreateShopSubmit}
              className="neu-box-static lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="border-b border-slate-200/80 dark:border-slate-800 pb-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {lang === 'bn'
                    ? 'নতুন দোকান যোগ করুন (ফ্রেশ POS + অটো গুগল শিট)'
                    : 'Create New Shop (Fresh POS + Auto Google Sheet)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lang === 'bn'
                    ? 'নতুন দোকানের মালিক তার ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করে খালি ড্যাশবোর্ডে নিজের মতো ক্যাটাগরি ও পণ্য যোগ করতে পারবেন।'
                    : 'Provisions an empty POS workspace for the new owner along with a dedicated Google Sheet.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'দোকানের নাম (বাংলা) *' : 'Shop Name (Bangla) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopNameBn}
                    onChange={(e) => setNewShopNameBn(e.target.value)}
                    placeholder="যেমন: মায়ের দোয়া স্টোর"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'দোকানের নাম (English) *' : 'Shop Name (English) *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopNameEn}
                    onChange={(e) => setNewShopNameEn(e.target.value)}
                    placeholder="e.g., Mayer Doa Store"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Business Type</label>
                  <select
                    value={newBusinessType}
                    onChange={(e) => setNewBusinessType(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="Grocery / সুপার শপ">Grocery / সুপার শপ</option>
                    <option value="Electronics & Gadgets">Electronics & Gadgets</option>
                    <option value="Pharmacy / ফার্মেসি">Pharmacy / ফার্মেসি</option>
                    <option value="Clothing & Fashion">Clothing & Fashion</option>
                    <option value="Hardware & Sanitary">Hardware & Sanitary</option>
                    <option value="Cosmetics & Gift">Cosmetics & Gift</option>
                    <option value="General Retail">General Retail</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Mobile Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="017XX-XXXXXX"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Market / Shop Address</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="New Market / Local Bazar"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Owner Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    placeholder="Owner Name"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Owner Login Email *</label>
                  <input
                    type="email"
                    required
                    value={newOwnerEmail}
                    onChange={(e) => setNewOwnerEmail(e.target.value)}
                    placeholder="owner@newshop.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Owner Login Password *</label>
                  <input
                    type="text"
                    required
                    value={newOwnerPassword}
                    onChange={(e) => setNewOwnerPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Subscription Plan</label>
                  <select
                    value={newPlan}
                    onChange={(e) => {
                      const p = e.target.value as ShopSubscriptionPlan;
                      setNewPlan(p);
                      if (overview?.planPricing?.[p] !== undefined) {
                        setNewMonthlyFee(String(overview.planPricing[p]));
                      }
                    }}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="Starter">Starter</option>
                    <option value="Business">Business</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'মাসিক সাবস্ক্রিপশন ফি (৳)' : 'Monthly Fee (৳)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newMonthlyFee}
                    onChange={(e) => setNewMonthlyFee(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">First Month Billing</label>
                  <select
                    value={newBillingStatus}
                    onChange={(e) => setNewBillingStatus(e.target.value as SubscriptionPaymentStatus)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="Paid">Paid (আদায় সম্পন্ন)</option>
                    <option value="Pending">Pending (বকেয়া)</option>
                    <option value="Waived">Free Trial (ফ্রি ট্রায়াল)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'ক্যাশ মেমো / বিল প্রিন্ট পেপার সাইজ *' : 'Cash Memo / Bill Print Paper Size *'}
                  </label>
                  <select
                    value={newReceiptFormat}
                    onChange={(e) => setNewReceiptFormat(e.target.value as ShopReceiptPaperFormat)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-medium"
                  >
                    <option value="pos_thermal">1) POS machine size paper (80mm thermal roll)</option>
                    <option value="a4_invoice">2) A4 size paper (Professional retail invoice)</option>
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {lang === 'bn'
                      ? 'দোকানদার বিক্রি শেষে প্রিন্ট দিলে বা ডিভাইস কানেক্ট না থাকলে এই সাইজেই অটো PDF ডাউনলোড হবে।'
                      : 'POS terminal will default to this layout for printing and automatic PDF downloads.'}
                  </p>
                </div>

                <div className="sm:col-span-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-900 dark:text-emerald-300">
                    <input
                      type="checkbox"
                      checked={newAutoCreateSheet}
                      onChange={(e) => setNewAutoCreateSheet(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                    <span>
                      {lang === 'bn'
                        ? `নতুন দোকানের নামে অটোমেটিক Google Sheet তৈরি করুন (${
                            newShopNameEn || newShopNameBn || 'New Shop'
                          } — MHS POS)`
                        : `Auto-create Google Sheet (${
                            newShopNameEn || newShopNameBn || 'New Shop'
                          } — MHS POS)`}
                    </span>
                  </label>
                  <input
                    type="text"
                    value={newCustomSheetUrl}
                    onChange={(e) => setNewCustomSheetUrl(e.target.value)}
                    placeholder="Optional: Or paste an existing Google Sheet URL"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingShop}
                className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 ${NEU_SOLID_BTN}`}
              >
                <Plus className="h-4 w-4" />
                <span>
                  {isCreatingShop
                    ? 'Creating Shop & Sheet...'
                    : lang === 'bn'
                    ? 'নতুন দোকান ও গুগল শিট তৈরি করুন'
                    : 'Create Fresh Shop & Google Sheet'}
                </span>
              </button>
            </form>

            {/* Right 7 Cols: Minimal Shop Cards Directory */}
            <div className="lg:col-span-7 space-y-3">
              {overview.shops.map((shop, idx) => {
                const tint = SHOP_AVATAR_TINTS[idx % SHOP_AVATAR_TINTS.length];
                const initial = (shop.shopNameEn || shop.shopNameBn || 'S')
                  .trim()
                  .charAt(0)
                  .toUpperCase();

                return (
                  <div
                    key={shop.shopId}
                    className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${tint}`}
                      >
                        {initial}
                      </div>
                      <div className="space-y-0.5 min-w-0 flex-1 leading-snug">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">
                            {shop.shopNameBn}{' '}
                            <span className="font-normal text-slate-500">({shop.shopNameEn})</span>
                          </h3>
                          <span
                            className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                              shop.status === 'Suspended'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            · {shop.status}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-slate-500 break-words">
                          <span className="break-all sm:break-normal">{shop.ownerEmail}</span> · Fee:{' '}
                          <strong className="text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {formatBDT(shop.monthlySubscriptionFee)}/mo
                          </strong>{' '}
                          ({shop.billingStatus})
                        </div>
                        <div className="text-xs text-slate-500">
                          SKUs: <strong className="font-mono">{shop.metrics.skuCount}</strong> ·
                          Sales:{' '}
                          <strong className="font-mono whitespace-nowrap">
                            {formatBDT(shop.metrics.monthlySales)}
                          </strong>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold text-slate-500 text-[11px]">Google Sheet:</span>
                          {shop.sheetConfig.spreadsheetUrl ? (
                            <div className="inline-flex items-center gap-1.5 flex-wrap">
                              <a
                                href={shop.sheetConfig.spreadsheetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:underline"
                                title={shop.sheetConfig.spreadsheetUrl}
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <span className="truncate max-w-[180px]">
                                  {shop.sheetConfig.spreadsheetTitle || `${shop.shopNameEn} Sheet`}
                                </span>
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(shop.sheetConfig.spreadsheetUrl);
                                  onNotify(lang === 'bn' ? 'গুগল শিট লিঙ্ক কপি হয়েছে!' : 'Google Sheet URL copied!');
                                }}
                                className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 underline cursor-pointer"
                              >
                                {lang === 'bn' ? 'লিঙ্ক কপি' : 'Copy link'}
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={busySheetShopId === shop.shopId}
                              onClick={() => handleProvisionGoogleSheetNow(shop)}
                              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-50/70 dark:bg-emerald-950/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100"
                            >
                              <FileSpreadsheet className="h-3 w-3 shrink-0" />
                              <span>{busySheetShopId === shop.shopId ? 'Creating...' : '+ Create Google Sheet'}</span>
                            </button>
                          )}

                          <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">|</span>

                          <span className="font-semibold text-slate-500 text-[11px]">Memo Format:</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${
                              shop.receiptFormat === 'a4_invoice'
                                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {shop.receiptFormat === 'a4_invoice' ? '📄 A4 Size Paper' : '🧾 80mm POS Roll'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 overflow-x-auto no-scrollbar">
                      <button
                        type="button"
                        onClick={() => onInspectShopPos(shop.shopId)}
                        className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0 ${NEU_SOLID_BTN}`}
                      >
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        <span>Open POS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditShopModal(shop)}
                        className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${NEU_SURFACE_BTN}`}
                      >
                        <Edit3 className="h-3.5 w-3.5 shrink-0" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestDeleteShop(shop)}
                        className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/35 px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100/80 dark:hover:bg-rose-950/60 whitespace-nowrap shrink-0 ${NEU_TINT_BTN}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: MONTHLY SUBSCRIPTION FEES — DETAILS & SUMMARY */}
        {!loading && overview && activeTab === 'subscriptions' && (
          <div className="space-y-6 animate-view-enter">
            {/* Colored Subscription Financial Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="neu-box rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/55 dark:bg-indigo-950/25 p-3.5 sm:p-5 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-indigo-900/80 dark:text-indigo-300 leading-snug">
                    {lang === 'bn' ? 'মাসিক নির্ধারিত ফি (MRR)' : 'Expected Monthly MRR'}
                  </span>
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-indigo-600/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                </div>
                <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {formatBDT(summaryStats.expectedMrr)}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
                  Annual ARR: {formatBDT(summaryStats.annualizedArr)}
                </div>
              </div>

              <div className="neu-box rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/55 dark:bg-emerald-950/25 p-3.5 sm:p-5 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-emerald-900/80 dark:text-emerald-300 leading-snug">
                    {lang === 'bn' ? 'মোট আদায়কৃত ফি' : 'Collected Subscription Fees'}
                  </span>
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-emerald-600/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                </div>
                <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  {formatBDT(summaryStats.totalCollectedFees)}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
                  Collection Rate: {formatPct(summaryStats.collectionRate)}
                </div>
              </div>

              <div className="neu-box rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/55 dark:bg-amber-950/25 p-3.5 sm:p-5 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-amber-900/80 dark:text-amber-300 leading-snug">
                    {lang === 'bn' ? 'বকেয়া ও মেয়াদোত্তীর্ণ ফি' : 'Pending & Overdue'}
                  </span>
                  <span className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl bg-amber-600/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </span>
                </div>
                <div className="mt-2 text-lg sm:text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 whitespace-nowrap">
                  {formatBDT(summaryStats.totalPendingOverdueFees)}
                </div>
                <div className="mt-1 text-[11px] sm:text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 leading-snug">
                  Unpaid Invoices:{' '}
                  {
                    overview.invoices.filter(
                      (i) => i.status === 'Pending' || i.status === 'Overdue'
                    ).length
                  }
                </div>
              </div>

              <div className="neu-box rounded-2xl border border-sky-200/80 dark:border-sky-900/50 bg-sky-50/55 dark:bg-sky-950/25 p-3.5 sm:p-5 flex flex-col justify-between min-w-0 col-span-2 lg:col-span-1">
                <div className="text-[11px] sm:text-xs font-semibold text-sky-900/80 dark:text-sky-300 leading-snug">
                  {lang === 'bn' ? 'নতুন মাসের বিল তৈরি করুন' : 'Generate Monthly Bills'}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="month"
                    value={generateMonthInput}
                    onChange={(e) => setGenerateMonthInput(e.target.value)}
                    className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateMonthBills}
                    className={`min-h-[36px] rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-700 whitespace-nowrap shrink-0 ${NEU_SOLID_BTN}`}
                  >
                    Generate
                  </button>
                </div>
              </div>
            </div>

            {/* Per-Shop Subscription Rate Schedule */}
            <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold leading-snug">
                    {lang === 'bn'
                      ? 'প্রতিটি দোকানের নির্ধারিত মাসিক সাবস্ক্রিপশন ফি'
                      : 'Per-Shop Monthly Subscription Fee Schedule'}
                  </h2>
                  <p className="text-xs text-slate-500 leading-snug mt-0.5">
                    {lang === 'bn'
                      ? 'যেকোনো দোকানের মাসিক ফি পরিবর্তন করতে "Set Fee" বাটনে ক্লিক করুন'
                      : 'Adjust monthly subscription fee (BDT) or plan for any shop'}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th className="min-w-[155px] text-left">
                        {lang === 'bn' ? 'দোকানের নাম' : 'Shop Name'}
                      </th>
                      <th className="w-48 text-left">
                        {lang === 'bn' ? 'মালিকের ইমেইল' : 'Owner Email'}
                      </th>
                      <th className="w-24 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'প্ল্যান' : 'Plan'}
                      </th>
                      <th className="w-28 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'মাসিক ফি' : 'Monthly Fee'}
                      </th>
                      <th className="w-24 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}
                      </th>
                      <th className="w-28 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'পরবর্তী বিল' : 'Next Billing'}
                      </th>
                      <th className="w-px text-right whitespace-nowrap">
                        {lang === 'bn' ? 'অ্যাকশন' : 'Action'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.shops.map((sh) => (
                      <tr key={sh.shopId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="font-semibold break-words">
                          {sh.shopNameBn} ({sh.shopNameEn})
                        </td>
                        <td className="font-mono text-slate-500 break-all sm:break-normal">
                          {sh.ownerEmail}
                        </td>
                        <td className="whitespace-nowrap">{sh.plan}</td>
                        <td className="text-right font-mono tabular-nums font-bold whitespace-nowrap">
                          {formatBDT(sh.monthlySubscriptionFee)}
                        </td>
                        <td
                          className={`font-semibold whitespace-nowrap ${
                            sh.billingStatus === 'Paid'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : sh.billingStatus === 'Overdue'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {sh.billingStatus}
                        </td>
                        <td className="font-mono text-slate-500 whitespace-nowrap">
                          {sh.nextBillingDate}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditShopModal(sh)}
                            className={`rounded-xl px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${NEU_SURFACE_BTN}`}
                          >
                            Set Fee
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Subscription Invoices Ledger */}
            <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                <h2 className="text-sm font-bold leading-snug">
                  {lang === 'bn'
                    ? 'মাসিক সাবস্ক্রিপশন বিল ও পেমেন্ট লেজার'
                    : 'Monthly Subscription Fee Invoices & Receipts'}
                </h2>

                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-0.5">
                  <select
                    value={invoiceShopFilter}
                    onChange={(e) => setInvoiceShopFilter(e.target.value)}
                    className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs shrink-0 max-w-[170px]"
                  >
                    <option value="ALL">{lang === 'bn' ? 'সকল দোকান (All Shops)' : 'All Shops'}</option>
                    {overview.shops.map((s) => (
                      <option key={s.shopId} value={s.shopId}>
                        {s.shopNameEn || s.shopNameBn}
                      </option>
                    ))}
                  </select>

                  <select
                    value={invoiceMonthFilter}
                    onChange={(e) => setInvoiceMonthFilter(e.target.value)}
                    className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs font-mono shrink-0"
                  >
                    <option value="ALL">All Months</option>
                    {uniqueInvoiceMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={invoiceStatusFilter}
                    onChange={(e) =>
                      setInvoiceStatusFilter(e.target.value as 'ALL' | SubscriptionPaymentStatus)
                    }
                    className="min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs shrink-0"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Waived">Waived</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => exportSuperAdminSubscriptionsCsv(filteredInvoices)}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${NEU_SURFACE_BTN}`}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th className="w-28 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'রশিদ নং' : 'Receipt No'}
                      </th>
                      <th className="w-20 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'বিলিং মাস' : 'Month'}
                      </th>
                      <th className="min-w-[150px] text-left">
                        {lang === 'bn' ? 'দোকান ও মালিক' : 'Shop & Owner'}
                      </th>
                      <th className="w-24 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'প্ল্যান' : 'Plan'}
                      </th>
                      <th className="w-28 text-right whitespace-nowrap">
                        {lang === 'bn' ? 'পরিমাণ' : 'Amount'}
                      </th>
                      <th className="w-36 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'স্ট্যাটাস ও মাধ্যম' : 'Status & Method'}
                      </th>
                      <th className="w-28 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'নির্ধারিত তারিখ' : 'Due Date'}
                      </th>
                      <th className="w-px text-right whitespace-nowrap">
                        {lang === 'bn' ? 'অ্যাকশন' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv) => {
                      const matchedShop = overview.shops.find((s) => s.shopId === inv.shopId);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {inv.receiptNo}
                          </td>
                          <td className="font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {inv.monthKey}
                          </td>
                          <td className="break-words">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {inv.shopNameBn} ({inv.shopNameEn})
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 break-all sm:break-normal">
                              {inv.ownerEmail}
                            </div>
                          </td>
                          <td className="whitespace-nowrap font-medium text-xs">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                inv.plan === 'Enterprise'
                                  ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300'
                                  : inv.plan === 'Business'
                                  ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                  : 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {inv.plan}
                            </span>
                          </td>
                          <td className="text-right font-mono tabular-nums font-bold text-sm whitespace-nowrap">
                            {formatBDT(inv.amount)}
                          </td>
                          <td className="whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                inv.status === 'Paid'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : inv.status === 'Overdue'
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {inv.status}
                            </span>
                            {inv.paymentMethod ? (
                              <div className="text-[11px] text-slate-500 mt-0.5">{inv.paymentMethod}</div>
                            ) : null}
                          </td>
                          <td className="font-mono text-xs text-slate-500 whitespace-nowrap">
                            {inv.dueDate || '10th of month'}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  downloadSubscriptionInvoicePdf({
                                    invoice: inv,
                                    shop: matchedShop,
                                    superAdminEmail: overview.superAdminProfile.email,
                                  })
                                }
                                title={lang === 'bn' ? 'PDF ইনভয়েস ডাউনলোড করুন' : 'Download Invoice PDF'}
                                className={`min-h-[30px] inline-flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap ${NEU_TINT_BTN}`}
                              >
                                <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>{lang === 'bn' ? 'PDF রসিদ' : 'PDF Invoice'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPayingInvoice(inv);
                                  setPayStatus(inv.status);
                                  setPayAmount(String(inv.amount));
                                  setPayMethod(inv.paymentMethod || 'bKash / Nagad');
                                  setPayNote(inv.note || '');
                                  setPayDueDate(inv.dueDate || '');
                                  setPayReceiptNo(inv.receiptNo || '');
                                  setPayPlan(inv.plan || 'Business');
                                }}
                                className={`min-h-[30px] inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap ${NEU_SOLID_BTN}`}
                              >
                                <Edit3 className="h-3 w-3" />
                                <span>{inv.status === 'Paid' ? 'Edit Invoice' : 'Collect Fee'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: GOOGLE SHEETS MASTER CREDENTIALS DB & PLATFORM CONTROLS */}
        {!loading && overview && activeTab === 'engine_settings' && (
          <div className="space-y-6 animate-view-enter">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Master Google Sheet Connection & SaaS Settings */}
              <form
                onSubmit={handleSaveEngineAndSettings}
                className="neu-box-static lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5"
              >
                <div className="space-y-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="h-5 w-5" />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold">
                          {lang === 'bn'
                            ? 'মাস্টার Google Sheet ডাটাবেস ও পাসওয়ার্ড ভল্ট'
                            : 'Master Google Sheet Database & Password Vault'}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {lang === 'bn'
                            ? 'সকল অ্যাডমিন ও দোকানের পাসওয়ার্ড সংরক্ষণ এবং প্রতিটি নতুন দোকানের জন্য স্বয়ংক্রিয় Google Sheet তৈরি।'
                            : 'Stores all Admin, Shop Owner & Staff credentials and auto-creates dedicated workbooks for new shops.'}
                        </p>
                      </div>
                    </div>

                    {overview.googleSheetsEngine.masterDirectorySheetUrl && (
                      <a
                        href={overview.googleSheetsEngine.masterDirectorySheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 shrink-0 ${NEU_TINT_BTN}`}
                      >
                        <span>{lang === 'bn' ? 'মাস্টার শিট খুলুন' : 'Open Master Sheet'}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Compact Apps Script Copy Bar */}
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/45 dark:bg-emerald-950/20 p-3.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-slate-700 dark:text-slate-300">
                      {lang === 'bn'
                        ? 'Google Apps Script ব্রিজ কোড প্রয়োজনে পুনরায় কপি করুন:'
                        : 'Need the Google Apps Script bridge code for deployment?'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_BRIDGE_CODE);
                        onNotify(
                          lang === 'bn'
                            ? 'Apps Script কোড কপি হয়েছে!'
                            : 'Copied Google Apps Script bridge code!'
                        );
                      }}
                      className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 ${NEU_SOLID_BTN}`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>{lang === 'bn' ? 'স্ক্রিপ্ট কপি করুন' : 'Copy Apps Script'}</span>
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">
                        {lang === 'bn'
                          ? '১. Google Apps Script Web App URL * (/exec)'
                          : '1. Google Apps Script Web App URL * (/exec)'}
                      </label>
                      <input
                        type="url"
                        value={appsScriptUrl}
                        onChange={(e) => setAppsScriptUrl(e.target.value)}
                        placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                        className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">
                        {lang === 'bn'
                          ? '২. আপনার Master Google Sheet URL (ঐচ্ছিক)'
                          : '2. Your Master Google Sheet URL (Optional)'}
                      </label>
                      <input
                        type="text"
                        value={masterSheetUrlInput}
                        onChange={(e) => setMasterSheetUrlInput(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                        className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono text-xs"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={busyMasterAction !== null}
                        onClick={handleConnectMasterSheetNow}
                        className={`min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 ${NEU_SOLID_BTN}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          {busyMasterAction === 'connect'
                            ? lang === 'bn'
                              ? 'সংযুক্ত হচ্ছে...'
                              : 'Connecting...'
                            : lang === 'bn'
                            ? 'শিট সংযুক্ত ও পাসওয়ার্ড সেভ করুন'
                            : 'Connect & Sync Master Sheet'}
                        </span>
                      </button>

                      {isSheetsConnected && (
                        <>
                          <button
                            type="button"
                            disabled={busyMasterAction !== null}
                            onClick={handleSyncMasterSheetNow}
                            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${NEU_SURFACE_BTN}`}
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${
                                busyMasterAction === 'sync' ? 'animate-spin' : ''
                              }`}
                            />
                            <span>
                              {lang === 'bn' ? 'শিটে সিঙ্ক করুন' : 'Push to Sheet'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={busyMasterAction !== null}
                            onClick={handlePullMasterSheetCredentials}
                            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-50 ${NEU_SURFACE_BTN}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>
                              {lang === 'bn' ? 'শিট থেকে আপডেট নিন' : 'Pull from Sheet'}
                            </span>
                          </button>
                        </>
                      )}
                    </div>

                    {overview.googleSheetsEngine.lastMasterSyncedAt && (
                      <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                        ✓ Last Master Sync:{' '}
                        {new Date(overview.googleSheetsEngine.lastMasterSyncedAt).toLocaleString()}
                      </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={autoCreateSheetToggle}
                        onChange={(e) => setAutoCreateSheetToggle(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      />
                      <span>
                        {lang === 'bn'
                          ? 'নতুন দোকান যোগ করলেই দোকানের নামে স্বয়ংক্রিয়ভাবে আলাদা Google Sheet তৈরি করুন'
                          : 'Automatically create a dedicated Google Sheet whenever a new shop is added'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Global Announcement & Default Plan Pricing */}
                <div className="space-y-3 border-b border-slate-200/80 dark:border-slate-800 pb-5 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Megaphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Global Broadcast Notice (Shown on Shop Dashboards)</span>
                  </div>
                  <input
                    type="text"
                    value={globalNoticeInput}
                    onChange={(e) => setGlobalNoticeInput(e.target.value)}
                    placeholder="e.g., Monthly subscription due by the 5th of each month..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <div className="min-w-0">
                      <label className="block font-medium mb-1 truncate whitespace-nowrap">
                        Starter Fee (৳)
                      </label>
                      <input
                        type="number"
                        value={tierStarter}
                        onChange={(e) => setTierStarter(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block font-medium mb-1 truncate whitespace-nowrap">
                        Business Fee (৳)
                      </label>
                      <input
                        type="number"
                        value={tierBusiness}
                        onChange={(e) => setTierBusiness(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block font-medium mb-1 truncate whitespace-nowrap">
                        Enterprise Fee (৳)
                      </label>
                      <input
                        type="number"
                        value={tierEnterprise}
                        onChange={(e) => setTierEnterprise(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block font-medium mb-1 truncate whitespace-nowrap">
                        Custom Fee (৳)
                      </label>
                      <input
                        type="number"
                        value={tierCustom}
                        onChange={(e) => setTierCustom(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Super Admin Credentials */}
                <div className="space-y-3 text-xs">
                  <div className="font-bold text-sm truncate">Super Admin Login Credentials</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="min-w-0">
                      <label className="block font-medium mb-1 truncate whitespace-nowrap">
                        Admin Name
                      </label>
                      <input
                        type="text"
                        value={adminNameInput}
                        onChange={(e) => setAdminNameInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block font-medium mb-1 truncate whitespace-nowrap">
                        Super Admin Email
                      </label>
                      <input
                        type="email"
                        value={adminEmailInput}
                        onChange={(e) => setAdminEmailInput(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="block font-medium mb-1 truncate whitespace-nowrap">
                        New Password (Optional)
                      </label>
                      <input
                        type="password"
                        value={adminNewPasswordInput}
                        onChange={(e) => setAdminNewPasswordInput(e.target.value)}
                        placeholder="Leave blank to keep"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleDownloadJsonBackup}
                    className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 ${NEU_SURFACE_BTN}`}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span>Backup JSON</span>
                  </button>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className={`min-h-[40px] rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap shrink-0 ${NEU_SOLID_BTN}`}
                  >
                    {savingSettings ? 'Saving...' : 'Save Platform Settings'}
                  </button>
                </div>
              </form>

              {/* Right 5 Cols: Platform Audit Log */}
              <div className="neu-box lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="p-4 border-b border-slate-200/80 dark:border-slate-800">
                  <h3 className="text-sm font-bold">Platform Audit Trail</h3>
                </div>
                <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {overview.platformAuditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {log.actionType}
                        </span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {log.entityLabel}
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">{log.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Super Admin Credential Vault Table */}
            <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="h-8 w-8 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold">
                      {lang === 'bn'
                        ? 'সকল অ্যাডমিন, দোকান মালিক ও স্টাফ পাসওয়ার্ড ভল্ট'
                        : 'Admin, Shop Owner & Staff Credentials Vault'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {lang === 'bn'
                        ? 'Google Sheet Tab: Admin_Users_Credentials এ স্বয়ংক্রিয়ভাবে সংরক্ষিত'
                        : 'Automatically synchronized to Master Google Sheet tab: Admin_Users_Credentials'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  {(overview.credentialVault || []).length} Accounts
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="pro-table">
                  <thead>
                    <tr>
                      <th className="w-28 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'রোল' : 'Role'}
                      </th>
                      <th className="min-w-[140px] text-left">
                        {lang === 'bn' ? 'দোকান / পরিধি' : 'Shop / Scope'}
                      </th>
                      <th className="w-40 text-left">
                        {lang === 'bn' ? 'নাম' : 'Name'}
                      </th>
                      <th className="w-52 text-left">
                        {lang === 'bn' ? 'লগইন ইমেইল' : 'Login Email'}
                      </th>
                      <th className="w-32 text-left whitespace-nowrap">
                        {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
                      </th>
                      <th className="w-px text-right whitespace-nowrap">
                        {lang === 'bn' ? 'অ্যাকশন' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview.credentialVault || []).map((cred) => {
                      const shown = Boolean(revealedUserIds[cred.userId]);
                      return (
                        <tr key={cred.userId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="font-semibold whitespace-nowrap">
                            {cred.role}
                          </td>
                          <td className="text-slate-600 dark:text-slate-300 break-words">
                            {cred.shopName}
                          </td>
                          <td className="font-medium break-words">
                            {cred.name}
                          </td>
                          <td className="font-mono break-all sm:break-normal">
                            {cred.email}
                          </td>
                          <td className="font-mono whitespace-nowrap">
                            {shown ? cred.passwordPlain || '(Encrypted)' : '••••••••'}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedUserIds((prev) => ({
                                    ...prev,
                                    [cred.userId]: !prev[cred.userId],
                                  }))
                                }
                                className={`rounded-xl p-1.5 ${NEU_SURFACE_BTN}`}
                                title={shown ? 'Hide password' : 'Show password'}
                              >
                                {shown ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `Email: ${cred.email} | Password: ${cred.passwordPlain}`
                                  );
                                  onNotify(`Copied login credentials for ${cred.email}`);
                                }}
                                className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${NEU_SURFACE_BTN}`}
                              >
                                Copy
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar — Gliding Neumorphic Capsule + Hover & Click Animation */}
      <nav
        aria-label="Super Admin mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-2 py-1.5 shadow-[0_-6px_22px_rgba(15,23,42,0.08)] dark:shadow-[0_-6px_24px_rgba(2,6,23,0.7)]"
      >
        <div className="neu-well relative h-full w-full rounded-2xl bg-slate-100/90 dark:bg-slate-950/80 p-0.5">
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0.5 left-0 w-1/4 ${mobileAdminTranslateClass} px-0.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
          >
            <div
              className={`h-full w-full rounded-xl ${activeNavObj.activeClass} shadow-[0_6px_14px_rgba(15,23,42,0.22),inset_1px_1px_2px_rgba(255,255,255,0.45),inset_-1px_-1px_2px_rgba(0,0,0,0.2)]`}
            />
          </div>

          <div className="relative z-10 h-full grid grid-cols-4 items-center">
            {superAdminNavItems.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`neu-flat group relative h-full min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-all duration-200 cursor-pointer select-none ${
                    active
                      ? 'text-white font-bold -translate-y-0.5'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:-translate-y-0.5 hover:bg-white/65 dark:hover:bg-slate-800/65 active:scale-92'
                  }`}
                >
                  <span
                    key={active ? 'sa-mob-active' : 'sa-mob-idle'}
                    className={`flex items-center justify-center rounded-lg p-1 transition-transform duration-200 ${
                      active
                        ? 'bg-white/20 text-white animate-nav-pop shadow-[inset_1px_1px_1px_rgba(255,255,255,0.35)]'
                        : 'group-hover:scale-110'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] leading-tight mt-0.5 truncate whitespace-nowrap max-w-[72px]">
                    {tab.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Quick Create Shop Modal (Accessible from Header anywhere) */}
      <AppPopupModal
        isOpen={showCreateModal}
        onClose={() => {
          if (!isCreatingShop) setShowCreateModal(false);
        }}
        disableClose={isCreatingShop}
        maxWidthClass="max-w-4xl"
        heightMode="screen"
        ariaLabel={
          lang === 'bn'
            ? 'নতুন দোকান যোগ করুন (ফ্রেশ POS + গুগল শিট)'
            : 'Add New Shop (Fresh POS + Google Sheet)'
        }
      >
        <form
          onSubmit={handleCreateShopSubmit}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          <div className="shrink-0 flex items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold leading-snug">
                  {lang === 'bn'
                    ? 'নতুন দোকান যোগ করুন (ফ্রেশ POS + গুগল শিট)'
                    : 'Add New Shop (Fresh POS + Google Sheet)'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                  {lang === 'bn'
                    ? 'মালিকের লগইন আইডি, সাবস্ক্রিপশন ফি এবং আলাদা গুগল শিট তৈরি করুন'
                    : 'Provision shop workspace, owner login credentials, and cloud sheet'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              disabled={isCreatingShop}
              aria-label="Close modal"
              className={`h-8 w-8 inline-flex items-center justify-center rounded-lg shrink-0 ${NEU_SURFACE_BTN}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="min-w-0">
                <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                  Shop Name (Bangla) *
                </label>
                <input
                  type="text"
                  required
                  value={newShopNameBn}
                  onChange={(e) => setNewShopNameBn(e.target.value)}
                  placeholder="যেমন: ভাই ভাই জেনারেল স্টোর"
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div className="min-w-0">
                <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                  Shop Name (English) *
                </label>
                <input
                  type="text"
                  required
                  value={newShopNameEn}
                  onChange={(e) => setNewShopNameEn(e.target.value)}
                  placeholder="e.g., Bhai Bhai General Store"
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div className="min-w-0">
                <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                  Owner Name *
                </label>
                <input
                  type="text"
                  required
                  value={newOwnerName}
                  onChange={(e) => setNewOwnerName(e.target.value)}
                  placeholder="Shop Owner Name"
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div className="min-w-0">
                <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="017XX-XXXXXX"
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <div className="min-w-0">
                <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                  Owner Login Email *
                </label>
                <input
                  type="email"
                  required
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  placeholder="owner@shop.com"
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <div className="min-w-0">
                <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                  Owner Login Password *
                </label>
                <input
                  type="text"
                  required
                  value={newOwnerPassword}
                  onChange={(e) => setNewOwnerPassword(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <div className="min-w-0">
                <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                  Monthly Subscription Fee (৳)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newMonthlyFee}
                  onChange={(e) => setNewMonthlyFee(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-bold"
                />
              </div>
              <div className="min-w-0">
                <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                  Billing Status
                </label>
                <select
                  value={newBillingStatus}
                  onChange={(e) => setNewBillingStatus(e.target.value as SubscriptionPaymentStatus)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                >
                  <option value="Paid">Paid</option>
                  <option value="Pending">Pending</option>
                  <option value="Waived">Trial (Waived)</option>
                </select>
                <div className="sm:col-span-2 min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Cash Memo Print Paper Size *
                  </label>
                  <select
                    value={newReceiptFormat}
                    onChange={(e) => setNewReceiptFormat(e.target.value as ShopReceiptPaperFormat)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-medium"
                  >
                    <option value="pos_thermal">1) POS machine size paper (80mm thermal roll)</option>
                    <option value="a4_invoice">2) A4 size paper (Professional retail invoice)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5">
              <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-emerald-800 dark:text-emerald-300 min-w-0">
                <input
                  type="checkbox"
                  checked={newAutoCreateSheet}
                  onChange={(e) => setNewAutoCreateSheet(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 shrink-0"
                />
                <span className="truncate">
                  Auto-create dedicated Google Sheet ({newShopNameEn || 'New Shop'} — MHS POS)
                </span>
              </label>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 px-4 py-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              disabled={isCreatingShop}
              className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap ${NEU_SURFACE_BTN}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingShop}
              className={`min-h-[38px] px-5 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap ${NEU_SOLID_BTN}`}
            >
              {isCreatingShop ? 'Creating...' : 'Create Shop & POS'}
            </button>
          </div>
        </form>
      </AppPopupModal>

      {/* Edit Existing Shop Modal */}
      <AppPopupModal
        isOpen={Boolean(editingShop)}
        onClose={() => {
          if (!isSavingEdit) setEditingShop(null);
        }}
        disableClose={isSavingEdit}
        maxWidthClass="max-w-5xl"
        heightMode="screen"
        ariaLabel={editingShop ? `Edit Shop — ${editingShop.shopNameEn}` : 'Edit Shop'}
      >
        {editingShop && (
          <form
            onSubmit={handleSaveShopEdit}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="shrink-0 flex items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold leading-snug break-words">
                    Edit Shop & Subscription — {editingShop.shopNameEn}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug break-words mt-0.5">
                    {editingShop.shopNameBn} · {editingShop.ownerEmail}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingShop(null)}
                disabled={isSavingEdit}
                aria-label="Close modal"
                className={`h-8 w-8 inline-flex items-center justify-center rounded-lg shrink-0 ${NEU_SURFACE_BTN}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Shop Name (Bangla)
                  </label>
                  <input
                    type="text"
                    required
                    value={editNameBn}
                    onChange={(e) => setEditNameBn(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Shop Name (English)
                  </label>
                  <input
                    type="text"
                    required
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Owner Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editOwnerName}
                    onChange={(e) => setEditOwnerName(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Owner Login Email
                  </label>
                  <input
                    type="email"
                    required
                    value={editOwnerEmail}
                    onChange={(e) => setEditOwnerEmail(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Reset Owner Password (Optional)
                  </label>
                  <input
                    type="text"
                    value={editOwnerNewPass}
                    onChange={(e) => setEditOwnerNewPass(e.target.value)}
                    placeholder="Leave blank to keep existing"
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Account Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as ShopAccountStatus)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-semibold"
                  >
                    <option value="Active">Active</option>
                    <option value="Trial">Trial</option>
                    <option value="Suspended">Suspended (Blocks Login)</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Subscription Plan
                  </label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value as ShopSubscriptionPlan)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="Starter">Starter</option>
                    <option value="Business">Business</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Monthly Subscription Fee (৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editFee}
                    onChange={(e) => setEditFee(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-bold"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Current Billing Status
                  </label>
                  <select
                    value={editBillingStatus}
                    onChange={(e) =>
                      setEditBillingStatus(e.target.value as SubscriptionPaymentStatus)
                    }
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Waived">Waived</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Next Billing Date
                  </label>
                  <input
                    type="date"
                    value={editNextBillingDate}
                    onChange={(e) => setEditNextBillingDate(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div className="sm:col-span-2 min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Cash Memo Print Paper Size
                  </label>
                  <select
                    value={editReceiptFormat}
                    onChange={(e) => setEditReceiptFormat(e.target.value as ShopReceiptPaperFormat)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-medium"
                  >
                    <option value="pos_thermal">1) POS machine size paper (80mm thermal roll)</option>
                    <option value="a4_invoice">2) A4 size paper (Professional retail invoice)</option>
                  </select>
                </div>
                <div className="sm:col-span-2 min-w-0">
                  <label className="block font-semibold mb-1 truncate whitespace-nowrap">
                    Linked Google Sheet URL
                  </label>
                  <input
                    type="text"
                    value={editSheetUrl}
                    onChange={(e) => setEditSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-2.5">
                <div className="font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  Feature Entitlements & Staff Seat Limit
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center">
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={editEnableEcom}
                      onChange={(e) => setEditEnableEcom(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600 shrink-0"
                    />
                    <span className="truncate whitespace-nowrap font-medium">E-Commerce Tab</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={editEnableCredit}
                      onChange={(e) => setEditEnableCredit(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600 shrink-0"
                    />
                    <span className="truncate whitespace-nowrap font-medium">Credit Ledger</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={editEnableExports}
                      onChange={(e) => setEditEnableExports(e.target.checked)}
                      className="h-4 w-4 rounded text-emerald-600 shrink-0"
                    />
                    <span className="truncate whitespace-nowrap font-medium">Audit Exports</span>
                  </label>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="whitespace-nowrap font-medium">Max Staff:</span>
                    <input
                      type="number"
                      min={1}
                      value={editMaxStaff}
                      onChange={(e) => setEditMaxStaff(e.target.value)}
                      className="w-16 min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 px-4 py-3">
              <button
                type="button"
                onClick={() => setEditingShop(null)}
                disabled={isSavingEdit}
                className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap ${NEU_SURFACE_BTN}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className={`min-h-[38px] px-5 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap ${NEU_SOLID_BTN}`}
              >
                {isSavingEdit ? 'Saving...' : 'Save Shop Changes'}
              </button>
            </div>
          </form>
        )}
      </AppPopupModal>

      {/* Edit / Record Subscription Invoice Modal */}
      <AppPopupModal
        isOpen={Boolean(payingInvoice)}
        onClose={() => setPayingInvoice(null)}
        maxWidthClass="max-w-2xl"
        heightMode="compact"
        ariaLabel={
          payingInvoice
            ? `Subscription Invoice — ${payingInvoice.shopNameEn} (${payingInvoice.monthKey})`
            : 'Subscription Invoice'
        }
      >
        {payingInvoice && (
          <form
            onSubmit={handleSavePaymentSubmit}
            className="flex flex-col flex-1 min-h-0 overflow-hidden"
          >
            <div className="shrink-0 flex items-center justify-between gap-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold leading-snug break-words">
                    Edit Subscription Invoice — {payingInvoice.shopNameEn}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    Modify billing terms, receipt number, plan tier, or record payment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                aria-label="Close modal"
                className={`h-8 w-8 inline-flex items-center justify-center rounded-lg shrink-0 ${NEU_SURFACE_BTN}`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500">Shop</div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    {payingInvoice.shopNameEn}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500">Owner Email</div>
                  <div className="font-mono text-slate-700 dark:text-slate-300 truncate">
                    {payingInvoice.ownerEmail}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500">Billing Month</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100 truncate">
                    {payingInvoice.monthKey}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500">Current Status</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 truncate">
                    {payingInvoice.status}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'রশিদ / ইনভয়েস নং' : 'Receipt / Invoice No'}
                  </label>
                  <input
                    type="text"
                    required
                    value={payReceiptNo}
                    onChange={(e) => setPayReceiptNo(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-bold"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'সাবস্ক্রিপশন প্ল্যান' : 'Subscription Plan'}
                  </label>
                  <select
                    value={payPlan}
                    onChange={(e) => setPayPlan(e.target.value as ShopSubscriptionPlan)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="Starter">Starter</option>
                    <option value="Business">Business</option>
                    <option value="Enterprise">Enterprise (Barcode Scanner Active)</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'ফি পরিমাণ (৳)' : 'Fee Amount (BDT)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-bold"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'পরিশোধের শেষ তারিখ' : 'Payment Due Date'}
                  </label>
                  <input
                    type="text"
                    value={payDueDate}
                    onChange={(e) => setPayDueDate(e.target.value)}
                    placeholder="YYYY-MM-DD or 10th of month"
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'পেমেন্ট স্ট্যাটাস' : 'Payment Status'}
                  </label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value as SubscriptionPaymentStatus)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="Paid">Paid (আদায় সম্পন্ন)</option>
                    <option value="Pending">Pending (বকেয়া)</option>
                    <option value="Overdue">Overdue (মেয়াদোত্তীর্ণ)</option>
                    <option value="Waived">Waived (মওকুফ)</option>
                  </select>
                </div>

                <div className="min-w-0">
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'পেমেন্ট মেথড' : 'Payment Method'}
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  >
                    <option value="bKash / Nagad">bKash / Nagad Personal (01714-605024)</option>
                    <option value="Cash">Cash Counter</option>
                    <option value="Bank Transfer">Bank Transfer / EFT</option>
                    <option value="Waived / Trial">Waived / Promotional</option>
                  </select>
                </div>

                <div className="sm:col-span-2 min-w-0">
                  <label className="block font-semibold mb-1">
                    {lang === 'bn' ? 'ট্রানজ্যাকশন আইডি / নোট' : 'TrxID / Reference Note'}
                  </label>
                  <input
                    type="text"
                    value={payNote}
                    onChange={(e) => setPayNote(e.target.value)}
                    placeholder="e.g., bKash TrxID: 9X87KL24 / Handover note"
                    className="w-full min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-between gap-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  const currentInvSnapshot: SubscriptionInvoiceRecord = {
                    ...payingInvoice,
                    amount: Math.max(0, Number(payAmount) || payingInvoice.amount),
                    status: payStatus,
                    paymentMethod: payMethod,
                    note: payNote,
                    dueDate: payDueDate,
                    receiptNo: payReceiptNo,
                    plan: payPlan,
                  };
                  downloadSubscriptionInvoicePdf({
                    invoice: currentInvSnapshot,
                    shop: overview?.shops.find((s) => s.shopId === payingInvoice.shopId),
                    superAdminEmail: overview?.superAdminProfile.email,
                  });
                }}
                className={`min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shadow-xs ${NEU_TINT_BTN}`}
              >
                <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{lang === 'bn' ? 'A4 PDF ইনভয়েস ডাউনলোড' : 'Download A4 PDF'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className={`min-h-[38px] px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap ${NEU_SURFACE_BTN}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`min-h-[38px] px-5 py-2 rounded-xl bg-emerald-600 text-xs text-white font-bold hover:bg-emerald-700 whitespace-nowrap ${NEU_SOLID_BTN}`}
                >
                  Save Invoice
                </button>
              </div>
            </div>
          </form>
        )}
      </AppPopupModal>

      {/* Quick Edit Password Modal for Shop Owners */}
      <AppPopupModal
        isOpen={Boolean(quickPassShop)}
        onClose={() => setQuickPassShop(null)}
        maxWidthClass="max-w-md"
        heightMode="compact"
        ariaLabel={
          quickPassShop
            ? `Edit Password — ${quickPassShop.shopNameEn}`
            : 'Edit Shop Password'
        }
      >
        {quickPassShop && (
          <form onSubmit={handleSaveQuickPassword} className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {lang === 'bn' ? 'মালিকের পাসওয়ার্ড পরিবর্তন' : 'Edit Shop Owner Password'}
                </h3>
                <p className="text-xs text-slate-500 truncate">
                  {quickPassShop.shopNameBn} ({quickPassShop.ownerEmail})
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'নতুন পাসওয়ার্ড লিখুন *' : 'Enter New Password *'}
              </label>
              <input
                type="text"
                required
                minLength={4}
                value={quickNewPassword}
                onChange={(e) => setQuickNewPassword(e.target.value)}
                placeholder="New password (e.g., 123456)"
                className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono focus:border-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500">
                {lang === 'bn'
                  ? 'এই পাসওয়ার্ডটি দিয়ে দোকানের মালিক সরাসরি POS এ লগইন করতে পারবেন।'
                  : 'The shop owner can instantly use this password to sign in to their POS counter.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickPassShop(null)}
                disabled={isSavingQuickPass}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingQuickPass || !quickNewPassword.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
              >
                {isSavingQuickPass ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </AppPopupModal>

      <ConfirmActionModal
        dialog={confirmDialog}
        lang={lang}
        isBusy={isConfirmBusy}
        onClose={() => !isConfirmBusy && setConfirmDialog(null)}
        onExecute={executeConfirmDialog}
      />
    </div>
  );
};
