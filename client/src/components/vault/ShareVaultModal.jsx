import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { showToast } from '../../utils/toast';
import ModalPortal, { ModalBackdrop } from '../common/ModalPortal';

const ACCESS_LEVEL_LABELS = {
  READ_ONLY: 'Read only',
  READ_WRITE: 'Read and write',
  FULL_ACCESS: 'Full access',
  ADMINISTRATOR: 'Administrator',
};

function ShareVaultModal({ open, onClose, vaultId }) {
  const { user } = useSelector((state) => state.auth);
  const [users, setUsers] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState('READ_ONLY');
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [vaultPermissions, setVaultPermissions] = useState([]);

  useEffect(() => {
    if (!open) return;
    const fetchUsers = async () => {
      try {
        setFetchingUsers(true);
        setError('');
        const response = await api.get('/users/shareable');
        setUsers((response.data || []).filter((item) => item.id !== user?.id));
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch users');
      } finally {
        setFetchingUsers(false);
      }
    };
    fetchUsers();
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !vaultId) return;
    const fetchVaultMembers = async () => {
      try {
        const res = await api.get('/vaults');
        const vault = (res.data || []).find((v) => v.id === vaultId);
        const perms = vault?.permissions || [];
        setVaultPermissions(perms);
      } catch {
        setVaultPermissions([]);
      }
    };
    fetchVaultMembers();
  }, [open, vaultId]);

  const memberAccessMap = useMemo(() => {
    const map = {};
    for (const perm of vaultPermissions) {
      const uId = perm.user?.id || perm.userId;
      if (uId) {
        map[uId] = perm.accessLevel;
      }
    }
    return map;
  }, [vaultPermissions]);

  const selectedUserObj = useMemo(() => {
    return users.find((u) => u.email === userEmail);
  }, [users, userEmail]);

  const existingAccess = selectedUserObj ? memberAccessMap[selectedUserObj.id] : null;

  const handleUserChange = (email) => {
    setUserEmail(email);
    if (!email) {
      setAccessLevel('READ_ONLY');
      return;
    }
    const targetUser = users.find((u) => u.email === email);
    if (targetUser && memberAccessMap[targetUser.id]) {
      setAccessLevel(memberAccessMap[targetUser.id]);
    } else {
      setAccessLevel('READ_ONLY');
    }
  };

  const resetForm = () => {
    setUserEmail('');
    setAccessLevel('READ_ONLY');
    setError('');
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!vaultId) return setError('Vault missing');
    if (!userEmail) return setError('Select a user');
    try {
      setSharing(true);
      setError('');
      await api.post(`/vaults/${vaultId}/share`, { userEmail, accessLevel });
      showToast(existingAccess ? 'Vault access updated successfully' : 'Vault shared successfully');
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to share vault');
    } finally {
      setSharing(false);
    }
  };

  if (!open) return null;

  return (
    <ModalPortal open={open} onClose={handleClose}>
      <ModalBackdrop onClose={handleClose} disableBackdropClick={true}>
        <div
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-h-[85vh] overflow-y-auto my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Share Vault</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-sm px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleShare} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              Select user
            </label>
            <select
              value={userEmail}
              onChange={(e) => handleUserChange(e.target.value)}
              className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">
                {fetchingUsers ? 'Loading active users...' : 'Choose user'}
              </option>
              {users.map((item) => {
                const currentAccess = memberAccessMap[item.id];
                const statusLabel = currentAccess
                  ? ` — [${ACCESS_LEVEL_LABELS[currentAccess] || currentAccess}]`
                  : '';
                return (
                  <option key={item.id} value={item.email}>
                    {item.fullName} ({item.email}){statusLabel}
                  </option>
                );
              })}
            </select>
            {existingAccess && (
              <p className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                User already has {ACCESS_LEVEL_LABELS[existingAccess] || existingAccess} access. Changing this will update their permission.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              Access level
            </label>
            <select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
              className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="READ_ONLY">Read only</option>
              <option value="READ_WRITE">Read and write</option>
              <option value="FULL_ACCESS">Full access</option>
              <option value="ADMINISTRATOR">Administrator</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={sharing}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-50"
            >
              {sharing ? 'Saving...' : existingAccess ? 'Update Access' : 'Share Vault'}
            </button>
          </div>
        </form>
      </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}

export default ShareVaultModal;