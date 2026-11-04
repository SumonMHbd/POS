import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { LanguageCode } from '../types/pos';
import { UI_TEXT } from '../i18n/translations';
import { AppPopupModal } from './AppPopupModal';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  description: string;
  affectedSummary?: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
}

interface ConfirmActionModalProps {
  dialog: ConfirmDialogState | null;
  lang: LanguageCode;
  isBusy: boolean;
  onClose: () => void;
  onExecute: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  dialog,
  lang,
  isBusy,
  onClose,
  onExecute,
}) => {
  const isOpen = Boolean(dialog && dialog.isOpen);
  if (!isOpen || !dialog) return null;

  const t = UI_TEXT[lang];
  const isDanger = dialog.variant === 'danger';

  return (
    <AppPopupModal
      isOpen={isOpen}
      onClose={onClose}
      disableClose={isBusy}
      maxWidthClass="max-w-lg"
      heightMode="compact"
      zIndexClass="z-[70]"
      ariaLabel={dialog.title}
    >
      <div className="flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isDanger
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {dialog.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-3.5 space-y-2.5">
          <p className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {dialog.description}
          </p>

          {dialog.affectedSummary && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-700 dark:text-slate-300">
              {dialog.affectedSummary}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={onExecute}
            disabled={isBusy}
            className={`min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isBusy
                ? lang === 'bn'
                  ? 'প্রসেস হচ্ছে...'
                  : 'Processing...'
                : dialog.confirmLabel || t.confirmAction}
            </span>
          </button>
        </div>
      </div>
    </AppPopupModal>
  );
};

