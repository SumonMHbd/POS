import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Minus,
  PackagePlus,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import {
  PaymentMethod,
  SalesChannel,
  type CustomerCredit,
  type LanguageCode,
  type Product,
  type SaleLineItem,
  type SaleTransaction,
  type ShopCategoryItem,
} from '../types/pos';
import {
  DEFAULT_SHOP_CATEGORIES,
  formatBDT,
  translateCategory,
  UI_TEXT,
} from '../i18n/translations';
import { AppPopupModal } from './AppPopupModal';

interface PosTerminalProps {
  products: Product[];
  categories: ShopCategoryItem[];
  credits: CustomerCredit[];
  lang: LanguageCode;
  cashierName: string;
  onCompleteSale: (
    sale: SaleTransaction,
    newCreditCustomer?: { name: string; phone: string }
  ) => void;
  onGoToInventory?: () => void;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  products,
  categories,
  credits,
  lang,
  cashierName,
  onCompleteSale,
  onGoToInventory,
}) => {
  const t = UI_TEXT[lang];
  const activeCategories = categories.length > 0 ? categories : DEFAULT_SHOP_CATEGORIES;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState<number>(0);
  const [serviceFee, setServiceFee] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [channel] = useState<SalesChannel>(SalesChannel.WALK_IN);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [customCustomerPhone, setCustomCustomerPhone] = useState('');
  const [paidInput, setPaidInput] = useState<string>('');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const paymentDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!paymentMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (paymentDropdownRef.current && !paymentDropdownRef.current.contains(e.target as Node)) {
        setPaymentMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaymentMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [paymentMenuOpen]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.nameBn.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  const cartItems: Array<{ product: Product; qty: number; subtotal: number; profit: number }> =
    useMemo(() => {
      const list: Array<{ product: Product; qty: number; subtotal: number; profit: number }> = [];
      for (const [productId, qty] of Object.entries(cart)) {
        if (qty <= 0) continue;
        const prod = products.find((p) => p.id === productId);
        if (!prod) continue;
        const subtotal = prod.sellPrice * qty;
        const profit = (prod.sellPrice - prod.buyPrice) * qty;
        list.push({ product: prod, qty, subtotal, profit });
      }
      return list;
    }, [cart, products]);

  const subtotal = cartItems.reduce((acc, i) => acc + i.subtotal, 0);
  const totalProfitFromItems = cartItems.reduce((acc, i) => acc + i.profit, 0);
  const grandTotal = Math.max(0, subtotal - discount + serviceFee);
  const effectiveGrossProfit = totalProfitFromItems - discount + serviceFee;

  const isCreditMode = paymentMethod === PaymentMethod.CREDIT;
  const numericPaid =
    paidInput.trim() === ''
      ? isCreditMode
        ? 0
        : grandTotal
      : Math.max(0, Math.min(grandTotal, Number(paidInput) || 0));
  const dueAmount = Math.max(0, grandTotal - numericPaid);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const current = prev[product.id] || 0;
      if (current >= product.stock) return prev;
      return { ...prev, [product.id]: current + 1 };
    });
  };

  const toggleProductSelection = (product: Product) => {
    setCart((prev) => {
      if ((prev[product.id] || 0) > 0) {
        const clone = { ...prev };
        delete clone[product.id];
        return clone;
      }
      if (product.stock <= 0) return prev;
      return { ...prev, [product.id]: 1 };
    });
  };

  const updateCartQty = (product: Product, delta: number) => {
    setCart((prev) => {
      const next = (prev[product.id] || 0) + delta;
      if (next <= 0) {
        const clone = { ...prev };
        delete clone[product.id];
        return clone;
      }
      if (next > product.stock) return prev;
      return { ...prev, [product.id]: next };
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const exactSku = products.find(
        (p) => p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (exactSku && exactSku.stock > 0) {
        addToCart(exactSku);
        setSearchQuery('');
      }
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;

    const existingCust = credits.find((c) => c.id === selectedCustomerId);
    const resolvedCustomerName = existingCust
      ? existingCust.name
      : customCustomerName.trim() || undefined;
    const resolvedCustomerPhone = existingCust
      ? existingCust.phone
      : customCustomerPhone.trim() || undefined;

    if (dueAmount > 0 && !resolvedCustomerName) {
      return;
    }

    const now = new Date();
    const dateIso = now.toISOString().slice(0, 10);
    const monthKey = dateIso.slice(0, 7);

    const lineItems: SaleLineItem[] = cartItems.map((ci) => ({
      productId: ci.product.id,
      sku: ci.product.sku,
      name: ci.product.name,
      category: ci.product.category,
      quantity: ci.qty,
      unitPrice: ci.product.sellPrice,
      buyPrice: ci.product.buyPrice,
      subtotal: ci.subtotal,
      profit: ci.profit,
    }));

    const sale: SaleTransaction = {
      id: `sale-${Date.now()}`,
      invoiceNo: `INV-${dateIso.replace(/-/g, '').slice(2)}-${Math.floor(100 + Math.random() * 900)}`,
      date: dateIso,
      timestamp: now.toISOString(),
      monthKey,
      channel,
      paymentMethod: dueAmount > 0 ? PaymentMethod.CREDIT : paymentMethod,
      items: lineItems,
      subtotal,
      discount,
      serviceFee,
      totalAmount: grandTotal,
      grossProfit: effectiveGrossProfit,
      paidAmount: numericPaid,
      dueAmount,
      customerId: existingCust?.id,
      customerName: resolvedCustomerName,
      customerPhone: resolvedCustomerPhone,
      cashierName,
    };

    const newCustomer =
      dueAmount > 0 && !existingCust && resolvedCustomerName
        ? { name: resolvedCustomerName, phone: resolvedCustomerPhone || '' }
        : undefined;

    onCompleteSale(sale, newCustomer);

    setCart({});
    setDiscount(0);
    setServiceFee(0);
    setPaidInput('');
    setSelectedCustomerId('');
    setCustomCustomerName('');
    setCustomCustomerPhone('');
    setMobileCartOpen(false);
  };

  const missingCreditCustomer =
    dueAmount > 0 && !selectedCustomerId && !customCustomerName.trim();

  const paymentOptions: Array<{
    method: PaymentMethod;
    labelBn: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      method: PaymentMethod.CASH,
      labelBn: 'নগদ (Cash)',
      labelEn: 'Cash',
      icon: Banknote,
    },
    {
      method: PaymentMethod.MOBILE_BANKING,
      labelBn: 'বিকাশ / নগদ',
      labelEn: 'bKash / Nagad',
      icon: Smartphone,
    },
    {
      method: PaymentMethod.CREDIT,
      labelBn: 'বাকি (Due)',
      labelEn: 'Credit Due',
      icon: Wallet,
    },
    {
      method: PaymentMethod.CARD,
      labelBn: 'কার্ড / ব্যাংক',
      labelEn: 'Card / Bank',
      icon: CreditCard,
    },
  ];

  const selectedPaymentOption =
    paymentOptions.find((opt) => opt.method === paymentMethod) || paymentOptions[0];
  const SelectedPaymentIcon = selectedPaymentOption.icon;

  const renderCartContent = (isMobilePopup = false) => (
    <div className={`flex flex-col ${isMobilePopup ? 'flex-1 min-h-0 overflow-hidden' : 'h-full'}`}>
      <div
        className={`shrink-0 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 ${
          isMobilePopup
            ? 'bg-slate-50/80 dark:bg-slate-900/95 px-3.5 py-2.5'
            : 'pb-2.5'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShoppingCart className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
            {lang === 'bn' ? 'ক্যাশ মেমো / বিল' : 'Counter Bill'}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={() => setCart({})}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span>{lang === 'bn' ? 'সব মুছুন' : 'Clear'}</span>
            </button>
          )}
          {isMobilePopup && (
            <button
              type="button"
              onClick={() => setMobileCartOpen(false)}
              aria-label="Close bill popup"
              className="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div
        className={
          isMobilePopup
            ? 'flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 space-y-2.5'
            : 'contents'
        }
      >
        {/* Line Items */}
        <div
          className={`space-y-2 ${
            isMobilePopup
              ? 'py-1'
              : 'flex-1 overflow-y-auto py-1.5 max-h-[250px] lg:max-h-[300px]'
          }`}
        >
        {cartItems.length === 0 ? (
          <div className="py-3 text-center space-y-1">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.emptyCart}
            </div>
            <div className="text-[11px] text-slate-400">
              {lang === 'bn'
                ? 'পণ্যে ক্লিক করে সিলেক্ট করুন, আবার ক্লিক করে বাদ দিন'
                : 'Click a product to select, or click again to deselect'}
            </div>
          </div>
        ) : (
          cartItems.map(({ product, qty, subtotal: lineSub }) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 break-words">
                  {lang === 'bn' ? product.nameBn || product.name : product.name}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-slate-500 whitespace-nowrap mt-0.5">
                  {formatBDT(product.sellPrice)} × {qty}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => updateCartQty(product, -1)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-5 text-center text-xs font-mono tabular-nums font-bold">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => updateCartQty(product, 1)}
                  disabled={qty >= product.stock}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              <div className="w-20 text-right text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
                {formatBDT(lineSub)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Easy 1-Tap Payment & Checkout Controls */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-2.5 space-y-2.5 text-xs">
        {/* Custom Animated Payment Method Dropdown */}
        <div ref={paymentDropdownRef} className="relative">
          <span className="block text-[11px] font-semibold text-slate-500 mb-1 truncate whitespace-nowrap">
            {t.paymentMethod}
          </span>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={paymentMenuOpen}
            onClick={() => setPaymentMenuOpen((prev) => !prev)}
            className="w-full min-h-[38px] flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
          >
            <span className="flex items-center gap-2 min-w-0">
              <SelectedPaymentIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate whitespace-nowrap">
                {lang === 'bn' ? selectedPaymentOption.labelBn : selectedPaymentOption.labelEn}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-300 ${
                paymentMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {paymentMenuOpen && (
            <div
              role="listbox"
              className="animate-dropdown-pop neu-popup-card absolute left-0 right-0 z-30 mt-1.5 rounded-xl border bg-white dark:bg-slate-900 p-1.5 space-y-1"
            >
              {paymentOptions.map((opt) => {
                const OptIcon = opt.icon;
                const active = opt.method === paymentMethod;
                return (
                  <button
                    key={opt.method}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setPaymentMethod(opt.method);
                      if (opt.method === PaymentMethod.CREDIT) {
                        setPaidInput('0');
                      } else {
                        setPaidInput('');
                      }
                      setPaymentMenuOpen(false);
                    }}
                    className={`w-full min-h-[34px] flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap ${
                      active
                        ? 'bg-emerald-600 text-white'
                        : 'neu-flat text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <OptIcon
                        className={`h-3.5 w-3.5 shrink-0 ${
                          active ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      />
                      <span className="truncate">{lang === 'bn' ? opt.labelBn : opt.labelEn}</span>
                    </span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Discount & Extra Charge */}
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-500 mb-1 truncate whitespace-nowrap">{t.discount}</label>
            <input
              type="number"
              min={0}
              value={discount || ''}
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-500 mb-1 truncate whitespace-nowrap">{t.serviceIncome}</label>
            <input
              type="number"
              min={0}
              value={serviceFee || ''}
              onChange={(e) => setServiceFee(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Paid vs Due Split */}
        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-500 mb-1 truncate whitespace-nowrap">{t.paidAmount}</label>
            <input
              type="number"
              min={0}
              max={grandTotal}
              value={paidInput}
              placeholder={String(isCreditMode ? 0 : grandTotal)}
              onChange={(e) => setPaidInput(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-[11px] text-slate-500 mb-1 truncate whitespace-nowrap">{t.dueAmount}</label>
            <div
              className={`w-full rounded-xl border px-2.5 py-1.5 font-mono tabular-nums font-bold truncate whitespace-nowrap ${
                dueAmount > 0
                  ? 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300'
              }`}
            >
              {formatBDT(dueAmount)}
            </div>
          </div>
        </div>

        {(dueAmount > 0 || selectedCustomerId || customCustomerName) && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/25 p-2.5 space-y-1.5 animate-dropdown-pop">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900 dark:text-amber-300 min-w-0">
              <UserPlus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate whitespace-nowrap">
                {lang === 'bn'
                  ? 'বাকিদার ক্রেতার নাম নির্বাচন বা যোগ করুন *'
                  : 'Select or Enter Credit Customer *'}
              </span>
            </div>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full min-h-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs"
            >
              <option value="">{lang === 'bn' ? '— নতুন ক্রেতা লিখুন —' : '— New Customer —'}</option>
              {credits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone}) — Due {formatBDT(c.balanceDue)}
                </option>
              ))}
            </select>

            {!selectedCustomerId && (
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  placeholder={t.customerName}
                  value={customCustomerName}
                  onChange={(e) => setCustomCustomerName(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs"
                />
                <input
                  type="text"
                  placeholder={t.customerPhone}
                  value={customCustomerPhone}
                  onChange={(e) => setCustomCustomerPhone(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            )}
          </div>
        )}

        {/* Total Summary & Complete Sale */}
        {!isMobilePopup && (
          <>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 px-3 py-2">
              <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                {lang === 'bn' ? 'সর্বমোট বিল' : 'Grand Total'}
              </span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                {formatBDT(grandTotal)}
              </span>
            </div>

            <button
              type="button"
              disabled={cartItems.length === 0 || missingCreditCustomer}
              onClick={handleCheckout}
              className="min-h-[48px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 transition-all shadow-xs"
            >
              <Receipt className="h-4 w-4" />
              <span>{t.completeSale}</span>
            </button>
          </>
        )}
      </div>
      </div>

      {isMobilePopup && (
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/95 px-3.5 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 px-3 py-1.5">
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
              {lang === 'bn' ? 'সর্বমোট বিল' : 'Grand Total'}
            </span>
            <span className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
              {formatBDT(grandTotal)}
            </span>
          </div>

          <button
            type="button"
            disabled={cartItems.length === 0 || missingCreditCustomer}
            onClick={handleCheckout}
            className="min-h-[46px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 transition-all shadow-xs"
          >
            <Receipt className="h-4 w-4" />
            <span>{t.completeSale}</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left 8 Cols: Search, Category Bar & Touch Product Grid */}
      <div className="lg:col-span-8 space-y-4">
        <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t.searchProducts}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {lang === 'bn' ? `সব পণ্য (${products.length})` : `All (${products.length})`}
            </button>
            {activeCategories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.bn)}
                className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                  selectedCategory === cat.bn
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {lang === 'bn' ? cat.bn : cat.en}
              </button>
            ))}
          </div>
        </div>

        {/* Product Tiles Grid OR Fresh Shop Empty State */}
        {products.length === 0 ? (
          <div className="neu-box rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 sm:p-10 text-center space-y-3">
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {lang === 'bn'
                ? 'বিক্রি শুরু করার জন্য প্রথমে পণ্য যোগ করুন'
                : 'Add Products to Start Selling at the POS Counter'}
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {lang === 'bn'
                ? 'আপনার দোকানের ইনভেন্টরিতে এখনো কোনো পণ্য নেই। নিচে ক্লিক করে ক্যাটাগরি ও পণ্য যোগ করুন।'
                : 'Your shop workspace currently has 0 products. Open Products & Stock to add your items.'}
            </p>
            {onGoToInventory && (
              <button
                type="button"
                onClick={onGoToInventory}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap"
              >
                <PackagePlus className="h-4 w-4 shrink-0" />
                <span>
                  {lang === 'bn' ? 'পণ্য ও ক্যাটাগরি যোগ করুন' : 'Go to Products & Stock'}
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredProducts.map((p) => {
              const inCartQty = cart[p.id] || 0;
              const isSelected = inCartQty > 0;
              const isOut = p.stock === 0;
              const isLow = p.stock > 0 && p.stock <= p.minStock;

              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={isOut && !isSelected}
                  aria-pressed={isSelected}
                  onClick={() => toggleProductSelection(p)}
                  className={`text-left rounded-2xl border p-3.5 sm:p-4 transition-all flex flex-col justify-between min-h-[112px] cursor-pointer min-w-0 ${
                    isOut && !isSelected
                      ? 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/40 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'border-emerald-600 ring-1 ring-emerald-600/20 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-2xs active:scale-[0.99]'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 active:scale-[0.99]'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 break-words">
                        {lang === 'bn' ? p.nameBn || p.name : p.name}
                      </div>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 shrink-0 whitespace-nowrap mt-0.5">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          {inCartQty}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug break-words">
                      <span className="font-mono">{p.sku}</span>
                      <span className="mx-1.5">·</span>
                      <span>{translateCategory(p.category, lang, activeCategories)}</span>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                      {formatBDT(p.sellPrice)}
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold whitespace-nowrap shrink-0 ${
                        isOut
                          ? 'text-rose-600 dark:text-rose-400'
                          : isLow
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isOut
                        ? lang === 'bn'
                          ? 'স্টক শেষ (0)'
                          : 'Out (0)'
                        : `${lang === 'bn' ? 'স্টক' : 'Stock'}: ${p.stock}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Right 4 Cols: Counter Cart */}
      <div className="neu-box-static hidden lg:block lg:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sticky top-20">
        {renderCartContent()}
      </div>

      {/* Mobile Floating Cart Trigger */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-17 left-3 right-3 z-30">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="w-full min-h-[44px] rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg flex items-center justify-between gap-2 whitespace-nowrap"
          >
            <span className="inline-flex items-center gap-2 min-w-0 truncate">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {cartItems.reduce((a, b) => a + b.qty, 0)}{' '}
                {lang === 'bn' ? 'টি পণ্য বিলে দেখুন' : 'items in bill'}
              </span>
            </span>
            <span className="font-mono tabular-nums shrink-0">{formatBDT(grandTotal)}</span>
          </button>
        </div>
      )}

      {/* Mobile Below-Header Full-Height Counter Bill Popup */}
      <AppPopupModal
        isOpen={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        maxWidthClass="max-w-3xl"
        heightMode="screen"
        ariaLabel={lang === 'bn' ? 'ক্যাশ মেমো / বিল' : 'Counter Bill'}
      >
        {renderCartContent(true)}
      </AppPopupModal>
    </div>
  );
};
