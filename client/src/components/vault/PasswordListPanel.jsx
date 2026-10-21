import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  selectPassword,
  setSearchTerm,
} from '../../features/vault/vaultSlice';
import ItemTypeBadge from '../myVault/ItemTypeBadge';
import { getItemTypeMeta } from '../../utils/itemTypes';

function getPaginationItems(current, total) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // Near the start: show 1, 2, 3, ..., total
  if (current <= 3) {
    return [1, 2, 3, 'ellipsis-end', total];
  }

  // Near the end: show 1, ..., total - 2, total - 1, total
  if (current >= total - 2) {
    return [1, 'ellipsis-start', total - 2, total - 1, total];
  }

  // In the middle: show 1, ..., current - 1, current, current + 1, ..., total
  return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', total];
}

function PasswordListPanel() {
  const dispatch = useDispatch();
  const {
    passwords,
    selectedPasswordId,
    searchTerm,
    selectedFolderId,
    folders = [],
  } = useSelector((state) => state.vault);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

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

  // Reset to page 1 whenever search query or folder selection changes
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

  useEffect(() => {
    if (!paginatedGroups.length) {
      if (selectedPasswordId !== null) {
        dispatch(selectPassword(null));
      }
      return;
    }

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

    // On mobile (< 768px), keep selectedPasswordId as null when returning to the list
    if (!selectedPasswordId) {
      if (isDesktop) {
        dispatch(selectPassword(paginatedGroups[0].items[0].id));
      }
      return;
    }

    const stillVisible = paginatedGroups.some((group) =>
      group.items.some((item) => item.id === selectedPasswordId)
    );

    // If current selected password is not on this page, select the first on desktop or return to list on mobile
    if (!stillVisible) {
      dispatch(selectPassword(isDesktop ? paginatedGroups[0].items[0].id : null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginatedGroups, selectedFolderId, dispatch]);

  return (
    <div className="bg-white p-3.5 sm:p-5 border-r border-slate-200 dark:bg-slate-800 dark:border-slate-700 flex flex-col justify-between min-h-[640px] min-w-0">
      <div>
        <div className="relative mb-3.5">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => dispatch(setSearchTerm(e.target.value))}
            className="w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/50 dark:border-slate-700"
          />
        </div>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="min-w-0">
            <p className="text-lg sm:text-xl font-bold text-slate-900 leading-tight dark:text-slate-100 truncate">
              {totalGroups} item{totalGroups !== 1 ? 's' : ''}
            </p>
            {totalGroups > 0 && !isAll && (
              <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
                Showing {startIndex + 1}–{endIndex} of {totalGroups}
              </p>
            )}
          </div>

          {totalGroups > 6 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="hidden sm:inline">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value={6}>6</option>
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value="all">All</option>
              </select>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {paginatedGroups.map((group) => {
            const active = group.items.some(
              (item) => item.id === selectedPasswordId
            );
            const firstItem = group.items[0];
            const meta = getItemTypeMeta(firstItem?.type);

            return (
              <button
                key={group.name}
                onClick={() => dispatch(selectPassword(firstItem.id))}
                className={`w-full text-left px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl border transition min-w-0 ${
                  active
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm dark:bg-indigo-900/20 dark:border-indigo-800'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <div className="text-sm sm:text-[15px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {group.name}
                </div>

                <div className="flex items-center gap-2 mt-1 min-w-0">
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1 min-w-0">
                    {group.items.length > 1
                      ? `${group.items.length} accounts`
                      : firstItem?.login || meta.label}
                  </span>
                  {!selectedFolderId && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 truncate max-w-[110px]"
                      title={firstItem?.folder?.name || folders.find((f) => f.id === firstItem?.folderId)?.name || 'Vault Root'}
                    >
                      {firstItem?.folder?.name || folders.find((f) => f.id === firstItem?.folderId)?.name || 'Vault Root'}
                    </span>
                  )}
                  <ItemTypeBadge type={firstItem?.type} />
                </div>
              </button>
            );
          })}

          {!groupedPasswords.length && (
            <p className="text-slate-500 text-sm py-8 text-center dark:text-slate-400">No items found.</p>
          )}
        </div>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && !isAll && (
        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1 select-none">
          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={validPage === 1}
            aria-label="Previous page"
            title="Previous page"
            className="h-8 px-2 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition shrink-0"
          >
            <ChevronLeft size={14} />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <div className="flex items-center gap-1 min-w-0 justify-center overflow-hidden">
            {getPaginationItems(validPage, totalPages).map((item, idx) => {
              if (typeof item === 'string') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="h-8 w-4 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium select-none shrink-0"
                  >
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
                  aria-label={`Page ${item}`}
                  aria-current={isActive ? 'page' : undefined}
                  className={`h-8 min-w-[32px] px-1.5 rounded-lg text-xs font-semibold transition shrink-0 flex items-center justify-center ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={validPage === totalPages}
            aria-label="Next page"
            title="Next page"
            className="h-8 px-2 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition shrink-0"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default PasswordListPanel;