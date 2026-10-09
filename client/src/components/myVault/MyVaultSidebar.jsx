import { useState, useEffect } from 'react';
import { Edit2, Folder, FolderOpen, Layers, MoreHorizontal, Trash2 } from 'lucide-react';

function MyVaultSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onEditFolder,
  onDeleteFolder,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const toggleMenu = (e, folderId) => {
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === folderId ? null : folderId));
  };

  const handleEdit = (e, folder) => {
    e.stopPropagation();
    setOpenMenuId(null);
    onEditFolder(folder);
  };

  const handleDelete = (e, folder) => {
    e.stopPropagation();
    setOpenMenuId(null);
    onDeleteFolder(folder);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 min-h-[600px] dark:bg-slate-800 dark:border-slate-700 shadow-sm flex flex-col">
      <div className="px-2 py-1.5 mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Personal Folders
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          onSelectFolder(null);
          setOpenMenuId(null);
        }}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left mb-1.5 ${
          !selectedFolderId
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-750'
        }`}
      >
        <Layers size={17} className={!selectedFolderId ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
        <span>All Items</span>
      </button>

      <div className="space-y-1 flex-1 overflow-y-auto">
        {folders.map((folder) => {
          const isSelected = selectedFolderId === folder.id;
          return (
            <div
              key={folder.id}
              onClick={() => {
                onSelectFolder(folder.id);
                setOpenMenuId(null);
              }}
              className={`relative group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                isSelected
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-750'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1" title={folder.name}>
                {isSelected ? (
                  <FolderOpen size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                ) : (
                  <Folder size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0 transition-colors" />
                )}
                <span className="truncate flex-1 min-w-0">{folder.name}</span>
              </div>

              <button
                type="button"
                onClick={(e) => toggleMenu(e, folder.id)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0 transition"
                title="Folder actions"
                aria-label={`Actions for folder ${folder.name}`}
              >
                <MoreHorizontal size={15} className="shrink-0" />
              </button>

              {openMenuId === folder.id && (
                <div
                  className="absolute right-2 top-10 z-30 w-36 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 dark:bg-slate-800 dark:border-slate-700 animate-slide-up"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => handleEdit(e, folder)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700/60"
                  >
                    <Edit2 size={13} />
                    Rename
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, folder)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {folders.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
            No folders created yet.
          </div>
        )}
      </div>
    </div>
  );
}

export default MyVaultSidebar;