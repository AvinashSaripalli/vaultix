import { useState } from 'react';
import {
  Search,
  Folder,
  Plus,
  X,
  Trash2,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  openAddFolderModal,
  selectFolder,
  clearSelectedFolder,
  deleteFolder,
  clearVaultError,
} from '../../features/vault/vaultSlice';
import ConfirmModal from '../common/ConfirmModal';
import { showToast } from '../../utils/toast';

function VaultSidebar() {
  const dispatch = useDispatch();

  const {
    selectedVault,
    folders,
    selectedFolderId,
    foldersLoading,
    actionLoading,
    error,
  } = useSelector((state) => state.vault);

  const { user } = useSelector((state) => state.auth);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const selectedFolderPermission = selectedFolder?.permissions?.find(
    (item) => item.userId === user?.id || item.user?.id === user?.id
  );
  const selectedFolderDeptMember = selectedFolder?.departmentMembers?.find(
    (dm) => dm.user?.id === user?.id
  );
  const selectedFolderAccess = (() => {
    if (user?.role === 'ADMIN') return 'ADMINISTRATOR';
    const RANK = { READ_ONLY: 0, READ_WRITE: 1, FULL_ACCESS: 2, ADMINISTRATOR: 3 };
    const getRank = (lvl) => RANK[lvl] ?? -1;
    const direct = selectedFolderPermission?.accessLevel || null;
    const dept = selectedFolderDeptMember?.accessLevel || null;
    if (!direct && !dept) return null;
    if (!direct) return dept;
    if (!dept) return direct;
    return getRank(direct) >= getRank(dept) ? direct : dept;
  })();

  const canCreateFolder = user?.role === 'ADMIN';

  const canDeleteFolder =
    user?.role === 'ADMIN' || selectedFolderAccess === 'ADMINISTRATOR';

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;
    dispatch(clearVaultError());
    setConfirmDelete(true);
  };

  const executeDeleteFolder = async () => {
    if (!selectedFolder) return;
    const result = await dispatch(deleteFolder(selectedFolder.id));
    if (deleteFolder.rejected.match(result)) {
      showToast(result.payload || 'Failed to delete folder', 'error');
    }
    setConfirmDelete(false);
  };

  return (
    <div className="bg-[#eef2f7] border-r border-slate-200 p-5 dark:bg-slate-900 dark:border-slate-700">
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 mb-5 dark:bg-slate-800 dark:border-slate-700">
        <Search size={16} className="text-slate-400 dark:text-slate-500" />
        <input
          placeholder="Search"
          className="bg-transparent outline-none w-full text-sm"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
          Folders
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => {
              dispatch(clearVaultError());
              dispatch(clearSelectedFolder());
            }}
            className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center dark:border-slate-600 dark:bg-slate-800"
            title="Clear"
          >
            <X size={15} />
          </button>

          {canCreateFolder && (
            <button
              onClick={() => {
                dispatch(clearVaultError());
                dispatch(openAddFolderModal());
              }}
              className="w-8 h-8 rounded-lg border border-slate-300 bg-white flex items-center justify-center dark:border-slate-600 dark:bg-slate-800"
              title="Add folder"
            >
              <Plus size={15} />
            </button>
          )}

          {selectedFolder && canDeleteFolder && (
            <button
              onClick={handleDeleteFolder}
              disabled={actionLoading}
              className="w-8 h-8 rounded-lg border border-red-300 text-red-600 bg-white flex items-center justify-center disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:bg-slate-800"
              title="Delete folder"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div>
        <div className="text-sm font-semibold text-slate-900 mb-3 dark:text-slate-100">
          {selectedVault?.name || 'Vault'}
        </div>

        <div className="space-y-2">
          {foldersLoading && (
            <p className="text-sm text-slate-400 py-2 dark:text-slate-500">Loading folders...</p>
          )}

          {!foldersLoading &&
            folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  dispatch(clearVaultError());
                  dispatch(selectFolder(folder.id));
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition ${
                  selectedFolderId === folder.id
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800'
                    : 'bg-white text-slate-700 border border-transparent hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <Folder size={15} className="shrink-0" />
                <span className="text-sm font-medium truncate flex-1 min-w-0">{folder.name}</span>
              </button>
            ))}

          {!foldersLoading && !folders.length && (
            <p className="text-sm text-slate-400 py-2 dark:text-slate-500">No folders found.</p>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete Folder"
        message={`Are you sure you want to delete "${selectedFolder?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={executeDeleteFolder}
        onCancel={() => setConfirmDelete(false)}
        loading={actionLoading}
      />
    </div>
  );
}

export default VaultSidebar;