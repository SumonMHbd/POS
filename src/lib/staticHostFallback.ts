import {
  UserRole,
  type AdminCredentialVaultItem,
  type AuditLogEntry,
  type AuthSessionUser,
  type CreditHistoryEntry,
  type PlatformGoogleSheetsEngineConfig,
  type PosStoreState,
  type SheetConnectionConfig,
  type ShopAccountStatus,
  type ShopFeatureEntitlements,
  type ShopSubscriptionPlan,
  type ShopTenantSummary,
  type StaffDashboardPermissions,
  type StaffMember,
  type SubscriptionInvoiceRecord,
  type SubscriptionPaymentStatus,
  type SuperAdminOverviewResponse,
} from '../types/pos';
import {
  buildDefaultPosStore,
  buildFreshShopStore,
  ensureCustomerCreditHistory,
  getDefaultPermissionsForRole,
} from './storeDefaults';

const STATIC_DB_STORAGE_KEY = 'mhs_pos_static_platform_db_v2';

interface StaticUserAccount {
  id: string;
  name: string;
  email: string;
  passwordSalt: string;
  passwordDigest: string;
  vaultSecretEncoded: string;
  role: UserRole;
  shopId: string | null;
  phone: string;
  active: boolean;
  permissions?: StaffDashboardPermissions;
  createdAt: string;
}

interface StaticShopRecord {
  shopId: string;
  ownerName: string;
  ownerEmail: string;
  status: ShopAccountStatus;
  plan: ShopSubscriptionPlan;
  monthlySubscriptionFee: number;
  billingStatus: SubscriptionPaymentStatus;
  nextBillingDate: string;
  createdAt: string;
  entitlements: ShopFeatureEntitlements;
  posState: PosStoreState;
}

interface StaticPlatformDatabase {
  schemaVersion: number;
  globalAnnouncement: string;
  planPricing: Record<ShopSubscriptionPlan, number>;
  googleSheetsEngine: PlatformGoogleSheetsEngineConfig;
  users: StaticUserAccount[];
  shops: Record<string, StaticShopRecord>;
  invoices: SubscriptionInvoiceRecord[];
  platformAuditLogs: Array<AuditLogEntry & { shopName?: string }>;
}

function encodeVaultValue(plain: string): string {
  try {
    return btoa(unescape(encodeURIComponent(`mhs:${plain}`)));
  } catch {
    return '';
  }
}

function decodeVaultValue(encoded: string): string {
  if (!encoded) return '••••••';
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    return decoded.startsWith('mhs:') ? decoded.slice(4) : '••••••';
  } catch {
    return '••••••';
  }
}

