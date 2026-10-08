import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  closeAddFolderModal,
  createFolder,
} from '../../features/vault/vaultSlice';
import ModalPortal from '../common/ModalPortal';

function AddFolderModal() {
  const dispatch = useDispatch();
  const {
    isAddFolderModalOpen,
    selectedVault,
    _selectedFolderId,
    actionLoading,
  } = useSelector((state) => state.vault);

  const [name, setName] = useState('');

  if (!isAddFolderModalOpen) return null;

const handleSubmit = async (e) => {
  e.preventDefault();

  const result = await dispatch(
    createFolder({
      name,
      vaultId: selectedVault?.id,
    })
  );

  if (createFolder.fulfilled.match(result)) {
    setName('');
  }
};

  return (
    <ModalPortal open={isAddFolderModalOpen} onClose={() => dispatch(closeAddFolderModal())}>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto"
        onClick={() => dispatch(closeAddFolderModal())}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 dark:bg-slate-800 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold dark:text-slate-100">Create Folder</h2>
            <button
              onClick={() => dispatch(closeAddFolderModal())}
              className="text-slate-500 text-xl dark:text-slate-400"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Folder name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
              required
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => dispatch(closeAddFolderModal())}
                className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

export default AddFolderModal;