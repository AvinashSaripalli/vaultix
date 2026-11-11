import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Folder, Plus, Trash2, X, RefreshCw, Check } from 'lucide-react';
import { createFolder, deleteFolder, fetchFoldersByVault } from '../../features/vault/vaultSlice';
import { createMyVaultFolder, deleteMyVaultFolder, fetchMyVault } from '../../features/myVault/myVaultSlice';
import { hapticMedium, hapticLight, hapticSuccess } from '../../utils/haptics';

export default function MobileFolderManagerSheet({
  isOpen,
  isPersonalVault = false,
  selectedVault = null,
  folders: foldersProp = null,
  onClose,
  onRefresh,
}) {
  const dispatch = useDispatch();
  const { folders = [], selectedVault: reduxSelectedVault, actionLoading } = useSelector((state) => state.vault);

  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const effectiveFolders = foldersProp && foldersProp.length > 0 ? foldersProp : folders;
  const activeVault = selectedVault || reduxSelectedVault;

  if (!isOpen) return null;

  const handleCreateFolder = async (e) => {
    e?.preventDefault();
    if (!newFolderName.trim()) return;

    setError('');
    setCreating(true);
    hapticMedium();

    try {
      if (isPersonalVault) {
        const res = await dispatch(createMyVaultFolder({ name: newFolderName.trim() }));
        if (res.error) throw new Error(res.error.message || 'Failed to create personal folder');
        setNewFolderName('');
        hapticSuccess();
        dispatch(fetchMyVault());
        onRefresh?.();
      } else {
        if (!activeVault?.id) {
          setError('No active vault selected.');
          setCreating(false);
          return;
        }

        const res = await dispatch(
          createFolder({
            name: newFolderName.trim(),
            vaultId: activeVault.id,
          })
        );

        if (res.error) throw new Error(res.error.message || 'Failed to create folder');

        setNewFolderName('');
        hapticSuccess();
        dispatch(fetchFoldersByVault(activeVault.id));
        onRefresh?.();
      }
    } catch (err) {
      setError(err?.message || 'Could not create folder.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!folder?.id) return;
    const confirmDelete = window.confirm(
      `Delete folder "${folder.name}"? Items inside this folder will be moved to the root vault.`
    );
    if (!confirmDelete) return;

    setDeletingId(folder.id);
    hapticMedium();

    try {
      if (isPersonalVault) {
        await dispatch(deleteMyVaultFolder(folder.id));
        hapticSuccess();
        dispatch(fetchMyVault());
        onRefresh?.();
      } else {
        await dispatch(deleteFolder(folder.id));
        hapticSuccess();
        if (activeVault?.id) {
          dispatch(fetchFoldersByVault(activeVault.id));
        }
        onRefresh?.();
      }
    } catch {
      setError('Failed to delete folder.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[85%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Folder size={16} />
            </div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Manage Folders</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Quick Create Folder Input */}
          <form onSubmit={handleCreateFolder} className="flex gap-2">
            <div className="relative flex-1">
              <Folder size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="New folder name..."
                required
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newFolderName.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition shrink-0"
            >
              {creating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Add</span>
            </button>
          </form>

          {/* Folders List */}
          <div className="space-y-2 pt-2">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              Existing Folders ({effectiveFolders.length})
            </h3>

            {effectiveFolders.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No folders created yet. Create one above to organize your credentials.
              </div>
            ) : (
              effectiveFolders.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Folder size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {f.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(f)}
                    disabled={deletingId === f.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition active:scale-95"
                  >
                    {deletingId === f.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
