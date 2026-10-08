import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  setMasterVerified,
  setSessionMasterPassword,
  setSessionRsaPublicKey,
} from '../../features/auth/authSlice';
import { verifyMasterPassword } from '../../utils/verifyMasterPassword';
import { decryptPrivateKey } from '../../utils/crypto';
import api from '../../services/api';
import ModalPortal from '../common/ModalPortal';

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

  if (!open) return null;

  const handleClose = () => {
    setMasterPassword('');
    setShowPassword(false);
    setError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError('');

      const verified = await verifyMasterPassword(
        masterPassword,
        user?.encryptionSalt,
        { samples }
      );

      if (!verified) {
        setError('Invalid master password');
        return;
      }

      dispatch(setMasterVerified(true));
      dispatch(setSessionMasterPassword(masterPassword));

      try {
        const kpRes = await api.get('/keypair');
        if (kpRes.data?.encryptedPrivateKey) {
          const privateKeyJwk = await decryptPrivateKey(
            kpRes.data.encryptedPrivateKey,
            masterPassword,
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

      const verifiedPassword = masterPassword;

      setMasterPassword('');
      setShowPassword(false);

      handleClose();

      if (onVerified) {
        onVerified(verifiedPassword);
      }
    } catch {
      setError('Invalid master password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalPortal open={open} onClose={handleClose}>
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto"
        onClick={handleClose}
      >
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
      </div>
    </ModalPortal>
  );
}

export default VerifyMasterPasswordModal;