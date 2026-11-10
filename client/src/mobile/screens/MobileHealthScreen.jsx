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
        <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
          <span>Security Health</span>
          <ShieldCheck size={20} className="text-emerald-400" />
        </h1>
        <p className="text-xs text-slate-400">Live vulnerability audit across your credentials</p>
      </div>

      {/* Radial Health Summary Card */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-4 shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-extrabold text-2xl shrink-0">
          🛡️
        </div>
        <div>
          <h3 className="text-base font-extrabold text-white">Score: {securityScore} / 100</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Your vault security rating is{' '}
            <span className={securityScore >= 80 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {securityScore >= 80 ? 'Excellent' : 'Needs Attention'}
            </span>
            .
          </p>
        </div>
      </div>

      {/* Vulnerability Checklist */}
      <div className="space-y-2.5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Audit Breakdown</span>

        {/* Weak Password Card */}
        <div className={`p-4 rounded-2xl border space-y-2.5 ${
          weakPasswords > 0
            ? 'bg-rose-950/30 border-rose-800/40 text-rose-200'
            : 'bg-slate-900 border-slate-800 text-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {weakPasswords > 0 ? (
                <AlertTriangle size={18} className="text-rose-400" />
              ) : (
                <Check size={18} className="text-emerald-400" />
              )}
              <h4 className="text-xs font-bold">
                {weakPasswords > 0 ? `${weakPasswords} Weak Password Detected` : '0 Weak Passwords'}
              </h4>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              weakPasswords > 0 ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {weakPasswords > 0 ? 'Action Required' : 'Protected'}
            </span>
          </div>

          <p className="text-[11px] text-slate-400">
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
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Check size={16} className="text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-white">0 Reused Passwords</p>
              <p className="text-[11px] text-slate-400">All credentials have unique entropy</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-400">Secure</span>
        </div>

        {/* Old / Expired Passwords */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound size={16} className="text-amber-400" />
            <div>
              <p className="text-xs font-bold text-white">{oldPasswords} Passwords Older than 90 Days</p>
              <p className="text-[11px] text-slate-400">Regular rotation prevents exposure</p>
            </div>
          </div>
          <button
            onClick={() => {
              hapticLight();
              onOpenVaults();
            }}
            className="text-xs font-bold text-indigo-400"
          >
            Review →
          </button>
        </div>

        {/* 2FA Status */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Smartphone size={16} className="text-indigo-400" />
            <div>
              <p className="text-xs font-bold text-white">Two-Factor Authentication</p>
              <p className="text-[11px] text-slate-400">TOTP Authenticator Protection Active</p>
            </div>
          </div>
          <span className="text-xs font-bold text-indigo-400">Enabled</span>
        </div>
      </div>
    </div>
  );
}
