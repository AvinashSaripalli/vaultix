import { useState } from 'react';
import { Shield, Smartphone, Clock, Sparkles, Moon, LogOut, CheckCircle2 } from 'lucide-react';
import { isBiometricUnlockEnabled, isMobileNative } from '../../utils/mobileBiometrics';
import { hapticMedium, hapticLight } from '../../utils/haptics';

export default function MobileSettingsScreen({ user, onLockAndLogout }) {
  const [bioEnabled, setBioEnabled] = useState(() => {
    return user?.id ? isBiometricUnlockEnabled(user.id) : true;
  });

  const handleToggleBio = () => {
    hapticMedium();
    setBioEnabled(!bioEnabled);
  };

  return (
    <div className="px-5 pt-3 pb-8 space-y-4 select-none">
      <div>
        <h1 className="text-xl font-black tracking-tight text-white">Settings</h1>
        <p className="text-xs text-slate-400">Device security and vault preferences</p>
      </div>

      {/* Profile Inset Card */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center gap-3.5 shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-black flex items-center justify-center text-lg shadow-md shrink-0">
          {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white truncate">{user?.fullName || 'Vaultix User'}</h3>
          <p className="text-[11px] text-slate-400 truncate">{user?.email || ''}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            {user?.role || 'MEMBER'}
          </span>
        </div>
      </div>

      {/* Inset Group: Security */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
          Security & Biometrics
        </span>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden shadow-xs">
          {/* Biometric Toggle */}
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Smartphone size={16} className="text-indigo-400" />
              <div>
                <p className="font-bold text-white">Biometric Unlock</p>
                <p className="text-[11px] text-slate-400">Face ID / Touch ID / Fingerprint</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={bioEnabled}
              onChange={handleToggleBio}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </div>

          {/* Auto-Lock Timer */}
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Clock size={16} className="text-indigo-400" />
              <div>
                <p className="font-bold text-white">Auto-Lock Timer</p>
                <p className="text-[11px] text-slate-400">Locks vault when backgrounded</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-indigo-400">5 minutes</span>
          </div>

          {/* Clear Clipboard */}
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-indigo-400" />
              <div>
                <p className="font-bold text-white">Clear Clipboard</p>
                <p className="text-[11px] text-slate-400">Purges copied passwords from memory</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-indigo-400">30 seconds</span>
          </div>
        </div>
      </div>

      {/* Inset Group: App Details */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
          App System
        </span>
        <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden shadow-xs">
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Moon size={16} className="text-indigo-400" />
              <div>
                <p className="font-bold text-white">Appearance</p>
                <p className="text-[11px] text-slate-400">OLED Luxury Dark Theme</p>
              </div>
            </div>
            <span className="text-xs font-bold text-indigo-400">Active</span>
          </div>

          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-indigo-400" />
              <div>
                <p className="font-bold text-white">Runtime Platform</p>
                <p className="text-[11px] text-slate-400">
                  {isMobileNative() ? 'Capacitor Native (Android/iOS)' : 'Mobile Adaptive Webview'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-semibold">v3.4.7 Native</span>
          </div>
        </div>
      </div>

      {/* Sign Out Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            hapticMedium();
            onLockAndLogout();
          }}
          className="w-full py-3.5 rounded-2xl border border-rose-800/60 bg-rose-950/30 text-rose-400 text-xs font-bold hover:bg-rose-950/50 transition active:scale-95 flex items-center justify-center gap-2 shadow-sm"
        >
          <LogOut size={15} />
          <span>Lock Vault & Sign Out</span>
        </button>
      </div>
    </div>
  );
}