async function computePasswordDigest(password: string, salt: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(`${salt}::mhs-pos::${password}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 2166136261;
  const input = `${salt}::mhs-pos::${password}`;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function randomId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function makeUserRecord(params: {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  shopId: string | null;
  phone: string;
  permissions?: StaffDashboardPermissions;
  createdAt?: string;
}): Promise<StaticUserAccount> {
  const salt = randomId('salt');
  const digest = await computePasswordDigest(params.password, salt);
  return {
    id: params.id,
    name: params.name,
    email: params.email.trim().toLowerCase(),
    passwordSalt: salt,
    passwordDigest: digest,
    vaultSecretEncoded: encodeVaultValue(params.password),
    role: params.role,
    shopId: params.shopId,
    phone: params.phone,
    active: true,
    permissions: params.permissions,
    createdAt: params.createdAt || new Date().toISOString(),
  };
}

async function createSeededStaticDb(): Promise<StaticPlatformDatabase> {
  const flagshipPos = buildDefaultPosStore();
  const users: StaticUserAccount[] = [
    {
      id: 'user-superadmin-1',
      name: 'MHS Super Admin',
      email: 'mhsumon670@gmail.com',
      passwordSalt: 'salt-mhs-superadmin',
      passwordDigest: '61a5e4c472ad09f1f00e065d0316cd783b76f7c312bf6cab745bdd25717d992c',
      vaultSecretEncoded: '',
      role: UserRole.SUPER_ADMIN,
      shopId: null,
      phone: '01700-000000',
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'staff-1',
      name: 'Md. Sumon (Shop Owner)',
      email: 'owner@electronics.bd',
      passwordSalt: 'salt-mhs-owner',
      passwordDigest: '12b4178967abd73a7b9b3e4b3912fd054b84c0e9eda837737540b5259a2d4c0c',
      vaultSecretEncoded: '',
      role: UserRole.OWNER,
      shopId: flagshipPos.shopId,
      phone: '01700-000001',
      active: true,
      permissions: getDefaultPermissionsForRole(UserRole.OWNER),
      createdAt: '2026-01-01T09:00:00Z',
    },
    {
      id: 'staff-2',
      name: 'Rina Begum (Manager)',
      email: 'manager@electronics.bd',
      passwordSalt: 'salt-mhs-manager',
      passwordDigest: '9df6f7704f74c8583fa1ced3734a1f34c18b3778275ac49d565dbbb4b90c6610',
      vaultSecretEncoded: '',
      role: UserRole.MANAGER,
      shopId: flagshipPos.shopId,
      phone: '01700-000002',
      active: true,
      permissions: getDefaultPermissionsForRole(UserRole.MANAGER),
      createdAt: '2026-02-15T09:00:00Z',
    },
    {
      id: 'staff-3',
      name: 'Tanvir Hasan (Cashier)',
      email: 'cashier@electronics.bd',
      passwordSalt: 'salt-mhs-cashier',
      passwordDigest: '01e2af3a6b8c8b1349552f8f3b1d0bbde8a337907e72e43ad407023bf30afd33',
      vaultSecretEncoded: '',
      role: UserRole.CASHIER,
      shopId: flagshipPos.shopId,
      phone: '01800-000003',
      active: true,
      permissions: getDefaultPermissionsForRole(UserRole.CASHIER),
      createdAt: '2026-04-10T09:00:00Z',
    },
  ];

  const shops: Record<string, StaticShopRecord> = {
    [flagshipPos.shopId]: {
      shopId: flagshipPos.shopId,
      ownerName: 'Md. Sumon',
      ownerEmail: 'owner@electronics.bd',
      status: 'Active',
      plan: 'Business',
      monthlySubscriptionFee: 1000,
      billingStatus: 'Paid',
      nextBillingDate: '2026-11-30',
      createdAt: '2026-01-01T09:00:00Z',
      entitlements: {
        enableEcommerce: true,
        enableCreditLedger: true,
        enableAuditExports: true,
        maxStaffAccounts: 15,
      },
      posState: flagshipPos,
    },
  };

  const invoices: SubscriptionInvoiceRecord[] = [
    {
      id: 'sub-inv-1001',
      shopId: flagshipPos.shopId,
      shopNameBn: flagshipPos.shopNameBn,
      shopNameEn: flagshipPos.shopNameEn,
      ownerEmail: 'owner@electronics.bd',
      plan: 'Business',
      monthKey: '2026-10',
      amount: 1000,
      status: 'Paid',
      dueDate: '2026-10-05',
      paidAt: '2026-10-03T11:20:00Z',
      paymentMethod: 'bKash / Nagad',
      receiptNo: 'SUB-2610-001',
      note: 'October 2026 monthly POS SaaS subscription paid.',
    },
    {
      id: 'sub-inv-1002',
      shopId: flagshipPos.shopId,
      shopNameBn: flagshipPos.shopNameBn,
      shopNameEn: flagshipPos.shopNameEn,
      ownerEmail: 'owner@electronics.bd',
      plan: 'Business',
      monthKey: '2026-11',
      amount: 1000,
      status: 'Paid',
      dueDate: '2026-11-05',
      paidAt: '2026-11-01T06:00:00Z',
      paymentMethod: 'Cash',
      receiptNo: 'SUB-2611-001',
      note: 'November 2026 monthly POS SaaS subscription collected.',
    },
  ];

  return {
    schemaVersion: 2,
    globalAnnouncement: '',
    planPricing: {
      Starter: 500,
      Business: 1000,
      Enterprise: 2000,
      Custom: 750,
    },
    googleSheetsEngine: {
      appsScriptWebAppUrl: 'https://script.google.com/macros/s/AKfycbx_mhs_pos_master_engine/exec',
      sharedSecret: 'mhs_secure_vault_token_2026',
      masterDirectorySheetUrl: 'https://docs.google.com/spreadsheets/d/1yO9SIziUyElqlxhHHlXHnRvzy0GocdP6Fad67AMBsUQ/edit?gid=647109661#gid=647109661',
      masterSpreadsheetId: '1yO9SIziUyElqlxhHHlXHnRvzy0GocdP6Fad67AMBsUQ',
      masterSpreadsheetTitle: 'MHS POS Master Directory & Super Admin Vault',
      autoCreateSheetForNewShop: true,
      lastConnectedAt: new Date().toISOString(),
      lastMasterSyncedAt: new Date().toISOString(),
    },
    users,
    shops,
    invoices,
    platformAuditLogs: [
      {
        id: 'plat-aud-1',
        timestamp: new Date().toISOString(),
        actorName: 'MHS Super Admin',
        actorEmail: 'mhsumon670@gmail.com',
        actorRole: UserRole.SUPER_ADMIN,
        actionType: 'SHOP_CREATED',
        entityLabel: flagshipPos.shopNameBn,
        details: 'Initialized browser-persisted POS workspace.',
        shopName: flagshipPos.shopNameEn,
      },
    ],
  };
}

let memoryDbCache: StaticPlatformDatabase | null = null;

async function loadStaticDb(): Promise<StaticPlatformDatabase> {
  if (memoryDbCache) return memoryDbCache;
  try {
    const raw = localStorage.getItem(STATIC_DB_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StaticPlatformDatabase;
      if (parsed && Array.isArray(parsed.users) && parsed.shops) {
        memoryDbCache = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore storage parse failure
  }
  const seeded = await createSeededStaticDb();
  saveStaticDb(seeded);
  return seeded;
}

function saveStaticDb(db: StaticPlatformDatabase): void {
  memoryDbCache = db;
  try {
    localStorage.setItem(STATIC_DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors
  }
}

function makeStaticToken(userId: string): string {
  try {
    return `static.${btoa(JSON.stringify({ uid: userId, ts: Date.now() }))}`;
  } catch {
    return `static.${userId}`;
  }
}

function resolveUserFromToken(
  db: StaticPlatformDatabase,
  token: string | null
): StaticUserAccount | null {
  if (!token) return null;
  if (token.startsWith('static.')) {
    const rest = token.slice('static.'.length);
    try {
      const parsed = JSON.parse(atob(rest)) as { uid?: string };
      if (parsed.uid) {
        return db.users.find((u) => u.id === parsed.uid && u.active) || null;
      }
    } catch {
      return db.users.find((u) => u.id === rest && u.active) || null;
    }
  }
  return null;
}

function extractSpreadsheetId(urlOrId?: string): string {
  const raw = (urlOrId || '').trim();
  if (!raw) return '';
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw)) return raw;
  return '';
}

function computeShopSummary(record: StaticShopRecord): ShopTenantSummary {
  const s = record.posState;
  const monthKey = s.selectedMonthKey;
  const skuCount = s.products.length;
  const outOfStockCount = s.products.filter((p) => p.stock === 0).length;
  const lowStockCount = s.products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
  const stockValue = s.products.reduce((sum, p) => sum + p.buyPrice * p.stock, 0);

  const monthSales = s.sales.filter((tx) => tx.monthKey === monthKey);
  const liveSalesSum = monthSales.reduce((sum, tx) => sum + tx.totalAmount, 0);
  const liveGrossSum = monthSales.reduce((sum, tx) => sum + tx.grossProfit, 0);
  const seasonal = s.seasonalHistory.find((m) => m.monthKey === monthKey);

  const monthlySales = liveSalesSum > 0 ? liveSalesSum : seasonal?.sales || 0;
  const monthlyGrossProfit = liveGrossSum > 0 ? liveGrossSum : seasonal?.grossProfit || 0;

  const monthExpItems = s.expenses.filter(
    (e) => (e.monthKey || e.date.slice(0, 7)) === monthKey && e.type === 'expense'
  );
  const itemizedExp = monthExpItems.reduce((sum, e) => sum + e.amount, 0);
  const hasSeededExp = monthExpItems.some((e) => /^exp-\d{1,4}$/.test(e.id));
  const baseExp = seasonal && seasonal.expenses > 0 && !hasSeededExp ? seasonal.expenses : 0;
  const monthlyExpenses = baseExp + itemizedExp;
  const monthlyNetProfit = monthlyGrossProfit - monthlyExpenses;

  const totalSalesAllTime =
    s.seasonalHistory.reduce((sum, m) => sum + m.sales, 0) +
    s.sales
      .filter((tx) => !s.seasonalHistory.some((m) => m.monthKey === tx.monthKey && m.sales > 0))
      .reduce((sum, tx) => sum + tx.totalAmount, 0);

  const totalReceivable = s.credits.reduce((sum, c) => sum + c.balanceDue, 0);

  return {
    shopId: record.shopId,
    shopNameBn: s.shopNameBn,
    shopNameEn: s.shopNameEn,
    businessType: s.businessType,
    address: s.address,
    phone: s.phone,
    ownerName: record.ownerName,
    ownerEmail: record.ownerEmail,
    status: record.status,
    plan: record.plan,
    monthlySubscriptionFee: record.monthlySubscriptionFee,
    billingStatus: record.billingStatus,
    nextBillingDate: record.nextBillingDate,
    createdAt: record.createdAt,
    entitlements: record.entitlements,
    sheetConfig: s.sheetConfig,
    metrics: {
      skuCount,
      outOfStockCount,
      lowStockCount,
      stockValue,
      monthlySales,
      monthlyGrossProfit,
      monthlyExpenses,
      monthlyNetProfit,
      totalSalesAllTime,
      totalReceivable,
      staffCount: s.staff.length,
      salesCount: s.sales.length,
    },
  };
}

function serializeShopWorkbookTabs(state: PosStoreState): Record<string, unknown[][]> {
  const sortedSalesAsc = [...state.sales].sort(
    (a, b) => a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp)
  );
  const resolveCat = (catBn: string) => {
    const found = (state.categories || []).find((c) => c.bn === catBn || c.en === catBn);
    return found ? `${found.bn} (${found.en})` : catBn;
  };

  const salesHistoryRows = [
    [
      'Date',
      'Invoice No',
      'Product Name',
      'Category',
      'Quantity',
      'Payment Method',
      'Discount (৳)',
      'Total Bill (৳)',
      'Customer Name',
      'Due Bill Amount (৳)',
    ],
    ...sortedSalesAsc.map((s) => [
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
    ]),
  ];

  const allCreditHistory = state.credits
    .flatMap((c) =>
      ensureCustomerCreditHistory(c).map((h: CreditHistoryEntry) => ({
        ...h,
        customerName: c.name,
        customerPhone: c.phone,
      }))
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.timestamp.localeCompare(b.timestamp));

  return {
    'Sales History': salesHistoryRows,
    Products_Inventory: [
      ['ID', 'SKU', 'Name', 'Name (BN)', 'Buy Price', 'Sell Price', 'Stock', 'Min Stock', 'Category'],
      ...state.products.map((p) => [
        p.id,
        p.sku,
        p.name,
        p.nameBn,
        p.buyPrice,
        p.sellPrice,
        p.stock,
        p.minStock,
        p.category,
      ]),
    ],
    Credit_Ledger: [
      ['ID', 'Name (BN)', 'Name (EN)', 'Mobile', 'Total Credit', 'Total Paid', 'Balance Due', 'Due Date'],
      ...state.credits.map((c) => [
        c.id,
        c.name,
        c.nameEn,
        c.phone,
        c.totalCreditSales,
        c.totalPaid,
        c.balanceDue,
        c.dueDate,
      ]),
    ],
    Due_Payment_History: [
      ['Date', 'Customer Name', 'Mobile', 'Type', 'Previous Due', 'Added Due', 'Paid Amount', 'Remaining Due'],
      ...allCreditHistory.map((h) => [
        h.date,
        h.customerName,
        h.customerPhone,
        h.type,
        h.previousDue,
        h.creditAdded || '',
        h.paidAmount || '',
        h.balanceAfter,
      ]),
    ],
    Expenses_Income: [
      ['ID', 'Category (BN)', 'Category (EN)', 'Amount', 'Date', 'Month', 'Type', 'Note'],
      ...state.expenses.map((e) => [
        e.id,
        e.categoryBn,
        e.categoryEn,
        e.amount,
        e.date,
        e.monthKey,
        e.type,
        e.note,
      ]),
    ],
  };
}

async function postToAppsScriptBridge(
  bridgeUrl: string,
  payload: Record<string, unknown>
): Promise<any> {
  const res = await fetch(bridgeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

function buildSessionPayload(db: StaticPlatformDatabase, user: StaticUserAccount, token: string) {
  const shopRec = user.shopId ? db.shops[user.shopId] || null : null;
  const session: AuthSessionUser = {
    token,
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    shopId: user.shopId,
    shopNameBn: shopRec?.posState.shopNameBn,
    shopNameEn: shopRec?.posState.shopNameEn,
    permissions:
      user.role === UserRole.SUPER_ADMIN || user.role === UserRole.OWNER
        ? getDefaultPermissionsForRole(UserRole.OWNER)
        : user.permissions || getDefaultPermissionsForRole(user.role),
  };
  return {
    session,
    globalAnnouncement: db.globalAnnouncement || '',
    shopState: shopRec ? shopRec.posState : null,
    shopEntitlements: shopRec ? shopRec.entitlements : null,
  };
}

export async function handleStaticHostApiRequest<T>(
  url: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  const db = await loadStaticDb();
  const method = (init?.method || 'GET').toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const cleanPath = url.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];

  // 1. Public login directory
  if (cleanPath === '/api/auth/public-directory' && method === 'GET') {
    return { globalAnnouncement: db.globalAnnouncement || '' } as T;
  }

  // 2. Email + password login
  if (cleanPath === '/api/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = db.users.find((u) => u.email === email && u.active);
    if (!user) {
      throw new Error('Invalid email or password.');
    }
    const candidateDigest = await computePasswordDigest(password, user.passwordSalt);
    if (candidateDigest !== user.passwordDigest) {
      throw new Error('Invalid email or password.');
    }
    if (user.shopId && db.shops[user.shopId]?.status === 'Suspended') {
      throw new Error('This shop account is currently suspended. Please contact administrator.');
    }
    const nextToken = makeStaticToken(user.id);
    return buildSessionPayload(db, user, nextToken) as T;
  }

  // Authenticated routes below
  const actor = resolveUserFromToken(db, token);
  if (!actor) {
    if (token && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mhs-auth-expired'));
    }
    throw new Error('Session expired. Please sign in again.');
  }

  if (cleanPath === '/api/auth/me' && method === 'GET') {
    return buildSessionPayload(db, actor, token!) as T;
  }

  // Super Admin Overview
  if (cleanPath === '/api/superadmin/overview' && method === 'GET') {
    const shopsList = Object.values(db.shops).map(computeShopSummary);
    const credentialVault: AdminCredentialVaultItem[] = db.users.map((u) => {
      const shopName = u.shopId
        ? db.shops[u.shopId]?.posState.shopNameEn || u.shopId
        : 'Platform Super Admin';
      const perms =
        u.role === UserRole.SUPER_ADMIN || u.role === UserRole.OWNER
          ? getDefaultPermissionsForRole(UserRole.OWNER)
          : u.permissions || getDefaultPermissionsForRole(u.role);
      return {
        userId: u.id,
        name: u.name,
        email: u.email,
        passwordPlain: decodeVaultValue(u.vaultSecretEncoded),
        role: u.role,
        shopId: u.shopId,
        shopName,
        phone: u.phone,
        active: u.active,
        allowedTabs: perms.allowedTabs,
        createdAt: u.createdAt,
      };
    });

    const response: SuperAdminOverviewResponse = {
      superAdminProfile: {
        name: actor.name,
        email: actor.email,
      },
      globalAnnouncement: db.globalAnnouncement,
      planPricing: db.planPricing,
      googleSheetsEngine: db.googleSheetsEngine,
      credentialVault,
      shops: shopsList,
      invoices: db.invoices,
      platformAuditLogs: db.platformAuditLogs,
    };
    return response as T;
  }

  // Super Admin Create Shop
  if (cleanPath === '/api/superadmin/shops' && method === 'POST') {
    const ownerEmail = String(body.ownerEmail || '').trim().toLowerCase();
    if (!ownerEmail || db.users.some((u) => u.email === ownerEmail)) {
      throw new Error('Owner login email is already registered.');
    }
    const shopId = randomId('shop');
    const ownerId = randomId('owner');
    const ownerPassword = String(body.ownerPassword || '123456');
    const customSheetId = extractSpreadsheetId(body.customSheetUrl);

    const freshState = buildFreshShopStore({
      shopId,
      shopNameBn: String(body.shopNameBn || body.shopNameEn || 'নতুন শপ'),
      shopNameEn: String(body.shopNameEn || body.shopNameBn || 'New Shop'),
      businessType: String(body.businessType || 'General Retail'),
      address: String(body.address || ''),
      phone: String(body.phone || ''),
      ownerId,
      ownerName: String(body.ownerName || 'Shop Owner'),
      ownerEmail,
      spreadsheetId: customSheetId || `sheet-${shopId}`,
      spreadsheetUrl: customSheetId
        ? `https://docs.google.com/spreadsheets/d/${customSheetId}/edit`
        : `https://docs.google.com/spreadsheets/d/1h5JWlK3MDgVIne1YwImt631SNq1tT0e3hOntPugJPe4/copy?title=${encodeURIComponent(
            String(body.shopNameBn || body.shopNameEn || 'Shop') + ' — MHS POS'
          )}`,
      provisioningStatus: 'connected',
      receiptFormat: body.receiptFormat === 'a4_invoice' ? 'a4_invoice' : 'pos_thermal',
    });

    const ownerUser = await makeUserRecord({
      id: ownerId,
      name: String(body.ownerName || 'Shop Owner'),
      email: ownerEmail,
      password: ownerPassword,
      role: UserRole.OWNER,
      shopId,
      phone: String(body.phone || ''),
      permissions: getDefaultPermissionsForRole(UserRole.OWNER),
    });

    const plan = (body.plan as ShopSubscriptionPlan) || 'Business';
    const fee = Math.max(0, Number(body.monthlySubscriptionFee ?? db.planPricing[plan] ?? 1000));
    const billingStatus = (body.billingStatus as SubscriptionPaymentStatus) || 'Paid';
    const nextBilling =
      body.nextBillingDate ||
      new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10);

    const newShopRecord: StaticShopRecord = {
      shopId,
      ownerName: ownerUser.name,
      ownerEmail,
      status: 'Active',
      plan,
      monthlySubscriptionFee: fee,
      billingStatus,
      nextBillingDate: nextBilling,
      createdAt: new Date().toISOString(),
      entitlements: {
        enableEcommerce: body.entitlements?.enableEcommerce ?? true,
        enableCreditLedger: body.entitlements?.enableCreditLedger ?? true,
        enableAuditExports: body.entitlements?.enableAuditExports ?? true,
        maxStaffAccounts: Number(body.entitlements?.maxStaffAccounts || 10),
      },
      posState: freshState,
    };

    const monthKey = new Date().toISOString().slice(0, 7);
    const invoice: SubscriptionInvoiceRecord = {
      id: randomId('sub-inv'),
      shopId,
      shopNameBn: freshState.shopNameBn,
      shopNameEn: freshState.shopNameEn,
      ownerEmail,
      plan,
      monthKey,
      amount: fee,
      status: billingStatus,
      dueDate: `${monthKey}-05`,
      paidAt: billingStatus === 'Paid' ? new Date().toISOString() : null,
      paymentMethod: 'Cash',
      receiptNo: `SUB-${Date.now().toString().slice(-6)}`,
      note: 'Initial shop subscription invoice',
    };

    db.users.push(ownerUser);
    db.shops[shopId] = newShopRecord;
    db.invoices.unshift(invoice);
    saveStaticDb(db);

    return {
      shop: computeShopSummary(newShopRecord),
      invoice,
      sheetCreationNote: customSheetId
        ? 'Linked custom Google Sheet.'
        : 'Workspace created locally. Connect Apps Script Bridge to sync live to Google Sheets.',
    } as T;
  }

  // Super Admin Update / Delete / Create-Sheet for Shop
  const superShopMatch = cleanPath.match(/^\/api\/superadmin\/shops\/([^/]+)(\/create-sheet)?$/);
  if (superShopMatch) {
    const shopId = decodeURIComponent(superShopMatch[1]);
    const isCreateSheet = Boolean(superShopMatch[2]);
    const rec = db.shops[shopId];
    if (!rec) throw new Error('Shop not found.');

    if (isCreateSheet && method === 'POST') {
      const bridgeUrl = db.googleSheetsEngine.appsScriptWebAppUrl;
      if (bridgeUrl) {
        const bridgeRes = await postToAppsScriptBridge(bridgeUrl, {
          action: 'CREATE_SHOP_WORKBOOK',
          secret: db.googleSheetsEngine.sharedSecret || '',
          shopName: rec.posState.shopNameEn || rec.posState.shopNameBn,
          workbookTitle: `${rec.posState.shopNameEn || rec.posState.shopNameBn} — MHS POS`,
          tabs: serializeShopWorkbookTabs(rec.posState),
        });
        if (bridgeRes?.ok && bridgeRes.spreadsheetId) {
          rec.posState.sheetConfig = {
            spreadsheetId: bridgeRes.spreadsheetId,
            spreadsheetTitle: bridgeRes.spreadsheetTitle || `${rec.posState.shopNameEn} — MHS POS`,
            spreadsheetUrl: bridgeRes.spreadsheetUrl || '',
            autoSync: true,
            lastSyncedAt: new Date().toISOString(),
            provisioningStatus: 'connected',
          };
          saveStaticDb(db);
          return {
            ok: true,
            sheetConfig: rec.posState.sheetConfig,
            shop: computeShopSummary(rec),
          } as T;
        }
      }
      const fallbackShopTitle = `${rec.posState.shopNameEn || rec.posState.shopNameBn} — MHS POS`;
      rec.posState.sheetConfig = {
        spreadsheetId: `sheet-${rec.shopId}`,
        spreadsheetTitle: fallbackShopTitle,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/1h5JWlK3MDgVIne1YwImt631SNq1tT0e3hOntPugJPe4/copy?title=${encodeURIComponent(fallbackShopTitle)}`,
        autoSync: true,
        lastSyncedAt: new Date().toISOString(),
        provisioningStatus: 'connected',
      };
      saveStaticDb(db);
      return {
        ok: true,
        sheetConfig: rec.posState.sheetConfig,
        shop: computeShopSummary(rec),
      } as T;
    }

    if (method === 'PUT') {
      if (body.shopNameBn) rec.posState.shopNameBn = String(body.shopNameBn);
      if (body.shopNameEn) rec.posState.shopNameEn = String(body.shopNameEn);
      if (body.businessType !== undefined) rec.posState.businessType = String(body.businessType);
      if (body.phone !== undefined) rec.posState.phone = String(body.phone);
      if (body.address !== undefined) rec.posState.address = String(body.address);
      if (body.ownerName) rec.ownerName = String(body.ownerName);
      if (body.status) rec.status = body.status as ShopAccountStatus;
      if (body.plan) rec.plan = body.plan as ShopSubscriptionPlan;
      if (body.monthlySubscriptionFee !== undefined) {
        rec.monthlySubscriptionFee = Math.max(0, Number(body.monthlySubscriptionFee));
      }
      if (body.billingStatus) rec.billingStatus = body.billingStatus as SubscriptionPaymentStatus;
      if (body.nextBillingDate) rec.nextBillingDate = String(body.nextBillingDate);
      if (body.entitlements) {
        rec.entitlements = { ...rec.entitlements, ...body.entitlements };
      }

      const ownerAcc = db.users.find(
        (u) => u.shopId === shopId && u.role === UserRole.OWNER
      );
      if (ownerAcc) {
        if (body.ownerName) ownerAcc.name = String(body.ownerName);
        if (body.ownerEmail) {
          const nextEmail = String(body.ownerEmail).trim().toLowerCase();
          ownerAcc.email = nextEmail;
          rec.ownerEmail = nextEmail;
        }
        if (body.ownerNewPassword && String(body.ownerNewPassword).trim().length >= 4) {
          const plain = String(body.ownerNewPassword).trim();
          ownerAcc.passwordSalt = randomId('salt');
          ownerAcc.passwordDigest = await computePasswordDigest(plain, ownerAcc.passwordSalt);
          ownerAcc.vaultSecretEncoded = encodeVaultValue(plain);
        }
      }
      saveStaticDb(db);
      return { shop: computeShopSummary(rec) } as T;
    }

    if (method === 'DELETE') {
      delete db.shops[shopId];
      db.users = db.users.filter((u) => u.shopId !== shopId);
      db.invoices = db.invoices.filter((inv) => inv.shopId !== shopId);
      saveStaticDb(db);
      return { deleted: true } as T;
    }
  }

  // Super Admin Subscriptions & Settings
  if (cleanPath === '/api/superadmin/subscriptions/pay' && method === 'POST') {
    const inv = db.invoices.find((i) => i.id === body.invoiceId);
    if (!inv) throw new Error('Invoice not found.');
    inv.status = (body.status as SubscriptionPaymentStatus) || 'Paid';
    if (body.amount !== undefined) inv.amount = Math.max(0, Number(body.amount));
    if (body.paymentMethod) inv.paymentMethod = String(body.paymentMethod);
    if (body.note !== undefined) inv.note = String(body.note);
    inv.paidAt = inv.status === 'Paid' ? new Date().toISOString() : null;
    if (db.shops[inv.shopId]) {
      db.shops[inv.shopId].billingStatus = inv.status;
    }
    saveStaticDb(db);
    return { invoice: inv } as T;
  }

  if (cleanPath === '/api/superadmin/subscriptions/generate-month' && method === 'POST') {
    const monthKey = String(body.monthKey || new Date().toISOString().slice(0, 7));
    const created: SubscriptionInvoiceRecord[] = [];
    for (const shop of Object.values(db.shops)) {
      if (db.invoices.some((i) => i.shopId === shop.shopId && i.monthKey === monthKey)) continue;
      const inv: SubscriptionInvoiceRecord = {
        id: randomId('sub-inv'),
        shopId: shop.shopId,
        shopNameBn: shop.posState.shopNameBn,
        shopNameEn: shop.posState.shopNameEn,
        ownerEmail: shop.ownerEmail,
        plan: shop.plan,
        monthKey,
        amount: shop.monthlySubscriptionFee,
        status: 'Pending',
        dueDate: `${monthKey}-05`,
        paidAt: null,
        paymentMethod: 'bKash / Nagad',
        receiptNo: `SUB-${monthKey.replace('-', '')}-${Math.floor(100 + Math.random() * 900)}`,
        note: `Monthly subscription invoice for ${monthKey}`,
      };
      db.invoices.unshift(inv);
      created.push(inv);
    }
    saveStaticDb(db);
    return { createdCount: created.length, invoices: created } as T;
  }

  if (cleanPath === '/api/superadmin/settings' && method === 'PUT') {
    if (body.globalAnnouncement !== undefined) {
      db.globalAnnouncement = String(body.globalAnnouncement);
    }
    if (body.planPricing) {
      db.planPricing = { ...db.planPricing, ...body.planPricing };
    }
    if (body.googleSheetsEngine) {
      db.googleSheetsEngine = { ...db.googleSheetsEngine, ...body.googleSheetsEngine };
    }
    if (body.newSuperAdminPassword && String(body.newSuperAdminPassword).trim().length >= 4) {
      const plain = String(body.newSuperAdminPassword).trim();
      actor.passwordSalt = randomId('salt');
      actor.passwordDigest = await computePasswordDigest(plain, actor.passwordSalt);
      actor.vaultSecretEncoded = encodeVaultValue(plain);
    }
    saveStaticDb(db);
    return { ok: true } as T;
  }

  // Super Admin Master Google Sheet Bridge
  if (cleanPath === '/api/superadmin/master-sheet/connect' && method === 'POST') {
    const bridgeUrl = String(body.appsScriptWebAppUrl || '').trim();
    if (!bridgeUrl) throw new Error('Apps Script Web App URL is required.');
    const masterSheetId = extractSpreadsheetId(body.masterSheetUrlOrId);
    const bridgeRes = await postToAppsScriptBridge(bridgeUrl, {
      action: 'CONNECT_MASTER_SHEET',
      secret: String(body.sharedSecret || ''),
      masterSpreadsheetId: masterSheetId,
      workbookTitle: 'MHS POS — Master Admin & Credentials DB',
      tabs: {
        Admin_Credentials: [
          ['Name', 'Email', 'Role', 'Shop ID', 'Phone', 'Active'],
          ...db.users.map((u) => [u.name, u.email, u.role, u.shopId || 'SUPER_ADMIN', u.phone, u.active ? 'YES' : 'NO']),
        ],
      },
    });
    if (!bridgeRes?.ok) {
      throw new Error(bridgeRes?.error || 'Failed to connect to Google Apps Script Web App.');
    }
    db.googleSheetsEngine = {
      ...db.googleSheetsEngine,
      appsScriptWebAppUrl: bridgeUrl,
      sharedSecret: String(body.sharedSecret || ''),
      masterSpreadsheetId: bridgeRes.spreadsheetId || masterSheetId,
      masterSpreadsheetTitle: bridgeRes.spreadsheetTitle || 'MHS POS Master Sheet',
      masterDirectorySheetUrl: bridgeRes.spreadsheetUrl || '',
      lastConnectedAt: new Date().toISOString(),
      lastMasterSyncedAt: new Date().toISOString(),
    };
    saveStaticDb(db);
    return {
      ok: true,
      googleSheetsEngine: db.googleSheetsEngine,
      syncedUsersCount: db.users.length,
      syncedShopsCount: Object.keys(db.shops).length,
      message: 'Connected Master Google Sheet via Apps Script Bridge!',
    } as T;
  }

  if (cleanPath === '/api/superadmin/master-sheet/sync' && method === 'POST') {
    if (!db.googleSheetsEngine.appsScriptWebAppUrl) {
      throw new Error('Connect Google Apps Script Web App URL first.');
    }
    await postToAppsScriptBridge(db.googleSheetsEngine.appsScriptWebAppUrl, {
      action: 'SYNC_WORKBOOK',
      secret: db.googleSheetsEngine.sharedSecret || '',
      spreadsheetId: db.googleSheetsEngine.masterSpreadsheetId || '',
      tabs: {
        Admin_Credentials: [
          ['Name', 'Email', 'Role', 'Shop ID', 'Phone', 'Active'],
          ...db.users.map((u) => [u.name, u.email, u.role, u.shopId || 'SUPER_ADMIN', u.phone, u.active ? 'YES' : 'NO']),
        ],
      },
    });
    db.googleSheetsEngine.lastMasterSyncedAt = new Date().toISOString();
    saveStaticDb(db);
    return {
      ok: true,
      googleSheetsEngine: db.googleSheetsEngine,
      syncedUsersCount: db.users.length,
      syncedShopsCount: Object.keys(db.shops).length,
    } as T;
  }

  if (cleanPath === '/api/superadmin/master-sheet/pull' && method === 'POST') {
    return {
      ok: true,
      updatedUsersCount: 0,
      addedUsersCount: 0,
      message: 'Local credentials verified.',
    } as T;
  }

  if (cleanPath === '/api/superadmin/master-sheet/update-url' && method === 'POST') {
    const raw = String(body.masterSheetUrl || '').trim();
    if (raw) {
      db.googleSheetsEngine.masterDirectorySheetUrl = raw;
      saveStaticDb(db);
    }
    return {
      ok: true,
      message: 'Master Google Sheet URL updated.',
      googleSheetsEngine: db.googleSheetsEngine,
    } as T;
  }

  if (cleanPath.startsWith('/api/superadmin/shops/') && cleanPath.endsWith('/update-sheet-url') && method === 'POST') {
    const parts = cleanPath.split('/');
    const shopId = parts[4];
    const raw = String(body.sheetUrl || '').trim();
    if (shopId && db.shops[shopId]) {
      db.shops[shopId].posState.sheetConfig = {
        spreadsheetId: raw,
        spreadsheetUrl: raw,
        spreadsheetTitle: `${db.shops[shopId].posState.shopNameEn || shopId} Sheet`,
        autoSync: true,
        status: raw ? 'connected' : 'disconnected',
        provisioningStatus: raw ? 'connected' : 'unlinked',
        lastSyncedAt: new Date().toISOString(),
      };
      saveStaticDb(db);
    }
    return {
      ok: true,
      message: 'Shop Google Sheet URL updated.',
      sheetConfig: db.shops[shopId]?.posState.sheetConfig,
    } as T;
  }

  if (cleanPath === '/api/superadmin/live-sheet-data' && method === 'GET') {
    const masterTabs: Record<string, (string | number)[][]> = {
      Shops_Directory: [
        ['Shop ID', 'Name (BN)', 'Name (EN)', 'Owner', 'Email', 'Phone', 'Plan', 'Monthly Fee', 'Status', 'Sheet URL'],
        ...Object.values(db.shops).map((s) => [
          s.shopId,
          s.posState.shopNameBn,
          s.posState.shopNameEn,
          s.ownerName,
          s.ownerEmail,
          s.posState.phone || '',
          s.plan,
          s.monthlySubscriptionFee,
          s.status,
          s.posState.sheetConfig?.spreadsheetUrl || '',
        ]),
      ],
      Invoices: [
        ['Invoice ID', 'Shop ID', 'Shop Name', 'Month', 'Amount', 'Status', 'Due Date', 'Paid At'],
        ...db.invoices.map((inv) => [
          inv.id,
          inv.shopId,
          inv.shopNameBn,
          inv.monthKey,
          inv.amount,
          inv.status,
          inv.dueDate,
          inv.paidAt || '',
        ]),
      ],
    };
    return {
      ok: true,
      masterTabs,
      shopWorkbooks: {},
      lastSyncedAt: new Date().toISOString(),
      masterSheetUrl: db.googleSheetsEngine.masterDirectorySheetUrl,
    } as T;
  }

  // Shop Subscription Invoices
  if (cleanPath === '/api/shop/subscription-invoices' && method === 'GET') {
    const shopId = actor.shopId;
    const shopInvoices = db.invoices.filter((i) => i.shopId === shopId);
    const shop = shopId ? db.shops[shopId] : undefined;
    return {
      invoices: shopInvoices,
      shop: shop
        ? {
            shopId: shop.shopId,
            shopNameBn: shop.posState.shopNameBn,
            shopNameEn: shop.posState.shopNameEn,
            businessType: shop.posState.businessType,
            address: shop.posState.address,
            phone: shop.posState.phone,
            ownerName: shop.ownerName,
            ownerEmail: shop.ownerEmail,
            plan: shop.plan,
            monthlySubscriptionFee: shop.monthlySubscriptionFee,
            billingStatus: shop.billingStatus,
            nextBillingDate: shop.nextBillingDate,
          }
        : null,
    } as T;
  }

  // Shop POS State GET / PUT
  const shopStateMatch = cleanPath.match(/^\/api\/shops\/([^/]+)\/state$/);
  if (shopStateMatch) {
    const shopId = decodeURIComponent(shopStateMatch[1]);
    const rec = db.shops[shopId];
    if (!rec) throw new Error('Shop workspace not found.');

    if (method === 'GET') {
      return {
        posState: rec.posState,
        entitlements: rec.entitlements,
        subscription: {
          plan: rec.plan,
          monthlySubscriptionFee: rec.monthlySubscriptionFee,
          billingStatus: rec.billingStatus,
          nextBillingDate: rec.nextBillingDate,
          status: rec.status,
        },
      } as T;
    }

    if (method === 'PUT') {
      const nextPosState = body.posState as PosStoreState;
      if (nextPosState) {
        rec.posState = nextPosState;
        const nowIso = new Date().toISOString();
        if (
          db.googleSheetsEngine.appsScriptWebAppUrl &&
          rec.posState.sheetConfig.spreadsheetId &&
          rec.posState.sheetConfig.autoSync
        ) {
          postToAppsScriptBridge(db.googleSheetsEngine.appsScriptWebAppUrl, {
            action: 'SYNC_WORKBOOK',
            secret: db.googleSheetsEngine.sharedSecret || '',
            spreadsheetId: rec.posState.sheetConfig.spreadsheetId,
            tabs: serializeShopWorkbookTabs(rec.posState),
          }).catch(() => {});
          rec.posState.sheetConfig.lastSyncedAt = nowIso;
        }
        saveStaticDb(db);
        return { ok: true, lastSavedAt: nowIso } as T;
      }
    }
  }

  // Shop Staff Accounts CRUD
  const shopStaffCreateMatch = cleanPath.match(/^\/api\/shops\/([^/]+)\/staff$/);
  if (shopStaffCreateMatch && method === 'POST') {
    const shopId = decodeURIComponent(shopStaffCreateMatch[1]);
    const rec = db.shops[shopId];
    if (!rec) throw new Error('Shop not found.');
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || db.users.some((u) => u.email === email)) {
      throw new Error('This staff email is already in use.');
    }
    const staffId = randomId('staff');
    const role = (body.role as UserRole) || UserRole.CASHIER;
    const permissions =
      (body.permissions as StaffDashboardPermissions) || getDefaultPermissionsForRole(role);

    const newUser = await makeUserRecord({
      id: staffId,
      name: String(body.name || 'Staff'),
      email,
      password: String(body.password || '123456'),
      role,
      shopId,
      phone: String(body.phone || ''),
      permissions,
    });
    const staffMember: StaffMember = {
      id: staffId,
      name: newUser.name,
      email: newUser.email,
      role,
      phone: newUser.phone,
      active: true,
      addedAt: newUser.createdAt.slice(0, 10),
      permissions,
    };
    db.users.push(newUser);
    rec.posState.staff = [...rec.posState.staff, staffMember];
    saveStaticDb(db);
    return { staff: staffMember } as T;
  }

  const shopStaffItemMatch = cleanPath.match(/^\/api\/shops\/([^/]+)\/staff\/([^/]+)$/);
  if (shopStaffItemMatch) {
    const shopId = decodeURIComponent(shopStaffItemMatch[1]);
    const staffId = decodeURIComponent(shopStaffItemMatch[2]);
    const rec = db.shops[shopId];
    if (!rec) throw new Error('Shop not found.');

    if (method === 'PUT') {
      const userAcc = db.users.find((u) => u.id === staffId && u.shopId === shopId);
      if (userAcc) {
        if (body.name) userAcc.name = String(body.name);
        if (body.phone !== undefined) userAcc.phone = String(body.phone);
        if (body.role) userAcc.role = body.role as UserRole;
        if (body.permissions) userAcc.permissions = body.permissions as StaffDashboardPermissions;
        if (body.newPassword && String(body.newPassword).trim().length >= 4) {
          const plain = String(body.newPassword).trim();
          userAcc.passwordSalt = randomId('salt');
          userAcc.passwordDigest = await computePasswordDigest(plain, userAcc.passwordSalt);
          userAcc.vaultSecretEncoded = encodeVaultValue(plain);
        }
      }
      rec.posState.staff = rec.posState.staff.map((m) =>
        m.id === staffId
          ? {
              ...m,
              name: body.name ? String(body.name) : m.name,
              phone: body.phone !== undefined ? String(body.phone) : m.phone,
              role: (body.role as UserRole) || m.role,
              permissions: (body.permissions as StaffDashboardPermissions) || m.permissions,
            }
          : m
      );
      saveStaticDb(db);
      return { staff: rec.posState.staff } as T;
    }

    if (method === 'DELETE') {
      db.users = db.users.filter((u) => !(u.id === staffId && u.shopId === shopId));
      rec.posState.staff = rec.posState.staff.filter((m) => m.id !== staffId);
      saveStaticDb(db);
      return { deleted: true } as T;
    }
  }

  // Shop Google Sheets Direct Bridge
  if (cleanPath === '/api/sheets/connect-shop' && method === 'POST') {
    const shopId = String(body.shopId || '');
    const rec = db.shops[shopId];
    if (!rec) throw new Error('Shop not found.');
    const bridgeUrl = String(
      body.appsScriptWebAppUrl || db.googleSheetsEngine.appsScriptWebAppUrl || ''
    ).trim();
    if (bridgeUrl) {
      db.googleSheetsEngine.appsScriptWebAppUrl = bridgeUrl;
    }
    const sheetId = extractSpreadsheetId(body.sheetUrlOrId);
    const nextConfig: SheetConnectionConfig = {
      spreadsheetId: sheetId || rec.posState.sheetConfig.spreadsheetId || `local-${shopId}`,
      spreadsheetTitle: `${rec.posState.shopNameEn} — MHS POS`,
      spreadsheetUrl: sheetId
        ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
        : rec.posState.sheetConfig.spreadsheetUrl,
      autoSync: true,
      lastSyncedAt: new Date().toISOString(),
      provisioningStatus: bridgeUrl ? 'connected' : 'pending_bridge',
    };
    rec.posState.sheetConfig = nextConfig;
    saveStaticDb(db);
    return { ok: true, sheetConfig: nextConfig } as T;
  }

  if (cleanPath === '/api/sheets/sync-shop' && method === 'POST') {
    const shopId = String(body.shopId || '');
    const rec = db.shops[shopId];
    if (!rec) throw new Error('Shop not found.');
    const bridgeUrl = db.googleSheetsEngine.appsScriptWebAppUrl;
    const nowIso = new Date().toISOString();
    if (bridgeUrl && rec.posState.sheetConfig.spreadsheetId) {
      await postToAppsScriptBridge(bridgeUrl, {
        action: 'SYNC_WORKBOOK',
        secret: db.googleSheetsEngine.sharedSecret || '',
        spreadsheetId: rec.posState.sheetConfig.spreadsheetId,
        tabs: serializeShopWorkbookTabs(rec.posState),
      });
    }
    rec.posState.sheetConfig.lastSyncedAt = nowIso;
    saveStaticDb(db);
    return {
      ok: true,
      mode: bridgeUrl ? 'apps_script_bridge' : 'browser_local_snapshot',
      sheetConfig: rec.posState.sheetConfig,
    } as T;
  }

  if (cleanPath === '/api/sheets/pull-shop' && method === 'POST') {
    const shopId = String(body.shopId || '');
    const rec = db.shops[shopId];
    if (!rec) throw new Error('Shop not found.');
    return { ok: true, posState: rec.posState } as T;
  }

  throw new Error(`Unsupported static endpoint: ${cleanPath}`);
}
