import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ScanFace,
  Fingerprint,
  Mail,
  User,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  X,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
  Sun,
  Moon,
} from 'lucide-react';
import {
  checkBiometricsAvailable,
  unlockWithBiometrics,
  isBiometricUnlockEnabled,
} from '../../utils/mobileBiometrics';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';
import { toggleTheme } from '../../features/theme/themeSlice';
import api from '../../services/api';
import vaultixLogo from '../../assets/Vaultix1.png';

export default function MobileAuthScreen({
  user,
  isAuthenticated = false,
  onLogin,
  onRegister,
  onUnlockMaster,
  onLogout,
  onResetMasterPassword,
}) {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.theme);
  const isDark = mode === 'dark';

  // If user is already authenticated with email/password, default to 'master' unlock mode.
  // Otherwise, default to 'signin'.
  const [authMode, setAuthMode] = useState(isAuthenticated ? 'master' : 'signin'); // 'signin' | 'register' | 'master'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sign In / Register form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMethod, setTwoFactorMethod] = useState('authenticator');

  // Master Password state
  const [masterPassword, setMasterPassword] = useState('');
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  // Biometrics state
  const [bioInfo, setBioInfo] = useState({ available: false, label: 'Biometrics', type: 'none' });

  // Sheets state
  const [showForgotPasswordSheet, setShowForgotPasswordSheet] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const [showRecoverySheet, setShowRecoverySheet] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState(user?.email || '');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmNewMaster, setConfirmNewMaster] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // Keep mode in sync with isAuthenticated
  useEffect(() => {
    if (isAuthenticated) {
      setAuthMode('master');
      if (user?.email) {
        setRecoveryEmail(user.email);
      }
    } else {
      if (authMode === 'master') {
        setAuthMode('signin');
      }
    }
  }, [isAuthenticated, user?.email]);

  // Biometric capability check & auto-prompt for master password
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await checkBiometricsAvailable();
        if (!mounted) return;
        setBioInfo(info);

        if (isAuthenticated && info.available && user?.id && isBiometricUnlockEnabled(user.id)) {
          setTimeout(() => {
            if (mounted) handleBiometricAuth();
          }, 350);
        }
      } catch {
        // Biometrics unavailable or not supported
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated, user?.id]);

  const handleBiometricAuth = async () => {
    if (!user?.id) return;
    setError('');
    setLoading(true);
    hapticMedium();
    try {
      const res = await unlockWithBiometrics(user.id);
      if (!res.success) {
        if (res.error && !res.error.toLowerCase().includes('cancel')) {
          setError(res.error);
        }
        setLoading(false);
        return;
      }
      hapticSuccess();
      const ok = await onUnlockMaster(res.masterPassword);
      if (!ok) {
        setError('Stored biometric key is out of sync. Please enter master password.');
      }
    } catch {
      setError('Biometric authentication failed. Enter your master password.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Account Login submit
  const handleSignInSubmit = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !accountPassword) return;
    setError('');
    setLoading(true);
    hapticMedium();

    try {
      const res = await onLogin({
        email: email.trim(),
        password: accountPassword,
        twoFactorCode: requires2FA ? twoFactorCode.trim() : undefined,
      });

      if (res?.require2FA) {
        setRequires2FA(true);
        setTwoFactorMethod(res.twoFactorMethod || 'authenticator');
        setLoading(false);
        return;
      }

      if (res?.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      hapticSuccess();
      // On successful login, the component moves to master password mode
    } catch (err) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Account Registration submit
  const handleRegisterSubmit = async (e) => {
    e?.preventDefault();
    if (!fullName.trim() || !email.trim() || !accountPassword) return;
    if (accountPassword.length < 8) {
      setError('Account password must be at least 8 characters long.');
      return;
    }
    if (accountPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    hapticMedium();

    try {
      const res = await onRegister({
        fullName: fullName.trim(),
        email: email.trim(),
        password: accountPassword,
      });

      if (res?.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      hapticSuccess();
      setSuccessMsg('Account created! Please check your email to verify.');
    } catch (err) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Master Password Unlock submit
  const handleMasterUnlockSubmit = async (e) => {
    e?.preventDefault();
    if (!masterPassword) return;
    setError('');
    setLoading(true);
    hapticMedium();

    try {
      const ok = await onUnlockMaster(masterPassword);
      if (ok) {
        hapticSuccess();
      } else {
        setError('Invalid master password. Please verify and try again.');
      }
    } catch {
      setError('Failed to unlock vault. Please check your master password.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Forgot Account Password request
  const handleForgotPasswordSubmit = async (e) => {
    e?.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);
    hapticMedium();

    try {
      await api.post('/auth/forgot-password', { email: forgotEmail.trim() });
      setForgotSuccess('Password reset link sent! Check your inbox.');
      hapticSuccess();
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Could not send reset link. Try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Handle Emergency Recovery Key Reset
  const handleRecoverySubmit = async (e) => {
    e?.preventDefault();
    if (!recoveryEmail.trim() || !recoveryKey.trim() || !newMasterPassword) return;
    if (newMasterPassword.length < 8) {
      setRecoveryError('New master password must be at least 8 characters.');
      return;
    }
    if (newMasterPassword !== confirmNewMaster) {
      setRecoveryError('New passwords do not match.');
      return;
    }

    setRecoveryError('');
    setRecoverySuccess('');
    setRecoveryLoading(true);
    hapticMedium();

    try {
      await api.post('/auth/reset-master-password', {
        email: recoveryEmail.trim(),
        recoveryKey: recoveryKey.trim(),
        newMasterPassword,
      });

      setRecoverySuccess('Master password reset successfully! Unlocking...');
      hapticSuccess();

      // Automatically unlock with the new master password
      setTimeout(async () => {
        setShowRecoverySheet(false);
        await onUnlockMaster(newMasterPassword);
      }, 1200);
    } catch (err) {
      setRecoveryError(err.response?.data?.message || 'Invalid recovery key or email.');
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between px-6 pt-16 pb-6 select-none relative overflow-x-hidden overflow-y-auto transition-colors duration-200">
      
      {/* Background Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Floating Theme Switcher Button (Top Right) */}
      <button
        type="button"
        onClick={() => {
          hapticLight();
          dispatch(toggleTheme());
        }}
        aria-label="Toggle dark/light theme"
        className="absolute top-9 right-6 z-30 w-9 h-9 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shadow-md active:scale-95 transition"
        title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      >
        {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-indigo-600" />}
      </button>

      {/* Main Content Column */}
      <div className="w-full max-w-sm mx-auto z-10 flex flex-col">
        {/* Top Brand Hero (Moved a little bit below) */}
        <div className="text-center space-y-3 pt-3">
          {/* High-Contrast White Squircle Badge: Makes dark navy shield 100% visible in both light & dark themes */}
          <div className="w-20 h-20 mx-auto rounded-3xl bg-white p-3 flex items-center justify-center shadow-2xl shadow-indigo-500/25 border border-slate-200/80 dark:border-white/10 active:scale-95 transition-transform duration-200">
            <img
              src={vaultixLogo}
              alt="Vaultix Logo"
              className="w-full h-full object-contain select-none drop-shadow-xs"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
              <span>Vaultix</span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                Mobile
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zero-Knowledge Encrypted Security</p>
          </div>
        </div>

        {/* Main Content Area (Gap reduced a little bit between logo content and fields) */}
        <div className="w-full mt-14 space-y-5">
        
        {/* Error Banner */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 shadow-lg shadow-rose-500/5 dark:shadow-rose-950/30 animate-fadeIn">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
            <span className="flex-1 font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/80 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2.5 shadow-lg shadow-emerald-500/5 dark:shadow-emerald-950/30 animate-fadeIn">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-500 dark:text-emerald-400" />
            <span className="flex-1 font-medium leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: MASTER PASSWORD UNLOCK (When account is authenticated) */}
        {/* ========================================================= */}
        {authMode === 'master' && (
          <div className="space-y-4">
            
            {/* User Avatar Card */}
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between shadow-lg shadow-slate-200/50 dark:shadow-none">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-black text-sm flex items-center justify-center shadow-md">
                  {user?.fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {user?.fullName || 'Locked Vault'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[190px]">
                    {user?.email || 'Encrypted Session'}
                  </p>
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    onLogout();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold border border-slate-200 dark:border-slate-700/80 active:scale-95 transition"
                >
                  Switch
                </button>
              )}
            </div>

            {/* Quick Biometrics Button if Enrolled */}
            {bioInfo.available && user?.id && isBiometricUnlockEnabled(user.id) && (
              <button
                type="button"
                onClick={handleBiometricAuth}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-indigo-50 dark:bg-indigo-600/15 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-600/25 active:scale-98 transition shadow-lg shadow-indigo-500/5 dark:shadow-indigo-950/40"
              >
                {bioInfo.type === 'faceId' ? <ScanFace size={20} /> : <Fingerprint size={20} />}
                <span>Unlock with {bioInfo.label || 'Biometrics'}</span>
              </button>
            )}

            {/* Master Password Input Form */}
            <form onSubmit={handleMasterUnlockSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                  Master Password
                </label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showMasterPassword ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Enter your master password"
                    autoFocus
                    required
                    className="w-full pl-10 pr-11 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {showMasterPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !masterPassword}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:opacity-95 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>Unlock Encrypted Vault</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Helper: Emergency Recovery Key Link */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setRecoveryError('');
                  setRecoverySuccess('');
                  setShowRecoverySheet(true);
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold underline underline-offset-4 active:opacity-75 transition"
              >
                Forgot Master Password? Use Recovery Key
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: ACCOUNT SIGN IN & REGISTRATION (When not authenticated) */}
        {/* ========================================================= */}
        {authMode !== 'master' && (
          <div className="space-y-4">
            
            {/* Mode Switcher Pills */}
            <div className="flex bg-slate-200/80 dark:bg-slate-900 p-1 rounded-2xl border border-slate-300 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setAuthMode('signin');
                  setError('');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  authMode === 'signin'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  setAuthMode('register');
                  setError('');
                }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                  authMode === 'register'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* 2FA Challenge Step */}
            {requires2FA ? (
              <form onSubmit={handleSignInSubmit} className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-500/30 text-center space-y-1">
                  <ShieldCheck size={28} className="mx-auto text-indigo-600 dark:text-indigo-400 mb-1" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Two-Factor Authentication</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Enter the 6-digit verification code from your authenticator app
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Security Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="000 000"
                    autoFocus
                    required
                    className="w-full text-center tracking-[8px] font-mono font-extrabold text-xl py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition shadow-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || twoFactorCode.length < 6}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <RefreshCw size={18} className="animate-spin" /> : <span>Verify &amp; Continue</span>}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode('');
                  }}
                  className="w-full text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium text-center"
                >
                  Cancel and return to Sign In
                </button>
              </form>
            ) : authMode === 'signin' ? (
              
              /* SIGN IN FORM */
              <form onSubmit={handleSignInSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                      keyboardType="email-address"
                      required
                      className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Account Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        hapticLight();
                        setForgotEmail(email);
                        setForgotError('');
                        setForgotSuccess('');
                        setShowForgotPasswordSheet(true);
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-500 transition"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      className="w-full pl-10 pr-11 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email || !accountPassword}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:opacity-95 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
                >
                  {loading ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Vaultix</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              
              /* REGISTRATION FORM */
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                      className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      autoCapitalize="none"
                      required
                      className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition shadow-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Create Password
                  </label>
                  <div className="relative">
                    <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      required
                      className="w-full pl-10 pr-11 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <LockKeyhole size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      required
                      className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition shadow-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !fullName || !email || !accountPassword || !confirmPassword}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 hover:opacity-95 active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-1"
                >
                  {loading ? (
                    <RefreshCw size={18} className="animate-spin" />
                  ) : (
                    <>
                      <span>Create Account &amp; Vault</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Bottom Security Guarantee */}
      <div className="text-center z-10 pt-4 pb-2 border-t border-slate-200 dark:border-slate-900 mt-8">
        <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-medium">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>AES-256-GCM Zero-Knowledge Encryption</span>
        </p>
      </div>

      {/* ========================================================= */}
      {/* SHEET 1: FORGOT ACCOUNT PASSWORD */}
      {/* ========================================================= */}
      {showForgotPasswordSheet && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
          <div className="flex-1" onClick={() => setShowForgotPasswordSheet(false)} />
          <div className="w-full rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-slideUp shadow-2xl">
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-2 mb-2" />
            
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Reset Account Password</h3>
              <button
                type="button"
                onClick={() => setShowForgotPasswordSheet(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Enter your account email. We will send you a single-use secure reset link.
            </p>

            {forgotError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {forgotError}
              </div>
            )}

            {forgotSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 dark:text-emerald-400" />
                <p className="text-xs font-bold text-slate-900 dark:text-white">{forgotSuccess}</p>
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordSheet(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-3">
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoFocus
                    required
                    className="w-full pl-10 pr-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || !forgotEmail}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-98 transition disabled:opacity-50"
                >
                  {forgotLoading ? <RefreshCw size={16} className="animate-spin" /> : <span>Send Reset Link &rarr;</span>}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SHEET 2: EMERGENCY MASTER PASSWORD RECOVERY */}
      {/* ========================================================= */}
      {showRecoverySheet && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
          <div className="flex-1" onClick={() => setShowRecoverySheet(false)} />
          <div className="w-full max-h-[90%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 space-y-4 overflow-y-auto animate-slideUp shadow-2xl">
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-2 mb-2" />
            
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm border border-slate-200 dark:border-white/10">
                  <img src={vaultixLogo} alt="Vaultix" className="w-full h-full object-contain" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Emergency Key Recovery</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRecoverySheet(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Use your confidential 24-character master recovery key to set a new master password and restore vault access.
            </p>

            {recoveryError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {recoveryError}
              </div>
            )}

            {recoverySuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <CheckCircle2 size={24} className="mx-auto text-emerald-500 dark:text-emerald-400" />
                <p className="text-xs font-bold text-slate-900 dark:text-white">{recoverySuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Account Email
                  </label>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Emergency Recovery Key
                  </label>
                  <input
                    type="text"
                    value={recoveryKey}
                    onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
                    placeholder="EL3B-WSTP-K329-..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-emerald-600 dark:text-emerald-400 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    New Master Password
                  </label>
                  <input
                    type="password"
                    value={newMasterPassword}
                    onChange={(e) => setNewMasterPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Confirm New Master Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewMaster}
                    onChange={(e) => setConfirmNewMaster(e.target.value)}
                    placeholder="Repeat new master password"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={recoveryLoading || !recoveryKey || !newMasterPassword || !confirmNewMaster}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition disabled:opacity-50 mt-2"
                >
                  {recoveryLoading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <span>Reset Master Password &amp; Restore Vault &rarr;</span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
