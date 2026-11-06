import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Megaphone,
  Moon,
  Package,
  ShoppingCart,
  Store,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import type {
  AuthSessionUser,
  LanguageCode,
  PosStoreState,
  ShopFeatureEntitlements,
} from '../types/pos';
import { fetchPublicLoginDirectory, loginWithEmailPassword } from '../lib/googleWorkspace';

interface AuthLoginScreenProps {
  lang: LanguageCode;
  darkMode: boolean;
  onToggleLang: () => void;
  onToggleDark: () => void;
  onAuthenticated: (payload: {
    session: AuthSessionUser;
    globalAnnouncement: string;
    shopState: PosStoreState | null;
    shopEntitlements: ShopFeatureEntitlements | null;
  }) => void;
}

export const AuthLoginScreen: React.FC<AuthLoginScreenProps> = ({
  lang,
  darkMode,
  onToggleLang,
  onToggleDark,
  onAuthenticated,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorShakeKey, setErrorShakeKey] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [isLoadingAnnouncement, setIsLoadingAnnouncement] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPublicLoginDirectory()
      .then((dir) => {
        if (!active) return;
        setAnnouncement(dir.globalAnnouncement || '');
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingAnnouncement(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const res = await loginWithEmailPassword(email.trim(), password);
      onAuthenticated(res);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : '';
      const lower = raw.toLowerCase();
      if (lower.includes('suspended')) {
        setErrorMsg(
          lang === 'bn'
            ? 'এই দোকানের অ্যাকাউন্টটি সাময়িকভাবে স্থগিত আছে। বিস্তারিত জানতে অ্যাডমিনের সাথে যোগাযোগ করুন।'
            : raw
        );
      } else if (lower.includes('too many failed') || lower.includes('wait')) {
        setErrorMsg(
          lang === 'bn'
            ? 'একাধিকবার ভুল পাসওয়ার্ড চেষ্টার কারণে সাময়িকভাবে লক করা হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।'
            : raw
        );
      } else {
        setErrorMsg(
          lang === 'bn'
            ? 'আপনার দেওয়া ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার যাচাই করে চেষ্টা করুন।'
            : 'Incorrect email address or password. Please check your credentials and try again.'
        );
      }
      setErrorShakeKey((k) => k + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const featureHighlights = [
    {
      icon: ShoppingCart,
      iconBg: 'bg-emerald-100/90 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400',
      title: lang === 'bn' ? 'দ্রুত ক্যাশ মেমো ও পস বিলিং' : 'Fast Counter POS & Billing',
      desc:
        lang === 'bn'
          ? 'এক ক্লিকে পণ্য সিলেক্ট, নগদ, বিকাশ/নগদ ও বাকিতে বিক্রি এবং তাৎক্ষণিক রিসিট প্রিন্ট।'
          : '1-click item toggle, Cash, bKash/Nagad, Credit checkout, and instant thermal receipts.',
    },
    {
      icon: Package,
      iconBg: 'bg-violet-100/90 dark:bg-violet-950/70 text-violet-600 dark:text-violet-400',
      title: lang === 'bn' ? 'স্মার্ট স্টক ও ইনভেন্টরি অ্যালার্ট' : 'Live Stock & Reorder Alerts',
      desc:
        lang === 'bn'
          ? 'স্টক আউট ও কম স্টক পণ্যের তাৎক্ষণিক অ্যালার্ট এবং ক্যাটাগরিভিত্তিক পূর্ণ নিয়ন্ত্রণ।'
          : 'Separate real-time Out-of-Stock and Low-Stock alerts with effortless 1-tap restocking.',
    },
    {
      icon: TrendingUp,
      iconBg: 'bg-sky-100/90 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400',
      title: lang === 'bn' ? 'লাভ-ক্ষতি ও বাকির খাতা সিঙ্ক' : 'Profit Analytics & Cloud Sync',
      desc:
        lang === 'bn'
          ? 'মাসিক নিট লাভ, খরচের হিসাব, ক্রেতার বাকির খাতা এবং সার্বক্ষণিক ক্লাউড ব্যাকআপ।'
          : 'Track monthly net profit, customer dues, staff roles, and live Cloud sync.',
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-slate-100/85 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Subtle Dynamic Ambient Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-24 h-80 w-80 rounded-full bg-emerald-400/20 dark:bg-emerald-500/12 blur-3xl animate-float-slow"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 -right-24 h-96 w-96 rounded-full bg-sky-400/20 dark:bg-indigo-500/12 blur-3xl animate-float-delayed"
      />

      {/* Minimal Neumorphic Top Bar */}
      <header className="relative z-10 h-15 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md px-3.5 sm:px-4 lg:px-8 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-[3px_3px_8px_rgba(15,23,42,0.18),inset_1px_1px_1.5px_rgba(255,255,255,0.4)]">
            <Store className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight font-display truncate whitespace-nowrap">
              MHS POS
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate whitespace-nowrap">
              {lang === 'bn'
                ? 'স্মার্ট দোকান ও ইনভেন্টরি পস'
                : 'Smart Shop & Inventory POS'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <div
            role="group"
            aria-label="Language switcher"
            className="neu-well inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/90 p-1 gap-1"
          >
            <button
              type="button"
              onClick={() => lang !== 'bn' && onToggleLang()}
              className={`min-h-[28px] px-2.5 rounded-lg text-xs font-bold ${
                lang === 'bn'
                  ? 'bg-emerald-600 text-white'
                  : 'neu-flat text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer'
              }`}
            >
              BN
            </button>
            <button
              type="button"
              onClick={() => lang !== 'en' && onToggleLang()}
              className={`min-h-[28px] px-2.5 rounded-lg text-xs font-bold ${
                lang === 'en'
                  ? 'bg-emerald-600 text-white'
                  : 'neu-flat text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer'
              }`}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleDark}
            aria-label="Toggle theme"
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-white/80 dark:border-slate-700"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {isLoadingAnnouncement ? (
        <div className="relative z-10 border-b border-slate-200/50 dark:border-slate-800/50 bg-slate-50/60 dark:bg-slate-900/50 px-4 py-1.5 flex items-center justify-center">
          <div className="neu-skeleton h-3 w-56 rounded-md" />
        </div>
      ) : announcement ? (
        <div className="relative z-10 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-200 flex items-center sm:justify-center gap-2 overflow-x-auto no-scrollbar">
          <Megaphone className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span className="whitespace-nowrap">{announcement}</span>
        </div>
      ) : null}

      {/* Unified Shop Login Interface (Handles Super Admin, Shop Owner, Manager & Cashier Seamlessly) */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Showcase Column (Desktop) */}
          <div className="hidden lg:flex lg:col-span-6 flex-col space-y-6 animate-view-enter">
            <div className="space-y-3">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {lang === 'bn'
                  ? 'দোকান ও ব্যবসা পরিচালনা প্ল্যাটফর্ম'
                  : 'Complete Retail & Inventory Suite'}
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight text-balance">
                {lang === 'bn'
                  ? 'আপনার দোকানের বিক্রি, স্টক ও হিসাব — এক ড্যাশবোর্ডে'
                  : 'Run Your Shop Sales, Stock & Ledger from One Place'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                {lang === 'bn'
                  ? 'সহজ ও দ্রুত পস বিলিং, অটোমেটেড স্টক অ্যালার্ট, ক্রেতার বাকির খাতা এবং রিয়েল-টাইম ক্লাউড সিঙ্ক।'
                  : 'Designed for effortless daily counter billing, instant stock visibility, and accurate monthly profit tracking.'}
              </p>
            </div>

            <div className="space-y-3.5">
              {featureHighlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="neu-box rounded-2xl border border-white/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/85 p-4 flex items-start gap-3.5"
                  >
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconBg}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Unified Shop Login Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto animate-view-enter">
            <div className="neu-box-static rounded-3xl border border-white/90 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 p-5 sm:p-8">
              {/* Brand Emblem & Unified Shop Login Heading */}
              <div className="flex items-center gap-3 sm:gap-3.5 mb-5 sm:mb-6 min-w-0">
                <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-[4px_4px_10px_rgba(15,23,42,0.2),-2px_-2px_6px_rgba(255,255,255,0.85),inset_1px_1px_2px_rgba(255,255,255,0.4)]">
                  <Store className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold font-display text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
                    {lang === 'bn' ? 'দোকান লগইন' : 'Shop Login'}
                  </h1>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate whitespace-nowrap">
                    {lang === 'bn'
                      ? 'আপনার ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন'
                      : 'Sign in with your authorized email & password'}
                  </p>
                </div>
              </div>

              {/* Animated Error Alert on Wrong Email or Password */}
              {errorMsg && (
                <div
                  key={errorShakeKey}
                  role="alert"
                  aria-live="assertive"
                  className="animate-alert-shake mb-5 rounded-2xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/95 dark:bg-rose-950/50 p-3.5 flex items-start gap-3 shadow-[0_6px_18px_rgba(225,29,72,0.12)]"
                >
                  <div className="h-8 w-8 rounded-xl bg-rose-100 dark:bg-rose-900/70 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-rose-900 dark:text-rose-200">
                      {lang === 'bn' ? 'লগইন সম্পন্ন হয়নি!' : 'Authentication Failed'}
                    </div>
                    <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                      {errorMsg}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorMsg(null)}
                    aria-label="Dismiss error"
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg bg-white/80 dark:bg-slate-900/70 text-rose-600 dark:text-rose-300 shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="group">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === 'bn' ? 'ইমেইল ঠিকানা' : 'Email Address'}
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder={lang === 'bn' ? 'আপনার ইমেইল লিখুন' : 'name@shop.com'}
                      className={`neu-well w-full min-h-[46px] rounded-xl border bg-slate-100/70 dark:bg-slate-950/90 pl-10 pr-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition-colors ${
                        errorMsg
                          ? 'border-rose-400 dark:border-rose-700 focus:border-rose-500'
                          : 'border-slate-200/80 dark:border-slate-800 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {lang === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none h-4 w-4 text-slate-400 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="••••••••"
                      className={`neu-well w-full min-h-[46px] rounded-xl border bg-slate-100/70 dark:bg-slate-950/90 pl-10 pr-12 py-2.5 text-sm font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition-colors ${
                        errorMsg
                          ? 'border-rose-400 dark:border-rose-700 focus:border-rose-500'
                          : 'border-slate-200/80 dark:border-slate-800 focus:border-emerald-600'
                      }`}
                    />
                    <div className="absolute inset-y-0 right-2 flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400"
                        aria-label="Toggle password visibility"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="group w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60 whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />
                        <span className="whitespace-nowrap">
                          {lang === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Verifying credentials...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="whitespace-nowrap">
                          {lang === 'bn' ? 'লগইন করুন' : 'Sign In'}
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-5 pt-3.5 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between gap-2 min-w-0">
                <span className="truncate whitespace-nowrap">
                  {lang === 'bn' ? 'সুরক্ষিত ক্লাউড সেশন' : 'Encrypted Cloud Session'}
                </span>
                <span className="font-mono whitespace-nowrap shrink-0">MHS POS · ৳ BDT</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Contact Bar: WhatsApp Message for Purchase or Demo POS */}
      <footer className="relative z-10 px-4 sm:px-6 lg:px-10 pb-5 pt-1">
        <div className="w-full max-w-5xl mx-auto">
          <div className="neu-box rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-slate-50/95 dark:bg-slate-900/90 px-4 py-3.5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3.5">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="hidden sm:flex h-10 w-10 rounded-xl bg-emerald-100/95 dark:bg-emerald-950/75 text-emerald-600 dark:text-emerald-400 items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5 fill-current"
                >
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.83-.11-.42-.14-.97-.32-1.67-.62-2.94-1.27-4.86-4.23-5.01-4.43-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.84 2.04.91 2.19.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.61.17.3.76 1.26 1.64 2.04 1.13 1.01 2.08 1.32 2.38 1.47.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.49.22.57.34.07.13.07.72-.17 1.4z" />
                </svg>
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                  {lang === 'bn'
                    ? 'নতুন POS সফটওয়্যার কিনতে অথবা ফ্রি ডেমো (Demo POS) দেখতে যোগাযোগ করুন'
                    : 'Interested in Purchasing MHS POS or Requesting a Demo POS?'}
                </div>
              </div>
            </div>

            <a
              href={`https://wa.me/8801714605024?text=${encodeURIComponent(
                lang === 'bn'
                  ? 'আসসালামু আলাইকুম, আমি MHS POS সফটওয়্যারটি ক্রয় বা ডেমো (Demo POS) দেখতে আগ্রহী।'
                  : 'Hello, I would like to request a Demo POS or purchase MHS POS.'
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="neu-btn group w-full sm:w-auto min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs sm:text-sm font-bold text-white whitespace-nowrap shrink-0"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-4 w-4 fill-current shrink-0 transition-transform duration-200 group-hover:scale-110"
              >
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.82 14.01c-.24.68-1.41 1.3-1.95 1.38-.5.08-1.13.11-1.83-.11-.42-.14-.97-.32-1.67-.62-2.94-1.27-4.86-4.23-5.01-4.43-.15-.2-1.2-1.59-1.2-3.04 0-1.45.76-2.16 1.03-2.46.27-.3.59-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.59.84 2.04.91 2.19.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.61.17.3.76 1.26 1.64 2.04 1.13 1.01 2.08 1.32 2.38 1.47.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.4-.25.67-.15.27.1 1.73.82 2.03.97.3.15.49.22.57.34.07.13.07.72-.17 1.4z" />
              </svg>
              <span>
                {lang === 'bn'
                  ? 'মেসেজ করুন'
                  : 'Message Us'}
              </span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
