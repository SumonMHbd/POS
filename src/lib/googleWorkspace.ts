import type {
  AuthSessionUser,
  PlatformGoogleSheetsEngineConfig,
  PosStoreState,
  SheetConnectionConfig,
  ShopFeatureEntitlements,
  ShopReceiptPaperFormat,
  ShopSubscriptionPlan,
  ShopTenantSummary,
  StaffDashboardPermissions,
  StaffMember,
  SubscriptionInvoiceRecord,
  SuperAdminOverviewResponse,
  UserRole,
} from '../types/pos';
import { handleStaticHostApiRequest } from './staticHostFallback';

// Ready-to-deploy 100% Free Google Apps Script Bridge (Zero Sign-in Button, Zero Third-Party Cost!)
// Stores all Super Admin, Shop Owner & Staff Login/Password records in your Master Google Sheet
// AND automatically creates a dedicated Google Sheet named after every new Shop added by Super Admin!
export const GOOGLE_APPS_SCRIPT_BRIDGE_CODE = `// MHS POS — Master Admin Credentials & Multi-Shop Google Sheets Engine
// HOW TO DEPLOY (Takes 60 Seconds — 100% Free):
// 1. Open your Google Sheet -> Click "Extensions" -> "Apps Script"
// 2. Delete existing code, paste ALL of this code, and press Ctrl+S (Save)
// 3. Click "Deploy" (top right) -> "New deployment" -> Select type: "Web app"
// 4. Set Execute as: "Me" | Who has access: "Anyone" -> Click "Deploy" & Authorize
// 5. Copy the "Web app URL" and paste it inside MHS POS Super Admin -> Google Sheets DB!

function doGet() {
  return jsonOut_({
    ok: true,
    service: 'MHS POS Google Sheets Cloud Engine is LIVE!',
    instruction: 'Copy this Web App URL and paste it in MHS POS -> Super Admin -> Google Sheets DB.'
  });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    var EXPECTED_SECRET = ''; // Optional: set a shared secret here if configured in Super Admin
    if (EXPECTED_SECRET && String(payload.secret || '') !== EXPECTED_SECRET) {
      return jsonOut_({ ok: false, error: 'Unauthorized bridge secret.' });
    }
    var action = payload.action;

    // 1. Connect Master Google Sheet & Store All Admin / Shop Passwords + Subscriptions
    if (action === 'CONNECT_MASTER_SHEET') {
      var masterSs = null;
      if (payload.masterSpreadsheetId) {
        masterSs = SpreadsheetApp.openById(payload.masterSpreadsheetId);
      } else {
        try {
          masterSs = SpreadsheetApp.getActiveSpreadsheet();
        } catch (errActive) {
          masterSs = null;
        }
        if (!masterSs) {
          masterSs = SpreadsheetApp.create(payload.workbookTitle || 'MHS POS — Master Admin & Credentials DB');
        }
      }
      writeAllTabs_(masterSs, payload.tabs || {});
      cleanupDefaultSheet_(masterSs);
      return jsonOut_({
        ok: true,
        spreadsheetId: masterSs.getId(),
        spreadsheetTitle: masterSs.getName(),
        spreadsheetUrl: masterSs.getUrl()
      });
    }

    // 2. Auto-Create a Dedicated Google Sheet Named After a New Shop + Update Master Sheet
    if (action === 'CREATE_SHOP_WORKBOOK') {
      var title = payload.workbookTitle || (payload.shopName + ' — MHS POS');
      var shopSs = SpreadsheetApp.create(title);
      writeAllTabs_(shopSs, payload.tabs || {});
      cleanupDefaultSheet_(shopSs);

      if (payload.masterSpreadsheetId && payload.masterTabs) {
        try {
          var mSs = SpreadsheetApp.openById(payload.masterSpreadsheetId);
          writeAllTabs_(mSs, payload.masterTabs);
        } catch (ignoreMasterErr) {}
      }

      return jsonOut_({
        ok: true,
        spreadsheetId: shopSs.getId(),
        spreadsheetTitle: shopSs.getName(),
        spreadsheetUrl: shopSs.getUrl()
      });
    }

    // 3. Sync Any Workbook (Master Admin Credentials Sheet OR Shop POS Sheet)
    if (action === 'SYNC_WORKBOOK') {
      var ssSync = payload.spreadsheetId
        ? SpreadsheetApp.openById(payload.spreadsheetId)
        : SpreadsheetApp.getActiveSpreadsheet();
      if (!ssSync) {
        return jsonOut_({ ok: false, error: 'Spreadsheet not found for SYNC_WORKBOOK.' });
      }
      writeAllTabs_(ssSync, payload.tabs || {});
      cleanupDefaultSheet_(ssSync);
      return jsonOut_({
        ok: true,
        spreadsheetId: ssSync.getId(),
        spreadsheetTitle: ssSync.getName(),
        spreadsheetUrl: ssSync.getUrl()
      });
    }

    // 4. Pull / Read Tabs Back from Master Sheet or Shop Sheet
    if (action === 'PULL_WORKBOOK') {
      var ssPull = payload.spreadsheetId
        ? SpreadsheetApp.openById(payload.spreadsheetId)
        : SpreadsheetApp.getActiveSpreadsheet();
      if (!ssPull) {
        return jsonOut_({ ok: false, error: 'Spreadsheet not found for PULL_WORKBOOK.' });
      }
      var outTabs = {};
      ssPull.getSheets().forEach(function(sh) {
        outTabs[sh.getName()] = sh.getDataRange().getDisplayValues();
      });
      return jsonOut_({
        ok: true,
        spreadsheetId: ssPull.getId(),
        spreadsheetTitle: ssPull.getName(),
        spreadsheetUrl: ssPull.getUrl(),
        tabs: outTabs
      });
    }

    return jsonOut_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function writeAllTabs_(ss, tabsObj) {
  Object.keys(tabsObj).forEach(function(tabName) {
    var rows = tabsObj[tabName];
    if (!rows || !rows.length) return;
    var maxCols = 0;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].length > maxCols) maxCols = rows[i].length;
    }
    if (maxCols === 0) return;
    var normalized = rows.map(function(r) {
      var copy = r.slice();
      while (copy.length < maxCols) copy.push('');
      return copy;
    });
    var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    sheet.clearContents();
    sheet.getRange(1, 1, normalized.length, maxCols).setValues(normalized);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, maxCols)
      .setBackground('#0f172a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
  });
}

function cleanupDefaultSheet_(ss) {
  var defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const SESSION_STORAGE_KEY = 'mhs_pos_active_session_v2';

export function loadSavedAuthSession(): AuthSessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSessionUser;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSessionUser | null): void {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage errors
  }
}

async function apiFetch<T>(url: string, token: string | null, init?: RequestInit): Promise<T> {
  const customApiBase = ((import.meta as any).env?.VITE_API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  const isStaticGithubPages =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.github.io') &&
    !customApiBase;

  if (isStaticGithubPages || (token && token.startsWith('static.') && !customApiBase)) {
    return handleStaticHostApiRequest<T>(url, token, init);
  }

  const resolvedUrl = customApiBase && url.startsWith('/') ? `${customApiBase}${url}` : url;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res: Response;
  try {
    res = await fetch(resolvedUrl, {
      ...init,
      headers: {
        ...headers,
        ...((init?.headers as Record<string, string>) || {}),
      },
    });
  } catch (err) {
    const onGithubPages =
      typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io');
    if ((!customApiBase || onGithubPages) && url.startsWith('/api/')) {
      return handleStaticHostApiRequest<T>(url, token, init);
    }
    throw err;
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');

  // If hosted on a static file server (GitHub Pages, Netlify, Cloudflare Pages, etc.)
  // where /api/* returns an HTML 404/405 fallback instead of JSON, seamlessly use static mode
  if (!isJson && (res.status === 404 || res.status === 405 || res.ok) && url.startsWith('/api/')) {
    return handleStaticHostApiRequest<T>(url, token, init);
  }

  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    if (res.status === 401 && token && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mhs-auth-expired'));
    }
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function fetchPublicLoginDirectory() {
  return apiFetch<{
    globalAnnouncement: string;
  }>('/api/auth/public-directory', null);
}

export async function loginWithEmailPassword(email: string, password: string) {
  return apiFetch<{
    session: AuthSessionUser;
    globalAnnouncement: string;
    shopState: PosStoreState | null;
    shopEntitlements: ShopFeatureEntitlements | null;
    shopPlan?: ShopSubscriptionPlan | null;
  }>('/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchCurrentSession(token: string) {
  return apiFetch<{
    session: AuthSessionUser;
    globalAnnouncement: string;
    shopState: PosStoreState | null;
    shopEntitlements: ShopFeatureEntitlements | null;
    shopPlan?: ShopSubscriptionPlan | null;
  }>('/api/auth/me', token);
}

// Super Admin APIs
export async function fetchSuperAdminOverview(token: string) {
  return apiFetch<SuperAdminOverviewResponse>('/api/superadmin/overview', token);
}

export async function connectMasterAdminGoogleSheet(
  token: string,
  payload: {
    appsScriptWebAppUrl: string;
    masterSheetUrlOrId?: string;
    sharedSecret?: string;
  }
) {
  return apiFetch<{
    ok: boolean;
    googleSheetsEngine: PlatformGoogleSheetsEngineConfig;
    syncedUsersCount: number;
    syncedShopsCount: number;
    message: string;
  }>('/api/superadmin/master-sheet/connect', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function syncMasterAdminGoogleSheet(token: string) {
  return apiFetch<{
    ok: boolean;
    googleSheetsEngine: PlatformGoogleSheetsEngineConfig;
    syncedUsersCount: number;
    syncedShopsCount: number;
  }>('/api/superadmin/master-sheet/sync', token, {
    method: 'POST',
  });
}

export async function pullCredentialsFromMasterGoogleSheet(token: string) {
  return apiFetch<{
    ok: boolean;
    updatedUsersCount: number;
    addedUsersCount: number;
    message: string;
  }>('/api/superadmin/master-sheet/pull', token, {
    method: 'POST',
  });
}

export async function createNewTenantShop(
  token: string,
  payload: {
    shopNameBn: string;
    shopNameEn: string;
    businessType: string;
    address: string;
    phone: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
    plan: string;
    monthlySubscriptionFee: number;
    billingStatus: string;
    nextBillingDate?: string;
    autoCreateGoogleSheet: boolean;
    customSheetUrl?: string;
    receiptFormat?: ShopReceiptPaperFormat;
    entitlements?: Partial<ShopFeatureEntitlements>;
  }
) {
  return apiFetch<{
    shop: ShopTenantSummary;
    invoice: SubscriptionInvoiceRecord;
    sheetCreationNote: string;
  }>('/api/superadmin/shops', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateTenantShop(
  token: string,
  shopId: string,
  payload: Record<string, unknown>
) {
  return apiFetch<{ shop: ShopTenantSummary }>(`/api/superadmin/shops/${encodeURIComponent(shopId)}`, token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteTenantShop(token: string, shopId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/superadmin/shops/${encodeURIComponent(shopId)}`, token, {
    method: 'DELETE',
  });
}

