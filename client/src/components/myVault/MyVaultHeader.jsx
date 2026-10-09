import { FolderPlus, Plus } from 'lucide-react';

function MyVaultHeader({ folders, onCreateFolder, onCreatePassword }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">My Vault</h1>
        <p className="text-slate-500 mt-1 dark:text-slate-400">
          Your personal passwords, cards, bank accounts and private folders
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCreateFolder}
          className="h-10 flex items-center gap-2 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition shadow-sm"
        >
          <FolderPlus size={16} />
          New Folder
        </button>

        <button
          type="button"
          onClick={onCreatePassword}
          className="h-10 flex items-center gap-2 px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-semibold transition shadow-sm"
        >
          <Plus size={16} />
          Add Password
        </button>
      </div>
    </div>
  );
}

export default MyVaultHeader;