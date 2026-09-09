import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Search,
  ChevronDown,
  CircleX,
  ShieldCheck,
  PencilLine,
  Eye,
  Crown,
  Users,
  Ban,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import api from '../../services/api';

const ACCESS_OPTIONS = [
  { value: 'ADMINISTRATOR', label: 'Administrator', icon: Crown },
  { value: 'FULL_ACCESS', label: 'Full access', icon: ShieldCheck },
  { value: 'READ_WRITE', label: 'Read and write', icon: PencilLine },
  { value: 'READ_ONLY', label: 'Read only', icon: Eye },
  { value: 'FORBIDDEN', label: 'Forbidden', icon: Ban },
];

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getAccessMeta(accessLevel) {
  return ACCESS_OPTIONS.find((item) => item.value === accessLevel) || ACCESS_OPTIONS[3];
}

function FolderUsersModal({ open, onClose, folderId, folderName, onSaved }) {
  const { token, user } = useSelector((state) => state.auth);
  const { folders } = useSelector((state) => state.vault);

  const [search, setSearch] = useState('');
  const [members, setMembers] = useState([]);
  const [changedMembers, setChangedMembers] = useState({});
  const [folderDetails, setFolderDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedFolder = folders.find((f) => f.id === folderId);
  const activeFolder = folderDetails || selectedFolder;
  const owner = activeFolder?.vault?.owner || null;

  const currentUserPermission = activeFolder?.permissions?.find(
    (item) => item.userId === user?.id || item.user?.id === user?.id
  );
  const currentUserDeptMember = activeFolder?.departmentMembers?.find(
    (dm) => dm.user?.id === user?.id
  );

  const isCurrentUserOwner = owner?.id === user?.id;

  const currentUserAccess = (() => {
    if (user?.role === 'ADMIN' || isCurrentUserOwner) return 'ADMINISTRATOR';
    const RANK = { READ_ONLY: 0, READ_WRITE: 1, FULL_ACCESS: 2, ADMINISTRATOR: 3 };
    const getRank = (lvl) => RANK[lvl] ?? -1;
    const direct = currentUserPermission?.accessLevel || null;
    const dept = currentUserDeptMember?.accessLevel || null;
    if (!direct && !dept) return null;
    if (!direct) return dept;
    if (!dept) return direct;
    return getRank(direct) >= getRank(dept) ? direct : dept;
  })();

  const canManageMembers =
    user?.role === 'ADMIN' || currentUserAccess === 'ADMINISTRATOR';

  useEffect(() => {
    if (!open || !folderId) return;

    const loadFolderDetails = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await api.get(`/folders/${folderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const folder = res.data;
        setFolderDetails(folder);

        const currentPermissions = folder?.permissions || [];
        const folderOwner = folder?.vault?.owner || null;
        const deptMembers = folder?.departmentMembers || [];

        const finalMembers = folderOwner
          ? [
              {
                id: `owner-${folderOwner.id}`,
                userId: folderOwner.id,
                user: folderOwner,
                accessLevel: 'ADMINISTRATOR',
                isOwner: true,
              },
              ...currentPermissions.filter(
                (item) =>
                  item.userId !== folderOwner.id &&
                  item.user?.id !== folderOwner.id
              ),
              ...deptMembers
                .filter(
                  (dm) =>
                    dm.user?.id !== folderOwner.id &&
                    !currentPermissions.some(
                      (p) => p.userId === dm.user?.id || p.user?.id === dm.user?.id
                    )
                )
                .map((dm) => ({
                  ...dm,
                  id: `dept-${dm.user?.id}`,
                  userId: dm.user?.id,
                })),
            ]
          : [...currentPermissions, ...deptMembers];

        setMembers(finalMembers);
        setChangedMembers({});
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load folder members');
      } finally {
        setLoading(false);
      }
    };

    loadFolderDetails();
  }, [open, folderId, token]);

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return members.filter((item) => {
      const name = item.user?.fullName?.toLowerCase() || '';
      const email = item.user?.email?.toLowerCase() || '';
      return name.includes(q) || email.includes(q);
    });
  }, [members, search]);

  const handleAccessChange = (permissionId, newAccess) => {
    if (!canManageMembers) return;
    const member = members.find((item) => item.id === permissionId);
    if (member?.isOwner) return;
    setChangedMembers((prev) => ({
      ...prev,
      [permissionId]: { ...prev[permissionId], accessLevel: newAccess, member },
    }));
    setMembers((prev) =>
      prev.map((item) =>
        item.id === permissionId ? { ...item, accessLevel: newAccess } : item
      )
    );
  };

  const handleRemoveMember = (permissionId) => {
    if (!canManageMembers) return;
    const member = members.find((item) => item.id === permissionId);
    if (member?.isOwner) return;
    setChangedMembers((prev) => ({
      ...prev,
      [permissionId]: { ...prev[permissionId], remove: true, member },
    }));
    setMembers((prev) => prev.filter((item) => item.id !== permissionId));
  };

  const handleSave = async () => {
    if (!canManageMembers) return;
    try {
      setSaving(true);
      setError('');
      const updates = Object.entries(changedMembers);
      for (const [permissionId, change] of updates) {
        if (permissionId.startsWith('owner-')) continue;
        const member = change.member;
        if (change.remove) {
          if (member?.viaDepartment && member?.user?.id) {
            await api.post(
              `/folders/${folderId}/block`,
              { userId: member.user.id },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } else {
            await api.delete(`/folders/permissions/${permissionId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        } else if (change.accessLevel) {
          if (member?.viaDepartment && member?.user?.email) {
            await api.post(
              `/folders/${folderId}/share`,
              { userEmail: member.user.email, accessLevel: change.accessLevel },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } else {
            await api.put(
              `/folders/permissions/${permissionId}`,
              { accessLevel: change.accessLevel },
              { headers: { Authorization: `Bearer ${token}` } }
            );
          }
        }
      }
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save folder permissions');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 text-xs font-semibold mb-2">
                <Users size={12} />
                Folder permissions
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                {folderName || activeFolder?.name || 'Folder'}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-xs">
                View members, change access levels, and remove access.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="mb-3 rounded-lg bg-red-50 border border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 px-3 py-2 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search member..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 bg-white text-xs outline-none focus:border-indigo-300"
              />
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
              {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
            </div>
            {canManageMembers && (
              <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800 px-2 py-1 rounded-full shrink-0">
                Manage
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 mt-3 pt-3">
            {loading && (
              <div className="py-6 text-xs text-slate-500 dark:text-slate-400 text-center">Loading members...</div>
            )}

            {!loading && filteredMembers.length > 0 && (
              <div className="space-y-1">
                {filteredMembers.map((item) => {
                  const accessMeta = getAccessMeta(item.accessLevel);
                  const AccessIcon = accessMeta.icon;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition ${
                        item.isOwner ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0">
                        {getInitials(item.user?.fullName || item.user?.email || 'U')}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                          <span>{item.user?.fullName || 'Unknown user'}</span>
                          {item.isOwner && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 font-semibold">
                              Owner
                            </span>
                          )}
                          {item.viaDepartment && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 font-semibold">
                              {item.departmentName}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.user?.email || '-'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.isOwner ? (
                          <div className="h-8 px-3 rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20 flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                            <Crown size={13} />
                            <span>Administrator</span>
                          </div>
                        ) : canManageMembers ? (
                          <div className="relative">
                            <select
                              value={item.accessLevel}
                              onChange={(e) => handleAccessChange(item.id, e.target.value)}
                              className="appearance-none h-8 rounded-lg border border-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 bg-white pl-3 pr-8 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none hover:border-slate-300 dark:hover:border-slate-600"
                            >
                              {ACCESS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                          </div>
                        ) : (
                          <div className="h-8 px-3 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                            <AccessIcon size={13} className="text-slate-500 dark:text-slate-400" />
                            <span>{accessMeta.label}</span>
                          </div>
                        )}

                        {canManageMembers && !item.isOwner && (
                          <button
                            onClick={() => handleRemoveMember(item.id)}
                            className="w-8 h-8 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-slate-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center"
                            title="Remove access"
                          >
                            <CircleX size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!loading && !filteredMembers.length && (
              <div className="py-8 text-center">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                  <Users size={18} />
                </div>
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">No users found</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Try another name or email.</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          {canManageMembers && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-9 px-5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FolderUsersModal;
