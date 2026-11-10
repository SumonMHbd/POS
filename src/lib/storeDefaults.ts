import {
  PaymentMethod,
  SalesChannel,
  UserRole,
  type CreditHistoryEntry,
  type CustomerCredit,
  type ExpenseEntry,
  type PosStoreState,
  type Product,
  type SaleTransaction,
  type SeasonalMonthDatum,
  type SheetConnectionConfig,
  type ShopReceiptPaperFormat,
  type StaffDashboardPermissions,
  type WorkspaceTab,
} from '../types/pos';
import { DEFAULT_SHOP_CATEGORIES } from '../i18n/translations';

export const ALL_WORKSPACE_TABS: WorkspaceTab[] = [
  'dashboard',
  'pos',
  'sales_history',
  'inventory',
  'credit_expenses',
  'ecommerce',
  'reports_admin',
];

export const MONTHS_META: Array<{ mm: string; bn: string; en: string }> = [
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

export function buildEmptySeasonalHistory(year: number): SeasonalMonthDatum[] {
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
      spreadsheetId: params.spreadsheetId || '1h5JWlK3MDgVIne1YwImt631SNq1tT0e3hOntPugJPe4',
      spreadsheetTitle:
        params.spreadsheetTitle || `${params.shopNameBn} (${params.shopNameEn}) — MHS POS`,
      spreadsheetUrl:
        params.spreadsheetUrl ||
        'https://docs.google.com/spreadsheets/d/1h5JWlK3MDgVIne1YwImt631SNq1tT0e3hOntPugJPe4/edit?gid=1102778112#gid=1102778112',
      autoSync: true,
      lastSyncedAt: new Date().toISOString(),
      provisioningStatus: params.provisioningStatus || 'connected',
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

export const DEFAULT_MASTER_SPREADSHEET_ID = '1h5JWlK3MDgVIne1YwImt631SNq1tT0e3hOntPugJPe4';
export const DEFAULT_MASTER_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1h5JWlK3MDgVIne1YwImt631SNq1tT0e3hOntPugJPe4/edit?gid=1102778112#gid=1102778112';
export const DEFAULT_MASTER_SPREADSHEET_TITLE =
  'MHS POS Master Directory & Super Admin Vault';

export const DEMO_SHOP_SHEET_CONFIG: SheetConnectionConfig = {
  spreadsheetId: '1h5JWlK3MDgVIne1YwImt631SNq1tT0e3hOntPugJPe4',
  spreadsheetTitle: 'আমার ইলেকট্রনিকস শপ (My Electronics Shop) — MHS POS Storefront & Ledger',
  spreadsheetUrl:
    'https://docs.google.com/spreadsheets/d/1h5JWlK3MDgVIne1YwImt631SNq1tT0e3hOntPugJPe4/edit?gid=1102778112#gid=1102778112',
  autoSync: true,
  lastSyncedAt: new Date().toISOString(),
  provisioningStatus: 'connected',
};

export const DEMO_ELECTRONICS_PRODUCTS: Product[] = [
  {
    id: 'prod-elec-1',
    sku: 'MBL-SAM-A15',
    name: 'Samsung Galaxy A15 (8/128GB)',
    nameBn: 'স্যামসাং গ্যালাক্সি এ১৫ (৮/১২৮জিবি)',
    category: 'মোবাইল ফোন',
    categoryEn: 'Mobile Phones',
    buyPrice: 18500,
    sellPrice: 21500,
    stock: 12,
    minStock: 3,
    soldThisMonth: 14,
    revenueThisMonth: 301000,
    unit: 'Pcs',
    updatedAt: '2026-11-01',
  },
  {
    id: 'prod-elec-2',
    sku: 'MBL-RED-N13',
    name: 'Redmi Note 13 (8/256GB)',
    nameBn: 'রেডমি নোট ১৩ (৮/২৫৬জিবি)',
    category: 'মোবাইল ফোন',
    categoryEn: 'Mobile Phones',
    buyPrice: 21000,
    sellPrice: 24200,
    stock: 8,
    minStock: 2,
    soldThisMonth: 11,
    revenueThisMonth: 266200,
    unit: 'Pcs',
    updatedAt: '2026-11-02',
  },
  {
    id: 'prod-elec-3',
    sku: 'ACC-ANK-20W',
    name: 'Anker 20W USB-C Fast Charger',
    nameBn: 'অ্যাঙ্কর ২০ ওয়াট ফাস্ট চার্জার',
    category: 'মোবাইল এক্সেসরিজ',
    categoryEn: 'Mobile Accessories',
    buyPrice: 950,
    sellPrice: 1450,
    stock: 35,
    minStock: 10,
    soldThisMonth: 42,
    revenueThisMonth: 60900,
    unit: 'Pcs',
    updatedAt: '2026-11-03',
  },
  {
    id: 'prod-elec-4',
    sku: 'ACC-BAS-65W',
    name: 'Baseus 65W GaN Multi-Port Charger',
    nameBn: 'বেসিউস ৬৫ ওয়াট গান চার্জার',
    category: 'মোবাইল এক্সেসরিজ',
    categoryEn: 'Mobile Accessories',
    buyPrice: 2100,
    sellPrice: 2950,
    stock: 18,
    minStock: 5,
    soldThisMonth: 19,
    revenueThisMonth: 56050,
    unit: 'Pcs',
    updatedAt: '2026-11-04',
  },
  {
    id: 'prod-elec-5',
    sku: 'ACC-RMX-TC1M',
    name: 'Remax Braided Type-C Fast Cable (1m)',
    nameBn: 'রেম্যাক্স টাইপ-সি ফাস্ট কেবল (১ মি)',
    category: 'মোবাইল এক্সেসরিজ',
    categoryEn: 'Mobile Accessories',
    buyPrice: 180,
    sellPrice: 350,
    stock: 65,
    minStock: 15,
    soldThisMonth: 85,
    revenueThisMonth: 29750,
    unit: 'Pcs',
    updatedAt: '2026-11-05',
  },
  {
    id: 'prod-elec-6',
    sku: 'AUD-RLM-T300',
    name: 'Realme Buds T300 ANC Earbuds',
    nameBn: 'রিয়েলমি বাডস টি৩০০ ইয়ারবাডস',
    category: 'অডিও/স্পিকার',
    categoryEn: 'Audio & Speakers',
    buyPrice: 2400,
    sellPrice: 3200,
    stock: 22,
    minStock: 5,
    soldThisMonth: 28,
    revenueThisMonth: 89600,
    unit: 'Pcs',
    updatedAt: '2026-11-05',
  },
  {
    id: 'prod-elec-7',
    sku: 'AUD-JBL-GO3',
    name: 'JBL GO 3 Portable Bluetooth Speaker',
    nameBn: 'জেবিএল গো ৩ পোর্টেবল স্পিকার',
    category: 'অডিও/স্পিকার',
    categoryEn: 'Audio & Speakers',
    buyPrice: 3400,
    sellPrice: 4500,
    stock: 14,
    minStock: 4,
    soldThisMonth: 16,
    revenueThisMonth: 72000,
    unit: 'Pcs',
    updatedAt: '2026-11-06',
  },
  {
    id: 'prod-elec-8',
    sku: 'GGT-JYR-20K',
    name: 'Joyroom 20,000mAh Fast Power Bank',
    nameBn: 'জয়রুম ২০,০০০ মিলিঅ্যাম্পিয়ার পাওয়ার ব্যাংক',
    category: 'গ্যাজেট/স্মার্ট ডিভাইস',
    categoryEn: 'Gadgets & Smart Devices',
    buyPrice: 1650,
    sellPrice: 2450,
    stock: 25,
    minStock: 6,
    soldThisMonth: 31,
    revenueThisMonth: 75950,
    unit: 'Pcs',
    updatedAt: '2026-11-06',
  },
  {
    id: 'prod-elec-9',
    sku: 'GGT-HYL-RT3',
    name: 'Haylou Solar Plus RT3 Smart Watch',
    nameBn: 'হাইলু সোলার প্লাস স্মার্ট ওয়াচ',
    category: 'গ্যাজেট/স্মার্ট ডিভাইস',
    categoryEn: 'Gadgets & Smart Devices',
    buyPrice: 3200,
    sellPrice: 4400,
    stock: 15,
    minStock: 4,
    soldThisMonth: 14,
    revenueThisMonth: 61600,
    unit: 'Pcs',
    updatedAt: '2026-11-06',
  },
  {
    id: 'prod-elec-10',
    sku: 'CMP-LOG-B100',
    name: 'Logitech B100 Optical USB Mouse',
    nameBn: 'লজিটেক অপটিক্যাল ইউএসবি মাউস',
    category: 'কম্পিউটার এক্সেসরিজ',
    categoryEn: 'Computer Accessories',
    buyPrice: 320,
    sellPrice: 490,
    stock: 40,
    minStock: 10,
    soldThisMonth: 53,
    revenueThisMonth: 25970,
    unit: 'Pcs',
    updatedAt: '2026-11-06',
  },
  {
    id: 'prod-elec-11',
    sku: 'CMP-A4T-KB',
    name: 'A4Tech ComfortKey Multimedia Keyboard',
    nameBn: 'এ৪টেক মাল্টিমিডিয়া কীবোর্ড',
    category: 'কম্পিউটার এক্সেসরিজ',
    categoryEn: 'Computer Accessories',
    buyPrice: 650,
    sellPrice: 950,
    stock: 20,
    minStock: 5,
    soldThisMonth: 22,
    revenueThisMonth: 20900,
    unit: 'Pcs',
    updatedAt: '2026-11-06',
  },
  {
    id: 'prod-elec-12',
    sku: 'CMP-SND-64G',
    name: 'SanDisk Ultra 64GB USB 3.0 Pen Drive',
    nameBn: 'স্যানডিস্ক আল্ট্রা ৬৪জিবি পেনড্রাইভ',
    category: 'কম্পিউটার এক্সেসরিজ',
    categoryEn: 'Computer Accessories',
    buyPrice: 520,
    sellPrice: 750,
    stock: 45,
    minStock: 10,
    soldThisMonth: 38,
    revenueThisMonth: 28500,
    unit: 'Pcs',
    updatedAt: '2026-11-06',
  },
  {
    id: 'prod-elec-13',
    sku: 'HOM-PAN-KET',
    name: 'Panasonic 1.5L Stainless Electric Kettle',
    nameBn: 'প্যানাসনিক ১.৫ লিটার ইলেকট্রিক কেটলি',
    category: 'হোম অ্যাপ্লায়েন্স',
    categoryEn: 'Home Appliances',
    buyPrice: 1800,
    sellPrice: 2450,
    stock: 11,
    minStock: 3,
    soldThisMonth: 12,
    revenueThisMonth: 29400,
    unit: 'Pcs',
    updatedAt: '2026-11-07',
  },
  {
    id: 'prod-elec-14',
    sku: 'HOM-HAV-FAN',
    name: 'Havells 16-Inch High Speed Table Fan',
    nameBn: 'হ্যাভেলস ১৬ ইঞ্চি হাই-স্পিড টেবিল ফ্যান',
    category: 'হোম অ্যাপ্লায়েন্স',
    categoryEn: 'Home Appliances',
    buyPrice: 2600,
    sellPrice: 3400,
    stock: 9,
    minStock: 3,
    soldThisMonth: 10,
    revenueThisMonth: 34000,
    unit: 'Pcs',
    updatedAt: '2026-11-07',
  },
  {
    id: 'prod-elec-15',
    sku: 'LGT-PHL-18W',
    name: 'Philips 18W LED Warm White Bulb',
    nameBn: 'ফিলিপস ১৮ ওয়াট এলইডি বাল্ব',
    category: 'লাইট ও ইলেকট্রিক',
    categoryEn: 'Light & Electric',
    buyPrice: 280,
    sellPrice: 420,
    stock: 80,
    minStock: 20,
    soldThisMonth: 95,
    revenueThisMonth: 39900,
    unit: 'Pcs',
    updatedAt: '2026-11-07',
  },
  {
    id: 'prod-elec-16',
    sku: 'LGT-SCH-EXT',
    name: 'Schneider 4-Way Multi Extension Socket',
    nameBn: 'স্নাইডার ৪-পোর্ট মাল্টি এক্সটেনশন সকেট',
    category: 'লাইট ও ইলেকট্রিক',
    categoryEn: 'Light & Electric',
    buyPrice: 750,
    sellPrice: 1150,
    stock: 28,
    minStock: 8,
    soldThisMonth: 26,
    revenueThisMonth: 29900,
    unit: 'Pcs',
    updatedAt: '2026-11-07',
  },
];

export const DEMO_ELECTRONICS_SALES: SaleTransaction[] = [
  {
    id: 'sale-demo-1',
    invoiceNo: 'INV-2611-001',
    date: '2026-11-05',
    timestamp: '2026-11-05T10:30:00Z',
    monthKey: '2026-11',
    channel: SalesChannel.WALK_IN,
    paymentMethod: PaymentMethod.MOBILE_BANKING,
    items: [
      {
        productId: 'prod-elec-3',
        sku: 'ACC-ANK-20W',
        name: 'Anker 20W USB-C Fast Charger',
        category: 'মোবাইল এক্সেসরিজ',
        quantity: 1,
        unitPrice: 1450,
        buyPrice: 950,
        subtotal: 1450,
        profit: 500,
      },
      {
        productId: 'prod-elec-5',
        sku: 'ACC-RMX-TC1M',
        name: 'Remax Braided Type-C Fast Cable (1m)',
        category: 'মোবাইল এক্সেসরিজ',
        quantity: 1,
        unitPrice: 350,
        buyPrice: 180,
        subtotal: 350,
        profit: 170,
      },
    ],
    subtotal: 1800,
    discount: 0,
    serviceFee: 0,
    totalAmount: 1800,
    grossProfit: 670,
    paidAmount: 1800,
    dueAmount: 0,
    customerId: 'cust-1',
    customerName: 'হাসান মাহমুদ (Hasan Mahmud)',
    customerPhone: '01711-234567',
    cashierName: 'Tanvir Hasan',
    syncedToSheet: true,
  },
  {
    id: 'sale-demo-2',
    invoiceNo: 'INV-2611-002',
    date: '2026-11-06',
    timestamp: '2026-11-06T14:15:00Z',
    monthKey: '2026-11',
    channel: SalesChannel.WALK_IN,
    paymentMethod: PaymentMethod.CASH,
    items: [
      {
        productId: 'prod-elec-1',
        sku: 'MBL-SAM-A15',
        name: 'Samsung Galaxy A15 (8/128GB)',
        category: 'মোবাইল ফোন',
        quantity: 1,
        unitPrice: 21500,
        buyPrice: 18500,
        subtotal: 21500,
        profit: 3000,
      },
      {
        productId: 'prod-elec-8',
        sku: 'GGT-JYR-20K',
        name: 'Joyroom 20,000mAh Fast Power Bank',
        category: 'গ্যাজেট/স্মার্ট ডিভাইস',
        quantity: 1,
        unitPrice: 2450,
        buyPrice: 1650,
        subtotal: 2450,
        profit: 800,
      },
    ],
    subtotal: 23950,
    discount: 0,
    serviceFee: 0,
    totalAmount: 23950,
    grossProfit: 3800,
    paidAmount: 23950,
    dueAmount: 0,
    customerId: 'cust-2',
    customerName: 'ফারহানা আক্তার (Farhana Akter)',
    customerPhone: '01922-345678',
    cashierName: 'Md. Sumon',
    syncedToSheet: true,
  },
  {
    id: 'sale-demo-3',
    invoiceNo: 'INV-2611-003',
    date: '2026-11-06',
    timestamp: '2026-11-06T17:45:00Z',
    monthKey: '2026-11',
    channel: SalesChannel.WALK_IN,
    paymentMethod: PaymentMethod.CREDIT,
    items: [
      {
        productId: 'prod-elec-6',
        sku: 'AUD-RLM-T300',
        name: 'Realme Buds T300 ANC Earbuds',
        category: 'অডিও/স্পিকার',
        quantity: 1,
        unitPrice: 3200,
        buyPrice: 2400,
        subtotal: 3200,
        profit: 800,
      },
      {
        productId: 'prod-elec-12',
        sku: 'CMP-SND-64G',
        name: 'SanDisk Ultra 64GB USB 3.0 Pen Drive',
        category: 'কম্পিউটার এক্সেসরিজ',
        quantity: 1,
        unitPrice: 750,
        buyPrice: 520,
        subtotal: 750,
        profit: 230,
      },
    ],
    subtotal: 3950,
    discount: 0,
    serviceFee: 0,
    totalAmount: 3950,
    grossProfit: 1030,
    paidAmount: 1000,
    dueAmount: 2950,
    customerId: 'c-101',
    customerName: 'কামরুল ইসলাম',
    customerPhone: '01833-456789',
    cashierName: 'Rina Begum',
    syncedToSheet: true,
  },
  {
    id: 'sale-demo-4',
    invoiceNo: 'INV-2611-004',
    date: '2026-11-07',
    timestamp: '2026-11-07T11:20:00Z',
    monthKey: '2026-11',
    channel: SalesChannel.WALK_IN,
    paymentMethod: PaymentMethod.CASH,
    items: [
      {
        productId: 'prod-elec-13',
        sku: 'HOM-PAN-KET',
        name: 'Panasonic 1.5L Stainless Electric Kettle',
        category: 'হোম অ্যাপ্লায়েন্স',
        quantity: 1,
        unitPrice: 2450,
        buyPrice: 1800,
        subtotal: 2450,
        profit: 650,
      },
    ],
    subtotal: 2450,
    discount: 0,
    serviceFee: 0,
    totalAmount: 2450,
    grossProfit: 650,
    paidAmount: 2450,
    dueAmount: 0,
    customerId: 'cust-4',
    customerName: 'নাহিদ জামান (Nahid Zaman)',
    customerPhone: '01755-678901',
    cashierName: 'Tanvir Hasan',
    syncedToSheet: true,
  },
  {
    id: 'sale-demo-5',
    invoiceNo: 'INV-2611-005',
    date: '2026-11-07',
    timestamp: '2026-11-07T15:00:00Z',
    monthKey: '2026-11',
    channel: SalesChannel.WALK_IN,
    paymentMethod: PaymentMethod.CARD,
    items: [
      {
        productId: 'prod-elec-9',
        sku: 'GGT-HYL-RT3',
        name: 'Haylou Solar Plus RT3 Smart Watch',
        category: 'গ্যাজেট/স্মার্ট ডিভাইস',
        quantity: 1,
        unitPrice: 4400,
        buyPrice: 3200,
        subtotal: 4400,
        profit: 1200,
      },
      {
        productId: 'prod-elec-4',
        sku: 'ACC-BAS-65W',
        name: 'Baseus 65W GaN Multi-Port Charger',
        category: 'মোবাইল এক্সেসরিজ',
        quantity: 1,
        unitPrice: 2950,
        buyPrice: 2100,
        subtotal: 2950,
        profit: 850,
      },
    ],
    subtotal: 7350,
    discount: 0,
    serviceFee: 0,
    totalAmount: 7350,
    grossProfit: 2050,
    paidAmount: 7350,
    dueAmount: 0,
    customerId: 'cust-5',
    customerName: 'ড. আরিফুর রহমান (Dr. Arifur Rahman)',
    customerPhone: '01677-890123',
    cashierName: 'Md. Sumon',
    syncedToSheet: true,
  },
];

export const DEMO_CUSTOMER_CREDITS: CustomerCredit[] = [
  {
    id: 'c-101',
    name: 'কামরুল ইসলাম',
    nameEn: 'Kamrul Islam',
    phone: '01833-456789',
    totalCreditSales: 6500,
    totalPaid: 3550,
    balanceDue: 2950,
    dueDate: '2026-11-25',
    lastTransactionDate: '2026-11-06',
    isOverdue: false,
    notes: 'নিয়মিত গ্যাজেট ক্রেতা, আগামী সপ্তাহে বাকি পরিশোধ করবেন',
    history: [
      {
        id: 'ch-1',
        customerId: 'c-101',
        customerName: 'কামরুল ইসলাম',
        customerPhone: '01833-456789',
        date: '2026-10-20',
        timestamp: '2026-10-20T11:00:00Z',
        type: 'opening_due',
        previousDue: 0,
        creditAdded: 2550,
        paidAmount: 0,
        balanceAfter: 2550,
        note: 'পূর্বের বকেয়া হিসাব',
        recordedBy: 'Md. Sumon',
      },
      {
        id: 'ch-2',
        customerId: 'c-101',
        customerName: 'কামরুল ইসলাম',
        customerPhone: '01833-456789',
        date: '2026-10-28',
        timestamp: '2026-10-28T16:00:00Z',
        type: 'due_payment',
        previousDue: 2550,
        creditAdded: 0,
        paidAmount: 2550,
        balanceAfter: 0,
        paymentMethod: 'Cash',
        note: 'বকেয়া পরিশোধ',
        recordedBy: 'Tanvir Hasan',
      },
      {
        id: 'ch-3',
        customerId: 'c-101',
        customerName: 'কামরুল ইসলাম',
        customerPhone: '01833-456789',
        date: '2026-11-06',
        timestamp: '2026-11-06T17:45:00Z',
        type: 'credit_sale',
        previousDue: 0,
        creditAdded: 3950,
        paidAmount: 1000,
        balanceAfter: 2950,
        invoiceNo: 'INV-2611-003',
        note: 'Realme Buds + SanDisk 64GB ক্রয়ে আংশিক বাকি',
        recordedBy: 'Rina Begum',
      },
    ],
  },
  {
    id: 'c-102',
    name: 'মো: রফিক আহমেদ',
    nameEn: 'Md. Rafiq Ahmed',
    phone: '01722-112233',
    totalCreditSales: 12000,
    totalPaid: 8000,
    balanceDue: 4000,
    dueDate: '2026-11-15',
    lastTransactionDate: '2026-11-02',
    isOverdue: false,
    notes: 'লোকাল অফিসের আইটি সাপোর্ট সামগ্রী সরবরাহ',
    history: [
      {
        id: 'ch-4',
        customerId: 'c-102',
        customerName: 'মো: রফিক আহমেদ',
        customerPhone: '01722-112233',
        date: '2026-11-02',
        timestamp: '2026-11-02T10:00:00Z',
        type: 'credit_sale',
        previousDue: 0,
        creditAdded: 12000,
        paidAmount: 8000,
        balanceAfter: 4000,
        invoiceNo: 'INV-2611-PREV',
        note: 'অফিস মাউস ও কীবোর্ড ডেলিভারি',
        recordedBy: 'Md. Sumon',
      },
    ],
  },
  {
    id: 'c-103',
    name: 'সেলিনা পারভীন',
    nameEn: 'Selina Parveen',
    phone: '01911-998877',
    totalCreditSales: 4800,
    totalPaid: 4800,
    balanceDue: 0,
    dueDate: '2026-11-02',
    lastTransactionDate: '2026-11-02',
    isOverdue: false,
    notes: 'সম্পূর্ণ বকেয়া পরিশোধিত',
    history: [],
  },
];

export const DEMO_EXPENSES: ExpenseEntry[] = [
  {
    id: 'exp-1',
    categoryBn: 'দোকান ভাড়া',
    categoryEn: 'Shop Rent',
    amount: 25000,
    date: '2026-11-01',
    monthKey: '2026-11',
    type: 'expense',
    note: 'দোকানের নভেম্বর মাসের মাসিক ভাড়া পরিশোধ',
    recordedBy: 'Md. Sumon',
  },
  {
    id: 'exp-2',
    categoryBn: 'বিদ্যুৎ ও ইউটিলিটি বিল',
    categoryEn: 'Electricity & Utilities',
    amount: 4200,
    date: '2026-11-03',
    monthKey: '2026-11',
    type: 'expense',
    note: 'ডেসকো বাণিজ্যিক বিদ্যুৎ বিল পরিশোধ',
    recordedBy: 'Md. Sumon',
  },
  {
    id: 'exp-3',
    categoryBn: 'কর্মচারী চা-নাস্তা ও রিফ্রেশমেন্ট',
    categoryEn: 'Staff Refreshment',
    amount: 1500,
    date: '2026-11-05',
    monthKey: '2026-11',
    type: 'expense',
    note: 'সাপ্তাহিক চা, বিস্কুট ও অতিথি আপ্যায়ন খরচ',
    recordedBy: 'Tanvir Hasan',
  },
  {
    id: 'exp-4',
    categoryBn: 'মালামাল পরিবহন খরচ',
    categoryEn: 'Inventory Logistics',
    amount: 2800,
    date: '2026-11-06',
    monthKey: '2026-11',
    type: 'inventory_purchase',
    note: 'স্টেডিয়াম মার্কেট থেকে মালামাল আনয়ন কুরিয়ার ও ভ্যান ভাড়া',
    recordedBy: 'Rina Begum',
  },
];

export const DEMO_SEASONAL_HISTORY: SeasonalMonthDatum[] = [
  { monthKey: '2026-01', monthLabelBn: 'জানুয়ারি', monthLabelEn: 'Jan', sales: 485000, grossProfit: 82000, expenses: 32000, netProfit: 50000, ordersCount: 142, onTimeShippingPct: 98, avgDispatchHours: 3.2 },
  { monthKey: '2026-02', monthLabelBn: 'ফেব্রুয়ারি', monthLabelEn: 'Feb', sales: 512000, grossProfit: 89000, expenses: 33500, netProfit: 55500, ordersCount: 156, onTimeShippingPct: 99, avgDispatchHours: 2.8 },
  { monthKey: '2026-03', monthLabelBn: 'মার্চ', monthLabelEn: 'Mar', sales: 620000, grossProfit: 108000, expenses: 36000, netProfit: 72000, ordersCount: 184, onTimeShippingPct: 97, avgDispatchHours: 3.5 },
  { monthKey: '2026-04', monthLabelBn: 'এপ্রিল', monthLabelEn: 'Apr', sales: 790000, grossProfit: 142000, expenses: 42000, netProfit: 100000, ordersCount: 230, onTimeShippingPct: 99, avgDispatchHours: 2.4 },
  { monthKey: '2026-05', monthLabelBn: 'মে', monthLabelEn: 'May', sales: 580000, grossProfit: 98000, expenses: 34000, netProfit: 64000, ordersCount: 172, onTimeShippingPct: 98, avgDispatchHours: 2.9 },
  { monthKey: '2026-06', monthLabelBn: 'জুন', monthLabelEn: 'Jun', sales: 640000, grossProfit: 112000, expenses: 35000, netProfit: 77000, ordersCount: 191, onTimeShippingPct: 98, avgDispatchHours: 3.1 },
  { monthKey: '2026-07', monthLabelBn: 'জুলাই', monthLabelEn: 'Jul', sales: 610000, grossProfit: 104000, expenses: 34500, netProfit: 69500, ordersCount: 180, onTimeShippingPct: 97, avgDispatchHours: 3.4 },
  { monthKey: '2026-08', monthLabelBn: 'আগস্ট', monthLabelEn: 'Aug', sales: 675000, grossProfit: 118000, expenses: 36000, netProfit: 82000, ordersCount: 198, onTimeShippingPct: 99, avgDispatchHours: 2.6 },
  { monthKey: '2026-09', monthLabelBn: 'সেপ্টেম্বর', monthLabelEn: 'Sep', sales: 710000, grossProfit: 125000, expenses: 37500, netProfit: 87500, ordersCount: 209, onTimeShippingPct: 98, avgDispatchHours: 2.7 },
  { monthKey: '2026-10', monthLabelBn: 'অক্টোবর', monthLabelEn: 'Oct', sales: 745000, grossProfit: 132000, expenses: 38000, netProfit: 94000, ordersCount: 221, onTimeShippingPct: 99, avgDispatchHours: 2.5 },
  { monthKey: '2026-11', monthLabelBn: 'নভেম্বর', monthLabelEn: 'Nov', sales: 395450, grossProfit: 82000, expenses: 33500, netProfit: 48500, ordersCount: 28, onTimeShippingPct: 100, avgDispatchHours: 1.5 },
  { monthKey: '2026-12', monthLabelBn: 'ডিসেম্বর', monthLabelEn: 'Dec', sales: 0, grossProfit: 0, expenses: 0, netProfit: 0, ordersCount: 0, onTimeShippingPct: 100, avgDispatchHours: 0 },
];

export function buildDefaultPosStore(): PosStoreState {
  const now = new Date();
  const year = now.getFullYear();
  const monthKey = now.toISOString().slice(0, 7);

  return {
    shopId: 'shop-main',
    shopNameBn: 'আমার ইলেকট্রনিকস শপ',
    shopNameEn: 'My Electronics Shop',
    businessType: 'Electronics & Gadgets',
    address: 'Stadium Market, Dhaka, Bangladesh',
    phone: '01700-000001',
    categories: DEFAULT_SHOP_CATEGORIES.map((c) => ({ ...c })),
    selectedYear: year,
    selectedMonthKey: monthKey,
    products: DEMO_ELECTRONICS_PRODUCTS.map((p) => ({ ...p })),
    sales: DEMO_ELECTRONICS_SALES.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) })),
    credits: DEMO_CUSTOMER_CREDITS.map((c) => ({
      ...c,
      history: c.history ? c.history.map((h) => ({ ...h })) : [],
    })),
    expenses: DEMO_EXPENSES.map((e) => ({ ...e })),
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
    seasonalHistory: DEMO_SEASONAL_HISTORY.map((m) => ({ ...m })),
    sheetConfig: { ...DEMO_SHOP_SHEET_CONFIG },
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
