import type { LanguageCode, ShopCategoryItem } from '../types/pos';

export const DEFAULT_SHOP_CATEGORIES: ShopCategoryItem[] = [
  { id: 'cat-1', bn: 'হোম অ্যাপ্লায়েন্স', en: 'Home Appliances' },
  { id: 'cat-2', bn: 'মোবাইল ফোন', en: 'Mobile Phones' },
  { id: 'cat-3', bn: 'মোবাইল এক্সেসরিজ', en: 'Mobile Accessories' },
  { id: 'cat-4', bn: 'কম্পিউটার এক্সেসরিজ', en: 'Computer Accessories' },
  { id: 'cat-5', bn: 'লাইট ও ইলেকট্রিক', en: 'Light & Electric' },
  { id: 'cat-6', bn: 'অডিও/স্পিকার', en: 'Audio & Speakers' },
  { id: 'cat-7', bn: 'গ্যাজেট/স্মার্ট ডিভাইস', en: 'Gadgets & Smart Devices' },
  { id: 'cat-8', bn: 'অন্যান্য', en: 'Others' },
];

export const CATEGORY_MAP: Record<string, { bn: string; en: string }> = {
  'হোম অ্যাপ্লায়েন্স': { bn: 'হোম অ্যাপ্লায়েন্স', en: 'Home Appliances' },
  'মোবাইল ফোন': { bn: 'মোবাইল ফোন', en: 'Mobile Phones' },
  'মোবাইল এক্সেসরিজ': { bn: 'মোবাইল এক্সেসরিজ', en: 'Mobile Accessories' },
  'কম্পিউটার এক্সেসরিজ': { bn: 'কম্পিউটার এক্সেসরিজ', en: 'Computer Accessories' },
  'লাইট ও ইলেকট্রিক': { bn: 'লাইট ও ইলেকট্রিক', en: 'Light & Electric' },
  'অডিও/স্পিকার': { bn: 'অডিও/স্পিকার', en: 'Audio & Speakers' },
  'গ্যাজেট/স্মার্ট ডিভাইস': { bn: 'গ্যাজেট/স্মার্ট ডিভাইস', en: 'Gadgets & Smart Devices' },
  'অন্যান্য': { bn: 'অন্যান্য', en: 'Others' },
};

export function translateCategory(
  categoryBn: string,
  lang: LanguageCode,
  customCategories?: ShopCategoryItem[]
): string {
  if (customCategories && customCategories.length > 0) {
    const found = customCategories.find((c) => c.bn === categoryBn || c.en === categoryBn);
    if (found) {
      return lang === 'bn' ? found.bn : found.en || found.bn;
    }
  }
  const entry = CATEGORY_MAP[categoryBn];
  if (!entry) return categoryBn;
  return lang === 'bn' ? entry.bn : entry.en;
}

export function formatBDT(amount: number, _lang: LanguageCode = 'bn'): string {
  const isNegative = amount < 0;
  const rounded = Math.round(Math.abs(amount));
  const formatted = rounded.toLocaleString('en-US');
  return `${isNegative ? '-' : ''}৳${formatted}`;
}

export function formatPct(val: number): string {
  return `${val.toFixed(1)}%`;
}

