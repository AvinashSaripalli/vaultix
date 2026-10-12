import { FolderPlus, Plus, Trash2 } from 'lucide-react';

function MyVaultHeader({
  folders,
  onCreateFolder,
  onCreatePassword,
  trashOpen = false,
  trashCount = 0,
  onToggleTrash,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 truncate">
          My Vault
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-slate-400">
          Your personal passwords, cards, bank accounts and private folders
        </p>
      </div>

      <div className="flex items-center flex-wrap gap-2 sm:gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onCreateFolder}
          className="h-9 sm:h-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition shadow-sm"
        >
          <FolderPlus size={16} className="shrink-0" />
          <span>New Folder</span>
        </button>

        <button
          type="button"
          onClick={onCreatePassword}
          className="h-9 sm:h-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm font-semibold transition shadow-sm"
        >
          <Plus size={16} className="shrink-0" />
          <span>Add Password</span>
        </button>

        {onToggleTrash && (
          <button
            type="button"
            onClick={onToggleTrash}
            className={`relative h-9 sm:h-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 rounded-xl border text-xs sm:text-sm font-semibold transition shadow-sm ${
              trashOpen
                ? 'bg-red-50 border-red-300 text-red-600 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200'
            }`}
          >
            <Trash2 size={16} className="shrink-0" />
            <span>{trashOpen ? 'Back to Vault' : 'Trash'}</span>
            {!trashOpen && trashCount > 0 && (
              <span className="ml-0.5 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                {trashCount > 99 ? '99+' : trashCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default MyVaultHeader;