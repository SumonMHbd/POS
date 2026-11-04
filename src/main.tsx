import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

try {
  registerSW({
    immediate: true,
    onRegisterError(err) {
      console.warn('Service worker registration skipped:', err);
    },
  });
} catch {
  // Ignore service worker registration errors in restricted or subpath contexts
}

interface BoundaryState {
  error: Error | null;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl space-y-4">
            <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
              MHS POS · Recovery Mode
            </div>
            <h1 className="text-lg font-bold">Application Reload Needed</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {this.state.error.message || 'An unexpected startup error occurred.'}
            </p>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem('mhs_pos_active_session_v2');
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              Reset Session & Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
