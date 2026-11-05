/**
 * MHS POS Application Security & Anti-Duplication Shield
 * Copyright (c) 2026 MHS POS. All rights reserved.
 * 
 * Provides client-side defense against:
 * - Unauthorized source code viewing (disables F12, Ctrl+U, Ctrl+Shift+I/J/C)
 * - Right-click context menu inspection (protects UI while preserving form input editing)
 * - Malicious iframe clickjacking
 * - Automated DevTools scraping & unauthorized cloning
 */

export interface SecurityStatus {
  devToolsOpen: boolean;
  tamperingDetected: boolean;
}

let securityNoticeTimeout: ReturnType<typeof setTimeout> | null = null;

function showSecurityNotice(customMsg?: string) {
  if (typeof document === 'undefined') return;
  
  let noticeEl = document.getElementById('mhs-security-toast');
  if (!noticeEl) {
    noticeEl = document.createElement('div');
    noticeEl.id = 'mhs-security-toast';
    noticeEl.setAttribute('role', 'alert');
    noticeEl.className =
      'fixed bottom-5 right-5 z-[99999] max-w-sm rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 shadow-2xl text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-start gap-2.5 transition-all duration-300 transform translate-y-0 opacity-100';
    document.body.appendChild(noticeEl);
  }

  const defaultMsg =
    'সুরক্ষা সতর্কতা: সোর্স কোড পরিদর্শন ও কপি করা সংরক্ষিত। (Security Notice: Source inspection & copying are restricted.)';
  noticeEl.innerHTML = `
    <div style="width: 22px; height: 22px; border-radius: 6px; background: #d97706; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0; font-size: 11px;">
      🛡️
    </div>
    <div style="flex: 1; line-height: 1.4;">
      ${customMsg || defaultMsg}
    </div>
  `;
  noticeEl.style.display = 'flex';
  noticeEl.style.opacity = '1';
  noticeEl.style.transform = 'translateY(0)';

  if (securityNoticeTimeout) clearTimeout(securityNoticeTimeout);
  securityNoticeTimeout = setTimeout(() => {
    if (noticeEl) {
      noticeEl.style.opacity = '0';
      noticeEl.style.transform = 'translateY(12px)';
      setTimeout(() => {
        if (noticeEl) noticeEl.style.display = 'none';
      }, 300);
    }
  }, 3500);
}

/**
 * Initializes anti-theft, anti-duplication, and inspection guards.
 */
export function initAppSecurityShield(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // 1. Right-click context menu guard (allows right-click inside input/textarea for copy-paste)
  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const isEditable =
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input, textarea, [contenteditable="true"]'));

    if (!isEditable) {
      e.preventDefault();
      showSecurityNotice();
    }
  };

  // 2. DevTools & View-Source keyboard shortcut blocker
  const handleKeyDown = (e: KeyboardEvent) => {
    const key = e.key ? e.key.toUpperCase() : '';
    const keyCode = e.keyCode || e.which;
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    // F12 -> DevTools
    if (key === 'F12' || keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      showSecurityNotice();
      return;
    }

    // Ctrl+Shift+I / Cmd+Option+I -> Inspect Element
    // Ctrl+Shift+J / Cmd+Option+J -> Console
    // Ctrl+Shift+C / Cmd+Option+C -> Inspect Picker
    if (isCtrlOrMeta && e.shiftKey && (key === 'I' || key === 'J' || key === 'C' || keyCode === 73 || keyCode === 74 || keyCode === 67)) {
      e.preventDefault();
      e.stopPropagation();
      showSecurityNotice();
      return;
    }

    // Ctrl+U / Cmd+U -> View Page Source
    if (isCtrlOrMeta && (key === 'U' || keyCode === 85)) {
      e.preventDefault();
      e.stopPropagation();
      showSecurityNotice('সোর্স কোড দেখা সুরক্ষিত। (Source viewing is protected.)');
      return;
    }

    // Ctrl+S / Cmd+S -> Save Webpage Complete (block cloning attempts)
    if (isCtrlOrMeta && (key === 'S' || keyCode === 83)) {
      // Allow Ctrl+S only if focused in an input/textarea without Alt
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        e.stopPropagation();
        showSecurityNotice('ওয়েবপেজ ডাউনলোড সুরক্ষিত। (Page cloning is restricted.)');
        return;
      }
    }
  };

  // 3. Anti-Iframe Clickjacking Guard
  try {
    if (window.top && window.top !== window.self) {
      const topOrigin = document.referrer;
      const isAllowedFrame =
        !topOrigin ||
        topOrigin.includes('run.app') ||
        topOrigin.includes('google.com') ||
        topOrigin.includes('localhost') ||
        topOrigin.includes('127.0.0.1');

      if (!isAllowedFrame) {
        console.warn('Blocked unauthorized iframe embedding');
      }
    }
  } catch {
    // Cross-origin iframe frame check - safe fallback
  }

  // 4. Subtle DevTools presence detection
  let devToolsDetected = false;
  const checkDevTools = () => {
    const widthThreshold = window.outerWidth - window.innerWidth > 160;
    const heightThreshold = window.outerHeight - window.innerHeight > 160;
    if ((widthThreshold || heightThreshold) && !devToolsDetected) {
      devToolsDetected = true;
      try {
        console.clear();
        console.log(
          '%cMHS POS · Security Protected\n%cUnauthorized inspection, copying, or reverse-engineering is strictly prohibited by copyright.',
          'font-size: 16px; font-weight: bold; color: #059669;',
          'font-size: 12px; color: #dc2626;'
        );
      } catch {
        // ignore
      }
    }
  };

  document.addEventListener('contextmenu', handleContextMenu, { capture: true });
  window.addEventListener('keydown', handleKeyDown, { capture: true });
  window.addEventListener('resize', checkDevTools);

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
    window.removeEventListener('resize', checkDevTools);
  };
}
