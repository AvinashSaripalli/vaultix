import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Users, UserPlus, Search, X, RefreshCw, Mail, Shield, Check, AlertTriangle, Archive, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

export default function MobileTeamSheet({ isOpen, onClose }) {
  const { user: currentUser, token } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'invite' | 'archived'
  const [users, setUsers] = useState([]);
  const [archivedVaults, setArchivedVaults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const isAdmin = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('USER');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load team members.');
    } finally {
      setLoading(false);
    }
  };

  const fetchArchived = async () => {
    if (!isAdmin) return;
    try {
      setLoadingArchived(true);
      const res = await api.get('/vaults/archived');
      setArchivedVaults(res.data || []);
    } catch {
      //
    } finally {
      setLoadingArchived(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchArchived();
      setInviteEmail('');
      setInviteSuccess('');
      setError('');
    }
  }, [isOpen]);

  const handlePurgeArchived = async (vaultId) => {
    if (!window.confirm('Permanently purge this archived vault?')) return;
    try {
      await api.delete(`/vaults/archived/${vaultId}`);
      setArchivedVaults((prev) => prev.filter((v) => v.id !== vaultId));
      hapticSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete archive');
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  if (!isOpen) return null;

  const handleSendInvite = async (e) => {
    e?.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError('');
    setInviteSuccess('');
    hapticMedium();

    try {
      const res = await api.post(
        '/invitations',
        { email: inviteEmail.trim(), role: inviteRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      hapticSuccess();
      setInviteSuccess(res.data?.message || 'Invitation sent successfully!');
      setInviteEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[88%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Team Management</h2>
              <p className="text-[10px] text-slate-400">Members, Roles &amp; Invitations</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'} gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800`}>
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('members');
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Users size={13} />
              <span>Members ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('invite');
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'invite'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <UserPlus size={13} />
              <span>Invite</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveTab('archived');
                }}
                className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeTab === 'archived'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Archive size={13} />
                <span>Archives ({archivedVaults.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'members' ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search members by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-indigo-500" />
                  <span>Loading team members...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No members matched your search.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:indigo-900/40 text-indigo-600 dark:text-indigo-400 font-black text-xs flex items-center justify-center shrink-0">
                          {u.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {u.fullName}
                            {u.id === currentUser?.id && ' (You)'}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 shrink-0">
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : activeTab === 'archived' ? (
            /* ARCHIVED VAULTS LIST */
            <div className="space-y-3">
              <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-700 dark:text-indigo-300">
                These personal vaults belonged to deleted members. Their data is secured by Super Admin escrow and separated from active vaults.
              </div>

              {loadingArchived ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-indigo-500" />
                  <span>Loading archived vaults...</span>
                </div>
              ) : archivedVaults.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Archive size={24} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No Archived Vaults</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    When employees or users are deleted, their personal vaults are archived here for administrator recovery without cluttering the vaults list.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {archivedVaults.map((vault) => (
                    <div
                      key={vault.id}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Archive size={16} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {vault.name}
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              {vault.originalUserName ? `Former user: ${vault.originalUserName}` : 'Former employee'} &middot; {vault.itemCount || 0} {vault.itemCount === 1 ? 'item' : 'items'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handlePurgeArchived(vault.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95 transition shrink-0"
                          title="Permanently Delete Archive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {vault.folders && vault.folders.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {vault.folders.map((f) => (
                            <span
                              key={f.id}
                              className="px-2 py-0.5 rounded-md text-[9px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                            >
                              {f.name} ({f.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* INVITE FORM */
            <form onSubmit={handleSendInvite} className="space-y-3.5 pt-1">
              {inviteSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs">
                  <Check size={15} className="shrink-0" />
                  <span>{inviteSuccess}</span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Assigned Workspace Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                >
                  <option value="USER">User (Standard Member)</option>
                  <option value="ADMIN">Admin (Manage Team &amp; Vaults)</option>
                  <option value="SECURITY_ANALYST">Security Analyst (Audit Logs)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={!inviteEmail || inviting}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                {inviting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Sending Invite...</span>
                  </>
                ) : (
                  <>
                    <Mail size={14} />
                    <span>Send Workspace Invitation</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
