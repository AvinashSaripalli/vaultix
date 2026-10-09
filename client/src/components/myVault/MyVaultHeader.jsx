import { FolderPlus, Plus } from 'lucide-react';

function MyVaultHeader({ folders, onCreateFolder, onCreatePassword }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 min-w-0">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-200 truncate">My Vault</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-slate-400">
          Your personal passwords, cards, bank accounts and private folders
        </p>
      </div>

      <div className="flex items-center flex-wrap gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onCreateFolder}
          className="h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 transition shadow-sm"
        >
          <FolderPlus size={16} />
          <span>New Folder</span>
        </button>

        <button
          type="button"
          onClick={onCreatePassword}
          className="h-9 sm:h-10 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm font-semibold transition shadow-sm"
        >
          <Plus size={16} />
          <span>Add Password</span>
        </button>
      </div>
    </div>
  );
}

export default MyVaultHeader;