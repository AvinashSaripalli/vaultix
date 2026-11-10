import { useState, useMemo } from 'react';
import { Search, Plus, ChevronRight, X, Lock } from 'lucide-react';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import vaultixLogo from '../../assets/Vaultix1.png';

export default function MobileVaultsScreen({
  passwords = [],
  onOpenItem,
  onAddNewItem,
  onQuickCopy,
}) {
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');

  const filtered = useMemo(() => {
    let list = passwords;
    if (selectedFilter === 'LOGINS') {
      list = list.filter((p) => !p.type || p.type === 'LOGIN');
    } else if (selectedFilter === 'CARDS') {
      list = list.filter((p) => p.type === 'CARD');
    } else if (selectedFilter === 'NOTES') {
      list = list.filter((p) => p.type === 'SECURE_NOTE');
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.login?.toLowerCase().includes(q) ||
        p.url?.toLowerCase().includes(q)
    );
  }, [passwords, search, selectedFilter]);

  return (
    <div className="flex flex-col min-h-full select-none">
      {/* Sticky Top Header & Search */}
      <div className="px-5 pt-3 pb-2 space-y-2.5 border-b border-slate-800/80 sticky top-0 bg-slate-950/95 backdrop-blur-md z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 border border-indigo-500/30 p-1 flex items-center justify-center shadow-sm shrink-0">
              <img src={vaultixLogo} alt="Vaultix" className="w-full h-full object-contain drop-shadow" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white">Vaults</h1>
              <p className="text-[11px] text-slate-400">{passwords.length} encrypted credentials</p>
            </div>
          </div>
          <button
            onClick={() => {
              hapticLight();
              onAddNewItem();
            }}
            className="h-8 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1 shadow-md shadow-indigo-600/30 active:scale-95 transition"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>

        {/* Floating Search Pill */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search credentials, usernames..."
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Carousel Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => {
              hapticLight();
              setSelectedFilter('ALL');
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
              selectedFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            All ({passwords.length})
          </button>
          <button
            onClick={() => {
              hapticLight();
              setSelectedFilter('LOGINS');
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
              selectedFilter === 'LOGINS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Logins
          </button>
          <button
            onClick={() => {
              hapticLight();
              setSelectedFilter('CARDS');
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
              selectedFilter === 'CARDS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => {
              hapticLight();
              setSelectedFilter('NOTES');
            }}
            className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
              selectedFilter === 'NOTES'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}
          >
            Notes
          </button>
        </div>
      </div>

      {/* Item List */}
      <div className="flex-1 px-5 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2 text-slate-400">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Search size={20} />
            </div>
            <p className="text-xs font-semibold text-slate-300">No matching items</p>
            <p className="text-[11px] text-slate-500">Try adjusting your search query</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                hapticLight();
                onOpenItem(item);
              }}
              className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer active:scale-98 transition shadow-xs"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <ItemServiceIcon name={item.name} type={item.type} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                    {item.isSensitive && (
                      <Lock size={11} className="text-amber-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-[200px]">
                    {item.login || item.folder?.name || 'Login'}
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
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-[10px] font-bold text-indigo-400 border border-slate-700/80 active:scale-95 transition"
                >
                  Copy
                </button>
                <ChevronRight size={16} className="text-slate-500" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => {
          hapticMedium();
          onAddNewItem();
        }}
        aria-label="Add item"
        className="fixed right-5 bottom-20 z-30 w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-600/35 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform duration-150"
      >
        <Plus size={22} strokeWidth={2.6} />
      </button>
    </div>
  );
}