export const UI_TEXT = {
  bn: {
    brandTitle: 'MHS POS',
    shopSubtitle: 'স্মার্ট মাল্টি-শপ রিটেইল ও গুগল শিট ইনভেন্টরি সিস্টেম',
    navDashboard: 'সারাংশ ও ট্রেন্ড',
    navPos: 'পস কাউন্টার (বিক্রি)',
    navSalesHistory: 'বিক্রয় ইতিহাস',
    navInventory: 'পণ্য ও ক্যাটাগরি',
    navCreditExpenses: 'বাকির খাতা ও খরচ',
    navEcommerce: 'ই-কমার্স ও শিপিং',
    navReportsAdmin: 'স্টাফ ও রিপোর্ট',
    connectSheet: 'গুগল শিট ডাটাবেস',
    sheetConnected: 'শিট সংযুক্ত',
    syncNow: 'এখনই সিঙ্ক করুন',
    signOut: 'লগ আউট',
    offlineBanner: 'অফলাইন মোড সক্রিয় — বিক্রি ও স্টক লোকাল ক্যাশে সেভ হচ্ছে, ইন্টারনেট এলে স্বয়ংক্রিয় সিঙ্ক হবে।',
    pendingQueue: 'অপেক্ষমাণ সিঙ্ক',
    monthlySales: 'এই মাসের মোট বিক্রি',
    grossProfit: 'মোট লাভ (গ্রস)',
    totalExpenses: 'মোট খরচ (ব্যয়)',
    netProfit: 'নিট লাভ',
    todaySales: 'আজকের বিক্রি',
    stockValue: 'বর্তমান স্টকের মূল্য',
    outOfStock: 'স্টক আউট পণ্য',
    lowStock: 'কম স্টক পণ্য',
    dragFilterTitle: 'ড্র্যাগ-অ্যান্ড-ড্রপ ফিল্টার স্টুডিও',
    dragFilterHint: 'নিচের যেকোনো ফিল্টার টেনে এখানে ছাড়ুন অথবা ট্যাপ করে চার্ট ও হিসাব ফিল্টার করুন',
    dropHere: 'ফিল্টার এখানে ড্রপ করুন',
    resetFilters: 'সব ফিল্টার মুছুন',
    dailySalesChart: 'প্রতিদিনের বিক্রি ও লাভ',
    seasonalChart: 'মাসভিত্তিক ও সিজনাল বিক্রির ট্রেন্ড',
    categorySalesTitle: 'ক্যাটাগরি অনুযায়ী বিক্রি ও লাভ',
    topProductsTitle: 'সবচেয়ে বেশি বিক্রিত পণ্য (পিস অনুযায়ী)',
    expenseBreakdownTitle: 'এই মাসের খরচ — খাতভিত্তিক',
    shippingEfficiencyTitle: 'শিপিং দক্ষতা ও অর্ডার ডেলিভারি পারফরম্যান্স',
    searchProducts: 'পণ্যের নাম, ক্যাটাগরি বা SKU দিয়ে খুঁজুন...',
    cartTitle: 'বিক্রির কার্ট / রশিদ',
    emptyCart: 'কার্টে কোনো পণ্য নেই। বাম পাশ থেকে পণ্যে ট্যাপ করুন।',
    completeSale: 'বিক্রি সম্পন্ন ও রশিদ প্রিন্ট করুন',
    discount: 'ডিসকাউন্ট (৳)',
    serviceIncome: 'সার্ভিসিং / অতিরিক্ত চার্জ (৳)',
    paymentMethod: 'পেমেন্ট মাধ্যম',
    customerName: 'ক্রেতার নাম',
    customerPhone: 'মোবাইল নম্বর',
    paidAmount: 'জমা টাকা (৳)',
    dueAmount: 'বাকি টাকা (৳)',
    addStock: 'স্টক যোগ করুন',
    addNewProduct: 'নতুন পণ্য যোগ',
    collectDue: 'বাকি আদায়',
    addExpense: 'খরচ / আয় যোগ করুন',
    exportPdf: 'অডিট PDF / প্রিন্ট রিপোর্ট',
    exportCsv: 'CSV এক্সপোর্ট',
    roleLabel: 'বর্তমান রোল',
    confirmAction: 'নিশ্চিত করুন',
    cancel: 'বাতিল করুন',
    collaboratorsOnline: 'সক্রিয় ব্যবহারকারী',
    importCsvBtn: 'CSV ডেটাসেট রিলোড',
  },
  en: {
    brandTitle: 'MHS POS',
    shopSubtitle: 'Multi-Shop Retail POS & Google Sheets Cloud Suite',
    navDashboard: 'Analytics',
    navPos: 'POS Register',
    navSalesHistory: 'Sales History',
    navInventory: 'Inventory & Categories',
    navCreditExpenses: 'Dues & Expenses',
    navEcommerce: 'E-Commerce',
    navReportsAdmin: 'Staff & Reports',
    connectSheet: 'Google Sheet DB',
    sheetConnected: 'Sheet Linked',
    syncNow: 'Sync Now',
    signOut: 'Log Out',
    offlineBanner: 'Offline Mode Active — Sales and stock updates are queued locally and auto-sync when online.',
    pendingQueue: 'Queued Updates',
    monthlySales: 'Monthly Total Sales',
    grossProfit: 'Gross Profit',
    totalExpenses: 'Operating Expenses',
    netProfit: 'Net Profit',
    todaySales: "Today's Sales",
    stockValue: 'Current Stock Value',
    outOfStock: 'Out of Stock',
    lowStock: 'Low Stock Alerts',
    dragFilterTitle: 'Drag-and-Drop Filter Studio',
    dragFilterHint: 'Drag any dimension token into the active filter zone or tap to slice all charts and KPIs',
    dropHere: 'Drop filter token here',
    resetFilters: 'Reset Filters',
    dailySalesChart: 'Daily Sales & Gross Profit',
    seasonalChart: 'Seasonal & Monthly Revenue Trends',
    categorySalesTitle: 'Sales & Profit Share by Category',
    topProductsTitle: 'Top Best-Selling Products (By Units)',
    expenseBreakdownTitle: 'Monthly Operating Expenses by Head',
    shippingEfficiencyTitle: 'Shipping Efficiency & Order Fulfillment Metrics',
    searchProducts: 'Search by product name, SKU, or category...',
    cartTitle: 'Current Register Cart',
    emptyCart: 'No items in cart. Tap any product tile to add.',
    completeSale: 'Complete Sale & Print Receipt',
    discount: 'Discount (৳)',
    serviceIncome: 'Servicing / Extra Fee (৳)',
    paymentMethod: 'Payment Method',
    customerName: 'Customer Name',
    customerPhone: 'Mobile Number',
    paidAmount: 'Amount Paid (৳)',
    dueAmount: 'Balance Due (৳)',
    addStock: 'Restock SKU',
    addNewProduct: 'Add New Product',
    collectDue: 'Collect Due',
    addExpense: 'Log Expense / Income',
    exportPdf: 'Audit PDF / Print Report',
    exportCsv: 'Export CSV',
    roleLabel: 'Active Role',
    confirmAction: 'Confirm',
    cancel: 'Cancel',
    collaboratorsOnline: 'Active Staff',
    importCsvBtn: 'Reload Uploaded CSV',
  },
} as const;
