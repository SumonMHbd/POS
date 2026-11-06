import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  PlusCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import type { LanguageCode, PosStoreState } from '../types/pos';
import {
  GOOGLE_APPS_SCRIPT_BRIDGE_CODE,
  connectShopGoogleSheet,
  pullShopSheetData,
} from '../lib/googleWorkspace';
import { AppPopupModal } from './AppPopupModal';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  lang: LanguageCode;
  authToken: string;
  state: PosStoreState;
  pendingOfflineCount: number;
  onClose: () => void;
  onUpdateSheetConfig: (
    nextConfig: Partial<PosStoreState['sheetConfig']>,
    pulledData?: Partial<PosStoreState>
  ) => void;
  onRequestConfirmSync: () => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  lang,
  authToken,
  state,
  pendingOfflineCount,
  onClose,
  onUpdateSheetConfig,
  onRequestConfirmSync,
  onNotify,
}) => {
  const [existingUrlInput, setExistingUrlInput] = useState(state.sheetConfig.spreadsheetUrl || '');
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState('');
  const [showScriptGuide, setShowScriptGuide] = useState(false);
  const [busyMode, setBusyMode] = useState<'create' | 'link' | 'pull' | null>(null);

  if (!isOpen) return null;

  const handleAutoCreateWithShopName = async () => {
    setBusyMode('create');
    try {
      const res = await connectShopGoogleSheet(authToken, {
        shopId: state.shopId,
        appsScriptWebAppUrl: appsScriptUrlInput.trim() || undefined,
        createNewWithShopName: true,
      });
      onUpdateSheetConfig(res.sheetConfig);
      onNotify(
        lang === 'bn'
          ? `দোকানের নামে নতুন ক্লাউড ডাটাবেস তৈরি ও সংযুক্ত হয়েছে: ${res.sheetConfig.spreadsheetTitle}`
          : `Auto-created and linked Cloud Database: ${res.sheetConfig.spreadsheetTitle}`
      );
    } catch (err: unknown) {
      setShowScriptGuide(true);
      onNotify(
        err instanceof Error ? err.message : 'Paste Cloud Storage Bridge URL or Database URL below.',
        true
      );
    } finally {
      setBusyMode(null);
    }
  };

  const handleLinkDirectUrl = async () => {
    if (!existingUrlInput.trim()) {
      onNotify(
        lang === 'bn' ? 'সঠিক ক্লাউড ডাটাবেস লিংক বা আইডি দিন' : 'Please enter a Cloud Storage URL or ID',
        true
      );
      return;
    }
    setBusyMode('link');
    try {
      const res = await connectShopGoogleSheet(authToken, {
        shopId: state.shopId,
        sheetUrlOrId: existingUrlInput.trim(),
        appsScriptWebAppUrl: appsScriptUrlInput.trim() || undefined,
      });
      onUpdateSheetConfig(res.sheetConfig);
      onNotify(
        lang === 'bn'
          ? `ক্লাউড ডাটাবেস সরাসরি সংযুক্ত হয়েছে: ${res.sheetConfig.spreadsheetTitle}`
          : `Connected Cloud database: ${res.sheetConfig.spreadsheetTitle}`
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Unable to connect Cloud Database', true);
    } finally {
      setBusyMode(null);
    }
  };

  const handlePullLatest = async () => {
    if (!state.sheetConfig.spreadsheetId) return;
    setBusyMode('pull');
    try {
      const res = await pullShopSheetData(authToken, state.shopId);
      onUpdateSheetConfig(res.posState.sheetConfig, res.posState);
      onNotify(
        lang === 'bn'
          ? 'ক্লাউড ডাটাবেস থেকে সর্বশেষ পণ্য ও হিসাব লোড হয়েছে।'
          : 'Pulled latest inventory and POS records from Cloud Storage.'
      );
    } catch (err: unknown) {
      onNotify(err instanceof Error ? err.message : 'Pull failed', true);
    } finally {
      setBusyMode(null);
    }
  };

  return (
    <AppPopupModal
      isOpen={isOpen}
      onClose={onClose}
      disableClose={busyMode !== null}
      maxWidthClass="max-w-4xl"
      heightMode="screen"
      ariaLabel={
        lang === 'bn'
          ? 'সরাসরি ক্লাউড ডাটাবেস ও স্টোরেজ সিঙ্ক'
          : 'Cloud Database & Storage Sync'
      }
    >
      <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {lang === 'bn'
                ? 'সরাসরি ক্লাউড ডাটাবেস ও স্টোরেজ সিঙ্ক'
                : 'Cloud Database & Storage Sync'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {lang === 'bn'
                ? `${state.shopNameBn} — সরাসরি ক্লাউড ডাটাবেস ব্যাকআপ ও সিঙ্ক`
                : `${state.shopNameEn} — Direct cloud database sync & backup`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busyMode !== null}
          aria-label="Close"
          className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4 space-y-4">
        {/* Active Sheet Status */}
        {state.sheetConfig.spreadsheetId ? (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {state.sheetConfig.spreadsheetTitle || `${state.shopNameEn} — MHS POS`}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] font-mono text-emerald-800/80 dark:text-emerald-300/80 truncate">
                  ID: {state.sheetConfig.spreadsheetId.slice(0, 22)}
                  {state.sheetConfig.lastSyncedAt &&
                    ` · ${new Date(state.sheetConfig.lastSyncedAt).toLocaleTimeString()}`}
                  {pendingOfflineCount > 0 && ` · Queued: ${pendingOfflineCount}`}
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                {state.sheetConfig.spreadsheetUrl && (
                  <a
                    href={state.sheetConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 whitespace-nowrap shrink-0"
                  >
                    <span>{lang === 'bn' ? 'শিট খুলুন' : 'Open Sheet'}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}

                <button
                  type="button"
                  disabled={busyMode !== null}
                  onClick={handlePullLatest}
                  className="min-h-[34px] inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 shrink-0 ${busyMode === 'pull' ? 'animate-spin' : ''}`}
                  />
                  <span>{lang === 'bn' ? 'শিট লোড' : 'Pull'}</span>
                </button>

                <button
                  type="button"
                  disabled={busyMode !== null}
                  onClick={onRequestConfirmSync}
                  className="min-h-[34px] inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
                >
                  <span>{lang === 'bn' ? 'সিঙ্ক করুন' : 'Sync Sheet'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-600 dark:text-slate-300">
            {lang === 'bn'
              ? `নির্ধারিত শিট: "${state.sheetConfig.spreadsheetTitle || `${state.shopNameBn} — MHS POS`}" — নিচের যেকোনো অপশনে যুক্ত করুন।`
              : `Target Workbook: "${state.sheetConfig.spreadsheetTitle || `${state.shopNameEn} — MHS POS`}" — Connect below.`}
          </div>
        )}

        {/* Two Direct Connection Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Option 1: Auto-create Cloud Database with Shop Name */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {lang === 'bn'
                  ? '১. দোকানের নামে অটো ক্লাউড ডাটাবেস তৈরি'
                  : '1. Auto-Create Cloud DB With Shop Name'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug">
                {lang === 'bn'
                  ? `"${state.shopNameBn} — MHS POS" নামে ৯-ট্যাব বিশিষ্ট নতুন ক্লাউড ডাটাবেস স্বয়ংক্রিয়ভাবে তৈরি করবে।`
                  : `Creates "${state.shopNameEn} — MHS POS" with structured POS tabs in Cloud.`}
              </p>

              <div>
                <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                  <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                    Apps Script URL (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowScriptGuide((p) => !p)}
                    className="neu-flat text-emerald-600 hover:underline font-semibold whitespace-nowrap shrink-0"
                  >
                    {showScriptGuide ? 'Hide Script' : 'Get Script'}
                  </button>
                </div>
                <input
                  type="url"
                  value={appsScriptUrlInput}
                  onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={busyMode !== null}
              onClick={handleAutoCreateWithShopName}
              className="min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
            >
              <PlusCircle className="h-3.5 w-3.5 shrink-0" />
              <span>
                {busyMode === 'create'
                  ? 'Creating...'
                  : lang === 'bn'
                  ? 'নতুন ক্লাউড ডাটাবেস তৈরি ও সংযুক্ত করুন'
                  : 'Auto-Create & Connect Cloud Database'}
              </span>
            </button>
          </div>

          {/* Option 2: Paste Existing Cloud Storage URL / ID */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {lang === 'bn'
                  ? '২. সরাসরি ক্লাউড ডাটাবেস লিংক সংযুক্ত করুন'
                  : '2. Connect Cloud Database URL / ID Directly'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 leading-snug">
                {lang === 'bn'
                  ? 'যেকোনো ক্লাউড ডাটাবেস লিংক বা Spreadsheet ID পেস্ট করে সরাসরি যুক্ত করুন।'
                  : 'Paste any Cloud Storage link or Spreadsheet ID directly to bind this shop.'}
              </p>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 truncate">
                  {lang === 'bn' ? 'ক্লাউড ডাটাবেস লিংক বা আইডি' : 'Cloud Database URL or ID'}
                </label>
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/... or ID"
                  value={existingUrlInput}
                  onChange={(e) => setExistingUrlInput(e.target.value)}
                  className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={busyMode !== null || !existingUrlInput.trim()}
              onClick={handleLinkDirectUrl}
              className="min-h-[38px] w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                {busyMode === 'link'
                  ? 'Linking...'
                  : lang === 'bn'
                  ? 'সরাসরি ক্লাউড ডাটাবেস সংযুক্ত করুন'
                  : 'Connect Cloud DB Directly'}
              </span>
            </button>
          </div>
        </div>

        {/* Optional Collapsible Free Apps Script Helper */}
        {showScriptGuide && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-xs space-y-1.5 animate-dropdown-pop">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold truncate">Free Direct Cloud Bridge Script</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_BRIDGE_CODE);
                  onNotify('Copied Cloud Bridge Script to clipboard!');
                }}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white whitespace-nowrap shrink-0"
              >
                <Copy className="h-3 w-3 shrink-0" />
                <span>Copy Script</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-snug">
              Open <strong>script.google.com</strong> &rarr; New Project &rarr; Paste script &rarr;
              Deploy as Web App (Execute as: Me, Access: Anyone) &rarr; Paste URL above.
            </p>
          </div>
        )}
      </div>

      {/* Auto-sync toggle footer */}
      <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-between gap-3 text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 min-w-0">
          <input
            type="checkbox"
            checked={state.sheetConfig.autoSync}
            onChange={(e) => onUpdateSheetConfig({ autoSync: e.target.checked })}
            className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
          />
          <span className="text-[11px] sm:text-xs leading-snug truncate">
            {lang === 'bn'
              ? 'প্রতিটি বিক্রি ও স্টক পরিবর্তনের সাথে স্বয়ংক্রিয়ভাবে ক্লাউড ডাটাবেস আপডেট করুন'
              : 'Auto-sync every POS checkout and inventory update to Cloud Database'}
          </span>
        </label>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[36px] px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold whitespace-nowrap shrink-0"
        >
          {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
        </button>
      </div>
    </AppPopupModal>
  );
};
