import React, { useState } from 'react';
import {
  Download,
  Edit3,
  FileText,
  History,
  Shield,
  Store,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  UserRole,
  type AuditLogEntry,
  type LanguageCode,
  type PosStoreState,
  type StaffDashboardPermissions,
  type StaffMember,
  type WorkspaceTab,
} from '../types/pos';
import { getDefaultPermissionsForRole } from '../lib/storeDefaults';
import {
  exportCreditsCsv,
  exportExpensesCsv,
  exportInventoryCsv,
  exportMonthlyAuditCsv,
  exportSalesHistoryCsv,
} from '../lib/exportReports';
import { AppPopupModal } from './AppPopupModal';

interface ReportsAndAdminViewProps {
  state: PosStoreState;
  lang: LanguageCode;
  activeRole: UserRole;
  permissions?: StaffDashboardPermissions;
  onUpdateShopProfile: (patch: {
    shopNameBn: string;
    shopNameEn: string;
    businessType: string;
    phone: string;
    address: string;
  }) => void;
  onCreateStaffLogin: (payload: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
    permissions: StaffDashboardPermissions;
  }) => Promise<void>;
  onUpdateStaffLogin: (
    staffId: string,
    payload: {
      name?: string;
      phone?: string;
      role?: UserRole;
      newPassword?: string;
      permissions?: StaffDashboardPermissions;
    }
  ) => Promise<void>;
  onDeleteStaffLogin: (staff: StaffMember) => void;
  onOpenAuditPrint: () => void;
}

const ALL_TAB_OPTIONS: Array<{ id: WorkspaceTab; labelBn: string; labelEn: string }> = [
  { id: 'dashboard', labelBn: 'সারাংশ ও ট্রেন্ড', labelEn: 'Analytics Dashboard' },
  { id: 'pos', labelBn: 'পস কাউন্টার (বিক্রি)', labelEn: 'New Sale (POS)' },
  { id: 'sales_history', labelBn: 'বিক্রয় ইতিহাস', labelEn: 'Sales History' },
  { id: 'inventory', labelBn: 'পণ্য ও ক্যাটাগরি', labelEn: 'Products & Stock' },
  { id: 'credit_expenses', labelBn: 'বাকির খাতা ও খরচ', labelEn: 'Dues & Expenses' },
  { id: 'ecommerce', labelBn: 'ই-কমার্স ও শিপিং', labelEn: 'Online Orders' },
  { id: 'reports_admin', labelBn: 'স্টাফ ও রিপোর্ট', labelEn: 'Staff & Settings' },
];

