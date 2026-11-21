import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, ChevronLeft, ChevronRight, Folder } from 'lucide-react';
import {
  selectPassword,
  setSearchTerm,
  setFolderPage,
} from '../../features/vault/vaultSlice';
import ItemTypeBadge from '../myVault/ItemTypeBadge';
import ItemServiceIcon from '../common/ItemServiceIcon';
import { hapticLight } from '../../utils/haptics';
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
    folderPage = 1,
    folderPageSize = 10,
  } = useSelector((state) => state.vault);

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

  const totalGroups = groupedPasswords.length;
  const isAll = folderPageSize === 'all';
  const effectivePageSize = isAll ? Math.max(totalGroups, 1) : Number(folderPageSize);
  const totalPages = Math.ceil(totalGroups / effectivePageSize) || 1;
  const validPage = Math.min(Math.max(folderPage, 1), totalPages);

  // Sync if validPage differs from stored folderPage
  useEffect(() => {
    if (validPage !== folderPage) {
      dispatch(setFolderPage(validPage));
    }
  }, [validPage, folderPage, dispatch]);

  const startIndex = (validPage - 1) * effectivePageSize;
  const endIndex = isAll ? totalGroups : Math.min(startIndex + effectivePageSize, totalGroups);

  const paginatedGroups = useMemo(() => {
    return groupedPasswords.slice(startIndex, endIndex);
  }, [groupedPasswords, startIndex, endIndex]);

  // Ensure current page shows the selected password, or deselect if password was removed
  useEffect(() => {
    if (!selectedPasswordId) {
      return;
    }

    if (!groupedPasswords.length) {
      dispatch(selectPassword(null));
      return;
    }

    const groupIndex = groupedPasswords.findIndex((group) =>
      group.items.some((item) => item.id === selectedPasswordId)
    );

    if (groupIndex === -1) {
      // Selected password is no longer present in this folder/search query
      dispatch(selectPassword(null));
    } else {
      const targetPage = Math.floor(groupIndex / effectivePageSize) + 1;
      if (validPage !== targetPage) {
        dispatch(setFolderPage(targetPage));
      }
    }
  }, [selectedPasswordId, groupedPasswords, effectivePageSize, validPage, dispatch]);

  return (
    <div className="bg-white p-3 sm:p-4 border-r border-slate-200 dark:bg-slate-800 dark:border-slate-700 flex flex-col justify-between min-h-[640px] min-w-0">
      <div>
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => dispatch(setSearchTerm(e.target.value))}
            className="w-full h-9.5 rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-xs sm:text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all dark:bg-slate-800/50 dark:border-slate-700 dark:focus:bg-slate-800"
          />
        </div>

        <div className="flex items-center justify-between mb-2.5 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          <div className="flex items-center gap-1.5 min-w-0">
            <span>CREDENTIALS</span>
            <span className="text-slate-400 dark:text-slate-500 font-semibold normal-case">
              ({totalGroups})
            </span>
          </div>
          {totalGroups > 0 && !isAll && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal lowercase">
              {startIndex + 1}–{endIndex} of {totalGroups}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {paginatedGroups.map((group) => {
            const active = group.items.some(
              (item) => item.id === selectedPasswordId
            );
            const firstItem = group.items[0];
            const meta = getItemTypeMeta(firstItem?.type);

            return (
              <button
                key={group.name}
                type="button"
                onClick={() => {
                  hapticLight();
                  dispatch(selectPassword(firstItem.id));
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all active:scale-[0.99] flex items-center gap-3 min-w-0 ${
                  active
                    ? 'bg-indigo-50/90 border-indigo-300 shadow-sm ring-1 ring-indigo-400/20 dark:bg-indigo-950/40 dark:border-indigo-600 dark:ring-indigo-500/20'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 dark:bg-slate-800 dark:border-slate-700/80 dark:hover:border-slate-600 dark:hover:bg-slate-750/70 shadow-2xs'
                }`}
              >
                <ItemServiceIcon name={group.name} type={firstItem?.type} size="md" />

                <div className="flex-1 min-w-0">
                  {/* Line 1: Bold title + Category Badge right aligned */}
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
                      {group.name}
                    </span>
                    <ItemTypeBadge type={firstItem?.type} size="xs" />
                  </div>

                  {/* Line 2: Full email/account without awkward truncation */}
                  <div className="flex items-center justify-between gap-2 mt-1 min-w-0">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate min-w-0">
                      {group.items.length > 1
                        ? `${group.items.length} accounts`
                        : firstItem?.login || (firstItem?.type === 'CARD' ? 'Card details' : meta.label)}
                    </span>
                    {!selectedFolderId && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 truncate max-w-[85px] shrink-0"
                        title={firstItem?.folder?.name || folders.find((f) => f.id === firstItem?.folderId)?.name || 'Vault Root'}
                      >
                        <Folder size={9} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span className="truncate">
                          {firstItem?.folder?.name || folders.find((f) => f.id === firstItem?.folderId)?.name || 'Vault Root'}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight size={15} className={`shrink-0 transition-colors ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-300 dark:text-slate-600'}`} />
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
            onClick={() => dispatch(setFolderPage(Math.max(validPage - 1, 1)))}
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
                  onClick={() => dispatch(setFolderPage(item))}
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
            onClick={() => dispatch(setFolderPage(Math.min(validPage + 1, totalPages)))}
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