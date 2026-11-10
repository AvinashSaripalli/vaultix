import { useState, useEffect } from 'react';
import { Eye, EyeOff, LockKeyhole, ScanFace, Fingerprint, LogOut } from 'lucide-react';
import {
  checkBiometricsAvailable,
  unlockWithBiometrics,
  isBiometricUnlockEnabled,
} from '../../utils/mobileBiometrics';
import { hapticMedium, hapticSuccess } from '../../utils/haptics';

export default function MobileAuthScreen({ user, onUnlock, onLogout, error: parentError }) {
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(parentError || '');
  const [bioInfo, setBioInfo] = useState({ available: false, label: 'Biometrics', type: 'none' });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const info = await checkBiometricsAvailable();
      if (!mounted) return;
      setBioInfo(info);

      // Auto-prompt on launch if biometrics is enrolled
      if (info.available && user?.id && isBiometricUnlockEnabled(user.id)) {
        setTimeout(() => {
          if (mounted) handleBiometricAuth();
        }, 350);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const handleBiometricAuth = async () => {
    if (!user?.id) return;
    setError('');
    setVerifying(true);
    hapticMedium();
    try {
      const res = await unlockWithBiometrics(user.id);
      if (!res.success) {
        if (res.error && !res.error.toLowerCase().includes('cancel')) {
          setError(res.error);
        }
        setVerifying(false);
        return;
      }
      hapticSuccess();
      await onUnlock(res.masterPassword);
    } catch {
      setError('Biometric authentication failed. Enter your master password.');
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!masterPassword) return;
    setError('');
    setVerifying(true);
    hapticMedium();
    const ok = await onUnlock(masterPassword);
    if (ok) {
      hapticSuccess();
    } else {
      setError('Invalid master password. Please try again.');
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between px-6 pt-16 pb-8 select-none">
      {/* Top Hero Splash */}
      <div className="text-center space-y-3">
        <div className="w-18 h-18 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30">
          <LockKeyhole size={36} strokeWidth={2.4} />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Vaultix</h1>
          <p className="text-xs text-slate-400 mt-0.5">Zero-Knowledge Encrypted Vault</p>
        </div>
      </div>

      {/* Center Biometrics Card or Master Password Prompt */}
      <div className="my-auto space-y-4">
        {bioInfo.available && isBiometricUnlockEnabled(user?.id) && (
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4 shadow-xl">
            <button
              type="button"
              onClick={handleBiometricAuth}
              disabled={verifying}
              className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center hover:bg-indigo-500/20 active:scale-95 transition"
            >
              {bioInfo.type === 'faceId' ? (
                <ScanFace size={36} />
              ) : (
                <Fingerprint size={36} />
              )}
            </button>
            <div>
              <h3 className="text-sm font-bold text-white">Unlock with {bioInfo.label}</h3>
              <p className="text-xs text-slate-400 mt-1">Tap icon or sensor to access vault</p>
            </div>
            <button
              type="button"
              onClick={handleBiometricAuth}
              disabled={verifying}
              className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 active:scale-95 transition"
            >
              Authorize {bioInfo.label}
            </button>
          </div>
        )}

        {/* Master Password Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-semibold text-center">
              {error}
            </div>
          )}

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter Master Password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={verifying || !masterPassword}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 active:scale-95 transition"
          >
            {verifying ? 'Unlocking Vault...' : 'Unlock with Master Password'}
          </button>
        </form>
      </div>

      {/* Bottom Switch Account */}
      <div className="pt-4 text-center">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition"
        >
          <LogOut size={13} />
          <span>Switch Account / Sign Out</span>
        </button>
      </div>
    </div>
  );
}
