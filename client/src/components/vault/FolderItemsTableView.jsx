import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, Folder, Lock, Plus, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { selectPassword, setSearchTerm } from '../../features/vault/vaultSlice';
import ItemServiceIcon from '../common/ItemServiceIcon';
import { hapticLight } from '../../utils/haptics';
import { getItemTypeMeta } from '../../utils/itemTypes';

function getPaginationItems(current, total) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 'ellipsis-end', total];
  }
  if (current >= total - 2) {
    return [1, 'ellipsis-start', total - 2, total - 1, total];
  }
  return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', total];
}

export default function FolderItemsTableView({ onAddPassword }) {
  const dispatch = useDispatch();
  const {
    passwords,
    searchTerm,
    selectedFolderId,
    folders = [],
  } = useSelector((state) => state.vault);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const filteredPasswords = useMemo(() => {
    const q = searchTerm.toLowerCase();

    return passwords.filter((item) => {
      const matchesSearch =
        item.name?.toLowerCase().includes(q) ||
        item.login?.toLowerCase().includes(q) ||
        item.url?.toLowerCase().includes(q);

      const matchesFolder = selectedFolderId
        ? item.folderId === selectedFolderId
        : true;

      return matchesSearch && matchesFolder;
    });
  }, [passwords, searchTerm, selectedFolderId]);

  const groupedPasswords = useMemo(() => {
    return Object.values(
      filteredPasswords.reduce((acc, item) => {
        const key = item.name?.trim().toLowerCase() || 'untitled';

        if (!acc[key]) {
          acc[key] = {
            name: item.name || 'Untitled',
            items: [],
          };
        }

        acc[key].items.push(item);
        return acc;
      }, {})
    );
  }, [filteredPasswords]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedFolderId]);

  const totalGroups = groupedPasswords.length;
  const isAll = pageSize === 'all';
  const effectivePageSize = isAll ? Math.max(totalGroups, 1) : Number(pageSize);
  const totalPages = Math.ceil(totalGroups / effectivePageSize) || 1;
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);

  const startIndex = (validPage - 1) * effectivePageSize;
  const endIndex = isAll ? totalGroups : Math.min(startIndex + effectivePageSize, totalGroups);

  const paginatedGroups = useMemo(() => {
    return groupedPasswords.slice(startIndex, endIndex);
  }, [groupedPasswords, startIndex, endIndex]);

  return (
    <div className="flex flex-col min-h-[580px] w-full bg-white dark:bg-slate-800 rounded-b-2xl">
      {/* Top Controls: Search + Count + Page Size */}
      <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search items in this folder..."
            value={searchTerm}
            onChange={(e) => dispatch(setSearchTerm(e.target.value))}
            className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-xs sm:text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-750 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => dispatch(setSearchTerm(''))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {totalGroups} item{totalGroups !== 1 ? 's' : ''}
            {totalGroups > 0 && !isAll && ` (Showing ${startIndex + 1}–${endIndex})`}
          </span>

          {totalGroups > 5 && (
            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value="all">All</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Table View */}
      {paginatedGroups.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 dark:text-slate-500 min-h-[380px]">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-750 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
            <Folder size={28} />
          </div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
            {searchTerm ? 'No matching items' : 'This folder is empty'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
            {searchTerm
              ? `No credentials in "${selectedFolder?.name || 'this folder'}" match "${searchTerm}".`
              : `Add credentials to "${selectedFolder?.name || 'this folder'}" to store and share them securely.`}
          </p>
          {!searchTerm && onAddPassword && (
            <button
              type="button"
              onClick={onAddPassword}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold transition shadow-sm"
            >
              <Plus size={16} />
              <span>Add Password</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-700/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50/60 dark:bg-slate-750/40">
                <th className="py-3 px-4 sm:px-6 w-[30%]">NAME</th>
                <th className="py-3 px-4 sm:px-6 w-[24%]">LOGIN</th>
                <th className="py-3 px-4 sm:px-6 w-[26%]">URL</th>
                <th className="py-3 px-4 sm:px-6 w-[20%]">TAGS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {paginatedGroups.map((group) => {
                const firstItem = group.items[0];
                const tagNames = Array.from(
                  new Set(
                    group.items.flatMap((item) =>
                      (item.tags || []).map((t) => t.tag?.name).filter(Boolean)
                    )
                  )
                );

                return (
                  <tr
                    key={group.name}
                    onClick={() => {
                      hapticLight();
                      dispatch(selectPassword(firstItem.id));
                    }}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-700/50 transition-colors cursor-pointer group"
                  >
                    {/* NAME */}
                    <td className="py-3 px-4 sm:px-6 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <ItemServiceIcon name={group.name} type={firstItem?.type} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                              {group.name}
                            </span>
                            {group.items.length > 1 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 shrink-0">
                                {group.items.length} accounts
                              </span>
                            )}
                            {firstItem?.isSensitive && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-semibold dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 shrink-0"
                                title="Requires Master Password to view"
                              >
                                <Lock size={10} />
                                <span>Secured</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* LOGIN */}
                    <td className="py-3 px-4 sm:px-6 text-sm text-slate-600 dark:text-slate-300 font-mono">
                      {firstItem?.login ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate max-w-[220px]" title={firstItem.login}>
                            {firstItem.login}
                          </span>
                          {group.items.length > 1 && (
                            <span className="text-[11px] text-slate-400 shrink-0">
                              (+{group.items.length - 1})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* URL */}
                    <td className="py-3 px-4 sm:px-6 text-sm">
                      {firstItem?.url ? (
                        <span
                          className="text-blue-600 dark:text-blue-400 group-hover:underline truncate block max-w-[240px]"
                          title={firstItem.url}
                        >
                          {firstItem.url.replace(/^https?:\/\//i, '')}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>

                    {/* TAGS */}
                    <td className="py-3 px-4 sm:px-6 text-sm min-w-0">
                      {tagNames.length > 0 ? (
                        <div
                          className="flex items-center gap-1.5 flex-nowrap min-w-0"
                          title={tagNames.join(', ')}
                        >
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-650 truncate max-w-[120px] sm:max-w-[150px]"
                            title={tagNames[0]}
                          >
                            {tagNames[0]}
                          </span>
                          {tagNames.length > 1 && (
                            <span
                              className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 shrink-0 cursor-help hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
                              title={tagNames.slice(1).join(', ')}
                            >
                              +{tagNames.length - 1}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3.5 sm:px-6 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50/40 dark:bg-slate-800/40 rounded-b-2xl">
          <button
            type="button"
            disabled={validPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-650 transition cursor-pointer"
          >
            <ChevronLeft size={14} />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1">
            {getPaginationItems(validPage, totalPages).map((item, idx) => {
              if (typeof item === 'string') {
                return (
                  <span key={`${item}-${idx}`} className="px-1 text-slate-400">
                    …
                  </span>
                );
              }
              const isActive = item === validPage;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={`w-7 h-7 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={validPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-650 transition cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
