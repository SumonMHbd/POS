import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Monitor,
  RefreshCw,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import type { LanguageCode } from '../types/pos';
import { UI_TEXT } from '../i18n/translations';
import { AppPopupModal } from './AppPopupModal';

interface PWAInstallButtonProps {
  lang: LanguageCode;
  variant?: 'sidebar' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  variant = 'sidebar',
}) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Automatically hide when already running as an installed standalone PWA
  if (isInstalled) return null;

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleInstallClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    } else {
      setShowGuideModal(true);
    }
  };

  const handleCopyUrl = () => {
    if (!appUrl) return;
    navigator.clipboard?.writeText(appUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const buttonNode =
    variant === 'compact' ? (
      <button
        type="button"
        onClick={handleInstallClick}
        title={
          lang === 'bn'
            ? 'ব্রাউজার থেকে অ্যাপ ইনস্টল / ডাউনলোড করুন'
            : 'Install / Download MHS POS App'
        }
        aria-label={lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}
        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/90 dark:border-emerald-800/70 bg-emerald-50/90 dark:bg-emerald-950/50 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/60 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">
          {lang === 'bn' ? 'অ্যাপ ইনস্টল' : 'Install App'}
        </span>
      </button>
    ) : (
      <button
        type="button"
        onClick={handleInstallClick}
        className="w-full min-h-[42px] flex items-center justify-center gap-2 rounded-xl border border-emerald-200/90 dark:border-emerald-800/70 bg-emerald-50/90 dark:bg-emerald-950/45 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/55 whitespace-nowrap shrink-0"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>
          {lang === 'bn' ? 'অ্যাপ ডাউনলোড / ইনস্টল' : 'Install Desktop / Mobile App'}
        </span>
      </button>
    );

  return (
    <>
      {buttonNode}

      <AppPopupModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        maxWidthClass="max-w-3xl"
        heightMode="screen"
        ariaLabel={lang === 'bn' ? 'MHS POS অ্যাপ ইনস্টল করুন' : 'Install MHS POS App'}
      >
        <div className="shrink-0 flex items-center justify-between gap-2.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Download className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold font-display truncate whitespace-nowrap">
                {lang === 'bn' ? 'MHS POS অ্যাপ ইনস্টল করুন' : 'Install MHS POS App'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate whitespace-nowrap">
                {lang === 'bn'
                  ? 'কম্পিউটার বা মোবাইলে অ্যাপ হিসেবে ব্যবহার করুন'
                  : 'Standalone Desktop or Mobile app with offline support'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuideModal(false)}
            aria-label="Close modal"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
          {isInIframe && (
            <div className="neu-well rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/35 p-3 space-y-2">
              <p className="text-amber-900 dark:text-amber-200 leading-snug font-medium">
                {lang === 'bn'
                  ? 'প্রিভিউ ফ্রেমে সরাসরি ইনস্টল পপআপ আসে না। লিংকটি কপি করে নতুন ব্রাউজার ট্যাবে খুললে ১-ক্লিকে ইনস্টল হবে:'
                  : 'Copy the app link below and open it in a full browser tab for 1-click installation:'}
              </p>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-slate-700 px-3 py-2 font-mono text-[11px]">
                <span className="truncate text-slate-700 dark:text-slate-300">{appUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-white font-sans font-bold whitespace-nowrap shrink-0"
                >
                  {copiedUrl ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  <span>
                    {copiedUrl
                      ? lang === 'bn'
                        ? 'কপি হয়েছে'
                        : 'Copied'
                      : lang === 'bn'
                      ? 'লিংক কপি'
                      : 'Copy URL'}
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isIOS && (
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 flex items-start gap-3">
                <Monitor className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
                    {lang === 'bn'
                      ? 'কম্পিউটার ও Android (Chrome / Edge)'
                      : 'Desktop & Android (Chrome / Edge)'}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === 'bn'
                      ? 'অ্যাড্রেস বারের ডান পাশে Install আইকন অথবা মেনু (⋮) থেকে "Install MHS POS" নির্বাচন করুন।'
                      : 'Click the Install icon in the address bar or menu (⋮) → "Install MHS POS".'}
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="font-bold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
                  {lang === 'bn'
                    ? 'iPhone / iPad (Safari ব্রাউজার)'
                    : 'iPhone / iPad (Safari Browser)'}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {lang === 'bn'
                    ? 'Safari নিচে Share বাটনে ট্যাপ করে "Add to Home Screen" চাপুন।'
                    : 'Tap Share in Safari toolbar, then tap "Add to Home Screen".'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowGuideModal(false)}
            className="min-h-[38px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2 text-xs font-bold text-white whitespace-nowrap"
          >
            {lang === 'bn' ? 'বুঝেছি, বন্ধ করুন' : 'Got It'}
          </button>
        </div>
      </AppPopupModal>
    </>
  );
};

export const OfflineStatusBanner: React.FC<{
  isOnline: boolean;
  pendingCount: number;
  lang: LanguageCode;
  onFlushQueue: () => void;
}> = ({ isOnline, pendingCount, lang, onFlushQueue }) => {
  const t = UI_TEXT[lang];

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`border-b px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-medium flex items-center justify-between gap-2 ${
        !isOnline
          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200'
          : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800/60 dark:text-emerald-200'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {!isOnline ? (
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate whitespace-nowrap">
          {!isOnline
            ? t.offlineBanner
            : lang === 'bn'
            ? `অনলাইন — ${pendingCount} টি লেনদেন সিঙ্ক করার জন্য প্রস্তুত`
            : `Back Online — ${pendingCount} offline mutation(s) ready to sync`}
        </span>
      </div>
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono tabular-nums whitespace-nowrap hidden sm:inline">
            {t.pendingQueue}: {pendingCount}
          </span>
          {isOnline && (
            <button
              type="button"
              onClick={onFlushQueue}
              className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0"
            >
              {t.syncNow}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
