import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  ClipboardList,
  Globe,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  UserRole,
  type AuditLogEntry,
  type AuthSessionUser,
  type CreditHistoryEntry,
  type CustomerCredit,
  type EcommerceOrder,
  type ExpenseEntry,
  type LanguageCode,
  type PosStoreState,
  type Product,
  type SaleTransaction,
  type ShopCategoryItem,
  type ShopFeatureEntitlements,
  type StaffDashboardPermissions,
  type StaffMember,
  type WorkspaceTab,
} from './types/pos';
import {
  buildDefaultPosStore,
  ensureCustomerCreditHistory,
  getDefaultPermissionsForRole,
  parseUploadedSummaryCsv,
} from './lib/storeDefaults';
import { formatBDT, UI_TEXT } from './i18n/translations';
import {
  clearCachedStoreSnapshots,
  clearOfflineQueue,
  enqueueOfflineMutation,
  getPendingMutations,
  loadStoreSnapshot,
  saveStoreSnapshot,
} from './lib/offlineDb';
import {
  createShopStaffAccount,
  deleteShopStaffAccount,
  fetchCurrentSession,
  fetchShopPosState,
  loadSavedAuthSession,
  saveAuthSession,
  saveShopPosStateToServer,
  triggerShopSheetSync,
  updateShopStaffAccount,
} from './lib/googleWorkspace';
import { useOnlineStatus } from './hooks/usePWAInstall';
import { useRealtimeSync, type IncomingRealtimeDelta } from './hooks/useRealtimeSync';
import { ConfirmActionModal, type ConfirmDialogState } from './components/ConfirmActionModal';
import { OfflineStatusBanner, PWAInstallButton } from './components/PWAInstallButton';
import { PrintableDocumentModal } from './components/PrintableDocumentModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { PosTerminal } from './components/PosTerminal';
import { SalesHistoryView } from './components/SalesHistoryView';
import { InventoryManager } from './components/InventoryManager';
import { CreditAndExpensesView } from './components/CreditAndExpensesView';
import { EcommerceSyncView } from './components/EcommerceSyncView';
import { ReportsAndAdminView } from './components/ReportsAndAdminView';
import { AuthLoginScreen } from './components/AuthLoginScreen';
import { SuperAdminPortal } from './components/SuperAdminPortal';
import {
  DashboardWorkspaceSkeleton,
  WorkspaceShellSkeleton,
} from './components/SkeletonScreens';

