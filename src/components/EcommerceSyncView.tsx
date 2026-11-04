import React, { useState } from 'react';
import {
  Check,
  Copy,
  Globe,
  RefreshCw,
  Send,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import type {
  EcommerceCredentials,
  EcommerceOrder,
  LanguageCode,
  UserRole,
} from '../types/pos';
import { UserRole as RoleEnum } from '../types/pos';
import { formatBDT, formatPct } from '../i18n/translations';
import { TableRowsSkeleton } from './SkeletonScreens';

interface EcommerceSyncViewProps {
  orders: EcommerceOrder[];
  credentials: EcommerceCredentials;
  authToken: string;
  lang: LanguageCode;
  activeRole: UserRole;
  onUpdateCredentials: (patch: Partial<EcommerceCredentials>) => void;
  onIngestOrders: (incoming: EcommerceOrder[], sourceLabel: string) => void;
  onUpdateOrderStatus: (
    orderId: string,
    status: EcommerceOrder['fulfillmentStatus']
  ) => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const EcommerceSyncView: React.FC<EcommerceSyncViewProps> = ({
  orders,
  credentials,
  authToken,
  lang,
  activeRole,
  onUpdateCredentials,
  onIngestOrders,
  onUpdateOrderStatus,
  onNotify,
}) => {
  const canConfigure = activeRole === RoleEnum.OWNER || activeRole === RoleEnum.MANAGER;
  const [syncingPlatform, setSyncingPlatform] = useState<'shopify' | 'woo' | 'webhook' | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shopifyWebhookUrl = `${originUrl}/api/webhooks/shopify`;
  const wooWebhookUrl = `${originUrl}/api/webhooks/woocommerce`;

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleSyncShopifyLive = async () => {
    if (!credentials.shopifyDomain.trim() || !credentials.shopifyAccessToken.trim()) {
      onNotify(
        lang === 'bn'
          ? 'Shopify স্টোর ডোমেইন এবং Admin API Access Token প্রদান করুন।'
          : 'Enter your Shopify store domain and Admin API Access Token first.',
        true
      );
      return;
    }
    setSyncingPlatform('shopify');
    try {
      const res = await fetch('/api/integrations/shopify/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          shopDomain: credentials.shopifyDomain,
          accessToken: credentials.shopifyAccessToken,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Shopify sync failed');
      }
      const mapped: EcommerceOrder[] = (json.orders || []).map((o: any) => ({
        ...o,
        onTime: o.dispatchHours <= 12,
      }));
      onIngestOrders(mapped, 'Shopify REST API');
      onNotify(
        lang === 'bn'
          ? `Shopify থেকে ${mapped.length} টি অর্ডার সিঙ্ক হয়েছে।`
          : `Synced ${mapped.length} live order(s) from Shopify.`
      );
    } catch (err: any) {
      onNotify(err?.message || 'Shopify sync error', true);
    } finally {
      setSyncingPlatform(null);
    }
  };

  const handleSyncWooLive = async () => {
    if (
      !credentials.wooStoreUrl.trim() ||
      !credentials.wooConsumerKey.trim() ||
      !credentials.wooConsumerSecret.trim()
    ) {
      onNotify(
        lang === 'bn'
          ? 'WooCommerce স্টোর URL, Consumer Key এবং Secret প্রদান করুন।'
          : 'Enter WooCommerce Store URL, Consumer Key, and Consumer Secret first.',
        true
      );
      return;
    }
    setSyncingPlatform('woo');
    try {
      const res = await fetch('/api/integrations/woocommerce/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          storeUrl: credentials.wooStoreUrl,
          consumerKey: credentials.wooConsumerKey,
          consumerSecret: credentials.wooConsumerSecret,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'WooCommerce sync failed');
      }
      const mapped: EcommerceOrder[] = (json.orders || []).map((o: any) => ({
        ...o,
        onTime: o.dispatchHours <= 12,
      }));
      onIngestOrders(mapped, 'WooCommerce REST API');
      onNotify(
        lang === 'bn'
          ? `WooCommerce থেকে ${mapped.length} টি অর্ডার সিঙ্ক হয়েছে।`
          : `Synced ${mapped.length} live order(s) from WooCommerce.`
      );
    } catch (err: any) {
      onNotify(err?.message || 'WooCommerce sync error', true);
    } finally {
      setSyncingPlatform(null);
    }
  };

  // Fires a real HTTP POST to `/api/webhooks/shopify` on server.ts to verify live webhook + stock deduction pipeline
  const handleTriggerWebhookVerification = async (platform: 'shopify' | 'woocommerce') => {
    setSyncingPlatform('webhook');
    try {
      const payload =
        platform === 'shopify'
          ? {
              name: `#SHP-${Math.floor(2000 + Math.random() * 7999)}`,
              customer: { first_name: 'Rafiul', last_name: 'Karim' },
              email: 'rafiul.online@example.com',
              total_price: 1120,
              carrier: 'Pathao Courier',
              line_items: [
                { title: 'LED Bulb 12W', quantity: 4, sku: 'ELX-ELC-012' },
                { title: 'Wireless Mouse', quantity: 1, sku: 'ELX-CMP-007' },
              ],
            }
          : {
              number: Math.floor(5000 + Math.random() * 4999),
              billing: { first_name: 'Farhana', last_name: 'Yasmin', email: 'farhana.wc@example.com' },
              total: 1020,
              carrier: 'Steadfast Courier',
              line_items: [
                { name: 'Tempered Glass Screen Guard', quantity: 5, sku: 'ELX-ACC-009' },
                { name: 'Wired Earphone', quantity: 2, sku: 'ELX-AUD-013' },
              ],
            };

      const res = await fetch(`/api/webhooks/${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.order) {
        onIngestOrders([{ ...json.order, onTime: true }], `${platform} Webhook`);
        onNotify(
          lang === 'bn'
            ? `লাইভ ${platform === 'shopify' ? 'Shopify' : 'WooCommerce'} ওয়েবহুক অর্ডার গ্রহণ ও স্টক সমন্বয় সম্পন্ন হয়েছে!`
            : `Verified live ${platform} webhook endpoint and synchronized SKU inventory!`
        );
      }
    } catch (err: any) {
      onNotify(err?.message || 'Webhook test failed', true);
    } finally {
      setSyncingPlatform(null);
    }
  };

  const totalOrders = orders.length;
  const deliveredCount = orders.filter((o) => o.fulfillmentStatus === 'Delivered').length;
  const onTimePct =
    totalOrders > 0 ? (orders.filter((o) => o.onTime).length / totalOrders) * 100 : 100;
  const avgTurnaround =
    totalOrders > 0
      ? orders.reduce((acc, o) => acc + o.dispatchHours, 0) / totalOrders
      : 0;

  return (
    <div className="space-y-6">
      {/* Shipping & Supply Chain KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 min-w-0">
          <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">
            {lang === 'bn' ? 'মোট ই-কমার্স অর্ডার' : 'Synced Online Orders'}
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {totalOrders}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs text-slate-500 leading-snug">
            Shopify & WooCommerce
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 min-w-0">
          <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">
            {lang === 'bn' ? 'অন-টাইম শিপিং হার' : 'On-Time Shipping SLA'}
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
            {formatPct(onTimePct)}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs text-slate-500 leading-snug">
            Target SLA &le; 12 hrs dispatch
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 min-w-0">
          <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">
            {lang === 'bn' ? 'গড় ডিসপ্যাচ সময়' : 'Avg Fulfillment Turnaround'}
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {avgTurnaround.toFixed(1)} hrs
          </div>
          <div className="mt-1 text-[11px] sm:text-xs text-slate-500 leading-snug">
            Order to courier handover
          </div>
        </div>

        <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 min-w-0">
          <div className="text-[11px] sm:text-xs text-slate-500 leading-snug">
            {lang === 'bn' ? 'ডেলিভারি সম্পন্ন' : 'Completed Deliveries'}
          </div>
          <div className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 whitespace-nowrap">
            {deliveredCount} / {totalOrders}
          </div>
          <div className="mt-1 text-[11px] sm:text-xs text-slate-500 leading-snug">
            Auto-synced to Google Sheets
          </div>
        </div>
      </div>

      {/* Shopify & WooCommerce Connector Cards */}
      {canConfigure && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shopify Card */}
          <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <ShoppingBag className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    Shopify Store Connector
                  </h2>
                  <p className="text-xs text-slate-500 leading-snug mt-0.5">
                    Admin REST API (`2024-10`) & Order Creation Webhook
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={syncingPlatform !== null}
                onClick={() => handleTriggerWebhookVerification('shopify')}
                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Send className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>{lang === 'bn' ? 'টেস্ট ওয়েবহুক' : 'Test Webhook'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                  Shopify Domain
                </label>
                <input
                  type="text"
                  placeholder="my-electronics.myshopify.com"
                  value={credentials.shopifyDomain}
                  onChange={(e) => onUpdateCredentials({ shopifyDomain: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                  Admin API Access Token
                </label>
                <input
                  type="password"
                  placeholder="shpat_..."
                  value={credentials.shopifyAccessToken}
                  onChange={(e) => onUpdateCredentials({ shopifyAccessToken: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="neu-well flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono">
              <span className="truncate text-slate-600 dark:text-slate-400">{shopifyWebhookUrl}</span>
              <button
                type="button"
                onClick={() => copyText('shopify', shopifyWebhookUrl)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-sans font-semibold whitespace-nowrap shrink-0"
              >
                {copiedKey === 'shopify' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'shopify' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              disabled={syncingPlatform !== null}
              onClick={handleSyncShopifyLive}
              className="min-h-[42px] w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncingPlatform === 'shopify' ? 'animate-spin' : ''}`} />
              <span className="truncate">
                {lang === 'bn'
                  ? 'Shopify অর্ডার সিঙ্ক করুন'
                  : 'Sync Live Orders from Shopify'}
              </span>
            </button>
          </div>

          {/* WooCommerce Card */}
          <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <Globe className="h-5 w-5 text-slate-700 dark:text-slate-300 shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    WooCommerce Store Connector
                  </h2>
                  <p className="text-xs text-slate-500 leading-snug mt-0.5">
                    REST API `wc/v3/orders` & Real-Time Webhook Receiver
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={syncingPlatform !== null}
                onClick={() => handleTriggerWebhookVerification('woocommerce')}
                className="min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Send className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>{lang === 'bn' ? 'টেস্ট ওয়েবহুক' : 'Test Webhook'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                  Store URL
                </label>
                <input
                  type="text"
                  placeholder="https://myshop.com"
                  value={credentials.wooStoreUrl}
                  onChange={(e) => onUpdateCredentials({ wooStoreUrl: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                  Consumer Key
                </label>
                <input
                  type="password"
                  placeholder="ck_..."
                  value={credentials.wooConsumerKey}
                  onChange={(e) => onUpdateCredentials({ wooConsumerKey: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                  Consumer Secret
                </label>
                <input
                  type="password"
                  placeholder="cs_..."
                  value={credentials.wooConsumerSecret}
                  onChange={(e) => onUpdateCredentials({ wooConsumerSecret: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="neu-well flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono">
              <span className="truncate text-slate-600 dark:text-slate-400">{wooWebhookUrl}</span>
              <button
                type="button"
                onClick={() => copyText('woo', wooWebhookUrl)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 font-sans font-semibold whitespace-nowrap shrink-0"
              >
                {copiedKey === 'woo' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedKey === 'woo' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              disabled={syncingPlatform !== null}
              onClick={handleSyncWooLive}
              className="min-h-[42px] w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${syncingPlatform === 'woo' ? 'animate-spin' : ''}`} />
              <span className="truncate">
                {lang === 'bn'
                  ? 'WooCommerce অর্ডার সিঙ্ক করুন'
                  : 'Sync Live Orders from WooCommerce'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Synchronized Orders & Fulfillment Queue */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Truck className="h-4 w-4 text-emerald-600 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {lang === 'bn'
                ? 'অমনichannel অর্ডার ও কুরিয়ার শিপিং ট্র্যাকার'
                : 'Synchronized E-Commerce Orders & Shipping Fulfillment'}
            </h3>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer min-w-0">
            <input
              type="checkbox"
              checked={credentials.autoDeductStock}
              onChange={(e) => onUpdateCredentials({ autoDeductStock: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 shrink-0"
            />
            <span className="leading-snug">
              {lang === 'bn'
                ? 'নতুন অনলাইন অর্ডারে স্বয়ংক্রিয় SKU স্টক কর্তন'
                : 'Auto-deduct POS SKU inventory on incoming orders'}
            </span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="pro-table">
            <thead>
              <tr>
                <th className="w-36 text-left whitespace-nowrap">
                  {lang === 'bn' ? 'অর্ডার ও মাধ্যম' : 'Order · Platform'}
                </th>
                <th className="w-44 min-w-[125px] text-left">
                  {lang === 'bn' ? 'ক্রেতা' : 'Customer'}
                </th>
                <th className="min-w-[150px] text-left">
                  {lang === 'bn' ? 'পণ্যসমূহ' : 'Items'}
                </th>
                <th className="w-36 text-left whitespace-nowrap">
                  {lang === 'bn' ? 'কুরিয়ার' : 'Courier · SLA'}
                </th>
                <th className="w-24 text-right whitespace-nowrap">
                  {lang === 'bn' ? 'মূল্য' : 'Amount'}
                </th>
                <th className="w-px text-right whitespace-nowrap">
                  {lang === 'bn' ? 'স্ট্যাটাস' : 'Fulfillment'}
                </th>
              </tr>
            </thead>
            <tbody>
              {syncingPlatform !== null && <TableRowsSkeleton rows={3} cols={6} />}
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="whitespace-nowrap">
                    <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {o.externalOrderId}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {o.platform} · {new Date(o.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="break-words">
                    <div className="font-medium text-slate-800 dark:text-slate-200">{o.customerName}</div>
                    <div className="text-[11px] text-slate-500 break-all sm:break-normal">{o.customerEmail}</div>
                  </td>
                  <td className="text-slate-600 dark:text-slate-300 break-words">
                    {o.itemsSummary}
                  </td>
                  <td className="font-mono tabular-nums text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {o.carrier} · {o.dispatchHours}h
                  </td>
                  <td className="text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                    {formatBDT(o.totalAmount)}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <select
                      value={o.fulfillmentStatus}
                      onChange={(e) =>
                        onUpdateOrderStatus(
                          o.id,
                          e.target.value as EcommerceOrder['fulfillmentStatus']
                        )
                      }
                      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-medium"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Packed">Packed</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
