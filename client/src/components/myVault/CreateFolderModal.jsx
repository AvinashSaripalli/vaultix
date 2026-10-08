import { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import ModalPortal from '../common/ModalPortal';

function CreateFolderModal({
  open,
  onClose,
  onSubmit,
}) {
  const [folderName, setFolderName] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!folderName.trim()) return;

    onSubmit(folderName.trim());
    setFolderName('');
  };

  return (
    <ModalPortal open={open} onClose={onClose}>
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 dark:bg-slate-800 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Create Folder
            </h2>

            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
              Create a private folder in My Vault
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <label className="text-sm text-slate-600 mb-1 block dark:text-slate-300">
            Folder name
          </label>

          <input
            type="text"
            placeholder="Enter folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 flex items-center gap-2"
          >
            <FolderPlus size={16} />
            Create Folder
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}

export default CreateFolderModal;