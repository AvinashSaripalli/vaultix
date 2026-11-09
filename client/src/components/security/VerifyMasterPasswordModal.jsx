import { useState, useEffect } from 'react';
import { Eye, EyeOff, Fingerprint, ScanFace } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
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
import api from '../../services/api';
import ModalPortal, { ModalBackdrop } from '../common/ModalPortal';

function VerifyMasterPasswordModal({
  open,
  onClose,
  onVerified,
  samples = [],
}) {
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.auth);

  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mobile biometrics
  const [biometricInfo, setBiometricInfo] = useState({ available: false, label: 'Biometrics', type: 'none' });
  const [biometricActive, setBiometricActive] = useState(false);

  useEffect(() => {
    if (!open || !user?.id || !isMobileNative()) return;
    (async () => {
      const info = await checkBiometricsAvailable();
      setBiometricInfo(info);
      if (info.available && isBiometricUnlockEnabled(user.id)) {
        setBiometricActive(true);
      }
    })();
  }, [open, user?.id]);

  if (!open) return null;

  const handleClose = () => {
    setMasterPassword('');
    setShowPassword(false);
    setError('');
    onClose();
  };

  const performVerify = async (candidatePassword) => {
    try {
      setLoading(true);
      setError('');

      const verified = await verifyMasterPassword(
        candidatePassword,
        user?.encryptionSalt,
        { samples }
      );

      if (!verified) {
        setError('Invalid master password');
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
          if (kpRes.data.publicKey) {
            dispatch(setSessionRsaPublicKey(kpRes.data.publicKey));
          }
        }
      } catch {
        // key pair may not exist yet
      }

      const verifiedPassword = candidatePassword;

      setMasterPassword('');
      setShowPassword(false);

      handleClose();

      if (onVerified) {
        onVerified(verifiedPassword);
      }
      return true;
    } catch {
      setError('Invalid master password');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await performVerify(masterPassword);
  };

  const handleBiometricVerify = async () => {
    if (!user?.id) return;
    setError('');
    setLoading(true);
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
    <ModalPortal open={open} onClose={handleClose}>
      <ModalBackdrop onClose={handleClose}>
        <div
          className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="mb-5">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Verify Master Password
          </h2>

          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Confirm your master password to continue.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          </div>
        )}

        {biometricActive && (
          <div className="mb-4">
            <button
              type="button"
              onClick={handleBiometricVerify}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-lg border-2 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 py-3 font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              {biometricInfo.type === 'faceId' ? (
                <ScanFace size={20} className="text-indigo-600 dark:text-indigo-400" />
              ) : (
                <Fingerprint size={20} className="text-indigo-600 dark:text-indigo-400" />
              )}
              <span>Verify with {biometricInfo.label}</span>
            </button>
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs uppercase tracking-wider text-slate-400">or enter password</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Master password"
              value={masterPassword}
              onChange={(e) =>
                setMasterPassword(e.target.value)
              }
              className="w-full border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 rounded-lg px-4 pr-11 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              required
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((prev) => !prev)
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {showPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}

export default VerifyMasterPasswordModal;