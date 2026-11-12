import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Lock, Eye, EyeOff, Fingerprint, ScanFace, X, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  setMasterVerified,
  setSessionMasterPassword,
  setSessionRsaPublicKey,
} from '../../features/auth/authSlice';
import { verifyMasterPassword } from '../../utils/verifyMasterPassword';
import { decryptPrivateKey } from '../../utils/crypto';
import {
  isMobileNative,
  checkBiometricsAvailable,
  unlockWithBiometrics,
  isBiometricUnlockEnabled,
} from '../../utils/mobileBiometrics';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';
import api from '../../services/api';

export default function MobileVerifyMasterPasswordSheet({
  isOpen,
  item = null,
  onClose,
  onVerified,
}) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Biometrics state
  const [biometricInfo, setBiometricInfo] = useState({ available: false, label: 'Biometrics', type: 'none' });
  const [biometricActive, setBiometricActive] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setMasterPassword('');
      setShowPassword(false);
      setError('');
      setLoading(false);
      return;
    }

    if (user?.id && isMobileNative()) {
      (async () => {
        try {
          const info = await checkBiometricsAvailable();
          setBiometricInfo(info);
          if (info.available && isBiometricUnlockEnabled(user.id)) {
            setBiometricActive(true);
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const handleClose = () => {
    setMasterPassword('');
    setShowPassword(false);
    setError('');
    onClose?.();
  };

  const performVerify = async (candidatePassword) => {
    if (!candidatePassword) return false;
    try {
      setLoading(true);
      setError('');
      hapticMedium();

      const verified = await verifyMasterPassword(
        candidatePassword,
        user?.encryptionSalt
      );

      if (!verified) {
        setError('Invalid master password. Please try again.');
        setLoading(false);
        return false;
      }

      dispatch(setMasterVerified(true));
      dispatch(setSessionMasterPassword(candidatePassword));

      try {
        const kpRes = await api.get('/keypair');
        if (kpRes.data?.encryptedPrivateKey) {
          const privateKeyJwk = await decryptPrivateKey(
            kpRes.data.encryptedPrivateKey,
            candidatePassword,
            kpRes.data.salt
          );
          dispatch({ type: 'auth/setSessionRsaPrivateKey', payload: privateKeyJwk });
          if (kpRes.data?.publicKey) {
            dispatch(setSessionRsaPublicKey(kpRes.data.publicKey));
          }
        }
      } catch {
        // key pair might not exist or already set
      }

      hapticSuccess();
      setMasterPassword('');
      setShowPassword(false);
      onVerified?.(candidatePassword);
      return true;
    } catch {
      setError('Verification failed. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!masterPassword) return;
    await performVerify(masterPassword);
  };

  const handleBiometricVerify = async () => {
    if (!user?.id) return;
    setError('');
    setLoading(true);
    hapticLight();
    try {
      const res = await unlockWithBiometrics(user.id);
      if (!res.success) {
        if (res.error && !res.error.toLowerCase().includes('cancel')) {
          setError(res.error);
        }
        setLoading(false);
        return;
      }
      await performVerify(res.masterPassword);
    } catch {
      setError('Biometric authentication failed.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Tap backdrop to dismiss */}
      <div className="flex-1" onClick={handleClose} />

      {/* Bottom Sheet Card */}
      <div className="w-full max-h-[85%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-2xl animate-slideUp text-slate-900 dark:text-white transition-colors duration-200">
        {/* Top Handle */}
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs shrink-0 border border-amber-200/80 dark:border-amber-800/60">
              <Lock size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Master Password Required
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[240px] truncate">
                {item?.name
                  ? `"${item.name}" is a protected item.`
                  : 'Confirm your master password to continue.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close verify sheet"
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Biometrics Quick Action (If Native Mobile Available) */}
        {biometricActive && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleBiometricVerify}
              disabled={loading}
              className="w-full py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition shadow-xs disabled:opacity-50"
            >
              {biometricInfo.type === 'faceId' ? (
                <ScanFace size={18} className="text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Fingerprint size={18} className="text-indigo-600 dark:text-indigo-400" />
              )}
              <span>Verify with {biometricInfo.label}</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                or enter password
              </span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your master password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              autoFocus
              required
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !masterPassword}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5 active:scale-95 transition"
            >
              {loading ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Verify &amp; Unlock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
