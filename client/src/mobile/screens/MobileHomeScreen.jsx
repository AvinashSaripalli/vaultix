import { LockKeyhole, KeyRound, AlertTriangle, Check, Users, Sparkles, ShieldCheck, RefreshCw, ChevronRight } from 'lucide-react';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import { hapticLight } from '../../utils/haptics';

export default function MobileHomeScreen({
  user,
  summary,
  passwords = [],
  onOpenItem,
  onNavigateTab,
  onLockVault,
  onAddNewItem,
  onRefresh,
}) {
  const {
    totalPasswords = passwords.length,
    weakPasswords = 0,
    oldPasswords = 0,
    riskPasswords = 0,
    securityScore = 94,
  } = summary || {};

  const recentItems = passwords.slice(0, 4);

  return (
    <div className="px-5 pt-3 pb-6 space-y-4 select-none">
      {/* Top Header: Greeting & Quick Lock */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-black text-xs flex items-center justify-center shadow-md">
            {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">
              Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.fullName?.split(' ')[0] || 'there'}
            </h2>
            <p className="text-[11px] text-slate-400">Vaultix Mobile Workspace</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            hapticLight();
            onLockVault();
          }}
          className="h-8 px-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:text-red-400 hover:border-red-800/60 transition flex items-center gap-1 active:scale-95"
          title="Lock Vault"
        >
          <LockKeyhole size={14} />
          <span>Lock</span>
        </button>
      </div>

      {/* Security Health Radial Gauge Card */}
      <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 flex items-center justify-between shadow-lg shadow-indigo-950/30">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Security Health</span>
          <h3 className="text-xl font-extrabold text-white">{securityScore}% Secure</h3>
          <p className="text-xs text-slate-400">
            {weakPasswords > 0 ? `${weakPasswords} weak password to review` : 'All credentials protected'}
          </p>
        </div>

        {/* Circular SVG Ring */}
        <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
          <svg className="w-16 h-16 transform -rotate-90">
            <circle cx="32" cy="32" r="26" stroke="rgba(99, 102, 241, 0.15)" strokeWidth="6" fill="transparent" />
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke="#6366f1"
              strokeWidth="6"
              strokeDasharray="163"
              strokeDashoffset={163 - (163 * securityScore) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>
          <span className="absolute text-xs font-extrabold text-indigo-400">{securityScore}</span>
        </div>
      </div>

      {/* 2x2 High-Density Matrix */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Vault Overview</span>
          <button onClick={() => onNavigateTab('vaults')} className="text-xs text-indigo-400 font-semibold">
            All Items →
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Card 1: Total */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Total Items</span>
              <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-xs">
                <KeyRound size={13} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-white">{totalPasswords}</p>
            <p className="text-[11px] text-emerald-400 font-semibold">Encrypted zero-knowledge</p>
          </div>

          {/* Card 2: Weak */}
          <div
            onClick={() => onNavigateTab('health')}
            className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1 cursor-pointer active:scale-98 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Weak</span>
              <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center text-xs">
                <AlertTriangle size={13} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-rose-400">{weakPasswords}</p>
            <p className="text-[11px] text-rose-400 font-semibold">
              {weakPasswords > 0 ? 'Needs attention' : 'None detected'}
            </p>
          </div>

          {/* Card 3: Reused */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Reused</span>
              <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs">
                <Check size={13} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-emerald-400">0</p>
            <p className="text-[11px] text-slate-400">All unique entropy</p>
          </div>

          {/* Card 4: Shared */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Old / At Risk</span>
              <span className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs">
                <Users size={13} />
              </span>
            </div>
            <p className="text-2xl font-extrabold text-white">{oldPasswords + riskPasswords}</p>
            <p className="text-[11px] text-slate-400">Vault credentials</p>
          </div>
        </div>
      </div>

      {/* Quick Action Dock */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Quick Actions</span>
        <div className="grid grid-cols-4 gap-2 text-center">
          <button
            onClick={onAddNewItem}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500 transition active:scale-95"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-1">
              ➕
            </div>
            <span className="text-[11px] font-bold block text-slate-200 truncate">New Item</span>
          </button>

          <button
            onClick={() => onNavigateTab('generator')}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500 transition active:scale-95"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center mb-1">
              <Sparkles size={16} />
            </div>
            <span className="text-[11px] font-bold block text-slate-200 truncate">Generate</span>
          </button>

          <button
            onClick={() => onNavigateTab('health')}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500 transition active:scale-95"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1">
              <ShieldCheck size={16} />
            </div>
            <span className="text-[11px] font-bold block text-slate-200 truncate">Audit</span>
          </button>

          <button
            onClick={() => {
              hapticLight();
              onRefresh();
            }}
            className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500 transition active:scale-95"
          >
            <div className="w-8 h-8 mx-auto rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-1">
              <RefreshCw size={15} />
            </div>
            <span className="text-[11px] font-bold block text-slate-200 truncate">Sync</span>
          </button>
        </div>
      </div>

      {/* Pinned / Recent Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Passwords</span>
          <button onClick={() => onNavigateTab('vaults')} className="text-xs text-indigo-400 font-semibold">
            View All ({passwords.length}) →
          </button>
        </div>

        {recentItems.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 text-center text-slate-400 text-xs">
            No items in this vault yet. Tap ➕ New Item to add credentials.
          </div>
        ) : (
          <div className="space-y-2">
            {recentItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  hapticLight();
                  onOpenItem(item);
                }}
                className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between cursor-pointer active:scale-98 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ItemServiceIcon name={item.name} type={item.type} size="md" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                    <p className="text-[11px] text-slate-400 font-mono truncate max-w-[190px]">
                      {item.login || 'No username'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-500 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
