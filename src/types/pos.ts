export enum UserRole {
  SUPER_ADMIN = 'SuperAdmin',
  OWNER = 'Owner',
  MANAGER = 'Manager',
  CASHIER = 'Cashier',
  INVENTORY = 'Inventory',
}

export enum PaymentMethod {
  CASH = 'Cash',
  MOBILE_BANKING = 'bKash / Nagad',
  CREDIT = 'Credit (বাকি)',
  CARD = 'Card / Bank',
}

export enum SalesChannel {
  WALK_IN = 'Walk-in POS',
  SHOPIFY = 'Shopify',
  WOOCOMMERCE = 'WooCommerce',
}

export type LanguageCode = 'bn' | 'en';

export type WorkspaceTab =
  | 'dashboard'
  | 'pos'
  | 'sales_history'
  | 'inventory'
  | 'credit_expenses'
  | 'ecommerce'
  | 'reports_admin';

export interface ShopCategoryItem {
  id: string;
  bn: string;
  en: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  nameBn: string;
  category: string;
  categoryEn: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  minStock: number;
  soldThisMonth: number;
  revenueThisMonth: number;
  unit: string;
  updatedAt: string;
}

export interface SaleLineItem {
  productId: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  buyPrice: number;
  subtotal: number;
  profit: number;
}

export interface SaleTransaction {
  id: string;
  invoiceNo: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  monthKey: string; // YYYY-MM
  channel: SalesChannel;
  paymentMethod: PaymentMethod;
  items: SaleLineItem[];
  subtotal: number;
  discount: number;
  serviceFee: number;
  totalAmount: number;
  grossProfit: number;
  paidAmount: number;
  dueAmount: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  cashierName: string;
  syncedToSheet?: boolean;
}

export interface CreditHistoryEntry {
  id: string;
  customerId: string;
  customerName: string;
  customerNameEn?: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  timestamp: string;
  type: 'opening_due' | 'credit_sale' | 'due_payment';
  previousDue: number;
  creditAdded: number;
  paidAmount: number;
  balanceAfter: number;
  invoiceNo?: string;
  paymentMethod?: string;
  note?: string;
  recordedBy?: string;
}

export interface CustomerCredit {
  id: string;
  name: string;
  nameEn: string;
  phone: string;
  totalCreditSales: number;
  totalPaid: number;
  balanceDue: number;
  dueDate: string;
  lastTransactionDate: string;
  isOverdue: boolean;
  notes?: string;
  history?: CreditHistoryEntry[];
}

export interface ExpenseEntry {
  id: string;
  categoryBn: string;
  categoryEn: string;
  amount: number;
  date: string;
  monthKey: string;
  type: 'expense' | 'other_income' | 'inventory_purchase';
  note: string;
  recordedBy: string;
}

export interface EcommerceOrder {
  id: string;
  externalOrderId: string;
  platform: 'Shopify' | 'WooCommerce';
  customerName: string;
  customerEmail: string;
  totalAmount: number;
  itemsSummary: string;
  skuQuantities: Array<{ sku: string; quantity: number }>;
  fulfillmentStatus: 'Pending' | 'Packed' | 'Shipped' | 'Delivered';
  carrier: string;
  dispatchHours: number;
  onTime: boolean;
  createdAt: string;
}

export interface StaffDashboardPermissions {
  allowedTabs: WorkspaceTab[];
  canViewProfit: boolean;
  canEditInventory: boolean;
  canDeleteItems: boolean;
  canManageExpenses: boolean;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  active: boolean;
  addedAt: string;
  permissions?: StaffDashboardPermissions;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole | 'System';
  actionType:
    | 'SALE_CREATED'
    | 'STOCK_UPDATED'
    | 'PRODUCT_ADDED'
    | 'PRODUCT_UPDATED'
    | 'PRODUCT_DELETED'
    | 'CATEGORY_UPDATED'
    | 'CREDIT_ADDED'
    | 'CREDIT_COLLECTED'
    | 'EXPENSE_LOGGED'
    | 'ECOMMERCE_SYNC'
    | 'SHEET_SYNC'
    | 'ROLE_UPDATED'
    | 'SHOP_CREATED'
    | 'SUBSCRIPTION_UPDATED';
  entityLabel: string;
  details: string;
}

export interface SeasonalMonthDatum {
  monthKey: string;
  monthLabelBn: string;
  monthLabelEn: string;
  sales: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  ordersCount: number;
  onTimeShippingPct: number;
  avgDispatchHours: number;
}

export type FilterDimension = 'category' | 'channel' | 'payment' | 'stockStatus' | 'period';

export interface ActiveFilterChip {
  id: string;
  dimension: FilterDimension;
  value: string;
  labelBn: string;
  labelEn: string;
}

