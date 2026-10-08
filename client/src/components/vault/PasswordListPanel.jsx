import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  selectPassword,
  setSearchTerm,
} from '../../features/vault/vaultSlice';

function PasswordListPanel() {
  const dispatch = useDispatch();
  const {
    passwords,
    selectedPasswordId,
    searchTerm,
    selectedFolderId,
  } = useSelector((state) => state.vault);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const filteredPasswords = passwords.filter((item) => {
    const q = searchTerm.toLowerCase();

    const matchesSearch =
      item.name?.toLowerCase().includes(q) ||
      item.login?.toLowerCase().includes(q) ||
      item.url?.toLowerCase().includes(q);

    const matchesFolder = selectedFolderId
      ? item.folderId === selectedFolderId
      : true;

    return matchesSearch && matchesFolder;
  });

  const groupedPasswords = Object.values(
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
    if (!selectedFolderId) {
      dispatch(selectPassword(null));
      return;
    }

    if (!paginatedGroups.length) {
      dispatch(selectPassword(null));
      return;
    }

    const stillVisible = paginatedGroups.some((group) =>
      group.items.some((item) => item.id === selectedPasswordId)
    );

    // If current selected password is not on this page, select the first on this page
    if (!stillVisible) {
      dispatch(selectPassword(paginatedGroups[0].items[0].id));
    }
  }, [paginatedGroups, selectedPasswordId, selectedFolderId, dispatch]);

  return (
    <div className="bg-white p-6 border-r border-slate-200 dark:bg-slate-800 dark:border-slate-700 flex flex-col justify-between min-h-[640px]">
      <div>
        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search passwords..."
            value={searchTerm}
            onChange={(e) => dispatch(setSearchTerm(e.target.value))}
            className="w-full h-[48px] rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/50 dark:border-slate-700"
          />
        </div>

        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[24px] font-bold text-slate-900 leading-tight dark:text-slate-100">
              {totalGroups} password{totalGroups !== 1 ? 's' : ''}
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

        <div className="space-y-3">
          {paginatedGroups.map((group) => {
            const active = group.items.some(
              (item) => item.id === selectedPasswordId
            );

            return (
              <button
                key={group.name}
                onClick={() => dispatch(selectPassword(group.items[0].id))}
                className={`w-full text-left px-5 py-4 rounded-2xl border transition ${
                  active
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm dark:bg-indigo-900/20 dark:border-indigo-800'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <div className="text-[17px] font-bold text-slate-900 dark:text-slate-100 truncate">
                  {group.name}
                </div>

                <div className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                  {group.items.length} account{group.items.length > 1 ? 's' : ''}
                </div>
              </button>
            );
          })}

          {!groupedPasswords.length && (
            <p className="text-slate-500 text-sm py-8 text-center dark:text-slate-400">No passwords found.</p>
          )}
        </div>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && !isAll && (
        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={validPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              const isActive = page === validPage;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={validPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default PasswordListPanel;