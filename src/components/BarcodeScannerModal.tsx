import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  Search,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { Product } from '../types/pos';
import { formatBDT } from '../i18n/translations';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onItemScanned: (product: Product) => void;
  isBangla?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onItemScanned,
  isBangla = false,
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scannerActive, setScannerActive] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [lastMatchedProduct, setLastMatchedProduct] = useState<Product | null>(null);
  const [audioFeedback, setAudioFeedback] = useState<boolean>(true);
  const [manualSkuInput, setManualSkuInput] = useState<string>('');
  const [recentScans, setRecentScans] = useState<Array<{ code: string; matched: boolean; name?: string; time: string }>>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimestampRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  // USB Barcode Scanner buffer
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Play audio beep on successful scan
  const playBeep = useCallback((success: boolean = true) => {
    if (!audioFeedback) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (success) {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // High pleasant A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(320, ctx.currentTime); // Low buzz
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
      }

      if (navigator.vibrate) {
        navigator.vibrate(success ? 70 : [40, 60, 40]);
      }
    } catch {
      // AudioContext may be restricted by autoplay policy
    }
  }, [audioFeedback]);

  // Handle scanned barcode text
  const handleDecodedCode = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      const cleanCode = decodedText.trim();
      if (!cleanCode) return;

      // Debounce: don't process same code within 1.2s, or different code within 350ms
      if (cleanCode === lastScannedCode && now - lastScanTimestampRef.current < 1200) {
        return;
      }
      if (now - lastScanTimestampRef.current < 350) {
        return;
      }
      lastScanTimestampRef.current = now;
      setLastScannedCode(cleanCode);

      // Find product by SKU, ID, or case-insensitive match
      const cleanLower = cleanCode.toLowerCase();
      const matched = products.find(
        (p) =>
          p.sku.toLowerCase() === cleanLower ||
          p.id.toLowerCase() === cleanLower ||
          p.name.toLowerCase() === cleanLower ||
          (p.nameBn && p.nameBn.toLowerCase() === cleanLower)
      );

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (matched) {
        setLastMatchedProduct(matched);
        setScanError(null);
        playBeep(true);
        onItemScanned(matched);
        setRecentScans((prev) => [
          { code: cleanCode, matched: true, name: matched.name, time: timeStr },
          ...prev.slice(0, 3),
        ]);
      } else {
        setLastMatchedProduct(null);
        setScanError(
          isBangla
            ? `বারকোড "${cleanCode}" দিয়ে কোনো পণ্য পাওয়া যায়নি!`
            : `Barcode "${cleanCode}" not found in current inventory.`
        );
        playBeep(false);
        setRecentScans((prev) => [
          { code: cleanCode, matched: false, time: timeStr },
          ...prev.slice(0, 3),
        ]);
      }
    },
    [products, lastScannedCode, onItemScanned, isBangla, playBeep]
  );

  // Global USB Barcode Scanner & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Ignore when typing inside input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length >= 3) {
          handleDecodedCode(barcodeBufferRef.current);
          barcodeBufferRef.current = '';
        }
      } else if (e.key.length === 1) {
        // USB scanners type very fast (< 50ms per key)
        if (diff > 100) {
          barcodeBufferRef.current = '';
        }
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleDecodedCode, onClose]);

  // Initialize and stop scanner
  useEffect(() => {
    if (!isOpen) {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current
              .stop()
              .then(() => {
                html5QrCodeRef.current?.clear();
              })
              .catch(() => {});
          } else {
            html5QrCodeRef.current.clear();
          }
        } catch {
          // ignore cleanup err
        }
      }
      setScannerActive(false);
      setScanError(null);
      setLastMatchedProduct(null);
      setLastScannedCode(null);
      return;
    }

    let isMounted = true;

    // Detect cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          const camList = devices.map((d, index) => ({
            id: d.id,
            label: d.label || `Camera ${index + 1}`,
          }));
          setCameras(camList);
          // Prefer rear/environment camera if available
          const backCam = camList.find((c) =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('environment') ||
            c.label.toLowerCase().includes('rear')
          );
          setSelectedCameraId(backCam ? backCam.id : camList[camList.length - 1].id);
        } else {
          setScanError(
            isBangla
              ? 'কোনো ক্যামেরা পাওয়া যায়নি। নিচের বক্সে SKU/বারকোড লিখে যোগ করুন।'
              : 'No camera devices detected. You can type SKU or barcode below.'
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setScanError(
          isBangla
            ? `ক্যামেরা চালু সমস্যা: ${err?.message || 'পারমিশন দিন'}। নিচে SKU লিখেও যোগ করতে পারেন।`
            : `Camera access issue: ${err?.message || 'Permission denied'}. Manual input available below.`
        );
      });

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current
              .stop()
              .then(() => {
                html5QrCodeRef.current?.clear();
              })
              .catch(() => {});
          } else {
            html5QrCodeRef.current.clear();
          }
        } catch {
          // silent
        }
      }
    };
  }, [isOpen, isBangla]);

  // Start scanning when camera is selected
  useEffect(() => {
    if (!isOpen || !selectedCameraId) return;

    let isMounted = true;
    const readerElementId = 'barcode-scanner-view';

    // Delay slightly to ensure element is mounted in DOM
    const timer = setTimeout(() => {
      if (!isMounted) return;
      const elem = document.getElementById(readerElementId);
      if (!elem) return;

      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current
              .stop()
              .then(() => {
                startScanner();
              })
              .catch(() => {
                startScanner();
              });
            return;
          }
        } catch {
          // ignore
        }
      }

      startScanner();
    }, 200);

    function startScanner() {
      try {
        const scanner = new Html5Qrcode(readerElementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          verbose: false,
        });
        html5QrCodeRef.current = scanner;

        // Dynamic responsive qrbox calculation ensures it never throws on narrow screens
        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.floor(Math.min(viewfinderWidth * 0.85, 260));
            const height = Math.floor(Math.min(viewfinderHeight * 0.65, 140));
            return { width, height };
          },
        };

        scanner
          .start(
            selectedCameraId,
            config,
            (decodedText) => {
              if (isMounted) handleDecodedCode(decodedText);
            },
            () => {
              // frame scanned without barcode - normal, silent
            }
          )
          .then(() => {
            if (isMounted) {
              setScannerActive(true);
              setScanError(null);
            }
          })
          .catch((err) => {
            if (isMounted) {
              setScannerActive(false);
              setScanError(
                isBangla
                  ? `ক্যামেরা শুরু করা যায়নি: ${err?.message || 'পারমিশন দিন'}`
                  : `Camera stream failed: ${err?.message || 'Check permissions'}`
              );
            }
          });
      } catch (err: unknown) {
        const error = err as Error;
        if (isMounted) {
          setScanError(`Scanner init error: ${error?.message || 'Unknown'}`);
        }
      }
    }

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, selectedCameraId, handleDecodedCode, isBangla]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSkuInput.trim()) return;
    handleDecodedCode(manualSkuInput.trim());
    setManualSkuInput('');
    manualInputRef.current?.focus();
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="POS Barcode Scanner"
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-popup-backdrop"
      onClick={onClose}
    >
      {/* Scoped CSS to eliminate html5-qrcode injected spacing issues, default buttons & margins */}
      <style>{`
        #barcode-scanner-view {
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          max-height: 100% !important;
          overflow: hidden !important;
          border-radius: 0.75rem !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
        }
        #barcode-scanner-view__scan_region {
          position: relative !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          max-height: 100% !important;
          overflow: hidden !important;
          border-radius: 0.75rem !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        #barcode-scanner-view video,
        #barcode-scanner-view__scan_region video {
          width: 100% !important;
          height: 100% !important;
          min-height: 0 !important;
          max-height: 100% !important;
          object-fit: cover !important;
          border-radius: 0.75rem !important;
          margin: 0 !important;
          padding: 0 !important;
          display: block !important;
        }
        #barcode-scanner-view img,
        #barcode-scanner-view canvas,
        #barcode-scanner-view a,
        #barcode-scanner-view button,
        #barcode-scanner-view select,
        #barcode-scanner-view input,
        #barcode-scanner-view span:not(.scanner-custom-label),
        #barcode-scanner-view__dashboard,
        #barcode-scanner-view__header_message,
        #barcode-scanner-view__status_span,
        #barcode-scanner-view__dashboard_section,
        #barcode-scanner-view__dashboard_section_csr,
        #barcode-scanner-view__dashboard_section_fsr,
        #barcode-scanner-view__dashboard_section_swaplink {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
      `}</style>

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] text-slate-100 animate-popup-modal"
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Barcode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate">
                  {isBangla ? 'বারকোড স্ক্যানার' : 'POS Barcode Scanner'}
                </h3>
                <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-md">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {isBangla
                  ? 'ক্যামেরায় ধরুন বা নিচে SKU লিখে যোগ করুন'
                  : 'Align barcode or type SKU below'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setAudioFeedback(!audioFeedback)}
              title={audioFeedback ? 'Beep Sound Active' : 'Sound Muted'}
              className={`p-1.5 rounded-lg border transition-colors ${
                audioFeedback
                  ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-800/60 text-slate-500 border-slate-800 hover:text-slate-300'
              }`}
            >
              {audioFeedback ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewfinder & Controls Container */}
        <div className="p-3.5 sm:p-4 flex-1 overflow-y-auto space-y-2.5">
          {/* Camera Selection Toolbar (Compact) */}
          {cameras.length > 1 && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1 bg-slate-950/70 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-400 flex items-center gap-1.5 text-[11px]">
                <Camera className="w-3 h-3 text-slate-400" />
                <span>{isBangla ? 'ক্যামেরা:' : 'Camera:'}</span>
              </span>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-emerald-500"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scanner View Area - Compact height prevents vertical cramping */}
          <div className="relative w-full h-44 sm:h-52 bg-black rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            {/* The mounting element for html5-qrcode */}
            <div id="barcode-scanner-view" className="w-full h-full" />

            {/* Viewfinder Reticle Overlay */}
            {scannerActive && !scanError && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-48 sm:w-56 h-24 sm:h-28 border-2 border-emerald-500/70 rounded-lg bg-emerald-500/5">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />

                  {/* Red/Green laser scanning animation line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse top-1/2 -translate-y-1/2" />

                  <span className="absolute bottom-1 inset-x-0 text-center text-[10px] font-medium text-emerald-300 drop-shadow">
                    {isBangla ? 'বারকোড বক্সের মাঝে ধরুন' : 'Align Barcode Inside Box'}
                  </span>
                </div>
              </div>
            )}

            {/* Error or Loading state */}
            {scanError && (
              <div className="absolute inset-0 bg-slate-950/90 p-3 flex flex-col items-center justify-center text-center gap-1.5">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-300 font-medium max-w-xs">{scanError}</p>
                {cameras.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setScanError(null);
                      setSelectedCameraId((prev) => prev);
                    }}
                    className="mt-1 inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium border border-slate-700"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{isBangla ? 'আবার চেষ্টা' : 'Retry'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Feedback Banner for Last Scanned Item */}
          {lastMatchedProduct && (
            <div className="flex items-center justify-between p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-200 animate-slide-in">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-white truncate">
                    {isBangla ? lastMatchedProduct.nameBn || lastMatchedProduct.name : lastMatchedProduct.name}
                  </p>
                  <p className="text-[10px] text-emerald-300 font-mono">
                    SKU: {lastMatchedProduct.sku} · {formatBDT(lastMatchedProduct.sellPrice)}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 bg-emerald-500 text-slate-950 rounded-lg flex items-center gap-1">
                <Plus className="w-3 h-3" /> {isBangla ? 'যোগ হলো' : 'Added'}
              </span>
            </div>
          )}

          {/* Manual SKU input bar */}
          <form onSubmit={handleManualSubmit} className="flex gap-1.5 pt-0.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={manualInputRef}
                type="text"
                value={manualSkuInput}
                onChange={(e) => setManualSkuInput(e.target.value)}
                placeholder={
                  isBangla
                    ? 'SKU বা বারকোড নম্বর লিখুন (Enter চাপুন)...'
                    : 'Type SKU or barcode & press Enter...'
                }
                className="w-full min-h-[36px] bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!manualSkuInput.trim()}
              className="px-3 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
            >
              {isBangla ? 'যোগ করুন' : 'Add'}
            </button>
          </form>

          {/* Recent Scans History Mini Feed */}
          {recentScans.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {isBangla ? 'সর্বশেষ স্ক্যানকৃত কোড' : 'Recent Scans'}
              </span>
              <div className="divide-y divide-slate-800 bg-slate-950/50 rounded-xl border border-slate-800/80 px-2.5">
                {recentScans.map((scan, idx) => (
                  <div key={idx} className="py-1 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          scan.matched ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      <span className="font-mono text-slate-300 text-[11px]">{scan.code}</span>
                      {scan.name && (
                        <span className="text-slate-400 truncate max-w-[140px] text-[11px]">
                          — {scan.name}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0 font-mono">
                      {scan.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 py-2.5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs text-slate-400">
          <span className="text-[10px] flex items-center gap-1 text-slate-400">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>{isBangla ? 'ক্যামেরা ও USB স্ক্যানার সমর্থিত' : 'Camera & USB Scanners Supported'}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700"
          >
            {isBangla ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
