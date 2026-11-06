import {
  UserRole,
  type CreditHistoryEntry,
  type CustomerCredit,
  type PosStoreState,
  type SeasonalMonthDatum,
  type ShopReceiptPaperFormat,
  type StaffDashboardPermissions,
  type WorkspaceTab,
} from '../types/pos';
import { DEFAULT_SHOP_CATEGORIES } from '../i18n/translations';

const ALL_WORKSPACE_TABS: WorkspaceTab[] = [
  'dashboard',
  'pos',
  'sales_history',
  'inventory',
  'credit_expenses',
  'ecommerce',
  'reports_admin',
];

const MONTHS_META: Array<{ mm: string; bn: string; en: string }> = [
  { mm: '01', bn: 'জানুয়ারি', en: 'Jan' },
  { mm: '02', bn: 'ফেব্রুয়ারি', en: 'Feb' },
  { mm: '03', bn: 'মার্চ', en: 'Mar' },
  { mm: '04', bn: 'এপ্রিল', en: 'Apr' },
  { mm: '05', bn: 'মে', en: 'May' },
  { mm: '06', bn: 'জুন', en: 'Jun' },
  { mm: '07', bn: 'জুলাই', en: 'Jul' },
  { mm: '08', bn: 'আগস্ট', en: 'Aug' },
  { mm: '09', bn: 'সেপ্টেম্বর', en: 'Sep' },
  { mm: '10', bn: 'অক্টোবর', en: 'Oct' },
  { mm: '11', bn: 'নভেম্বর', en: 'Nov' },
  { mm: '12', bn: 'ডিসেম্বর', en: 'Dec' },
];

export function getDefaultPermissionsForRole(role: UserRole): StaffDashboardPermissions {
  switch (role) {
    case UserRole.SUPER_ADMIN:
    case UserRole.OWNER:
      return {
        allowedTabs: [...ALL_WORKSPACE_TABS],
        canViewProfit: true,
        canEditInventory: true,
        canDeleteItems: true,
        canManageExpenses: true,
      };
    case UserRole.MANAGER:
      return {
        allowedTabs: [...ALL_WORKSPACE_TABS],
        canViewProfit: true,
        canEditInventory: true,
        canDeleteItems: false,
        canManageExpenses: true,
      };
    case UserRole.INVENTORY:
      return {
        allowedTabs: ['inventory', 'ecommerce'],
        canViewProfit: false,
        canEditInventory: true,
        canDeleteItems: false,
        canManageExpenses: false,
      };
    case UserRole.CASHIER:
    default:
      return {
        allowedTabs: ['pos', 'sales_history', 'inventory', 'credit_expenses'],
        canViewProfit: false,
        canEditInventory: false,
        canDeleteItems: false,
        canManageExpenses: false,
      };
  }
}

export function ensureCustomerCreditHistory(credit: CustomerCredit): CreditHistoryEntry[] {
  if (Array.isArray(credit.history) && credit.history.length > 0) {
    return credit.history;
  }

  const entries: CreditHistoryEntry[] = [];
  const baseDate = credit.lastTransactionDate || new Date().toISOString().slice(0, 10);
  const openingTotal =
    credit.totalCreditSales > 0 ? credit.totalCreditSales : credit.balanceDue + credit.totalPaid;

  if (openingTotal > 0) {
    entries.push({
      id: `ch-open-${credit.id}`,
      customerId: credit.id,
      customerName: credit.name,
      customerNameEn: credit.nameEn || credit.name,
      customerPhone: credit.phone,
      date: baseDate,
      timestamp: `${baseDate}T09:00:00Z`,
      type: 'opening_due',
      previousDue: 0,
      creditAdded: openingTotal,
      paidAmount: 0,
      balanceAfter: openingTotal,
      note: credit.notes || 'Opening due balance',
      recordedBy: 'System',
    });
  }

  if (credit.totalPaid > 0) {
    entries.push({
      id: `ch-paid-${credit.id}`,
      customerId: credit.id,
      customerName: credit.name,
      customerNameEn: credit.nameEn || credit.name,
      customerPhone: credit.phone,
      date: baseDate,
      timestamp: `${baseDate}T12:00:00Z`,
      type: 'due_payment',
      previousDue: openingTotal,
      creditAdded: 0,
      paidAmount: credit.totalPaid,
      balanceAfter: Math.max(0, credit.balanceDue),
      paymentMethod: 'Cash',
      note: 'Recorded due payment',
      recordedBy: 'System',
    });
  }

  return entries;
}

function buildEmptySeasonalHistory(year: number): SeasonalMonthDatum[] {
  return MONTHS_META.map((m) => ({
    monthKey: `${year}-${m.mm}`,
    monthLabelBn: m.bn,
    monthLabelEn: m.en,
    sales: 0,
    grossProfit: 0,
    expenses: 0,
    netProfit: 0,
    ordersCount: 0,
    onTimeShippingPct: 100,
    avgDispatchHours: 0,
  }));
}

export interface FreshShopStoreParams {
  shopId: string;
  shopNameBn: string;
  shopNameEn: string;
  businessType: string;
  address: string;
  phone: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  spreadsheetId?: string;
  spreadsheetTitle?: string;
  spreadsheetUrl?: string;
  provisioningStatus?: 'connected' | 'pending_bridge' | 'unlinked';
  receiptFormat?: ShopReceiptPaperFormat;
}

