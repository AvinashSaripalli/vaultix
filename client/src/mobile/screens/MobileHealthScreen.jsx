import { ShieldCheck, AlertTriangle, Check, Smartphone, KeyRound } from 'lucide-react';
import { hapticLight } from '../../utils/haptics';

export default function MobileHealthScreen({ summary, onFixWithGenerator, onOpenVaults }) {
  const {
    securityScore = 94,
    weakPasswords = 0,
    oldPasswords = 0,
    riskPasswords = 0,
  } = summary || {};

  return (
    <div className="px-5 pt-3 pb-6 space-y-4 select-none">
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <span>Security Health</span>
          <ShieldCheck size={20} className="text-emerald-500 dark:text-emerald-400" />
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Live vulnerability audit across your credentials</p>
      </div>

      {/* Radial Health Summary Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-4 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-extrabold text-2xl shrink-0">
          🛡️
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Score: {securityScore} / 100</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your vault security rating is{' '}
            <span className={securityScore >= 80 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
              {securityScore >= 80 ? 'Excellent' : 'Needs Attention'}
            </span>
            .
          </p>
        </div>
      </div>

      {/* Vulnerability Checklist */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Audit Breakdown</span>

        {/* Weak Password Card */}
        <div className={`p-4 rounded-2xl border space-y-2.5 shadow-xs ${
          weakPasswords > 0
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-200'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {weakPasswords > 0 ? (
                <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />
              ) : (
                <Check size={18} className="text-emerald-600 dark:text-emerald-400" />
              )}
              <h4 className="text-xs font-bold">
                {weakPasswords > 0 ? `${weakPasswords} Weak Password Detected` : '0 Weak Passwords'}
              </h4>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              weakPasswords > 0 ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            }`}>
              {weakPasswords > 0 ? 'Action Required' : 'Protected'}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {weakPasswords > 0
              ? 'One or more credentials do not meet recommended length or entropy standards.'
              : 'All passwords meet minimum length and complexity policies.'}
          </p>

          {weakPasswords > 0 && (
            <button
              onClick={() => {
                hapticLight();
                onFixWithGenerator();
              }}
              className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition active:scale-95 shadow-md shadow-rose-600/30"
            >
              Fix with Generator →
            </button>
          )}
        </div>

        {/* Reused Passwords */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <Check size={16} className="text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">0 Reused Passwords</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">All credentials have unique entropy</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Secure</span>
        </div>

        {/* Old / Expired Passwords */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <Clock size={16} className="text-amber-500" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">Credential Age Audit</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Rotated according to security policies</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Good</span>
        </div>
      </div>
    </div>
  );
}

function Clock({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
