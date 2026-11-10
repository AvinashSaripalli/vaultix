import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Shield,
  Smartphone,
  Clock,
  Sparkles,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  KeyRound,
  Activity,
  Users,
  ShieldAlert,
} from 'lucide-react';
import { isBiometricUnlockEnabled, isMobileNative } from '../../utils/mobileBiometrics';
import { hapticMedium, hapticLight } from '../../utils/haptics';
import { setTheme } from '../../features/theme/themeSlice';
import { isAdmin } from '../../utils/roles';

export default function MobileSettingsScreen({
  user,
  onLockAndLogout,
  onOpenTwoFactor,
  onOpenSessions,
  onOpenActivityLogs,
  onOpenTeam,
  onOpenApprovals,
}) {
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

  const userIsAdmin = isAdmin(user);

  return (
    <div className="px-5 pt-3 pb-8 space-y-4 select-none">
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Settings</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Security, active sessions, enterprise &amp; theme</p>
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

      {/* Appearance / Theme Switcher */}
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

      {/* Security Hub & Multi-Factor */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
          Security &amp; Privacy Hub
        </span>
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs">
          
          {/* Two-Factor Authentication Link */}
          <div
            onClick={() => {
              hapticLight();
              onOpenTwoFactor?.();
            }}
            className="p-3.5 flex items-center justify-between text-xs cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition"
          >
            <div className="flex items-center gap-2.5">
              <KeyRound size={16} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Two-Factor Authentication (2FA)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">TOTP Authenticator &amp; Backup Codes</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>

          {/* Active Sessions Link */}
          <div
            onClick={() => {
              hapticLight();
              onOpenSessions?.();
            }}
            className="p-3.5 flex items-center justify-between text-xs cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition"
          >
            <div className="flex items-center gap-2.5">
              <Smartphone size={16} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Active Sessions &amp; Devices</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Review and terminate remote devices</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>

          {/* Audit Activity Logs Link */}
          <div
            onClick={() => {
              hapticLight();
              onOpenActivityLogs?.();
            }}
            className="p-3.5 flex items-center justify-between text-xs cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition"
          >
            <div className="flex items-center gap-2.5">
              <Activity size={16} className="text-indigo-600 dark:text-indigo-400" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Audit Activity Log</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Complete immutable vault events</p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400" />
          </div>

          {/* Biometric Toggle */}
          <div className="p-3.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Shield size={16} className="text-indigo-600 dark:text-indigo-400" />
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
        </div>
      </div>

      {/* Enterprise & Admin Console (if Admin) */}
      {userIsAdmin && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            Enterprise Administration
          </span>
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs">
            
            {/* Team Management */}
            <div
              onClick={() => {
                hapticLight();
                onOpenTeam?.();
              }}
              className="p-3.5 flex items-center justify-between text-xs cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition"
            >
              <div className="flex items-center gap-2.5">
                <Users size={16} className="text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Team &amp; User Access</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Manage members, roles &amp; invitations</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </div>

            {/* Admin Approvals */}
            <div
              onClick={() => {
                hapticLight();
                onOpenApprovals?.();
              }}
              className="p-3.5 flex items-center justify-between text-xs cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={16} className="text-indigo-600 dark:text-indigo-400" />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">Admin Approvals Queue</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Multi-party authorization reviews</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </div>
          </div>
        </div>
      )}

      {/* App Details */}
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
            <span className="text-[11px] font-mono text-slate-500 font-semibold">v3.5.0 Native</span>
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
