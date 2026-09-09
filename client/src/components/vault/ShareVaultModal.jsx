import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import { showToast } from '../../utils/toast';

function ShareVaultModal({ open, onClose, vaultId }) {
  const { user } = useSelector((state) => state.auth);
  const [users, setUsers] = useState([]);
  const [userEmail, setUserEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState('READ_ONLY');
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [memberIds, setMemberIds] = useState([]);

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
        setMemberIds(perms.map((p) => p.user?.id).filter(Boolean));
      } catch {
        setMemberIds([]);
      }
    };
    fetchVaultMembers();
  }, [open, vaultId]);

  const shareableUsers = users.filter((item) => !memberIds.includes(item.id));

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
      showToast('Vault shared successfully');
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to share vault');
    } finally {
      setSharing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Share Vault</h2>
          <button onClick={handleClose} className="text-slate-400 dark:text-slate-500">
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
            <label className="text-sm text-slate-600 dark:text-slate-300 mb-1 block">
              Select user
            </label>
            <select
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">
                {fetchingUsers ? 'Loading...' : 'Choose user'}
              </option>
              {shareableUsers.map((item) => (
                <option key={item.id} value={item.email}>
                  {item.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300 mb-1 block">
              Access level
            </label>
            <select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
              className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-lg px-3 py-2 text-sm"
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
              className="px-4 py-2 rounded-lg border text-sm"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={sharing}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm"
            >
              {sharing ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShareVaultModal;