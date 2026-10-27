import { useEffect, useState } from 'react';
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
  FolderOpen,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import api from '../../services/api';
import ModalPortal, { ModalBackdrop } from '../../components/common/ModalPortal';
import RoleBadge from '../../components/common/RoleBadge';
import { showToast } from '../../utils/toast';

const ACCESS_LEVEL_CONFIG = {
  ADMINISTRATOR: {
    label: 'Administrator',
    icon: Crown,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  },
  FULL_ACCESS: {
    label: 'Full access',
    icon: ShieldCheck,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  },
  READ_WRITE: {
    label: 'Read and write',
    icon: PencilLine,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  },
  READ_ONLY: {
    label: 'Read only',
    icon: Eye,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  },
  FORBIDDEN: {
    label: 'Forbidden',
    icon: Ban,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  },
};

const ACCESS_OPTIONS = [
  { value: 'READ_ONLY', label: 'Read only' },
  { value: 'READ_WRITE', label: 'Read and write' },
  { value: 'FULL_ACCESS', label: 'Full access' },
  { value: 'ADMINISTRATOR', label: 'Administrator' },
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
  const { token } = useSelector((state) => state.auth);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('ACCESSIBLE'); // 'ACCESSIBLE' | 'AVAILABLE'

  // Per-folder grant state
  const [grantLevels, setGrantLevels] = useState({});
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
      setActiveTab('ACCESSIBLE');
      setGrantLevels({});
    }
  }, [open, userId]);

  if (!open) return null;

  const targetUser = data?.user || { fullName: userName, email: userEmail, role: userRole };
  const departments = data?.departments || [];
  const allFolders = data?.folders || [];

  const accessibleFolders = allFolders.filter((f) => f.hasAccess);
  const availableFolders = allFolders.filter((f) => !f.hasAccess);

  const currentList = activeTab === 'ACCESSIBLE' ? accessibleFolders : availableFolders;

  const filteredFolders = currentList.filter((f) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      f.folderName.toLowerCase().includes(q) ||
      f.vaultName.toLowerCase().includes(q) ||
      (f.viaDepartments || []).some((d) => d.toLowerCase().includes(q))
    );
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
      showToast(`Updated access to "${newLevel}" for "${folder.folderName}"`, 'success');
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

  // Action: Grant direct permission
  const handleGrantDirectPermission = async (folderId, folderName) => {
    if (!targetUser?.email) return;
    const chosenLevel = grantLevels[folderId] || 'READ_ONLY';
    try {
      setActionInProgress(folderId);
      await api.post(
        `/folders/${folderId}/share`,
        {
          userEmail: targetUser.email,
          accessLevel: chosenLevel,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast(`Granted "${chosenLevel}" access to "${folderName}"`, 'success');
      await fetchAccess();
      setActiveTab('ACCESSIBLE');
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
          className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/80 dark:bg-slate-850 dark:border-slate-700/80 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ─── 1. Sleek Profile Header ─── */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-base shadow-sm shrink-0">
                  {getInitials(targetUser.fullName || targetUser.email)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {targetUser.fullName || targetUser.email}
                    </h2>
                    <RoleBadge role={targetUser.role || 'USER'} />
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        targetUser.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                      }`}
                    >
                      {targetUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>{targetUser.email}</span>
                    {departments.length > 0 && (
                      <>
                        <span>•</span>
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          {departments.map((dept) => (
                            <span
                              key={dept.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium text-[11px]"
                            >
                              <Building2 size={11} className="text-slate-400" />
                              <span>{dept.name}</span>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={fetchAccess}
                  disabled={loading}
                  title="Refresh"
                  className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Admin Notice Callout */}
            {['SUPER_ADMIN', 'ADMIN'].includes(targetUser.role) && (
              <div className="mt-4 p-3 rounded-2xl bg-purple-50/70 border border-purple-200/80 dark:bg-purple-950/30 dark:border-purple-900/60 flex items-center gap-2.5 text-xs text-purple-900 dark:text-purple-200">
                <Crown className="text-purple-600 dark:text-purple-400 shrink-0" size={16} />
                <span>
                  <strong>Administrator:</strong> This user has full administrative privileges over all {allFolders.length} company folders across the workspace.
                </span>
              </div>
            )}
          </div>

          {/* ─── 2. Clean Tabs Navigation ─── */}
          <div className="px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('ACCESSIBLE')}
                className={`relative px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  activeTab === 'ACCESSIBLE'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>Accessible Folders</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === 'ACCESSIBLE'
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {accessibleFolders.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('AVAILABLE')}
                className={`relative px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                  activeTab === 'AVAILABLE'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span>+ Grant New Access</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === 'AVAILABLE'
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {availableFolders.length}
                </span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-48 sm:w-56">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter folders…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 shadow-2xs"
              />
            </div>
          </div>

          {/* ─── 3. Content Area ─── */}
          <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
            {error && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/60 dark:text-rose-300">
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-20 text-center text-slate-400 dark:text-slate-500">
                <RefreshCw size={24} className="mx-auto animate-spin mb-2 text-indigo-500" />
                <p className="text-xs">Loading permissions…</p>
              </div>
            ) : activeTab === 'ACCESSIBLE' ? (
              /* ── TAB 1: ACCESSIBLE FOLDERS ── */
              filteredFolders.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredFolders.map((folder) => {
                    const meta = ACCESS_LEVEL_CONFIG[folder.effectiveAccess] || ACCESS_LEVEL_CONFIG.READ_ONLY;
                    const AccessIcon = meta.icon;
                    const isProcessing = actionInProgress === folder.folderId;

                    return (
                      <div
                        key={folder.folderId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 dark:bg-slate-800/60 dark:border-slate-750 dark:hover:border-slate-700 transition shadow-2xs"
                      >
                        {/* Folder Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 flex items-center justify-center shrink-0">
                            <Folder size={18} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {folder.folderName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              <span>{folder.vaultName}</span>
                              {folder.itemCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{folder.itemCount} items</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Badges & Direct Controls */}
                        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                          {/* Access Level Badge */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border ${meta.badgeClass}`}
                          >
                            <AccessIcon size={13} className="shrink-0" />
                            <span>{meta.label}</span>
                          </span>

                          {/* Source indicator */}
                          {folder.accessSource === 'ROLE_ADMIN' && (
                            <span className="text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                              Admin Role
                            </span>
                          )}

                          {folder.accessSource === 'VAULT_OWNER' && (
                            <span className="text-[11px] font-medium text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
                              Vault Owner
                            </span>
                          )}

                          {/* Direct Permission Controls (Change / Revoke) */}
                          {folder.directPermission ? (
                            <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
                              <select
                                disabled={isProcessing}
                                value={folder.directPermission.accessLevel}
                                onChange={(e) => handleUpdatePermission(folder, e.target.value)}
                                className="h-8 text-xs font-medium rounded-xl border border-slate-300 bg-white px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
                                className="h-8 px-2.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-900/50 text-xs font-medium inline-flex items-center gap-1 transition disabled:opacity-50"
                              >
                                <Trash2 size={12} />
                                <span>Revoke</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Empty state when 0 accessible folders */
                <div className="py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto mb-3">
                    <FolderOpen size={24} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    No Accessible Folders
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                    {search
                      ? 'No accessible folders matched your search.'
                      : 'This user has not been granted access to any folders yet.'}
                  </p>
                  {!search && availableFolders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('AVAILABLE')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-xs"
                    >
                      <Plus size={14} />
                      <span>Grant Access to a Folder</span>
                    </button>
                  )}
                </div>
              )
            ) : (
              /* ── TAB 2: AVAILABLE FOLDERS (GRANT ACCESS) ── */
              filteredFolders.length > 0 ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Select an access level and click <strong>Grant Access</strong> to add this user to a folder:
                  </p>
                  {filteredFolders.map((folder) => {
                    const isProcessing = actionInProgress === folder.folderId;
                    const selectedLevel = grantLevels[folder.folderId] || 'READ_ONLY';

                    return (
                      <div
                        key={folder.folderId}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 dark:bg-slate-800/60 dark:border-slate-750 dark:hover:border-slate-700 transition shadow-2xs"
                      >
                        {/* Folder Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center shrink-0">
                            <Folder size={18} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {folder.folderName}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              <span>{folder.vaultName}</span>
                              {folder.itemCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{folder.itemCount} items</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Grant Controls */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <select
                            disabled={isProcessing}
                            value={selectedLevel}
                            onChange={(e) =>
                              setGrantLevels((prev) => ({
                                ...prev,
                                [folder.folderId]: e.target.value,
                              }))
                            }
                            className="h-8 text-xs font-medium rounded-xl border border-slate-300 bg-white px-2.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
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
                            className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                          >
                            <Plus size={13} />
                            <span>{isProcessing ? 'Granting…' : 'Grant Access'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400">
                  <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    All Folders Assigned
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {search
                      ? 'No available folders matched your search.'
                      : 'This user already has access to all folders in your company vaults.'}
                  </p>
                </div>
              )
            )}
          </div>

          {/* ─── 4. Sleek Footer ─── */}
          <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {accessibleFolders.length} of {allFolders.length} folders accessible
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750 shadow-2xs"
            >
              Close
            </button>
          </div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
