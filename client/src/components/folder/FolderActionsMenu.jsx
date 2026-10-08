import { MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function FolderActionsMenu({
  folder,
  canManage,
  isSelected,
  onRename,
  onShare,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!canManage) return null;

  return (
    <div className="relative shrink-0 flex items-center" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        title="Folder actions"
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          isSelected
            ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800/50'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
        }`}
      >
        <MoreHorizontal size={15} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-2 z-50">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onRename(folder);
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <Pencil size={14} className="shrink-0" />
            Rename
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onShare(folder);
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <Share2 size={14} className="shrink-0" />
            Share
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onDelete(folder);
            }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
          >
            <Trash2 size={14} className="shrink-0" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default FolderActionsMenu;