export interface OfflineMutation {
  id: string;
  shopId?: string;
  createdAt: string;
  type: 'APPEND_SALE' | 'UPDATE_PRODUCTS' | 'UPDATE_CREDITS' | 'APPEND_EXPENSE' | 'APPEND_AUDIT' | 'FULL_SYNC';
  description: string;
  payload: unknown;
}

export interface SheetConnectionConfig {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  autoSync: boolean;
  lastSyncedAt: string | null;
  provisioningStatus?: 'connected' | 'pending_bridge' | 'unlinked';
}

export interface EcommerceCredentials {
  shopifyDomain: string;
  shopifyAccessToken: string;
  wooStoreUrl: string;
  wooConsumerKey: string;
  wooConsumerSecret: string;
  autoDeductStock: boolean;
}

export interface PosStoreState {
  shopId: string;
  shopNameBn: string;
  shopNameEn: string;
  businessType: string;
  address: string;
  phone: string;
  categories: ShopCategoryItem[];
  selectedYear: number;
  selectedMonthKey: string;
  products: Product[];
  sales: SaleTransaction[];
  credits: CustomerCredit[];
  expenses: ExpenseEntry[];
  ecommerceOrders: EcommerceOrder[];
  staff: StaffMember[];
  auditLogs: AuditLogEntry[];
  seasonalHistory: SeasonalMonthDatum[];
  sheetConfig: SheetConnectionConfig;
  ecommerceCredentials: EcommerceCredentials;
}

export type ShopSubscriptionPlan = 'Starter' | 'Business' | 'Enterprise' | 'Custom';
export type ShopAccountStatus = 'Active' | 'Trial' | 'Suspended';
export type SubscriptionPaymentStatus = 'Paid' | 'Pending' | 'Overdue' | 'Waived';

export interface ShopFeatureEntitlements {
  enableEcommerce: boolean;
  enableCreditLedger: boolean;
  enableAuditExports: boolean;
  maxStaffAccounts: number;
}

export interface SubscriptionInvoiceRecord {
  id: string;
  shopId: string;
  shopNameBn: string;
  shopNameEn: string;
  ownerEmail: string;
  plan: ShopSubscriptionPlan;
  monthKey: string;
  amount: number;
  status: SubscriptionPaymentStatus;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string;
  receiptNo: string;
  note: string;
}

export interface PlatformGoogleSheetsEngineConfig {
  appsScriptWebAppUrl: string;
  sharedSecret: string;
  masterDirectorySheetUrl: string;
  masterSpreadsheetId?: string;
  masterSpreadsheetTitle?: string;
  autoCreateSheetForNewShop: boolean;
  lastConnectedAt: string | null;
  lastMasterSyncedAt?: string | null;
}

export interface AdminCredentialVaultItem {
  userId: string;
  name: string;
  email: string;
  passwordPlain: string;
  role: UserRole;
  shopId: string | null;
  shopName: string;
  phone: string;
  active: boolean;
  allowedTabs: WorkspaceTab[];
  createdAt: string;
}

export interface ShopTenantSummary {
  shopId: string;
  shopNameBn: string;
  shopNameEn: string;
  businessType: string;
  address: string;
  phone: string;
  ownerName: string;
  ownerEmail: string;
  status: ShopAccountStatus;
  plan: ShopSubscriptionPlan;
  monthlySubscriptionFee: number;
  billingStatus: SubscriptionPaymentStatus;
  nextBillingDate: string;
  createdAt: string;
  entitlements: ShopFeatureEntitlements;
  sheetConfig: SheetConnectionConfig;
  metrics: {
    skuCount: number;
    outOfStockCount: number;
    lowStockCount: number;
    stockValue: number;
    monthlySales: number;
    monthlyGrossProfit: number;
    monthlyExpenses: number;
    monthlyNetProfit: number;
    totalSalesAllTime: number;
    totalReceivable: number;
    staffCount: number;
    salesCount: number;
  };
}

export interface SuperAdminOverviewResponse {
  superAdminProfile: {
    name: string;
    email: string;
  };
  globalAnnouncement: string;
  planPricing: Record<ShopSubscriptionPlan, number>;
  googleSheetsEngine: PlatformGoogleSheetsEngineConfig;
  credentialVault?: AdminCredentialVaultItem[];
  shops: ShopTenantSummary[];
  invoices: SubscriptionInvoiceRecord[];
  platformAuditLogs: Array<AuditLogEntry & { shopName?: string }>;
}

export interface AuthSessionUser {
  token: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  shopId: string | null;
  shopNameBn?: string;
  shopNameEn?: string;
  permissions?: StaffDashboardPermissions;
}
