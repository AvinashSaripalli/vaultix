import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Share2, X, RefreshCw, Check, Users, ShieldCheck, Eye, PencilLine, Crown, Search } from 'lucide-react';
import api from '../../services/api';
import { shareFolderAccess } from '../../features/vault/vaultSlice';
import { unwrapItemKey, wrapItemKey } from '../../utils/crypto';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

const ACCESS_LEVELS = [
  { value: 'READ_ONLY', label: 'Viewer', desc: 'Can view items and copy passwords', icon: Eye },
  { value: 'READ_WRITE', label: 'Editor', desc: 'Can view, edit, and add new items', icon: PencilLine },
  { value: 'FULL_ACCESS', label: 'Full Access', desc: 'Can edit, add, and delete items', icon: ShieldCheck },
  { value: 'ADMINISTRATOR', label: 'Administrator', desc: 'Can manage folder permissions & sharing', icon: Crown },
];

export default function MobileShareFolderSheet({
  isOpen,
  folder,
  vaultId,
  onClose,
  onSuccess,
}) {
  const dispatch = useDispatch();
  const { user, sessionRsaPrivateKey, sessionRsaPublicKey } = useSelector((state) => state.auth);

  const [users, setUsers] = useState([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState('READ_ONLY');
  const [searchUser, setSearchUser] = useState('');
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeMemberUserIds, setActiveMemberUserIds] = useState([]);

  useEffect(() => {
    if (!isOpen || !folder?.id) return;

    setError('');
    setSelectedUserEmail('');
    setAccessLevel('READ_ONLY');
    setSearchUser('');

    const fetchData = async () => {
      try {
        setFetchingUsers(true);

        const [usersRes, folderRes] = await Promise.all([
          api.get('/users/shareable'),
          api.get(`/folders/${folder.id}`).catch(() => ({ data: null })),
        ]);

        // Filter out current user
        const allUsers = (usersRes.data || []).filter((u) => u.id !== user?.id);
        setUsers(allUsers);

        // Calculate users who already have active access to this folder
        const folderData = folderRes.data;
        if (folderData) {
          const perms = folderData.permissions || [];
          const blocked = Array.isArray(folderData.blockedUserIds) ? folderData.blockedUserIds : [];
          const deptMembers = folderData.departmentMembers || [];
          const ownerId = folderData.vault?.owner?.id || folderData.vault?.ownerId;

          const directActive = perms
            .filter((p) => p.accessLevel && p.accessLevel !== 'FORBIDDEN')
            .map((p) => p.user?.id || p.userId)
            .filter(Boolean);

          const deptActive = deptMembers
            .map((dm) => dm.user?.id || dm.userId)
            .filter((id) => id && !blocked.includes(id));

          const allActive = [...new Set([...directActive, ...deptActive, ...(ownerId ? [ownerId] : [])])];
          setActiveMemberUserIds(allActive);
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load workspace members');
      } finally {
        setFetchingUsers(false);
      }
    };

    fetchData();
  }, [isOpen, folder?.id, user?.id]);

  const eligibleUsers = useMemo(() => {
    let list = users.filter((u) => !activeMemberUserIds.includes(u.id));
    if (!searchUser.trim()) return list;
    const q = searchUser.toLowerCase();
    return list.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, activeMemberUserIds, searchUser]);

  if (!isOpen || !folder) return null;

  const handleShare = async (e) => {
    e?.preventDefault();
    if (!selectedUserEmail) {
      setError('Please select a user to share with');
      return;
    }

    setSubmitting(true);
    setError('');
    hapticMedium();

    try {
      const targetVaultId = vaultId || folder.vaultId;
      const result = await dispatch(
        shareFolderAccess({
          folderId: folder.id,
          userEmail: selectedUserEmail,
          accessLevel,
          vaultId: targetVaultId,
        })
      );

      if (shareFolderAccess.fulfilled.match(result)) {
        // Zero-Knowledge re-wrapping of folder credentials
        if (accessLevel !== 'FORBIDDEN') {
          await wrapKeysForNewUser(selectedUserEmail, targetVaultId);
        }
        hapticSuccess();
        onSuccess?.();
        onClose();
      } else {
        throw new Error(result.payload || 'Failed to share folder');
      }
    } catch (err) {
      setError(err?.message || 'Could not share folder');
    } finally {
      setSubmitting(false);
    }
  };

  const wrapKeysForNewUser = async (recipientEmail, targetVaultId) => {
    try {
      if (!sessionRsaPrivateKey || !sessionRsaPublicKey) return;

      const recipientRes = await api.get(`/users/by-email/${recipientEmail}`);
      const recipient = recipientRes.data;
      if (!recipient?.id) return;

      const recipientKeyRes = await api.get(`/keypair/${recipient.id}/public`);
      const recipientPublicKey = recipientKeyRes.data?.publicKey;
      if (!recipientPublicKey) return;

      const passwordsRes = await api.get(`/passwords/vault/${targetVaultId}`);
      const folderPasswords = (passwordsRes.data || []).filter(
        (pw) => pw.folderId === folder.id
      );

      const wrappedUpdates = [];
      for (const pw of folderPasswords) {
        if (!pw.myWrappedKey) continue;
        try {
          const aesKeyJwk = await unwrapItemKey(pw.myWrappedKey, sessionRsaPrivateKey);
          const newWrappedKey = await wrapItemKey(aesKeyJwk, recipientPublicKey);
          wrappedUpdates.push({
            id: pw.id,
            wrappedKeys: { [recipient.id]: newWrappedKey },
          });
        } catch {
          // ignore individual wrap errors
        }
      }

      if (wrappedUpdates.length > 0) {
        await api.post('/passwords/batch-wrap', { wrappedPasswords: wrappedUpdates });
      }
    } catch (err) {
      console.warn('Folder key re-wrapping error:', err);
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
              <Share2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Share Folder</h2>
              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                &ldquo;{folder.name}&rdquo;
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share sheet"
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleShare} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* User Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              Select Workspace Member *
            </label>

            {fetchingUsers ? (
              <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-indigo-500" />
                <span>Loading team members...</span>
              </div>
            ) : eligibleUsers.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
                All workspace members already have access to this folder.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-slate-200 dark:border-slate-800 p-1">
                  {eligibleUsers.map((u) => {
                    const isSelected = selectedUserEmail === u.email;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          hapticLight();
                          setSelectedUserEmail(u.email);
                        }}
                        className={`w-full p-2 rounded-lg text-left text-xs flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{u.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                        </div>
                        {isSelected && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Permission Level Selector */}
          <div className="space-y-1.5 pt-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              Access Permission Level
            </label>

            <div className="space-y-1.5">
              {ACCESS_LEVELS.map((lvl) => {
                const IconComponent = lvl.icon;
                const isSelected = accessLevel === lvl.value;
                return (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setAccessLevel(lvl.value);
                    }}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-start gap-3 transition ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-slate-900 dark:text-white shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}>
                      <IconComponent size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{lvl.label}</span>
                        {isSelected && <Check size={14} className="text-indigo-600 dark:text-indigo-400" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {lvl.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting || !selectedUserEmail}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Wrapping keys &amp; sharing...</span>
                </>
              ) : (
                <>
                  <Share2 size={13} />
                  <span>Share Folder Access</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
