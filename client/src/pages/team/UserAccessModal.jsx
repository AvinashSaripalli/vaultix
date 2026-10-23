import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  X,
  Search,
  ShieldCheck,
  PencilLine,
  Eye,
  Crown,
  Ban,
  KeyRound,
  Folder,
  Building2,
  Trash2,
  Plus,
  RefreshCw,
  MinusCircle,
  FolderKey,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import api from '../../services/api';
import ModalPortal, { ModalBackdrop } from '../../components/common/ModalPortal';
import RoleBadge from '../../components/common/RoleBadge';
import { showToast } from '../../utils/toast';

const ACCESS_LEVEL_META = {
  ADMINISTRATOR: {
    label: 'Administrator',
    icon: Crown,
    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  FULL_ACCESS: {
    label: 'Full access',
    icon: ShieldCheck,
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  READ_WRITE: {
    label: 'Read and write',
    icon: PencilLine,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  READ_ONLY: {
    label: 'Read only',
    icon: Eye,
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  FORBIDDEN: {
    label: 'Forbidden',
    icon: Ban,
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
};

const ACCESS_OPTIONS = [
  { value: 'ADMINISTRATOR', label: 'Administrator' },
  { value: 'FULL_ACCESS', label: 'Full access' },
  { value: 'READ_WRITE', label: 'Read and write' },
  { value: 'READ_ONLY', label: 'Read only' },
  { value: 'FORBIDDEN', label: 'Forbidden' },
];

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function UserAccessModal({
  open,
  onClose,
  userId,
  userName = '',
  userEmail = '',
  userRole = 'USER',
}) {
  const { token, user: currentUser } = useSelector((state) => state.auth);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'ACCESSIBLE' | 'DIRECT' | 'DEPARTMENT' | 'FORBIDDEN'

  // Inline grant state for adding direct permissions
  const [grantingFolderId, setGrantingFolderId] = useState(null);
  const [grantLevel, setGrantLevel] = useState('READ_ONLY');
  const [actionInProgress, setActionInProgress] = useState(null);

  const fetchAccess = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/users/${userId}/access`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load user access details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && userId) {
      fetchAccess();
      setSearch('');
      setActiveFilter('ALL');
      setGrantingFolderId(null);
    }
  }, [open, userId]);

  if (!open) return null;

  const targetUser = data?.user || { fullName: userName, email: userEmail, role: userRole };
  const stats = data?.stats || {
    totalFolders: 0,
    accessibleFolders: 0,
    directGrants: 0,
    deptGrants: 0,
    forbiddenOrBlocked: 0,
  };
  const departments = data?.departments || [];
  const allFolders = data?.folders || [];

  // Filter & Search logic
  const filteredFolders = allFolders.filter((f) => {
    // Search query
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      f.folderName.toLowerCase().includes(q) ||
      f.vaultName.toLowerCase().includes(q) ||
      (f.viaDepartments || []).some((d) => d.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // Filter pill
    if (activeFilter === 'ACCESSIBLE') return f.hasAccess;
    if (activeFilter === 'DIRECT') return Boolean(f.directPermission && f.directPermission.accessLevel !== 'FORBIDDEN');
    if (activeFilter === 'DEPARTMENT') return f.accessSource === 'DEPARTMENT';
    if (activeFilter === 'FORBIDDEN') return f.effectiveAccess === 'FORBIDDEN';

    return true;
  });

  // Action: Update direct permission level
  const handleUpdatePermission = async (folder, newLevel) => {
    if (!folder.directPermission?.id) return;
    try {
      setActionInProgress(folder.folderId);
      await api.put(
        `/folders/permissions/${folder.directPermission.id}`,
        { accessLevel: newLevel },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast(`Updated access to ${newLevel} for "${folder.folderName}"`, 'success');
      await fetchAccess();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update permission', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Action: Revoke direct permission
  const handleRevokeDirectPermission = async (folder) => {
    if (!folder.directPermission?.id) return;
    try {
      setActionInProgress(folder.folderId);
      await api.delete(`/folders/permissions/${folder.directPermission.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showToast(`Revoked direct permission for "${folder.folderName}"`, 'success');
      await fetchAccess();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to revoke permission', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  // Action: Grant new direct permission
  const handleGrantDirectPermission = async (folderId, folderName) => {
    if (!targetUser?.email) return;
    try {
      setActionInProgress(folderId);
      await api.post(
        `/folders/${folderId}/share`,
        {
          userEmail: targetUser.email,
          accessLevel: grantLevel,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast(`Granted ${grantLevel} to "${folderName}"`, 'success');
      setGrantingFolderId(null);
      await fetchAccess();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to grant permission', 'error');
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <ModalPortal open={open} onClose={onClose}>
      <ModalBackdrop onClose={onClose}>
        <div
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 dark:bg-slate-850 dark:border-slate-700 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-md shrink-0">
                {getInitials(targetUser.fullName || targetUser.email)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {targetUser.fullName || 'User Access'}
                  </h2>
                  <RoleBadge role={targetUser.role || 'USER'} />
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      targetUser.isActive
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {targetUser.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {targetUser.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchAccess}
                disabled={loading}
                title="Refresh access details"
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* System Admin Notice if Super Admin or Admin */}
            {['SUPER_ADMIN', 'ADMIN'].includes(targetUser.role) && (
              <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 dark:bg-purple-950/30 dark:border-purple-900/60 flex items-start gap-3">
                <Crown className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" size={18} />
                <div className="text-xs sm:text-sm text-purple-900 dark:text-purple-200">
                  <span className="font-bold">System Administrator Access:</span> Because this user has the{' '}
                  <span className="font-semibold">{targetUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</span> role,
                  they inherently possess full administrative privileges over all company vaults and folders across the organization.
                </div>
              </div>
            )}

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-750 dark:bg-slate-800/50">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Accessible Folders</div>
                <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {stats.accessibleFolders} <span className="text-xs font-normal text-slate-400">/ {stats.totalFolders}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-750 dark:bg-slate-800/50">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Direct Grants</div>
                <div className="mt-1 text-xl font-bold text-indigo-600 dark:text-indigo-400">
                  {stats.directGrants}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-750 dark:bg-slate-800/50">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Via Departments</div>
                <div className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.deptGrants}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 dark:border-slate-750 dark:bg-slate-800/50">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Forbidden / Blocked</div>
                <div className="mt-1 text-xl font-bold text-rose-600 dark:text-rose-400">
                  {stats.forbiddenOrBlocked}
                </div>
              </div>
            </div>

            {/* Department Memberships */}
            {departments.length > 0 && (
              <div className="flex items-center flex-wrap gap-2 text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Building2 size={13} />
                  Departments:
                </span>
                {departments.map((dept) => (
                  <span
                    key={dept.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 font-medium"
                  >
                    <span>{dept.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({dept.role})</span>
                  </span>
                ))}
              </div>
            )}

            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search folders or vaults…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {[
                  { key: 'ALL', label: 'All', count: stats.totalFolders },
                  { key: 'ACCESSIBLE', label: 'Accessible', count: stats.accessibleFolders },
                  { key: 'DIRECT', label: 'Direct', count: stats.directGrants },
                  { key: 'DEPARTMENT', label: 'Via Dept', count: stats.deptGrants },
                  { key: 'FORBIDDEN', label: 'Forbidden', count: stats.forbiddenOrBlocked },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveFilter(tab.key)}
                    className={`h-8 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                      activeFilter === tab.key
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        activeFilter === tab.key
                          ? 'bg-indigo-700 text-indigo-100'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/60 dark:text-rose-300">
                {error}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                <RefreshCw size={24} className="mx-auto animate-spin mb-2" />
                <p className="text-xs">Loading permissions & folder access…</p>
              </div>
            )}

            {/* Folders List Table */}
            {!loading && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 font-semibold">
                      <tr>
                        <th className="py-3 px-4">Folder</th>
                        <th className="py-3 px-4">Vault</th>
                        <th className="py-3 px-4">Effective Access</th>
                        <th className="py-3 px-4">Access Source</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredFolders.map((folder) => {
                        const meta = ACCESS_LEVEL_META[folder.effectiveAccess] || null;
                        const AccessIcon = meta?.icon || MinusCircle;
                        const isProcessing = actionInProgress === folder.folderId;
                        const isGranting = grantingFolderId === folder.folderId;

                        return (
                          <tr
                            key={folder.folderId}
                            className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition ${
                              folder.effectiveAccess === 'FORBIDDEN'
                                ? 'bg-rose-50/30 dark:bg-rose-950/10'
                                : ''
                            }`}
                          >
                            {/* Folder Column */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                  <Folder size={15} />
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                    <span>{folder.folderName}</span>
                                    {folder.itemCount > 0 && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-normal">
                                        {folder.itemCount} {folder.itemCount === 1 ? 'item' : 'items'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Vault Column */}
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                                <Building2 size={13} className="text-slate-400" />
                                {folder.vaultName}
                              </span>
                            </td>

                            {/* Effective Access Column */}
                            <td className="py-3 px-4">
                              {meta ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.badgeClass}`}
                                >
                                  <AccessIcon size={12} className="shrink-0" />
                                  <span>{meta.label}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                  <MinusCircle size={12} />
                                  No Access
                                </span>
                              )}
                            </td>

                            {/* Access Source Column */}
                            <td className="py-3 px-4">
                              {folder.accessSource === 'ROLE_ADMIN' && (
                                <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
                                  <Crown size={12} />
                                  Admin Role
                                </span>
                              )}
                              {folder.accessSource === 'VAULT_OWNER' && (
                                <span className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 text-[11px] font-medium">
                                  <Crown size={12} />
                                  Vault Owner
                                </span>
                              )}
                              {folder.accessSource === 'DIRECT' && (
                                <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium">
                                  <KeyRound size={12} />
                                  Direct Permission
                                </span>
                              )}
                              {folder.accessSource === 'DEPARTMENT' && (
                                <span
                                  className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium"
                                  title={`Via: ${(folder.viaDepartments || []).join(', ')}`}
                                >
                                  <Building2 size={12} />
                                  via {(folder.viaDepartments || [])[0] || 'Department'}
                                </span>
                              )}
                              {folder.accessSource === 'DIRECT_FORBIDDEN' && (
                                <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                                  <Ban size={12} />
                                  Direct Forbidden
                                </span>
                              )}
                              {folder.accessSource === 'DEPARTMENT_FORBIDDEN' && (
                                <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                                  <Ban size={12} />
                                  Dept Forbidden
                                </span>
                              )}
                              {folder.accessSource === 'BLOCKED' && (
                                <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-300 text-[11px] font-medium">
                                  <ShieldAlert size={12} />
                                  Explicitly Blocked
                                </span>
                              )}
                              {folder.accessSource === 'NONE' && (
                                <span className="text-slate-400 text-[11px]">—</span>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="py-3 px-4 text-right">
                              {/* If user has a direct permission, allow editing level or revoking */}
                              {folder.directPermission ? (
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <select
                                    disabled={isProcessing}
                                    value={folder.directPermission.accessLevel}
                                    onChange={(e) => handleUpdatePermission(folder, e.target.value)}
                                    className="h-7 text-[11px] rounded-lg border border-slate-300 bg-white px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                  >
                                    {ACCESS_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() => handleRevokeDirectPermission(folder)}
                                    title="Revoke direct permission"
                                    className="w-7 h-7 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40 inline-flex items-center justify-center transition disabled:opacity-50"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              ) : isGranting ? (
                                /* Inline Grant picker */
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <select
                                    value={grantLevel}
                                    onChange={(e) => setGrantLevel(e.target.value)}
                                    className="h-7 text-[11px] rounded-lg border border-slate-300 bg-white px-2 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                                  >
                                    {ACCESS_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    type="button"
                                    disabled={isProcessing}
                                    onClick={() =>
                                      handleGrantDirectPermission(folder.folderId, folder.folderName)
                                    }
                                    className="h-7 px-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 text-[11px] transition disabled:opacity-50"
                                  >
                                    {isProcessing ? 'Saving…' : 'Save'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setGrantingFolderId(null)}
                                    className="h-7 px-2 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 text-[11px] dark:border-slate-600 dark:hover:bg-slate-700 transition"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                /* Not granting yet, show Grant button */
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGrantingFolderId(folder.folderId);
                                    setGrantLevel(folder.deptAccessLevel || 'READ_ONLY');
                                  }}
                                  className="h-7 px-2.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 inline-flex items-center gap-1 font-medium transition text-[11px]"
                                >
                                  <Plus size={12} />
                                  <span>Grant Direct</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredFolders.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            No folders found matching the current filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Showing {filteredFolders.length} of {allFolders.length} folders
            </span>

            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
