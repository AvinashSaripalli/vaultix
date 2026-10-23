import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import { shareFolderAccess } from '../../features/vault/vaultSlice';
import { unwrapItemKey, wrapItemKey } from '../../utils/crypto';
import ModalPortal, { ModalBackdrop } from '../common/ModalPortal';
import { showToast } from '../../utils/toast';

function ShareFolderModal({ open, onClose, folderId, vaultId }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { sessionRsaPrivateKey, sessionRsaPublicKey } = useSelector((state) => state.auth);
  const { actionLoading } = useSelector((state) => state.vault);

  const [users, setUsers] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState('READ_ONLY');
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [error, setError] = useState('');
  const [activeMemberUserIds, setActiveMemberUserIds] = useState([]);

  useEffect(() => {
    if (!open) return;

    const fetchUsers = async () => {
      try {
        setFetchingUsers(true);
        setError('');

        const response = await api.get('/users/shareable');

        // All active users in the workspace except current logged-in user
        const allActiveUsers = (response.data || []).filter(
          (item) => item.id !== user?.id
        );

        setUsers(allActiveUsers);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch users');
      } finally {
        setFetchingUsers(false);
      }
    };

    fetchUsers();
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !folderId) return;

    const fetchFolderMembers = async () => {
      try {
        const res = await api.get(`/folders/${folderId}`);
        const folderData = res.data;
        const perms = folderData?.permissions || [];
        const blocked = Array.isArray(folderData?.blockedUserIds)
          ? folderData.blockedUserIds
          : [];
        const deptMembers = folderData?.departmentMembers || [];
        const ownerId = folderData?.vault?.owner?.id || folderData?.vault?.ownerId;

        // Users who currently have active access to this folder:
        // 1. Direct permissions where accessLevel is NOT 'FORBIDDEN'
        const directActiveIds = perms
          .filter((p) => p.accessLevel && p.accessLevel !== 'FORBIDDEN')
          .map((p) => p.user?.id || p.userId)
          .filter(Boolean);

        // 2. Department members who are NOT blocked
        const deptActiveIds = deptMembers
          .map((dm) => dm.user?.id || dm.userId)
          .filter((id) => id && !blocked.includes(id));

        // 3. Vault owner (always has access)
        const ownerIds = ownerId ? [ownerId] : [];

        const allActiveMemberIds = [
          ...new Set([...directActiveIds, ...deptActiveIds, ...ownerIds]),
        ];

        setActiveMemberUserIds(allActiveMemberIds);
      } catch {
        setActiveMemberUserIds([]);
      }
    };

    fetchFolderMembers();
  }, [open, folderId]);

  // Only show users who do NOT currently have active access in this folder
  const eligibleUsers = useMemo(() => {
    return users.filter((u) => !activeMemberUserIds.includes(u.id));
  }, [users, activeMemberUserIds]);

  const resetForm = () => {
    setUserEmail('');
    setAccessLevel('READ_ONLY');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleRequestShare = (e) => {
    e.preventDefault();

    if (!folderId) return setError('Select a folder');
    if (!vaultId) return setError('Vault missing');
    if (!userEmail) return setError('Please select a user to share with');

    setError('');
    handleVerified();
  };

  const handleVerified = async () => {
    const result = await dispatch(
      shareFolderAccess({
        folderId,
        userEmail,
        accessLevel,
        vaultId,
      })
    );

    if (shareFolderAccess.fulfilled.match(result)) {
      if (accessLevel !== 'FORBIDDEN') {
        await wrapKeysForNewUser(userEmail);
      }
      showToast('Folder shared successfully');
      handleClose();
    } else {
      setError(result.payload || 'Failed to share folder');
    }
  };

  const wrapKeysForNewUser = async (recipientEmail) => {
    try {
      if (!sessionRsaPrivateKey || !sessionRsaPublicKey) return;

      const recipientRes = await api.get(`/users/by-email/${recipientEmail}`);
      const recipient = recipientRes.data;
      if (!recipient?.id) return;

      const recipientKeyRes = await api.get(`/keypair/${recipient.id}/public`);
      const recipientPublicKey = recipientKeyRes.data?.publicKey;
      if (!recipientPublicKey) return;

      const passwordsRes = await api.get(`/passwords/vault/${vaultId}`);
      const folderPasswords = (passwordsRes.data || []).filter(
        (pw) => pw.folderId === folderId
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
          // skip items that fail to re-wrap
        }
      }

      if (wrappedUpdates.length > 0) {
        await api.post('/passwords/batch-wrap', {
          wrappedPasswords: wrappedUpdates,
        });
      }
    } catch {
      // best-effort key wrapping
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
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Share Folder</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-sm px-3 py-2 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleRequestShare} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              Select user
            </label>
            <select
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">
                {fetchingUsers
                  ? 'Loading active users...'
                  : eligibleUsers.length === 0
                  ? 'All active users already have access'
                  : 'Choose user'}
              </option>
              {eligibleUsers.map((item) => (
                <option key={item.id} value={item.email}>
                  {item.fullName} ({item.email})
                </option>
              ))}
            </select>
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
              disabled={actionLoading || eligibleUsers.length === 0}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition disabled:opacity-50"
            >
              {actionLoading ? 'Sharing...' : 'Share Folder'}
            </button>
          </div>
        </form>
      </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}

export default ShareFolderModal;