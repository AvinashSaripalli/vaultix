import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import ModalPortal from '../common/ModalPortal';

function EditFolderModal({ open, folder, onClose, onSubmit }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (folder) {
      setName(folder.name || '');
    }
  }, [folder]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim());
  };

  return (
    <ModalPortal open={open} onClose={onClose}>
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 dark:bg-slate-800 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit Folder</h2>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400">
            <X size={20} />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border text-sm border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm"
          >
            Save
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}

export default EditFolderModal;