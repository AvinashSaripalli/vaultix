import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  ChevronRight,
  X,
  Lock,
  Folder,
  Trash2,
  Building,
  Bell,
  Share2,
  Users,
  Copy,
  SlidersHorizontal,
  KeyRound,
  CreditCard,
  FileText,
  UserCheck,
} from 'lucide-react';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import vaultixLogo from '../../assets/Vaultix1.png';

const CATEGORIES = [
  { id: 'ALL', label: 'All Items', icon: null },
  { id: 'LOGINS', label: 'Logins', icon: KeyRound },
  { id: 'CARDS', label: 'Cards', icon: CreditCard },
  { id: 'NOTES', label: 'Notes', icon: FileText },
  { id: 'IDENTITIES', label: 'Identities', icon: UserCheck },
  { id: 'SHARED', label: 'Shared with Me', icon: Share2 },
];

export default function MobileVaultsScreen({
  passwords = [],
  folders = [],
  vaults = [],
  selectedVault,
  personalCount = 0,
  companyCount = 0,
  unreadCount = 0,
  onSelectVault,
  onOpenItem,
  onAddNewItem,
  onQuickCopy,
  onOpenFolderManager,
  onOpenTrash,
  onOpenNotifications,
  onOpenSharedWithMe,
  onOpenShareFolder,
  onOpenFolderMembers,
  selectedFolderId: controlledFolderId,
  onSelectFolderId,
}) {
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [internalFolderId, setInternalFolderId] = useState('ALL');

  const activeFolderId = controlledFolderId !== undefined ? controlledFolderId : internalFolderId;
  const setActiveFolderId = (id) => {
    setInternalFolderId(id);
    onSelectFolderId?.(id);
  };

  const isPersonal = selectedVault?.type === 'PERSONAL';
  const companyVaults = vaults.filter((v) => v.type !== 'PERSONAL');
  const activeFolder = activeFolderId !== 'ALL' && activeFolderId !== 'NO_FOLDER'
    ? folders.find((f) => f.id === activeFolderId)
    : null;

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
    <div className="flex flex-col min-h-full select-none bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Streamlined Sticky Header & Controls (Option A: Modern Minimalist) */}
      <div className="px-4 pt-3 pb-2.5 space-y-2 border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-md z-30 transition-colors duration-200">
        
        {/* Row 1: Logo, Title & Quick Actions */}
        <div className="flex items-center justify-between gap-2">
          {/* Logo Squircle & Title */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-1 flex items-center justify-center shadow-xs shrink-0">
              <img src={vaultixLogo} alt="Vaultix" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white leading-tight">Vaults</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                {isPersonal ? 'Personal Vault' : selectedVault?.name || 'Company Vault'} &middot; {passwords.length} items
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onOpenNotifications?.();
              }}
              className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center active:scale-95 transition shadow-xs relative"
              title="Notifications"
            >
              <Bell size={14} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </button>

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
              <Folder size={14} />
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
              <Trash2 size={14} />
            </button>

            {/* Primary Add New Item Button */}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onAddNewItem?.();
              }}
              className="h-8 px-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1 shadow-md shadow-indigo-600/30 active:scale-95 transition ml-0.5"
              title="Add New Item"
            >
              <Plus size={14} />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Row 2: Sleek Full-Width Segmented Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300/50 dark:border-slate-800 text-xs font-bold shadow-inner">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onSelectVault?.('PERSONAL');
            }}
            className={`py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 ${
              isPersonal
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock size={12} className={isPersonal ? 'text-indigo-600 dark:text-indigo-400' : ''} />
            <span>Personal Vault</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              isPersonal
                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {personalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onSelectVault?.('COMPANY');
            }}
            className={`py-1.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all active:scale-95 ${
              !isPersonal
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Building size={12} className={!isPersonal ? 'text-indigo-600 dark:text-indigo-400' : ''} />
            <span>Company Vault</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              !isPersonal
                ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {companyCount}
            </span>
          </button>
        </div>

        {/* Sub-switcher for multiple company vaults if present */}
        {!isPersonal && companyVaults.length > 1 && (
          <div className="flex items-center justify-between px-1 text-[11px] bg-slate-100/60 dark:bg-slate-900/60 py-1 px-2.5 rounded-lg">
            <span className="text-slate-400 font-semibold">Workspace Vault:</span>
            <select
              value={selectedVault?.id || ''}
              onChange={(e) => {
                const v = companyVaults.find((vault) => vault.id === e.target.value);
                if (v) {
                  hapticLight();
                  onSelectVault?.(v);
                }
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-transparent border-none p-0 outline-none cursor-pointer max-w-[190px] truncate"
            >
              {companyVaults.map((v) => (
                <option key={v.id} value={v.id} className="text-slate-900 bg-white dark:bg-slate-900 dark:text-white">
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Row 2: Unified Search & Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
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
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter Toggle Button */}
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setShowFilterMenu(!showFilterMenu);
            }}
            className={`h-9 px-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition shadow-xs shrink-0 ${
              selectedFilter !== 'ALL' || showFilterMenu
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-600/20'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="Filter items"
          >
            <SlidersHorizontal size={14} />
            <span className="text-[11px]">
              {selectedFilter === 'ALL' ? 'Filter' : selectedFilter.toLowerCase()}
            </span>
          </button>
        </div>

        {/* Expandable Category Filter Pills (When filter button is tapped or non-ALL selected) */}
        {showFilterMenu && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar animate-fadeIn">
            {CATEGORIES.map((cat) => {
              const active = selectedFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    if (cat.id === 'SHARED') {
                      onOpenSharedWithMe?.();
                    } else {
                      setSelectedFilter(cat.id);
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition flex items-center gap-1 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {cat.icon && <cat.icon size={11} />}
                  <span>{cat.id === 'ALL' ? `All (${passwords.length})` : cat.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Row 3: Single Horizontal Pill Bar for Folders */}
        {folders.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar pt-0.5">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveFolderId('ALL');
              }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition shrink-0 ${
                activeFolderId === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300'
              }`}
            >
              All Folders
            </button>
            {folders.map((f) => {
              const active = activeFolderId === f.id;
              const count = passwords.filter((p) => p.folderId === f.id).length;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setActiveFolderId(f.id);
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap flex items-center gap-1.5 transition shrink-0 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300'
                  }`}
                >
                  <Folder size={12} className={active ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'} />
                  <span>{f.name}</span>
                  <span className={`text-[10px] ${active ? 'text-indigo-100' : 'text-slate-400'}`}>({count})</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                hapticLight();
                onOpenFolderManager?.();
              }}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 flex items-center gap-1 whitespace-nowrap shrink-0 transition"
              title="Add Folder"
            >
              <Plus size={11} />
              <span>Folder</span>
            </button>
          </div>
        )}
      </div>

      {/* Item List */}
      <div className="flex-1 px-4 py-3 space-y-2 pb-28">
        {/* Active Folder Banner (Compact strip when folder selected) */}
        {activeFolder && (
          <div className="p-2.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-between gap-2 animate-fadeIn mb-1 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Folder size={14} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">
                    Folder
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 font-bold text-indigo-700 dark:text-indigo-300">
                    {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <h3 className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {activeFolder.name}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* If Company Vault: Members and Share shortcuts */}
              {!isPersonal && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      onOpenFolderMembers?.(activeFolder);
                    }}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1 text-[10px] font-bold active:scale-95 transition shadow-xs"
                    title="Folder Members"
                  >
                    <Users size={11} />
                    <span>Members</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      onOpenShareFolder?.(activeFolder);
                    }}
                    className="px-2 py-1 rounded-lg bg-indigo-600 text-white flex items-center gap-1 text-[10px] font-bold shadow-xs active:scale-95 transition"
                    title="Share Folder"
                  >
                    <Share2 size={11} />
                    <span>Share</span>
                  </button>
                </>
              )}

              {/* Close/Reset Active Folder */}
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setActiveFolderId('ALL');
                }}
                className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition"
                title="Exit folder view"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-slate-400">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-xs">
              <Search size={20} />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No matching items</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Try adjusting your filters or search query</p>
          </div>
        ) : (
          /* Credentials Cards */
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                hapticLight();
                onOpenItem(item);
              }}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-400 dark:hover:border-slate-700 flex items-center justify-between cursor-pointer active:scale-98 transition shadow-xs hover:shadow-md"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ItemServiceIcon name={item.name} type={item.type} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {item.name}
                    </h4>
                    {item.isSensitive && (
                      <Lock size={11} className="text-amber-500 dark:text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[210px]">
                    {item.login || item.folder?.name || item.type || 'Login'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                {/* Sleek Modern Copy Icon Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticMedium();
                    onQuickCopy(item);
                  }}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/60 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 flex items-center justify-center border border-slate-200/80 dark:border-slate-800 active:scale-90 transition"
                  title="Copy"
                  aria-label="Copy"
                >
                  <Copy size={13} />
                </button>
                <ChevronRight size={16} className="text-slate-400 dark:text-slate-500" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
