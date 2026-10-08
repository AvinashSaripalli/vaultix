import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import { fetchFoldersByVault, clearVaultError } from '../../features/vault/vaultSlice';

function RenameFolderModal({ open, onClose, folder, vaultId }) {
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (folder?.name) {
      setName(folder.name);
    } else {
      setName('');
    }
    setError('');
  }, [folder]);

  if (!open || !folder) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');
      dispatch(clearVaultError());

      await api.put(
        `/folders/${folder.id}`,
        { name },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await dispatch(fetchFoldersByVault(vaultId));
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to rename folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal open={open} onClose={onClose}>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Rename Folder</h2>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 text-xl">
            ×
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Folder name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-xl px-4 py-3 outline-none"
            required
          />

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </ModalPortal>
  );
}

export default RenameFolderModal;