export default function App() {
  const [lang, setLang] = useState<LanguageCode>('bn');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [state, setState] = useState<PosStoreState>(() => buildDefaultPosStore());

  // Multi-Tenant SaaS Auth & Inspection State
  const [authSession, setAuthSession] = useState<AuthSessionUser | null>(() =>
    loadSavedAuthSession()
  );
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(() =>
    Boolean(loadSavedAuthSession())
  );
  const [isOpeningShopPos, setIsOpeningShopPos] = useState<boolean>(false);
  const [isHydratingWorkspace, setIsHydratingWorkspace] = useState<boolean>(false);
  const [inspectingShopId, setInspectingShopId] = useState<string | null>(null);
  const [shopEntitlements, setShopEntitlements] = useState<ShopFeatureEntitlements | null>(null);
  const [globalAnnouncement, setGlobalAnnouncement] = useState<string>('');

  // Modals & Notifications
  const [printMode, setPrintMode] = useState<'receipt' | 'audit' | null>(null);
  const [lastReceiptSale, setLastReceiptSale] = useState<SaleTransaction | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [isConfirmBusy, setIsConfirmBusy] = useState<boolean>(false);
  const [toast, setToast] = useState<{ msg: string; isError?: boolean } | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const isOnline = useOnlineStatus();
  const t = UI_TEXT[lang];

  const notify = useCallback((msg: string, isError = false) => {
    setToast({ msg, isError });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Keep <html> .dark class & lang attribute synced
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [mobileMenuOpen]);

  // Verify saved session on mount & hydrate shop POS state from server or IndexedDB
  useEffect(() => {
    const saved = loadSavedAuthSession();
    if (!saved) {
      setIsCheckingSession(false);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        if (navigator.onLine) {
          const res = await fetchCurrentSession(saved.token);
          if (!mounted) return;
          const refreshedSession: AuthSessionUser = {
            ...res.session,
            token: saved.token,
          };
          saveAuthSession(refreshedSession);
          setAuthSession(refreshedSession);
          setGlobalAnnouncement(res.globalAnnouncement || '');
          setShopEntitlements(res.shopEntitlements || null);

          if (res.shopState) {
            setState(res.shopState);
            await saveStoreSnapshot(res.shopState);
            const pending = await getPendingMutations(res.shopState.shopId);
            if (mounted) setPendingOfflineCount(pending.length);
            const allowed = res.session.permissions?.allowedTabs;
            if (allowed && allowed.length > 0) {
              setActiveTab(allowed[0]);
            }
          }
        } else if (saved.shopId) {
          // Offline mode fallback from IndexedDB
          const snapshot = await loadStoreSnapshot(saved.shopId);
          const pending = await getPendingMutations(saved.shopId);
          if (mounted) {
            if (snapshot) setState(snapshot);
            setPendingOfflineCount(pending.length);
          }
        }
      } catch {
        if (mounted && navigator.onLine) {
          saveAuthSession(null);
          setAuthSession(null);
        } else if (mounted && saved.shopId) {
          const snapshot = await loadStoreSnapshot(saved.shopId);
          const pending = await getPendingMutations(saved.shopId);
          if (snapshot) setState(snapshot);
          setPendingOfflineCount(pending.length);
        }
      } finally {
        if (mounted) setIsCheckingSession(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = useCallback(() => {
    saveAuthSession(null);
    setAuthSession(null);
    setInspectingShopId(null);
    setShopEntitlements(null);
    void clearCachedStoreSnapshots();
    notify(lang === 'bn' ? 'সফলভাবে লগ আউট সম্পন্ন হয়েছে।' : 'Logged out securely.');
  }, [lang, notify]);

  // Automatically sign out if any server API returns 401 (expired token or changed password)
  useEffect(() => {
    const onExpired = () => {
      saveAuthSession(null);
      setAuthSession(null);
      setInspectingShopId(null);
      setShopEntitlements(null);
      void clearCachedStoreSnapshots();
      notify(
        lang === 'bn'
          ? 'আপনার সেশন মেয়াদোত্তীর্ণ হয়েছে। অনুগ্রহ করে আবার লগইন করুন।'
          : 'Your session expired or credentials were updated. Please sign in again.',
        true
      );
    };
    window.addEventListener('mhs-auth-expired', onExpired);
    return () => window.removeEventListener('mhs-auth-expired', onExpired);
  }, [lang, notify]);

  const handleAuthenticated = useCallback(
    async (payload: {
      session: AuthSessionUser;
      globalAnnouncement: string;
      shopState: PosStoreState | null;
      shopEntitlements: ShopFeatureEntitlements | null;
    }) => {
      saveAuthSession(payload.session);
      setAuthSession(payload.session);
      setInspectingShopId(null);
      setGlobalAnnouncement(payload.globalAnnouncement || '');
      setShopEntitlements(payload.shopEntitlements || null);

      if (payload.shopState) {
        setState(payload.shopState);
        await saveStoreSnapshot(payload.shopState);
        const pending = await getPendingMutations(payload.shopState.shopId);
        setPendingOfflineCount(pending.length);

        const allowed = payload.session.permissions?.allowedTabs;
        if (allowed && allowed.length > 0) {
          setActiveTab(allowed[0]);
        } else {
          setActiveTab('dashboard');
        }
      }

      notify(
        lang === 'bn'
          ? `স্বাগতম, ${payload.session.name}!`
          : `Welcome back, ${payload.session.name}!`
      );
    },
    [lang, notify]
  );

  // Super Admin inspecting a tenant shop's live POS dashboard
  const handleInspectShopPos = useCallback(
    async (shopId: string) => {
      if (!authSession) return;
      setIsOpeningShopPos(true);
      try {
        const res = await fetchShopPosState(authSession.token, shopId);
        setState(res.posState);
        await saveStoreSnapshot(res.posState);
        setShopEntitlements(res.entitlements);
        const pending = await getPendingMutations(shopId);
        setPendingOfflineCount(pending.length);
        setInspectingShopId(shopId);
        setActiveTab('dashboard');
        notify(
          lang === 'bn'
            ? `"${res.posState.shopNameBn}" শপের লাইভ POS ওপেন করা হয়েছে।`
            : `Opened live POS workspace for "${res.posState.shopNameEn}".`
        );
      } catch (err: unknown) {
        notify(err instanceof Error ? err.message : 'Failed to open shop POS', true);
      } finally {
        setIsOpeningShopPos(false);
      }
    },
    [authSession, lang, notify]
  );

  // Determine effective role & permissions inside a Shop POS workspace
  const isSuperAdminInspecting =
    authSession?.role === UserRole.SUPER_ADMIN && Boolean(inspectingShopId);

  const effectiveRole: UserRole = useMemo(() => {
    if (!authSession) return UserRole.CASHIER;
    if (authSession.role === UserRole.SUPER_ADMIN) return UserRole.OWNER;
    return authSession.role;
  }, [authSession]);

  const effectivePermissions: StaffDashboardPermissions = useMemo(() => {
    if (!authSession) return getDefaultPermissionsForRole(UserRole.CASHIER);
    if (
      authSession.role === UserRole.SUPER_ADMIN ||
      authSession.role === UserRole.OWNER
    ) {
      return getDefaultPermissionsForRole(UserRole.OWNER);
    }
    return authSession.permissions || getDefaultPermissionsForRole(authSession.role);
  }, [authSession]);

  const actorName = authSession?.name || `Staff (${effectiveRole})`;
  const actorEmail = authSession?.email || 'staff@mhs-pos.app';

  const appendAuditEntry = useCallback(
    (
      actionType: AuditLogEntry['actionType'],
      entityLabel: string,
      details: string
    ): AuditLogEntry => ({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      actorName,
      actorEmail,
      actorRole: authSession?.role || effectiveRole,
      actionType,
      entityLabel,
      details,
    }),
    [actorName, actorEmail, authSession?.role, effectiveRole]
  );

  // Handle incoming real-time WebSocket mutations idempotently
  const handleRemoteDelta = useCallback((delta: IncomingRealtimeDelta) => {
    setState((prev) => {
      if (delta.type === 'sale:created' && delta.data?.sale) {
        const incomingSale = delta.data.sale as SaleTransaction;
        if (prev.sales.some((s) => s.id === incomingSale.id)) return prev;
        const updatedProducts = Array.isArray(delta.data.products)
          ? (delta.data.products as Product[])
          : prev.products;
        return {
          ...prev,
          sales: [incomingSale, ...prev.sales],
          products: updatedProducts,
        };
      }
      if (delta.type === 'stock:updated' && Array.isArray(delta.data?.products)) {
        return { ...prev, products: delta.data.products as Product[] };
      }
      if (delta.type === 'order:webhook' && delta.data) {
        const incomingOrder = delta.data as EcommerceOrder;
        if (prev.ecommerceOrders.some((o) => o.id === incomingOrder.id)) return prev;
        let nextProducts = prev.products;
        if (
          prev.ecommerceCredentials.autoDeductStock &&
          Array.isArray(incomingOrder.skuQuantities)
        ) {
          nextProducts = prev.products.map((p) => {
            const match = incomingOrder.skuQuantities.find((sq) => sq.sku === p.sku);
            if (!match) return p;
            return { ...p, stock: Math.max(0, p.stock - match.quantity) };
          });
        }
        return {
          ...prev,
          products: nextProducts,
          ecommerceOrders: [{ ...incomingOrder, onTime: true }, ...prev.ecommerceOrders],
        };
      }
      return prev;
    });
  }, []);

  const isInsideShopPos = Boolean(
    authSession && (authSession.role !== UserRole.SUPER_ADMIN || inspectingShopId)
  );

  const { collaborators, broadcastMutation } = useRealtimeSync({
    room: isInsideShopPos ? `shop:${state.shopId}` : 'superadmin-lobby',
    authToken: authSession?.token || null,
    actorName,
    actorEmail,
    actorRole: effectiveRole,
    activeTab,
    isOnline: isOnline && isInsideShopPos,
    onRemoteDelta: handleRemoteDelta,
  });

  // Central Shop State Persistence + Automatic Background Google Sheets Sync + Offline Queue
  const persistShopMutation = useCallback(
    async (nextState: PosStoreState, description: string) => {
      setState(nextState);
      await saveStoreSnapshot(nextState);

      if (!authSession?.token || !isOnline) {
        await enqueueOfflineMutation({
          id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          shopId: nextState.shopId,
          createdAt: new Date().toISOString(),
          type: 'FULL_SYNC',
          description,
          payload: { timestamp: Date.now() },
        });
        const pending = await getPendingMutations(nextState.shopId);
        setPendingOfflineCount(pending.length);
        return;
      }

      try {
        const res = await saveShopPosStateToServer(
          authSession.token,
          nextState.shopId,
          nextState
        );
        if (nextState.sheetConfig.spreadsheetId && nextState.sheetConfig.autoSync) {
          setState((curr) =>
            curr.shopId === nextState.shopId
              ? {
                  ...curr,
                  sheetConfig: {
                    ...curr.sheetConfig,
                    lastSyncedAt: res.lastSavedAt || new Date().toISOString(),
                  },
                }
              : curr
          );
        }
      } catch {
        await enqueueOfflineMutation({
          id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          shopId: nextState.shopId,
          createdAt: new Date().toISOString(),
          type: 'FULL_SYNC',
          description,
          payload: { timestamp: Date.now() },
        });
        const pending = await getPendingMutations(nextState.shopId);
        setPendingOfflineCount(pending.length);
      }
    },
    [authSession?.token, isOnline]
  );

  // Flush offline mutation queue with explicit confirmation
  const handleFlushOfflineQueue = () => {
    if (!authSession?.token) return;
    setConfirmDialog({
      isOpen: true,
      title:
        lang === 'bn'
          ? 'অফলাইন লেনদেন ক্লাউডে সিঙ্ক করবেন?'
          : 'Sync Queued Offline Updates?',
      description:
        lang === 'bn'
          ? 'অফলাইনে থাকাকালীন সংরক্ষিত সকল বিক্রি, স্টক ও বাকির হিসাব সার্ভারে আপডেট করা হবে।'
          : 'All queued POS checkouts, inventory updates, and ledger entries recorded offline will be synchronized.',
      affectedSummary: `${pendingOfflineCount} queued update(s) · ${state.shopNameEn}`,
      confirmLabel: lang === 'bn' ? 'হ্যাঁ, সিঙ্ক করুন' : 'Confirm & Sync',
      variant: 'primary',
      onConfirm: async () => {
        setIsHydratingWorkspace(true);
        try {
          await saveShopPosStateToServer(authSession.token, state.shopId, state);
          if (state.sheetConfig.spreadsheetId) {
            await triggerShopSheetSync(authSession.token, state.shopId);
          }
          await clearOfflineQueue(state.shopId);
          setPendingOfflineCount(0);
          const nowIso = new Date().toISOString();
          const syncedState: PosStoreState = {
            ...state,
            sheetConfig: { ...state.sheetConfig, lastSyncedAt: nowIso },
          };
          setState(syncedState);
          await saveStoreSnapshot(syncedState);
          notify(
            lang === 'bn'
              ? 'সকল অফলাইন লেনদেন সফলভাবে সিঙ্ক হয়েছে!'
              : 'All offline transactions synced successfully!'
          );
        } finally {
          setIsHydratingWorkspace(false);
        }
      },
    });
  };

  // POS Sale Completion Handler
  const handleCompleteSale = async (
    sale: SaleTransaction,
    newCreditCustomer?: { name: string; phone: string }
  ) => {
    const updatedProducts = state.products.map((p) => {
      const line = sale.items.find((i) => i.productId === p.id);
      if (!line) return p;
      return {
        ...p,
        stock: Math.max(0, p.stock - line.quantity),
        soldThisMonth: p.soldThisMonth + line.quantity,
        revenueThisMonth: p.revenueThisMonth + line.subtotal,
        updatedAt: sale.timestamp,
      };
    });

    let updatedCredits = [...state.credits];
    if (sale.dueAmount > 0) {
      if (sale.customerId) {
        updatedCredits = updatedCredits.map((c) => {
          if (c.id !== sale.customerId) return c;
          const prevHistory = ensureCustomerCreditHistory(c);
          const nextBalance = c.balanceDue + sale.dueAmount;
          const saleDueEntry: CreditHistoryEntry = {
            id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            customerId: c.id,
            customerName: c.name,
            customerNameEn: c.nameEn || c.name,
            customerPhone: c.phone,
            date: sale.date,
            timestamp: sale.timestamp,
            type: 'credit_sale',
            previousDue: c.balanceDue,
            creditAdded: sale.dueAmount,
            paidAmount: 0,
            balanceAfter: nextBalance,
            invoiceNo: sale.invoiceNo,
            paymentMethod: sale.paymentMethod,
            note:
              sale.paidAmount > 0
                ? `Invoice ${sale.invoiceNo} (Bill ${formatBDT(sale.totalAmount)}, Cash Paid ${formatBDT(sale.paidAmount)})`
                : `Invoice ${sale.invoiceNo} (Credit Bill)`,
            recordedBy: actorName,
          };
          return {
            ...c,
            totalCreditSales: c.totalCreditSales + sale.dueAmount,
            balanceDue: nextBalance,
            lastTransactionDate: sale.date,
            history: [...prevHistory, saleDueEntry],
          };
        });
      } else if (newCreditCustomer) {
        const nextDue = new Date();
        nextDue.setDate(nextDue.getDate() + 14);
        const newCustId = `cred-${Date.now()}`;
        const initialHistoryEntry: CreditHistoryEntry = {
          id: `ch-${Date.now()}-open`,
          customerId: newCustId,
          customerName: newCreditCustomer.name,
          customerNameEn: newCreditCustomer.name,
          customerPhone: newCreditCustomer.phone || 'N/A',
          date: sale.date,
          timestamp: sale.timestamp,
          type: 'credit_sale',
          previousDue: 0,
          creditAdded: sale.dueAmount,
          paidAmount: 0,
          balanceAfter: sale.dueAmount,
          invoiceNo: sale.invoiceNo,
          paymentMethod: sale.paymentMethod,
          note:
            sale.paidAmount > 0
              ? `Invoice ${sale.invoiceNo} (Bill ${formatBDT(sale.totalAmount)}, Cash Paid ${formatBDT(sale.paidAmount)})`
              : `Invoice ${sale.invoiceNo}`,
          recordedBy: actorName,
        };
        updatedCredits.unshift({
          id: newCustId,
          name: newCreditCustomer.name,
          nameEn: newCreditCustomer.name,
          phone: newCreditCustomer.phone || 'N/A',
          totalCreditSales: sale.dueAmount,
          totalPaid: 0,
          balanceDue: sale.dueAmount,
          dueDate: nextDue.toISOString().slice(0, 10),
          lastTransactionDate: sale.date,
          isOverdue: false,
          notes: `Invoice ${sale.invoiceNo}`,
          history: [initialHistoryEntry],
        });
      }
    }

    const audit = appendAuditEntry(
      'SALE_CREATED',
      sale.invoiceNo,
      `Total ${formatBDT(sale.totalAmount)} (${sale.paymentMethod})${
        sale.dueAmount > 0 ? ` · Due ${formatBDT(sale.dueAmount)}` : ''
      }`
    );

    const nextState: PosStoreState = {
      ...state,
      selectedMonthKey: sale.monthKey,
      products: updatedProducts,
      sales: [sale, ...state.sales],
      credits: updatedCredits,
      auditLogs: [audit, ...state.auditLogs],
    };

    setLastReceiptSale(sale);
    setPrintMode('receipt');
    broadcastMutation('sale:created', { sale, products: updatedProducts });
    await persistShopMutation(nextState, `Sale ${sale.invoiceNo}`);

    notify(
      lang === 'bn'
        ? `বিক্রি সম্পন্ন (${sale.invoiceNo}: ${formatBDT(sale.totalAmount)})!`
        : `Sale completed (${sale.invoiceNo}: ${formatBDT(sale.totalAmount)})!`
    );
  };

  // Inventory & Category Handlers
  const handleRestockProduct = (
    productId: string,
    addedQty: number,
    logWholesalePurchase: boolean
  ) => {
    const target = state.products.find((p) => p.id === productId);
    if (!target) return;

    const updatedProducts = state.products.map((p) =>
      p.id === productId
        ? { ...p, stock: p.stock + addedQty, updatedAt: new Date().toISOString() }
        : p
    );

    const nextExpenses = [...state.expenses];
    if (logWholesalePurchase) {
      const todayIso = new Date().toISOString().slice(0, 10);
      nextExpenses.unshift({
        id: `pur-${Date.now()}`,
        categoryBn: `মালামাল ক্রয় (${target.name})`,
        categoryEn: `Stock Purchase (${target.name})`,
        amount: target.buyPrice * addedQty,
        date: todayIso,
        monthKey: state.selectedMonthKey,
        type: 'inventory_purchase',
        note: `Restocked +${addedQty} ${target.unit || 'pcs'}`,
        recordedBy: actorName,
      });
    }

    const audit = appendAuditEntry(
      'STOCK_UPDATED',
      target.name,
      `Added +${addedQty} ${target.unit || 'pcs'} (New stock: ${target.stock + addedQty})`
    );

    const nextState: PosStoreState = {
      ...state,
      products: updatedProducts,
      expenses: nextExpenses,
      auditLogs: [audit, ...state.auditLogs],
    };

    broadcastMutation('stock:updated', { products: updatedProducts });
    persistShopMutation(nextState, `Restock ${target.name}`);
    notify(
      lang === 'bn'
        ? `${target.name} পণ্যে +${addedQty} স্টক যোগ হয়েছে।`
        : `Added +${addedQty} units to ${target.name}.`
    );
  };

  const handleAddProduct = (
    newProd: Omit<Product, 'id' | 'soldThisMonth' | 'revenueThisMonth' | 'updatedAt'>
  ) => {
    const created: Product = {
      ...newProd,
      id: `prod-${Date.now()}`,
      soldThisMonth: 0,
      revenueThisMonth: 0,
      updatedAt: new Date().toISOString(),
    };
    const audit = appendAuditEntry(
      'PRODUCT_ADDED',
      created.name,
      `SKU ${created.sku} · Opening stock ${created.stock} · Sell ${formatBDT(created.sellPrice)}`
    );
    const nextState: PosStoreState = {
      ...state,
      products: [created, ...state.products],
      auditLogs: [audit, ...state.auditLogs],
    };
    broadcastMutation('stock:updated', { products: nextState.products });
    persistShopMutation(nextState, `Add SKU ${created.sku}`);
    notify(
      lang === 'bn'
        ? `নতুন পণ্য যুক্ত হয়েছে: ${created.nameBn || created.name}`
        : `Added new SKU: ${created.name}`
    );
  };

  const handleUpdateProduct = (updatedProduct: Product) => {
    const nextProducts = state.products.map((p) =>
      p.id === updatedProduct.id
        ? { ...updatedProduct, updatedAt: new Date().toISOString() }
        : p
    );
    const audit = appendAuditEntry(
      'PRODUCT_UPDATED',
      updatedProduct.name,
      `Updated SKU ${updatedProduct.sku} · Sell ${formatBDT(updatedProduct.sellPrice)} · Stock ${updatedProduct.stock}`
    );
    const nextState: PosStoreState = {
      ...state,
      products: nextProducts,
      auditLogs: [audit, ...state.auditLogs],
    };
    broadcastMutation('stock:updated', { products: nextProducts });
    persistShopMutation(nextState, `Update SKU ${updatedProduct.sku}`);
    notify(
      lang === 'bn'
        ? `পণ্যের তথ্য আপডেট হয়েছে: ${updatedProduct.nameBn || updatedProduct.name}`
        : `Updated product: ${updatedProduct.name}`
    );
  };

  const handleUpdateCategories = (
    nextCategories: ShopCategoryItem[],
    renameRule?: { oldBn: string; newBn: string; newEn: string }
  ) => {
    let nextProducts = state.products;
    let nextSales = state.sales;

    if (renameRule && renameRule.oldBn !== renameRule.newBn) {
      nextProducts = state.products.map((p) =>
        p.category === renameRule.oldBn
          ? {
              ...p,
              category: renameRule.newBn,
              categoryEn: renameRule.newEn,
              updatedAt: new Date().toISOString(),
            }
          : p
      );
      nextSales = state.sales.map((s) => ({
        ...s,
        items: s.items.map((item) =>
          item.category === renameRule.oldBn
            ? { ...item, category: renameRule.newBn }
            : item
        ),
      }));
    } else if (renameRule) {
      nextProducts = state.products.map((p) =>
        p.category === renameRule.oldBn
          ? { ...p, categoryEn: renameRule.newEn }
          : p
      );
    }

    const audit = appendAuditEntry(
      'CATEGORY_UPDATED',
      renameRule ? `${renameRule.oldBn} -> ${renameRule.newBn}` : 'Shop Categories',
      `Total categories: ${nextCategories.length}`
    );

    const nextState: PosStoreState = {
      ...state,
      categories: nextCategories,
      products: nextProducts,
      sales: nextSales,
      auditLogs: [audit, ...state.auditLogs],
    };
    persistShopMutation(nextState, 'Updated shop categories');
    notify(
      lang === 'bn'
        ? 'ক্যাটাগরি তালিকা আপডেট করা হয়েছে।'
        : 'Shop categories updated successfully.'
    );
  };

  const handleDeleteProductRequest = (product: Product) => {
    setConfirmDialog({
      isOpen: true,
      title:
        lang === 'bn'
          ? `"${product.nameBn || product.name}" পণ্যটি মুছে ফেলবেন?`
          : `Delete SKU "${product.name}"?`,
      description:
        lang === 'bn'
          ? 'পণ্যটি ইনভেন্টরি তালিকা থেকে স্থায়ীভাবে মুছে যাবে।'
          : 'This will permanently remove the SKU from your inventory catalog.',
      affectedSummary: `${product.sku} · ${product.name} · Current Stock: ${product.stock}`,
      confirmLabel: lang === 'bn' ? 'মুছে ফেলুন' : 'Delete SKU',
      variant: 'danger',
      onConfirm: async () => {
        const updatedProducts = state.products.filter((p) => p.id !== product.id);
        const audit = appendAuditEntry(
          'PRODUCT_DELETED',
          product.name,
          `Removed SKU ${product.sku}`
        );
        const nextState: PosStoreState = {
          ...state,
          products: updatedProducts,
          auditLogs: [audit, ...state.auditLogs],
        };
        broadcastMutation('stock:updated', { products: updatedProducts });
        await persistShopMutation(nextState, `Delete SKU ${product.sku}`);
        notify(lang === 'bn' ? 'পণ্যটি মুছে ফেলা হয়েছে।' : `Deleted ${product.name}.`);
      },
    });
  };

  // Credit Collection, Manual Due Recording & Expense Handlers
  const handleCollectCreditPayment = (
    customerId: string,
    collectedAmount: number,
    paymentDate?: string,
    paymentMethod?: string,
    note?: string
  ) => {
    const cust = state.credits.find((c) => c.id === customerId);
    if (!cust) return;
    const resolvedDate = paymentDate || new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();

    const updatedCredits = state.credits.map((c) => {
      if (c.id !== customerId) return c;
      const prevHistory = ensureCustomerCreditHistory(c);
      const nextDue = Math.max(0, c.balanceDue - collectedAmount);
      const paymentEntry: CreditHistoryEntry = {
        id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        customerId: c.id,
        customerName: c.name,
        customerNameEn: c.nameEn || c.name,
        customerPhone: c.phone,
        date: resolvedDate,
        timestamp: nowIso,
        type: 'due_payment',
        previousDue: c.balanceDue,
        creditAdded: 0,
        paidAmount: collectedAmount,
        balanceAfter: nextDue,
        paymentMethod: paymentMethod || 'Cash',
        note: note || 'Due payment collected',
        recordedBy: actorName,
      };
      return {
        ...c,
        totalPaid: c.totalPaid + collectedAmount,
        balanceDue: nextDue,
        isOverdue: nextDue === 0 ? false : c.isOverdue,
        lastTransactionDate: resolvedDate > c.lastTransactionDate ? resolvedDate : c.lastTransactionDate,
        history: [...prevHistory, paymentEntry],
      };
    });
    const audit = appendAuditEntry(
      'CREDIT_COLLECTED',
      cust.name,
      `Collected ${formatBDT(collectedAmount)} on ${resolvedDate} · Remaining due ${formatBDT(
        Math.max(0, cust.balanceDue - collectedAmount)
      )}`
    );
    const nextState: PosStoreState = {
      ...state,
      credits: updatedCredits,
      auditLogs: [audit, ...state.auditLogs],
    };
    persistShopMutation(nextState, `Credit collected from ${cust.name}`);
    notify(
      lang === 'bn'
        ? `${cust.name} এর কাছ থেকে ${formatBDT(collectedAmount)} আদায় সম্পন্ন!`
        : `Collected ${formatBDT(collectedAmount)} from ${cust.name}.`
    );
  };

  const handleAddCustomerDue = (payload: {
    existingCustomerId?: string;
    name: string;
    phone: string;
    dueAmount: number;
    date: string;
    dueDate: string;
    note: string;
  }) => {
    const nowIso = new Date().toISOString();
    const todayIso = nowIso.slice(0, 10);
    let updatedCredits: CustomerCredit[];
    let targetLabel = payload.name;

    if (payload.existingCustomerId) {
      updatedCredits = state.credits.map((c) => {
        if (c.id !== payload.existingCustomerId) return c;
        targetLabel = c.name;
        const prevHistory = ensureCustomerCreditHistory(c);
        const nextBalance = c.balanceDue + payload.dueAmount;
        const addedEntry: CreditHistoryEntry = {
          id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          customerId: c.id,
          customerName: c.name,
          customerNameEn: c.nameEn || c.name,
          customerPhone: c.phone,
          date: payload.date || todayIso,
          timestamp: nowIso,
          type: 'opening_due',
          previousDue: c.balanceDue,
          creditAdded: payload.dueAmount,
          paidAmount: 0,
          balanceAfter: nextBalance,
          note: payload.note,
          recordedBy: actorName,
        };
        return {
          ...c,
          totalCreditSales: c.totalCreditSales + payload.dueAmount,
          balanceDue: nextBalance,
          dueDate: payload.dueDate || c.dueDate,
          isOverdue: (payload.dueDate || c.dueDate) < todayIso && nextBalance > 0,
          lastTransactionDate:
            payload.date > c.lastTransactionDate ? payload.date : c.lastTransactionDate,
          history: [...prevHistory, addedEntry],
        };
      });
    } else {
      const newId = `cred-${Date.now()}`;
      const openEntry: CreditHistoryEntry = {
        id: `ch-${Date.now()}-open`,
        customerId: newId,
        customerName: payload.name,
        customerNameEn: payload.name,
        customerPhone: payload.phone,
        date: payload.date || todayIso,
        timestamp: nowIso,
        type: 'opening_due',
        previousDue: 0,
        creditAdded: payload.dueAmount,
        paidAmount: 0,
        balanceAfter: payload.dueAmount,
        note: payload.note,
        recordedBy: actorName,
      };
      const newCust: CustomerCredit = {
        id: newId,
        name: payload.name,
        nameEn: payload.name,
        phone: payload.phone,
        totalCreditSales: payload.dueAmount,
        totalPaid: 0,
        balanceDue: payload.dueAmount,
        dueDate: payload.dueDate || todayIso,
        lastTransactionDate: payload.date || todayIso,
        isOverdue: Boolean(payload.dueDate && payload.dueDate < todayIso),
        notes: payload.note,
        history: [openEntry],
      };
      updatedCredits = [newCust, ...state.credits];
    }

    const audit = appendAuditEntry(
      'CREDIT_ADDED',
      targetLabel,
      `Recorded due +${formatBDT(payload.dueAmount)} on ${payload.date} (${payload.note})`
    );
    const nextState: PosStoreState = {
      ...state,
      credits: updatedCredits,
      auditLogs: [audit, ...state.auditLogs],
    };
    persistShopMutation(nextState, `Added due for ${targetLabel}`);
    notify(
      lang === 'bn'
        ? `${targetLabel} এর খাতায় ${formatBDT(payload.dueAmount)} বাকি যুক্ত হয়েছে।`
        : `Recorded ${formatBDT(payload.dueAmount)} due for ${targetLabel}.`
    );
  };

  const handleAddExpenseEntry = (entry: Omit<ExpenseEntry, 'id'>) => {
    const created: ExpenseEntry = { ...entry, id: `exp-${Date.now()}` };
    const audit = appendAuditEntry(
      'EXPENSE_LOGGED',
      created.categoryBn,
      `${created.type}: ${formatBDT(created.amount)} (${created.note})`
    );
    const nextState: PosStoreState = {
      ...state,
      expenses: [created, ...state.expenses],
      auditLogs: [audit, ...state.auditLogs],
    };
    persistShopMutation(nextState, `Expense ${created.categoryEn}`);
    notify(lang === 'bn' ? 'হিসাব সংরক্ষিত হয়েছে।' : 'Ledger entry recorded.');
  };

  // E-Commerce Order Ingestion
  const handleIngestEcommerceOrders = (incoming: EcommerceOrder[], sourceLabel: string) => {
    const existingIds = new Set(state.ecommerceOrders.map((o) => o.id));
    const fresh = incoming.filter((o) => !existingIds.has(o.id));
    if (fresh.length === 0) return;

    let nextProducts = state.products;
    if (state.ecommerceCredentials.autoDeductStock) {
      nextProducts = state.products.map((p) => {
        let deduct = 0;
        for (const ord of fresh) {
          for (const sq of ord.skuQuantities || []) {
            if (sq.sku === p.sku) deduct += sq.quantity;
          }
        }
        if (deduct === 0) return p;
        return { ...p, stock: Math.max(0, p.stock - deduct) };
      });
    }

    const audit = appendAuditEntry(
      'ECOMMERCE_SYNC',
      sourceLabel,
      `Ingested ${fresh.length} order(s) and updated inventory.`
    );

    const nextState: PosStoreState = {
      ...state,
      products: nextProducts,
      ecommerceOrders: [...fresh, ...state.ecommerceOrders],
      auditLogs: [audit, ...state.auditLogs],
    };
    persistShopMutation(nextState, `E-Commerce Sync (${sourceLabel})`);
  };

  // Shop Profile & Staff Custom Dashboard Management
  const handleUpdateShopProfile = (patch: {
    shopNameBn: string;
    shopNameEn: string;
    businessType: string;
    phone: string;
    address: string;
  }) => {
    const nextState: PosStoreState = {
      ...state,
      ...patch,
    };
    persistShopMutation(nextState, 'Updated shop profile');
    notify(
      lang === 'bn'
        ? 'দোকানের প্রোফাইল তথ্য সংরক্ষিত হয়েছে।'
        : 'Shop profile updated successfully.'
    );
  };

  const handleCreateStaffLogin = async (payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
    permissions: StaffDashboardPermissions;
  }) => {
    if (!authSession?.token) return;
    const res = await createShopStaffAccount(authSession.token, state.shopId, payload);
    const audit = appendAuditEntry(
      'ROLE_UPDATED',
      res.staff.email,
      `Created ${res.staff.role} login & dashboard for ${res.staff.name}`
    );
    const nextState: PosStoreState = {
      ...state,
      staff: [...state.staff.filter((s) => s.id !== res.staff.id), res.staff],
      auditLogs: [audit, ...state.auditLogs],
    };
    setState(nextState);
    await saveStoreSnapshot(nextState);
    notify(
      lang === 'bn'
        ? `${res.staff.name} (${res.staff.role}) এর লগইন ও ড্যাশবোর্ড তৈরি হয়েছে!`
        : `Created login & custom dashboard for ${res.staff.name} (${res.staff.role})!`
    );
  };

  const handleUpdateStaffLogin = async (
    staffId: string,
    payload: {
      name?: string;
      phone?: string;
      role?: UserRole;
      newPassword?: string;
      permissions?: StaffDashboardPermissions;
    }
  ) => {
    if (!authSession?.token) return;
    const res = await updateShopStaffAccount(
      authSession.token,
      state.shopId,
      staffId,
      payload
    );
    const target = state.staff.find((s) => s.id === staffId);
    const audit = appendAuditEntry(
      'ROLE_UPDATED',
      target?.email || staffId,
      `Updated staff dashboard & permissions (${payload.role || target?.role || 'Staff'})`
    );
    const nextState: PosStoreState = {
      ...state,
      staff: res.staff,
      auditLogs: [audit, ...state.auditLogs],
    };
    setState(nextState);
    await saveStoreSnapshot(nextState);
    notify(
      lang === 'bn'
        ? 'স্টাফের ড্যাশবোর্ড ও পারমিশন আপডেট হয়েছে।'
        : 'Staff permissions and dashboard updated.'
    );
  };

  const handleDeleteStaffLogin = (staffMember: StaffMember) => {
    if (!authSession?.token) return;
    setConfirmDialog({
      isOpen: true,
      title:
        lang === 'bn'
          ? `"${staffMember.name}" এর লগইন অ্যাকাউন্ট মুছে ফেলবেন?`
          : `Remove Staff Account "${staffMember.name}"?`,
      description:
        lang === 'bn'
          ? 'এই স্টাফ সদস্য আর তার ইমেইল ও পাসওয়ার্ড দিয়ে শপের POS ড্যাশবোর্ডে লগইন করতে পারবেন না।'
          : 'This staff member will immediately lose email & password login access to your shop POS.',
      affectedSummary: `${staffMember.name} · ${staffMember.email} (${staffMember.role})`,
      confirmLabel: lang === 'bn' ? 'অ্যাকাউন্ট মুছুন' : 'Remove Staff',
      variant: 'danger',
      onConfirm: async () => {
        await deleteShopStaffAccount(authSession.token, state.shopId, staffMember.id);
        const audit = appendAuditEntry(
          'ROLE_UPDATED',
          staffMember.email,
          `Removed staff login for ${staffMember.name}`
        );
        const nextState: PosStoreState = {
          ...state,
          staff: state.staff.filter((s) => s.id !== staffMember.id),
          auditLogs: [audit, ...state.auditLogs],
        };
        setState(nextState);
        await saveStoreSnapshot(nextState);
        notify(
          lang === 'bn'
            ? `${staffMember.name} এর অ্যাকাউন্ট মুছে ফেলা হয়েছে।`
            : `Removed staff account ${staffMember.name}.`
        );
      },
    });
  };

  const executeConfirmDialog = async () => {
    if (!confirmDialog) return;
    setIsConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Operation failed', true);
    } finally {
      setIsConfirmBusy(false);
    }
  };

  const handleReloadCsv = async (customCsv?: string) => {
    setIsHydratingWorkspace(true);
    try {
      const csvText =
        customCsv || (await (await fetch('./assets/aistudio/Shop_POS_95f8e56e')).text());
      const parsed = parseUploadedSummaryCsv(csvText);
      const defaults = buildDefaultPosStore();
      const nextState: PosStoreState = {
        ...defaults,
        shopId: state.shopId,
        shopNameBn: parsed.shopTitleBn || state.shopNameBn,
        shopNameEn: state.shopNameEn,
        selectedYear: parsed.year || defaults.selectedYear,
        staff: state.staff,
        sheetConfig: state.sheetConfig,
        ecommerceCredentials: state.ecommerceCredentials,
      };
      await persistShopMutation(nextState, 'Imported CSV dataset');
      notify(
        lang === 'bn'
          ? 'CSV ডেটাসেট সফলভাবে বিশ্লেষণ ও আপডেট করা হয়েছে!'
          : 'CSV dataset analyzed and loaded into workspace!'
      );
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'CSV import failed', true);
    } finally {
      setIsHydratingWorkspace(false);
    }
  };

  const allNavItems: Array<{
    id: WorkspaceTab;
    label: string;
    shortLabel: string;
    accentBg: string;
    accentText: string;
    activeClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'dashboard',
      label: lang === 'bn' ? 'হোম ও ব্যবসার হিসাব' : 'Dashboard & Summary',
      shortLabel: lang === 'bn' ? 'হোম' : 'Home',
      accentBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      activeClass: 'bg-emerald-600 text-white shadow-xs',
      icon: BarChart3,
    },
    {
      id: 'pos',
      label: lang === 'bn' ? 'ক্যাশ মেমো / বিক্রি' : 'New Sale (POS)',
      shortLabel: lang === 'bn' ? 'বিক্রি' : 'Sale',
      accentBg: 'bg-sky-50 dark:bg-sky-950/40',
      accentText: 'text-sky-600 dark:text-sky-400',
      activeClass: 'bg-sky-600 text-white shadow-xs',
      icon: ShoppingCart,
    },
    {
      id: 'sales_history',
      label: lang === 'bn' ? 'বিক্রয় ইতিহাস' : 'Sales History',
      shortLabel: lang === 'bn' ? 'ইতিহাস' : 'History',
      accentBg: 'bg-teal-50 dark:bg-teal-950/40',
      accentText: 'text-teal-600 dark:text-teal-400',
      activeClass: 'bg-teal-600 text-white shadow-xs',
      icon: ClipboardList,
    },
    {
      id: 'inventory',
      label: lang === 'bn' ? 'পণ্য ও স্টক তালিকা' : 'Products & Stock',
      shortLabel: lang === 'bn' ? 'স্টক' : 'Stock',
      accentBg: 'bg-violet-50 dark:bg-violet-950/40',
      accentText: 'text-violet-600 dark:text-violet-400',
      activeClass: 'bg-violet-600 text-white shadow-xs',
      icon: Package,
    },
    {
      id: 'credit_expenses',
      label: lang === 'bn' ? 'বাকির খাতা ও খরচ' : 'Dues & Expenses',
      shortLabel: lang === 'bn' ? 'বাকি/খরচ' : 'Ledger',
      accentBg: 'bg-amber-50 dark:bg-amber-950/40',
      accentText: 'text-amber-600 dark:text-amber-400',
      activeClass: 'bg-amber-600 text-white shadow-xs',
      icon: Wallet,
    },
    {
      id: 'ecommerce',
      label: lang === 'bn' ? 'অনলাইন অর্ডার' : 'Online Orders',
      shortLabel: lang === 'bn' ? 'অনলাইন' : 'Online',
      accentBg: 'bg-cyan-50 dark:bg-cyan-950/40',
      accentText: 'text-cyan-600 dark:text-cyan-400',
      activeClass: 'bg-cyan-600 text-white shadow-xs',
      icon: Globe,
    },
    {
      id: 'reports_admin',
      label: lang === 'bn' ? 'স্টাফ ও সেটিংস' : 'Staff & Settings',
      shortLabel: lang === 'bn' ? 'সেটিংস' : 'Settings',
      accentBg: 'bg-indigo-50 dark:bg-indigo-950/40',
      accentText: 'text-indigo-600 dark:text-indigo-400',
      activeClass: 'bg-indigo-600 text-white shadow-xs',
      icon: ShieldCheck,
    },
  ];

  const navItems = useMemo(() => {
    const allowedSet = new Set(effectivePermissions.allowedTabs || []);
    return allNavItems.filter((item) => {
      if (
        effectiveRole !== UserRole.OWNER &&
        allowedSet.size > 0 &&
        !allowedSet.has(item.id)
      ) {
        return false;
      }
      if (
        item.id === 'ecommerce' &&
        shopEntitlements &&
        shopEntitlements.enableEcommerce === false
      ) {
        return false;
      }
      if (
        item.id === 'credit_expenses' &&
        shopEntitlements &&
        shopEntitlements.enableCreditLedger === false
      ) {
        return false;
      }
      return true;
    });
  }, [allNavItems, effectivePermissions.allowedTabs, effectiveRole, shopEntitlements]);

  // Keep activeTab inside permitted navigation tabs
  useEffect(() => {
    if (navItems.length > 0 && !navItems.some((item) => item.id === activeTab)) {
      setActiveTab(navItems[0].id);
    }
  }, [navItems, activeTab]);

  // Toast overlay shared across Login, Super Admin, and Shop POS
  const toastNode = toast ? (
    <div
      className={`neu-popup-card animate-popup-item fixed bottom-17 lg:bottom-5 right-3 sm:right-4 z-[80] max-w-[calc(100vw-1.5rem)] sm:max-w-sm rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all ${
        toast.isError
          ? 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
          : 'border-emerald-700/40 bg-slate-900 text-white dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      {toast.msg}
    </div>
  ) : null;

  if (isCheckingSession || isOpeningShopPos) {
    return (
      <>
        <WorkspaceShellSkeleton lang={lang} />
        {toastNode}
      </>
    );
  }

  // 1. Unauthenticated -> Render Multi-Tenant Email & Password Login Screen
  if (!authSession) {
    return (
      <>
        <AuthLoginScreen
          lang={lang}
          darkMode={darkMode}
          onToggleLang={() => setLang((prev) => (prev === 'bn' ? 'en' : 'bn'))}
          onToggleDark={() => setDarkMode((prev) => !prev)}
          onAuthenticated={handleAuthenticated}
        />
        {toastNode}
      </>
    );
  }

  // 2. Super Admin Control Center (when not inspecting a specific shop's POS)
  if (authSession.role === UserRole.SUPER_ADMIN && !inspectingShopId) {
    return (
      <>
        <SuperAdminPortal
          session={authSession}
          lang={lang}
          darkMode={darkMode}
          onToggleLang={() => setLang((prev) => (prev === 'bn' ? 'en' : 'bn'))}
          onToggleDark={() => setDarkMode((prev) => !prev)}
          onLogout={handleLogout}
          onInspectShopPos={handleInspectShopPos}
          onNotify={notify}
        />
        {toastNode}
      </>
    );
  }

  // 3. Shop POS Workspace (Shop Owner / Manager / Cashier / Inventory OR Super Admin Live Inspection)
  const displayShopName = lang === 'bn' ? state.shopNameBn : state.shopNameEn;
  const primaryMobileTabOrder: WorkspaceTab[] = [
    'dashboard',
    'pos',
    'inventory',
    'credit_expenses',
  ];
  const mobileDirectItems = navItems
    .filter((item) => primaryMobileTabOrder.includes(item.id))
    .slice(0, 4);
  const mobileTotalSlots = mobileDirectItems.length + 1;
  const directActiveIdx = mobileDirectItems.findIndex((item) => item.id === activeTab);
  const isMoreMenuSlotActive = mobileMenuOpen || directActiveIdx === -1;
  const activeMobileIdx = isMoreMenuSlotActive
    ? mobileDirectItems.length
    : Math.max(0, directActiveIdx);
  const currentActiveNavObj = navItems.find((item) => item.id === activeTab) || navItems[0];
  const mobileActiveCapsuleClass = mobileMenuOpen
    ? 'bg-slate-800 dark:bg-emerald-600 text-white'
    : isMoreMenuSlotActive
    ? currentActiveNavObj?.activeClass || 'bg-teal-600 text-white'
    : mobileDirectItems[activeMobileIdx]?.activeClass || 'bg-emerald-600 text-white';

  const mobileIndicatorWidthClass =
    mobileTotalSlots === 1
      ? 'w-full'
      : mobileTotalSlots === 2
      ? 'w-1/2'
      : mobileTotalSlots === 3
      ? 'w-1/3'
      : mobileTotalSlots === 4
      ? 'w-1/4'
      : 'w-1/5';
  const mobileIndicatorTranslateClass =
    activeMobileIdx === 1
      ? 'translate-x-full'
      : activeMobileIdx === 2
      ? 'translate-x-[200%]'
      : activeMobileIdx === 3
      ? 'translate-x-[300%]'
      : activeMobileIdx === 4
      ? 'translate-x-[400%]'
      : 'translate-x-0';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-100/75 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Left Minimal Colored Workspace Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-slate-200/80 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900 sticky top-0 h-screen">
        <div className="h-14 px-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-[2px_2px_5px_rgba(15,23,42,0.18),inset_1px_1px_1px_rgba(255,255,255,0.35)]">
            <Store className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight font-display text-slate-900 dark:text-slate-100 truncate">
              {t.brandTitle}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {authSession.name} · {authSession.role}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3.5 py-5 space-y-2.5 overflow-y-auto">
          {isSuperAdminInspecting && (
            <button
              type="button"
              onClick={() => setInspectingShopId(null)}
              className="w-full mb-3 min-h-[40px] flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/85 dark:bg-indigo-950/45 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 whitespace-nowrap"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {lang === 'bn' ? 'সুপার অ্যাডমিনে ফিরুন' : 'Back to Super Admin'}
              </span>
            </button>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[44px] flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap ${
                  active
                    ? `${item.activeClass} border border-white/20`
                    : 'bg-slate-50/95 dark:bg-slate-800/80 border border-white/80 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 hover:bg-slate-100/90 dark:hover:bg-slate-800'
                }`}
              >
                <span
                  key={active ? 'active-icon' : 'idle-icon'}
                  className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                    active
                      ? 'bg-white/20 text-white animate-nav-pop'
                      : `${item.accentBg} ${item.accentText}`
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Minimal Sidebar Footer: Presence + PWA + Theme */}
        <div className="p-3.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <PWAInstallButton lang={lang} />

          <div className="neu-well flex items-center justify-between rounded-xl bg-slate-100/90 dark:bg-slate-950/60 px-3 py-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium truncate">
              <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {lang === 'bn' ? 'সক্রিয় স্টাফ' : 'Active Staff'}:{' '}
                <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {Math.max(1, collaborators.length)}
                </strong>
              </span>
            </span>

            <button
              type="button"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-white/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Minimal Shop Top Heading: Shop Name (Left) | BN/EN + Logout Icon (Right) */}
        <header className="h-14 sticky top-0 z-30 flex items-center justify-between gap-2.5 px-3.5 sm:px-4 lg:px-8 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs">
          {/* Left: Shop Name (plus Back button when Super Admin is inspecting) */}
          <div className="flex items-center gap-2 min-w-0">
            {isSuperAdminInspecting && (
              <button
                type="button"
                onClick={() => setInspectingShopId(null)}
                className="lg:hidden min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                <span>Admin</span>
              </button>
            )}
            <div className="lg:hidden h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Store className="h-4 w-4" />
            </div>
            <h1 className="text-sm sm:text-lg font-bold tracking-tight font-display text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
              {displayShopName}
            </h1>
          </div>

          {/* Right: BN/EN Toggle + Logout Icon Button */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div
              role="group"
              aria-label="Language switcher"
              className="neu-well inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 gap-1"
            >
              <button
                type="button"
                onClick={() => setLang('bn')}
                className={`min-h-[28px] px-2.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  lang === 'bn'
                    ? 'bg-emerald-600 text-white'
                    : 'neu-flat text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                }`}
              >
                BN
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`min-h-[28px] px-2.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                  lang === 'en'
                    ? 'bg-emerald-600 text-white'
                    : 'neu-flat text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title={lang === 'bn' ? 'লগ আউট করুন' : 'Log Out'}
              aria-label={lang === 'bn' ? 'লগ আউট করুন' : 'Log Out'}
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/85 dark:bg-rose-950/45 px-2.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/70 shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Global Broadcast Banner from Super Admin */}
        {globalAnnouncement && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60 px-3 sm:px-4 lg:px-8 py-1.5 flex items-start sm:items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0" />
            <span className="leading-snug break-words font-medium">{globalAnnouncement}</span>
          </div>
        )}

        {/* Offline & Queued Mutations Banner */}
        <OfflineStatusBanner
          isOnline={isOnline}
          pendingCount={pendingOfflineCount}
          lang={lang}
          onFlushQueue={handleFlushOfflineQueue}
        />

        {/* Active Workspace Viewport */}
        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6 max-w-7xl w-full mx-auto">
          {isHydratingWorkspace ? (
            <DashboardWorkspaceSkeleton lang={lang} />
          ) : (
            <div key={activeTab} className="animate-view-enter">
          {activeTab === 'dashboard' && (
            <AnalyticsDashboard
              state={state}
              lang={lang}
              activeRole={effectiveRole}
              permissions={effectivePermissions}
              onNavigateTab={setActiveTab}
              onOpenAuditPrint={() => setPrintMode('audit')}
              onReloadUploadedCsv={handleReloadCsv}
              onChangeMonth={(monthKey) =>
                setState((prev) => ({ ...prev, selectedMonthKey: monthKey }))
              }
            />
          )}

          {activeTab === 'pos' && (
            <PosTerminal
              products={state.products}
              categories={state.categories}
              credits={state.credits}
              lang={lang}
              cashierName={actorName}
              onCompleteSale={handleCompleteSale}
              onGoToInventory={() => setActiveTab('inventory')}
            />
          )}

          {activeTab === 'sales_history' && (
            <SalesHistoryView
              sales={state.sales}
              products={state.products}
              categories={state.categories}
              lang={lang}
              onPrintReceipt={(sale) => {
                setLastReceiptSale(sale);
                setPrintMode('receipt');
              }}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryManager
              products={state.products}
              categories={state.categories}
              lang={lang}
              activeRole={effectiveRole}
              permissions={effectivePermissions}
              onRestockProduct={handleRestockProduct}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProductRequest={handleDeleteProductRequest}
              onUpdateCategories={handleUpdateCategories}
            />
          )}

          {activeTab === 'credit_expenses' && (
            <CreditAndExpensesView
              credits={state.credits}
              expenses={state.expenses}
              sales={state.sales}
              seasonalHistory={state.seasonalHistory}
              monthKey={state.selectedMonthKey}
              lang={lang}
              activeRole={effectiveRole}
              permissions={effectivePermissions}
              onCollectCreditPayment={handleCollectCreditPayment}
              onAddCustomerDue={handleAddCustomerDue}
              onAddExpenseEntry={handleAddExpenseEntry}
            />
          )}

          {activeTab === 'ecommerce' && (
            <EcommerceSyncView
              orders={state.ecommerceOrders}
              credentials={state.ecommerceCredentials}
              authToken={authSession.token}
              lang={lang}
              activeRole={effectiveRole}
              onUpdateCredentials={(patch) => {
                const nextState: PosStoreState = {
                  ...state,
                  ecommerceCredentials: { ...state.ecommerceCredentials, ...patch },
                };
                persistShopMutation(nextState, 'Updated E-Commerce settings');
              }}
              onIngestOrders={handleIngestEcommerceOrders}
              onUpdateOrderStatus={(orderId, status) => {
                const nextOrders = state.ecommerceOrders.map((o) =>
                  o.id === orderId ? { ...o, fulfillmentStatus: status } : o
                );
                const nextState: PosStoreState = {
                  ...state,
                  ecommerceOrders: nextOrders,
                };
                persistShopMutation(nextState, `Order ${orderId} -> ${status}`);
              }}
              onNotify={notify}
            />
          )}

          {activeTab === 'reports_admin' && (
            <ReportsAndAdminView
              state={state}
              lang={lang}
              activeRole={effectiveRole}
              permissions={effectivePermissions}
              onUpdateShopProfile={handleUpdateShopProfile}
              onCreateStaffLogin={handleCreateStaffLogin}
              onUpdateStaffLogin={handleUpdateStaffLogin}
              onDeleteStaffLogin={handleDeleteStaffLogin}
              onOpenAuditPrint={() => setPrintMode('audit')}
            />
          )}
            </div>
          )}
        </main>
      </div>

      {/* Animated Mobile Slide-Up All-Tabs Menu Popup */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed top-14 inset-x-0 bottom-0 z-[45]">
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="animate-popup-backdrop absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'bn' ? 'সকল মেনু ট্যাব' : 'All Menu Tabs'}
            className="animate-sheet-slide-up neu-popup-card fixed left-2 right-2 bottom-[4.35rem] z-[46] rounded-2xl border bg-slate-50/98 dark:bg-slate-900/98 p-3 max-h-[calc(100dvh-8.25rem)] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/80 dark:border-slate-800">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
                {lang === 'bn' ? 'সকল মেনু ট্যাব' : 'All Menu Tabs'}
              </h2>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setDarkMode((prev) => !prev)}
                  aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  {darkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close menu'}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {isSuperAdminInspecting && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setInspectingShopId(null);
                }}
                className="w-full mb-2 min-h-[36px] flex items-center gap-2 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/85 dark:bg-indigo-950/45 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{lang === 'bn' ? 'সুপার অ্যাডমিনে ফিরুন' : 'Back to Super Admin'}</span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`animate-popup-item w-full min-h-[38px] flex items-center justify-between gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-left whitespace-nowrap ${
                      active
                        ? `${item.activeClass} border border-white/20`
                        : 'bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${
                          active ? 'bg-white/20 text-white' : `${item.accentBg} ${item.accentText}`
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="truncate whitespace-nowrap">{item.label}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0 opacity-90" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation Bar — 4 Core Tabs + 5th Three-Bar Menu Button */}
      <nav
        aria-label="Mobile workspace navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 px-2 py-1.5 shadow-[0_-6px_22px_rgba(15,23,42,0.08)] dark:shadow-[0_-6px_24px_rgba(2,6,23,0.7)]"
      >
        <div className="neu-well relative h-full w-full rounded-2xl bg-slate-100/90 dark:bg-slate-950/80 p-0.5">
          {/* Gliding Neumorphic Active Selection Capsule */}
          {mobileTotalSlots > 0 && (
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-y-0.5 left-0 ${mobileIndicatorWidthClass} ${mobileIndicatorTranslateClass} px-0.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
            >
              <div
                className={`h-full w-full rounded-xl ${mobileActiveCapsuleClass} shadow-[0_6px_14px_rgba(15,23,42,0.22),inset_1px_1px_2px_rgba(255,255,255,0.45),inset_-1px_-1px_2px_rgba(0,0,0,0.2)]`}
              />
            </div>
          )}

          <div
            className={`relative z-10 h-full grid items-center ${
              mobileTotalSlots === 1
                ? 'grid-cols-1'
                : mobileTotalSlots === 2
                ? 'grid-cols-2'
                : mobileTotalSlots === 3
                ? 'grid-cols-3'
                : mobileTotalSlots === 4
                ? 'grid-cols-4'
                : 'grid-cols-5'
            }`}
          >
            {mobileDirectItems.map((item) => {
              const Icon = item.icon;
              const active = !mobileMenuOpen && activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setActiveTab(item.id);
                  }}
                  className={`neu-flat group relative h-full min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-all duration-200 cursor-pointer select-none ${
                    active
                      ? 'text-white font-bold -translate-y-0.5'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:-translate-y-0.5 hover:bg-white/65 dark:hover:bg-slate-800/65 active:scale-92'
                  }`}
                >
                  <span
                    key={active ? 'mob-active' : 'mob-idle'}
                    className={`flex items-center justify-center rounded-lg p-1 transition-transform duration-200 ${
                      active
                        ? 'bg-white/20 text-white animate-nav-pop shadow-[inset_1px_1px_1px_rgba(255,255,255,0.35)]'
                        : 'group-hover:scale-110'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[10px] leading-tight mt-0.5 truncate whitespace-nowrap max-w-[66px]">
                    {item.shortLabel}
                  </span>
                </button>
              );
            })}

            {/* 5th / Last Slot: Three-Bar Menu Icon to Open Slide-Up All-Tabs Popup */}
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-label={lang === 'bn' ? 'সকল মেনু খুলুন' : 'Open all menu tabs'}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className={`neu-flat group relative h-full min-h-[44px] flex flex-col items-center justify-center rounded-xl transition-all duration-200 cursor-pointer select-none ${
                isMoreMenuSlotActive
                  ? 'text-white font-bold -translate-y-0.5'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:-translate-y-0.5 hover:bg-white/65 dark:hover:bg-slate-800/65 active:scale-92'
              }`}
            >
              <span
                key={mobileMenuOpen ? 'menu-open' : isMoreMenuSlotActive ? 'menu-active' : 'menu-idle'}
                className={`flex items-center justify-center rounded-lg p-1 transition-transform duration-200 ${
                  isMoreMenuSlotActive
                    ? 'bg-white/20 text-white animate-nav-pop shadow-[inset_1px_1px_1px_rgba(255,255,255,0.35)]'
                    : 'group-hover:scale-110'
                }`}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </span>
              <span className="text-[10px] leading-tight mt-0.5 truncate whitespace-nowrap max-w-[66px]">
                {!mobileMenuOpen && directActiveIdx === -1 && currentActiveNavObj
                  ? currentActiveNavObj.shortLabel
                  : lang === 'bn'
                  ? 'মেনু'
                  : 'Menu'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* Printable Receipt & Monthly Audit PDF Modal */}
      <PrintableDocumentModal
        mode={printMode}
        receiptSale={lastReceiptSale}
        state={state}
        lang={lang}
        onClose={() => setPrintMode(null)}
      />

      {/* Explicit User Confirmation Modal */}
      <ConfirmActionModal
        dialog={confirmDialog}
        lang={lang}
        isBusy={isConfirmBusy}
        onClose={() => !isConfirmBusy && setConfirmDialog(null)}
        onExecute={executeConfirmDialog}
      />

      {toastNode}
    </div>
  );
}