export async function createGoogleSheetForShopAdmin(token: string, shopId: string) {
  return apiFetch<{
    ok: boolean;
    sheetConfig: SheetConnectionConfig;
    shop: ShopTenantSummary;
  }>(`/api/superadmin/shops/${encodeURIComponent(shopId)}/create-sheet`, token, {
    method: 'POST',
  });
}

export async function recordSubscriptionPayment(
  token: string,
  payload: {
    invoiceId: string;
    status: string;
    paymentMethod?: string;
    note?: string;
    amount?: number;
    dueDate?: string;
    receiptNo?: string;
    plan?: string;
  }
) {
  return apiFetch<{ invoice: SubscriptionInvoiceRecord }>('/api/superadmin/subscriptions/pay', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateMonthlyInvoices(token: string, monthKey: string) {
  return apiFetch<{ createdCount: number; invoices: SubscriptionInvoiceRecord[] }>(
    '/api/superadmin/subscriptions/generate-month',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ monthKey }),
    }
  );
}

export async function updateSuperAdminSettings(token: string, payload: Record<string, unknown>) {
  return apiFetch<{ ok: boolean }>('/api/superadmin/settings', token, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Shop POS State & Staff APIs
export async function fetchShopPosState(token: string, shopId: string) {
  return apiFetch<{
    posState: PosStoreState;
    entitlements: ShopFeatureEntitlements;
    subscription: {
      plan: string;
      monthlySubscriptionFee: number;
      billingStatus: string;
      nextBillingDate: string;
      status: string;
    };
  }>(`/api/shops/${encodeURIComponent(shopId)}/state`, token);
}

export async function saveShopPosStateToServer(token: string, shopId: string, posState: PosStoreState) {
  return apiFetch<{ ok: boolean; lastSavedAt: string }>(
    `/api/shops/${encodeURIComponent(shopId)}/state`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({ posState }),
    }
  );
}

export async function createShopStaffAccount(
  token: string,
  shopId: string,
  payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
    permissions: StaffDashboardPermissions;
  }
) {
  return apiFetch<{ staff: StaffMember }>(`/api/shops/${encodeURIComponent(shopId)}/staff`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateShopStaffAccount(
  token: string,
  shopId: string,
  staffId: string,
  payload: Record<string, unknown>
) {
  return apiFetch<{ staff: StaffMember[] }>(
    `/api/shops/${encodeURIComponent(shopId)}/staff/${encodeURIComponent(staffId)}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteShopStaffAccount(token: string, shopId: string, staffId: string) {
  return apiFetch<{ deleted: boolean }>(
    `/api/shops/${encodeURIComponent(shopId)}/staff/${encodeURIComponent(staffId)}`,
    token,
    {
      method: 'DELETE',
    }
  );
}

// Direct Google Sheets Connection Hub (Zero Google Sign-In Button!)
export async function connectShopGoogleSheet(
  token: string,
  payload: {
    shopId: string;
    sheetUrlOrId?: string;
    appsScriptWebAppUrl?: string;
    createNewWithShopName?: boolean;
  }
) {
  return apiFetch<{ ok: boolean; sheetConfig: SheetConnectionConfig }>('/api/sheets/connect-shop', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function triggerShopSheetSync(token: string, shopId: string) {
  return apiFetch<{ ok: boolean; mode: string; sheetConfig: SheetConnectionConfig; notice?: string }>(
    '/api/sheets/sync-shop',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ shopId }),
    }
  );
}

export async function pullShopSheetData(token: string, shopId: string) {
  return apiFetch<{ ok: boolean; posState: PosStoreState }>('/api/sheets/pull-shop', token, {
    method: 'POST',
    body: JSON.stringify({ shopId }),
  });
}
