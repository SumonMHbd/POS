import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

let openPopupCount = 0;
const escapeHandlerStack: Array<() => void> = [];

let globalKeyListenerAttached = false;
function ensureGlobalEscapeListener() {
  if (globalKeyListenerAttached || typeof window === 'undefined') return;
  globalKeyListenerAttached = true;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && escapeHandlerStack.length > 0) {
      e.stopPropagation();
      const topHandler = escapeHandlerStack[escapeHandlerStack.length - 1];
      topHandler();
    }
  });
}

export interface AppPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  disableClose?: boolean;
  maxWidthClass?: string;
  heightMode?: 'screen' | 'compact';
  zIndexClass?: string;
  fullViewportWidth?: boolean;
  ariaLabel?: string;
  children: React.ReactNode;
}

/**
 * Portal-rendered professional workspace popup anchored immediately below the sticky h-14 header.
 * Eliminates parent CSS transform containing-block traps, minimizes outside dead space,
 * spans the below-header screen height by default, and applies darker crisp border shadows.
 */
export const AppPopupModal: React.FC<AppPopupModalProps> = ({
  isOpen,
  onClose,
  disableClose = false,
  maxWidthClass = 'max-w-5xl',
  heightMode = 'screen',
  zIndexClass = 'z-[60]',
  fullViewportWidth = false,
  ariaLabel,
  children,
}) => {
  const onCloseRef = useRef(onClose);
  const disableCloseRef = useRef(disableClose);
  onCloseRef.current = onClose;
  disableCloseRef.current = disableClose;

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    ensureGlobalEscapeListener();
    openPopupCount += 1;
    document.documentElement.classList.add('overflow-hidden');

    const handleEsc = () => {
      if (!disableCloseRef.current) {
        onCloseRef.current();
      }
    };
    escapeHandlerStack.push(handleEsc);

    return () => {
      const idx = escapeHandlerStack.lastIndexOf(handleEsc);
      if (idx !== -1) escapeHandlerStack.splice(idx, 1);

      openPopupCount = Math.max(0, openPopupCount - 1);
      if (openPopupCount === 0) {
        document.documentElement.classList.remove('overflow-hidden');
      }
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isScreenHeight = heightMode === 'screen';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={() => {
        if (!disableClose) onClose();
      }}
      className={`fixed top-14 inset-x-0 ${
        fullViewportWidth ? '' : 'lg:left-64'
      } bottom-0 ${zIndexClass} flex justify-center ${
        isScreenHeight ? 'items-stretch' : 'items-start pt-1.5 sm:pt-2.5'
      } bg-slate-950/55 dark:bg-slate-950/75 backdrop-blur-[2px] px-1.5 py-1.5 sm:px-2.5 sm:py-2 lg:px-4 lg:py-2 animate-popup-backdrop`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`neu-popup-card animate-popup-modal w-full ${maxWidthClass} ${
          isScreenHeight ? 'h-full max-h-full' : 'h-auto max-h-full'
        } rounded-2xl border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
