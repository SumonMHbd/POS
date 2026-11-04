import React from 'react';
import type { LanguageCode } from '../types/pos';

/**
 * Reusable Neumorphic Skeleton Screens for boot, workspace transitions,
 * Super Admin refreshes, and live table/sync hydration.
 */
export const DashboardWorkspaceSkeleton: React.FC<{ lang?: LanguageCode }> = ({ lang = 'bn' }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={lang === 'bn' ? 'ডাটা লোড হচ্ছে...' : 'Loading workspace data...'}
      className="space-y-6 animate-view-enter"
    >
      {/* Top Toolbar / Action Bar Skeleton */}
      <div className="neu-box-static rounded-2xl border border-white/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="neu-skeleton h-4 w-48 rounded-lg" />
          <div className="neu-skeleton h-3 w-64 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="neu-skeleton h-9 w-28 rounded-xl" />
          <div className="neu-skeleton h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* 4 Executive KPI Card Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((idx) => (
          <div
            key={idx}
            className="neu-box-static rounded-2xl border border-white/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="neu-skeleton h-3.5 w-28 rounded-md" />
              <div className="neu-skeleton h-8 w-8 rounded-xl shrink-0" />
            </div>
            <div className="neu-skeleton h-7 w-36 rounded-lg" />
            <div className="neu-skeleton h-3 w-40 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Analytics Chart + Breakdown Panel Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 neu-box-static rounded-2xl border border-white/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="neu-skeleton h-4 w-52 rounded-lg" />
              <div className="neu-skeleton h-3 w-72 rounded-md" />
            </div>
            <div className="neu-skeleton h-8 w-24 rounded-xl" />
          </div>
          <div className="pt-2 grid grid-cols-6 items-end gap-3 h-52">
            <div className="neu-skeleton h-28 rounded-t-xl" />
            <div className="neu-skeleton h-40 rounded-t-xl" />
            <div className="neu-skeleton h-24 rounded-t-xl" />
            <div className="neu-skeleton h-48 rounded-t-xl" />
            <div className="neu-skeleton h-36 rounded-t-xl" />
            <div className="neu-skeleton h-44 rounded-t-xl" />
          </div>
        </div>

        <div className="lg:col-span-4 neu-box-static rounded-2xl border border-white/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="neu-skeleton h-4 w-40 rounded-lg" />
          <div className="space-y-3.5 pt-1">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="neu-skeleton h-3 w-28 rounded-md" />
                  <div className="neu-skeleton h-3 w-16 rounded-md" />
                </div>
                <div className="neu-skeleton h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table Skeleton */}
      <div className="neu-box-static rounded-2xl border border-white/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="neu-skeleton h-9 w-64 rounded-xl" />
          <div className="flex items-center gap-2">
            <div className="neu-skeleton h-9 w-28 rounded-xl" />
            <div className="neu-skeleton h-9 w-24 rounded-xl" />
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {[0, 1, 2, 3, 4].map((r) => (
            <div key={r} className="px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="neu-skeleton h-9 w-9 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <div className="neu-skeleton h-3.5 w-40 rounded-md" />
                  <div className="neu-skeleton h-2.5 w-28 rounded-md" />
                </div>
              </div>
              <div className="hidden sm:block neu-skeleton h-3.5 w-24 rounded-md" />
              <div className="hidden md:block neu-skeleton h-3.5 w-20 rounded-md" />
              <div className="neu-skeleton h-8 w-24 rounded-xl shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Full-screen Workspace Shell Skeleton (Sidebar + Top Header + Dashboard Content + Mobile Nav)
 * Displayed during initial session restoration or when switching/opening a shop POS workspace.
 */
export const WorkspaceShellSkeleton: React.FC<{ lang?: LanguageCode }> = ({ lang = 'bn' }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={lang === 'bn' ? 'অ্যাপ লোড হচ্ছে...' : 'Loading application workspace...'}
      className="min-h-screen flex flex-col lg:flex-row bg-slate-100/75 dark:bg-slate-950"
    >
      {/* Left Desktop Sidebar Skeleton */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-slate-200/80 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900 sticky top-0 h-screen">
        <div className="h-14 px-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
          <div className="neu-skeleton h-8 w-8 rounded-lg shrink-0" />
          <div className="space-y-1.5 flex-1">
            <div className="neu-skeleton h-3.5 w-24 rounded-md" />
            <div className="neu-skeleton h-2.5 w-32 rounded-md" />
          </div>
        </div>

        <div className="flex-1 px-3.5 py-5 space-y-2.5">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="h-11 rounded-xl border border-white/70 dark:border-slate-800 bg-white/75 dark:bg-slate-800/50 px-3 flex items-center gap-3"
            >
              <div className="neu-skeleton h-7 w-7 rounded-lg shrink-0" />
              <div className="neu-skeleton h-3.5 flex-1 rounded-md" />
            </div>
          ))}
        </div>

        <div className="p-3.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="neu-skeleton h-10 w-full rounded-xl" />
          <div className="neu-skeleton h-9 w-full rounded-xl" />
        </div>
      </aside>

      {/* Main Content Area Skeleton */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Top Sticky Header Skeleton */}
        <header className="h-14 flex items-center justify-between gap-3 px-4 lg:px-8 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <div className="lg:hidden neu-skeleton h-8 w-8 rounded-lg shrink-0" />
            <div className="neu-skeleton h-5 w-44 sm:w-56 rounded-lg" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="neu-skeleton h-9 w-20 rounded-xl" />
            <div className="neu-skeleton h-9 w-9 rounded-xl" />
          </div>
        </header>

        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6 max-w-7xl w-full mx-auto">
          <DashboardWorkspaceSkeleton lang={lang} />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar Skeleton */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-slate-50/95 dark:bg-slate-900/95 border-t border-slate-200/90 dark:border-slate-800 px-3 py-2">
        <div className="grid grid-cols-5 gap-2 h-full">
          {[0, 1, 2, 3, 4].map((idx) => (
            <div key={idx} className="neu-skeleton h-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Super Admin Portal Skeleton (Overview KPIs, Multi-Shop BarChart & Directory Rows)
 */
export const SuperAdminSkeleton: React.FC<{ lang?: LanguageCode }> = ({ lang = 'bn' }) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={lang === 'bn' ? 'সুপার অ্যাডমিন ডাটা লোড হচ্ছে...' : 'Loading Super Admin overview...'}
      className="space-y-6 animate-view-enter"
    >
      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="neu-skeleton h-3.5 w-32 rounded-md" />
              <div className="neu-skeleton h-8 w-8 rounded-xl shrink-0" />
            </div>
            <div className="neu-skeleton h-7 w-28 rounded-lg" />
            <div className="neu-skeleton h-3 w-40 rounded-md" />
          </div>
        ))}
      </div>

      {/* Shop Comparison Chart Card Skeleton */}
      <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="neu-skeleton h-4 w-60 rounded-lg" />
            <div className="neu-skeleton h-3 w-80 max-w-full rounded-md" />
          </div>
          <div className="neu-skeleton h-9 w-28 rounded-xl" />
        </div>
        <div className="h-52 pt-4 grid grid-cols-6 items-end gap-4">
          <div className="neu-skeleton h-32 rounded-t-xl" />
          <div className="neu-skeleton h-44 rounded-t-xl" />
          <div className="neu-skeleton h-28 rounded-t-xl" />
          <div className="neu-skeleton h-40 rounded-t-xl" />
          <div className="neu-skeleton h-36 rounded-t-xl" />
          <div className="neu-skeleton h-48 rounded-t-xl" />
        </div>
      </div>

      {/* Tenant Shops Directory Table Skeleton */}
      <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-[220px]">
            <div className="neu-skeleton h-9 w-64 rounded-xl" />
            <div className="neu-skeleton h-9 w-28 rounded-xl" />
          </div>
          <div className="neu-skeleton h-9 w-24 rounded-xl" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="px-4 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="neu-skeleton h-10 w-10 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <div className="neu-skeleton h-3.5 w-44 rounded-md" />
                  <div className="neu-skeleton h-2.5 w-32 rounded-md" />
                </div>
              </div>
              <div className="hidden md:block neu-skeleton h-4 w-24 rounded-md" />
              <div className="hidden lg:block neu-skeleton h-4 w-24 rounded-md" />
              <div className="flex items-center gap-2">
                <div className="neu-skeleton h-8 w-24 rounded-xl" />
                <div className="neu-skeleton h-8 w-8 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Table Row Skeletons for inline sync states (e.g., E-Commerce Order Sync)
 */
export const TableRowsSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 4,
  cols = 6,
}) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx}>
          {Array.from({ length: cols }).map((__, cIdx) => (
            <td key={cIdx}>
              <div
                className={`neu-skeleton h-3.5 rounded-md ${
                  cIdx === 0 ? 'w-24' : cIdx === cols - 1 ? 'w-16 ml-auto' : 'w-28'
                }`}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};
