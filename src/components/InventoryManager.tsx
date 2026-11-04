import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  FolderPlus,
  Package,
  PackagePlus,
  PackageX,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import {
  UserRole,
  type LanguageCode,
  type Product,
  type ShopCategoryItem,
  type StaffDashboardPermissions,
} from '../types/pos';
import {
  DEFAULT_SHOP_CATEGORIES,
  formatBDT,
  translateCategory,
  UI_TEXT,
} from '../i18n/translations';
import { exportInventoryCsv } from '../lib/exportReports';
import { AppPopupModal } from './AppPopupModal';

interface InventoryManagerProps {
  products: Product[];
  categories: ShopCategoryItem[];
  lang: LanguageCode;
  activeRole: UserRole;
  permissions?: StaffDashboardPermissions;
  onRestockProduct: (productId: string, addedQty: number, logWholesalePurchase: boolean) => void;
  onAddProduct: (newProd: Omit<Product, 'id' | 'soldThisMonth' | 'revenueThisMonth' | 'updatedAt'>) => void;
  onUpdateProduct: (updatedProduct: Product) => void;
  onDeleteProductRequest: (product: Product) => void;
  onUpdateCategories: (
    nextCategories: ShopCategoryItem[],
    renameRule?: { oldBn: string; newBn: string; newEn: string }
  ) => void;
}