export function buildFreshShopStore(params: FreshShopStoreParams): PosStoreState {
  const now = new Date();
  const year = now.getFullYear();
  const monthKey = now.toISOString().slice(0, 7);
  const todayIso = now.toISOString().slice(0, 10);

  return {
    shopId: params.shopId,
    shopNameBn: params.shopNameBn,
    shopNameEn: params.shopNameEn,
    businessType: params.businessType || 'General Retail',
    address: params.address || '',
    phone: params.phone || '',
    receiptFormat: params.receiptFormat || 'pos_thermal',
    categories: DEFAULT_SHOP_CATEGORIES.map((c) => ({ ...c })),
    selectedYear: year,
    selectedMonthKey: monthKey,
    products: [],
    sales: [],
    credits: [],
    expenses: [],
    ecommerceOrders: [],
    staff: [
      {
        id: params.ownerId,
        name: params.ownerName,
        email: params.ownerEmail,
        role: UserRole.OWNER,
        phone: params.phone || '',
        active: true,
        addedAt: todayIso,
        permissions: getDefaultPermissionsForRole(UserRole.OWNER),
      },
    ],
    auditLogs: [],
    seasonalHistory: buildEmptySeasonalHistory(year),
    sheetConfig: {
      spreadsheetId: params.spreadsheetId || '',
      spreadsheetTitle:
        params.spreadsheetTitle || `${params.shopNameBn} (${params.shopNameEn}) — MHS POS`,
      spreadsheetUrl: params.spreadsheetUrl || '',
      autoSync: true,
      lastSyncedAt: null,
      provisioningStatus: params.provisioningStatus || 'pending_bridge',
    },
    ecommerceCredentials: {
      shopifyDomain: '',
      shopifyAccessToken: '',
      wooStoreUrl: '',
      wooConsumerKey: '',
      wooConsumerSecret: '',
      autoDeductStock: true,
    },
  };
}

export function buildDefaultPosStore(): PosStoreState {
  const now = new Date();
  const year = now.getFullYear();
  const monthKey = now.toISOString().slice(0, 7);

  return {
    shopId: 'shop-main',
    shopNameBn: 'আমার ইলেকট্রনিকস শপ',
    shopNameEn: 'My Electronics Shop',
    businessType: 'Electronics & Gadgets',
    address: 'Dhaka, Bangladesh',
    phone: '01700-000001',
    categories: DEFAULT_SHOP_CATEGORIES.map((c) => ({ ...c })),
    selectedYear: year,
    selectedMonthKey: monthKey,
    products: [],
    sales: [],
    credits: [],
    expenses: [],
    ecommerceOrders: [],
    staff: [
      {
        id: 'staff-1',
        name: 'Md. Sumon (Shop Owner)',
        email: 'owner@electronics.bd',
        role: UserRole.OWNER,
        phone: '01700-000001',
        active: true,
        addedAt: '2026-01-01',
        permissions: getDefaultPermissionsForRole(UserRole.OWNER),
      },
      {
        id: 'staff-2',
        name: 'Rina Begum (Manager)',
        email: 'manager@electronics.bd',
        role: UserRole.MANAGER,
        phone: '01700-000002',
        active: true,
        addedAt: '2026-02-15',
        permissions: getDefaultPermissionsForRole(UserRole.MANAGER),
      },
      {
        id: 'staff-3',
        name: 'Tanvir Hasan (Cashier)',
        email: 'cashier@electronics.bd',
        role: UserRole.CASHIER,
        phone: '01800-000003',
        active: true,
        addedAt: '2026-04-10',
        permissions: getDefaultPermissionsForRole(UserRole.CASHIER),
      },
    ],
    auditLogs: [],
    seasonalHistory: buildEmptySeasonalHistory(year),
    sheetConfig: {
      spreadsheetId: '',
      spreadsheetTitle: 'আমার ইলেকট্রনিকস শপ (My Electronics Shop) — MHS POS',
      spreadsheetUrl: '',
      autoSync: true,
      lastSyncedAt: null,
      provisioningStatus: 'pending_bridge',
    },
    ecommerceCredentials: {
      shopifyDomain: '',
      shopifyAccessToken: '',
      wooStoreUrl: '',
      wooConsumerKey: '',
      wooConsumerSecret: '',
      autoDeductStock: true,
    },
    receiptFormat: 'pos_thermal',
  };
}

export function parseUploadedSummaryCsv(csvText: string): {
  shopTitleBn?: string;
  year?: number;
} {
  const lines = (csvText || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  let shopTitleBn: string | undefined;
  let year: number | undefined;

  for (const line of lines.slice(0, 10)) {
    if (!shopTitleBn && line.includes('—')) {
      const candidate = line
        .split('—')[0]
        .replace(/^,+/, '')
        .replace(/"/g, '')
        .trim();
      if (candidate) {
        shopTitleBn = candidate;
      }
    }
    const yearMatch = line.match(/\b(20\d{2})\b/);
    if (!year && yearMatch) {
      year = Number(yearMatch[1]);
    }
  }

  return { shopTitleBn, year };
}
