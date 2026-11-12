import { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Users, X, RefreshCw, Crown, ShieldCheck, Eye, PencilLine, Trash2, Ban, Search, Plus, UserPlus } from 'lucide-react';
import api from '../../services/api';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

const ACCESS_LABELS = {
  ADMINISTRATOR: { label: 'Admin', icon: Crown, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60' },
  FULL_ACCESS: { label: 'Full Access', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60' },
  READ_WRITE: { label: 'Editor', icon: PencilLine, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60' },
  READ_ONLY: { label: 'Viewer', icon: Eye, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/60' },
  FORBIDDEN: { label: 'Blocked', icon: Ban, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60' },
};

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function MobileFolderMembersSheet({
  isOpen,
  folder,
  onClose,
  onOpenShare,
}) {
  const { user } = useSelector((state) => state.auth);

  const [loading, setLoading] = useState(false);
  const [folderData, setFolderData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [revokingId, setRevokingId] = useState(null);

  const loadMembers = async () => {
    if (!folder?.id) return;
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/folders/${folder.id}`);
      setFolderData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load folder members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, folder?.id]);

  const owner = folderData?.vault?.owner || folderData?.owner || null;
  const isCurrentUserOwner = owner?.id === user?.id;
  const currentUserDirectPerm = (folderData?.permissions || []).find(
    (p) => p.userId === user?.id || p.user?.id === user?.id
  );
  const canManage =
    ['SUPER_ADMIN', 'ADMIN'].includes(user?.role) ||
    isCurrentUserOwner ||
    currentUserDirectPerm?.accessLevel === 'ADMINISTRATOR';

  const membersList = useMemo(() => {
    if (!folderData) return [];
    const list = [];
    const seenIds = new Set();

    // 1. Owner
    if (owner?.id) {
      list.push({
        id: owner.id,
        user: owner,
        type: 'OWNER',
        accessLevel: 'ADMINISTRATOR',
        canRevoke: false,
      });
      seenIds.add(owner.id);
    }

    // 2. Direct permissions
    (folderData.permissions || []).forEach((p) => {
      const u = p.user || { id: p.userId, fullName: 'Unknown', email: '' };
      if (!seenIds.has(u.id)) {
        list.push({
          id: u.id,
          permissionId: p.id,
          user: u,
          type: 'DIRECT',
          accessLevel: p.accessLevel || 'READ_ONLY',
          canRevoke: canManage && u.id !== user?.id && u.id !== owner?.id,
        });
        seenIds.add(u.id);
      }
    });

    // 3. Department members
    (folderData.departmentMembers || []).forEach((dm) => {
      const u = dm.user || { id: dm.userId, fullName: 'Unknown', email: '' };
      if (!seenIds.has(u.id)) {
        const isBlocked = (folderData.blockedUserIds || []).includes(u.id);
        list.push({
          id: u.id,
          user: u,
          type: 'DEPARTMENT',
          accessLevel: isBlocked ? 'FORBIDDEN' : dm.accessLevel || 'READ_ONLY',
          canRevoke: false,
        });
        seenIds.add(u.id);
      }
    });

    // 4. Workspace Admins
    (folderData.workspaceAdmins || []).forEach((adm) => {
      if (!seenIds.has(adm.id)) {
        list.push({
          id: adm.id,
          user: adm,
          type: 'ADMIN',
          accessLevel: 'ADMINISTRATOR',
          canRevoke: false,
        });
        seenIds.add(adm.id);
      }
    });

    return list;
  }, [folderData, owner, canManage, user?.id]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return membersList;
    const q = search.toLowerCase();
    return membersList.filter(
      (m) =>
        m.user?.fullName?.toLowerCase().includes(q) ||
        m.user?.email?.toLowerCase().includes(q)
    );
  }, [membersList, search]);

  if (!isOpen || !folder) return null;

  const handleRevoke = async (member) => {
    if (!member.permissionId) return;
    const confirmRevoke = window.confirm(
      `Revoke folder access for ${member.user?.fullName || 'this member'}?`
    );
    if (!confirmRevoke) return;

    setRevokingId(member.id);
    hapticMedium();

    try {
      await api.delete(`/folders/${folder.id}/permissions/${member.permissionId}`);
      hapticSuccess();
      await loadMembers();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revoke member access');
    } finally {
      setRevokingId(null);
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
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Folder Members</h2>
              <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                &ldquo;{folder.name}&rdquo; &middot; {membersList.length} users
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close members sheet"
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search bar & Quick Share Action */}
        <div className="px-5 pt-3 pb-2 space-y-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search folder members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
              />
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onOpenShare?.(folder);
                }}
                className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition shrink-0"
              >
                <UserPlus size={13} />
                <span>Add</span>
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={15} className="animate-spin text-indigo-500" />
              <span>Loading member access list...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No members found matching your search.
            </div>
          ) : (
            filteredMembers.map((member) => {
              const meta = ACCESS_LABELS[member.accessLevel] || ACCESS_LABELS.READ_ONLY;
              const IconComp = meta.icon;

              return (
                <div
                  key={member.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {getInitials(member.user?.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {member.user?.fullName}
                        </span>
                        {member.type === 'OWNER' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Vault Owner
                          </span>
                        )}
                        {member.type === 'DEPARTMENT' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Dept Inherited
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">{member.user?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 ${meta.color}`}>
                      <IconComp size={11} />
                      <span>{meta.label}</span>
                    </span>

                    {member.canRevoke && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(member)}
                        disabled={revokingId === member.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-95"
                        title="Revoke access"
                      >
                        {revokingId === member.id ? (
                          <RefreshCw size={13} className="animate-spin text-rose-500" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
