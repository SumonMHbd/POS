import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CloudCheck,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  Maximize2,
  Printer,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Table,
} from 'lucide-react';

interface StandaloneGoogleSheetViewProps {
  target?: string; // 'master' | 'shop-main' | shopId
  onBackToApp?: () => void;
}

export const StandaloneGoogleSheetView: React.FC<StandaloneGoogleSheetViewProps> = ({
  target = 'shop-main',
  onBackToApp,
}) => {
  const [currentWorkbook, setCurrentWorkbook] = useState<string>(() => {
    if (target === 'master' || target.includes('master')) return 'master';
    return target || 'shop-main';
  });

  const [activeTab, setActiveTab] = useState<string>('');
  const [dataPayload, setDataPayload] = useState<{
    ok: boolean;
    title?: string;
    type?: string;
    shopName?: string;
    tabs?: Record<string, (string | number)[][]>;
    lastSyncedAt?: string;
    sheetUrl?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>({ row: 0, col: 0 });
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [copySuccessNotice, setCopySuccessNotice] = useState<string | null>(null);

  // Column letters generator (A, B, C, ... Z, AA, AB...)
  const getColLetter = (index: number): string => {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  };

  const loadSheetData = useCallback(async (wbTarget: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const isMaster = wbTarget === 'master' || wbTarget.includes('master');
      const url = isMaster
        ? '/api/public/sheets/data?type=master'
        : `/api/public/sheets/data?shopId=${encodeURIComponent(wbTarget)}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load spreadsheet data (${res.status})`);
      }
      const data = await res.json();
      setDataPayload(data);

      const tabNames = Object.keys(data.tabs || {});
      if (tabNames.length > 0) {
        // Prefer Products_Inventory or Summary_Dashboard for shop, Admin_Users_Credentials for master
        if (isMaster) {
          setActiveTab(tabNames.includes('Admin_Users_Credentials') ? 'Admin_Users_Credentials' : tabNames[0]);
        } else {
          setActiveTab(
            tabNames.includes('Products_Inventory')
              ? 'Products_Inventory'
              : tabNames.includes('Summary_Dashboard')
              ? 'Summary_Dashboard'
              : tabNames[0]
          );
        }
      }
    } catch (err: unknown) {
      console.error('Error fetching sheet data:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Could not connect to live sheet database');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSheetData(currentWorkbook);
  }, [currentWorkbook, loadSheetData]);

  const tabs = useMemo(() => {
    return dataPayload?.tabs || {};
  }, [dataPayload]);

  const currentRows = useMemo(() => {
    if (!activeTab || !tabs[activeTab]) return [];
    return tabs[activeTab];
  }, [tabs, activeTab]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return currentRows;
    const q = searchQuery.toLowerCase();
    const [header, ...body] = currentRows;
    const matched = body.filter((row) =>
      row.some((cell) => String(cell || '').toLowerCase().includes(q))
    );
    return [header, ...matched];
  }, [currentRows, searchQuery]);

  // Selected cell value and coordinate (e.g., A1, C3)
  const cellCoordString = useMemo(() => {
    if (!selectedCell) return 'A1';
    return `${getColLetter(selectedCell.col)}${selectedCell.row + 1}`;
  }, [selectedCell]);

  const cellValue = useMemo(() => {
    if (!selectedCell || !filteredRows[selectedCell.row]) return '';
    return String(filteredRows[selectedCell.row][selectedCell.col] ?? '');
  }, [selectedCell, filteredRows]);

  const notifyCopy = (msg: string) => {
    setCopySuccessNotice(msg);
    setTimeout(() => setCopySuccessNotice(null), 3500);
  };

  const handleCopyActiveTabAsCsv = () => {
    if (!currentRows || currentRows.length === 0) return;
    const tsv = currentRows
      .map((row) => row.map((cell) => String(cell ?? '').replace(/\t/g, ' ')).join('\t'))
      .join('\n');
    navigator.clipboard.writeText(tsv);
    notifyCopy(`Copied "${activeTab.replace(/_/g, ' ')}" to clipboard! Paste into Google Sheets with Ctrl+V.`);
  };

  const handleDownloadCsv = () => {
    const isMaster = currentWorkbook === 'master' || currentWorkbook.includes('master');
    const param = isMaster
      ? `type=master&tab=${encodeURIComponent(activeTab)}`
      : `shopId=${encodeURIComponent(currentWorkbook)}&tab=${encodeURIComponent(activeTab)}`;
    window.open(`/api/public/sheets/csv?${param}`, '_blank');
  };

  const importDataFormula = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const isMaster = currentWorkbook === 'master' || currentWorkbook.includes('master');
    const param = isMaster
      ? `type=master&tab=${encodeURIComponent(activeTab || 'Admin_Users_Credentials')}`
      : `shopId=${encodeURIComponent(currentWorkbook || 'shop-main')}&tab=${encodeURIComponent(activeTab || 'Products_Inventory')}`;
    return `=IMPORTDATA("${origin}/api/public/sheets/csv?${param}")`;
  }, [currentWorkbook, activeTab]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white text-slate-900 select-none font-sans">
      {/* Google Sheets Authentic Header Bar */}
      <header className="flex flex-col border-b border-slate-200 bg-white">
        {/* Row 1: Logo, Document Title, Sync Status, Actions */}
        <div className="flex items-center justify-between px-3 py-1.5 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Google Sheets Green Icon */}
            <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-semibold text-slate-800 truncate leading-tight">
                  {dataPayload?.title ||
                    (currentWorkbook === 'master'
                      ? 'MHS POS Master Directory & Super Admin Vault'
                      : 'আমার ইলেকট্রনিকস শপ — MHS POS Storefront & Ledger')}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>

              {/* Menu items row */}
              <div className="hidden md:flex items-center gap-3 text-xs text-slate-600 mt-0.5">
                <span className="hover:bg-slate-100 px-1 py-0.5 rounded cursor-default">File</span>
                <span className="hover:bg-slate-100 px-1 py-0.5 rounded cursor-default">Edit</span>
                <span className="hover:bg-slate-100 px-1 py-0.5 rounded cursor-default">View</span>
                <span className="hover:bg-slate-100 px-1 py-0.5 rounded cursor-default">Insert</span>
                <span className="hover:bg-slate-100 px-1 py-0.5 rounded cursor-default">Format</span>
                <span className="hover:bg-slate-100 px-1 py-0.5 rounded cursor-default">Data</span>
                <span className="hover:bg-slate-100 px-1 py-0.5 rounded cursor-default">Tools</span>
                <span className="hover:bg-slate-100 px-1 py-0.5 rounded cursor-default">Help</span>
                <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-2">
                  <CloudCheck className="h-3 w-3 text-emerald-600" />
                  All data saved to MHS POS server
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons Right */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Switch Workbook dropdown if needed */}
            <div className="relative inline-block text-left">
              <select
                aria-label="Select workbook"
                value={currentWorkbook}
                onChange={(e) => setCurrentWorkbook(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer focus:outline-none"
              >
                <option value="shop-main">🏪 My Electronics Shop (16 Products Demo)</option>
                <option value="master">🔐 Super Admin Master Vault (All Credentials)</option>
                {currentWorkbook !== 'shop-main' && currentWorkbook !== 'master' && (
                  <option value={currentWorkbook}>
                    🏪 {dataPayload?.shopName || dataPayload?.title || `Shop (${currentWorkbook})`}
                  </option>
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowImportDialog(true)}
              className="h-8 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
              title="Open or import this live data into docs.google.com"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open in docs.google.com ↗</span>
              <span className="sm:hidden">Google Docs</span>
            </button>

            <button
              type="button"
              onClick={handleCopyActiveTabAsCsv}
              className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              title="Copy all rows from active tab for pasting into Google Sheets (Ctrl+V)"
            >
              <Copy className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden md:inline">Copy (Ctrl+V)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="h-8 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              title="Download active sheet as CSV"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden md:inline">CSV</span>
            </button>

            <button
              type="button"
              onClick={() => loadSheetData(currentWorkbook)}
              disabled={isLoading}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
              title="Reload live database from MHS POS server"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="h-8 inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer ml-1"
                title="Return to MHS POS Platform"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Back to App</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Formula Bar (Classic Google Sheets styling) */}
        <div className="flex items-center border-t border-slate-200 bg-slate-50/90 px-3 py-1 gap-2 text-xs">
          {/* Active Cell Coord Box */}
          <div className="h-6 w-14 rounded border border-slate-300 bg-white px-1.5 flex items-center justify-center font-mono font-bold text-slate-800 text-[11px] shadow-2xs">
            {cellCoordString}
          </div>

          {/* fx Function Symbol */}
          <div className="font-serif italic font-bold text-slate-400 select-none px-1 text-sm">
            fx
          </div>

          <div className="h-4 w-px bg-slate-300" />

          {/* Formula / Cell Content Input */}
          <div className="flex-1 font-mono text-slate-800 truncate px-1 py-0.5 bg-white rounded border border-slate-200 text-xs min-h-[24px] flex items-center">
            {cellValue || <span className="text-slate-400 italic">Empty cell</span>}
          </div>

          {/* Search Box */}
          <div className="relative shrink-0 w-44 sm:w-60">
            <Search className="absolute left-2 top-1.5 h-3 w-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in sheet..."
              className="h-6 w-full rounded border border-slate-300 bg-white pl-7 pr-2 text-[11px] text-slate-800 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1 text-[10px] text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="flex-1 overflow-auto bg-slate-100 relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
            <p className="text-sm font-semibold">Loading live sheet data from MHS POS server...</p>
          </div>
        ) : errorMsg ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <HelpCircle className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-rose-700">{errorMsg}</p>
            <button
              type="button"
              onClick={() => loadSheetData(currentWorkbook)}
              className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Retry
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
            No rows in active tab &ldquo;{activeTab}&rdquo;
          </div>
        ) : (
          <table className="border-collapse table-auto text-xs bg-white min-w-full">
            <thead>
              {/* Row 0: Column Letters (A, B, C...) */}
              <tr className="bg-slate-100 text-slate-500 font-semibold select-none sticky top-0 z-20 border-b border-slate-300">
                <th className="w-10 min-w-[40px] border-r border-b border-slate-300 bg-slate-200 text-center text-[10px] font-mono py-1 sticky left-0 z-30">
                  {/* Top-left corner */}
                </th>
                {filteredRows[0]?.map((_, colIdx) => (
                  <th
                    key={colIdx}
                    className={`border-r border-slate-300 text-center font-mono text-[11px] font-semibold py-1 px-2 min-w-[90px] ${
                      selectedCell?.col === colIdx ? 'bg-emerald-100 text-emerald-900 font-bold' : ''
                    }`}
                  >
                    {getColLetter(colIdx)}
                  </th>
                ))}
              </tr>

              {/* Row 1: Header Titles */}
              <tr className="bg-slate-50 text-slate-900 font-bold border-b-2 border-emerald-600 sticky top-[25px] z-10 shadow-xs">
                <th className="w-10 min-w-[40px] border-r border-b border-slate-300 bg-slate-100 text-center text-[10px] font-mono py-1.5 sticky left-0 z-20">
                  1
                </th>
                {filteredRows[0]?.map((cell, colIdx) => (
                  <th
                    key={colIdx}
                    onClick={() => setSelectedCell({ row: 0, col: colIdx })}
                    className={`border-r border-slate-300 px-3 py-1.5 text-left text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      selectedCell?.row === 0 && selectedCell?.col === colIdx
                        ? 'outline-2 outline-emerald-600 bg-emerald-50 text-emerald-900 z-10'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    {String(cell || '')}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRows.slice(1).map((row, rowIdx) => {
                const actualRowNumber = rowIdx + 2;
                const isSelectedRow = selectedCell?.row === actualRowNumber - 1;

                return (
                  <tr
                    key={rowIdx}
                    className={`border-b border-slate-200 hover:bg-emerald-50/40 transition-colors ${
                      rowIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                  >
                    {/* Row Number Column */}
                    <td
                      className={`w-10 min-w-[40px] border-r border-slate-300 text-center text-[10px] font-mono select-none sticky left-0 z-10 ${
                        isSelectedRow ? 'bg-emerald-200 text-emerald-950 font-bold' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {actualRowNumber}
                    </td>

                    {/* Data Cells */}
                    {row.map((cell, colIdx) => {
                      const isCellActive =
                        selectedCell?.row === actualRowNumber - 1 && selectedCell?.col === colIdx;
                      const cellStr = String(cell ?? '');
                      const isNumeric =
                        typeof cell === 'number' || (!isNaN(Number(cellStr)) && cellStr.trim() !== '');

                      return (
                        <td
                          key={colIdx}
                          onClick={() => setSelectedCell({ row: actualRowNumber - 1, col: colIdx })}
                          className={`border-r border-slate-200 px-3 py-1.5 text-xs truncate max-w-[340px] cursor-cell transition-all ${
                            isCellActive
                              ? 'outline-2 outline-emerald-600 bg-emerald-50 font-medium z-10'
                              : ''
                          } ${isNumeric ? 'text-right font-mono' : 'text-left'}`}
                          title={cellStr}
                        >
                          {cellStr}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom Sheet Tabs Bar (Just like Google Sheets) */}
      <footer className="flex items-center justify-between border-t border-slate-300 bg-slate-100 px-2 py-1 text-xs z-20">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-[85vw] no-scrollbar">
          <div className="px-2 text-[10px] font-bold uppercase text-slate-400 select-none">
            Tabs:
          </div>
          {Object.keys(tabs).map((tabName) => {
            const isActive = activeTab === tabName;
            return (
              <button
                key={tabName}
                type="button"
                onClick={() => {
                  setActiveTab(tabName);
                  setSelectedCell({ row: 0, col: 0 });
                }}
                className={`h-7 px-3 rounded-t-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all border-b-2 ${
                  isActive
                    ? 'bg-white text-emerald-800 font-bold border-emerald-600 shadow-2xs'
                    : 'bg-slate-200/80 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{tabName.replace(/_/g, ' ')}</span>
                {tabs[tabName]?.length > 0 && (
                  <span
                    className={`text-[10px] rounded-full px-1.5 py-0.2 ${
                      isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-300/80 text-slate-600'
                    }`}
                  >
                    {tabs[tabName].length - 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Info in Footer */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 shrink-0 pr-2">
          <span>{filteredRows.length > 0 ? `${filteredRows.length - 1} rows` : '0 rows'}</span>
          <span>·</span>
          <span>{filteredRows[0]?.length || 0} columns</span>
        </div>
      </footer>

      {/* Toast Notice */}
      {copySuccessNotice && (
        <div className="fixed bottom-12 right-4 z-50 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-xs font-semibold shadow-xl flex items-center gap-2 border border-emerald-500/40">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{copySuccessNotice}</span>
        </div>
      )}

      {/* Import to docs.google.com Modal Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Open in docs.google.com</h3>
                  <p className="text-[11px] text-slate-500">Live sync options for your personal Google Drive</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportDialog(false)}
                className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Option 1: Live Dynamic Formula */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                    Option 1: Live Auto-Sync Formula (Recommended)
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded">
                    Auto-Updates
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Paste this formula in cell <strong>A1</strong> in any Google Spreadsheet in your personal Google Drive. Google will automatically fetch and keep this tab updated:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={importDataFormula}
                    className="flex-1 font-mono text-[11px] bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-emerald-950 select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(importDataFormula);
                      notifyCopy('Formula copied! Paste into cell A1 in Google Sheets.');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Option 2: 1-Click Copy and Paste */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <span className="text-xs font-bold text-slate-800">
                  Option 2: Instant Clipboard Paste (Ctrl+V)
                </span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Copy all rows formatted with columns. Then open a sheet and press <strong>Ctrl+V</strong>:
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyActiveTabAsCsv}
                    className="flex-1 min-h-[34px] rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copy &ldquo;{activeTab.replace(/_/g, ' ')}&rdquo; (Ctrl+V)</span>
                  </button>
                  <a
                    href="https://sheets.new"
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[34px] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>Open sheets.new ↗</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowImportDialog(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
