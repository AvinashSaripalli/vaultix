import { useState, useMemo } from 'react';
import { Search, Plus, ChevronRight, X, Lock, Folder, Trash2, Building, ShieldCheck, ChevronDown } from 'lucide-react';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import vaultixLogo from '../../assets/Vaultix1.png';

export default function MobileVaultsScreen({
  passwords = [],
  folders = [],
  vaults = [],
  selectedVault,
  onSelectVault,
  onOpenItem,
  onAddNewItem,
  onQuickCopy,
  onOpenFolderManager,
  onOpenTrash,
}) {
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [activeFolderId, setActiveFolderId] = useState('ALL');

  const filtered = useMemo(() => {
    let list = passwords;

    // Filter by Folder
    if (activeFolderId !== 'ALL') {
      if (activeFolderId === 'NO_FOLDER') {
        list = list.filter((p) => !p.folderId);
      } else {
        list = list.filter((p) => p.folderId === activeFolderId);
      }
    }

    // Filter by Type
    if (selectedFilter === 'LOGINS') {
      list = list.filter((p) => !p.type || p.type === 'LOGIN');
    } else if (selectedFilter === 'CARDS') {
      list = list.filter((p) => p.type === 'CARD');
    } else if (selectedFilter === 'NOTES') {
      list = list.filter((p) => p.type === 'SECURE_NOTE');
    } else if (selectedFilter === 'IDENTITIES') {
      list = list.filter((p) => p.type === 'IDENTITY');
    }

    // Filter by Search Query
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.login?.toLowerCase().includes(q) ||
        p.url?.toLowerCase().includes(q)
    );
  }, [passwords, search, selectedFilter, activeFolderId]);

  return (
    <div className="flex flex-col min-h-full select-none">
      {/* Sticky Top Header & Controls */}
      <div className="px-5 pt-3 pb-2 space-y-2.5 border-b border-slate-200 dark:border-slate-800/80 sticky top-0 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md z-30 transition-colors duration-200">
        
        {/* Brand Bar & Fast Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* White Squircle Logo Badge */}
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 dark:border-white/10 p-1 flex items-center justify-center shadow-xs shrink-0">
              <img src={vaultixLogo} alt="Vaultix" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Vaults</h1>
              {vaults.length > 1 ? (
                <div className="flex items-center gap-1">
                  <select
                    value={selectedVault?.id || ''}
                    onChange={(e) => {
                      const v = vaults.find((vault) => vault.id === e.target.value);
                      if (v) {
                        hapticLight();
                        onSelectVault?.(v);
                      }
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-transparent border-none p-0 outline-none cursor-pointer max-w-[140px] truncate"
                  >
                    {vaults.map((v) => (
                      <option key={v.id} value={v.id} className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white">
                        {v.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400">&middot; {passwords.length} items</span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedVault?.name || 'Company Vault'} &middot; {passwords.length} items
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Manage Folders Button */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onOpenFolderManager?.();
              }}
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center active:scale-95 transition shadow-xs"
              title="Manage Folders"
            >
              <Folder size={15} />
            </button>

            {/* Trash Bin Button */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onOpenTrash?.();
              }}
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center active:scale-95 transition shadow-xs"
              title="Trash Bin"
            >
              <Trash2 size={15} />
            </button>

            {/* Add Item Button */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onAddNewItem?.();
              }}
              className="h-8 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1 shadow-md shadow-indigo-600/30 active:scale-95 transition ml-1"
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Search Pill */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search credentials, cards, notes..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Carousel Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'ALL', label: `All (${passwords.length})` },
            { id: 'LOGINS', label: 'Logins' },
            { id: 'CARDS', label: 'Cards' },
            { id: 'NOTES', label: 'Notes' },
            { id: 'IDENTITIES', label: 'Identities' },
          ].map((cat) => {
            const active = selectedFilter === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  hapticLight();
                  setSelectedFilter(cat.id);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 shadow-xs'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Folders Filter Pill Row (If Folders Exist) */}
        {folders.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar border-t border-slate-100 dark:border-slate-850 pt-1.5">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveFolderId('ALL');
              }}
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition ${
                activeFolderId === 'ALL'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Folders
            </button>
            {folders.map((f) => {
              const active = activeFolderId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setActiveFolderId(f.id);
                  }}
                  className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap flex items-center gap-1 transition ${
                    active
                      ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Folder size={11} />
                  <span>{f.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Item List */}
      <div className="flex-1 px-5 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-slate-400">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-xs">
              <Search size={20} />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No matching items</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Try adjusting your filters or search query</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                hapticLight();
                onOpenItem(item);
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer active:scale-98 transition shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ItemServiceIcon name={item.name} type={item.type} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</h4>
                    {item.isSensitive && (
                      <Lock size={11} className="text-amber-500 dark:text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px]">
                    {item.login || item.folder?.name || item.type || 'Login'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticMedium();
                    onQuickCopy(item);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-600/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700/80 active:scale-95 transition"
                >
                  Copy
                </button>
                <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => {
          hapticMedium();
          onAddNewItem?.();
        }}
        aria-label="Add item"
        className="fixed right-5 bottom-20 z-30 w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-600/35 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-150"
      >
        <Plus size={22} strokeWidth={2.6} />
      </button>
    </div>
  );
}
