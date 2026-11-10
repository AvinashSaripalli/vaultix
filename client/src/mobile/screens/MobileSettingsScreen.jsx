import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Shield, Smartphone, Clock, Sparkles, Moon, Sun, LogOut, CheckCircle2 } from 'lucide-react';
import { isBiometricUnlockEnabled, isMobileNative } from '../../utils/mobileBiometrics';
import { hapticMedium, hapticLight } from '../../utils/haptics';
import { setTheme, toggleTheme } from '../../features/theme/themeSlice';

export default function MobileSettingsScreen({ user, onLockAndLogout }) {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.theme);
  const isDark = mode === 'dark';

  const [bioEnabled, setBioEnabled] = useState(() => {
    return user?.id ? isBiometricUnlockEnabled(user.id) : true;
  });

  const handleToggleBio = () => {
    hapticMedium();
    setBioEnabled(!bioEnabled);
  };

  const handleSetTheme = (newMode) => {
    hapticLight();
    dispatch(setTheme(newMode));
  };

  return (
    <div className="px-5 pt-3 pb-8 space-y-4 select-none">
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Device security, theme &amp; vault preferences</p>
      </div>

      {/* Profile Inset Card */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-black flex items-center justify-center text-lg shadow-md shrink-0">
          {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.fullName || 'Vaultix User'}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email || ''}</p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
            {user?.role || 'MEMBER'}
          </span>
        </div>
      </div>

      {/* Inset Group: Appearance / Theme Switcher */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          Appearance &amp; Theme
        </span>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              {isDark ? <Moon size={16} className="text-indigo-400" /> : <Sun size={16} className="text-amber-500" />}
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Color Mode</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Choose between Light or OLED Dark</p>
              </div>
            </div>
          </div>

          {/* Theme Mode Segmented Pill */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
            <button
              type="button"
              onClick={() => handleSetTheme('light')}
              className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                !isDark
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sun size={14} className={!isDark ? 'text-amber-500' : ''} />
              <span>Light Theme</span>
            </button>

            <button
              type="button"
              onClick={() => handleSetTheme('dark')}
              className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                isDark
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon size={14} className={isDark ? 'text-indigo-200' : ''} />
              <span>Dark Theme</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inset Group: Security */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          Security &amp; Biometrics
        </span>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs">
          {/* Biometric Toggle */}
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Smartphone size={16} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Biometric Unlock</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Face ID / Touch ID / Fingerprint</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={bioEnabled}
              onChange={handleToggleBio}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {/* Auto-Lock Timer */}
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Clock size={16} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Auto-Lock Timer</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Locks vault when backgrounded</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">5 minutes</span>
          </div>

          {/* Clear Clipboard */}
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Clear Clipboard</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Purges copied passwords from memory</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">30 seconds</span>
          </div>
        </div>
      </div>

      {/* Inset Group: App Details */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          App System
        </span>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs">
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Sparkles size={16} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Runtime Platform</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isMobileNative() ? 'Capacitor Native (Android/iOS)' : 'Mobile Adaptive Webview'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-semibold">v3.4.8 Native</span>
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
          className="w-full py-3.5 rounded-2xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-950/50 transition active:scale-95 flex items-center justify-center gap-2 shadow-xs"
        >
          <LogOut size={15} />
          <span>Lock Vault &amp; Sign Out</span>
        </button>
      </div>
    </div>
  );
}