export const ReportsAndAdminView: React.FC<ReportsAndAdminViewProps> = ({
  state,
  lang,
  activeRole,
  permissions,
  onUpdateShopProfile,
  onCreateStaffLogin,
  onUpdateStaffLogin,
  onDeleteStaffLogin,
  onOpenAuditPrint,
}) => {
  const canManageShopAndStaff =
    activeRole === UserRole.OWNER || activeRole === UserRole.SUPER_ADMIN;
  const canExportFinancials = permissions
    ? permissions.canViewProfit
    : activeRole === UserRole.OWNER ||
      activeRole === UserRole.SUPER_ADMIN ||
      activeRole === UserRole.MANAGER;

  // Shop Profile Form State
  const [shopNameBn, setShopNameBn] = useState(state.shopNameBn);
  const [shopNameEn, setShopNameEn] = useState(state.shopNameEn);
  const [businessType, setBusinessType] = useState(state.businessType || '');
  const [shopPhone, setShopPhone] = useState(state.phone || '');
  const [shopAddress, setShopAddress] = useState(state.address || '');

  // Create Manager / Cashier Login & Custom Dashboard Form State
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('123456');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState<UserRole>(UserRole.CASHIER);
  const [staffPerms, setStaffPerms] = useState<StaffDashboardPermissions>(() =>
    getDefaultPermissionsForRole(UserRole.CASHIER)
  );
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // Edit Existing Staff Dashboard Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<UserRole>(UserRole.CASHIER);
  const [editStaffNewPass, setEditStaffNewPass] = useState('');
  const [editStaffPerms, setEditStaffPerms] = useState<StaffDashboardPermissions>(() =>
    getDefaultPermissionsForRole(UserRole.CASHIER)
  );

  const [auditSearch, setAuditSearch] = useState('');

  const handleRolePresetChange = (nextRole: UserRole) => {
    setStaffRole(nextRole);
    setStaffPerms(getDefaultPermissionsForRole(nextRole));
  };

  const toggleAllowedTab = (
    current: StaffDashboardPermissions,
    setter: React.Dispatch<React.SetStateAction<StaffDashboardPermissions>>,
    tab: WorkspaceTab
  ) => {
    const exists = current.allowedTabs.includes(tab);
    const nextTabs = exists
      ? current.allowedTabs.filter((t) => t !== tab)
      : [...current.allowedTabs, tab];
    if (nextTabs.length === 0) return; // Require at least 1 tab
    setter({ ...current, allowedTabs: nextTabs });
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) return;
    setIsSavingStaff(true);
    try {
      await onCreateStaffLogin({
        name: staffName.trim(),
        email: staffEmail.trim().toLowerCase(),
        password: staffPassword.trim(),
        phone: staffPhone.trim(),
        role: staffRole,
        permissions: staffPerms,
      });
      setStaffName('');
      setStaffEmail('');
      setStaffPhone('');
      setStaffPassword('123456');
    } finally {
      setIsSavingStaff(false);
    }
  };

  const openEditStaffModal = (m: StaffMember) => {
    setEditingStaff(m);
    setEditStaffName(m.name);
    setEditStaffPhone(m.phone || '');
    setEditStaffRole(m.role);
    setEditStaffNewPass('');
    setEditStaffPerms(m.permissions || getDefaultPermissionsForRole(m.role));
  };

  const handleSaveStaffEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setIsSavingStaff(true);
    try {
      await onUpdateStaffLogin(editingStaff.id, {
        name: editStaffName.trim(),
        phone: editStaffPhone.trim(),
        role: editStaffRole,
        newPassword: editStaffNewPass.trim() || undefined,
        permissions: editStaffPerms,
      });
      setEditingStaff(null);
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateShopProfile({
      shopNameBn: shopNameBn.trim() || state.shopNameBn,
      shopNameEn: shopNameEn.trim() || state.shopNameEn,
      businessType: businessType.trim(),
      phone: shopPhone.trim(),
      address: shopAddress.trim(),
    });
  };

  const filteredLogs: AuditLogEntry[] = state.auditLogs.filter((log) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      log.entityLabel.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.actorName.toLowerCase().includes(q) ||
      log.actionType.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Section 1: Exportable Monthly Audit & CSV Report Hub */}
      <div className="neu-box rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5 sm:pb-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {lang === 'bn'
                  ? 'মাসিক অডিট-রেডি রিপোর্ট সেন্টার (PDF ও CSV)'
                  : 'Monthly Audit-Ready Report Center (PDF & CSV)'}
              </h2>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">
                {lang === 'bn'
                  ? 'ট্যাক্স, হিসাবরক্ষণ ও স্টক অডিটের জন্য বাংলা ও ইংরেজি সাপোর্টেড রিপোর্ট ডাউনলোড করুন'
                  : 'Generate print-ready financial statements and UTF-8 Bangla/English CSV ledgers'}
              </p>
            </div>
          </div>

          {canExportFinancials && (
            <button
              type="button"
              onClick={onOpenAuditPrint}
              className="min-h-[38px] sm:min-h-[42px] inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap shrink-0"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {lang === 'bn'
                  ? 'মাসিক অডিট PDF / প্রিন্ট স্টেটমেন্ট খুলুন'
                  : 'Open Monthly Audit PDF Statement'}
              </span>
            </button>
          )}
        </div>

        <div className="mt-3.5 sm:mt-4 grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3">
          {canExportFinancials && (
            <button
              type="button"
              onClick={() => exportMonthlyAuditCsv(state)}
              className="min-h-[40px] sm:min-h-[44px] flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 min-w-0"
            >
              <span className="truncate whitespace-nowrap">
                {lang === 'bn' ? 'মাসিক সারাংশ CSV' : 'Monthly Audit CSV'}
              </span>
              <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </button>
          )}
          <button
            type="button"
            onClick={() => exportSalesHistoryCsv(state.sales, state.categories)}
            className="min-h-[40px] sm:min-h-[44px] flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 min-w-0"
          >
            <span className="truncate whitespace-nowrap">
              {lang === 'bn' ? 'বিক্রয় ইতিহাস CSV' : 'Sales History CSV'}
            </span>
            <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => exportInventoryCsv(state.products)}
            className="min-h-[40px] sm:min-h-[44px] flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 min-w-0"
          >
            <span className="truncate whitespace-nowrap">
              {lang === 'bn' ? 'স্টক ভ্যালুয়েশন CSV' : 'Stock Valuation CSV'}
            </span>
            <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => exportCreditsCsv(state.credits)}
            className="min-h-[40px] sm:min-h-[44px] flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 min-w-0"
          >
            <span className="truncate whitespace-nowrap">
              {lang === 'bn' ? 'বাকির খাতা CSV' : 'Credit Dues CSV'}
            </span>
            <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          </button>
          {canExportFinancials && (
            <button
              type="button"
              onClick={() => exportExpensesCsv(state.expenses, state.selectedMonthKey)}
              className="min-h-[40px] sm:min-h-[44px] flex items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 min-w-0"
            >
              <span className="truncate whitespace-nowrap">
                {lang === 'bn' ? 'খরচের হিসাব CSV' : 'Expenses CSV'}
              </span>
              <Download className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* Section 2: Staff Custom Dashboard Builder (Manager / Cashier Logins) & Shop Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Manager & Cashier Login + Custom Dashboard Builder */}
        <div className="neu-box-static lg:col-span-8 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-3 min-w-0">
            <Shield className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {lang === 'bn'
                  ? 'ম্যানেজার ও ক্যাশিয়ার লগইন এবং কাস্টম ড্যাশবোর্ড তৈরি'
                  : 'Manager & Cashier Logins + Custom Dashboard Builder'}
              </h2>
              <p className="text-xs text-slate-500 leading-snug mt-0.5">
                {lang === 'bn'
                  ? 'আপনার দোকানের ম্যানেজার বা ক্যাশিয়ারের জন্য আলাদা ইমেইল-পাসওয়ার্ড এবং নির্দিষ্ট ড্যাশবোর্ড পারমিশন সেট করুন'
                  : 'Create dedicated Email & Password accounts for your Manager or Cashier and choose exactly what tabs & data they see'}
              </p>
            </div>
          </div>

          {/* Existing Staff Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
            <table className="pro-table">
              <thead>
                <tr>
                  <th className="w-44 min-w-[120px] text-left">
                    {lang === 'bn' ? 'স্টাফের নাম' : 'Staff Name'}
                  </th>
                  <th className="w-52 min-w-[140px] text-left">
                    {lang === 'bn' ? 'লগইন ইমেইল' : 'Login Email'}
                  </th>
                  <th className="min-w-[140px] text-left">
                    {lang === 'bn' ? 'রোল ও অ্যাক্সেস' : 'Role & Access'}
                  </th>
                  {canManageShopAndStaff && (
                    <th className="w-px text-right whitespace-nowrap">
                      {lang === 'bn' ? 'অ্যাকশন' : 'Actions'}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {state.staff.map((m) => {
                  const perms = m.permissions || getDefaultPermissionsForRole(m.role);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                        {m.name}
                      </td>
                      <td className="font-mono text-slate-500 break-all sm:break-normal">
                        {m.email}
                      </td>
                      <td>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {m.role}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1.5">
                          ({perms.allowedTabs.length} tabs
                          {perms.canViewProfit ? ' · Profit' : ' · Hide Profit'})
                        </span>
                      </td>
                      {canManageShopAndStaff && (
                        <td className="text-right whitespace-nowrap">
                          {m.role !== UserRole.OWNER ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditStaffModal(m)}
                                className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Edit Dashboard & Password"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteStaffLogin(m)}
                                className="p-1.5 rounded text-slate-400 hover:text-red-600"
                                title="Remove Staff"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                              Primary Owner
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add New Manager / Cashier Custom Dashboard Form */}
          {canManageShopAndStaff && (
            <form
              onSubmit={handleCreateStaffSubmit}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-4 text-xs"
            >
              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-emerald-600" />
                <span>
                  {lang === 'bn'
                    ? 'নতুন ম্যানেজার / ক্যাশিয়ার ড্যাশবোর্ড তৈরি করুন'
                    : 'Create New Manager / Cashier Account & Dashboard'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="block font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Karim (Cashier)"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Login Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="cashier@myshop.com"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Login Password *</label>
                  <input
                    type="text"
                    required
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Role Preset</label>
                  <select
                    value={staffRole}
                    onChange={(e) => handleRolePresetChange(e.target.value as UserRole)}
                    className="w-full min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-2 font-semibold"
                  >
                    <option value={UserRole.MANAGER}>Manager (ম্যানেজার)</option>
                    <option value={UserRole.CASHIER}>Cashier (ক্যাশিয়ার)</option>
                    <option value={UserRole.INVENTORY}>Inventory Staff (স্টক)</option>
                  </select>
                </div>
              </div>

              {/* Allowed Dashboard Tabs */}
              <div>
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 leading-snug">
                  {lang === 'bn'
                    ? 'ড্যাশবোর্ডে কোন কোন মেনু দেখতে পাবে নির্বাচন করুন:'
                    : 'Allowed Dashboard Menus for This Staff Member:'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_TAB_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 cursor-pointer min-w-0"
                    >
                      <input
                        type="checkbox"
                        checked={staffPerms.allowedTabs.includes(opt.id)}
                        onChange={() => toggleAllowedTab(staffPerms, setStaffPerms, opt.id)}
                        className="h-3.5 w-3.5 rounded text-emerald-600 shrink-0"
                      />
                      <span className="leading-snug break-words">
                        {lang === 'bn' ? opt.labelBn : opt.labelEn}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Granular Capabilities */}
              <div>
                <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1.5 leading-snug">
                  {lang === 'bn' ? 'বিশেষ ক্ষমতা (Permissions):' : 'Data & Action Permissions:'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={staffPerms.canViewProfit}
                      onChange={(e) =>
                        setStaffPerms({ ...staffPerms, canViewProfit: e.target.checked })
                      }
                      className="h-3.5 w-3.5 rounded text-emerald-600 shrink-0"
                    />
                    <span className="leading-snug break-words">
                      {lang === 'bn' ? 'লাভ ও ক্রয়মূল্য দেখবে' : 'View Profit & Buy Cost'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={staffPerms.canEditInventory}
                      onChange={(e) =>
                        setStaffPerms({ ...staffPerms, canEditInventory: e.target.checked })
                      }
                      className="h-3.5 w-3.5 rounded text-emerald-600 shrink-0"
                    />
                    <span className="leading-snug break-words">
                      {lang === 'bn' ? 'পণ্য ও ক্যাটাগরি এডিট' : 'Add/Edit Inventory'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={staffPerms.canManageExpenses}
                      onChange={(e) =>
                        setStaffPerms({ ...staffPerms, canManageExpenses: e.target.checked })
                      }
                      className="h-3.5 w-3.5 rounded text-emerald-600 shrink-0"
                    />
                    <span className="leading-snug break-words">
                      {lang === 'bn' ? 'খরচ যোগ করতে পারবে' : 'Manage Expenses'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={staffPerms.canDeleteItems}
                      onChange={(e) =>
                        setStaffPerms({ ...staffPerms, canDeleteItems: e.target.checked })
                      }
                      className="h-3.5 w-3.5 rounded text-emerald-600 shrink-0"
                    />
                    <span className="leading-snug break-words">
                      {lang === 'bn' ? 'পণ্য ডিলিট করতে পারবে' : 'Allow Delete SKUs'}
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingStaff}
                  className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                >
                  <UserPlus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {isSavingStaff
                      ? 'Creating...'
                      : lang === 'bn'
                      ? 'স্টাফ অ্যাকাউন্ট ও ড্যাশবোর্ড তৈরি করুন'
                      : 'Create Staff Login & Dashboard'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right 4 Cols: Shop Profile Settings */}
        <form
          onSubmit={handleSaveProfile}
          className="neu-box-static lg:col-span-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 min-w-0">
            <Store className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                {lang === 'bn' ? 'দোকানের নাম ও প্রোফাইল সেটিংস' : 'Shop Profile & Receipt Header'}
              </h2>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                {lang === 'bn'
                  ? 'রশিদ এবং রিপোর্টে ব্যবহৃত দোকানের তথ্য এডিট করুন'
                  : 'Customize shop name, phone, and address shown on receipts'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-medium mb-1">দোকানের নাম (বাংলা)</label>
              <input
                type="text"
                disabled={!canManageShopAndStaff}
                value={shopNameBn}
                onChange={(e) => setShopNameBn(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Shop Name (English)</label>
              <input
                type="text"
                disabled={!canManageShopAndStaff}
                value={shopNameEn}
                onChange={(e) => setShopNameEn(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Business Type</label>
              <input
                type="text"
                disabled={!canManageShopAndStaff}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Phone Number</label>
              <input
                type="text"
                disabled={!canManageShopAndStaff}
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Shop Address</label>
              <input
                type="text"
                disabled={!canManageShopAndStaff}
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 disabled:opacity-60"
              />
            </div>
          </div>

          {canManageShopAndStaff && (
            <button
              type="submit"
              className="min-h-[40px] w-full rounded-lg bg-slate-900 dark:bg-emerald-600 text-white font-semibold py-2 hover:opacity-90"
            >
              {lang === 'bn' ? 'দোকানের তথ্য সংরক্ষণ করুন' : 'Save Shop Profile'}
            </button>
          )}
        </form>
      </div>

      {/* Section 3: Historical Multi-User Audit Log */}
      <div className="neu-box-static rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <History className="h-4 w-4 text-emerald-600 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {lang === 'bn'
                ? 'বিস্তারিত ইতিহাস লগ (Historical Audit Trail)'
                : 'Immutable Multi-User Historical Audit Log'}
            </h3>
          </div>
          <input
            type="text"
            placeholder={lang === 'bn' ? 'লগ খুঁজুন...' : 'Filter audit log...'}
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            className="min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
          />
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="pro-table">
            <thead>
              <tr>
                <th className="w-40 text-left whitespace-nowrap">
                  {lang === 'bn' ? 'সময়' : 'Timestamp'}
                </th>
                <th className="w-44 text-left whitespace-nowrap">
                  {lang === 'bn' ? 'ব্যবহারকারী ও রোল' : 'Actor · Role'}
                </th>
                <th className="w-32 text-left whitespace-nowrap">
                  {lang === 'bn' ? 'অ্যাকশন' : 'Action'}
                </th>
                <th className="min-w-[180px] text-left">
                  {lang === 'bn' ? 'বিবরণ' : 'Entity & Details'}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{log.actorName}</span>
                    <span className="text-slate-400"> · {log.actorRole}</span>
                  </td>
                  <td className="font-mono text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    {log.actionType}
                  </td>
                  <td className="text-slate-700 dark:text-slate-300 break-words">
                    <strong>{log.entityLabel}:</strong> {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Staff Custom Dashboard & Password Modal */}
      <AppPopupModal
        isOpen={Boolean(editingStaff)}
        onClose={() => !isSavingStaff && setEditingStaff(null)}
        disableClose={isSavingStaff}
        maxWidthClass="max-w-5xl"
        heightMode="screen"
        ariaLabel="Edit Staff Dashboard & Password"
      >
        {editingStaff && (
          <form
            onSubmit={handleSaveStaffEditSubmit}
            className="flex-1 min-h-0 flex flex-col text-xs"
          >
            {/* Sticky Popup Header */}
            <div className="shrink-0 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/95 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
                    Edit Staff Dashboard & Password — {editingStaff.email}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    {lang === 'bn'
                      ? 'স্টাফের নাম, রোল, পাসওয়ার্ড এবং ড্যাশবোর্ড মেনু অ্যাক্সেস আপডেট করুন'
                      : 'Configure staff profile, login credentials, allowed workspace tabs, and permissions'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingStaff}
                onClick={() => setEditingStaff(null)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 shrink-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Popup Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editStaffName}
                    onChange={(e) => setEditStaffName(e.target.value)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={editStaffPhone}
                    onChange={(e) => setEditStaffPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                    Role
                  </label>
                  <select
                    value={editStaffRole}
                    onChange={(e) => setEditStaffRole(e.target.value as UserRole)}
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-semibold"
                  >
                    <option value={UserRole.MANAGER}>Manager</option>
                    <option value={UserRole.CASHIER}>Cashier</option>
                    <option value={UserRole.INVENTORY}>Inventory</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 truncate whitespace-nowrap">
                    Reset Password
                  </label>
                  <input
                    type="text"
                    value={editStaffNewPass}
                    onChange={(e) => setEditStaffNewPass(e.target.value)}
                    placeholder="Optional new password"
                    className="w-full min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {lang === 'bn'
                      ? 'ড্যাশবোর্ডে অনুমোদিত মেনু ট্যাবসমূহ:'
                      : 'Allowed Dashboard Menus:'}
                  </div>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                    {editStaffPerms.allowedTabs.length} / {ALL_TAB_OPTIONS.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ALL_TAB_OPTIONS.map((opt) => {
                    const checked = editStaffPerms.allowedTabs.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors min-w-0 ${
                          checked
                            ? 'border-emerald-500/70 bg-emerald-50/80 dark:bg-emerald-950/35 text-slate-900 dark:text-slate-100 font-semibold'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            toggleAllowedTab(editStaffPerms, setEditStaffPerms, opt.id)
                          }
                          className="h-4 w-4 rounded text-emerald-600 shrink-0"
                        />
                        <span className="leading-snug break-words">
                          {lang === 'bn' ? opt.labelBn : opt.labelEn}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-2.5">
                <div className="font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {lang === 'bn'
                    ? 'বিশেষ ক্ষমতা ও ডাটা পারমিশন:'
                    : 'Data Visibility & Action Permissions:'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={editStaffPerms.canViewProfit}
                      onChange={(e) =>
                        setEditStaffPerms({ ...editStaffPerms, canViewProfit: e.target.checked })
                      }
                      className="h-4 w-4 rounded text-emerald-600 shrink-0"
                    />
                    <span className="leading-snug break-words font-medium">
                      View Profit & Buy Price
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={editStaffPerms.canEditInventory}
                      onChange={(e) =>
                        setEditStaffPerms({
                          ...editStaffPerms,
                          canEditInventory: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded text-emerald-600 shrink-0"
                    />
                    <span className="leading-snug break-words font-medium">
                      Add / Edit Products & Stock
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={editStaffPerms.canManageExpenses}
                      onChange={(e) =>
                        setEditStaffPerms({
                          ...editStaffPerms,
                          canManageExpenses: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded text-emerald-600 shrink-0"
                    />
                    <span className="leading-snug break-words font-medium">
                      Manage Shop Expenses
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={editStaffPerms.canDeleteItems}
                      onChange={(e) =>
                        setEditStaffPerms({ ...editStaffPerms, canDeleteItems: e.target.checked })
                      }
                      className="h-4 w-4 rounded text-emerald-600 shrink-0"
                    />
                    <span className="leading-snug break-words font-medium">
                      Allow Delete SKUs
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Sticky Popup Footer */}
            <div className="shrink-0 px-4 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200/90 dark:border-slate-800 bg-slate-50/85 dark:bg-slate-950/75 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isSavingStaff}
                onClick={() => setEditingStaff(null)}
                className="min-h-[38px] px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingStaff}
                className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60 whitespace-nowrap"
              >
                {isSavingStaff ? 'Saving...' : 'Save Staff Dashboard'}
              </button>
            </div>
          </form>
        )}
      </AppPopupModal>
    </div>
  );
};