export const InventoryManager: React.FC<InventoryManagerProps> = ({
  products,
  categories,
  lang,
  activeRole,
  permissions,
  onRestockProduct,
  onAddProduct,
  onUpdateProduct,
  onDeleteProductRequest,
  onUpdateCategories,
}) => {
  const t = UI_TEXT[lang];
  const activeCategories = categories.length > 0 ? categories : DEFAULT_SHOP_CATEGORIES;

  const canEditCatalog = permissions
    ? permissions.canEditInventory
    : activeRole === UserRole.OWNER ||
      activeRole === UserRole.SUPER_ADMIN ||
      activeRole === UserRole.MANAGER ||
      activeRole === UserRole.INVENTORY;
  const canDeleteSku = permissions
    ? permissions.canDeleteItems
    : activeRole === UserRole.OWNER || activeRole === UserRole.SUPER_ADMIN;
  const canSeeBuyPrice = permissions
    ? permissions.canViewProfit
    : activeRole !== UserRole.CASHIER;

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OUT' | 'LOW' | 'OK'>('ALL');
  const [restockModalProd, setRestockModalProd] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [logPurchaseExpense, setLogPurchaseExpense] = useState<boolean>(true);

  // Add Product Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newNameEn, setNewNameEn] = useState('');
  const [newNameBn, setNewNameBn] = useState('');
  const [newCategoryBn, setNewCategoryBn] = useState(activeCategories[0]?.bn || 'সাধারণ পণ্য');
  const [newBuyPrice, setNewBuyPrice] = useState('');
  const [newSellPrice, setNewSellPrice] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newMinStock, setNewMinStock] = useState('5');
  const [newUnit, setNewUnit] = useState('pcs');

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameBn, setEditNameBn] = useState('');
  const [editCategoryBn, setEditCategoryBn] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState('0');
  const [editSellPrice, setEditSellPrice] = useState('0');
  const [editStock, setEditStock] = useState('0');
  const [editMinStock, setEditMinStock] = useState('5');
  const [editUnit, setEditUnit] = useState('pcs');

  // Category Manager Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catInputBn, setCatInputBn] = useState('');
  const [catInputEn, setCatInputEn] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCatBn, setEditingCatBn] = useState('');
  const [editingCatEn, setEditingCatEn] = useState('');

  const outOfStockList = useMemo(() => products.filter((p) => p.stock === 0), [products]);
  const lowStockList = useMemo(
    () => products.filter((p) => p.stock > 0 && p.stock <= p.minStock),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
      if (statusFilter === 'OUT' && p.stock !== 0) return false;
      if (statusFilter === 'LOW' && !(p.stock > 0 && p.stock <= p.minStock)) return false;
      if (statusFilter === 'OK' && p.stock <= p.minStock) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.nameBn.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.categoryEn.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, categoryFilter, statusFilter]);

  const totalPurchaseValuation = useMemo(
    () => products.reduce((acc, p) => acc + p.buyPrice * p.stock, 0),
    [products]
  );

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setEditSku(prod.sku);
    setEditNameEn(prod.name);
    setEditNameBn(prod.nameBn || prod.name);
    setEditCategoryBn(prod.category);
    setEditBuyPrice(String(prod.buyPrice));
    setEditSellPrice(String(prod.sellPrice));
    setEditStock(String(prod.stock));
    setEditMinStock(String(prod.minStock));
    setEditUnit(prod.unit || 'pcs');
  };

  const handleConfirmRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModalProd || restockQty <= 0) return;
    onRestockProduct(restockModalProd.id, restockQty, logPurchaseExpense);
    setRestockModalProd(null);
    setRestockQty(10);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEn = newNameEn.trim() || newNameBn.trim();
    const cleanBn = newNameBn.trim() || newNameEn.trim();
    if (!cleanEn) return;

    const chosenCat =
      activeCategories.find((c) => c.bn === newCategoryBn) || {
        id: 'cat-custom',
        bn: newCategoryBn || 'সাধারণ পণ্য',
        en: newCategoryBn || 'General',
      };

    onAddProduct({
      sku: newSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      name: cleanEn,
      nameBn: cleanBn,
      category: chosenCat.bn,
      categoryEn: chosenCat.en,
      buyPrice: Math.max(0, Number(newBuyPrice) || 0),
      sellPrice: Math.max(0, Number(newSellPrice) || 0),
      stock: Math.max(0, Number(newStock) || 0),
      minStock: Math.max(1, Number(newMinStock) || 5),
      unit: newUnit || 'pcs',
    });
    setNewSku('');
    setNewNameEn('');
    setNewNameBn('');
    setNewBuyPrice('');
    setNewSellPrice('');
    setShowAddModal(false);
  };

  const handleSaveEditedProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    const cleanEn = editNameEn.trim() || editNameBn.trim();
    const cleanBn = editNameBn.trim() || editNameEn.trim();
    if (!cleanEn) return;

    const chosenCat =
      activeCategories.find((c) => c.bn === editCategoryBn) || {
        id: 'cat-custom',
        bn: editCategoryBn,
        en: editCategoryBn,
      };

    onUpdateProduct({
      ...editingProduct,
      sku: editSku.trim() || editingProduct.sku,
      name: cleanEn,
      nameBn: cleanBn,
      category: chosenCat.bn,
      categoryEn: chosenCat.en,
      buyPrice: Math.max(0, Number(editBuyPrice) || 0),
      sellPrice: Math.max(0, Number(editSellPrice) || 0),
      stock: Math.max(0, Number(editStock) || 0),
      minStock: Math.max(0, Number(editMinStock) || 0),
      unit: editUnit || 'pcs',
      updatedAt: new Date().toISOString(),
    });
    setEditingProduct(null);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const bn = catInputBn.trim() || catInputEn.trim();
    const en = catInputEn.trim() || catInputBn.trim();
    if (!bn) return;
    if (activeCategories.some((c) => c.bn === bn)) return;
    const next: ShopCategoryItem[] = [
      ...activeCategories,
      { id: `cat-${Date.now()}`, bn, en },
    ];
    onUpdateCategories(next);
    setNewCategoryBn(bn);
    setCatInputBn('');
    setCatInputEn('');
  };

  const handleSaveCategoryRename = (cat: ShopCategoryItem) => {
    const newBn = editingCatBn.trim() || editingCatEn.trim();
    const newEn = editingCatEn.trim() || editingCatBn.trim();
    if (!newBn) return;
    const next = activeCategories.map((c) =>
      c.id === cat.id ? { ...c, bn: newBn, en: newEn } : c
    );
    onUpdateCategories(next, { oldBn: cat.bn, newBn, newEn });
    setEditingCategoryId(null);
  };

  const handleDeleteCategory = (cat: ShopCategoryItem) => {
    if (activeCategories.length <= 1) return;
    const next = activeCategories.filter((c) => c.id !== cat.id);
    onUpdateCategories(next);
  };

  return (
    <div className="space-y-6">
      {/* Two Separate Automated Stock Alert Blocks: Out-of-Stock & Low-Stock */}
      {(outOfStockList.length > 0 || lowStockList.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Block 1: Out of Stock (Urgent Rose Card) */}
          <div className="neu-box rounded-2xl border border-rose-200/80 dark:border-rose-900/60 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-rose-50/90 via-rose-50/35 to-white dark:from-rose-950/45 dark:via-slate-900 dark:to-slate-900 border-b border-rose-100 dark:border-rose-900/50 px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100/90 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400">
                  <PackageX className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold leading-snug text-slate-900 dark:text-slate-100">
                    {lang === 'bn' ? 'স্টক আউট অ্যালার্ট' : 'Out of Stock Alert'}
                  </h2>
                  <p className="text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'বিক্রি সচল রাখতে এখনই নতুন মাল যোগ করুন'
                      : 'Replenish immediately to resume counter sales'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'OUT' ? 'ALL' : 'OUT')}
                className={`text-right rounded-xl px-2.5 sm:px-3 py-1.5 transition-colors shrink-0 cursor-pointer ${
                  statusFilter === 'OUT'
                    ? 'bg-rose-600 text-white'
                    : 'hover:bg-rose-100/70 dark:hover:bg-rose-950/60'
                }`}
              >
                <div
                  className={`text-xl sm:text-2xl font-bold font-mono tabular-nums leading-none ${
                    statusFilter === 'OUT' ? 'text-white' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {outOfStockList.length}
                </div>
                <div
                  className={`text-[11px] font-medium mt-0.5 whitespace-nowrap ${
                    statusFilter === 'OUT'
                      ? 'text-rose-100'
                      : 'text-rose-700/80 dark:text-rose-300/80'
                  }`}
                >
                  {statusFilter === 'OUT'
                    ? lang === 'bn'
                      ? 'সব দেখুন'
                      : 'Show all'
                    : lang === 'bn'
                    ? 'টি স্টক আউট'
                    : 'SKUs out'}
                </div>
              </button>
            </div>

            {outOfStockList.length === 0 ? (
              <div className="px-5 py-7 text-center flex flex-col items-center justify-center flex-1">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1.5" />
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {lang === 'bn'
                    ? 'কোনো পণ্য স্টক আউট নেই'
                    : 'All products currently have active stock'}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 px-3.5 sm:px-5 max-h-[272px] overflow-y-auto">
                {outOfStockList.map((p) => (
                  <div
                    key={p.id}
                    className="py-2.5 sm:py-3 flex items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100 break-words">
                        {lang === 'bn' ? p.nameBn || p.name : p.name}
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono tabular-nums leading-snug text-slate-500 dark:text-slate-400">
                        <span>{p.sku}</span>
                        <span className="mx-1.5">·</span>
                        <span className="text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
                          {lang === 'bn' ? 'স্টক' : 'Stock'}: 0
                        </span>
                        <span className="mx-1.5">·</span>
                        <span className="whitespace-nowrap">
                          {lang === 'bn' ? 'সর্বনিম্ন' : 'Min'}: {p.minStock}
                        </span>
                      </div>
                    </div>
                    {canEditCatalog && (
                      <button
                        type="button"
                        onClick={() => {
                          setRestockModalProd(p);
                          setRestockQty(Math.max(10, p.minStock * 2));
                        }}
                        className="min-h-[34px] px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        + {t.addStock}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Block 2: Low Stock (Warm Amber Card) */}
          <div className="neu-box rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-amber-50/90 via-amber-50/35 to-white dark:from-amber-950/45 dark:via-slate-900 dark:to-slate-900 border-b border-amber-100 dark:border-amber-900/50 px-3.5 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100/90 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold leading-snug text-slate-900 dark:text-slate-100">
                    {lang === 'bn' ? 'কম স্টক পণ্য' : 'Low Stock Warning'}
                  </h2>
                  <p className="text-[11px] sm:text-xs leading-snug text-slate-600 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'সর্বনিম্ন সীমার নিচে — শীঘ্রই মাল আনতে হবে'
                      : 'Running below minimum threshold — reorder soon'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'LOW' ? 'ALL' : 'LOW')}
                className={`text-right rounded-xl px-2.5 sm:px-3 py-1.5 transition-colors shrink-0 cursor-pointer ${
                  statusFilter === 'LOW'
                    ? 'bg-amber-600 text-white'
                    : 'hover:bg-amber-100/70 dark:hover:bg-amber-950/60'
                }`}
              >
                <div
                  className={`text-xl sm:text-2xl font-bold font-mono tabular-nums leading-none ${
                    statusFilter === 'LOW' ? 'text-white' : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {lowStockList.length}
                </div>
                <div
                  className={`text-[11px] font-medium mt-0.5 whitespace-nowrap ${
                    statusFilter === 'LOW'
                      ? 'text-amber-50'
                      : 'text-amber-800/80 dark:text-amber-300/80'
                  }`}
                >
                  {statusFilter === 'LOW'
                    ? lang === 'bn'
                      ? 'সব দেখুন'
                      : 'Show all'
                    : lang === 'bn'
                    ? 'টি কম স্টক'
                    : 'SKUs low'}
                </div>
              </button>
            </div>

            {lowStockList.length === 0 ? (
              <div className="px-5 py-7 text-center flex flex-col items-center justify-center flex-1">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mb-1.5" />
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {lang === 'bn'
                    ? 'কোনো পণ্য কম স্টকে নেই'
                    : 'No products are below minimum threshold'}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 px-3.5 sm:px-5 max-h-[272px] overflow-y-auto">
                {lowStockList.map((p) => (
                  <div
                    key={p.id}
                    className="py-2.5 sm:py-3 flex items-center justify-between gap-2.5 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100 break-words">
                        {lang === 'bn' ? p.nameBn || p.name : p.name}
                      </div>
                      <div className="mt-0.5 text-[11px] font-mono tabular-nums leading-snug text-slate-500 dark:text-slate-400">
                        <span>{p.sku}</span>
                        <span className="mx-1.5">·</span>
                        <span className="text-amber-700 dark:text-amber-400 font-semibold whitespace-nowrap">
                          {lang === 'bn' ? 'মজুদ' : 'Current'}: {p.stock}
                        </span>
                        <span className="mx-1.5">·</span>
                        <span className="whitespace-nowrap">
                          {lang === 'bn' ? 'সর্বনিম্ন' : 'Min'}: {p.minStock}
                        </span>
                      </div>
                    </div>
                    {canEditCatalog && (
                      <button
                        type="button"
                        onClick={() => {
                          setRestockModalProd(p);
                          setRestockQty(Math.max(6, p.minStock));
                        }}
                        className="min-h-[34px] px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold hover:bg-amber-100 dark:hover:bg-amber-900/50 active:scale-[0.99] transition-all whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        + {t.addStock}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventory & Category Controls Bar */}
      <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchProducts}
              className="w-full min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-medium"
          >
            <option value="ALL">{lang === 'bn' ? 'সব ক্যাটাগরি' : 'All Categories'}</option>
            {activeCategories.map((cat) => (
              <option key={cat.id} value={cat.bn}>
                {lang === 'bn' ? cat.bn : cat.en}
              </option>
            ))}
          </select>

          <div className="neu-well flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {(
              [
                ['ALL', lang === 'bn' ? 'সব' : 'All'],
                ['OUT', lang === 'bn' ? 'আউট' : 'Out'],
                ['LOW', lang === 'bn' ? 'কম' : 'Low'],
                ['OK', lang === 'bn' ? 'পর্যাপ্ত' : 'OK'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                  statusFilter === key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100'
                    : 'neu-flat text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full py-0.5">
          {canSeeBuyPrice && (
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400 mr-1 whitespace-nowrap shrink-0">
              {t.stockValue}: <strong>{formatBDT(totalPurchaseValuation)}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={() => exportInventoryCsv(products)}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5 shrink-0" />
            <span>CSV</span>
          </button>

          {canEditCatalog && (
            <>
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/50 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 whitespace-nowrap shrink-0"
              >
                <Tags className="h-3.5 w-3.5 shrink-0" />
                <span>{lang === 'bn' ? 'ক্যাটাগরি এডিট' : 'Categories'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewCategoryBn(activeCategories[0]?.bn || 'সাধারণ পণ্য');
                  setShowAddModal(true);
                }}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>{t.addNewProduct}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Fresh Shop Empty State OR High-Density Inventory Table */}
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center">
            <Package className="h-6 w-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {lang === 'bn'
                ? 'আপনার নতুন দোকানের ইনভেন্টরি এখনো খালি!'
                : 'Your Fresh Shop Inventory is Ready!'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'bn'
                ? 'প্রথমে আপনার ব্যবসার ক্যাটাগরি সাজিয়ে নিন অথবা সরাসরি নতুন পণ্য, ক্রয়মূল্য, বিক্রয়মূল্য ও স্টক যোগ করুন।'
                : 'Customize your product categories first or add your first SKU with buy price, sell price, and opening stock.'}
            </p>
          </div>
          {canEditCatalog && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <FolderPlus className="h-4 w-4 text-emerald-600" />
                <span>{lang === 'bn' ? 'ক্যাটাগরি যোগ / এডিট করুন' : 'Setup Categories'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="min-h-[42px] inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                <span>{lang === 'bn' ? 'প্রথম পণ্য যোগ করুন' : 'Add First Product'}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="pro-table">
              <thead>
                <tr>
                  <th className="min-w-[155px] text-left">
                    SKU · {lang === 'bn' ? 'পণ্যের নাম' : 'Product'}
                  </th>
                  <th className="w-32 text-left whitespace-nowrap">
                    {lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
                  </th>
                  {canSeeBuyPrice && (
                    <th className="w-24 text-right whitespace-nowrap">
                      {lang === 'bn' ? 'ক্রয়মূল্য' : 'Buy Price'}
                    </th>
                  )}
                  <th className="w-24 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'বিক্রয়মূল্য' : 'Sell Price'}
                  </th>
                  <th className="w-28 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'স্টক' : 'Stock'}
                  </th>
                  <th className="w-16 text-right whitespace-nowrap">
                    {lang === 'bn' ? 'ন্যূনতম' : 'Min'}
                  </th>
                  {canSeeBuyPrice && (
                    <th className="w-28 text-right whitespace-nowrap">
                      {lang === 'bn' ? 'স্টক মূল্য' : 'Valuation'}
                    </th>
                  )}
                  <th className="w-px text-right whitespace-nowrap">
                    {lang === 'bn' ? 'অ্যাকশন' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const isOut = p.stock === 0;
                  const isLow = p.stock > 0 && p.stock <= p.minStock;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                          {lang === 'bn' ? p.nameBn || p.name : p.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {p.sku} · Sold {p.soldThisMonth} {p.unit || 'pcs'}
                        </div>
                      </td>
                      <td className="text-slate-600 dark:text-slate-300">
                        {translateCategory(p.category, lang, activeCategories)}
                      </td>
                      {canSeeBuyPrice && (
                        <td className="text-right font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatBDT(p.buyPrice)}
                        </td>
                      )}
                      <td className="text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatBDT(p.sellPrice)}
                      </td>
                      <td
                        className={`text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                          isOut
                            ? 'text-red-600 dark:text-red-400'
                            : isLow
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {p.stock} {p.unit || 'pcs'} {isOut ? '(Out)' : isLow ? '(Low)' : ''}
                      </td>
                      <td className="text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {p.minStock}
                      </td>
                      {canSeeBuyPrice && (
                        <td className="text-right font-mono tabular-nums font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {formatBDT(p.buyPrice * p.stock)}
                        </td>
                      )}
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canEditCatalog && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setRestockModalProd(p);
                                  setRestockQty(10);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                              >
                                <PackagePlus className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                <span>+Stock</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditModal(p)}
                                className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                                title="Edit Product Name, Category & Price"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {canDeleteSku && (
                            <button
                              type="button"
                              onClick={() => onDeleteProductRequest(p)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                              aria-label="Delete product"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      <AppPopupModal
        isOpen={Boolean(restockModalProd)}
        onClose={() => setRestockModalProd(null)}
        maxWidthClass="max-w-3xl"
        heightMode="screen"
        ariaLabel={restockModalProd ? `${t.addStock}: ${restockModalProd.name}` : t.addStock}
      >
        {restockModalProd && (
          <form onSubmit={handleConfirmRestock} className="flex-1 min-h-0 flex flex-col text-xs">
            <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <PackagePlus className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {t.addStock}: {restockModalProd.name}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    SKU: {restockModalProd.sku} · Buy Cost: {formatBDT(restockModalProd.buyPrice)} /{' '}
                    {restockModalProd.unit || 'pcs'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestockModalProd(null)}
                aria-label="Close"
                className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4 space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="neu-well rounded-xl bg-slate-100/90 dark:bg-slate-950 p-3 min-w-0">
                  <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                    {lang === 'bn' ? 'বর্তমান স্টক' : 'Current Stock'}
                  </div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {restockModalProd.stock} {restockModalProd.unit || 'pcs'}
                  </div>
                </div>
                <div className="neu-well rounded-xl bg-emerald-50/75 dark:bg-emerald-950/35 p-3 min-w-0">
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 truncate whitespace-nowrap">
                    {lang === 'bn' ? 'নতুন যুক্ত হচ্ছে' : 'Adding Now'}
                  </div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    +{restockQty} {restockModalProd.unit || 'pcs'}
                  </div>
                </div>
                <div className="neu-well rounded-xl bg-slate-100/90 dark:bg-slate-950 p-3 min-w-0">
                  <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                    {lang === 'bn' ? 'মোট নতুন স্টক' : 'Updated Stock'}
                  </div>
                  <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {restockModalProd.stock + restockQty} {restockModalProd.unit || 'pcs'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'নতুন আমদানিকৃত পরিমাণ *' : 'Quantity Received *'}
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full min-h-[42px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono tabular-nums text-sm font-bold"
                />
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
                  {[5, 10, 25, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setRestockQty(preset)}
                      className={`min-h-[32px] px-3 rounded-lg text-xs font-mono font-semibold whitespace-nowrap shrink-0 ${
                        restockQty === preset
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      +{preset} {restockModalProd.unit || 'pcs'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={logPurchaseExpense}
                  onChange={(e) => setLogPurchaseExpense(e.target.checked)}
                  className="h-4 w-4 mt-0.5 shrink-0 rounded border-slate-300 text-emerald-600"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'bn'
                      ? `মালামাল ক্রয় খাতে ${formatBDT(restockModalProd.buyPrice * restockQty)} যোগ করুন`
                      : `Record wholesale purchase (${formatBDT(restockModalProd.buyPrice * restockQty)})`}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {lang === 'bn'
                      ? 'চেক করা থাকলে এই মাসের মালামাল ক্রয় ও খরচের হিসাবে স্বয়ংক্রিয়ভাবে যুক্ত হবে।'
                      : 'Automatically logs wholesale stock purchase value in your monthly ledger.'}
                  </p>
                </div>
              </label>
            </div>

            <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRestockModalProd(null)}
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

      {/* Add New Product Modal */}
      <AppPopupModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        maxWidthClass="max-w-5xl"
        heightMode="screen"
        ariaLabel={t.addNewProduct}
      >
        <form onSubmit={handleCreateProduct} className="flex-1 min-h-0 flex flex-col text-xs">
          <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Plus className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
                  {t.addNewProduct}
                </h3>
                <p className="text-[11px] leading-snug text-slate-500">
                  {lang === 'bn'
                    ? 'পণ্যের নাম, ক্যাটাগরি, ক্রয়মূল্য, বিক্রয়মূল্য ও প্রারম্ভিক স্টক নির্ধারণ করুন'
                    : 'Enter product names, category, pricing, and opening inventory stock'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
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
                  Product Name (English) *
                </label>
                <input
                  type="text"
                  required={!newNameBn.trim()}
                  value={newNameEn}
                  onChange={(e) => setNewNameEn(e.target.value)}
                  placeholder="e.g., Miniket Rice 5kg"
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  পণ্যের নাম (বাংলা)
                </label>
                <input
                  type="text"
                  value={newNameBn}
                  onChange={(e) => setNewNameBn(e.target.value)}
                  placeholder="যেমন: মিনিকেট চাল ৫ কেজি"
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  SKU / Barcode
                </label>
                <input
                  type="text"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="Auto if empty"
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  Category
                </label>
                <select
                  value={newCategoryBn}
                  onChange={(e) => setNewCategoryBn(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-medium"
                >
                  {activeCategories.map((cat) => (
                    <option key={cat.id} value={cat.bn}>
                      {cat.bn} ({cat.en})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  Buy Price (৳) *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newBuyPrice}
                  onChange={(e) => setNewBuyPrice(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  Sell Price (৳) *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newSellPrice}
                  onChange={(e) => setNewSellPrice(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-semibold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                  Opening Stock *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Min Stock *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Unit
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2"
                  >
                    <option value="pcs">pcs</option>
                    <option value="kg">kg</option>
                    <option value="ltr">ltr</option>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="set">set</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="neu-well rounded-xl bg-slate-100/90 dark:bg-slate-950 p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                  {lang === 'bn' ? 'প্রতি পিসে সম্ভাব্য লাভ' : 'Profit Per Unit'}
                </div>
                <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatBDT((Number(newSellPrice) || 0) - (Number(newBuyPrice) || 0))}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                  {lang === 'bn' ? 'মোট প্রারম্ভিক স্টক মূল্য' : 'Opening Stock Valuation'}
                </div>
                <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatBDT((Number(newBuyPrice) || 0) * (Number(newStock) || 0))}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                  {lang === 'bn' ? 'সম্ভাব্য মোট বিক্রয় মূল্য' : 'Retail Stock Value'}
                </div>
                <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  {formatBDT((Number(newSellPrice) || 0) * (Number(newStock) || 0))}
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
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

      {/* Full Edit Product Modal (Edit Name, Category, Buy/Sell Price, Stock, SKU, Unit) */}
      <AppPopupModal
        isOpen={Boolean(editingProduct)}
        onClose={() => setEditingProduct(null)}
        maxWidthClass="max-w-5xl"
        heightMode="screen"
        ariaLabel={
          lang === 'bn' ? 'পণ্যের তথ্য ও ক্যাটাগরি এডিট করুন' : 'Edit Product Details & Category'
        }
      >
        {editingProduct && (
          <form onSubmit={handleSaveEditedProduct} className="flex-1 min-h-0 flex flex-col text-xs">
            <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400 flex items-center justify-center shrink-0">
                  <Edit3 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {lang === 'bn'
                      ? 'পণ্যের তথ্য ও ক্যাটাগরি এডিট করুন'
                      : 'Edit Product Details & Category'}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    {editingProduct.sku} · {editingProduct.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
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
                    Product Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editNameEn}
                    onChange={(e) => setEditNameEn(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    পণ্যের নাম (বাংলা) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editNameBn}
                    onChange={(e) => setEditNameBn(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    SKU / Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Category
                  </label>
                  <select
                    value={editCategoryBn}
                    onChange={(e) => setEditCategoryBn(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-medium"
                  >
                    {activeCategories.map((cat) => (
                      <option key={cat.id} value={cat.bn}>
                        {cat.bn} ({cat.en})
                      </option>
                    ))}
                  </select>
                </div>
                {canSeeBuyPrice && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Buy Price (৳) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={editBuyPrice}
                      onChange={(e) => setEditBuyPrice(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-semibold"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Sell Price (৳) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editSellPrice}
                    onChange={(e) => setEditSellPrice(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                    Current Stock *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Min Stock *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={editMinStock}
                      onChange={(e) => setEditMinStock(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate">
                      Unit
                    </label>
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-2"
                    >
                      <option value="pcs">pcs</option>
                      <option value="kg">kg</option>
                      <option value="ltr">ltr</option>
                      <option value="pack">pack</option>
                      <option value="box">box</option>
                      <option value="set">set</option>
                    </select>
                  </div>
                </div>
              </div>

              {canSeeBuyPrice && (
                <div className="neu-well rounded-xl bg-slate-100/90 dark:bg-slate-950 p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                      {lang === 'bn' ? 'একক লাভ' : 'Unit Margin'}
                    </div>
                    <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatBDT((Number(editSellPrice) || 0) - (Number(editBuyPrice) || 0))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                      {lang === 'bn' ? 'ক্রয় স্টক মূল্য' : 'Cost Valuation'}
                    </div>
                    <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatBDT((Number(editBuyPrice) || 0) * (Number(editStock) || 0))}
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <div className="text-[11px] text-slate-500 truncate whitespace-nowrap">
                      {lang === 'bn' ? 'বিক্রয় স্টক মূল্য' : 'Retail Valuation'}
                    </div>
                    <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatBDT((Number(editSellPrice) || 0) * (Number(editStock) || 0))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold whitespace-nowrap"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                {lang === 'bn' ? 'আপডেট সংরক্ষণ করুন' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </AppPopupModal>

      {/* Manage Categories Modal (Add, Rename, Delete Categories) */}
      <AppPopupModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        maxWidthClass="max-w-4xl"
        heightMode="screen"
        ariaLabel={
          lang === 'bn' ? 'দোকানের ক্যাটাগরি পরিচালনা' : 'Manage Shop Product Categories'
        }
      >
        <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Tags className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {lang === 'bn' ? 'দোকানের ক্যাটাগরি পরিচালনা' : 'Manage Shop Product Categories'}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {lang === 'bn'
                  ? 'নতুন ক্যাটাগরি যোগ বা নাম পরিবর্তন করুন'
                  : 'Add, rename, or remove POS categories'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCategoryModal(false)}
            aria-label="Close"
            className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4 gap-3.5 text-xs">
          <form
            onSubmit={handleAddCategory}
            className="shrink-0 grid grid-cols-1 sm:grid-cols-5 gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 p-3"
          >
            <input
              type="text"
              placeholder="ক্যাটাগরি (বাংলা)"
              value={catInputBn}
              onChange={(e) => setCatInputBn(e.target.value)}
              className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5"
            />
            <input
              type="text"
              placeholder="Category (English)"
              value={catInputEn}
              onChange={(e) => setCatInputEn(e.target.value)}
              className="sm:col-span-2 min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5"
            />
            <button
              type="submit"
              className="min-h-[38px] rounded-xl bg-emerald-600 text-white font-bold px-3.5 py-1.5 hover:bg-emerald-700 whitespace-nowrap"
            >
              + Add Category
            </button>
          </form>

          <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 px-3.5">
            {activeCategories.map((cat) => (
              <div key={cat.id} className="py-2.5 flex items-center justify-between gap-2">
                {editingCategoryId === cat.id ? (
                  <div className="flex-1 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={editingCatBn}
                      onChange={(e) => setEditingCatBn(e.target.value)}
                      className="flex-1 min-w-[120px] min-h-[34px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1"
                    />
                    <input
                      type="text"
                      value={editingCatEn}
                      onChange={(e) => setEditingCatEn(e.target.value)}
                      className="flex-1 min-w-[120px] min-h-[34px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveCategoryRename(cat)}
                      className="min-h-[34px] rounded-lg bg-emerald-600 px-3 py-1 text-white font-semibold whitespace-nowrap"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {cat.bn}
                      </span>
                      <span className="text-slate-500"> · {cat.en}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setEditingCatBn(cat.bn);
                          setEditingCatEn(cat.en);
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      {activeCategories.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 font-mono whitespace-nowrap">
            {activeCategories.length} categories configured
          </span>
          <button
            type="button"
            onClick={() => setShowCategoryModal(false)}
            className="min-h-[38px] px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white font-bold whitespace-nowrap"
          >
            {lang === 'bn' ? 'সম্পন্ন' : 'Done'}
          </button>
        </div>
      </AppPopupModal>
    </div>
  );
};
