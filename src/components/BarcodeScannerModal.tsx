import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  Plus
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

      // Debounce: don't process same code within 1.4 seconds, or different code within 400ms
      if (
        cleanCode === lastScannedCode &&
        now - lastScanTimestampRef.current < 1400
      ) {
        return;
      }
      if (now - lastScanTimestampRef.current < 400) {
        return;
      }
      lastScanTimestampRef.current = now;
      setLastScannedCode(cleanCode);

      // Find product by SKU, ID, or case-insensitive match
      const matched = products.find(
        (p) =>
          p.sku.toLowerCase() === cleanCode.toLowerCase() ||
          p.id.toLowerCase() === cleanCode.toLowerCase() ||
          p.name.toLowerCase() === cleanCode.toLowerCase()
      );

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      if (matched) {
        setLastMatchedProduct(matched);
        setScanError(null);
        playBeep(true);
        onItemScanned(matched);
        setRecentScans((prev) => [
          { code: cleanCode, matched: true, name: matched.name, time: timeStr },
          ...prev.slice(0, 4),
        ]);
      } else {
        setLastMatchedProduct(null);
        setScanError(
          isBangla
            ? `বারকোড "${cleanCode}" দিয়ে কোনো পণ্য খুঁজে পাওয়া যায়নি!`
            : `Barcode "${cleanCode}" not found in current inventory.`
        );
        playBeep(false);
        setRecentScans((prev) => [
          { code: cleanCode, matched: false, time: timeStr },
          ...prev.slice(0, 4),
        ]);
      }
    },
    [products, lastScannedCode, onItemScanned, isBangla, playBeep]
  );

  // Initialize and stop scanner
  useEffect(() => {
    if (!isOpen) {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().then(() => {
              html5QrCodeRef.current?.clear();
            }).catch(() => {});
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
          // Prefer back/environment camera if available
          const backCam = camList.find((c) =>
            c.label.toLowerCase().includes('back') ||
            c.label.toLowerCase().includes('environment') ||
            c.label.toLowerCase().includes('rear')
          );
          setSelectedCameraId(backCam ? backCam.id : camList[camList.length - 1].id);
        } else {
          setScanError(
            isBangla
              ? 'কোনো ক্যামেরা পাওয়া যায়নি। ক্যামেরা অ্যাক্সেস পারমিশন নিশ্চিত করুন।'
              : 'No camera devices detected. Please grant camera permission.'
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setScanError(
          isBangla
            ? `ক্যামেরা চালু করতে সমস্যা: ${err?.message || 'পারমিশন দিন'}`
            : `Camera access failed: ${err?.message || 'Permission denied'}`
        );
      });

    return () => {
      isMounted = false;
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().then(() => {
              html5QrCodeRef.current?.clear();
            }).catch(() => {});
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

    // Delay slightly to ensure element is in DOM
    const timer = setTimeout(() => {
      if (!isMounted) return;
      const elem = document.getElementById(readerElementId);
      if (!elem) return;

      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().then(() => {
              startScanner();
            }).catch(() => {
              startScanner();
            });
            return;
          }
        } catch {
          // ignore
        }
      }

      startScanner();
    }, 250);

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

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.333,
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
                  : `Could not start camera feed: ${err?.message || 'Check permissions'}`
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {isBangla ? 'ক্যামেরা বারকোড স্ক্যানার' : 'POS Barcode Scanner'}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                  Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isBangla
                  ? 'বারকোড ক্যামেরার সামনে ধরুন, স্বয়ংক্রিয়ভাবে কার্টে যোগ হবে'
                  : 'Point camera at product barcode to auto-add to cart'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAudioFeedback(!audioFeedback)}
              title={audioFeedback ? 'Sound Muted' : 'Sound Enabled'}
              className={`p-2 rounded-lg border transition-colors ${
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
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Container */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3.5">
          {/* Camera Selection Toolbar */}
          {cameras.length > 1 && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-slate-400" />
                {isBangla ? 'ক্যামেরা সুইচ:' : 'Camera:'}
              </span>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
              >
                {cameras.map((cam) => (
                  <option key={cam.id} value={cam.id}>
                    {cam.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scanner View Area */}
          <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            {/* The mounting element for html5-qrcode */}
            <div id="barcode-scanner-view" className="w-full h-full" />

            {/* Viewfinder Reticle Overlay */}
            {scannerActive && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-[260px] h-[160px] border-2 border-emerald-500/70 rounded-lg bg-emerald-500/5">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

                  {/* Red/Green laser scanning animation line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse top-1/2 -translate-y-1/2" />

                  <span className="absolute bottom-2 inset-x-0 text-center text-[11px] font-medium text-emerald-300 drop-shadow">
                    {isBangla ? 'বারকোড ফ্রেমের মাঝে রাখুন' : 'Align Barcode Inside Box'}
                  </span>
                </div>
              </div>
            )}

            {/* Error or Loading state */}
            {scanError && (
              <div className="absolute inset-0 bg-slate-950/85 p-4 flex flex-col items-center justify-center text-center gap-2">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
                <p className="text-xs text-amber-300 font-medium max-w-xs">{scanError}</p>
                {cameras.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setScanError(null);
                      setSelectedCameraId((prev) => prev);
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {isBangla ? 'পুনরায় চেষ্টা করুন' : 'Retry Camera'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Feedback Banner for Last Scanned Item */}
          {lastMatchedProduct && (
            <div className="flex items-center justify-between p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-emerald-200 animate-slide-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-white truncate">
                    {isBangla ? lastMatchedProduct.nameBn || lastMatchedProduct.name : lastMatchedProduct.name}
                  </p>
                  <p className="text-[11px] text-emerald-300">
                    SKU: {lastMatchedProduct.sku} · {formatBDT(lastMatchedProduct.sellPrice)}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-bold px-2.5 py-1 bg-emerald-500 text-slate-950 rounded-lg flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> {isBangla ? 'যোগ হলো' : 'Added'}
              </span>
            </div>
          )}

          {/* Manual SKU input bar */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={manualSkuInput}
                onChange={(e) => setManualSkuInput(e.target.value)}
                placeholder={
                  isBangla
                    ? 'ক্যামেরা সমস্যা হলে SKU বা বারকোড টাইপ করুন...'
                    : 'Type SKU or barcode number manually...'
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={!manualSkuInput.trim()}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
            >
              {isBangla ? 'যোগ করুন' : 'Add SKU'}
            </button>
          </form>

          {/* Recent Scans History Mini Feed */}
          {recentScans.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {isBangla ? 'সর্বশেষ স্ক্যানকৃত কোড' : 'Recent Scans'}
              </span>
              <div className="divide-y divide-slate-800 bg-slate-950/40 rounded-xl border border-slate-800/80 px-3">
                {recentScans.map((scan, idx) => (
                  <div key={idx} className="py-1.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          scan.matched ? 'bg-emerald-400' : 'bg-rose-400'
                        }`}
                      />
                      <span className="font-mono text-slate-300">{scan.code}</span>
                      {scan.name && (
                        <span className="text-slate-400 truncate max-w-[150px]">
                          — {scan.name}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {scan.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <span>{isBangla ? 'সমর্থিত: EAN, UPC, Code128, QR' : 'Supports: EAN-13, UPC, Code128, QR'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors border border-slate-700"
          >
            {isBangla ? 'বন্ধ করুন' : 'Done / Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
