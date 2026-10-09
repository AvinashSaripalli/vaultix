import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  TimerReset,
  AlertTriangle,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import { logoutUser, setMasterVerified, setSessionMasterPassword, setSessionRsaPublicKey } from '../../features/auth/authSlice';
import {
  isEncryptedFormat,
  MASTER_VERIFIER_STORAGE_KEY,
  decryptPrivateKey,
  generateKeyPair,
  encryptPrivateKey,
  createMasterPasswordVerifier,
  deriveAuthKey,
} from '../../utils/crypto';
import { setRsaPrivateKey as storeRsaPrivateKey, persistEncryptedSession } from '../../utils/secureSession';
import { validateMasterPassword, validateConfirmPassword, validateHint } from '../../utils/validation';
import { verifyMasterPassword } from '../../utils/verifyMasterPassword';
import logo from '../../assets/Vaultix.png';
import bgImage from '../../assets/auth-bg.png';

function EnterMasterPasswordPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { token, isAuthenticated, user, loading } = useSelector(
    (state) => state.auth
  );

  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [resetMode, setResetMode] = useState(false);
  const [accountPassword, setAccountPassword] = useState('');
  const [resetData, setResetData] = useState({
    newMasterPassword: '',
    confirmMasterPassword: '',
    hint: '',
  });
  const [confirmReset, setConfirmReset] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetErrors, setResetErrors] = useState({});
  const [resetting, setResetting] = useState(false);

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setVerifying(true);
      setError('');

      let samples = [];

      if (!sessionStorage.getItem(MASTER_VERIFIER_STORAGE_KEY)) {
        try {
          const ownedRes = await api.get('/passwords/owned');
          const owned = ownedRes.data || [];

          samples = owned
            .filter((pw) => isEncryptedFormat(pw.encryptedPassword))
            .map((pw) => pw.encryptedPassword);
        } catch {
          samples = [];
        }
      }

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
        let privKey = null;
        let pubKey = null;
        if (kpRes.data?.encryptedPrivateKey) {
          privKey = await decryptPrivateKey(
            kpRes.data.encryptedPrivateKey,
            masterPassword,
            kpRes.data.salt
          );
          dispatch({ type: 'auth/setSessionRsaPrivateKey', payload: privKey });
          if (kpRes.data.publicKey) {
            pubKey = kpRes.data.publicKey;
            dispatch(setSessionRsaPublicKey(pubKey));
          }
        }
        await persistEncryptedSession(masterPassword, privKey, pubKey);
      } catch (err) {
        // Keys are mandatory for encrypting/decrypting vault items —
        // surface the failure instead of continuing with a broken session.
        console.error('Failed to load encryption keys:', err);
        setError(
          'Vault unlocked, but encryption keys could not be loaded. Please try again.'
        );
        dispatch(setMasterVerified(false));
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid master password');
    } finally {
      setVerifying(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();

    const masterError = validateMasterPassword(resetData.newMasterPassword);
    const confirmError = validateConfirmPassword(
      resetData.newMasterPassword,
      resetData.confirmMasterPassword
    );
    const hintError = validateHint(resetData.hint);

    if (!accountPassword) {
      setResetErrors({ accountPassword: 'Account password is required to reset the master password' });
      return;
    }

    if (masterError || confirmError || hintError) {
      setResetErrors({
        newMasterPassword: masterError,
        confirmMasterPassword: confirmError,
        hint: hintError,
      });
      return;
    }

    if (!confirmReset) {
      setResetErrors({ acknowledged: 'Please acknowledge the data-loss warning first.' });
      return;
    }

    setResetErrors({});
    setResetting(true);

    try {
      const salt = user?.encryptionSalt;

      const { publicKeyJwk, privateKeyJwk } = await generateKeyPair();
      const encryptedPrivateKey = await encryptPrivateKey(
        privateKeyJwk,
        resetData.newMasterPassword,
        salt
      );
      const newAuthKey = await deriveAuthKey(resetData.newMasterPassword, salt);
      await api.post(
        '/auth/reset-master-password',
        {
          newAuthKey,
          newMasterPassword: resetData.newMasterPassword,
          hint: resetData.hint,
          encryptedPrivateKey,
          publicKey: publicKeyJwk,
          salt,
          accountPassword,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      storeRsaPrivateKey(privateKeyJwk);
      sessionStorage.removeItem('masterPasswordVerifier');
      dispatch(setSessionMasterPassword(resetData.newMasterPassword));
      dispatch(setSessionRsaPublicKey(publicKeyJwk));
      dispatch(setMasterVerified(true));
      await persistEncryptedSession(resetData.newMasterPassword, privateKeyJwk, publicKeyJwk);

      navigate('/dashboard');
    } catch (err) {
      setResetErrors({
        general:
          err.response?.data?.message || 'Failed to reset master password. Please try again.',
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div
      className="min-h-screen overflow-y-auto bg-cover bg-center relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="absolute inset-0 bg-white/35 dark:bg-slate-950/60" />

      <div className="relative z-10 min-h-screen max-w-[1450px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_430px] items-center gap-8 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-0">
        <div className="max-w-[780px] hidden lg:block">
          <img src={logo} alt="Vaultix" className="w-64 mb-10" />

          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/80 dark:bg-blue-900/30 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-400 mb-6">
            <ShieldCheck size={16} />
            Secure vault verification
          </div>

          <h1 className="text-6xl font-black leading-[1.05] tracking-[-2px] text-[#020617] dark:text-white">
            Unlock your secure Vaultix workspace.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 mt-6 text-[20px] leading-9 max-w-3xl">
            Welcome{user?.fullName ? `, ${user.fullName}` : ''}. Enter your
            master password to access protected vaults and sensitive
            credentials.
          </p>

          <div className="grid grid-cols-3 gap-4 mt-10 max-w-4xl">
            <Feature icon={LockKeyhole} title="Locked Vault" text="Protected until verified." />
            <Feature icon={KeyRound} title="Private Access" text="Only verified users continue." />
            <Feature icon={TimerReset} title="Quick Re-lock" text="Lock anytime from the top bar." />
          </div>
        </div>

        <AuthCard
          title="Unlock vault"
          subtitle="Enter your master password to continue."
          onBack={() => {
            dispatch(logoutUser());
            navigate('/login');
          }}
        >
          <div className="lg:hidden flex justify-center mb-4">
            <img src={logo} alt="Vaultix" className="w-40" />
          </div>

          {user?.masterPasswordHint && (
            <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
              Hint: {user.masterPasswordHint}
            </div>
          )}

          {!resetMode ? (
            <>
              {error && <ErrorBox message={error} />}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Master password"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 pr-12 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={verifying || loading}
                  className="w-full rounded-2xl bg-blue-600 py-3.5 sm:py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
                >
                  {verifying ? 'Verifying...' : 'Unlock Vault'}
                </button>
              </form>

              <button
                type="button"
                onClick={() => navigate('/forgot-master-password')}
                className="mt-5 w-full text-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Forgot your master password?
              </button>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
                Your vault stays locked until your master password is verified.
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] font-mono">Ctrl+Shift+L</kbd> anytime to re-lock.
              </p>
            </>
          ) : (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700 dark:text-red-300">
                    <p className="font-semibold">Reset is permanent and destroys vault access.</p>
                    <p className="mt-1">
                      Because Vaultix is zero-knowledge, resetting without your current
                      master password cannot recover existing entries — all encrypted vault
                      items become permanently inaccessible. Only proceed if you have lost
                      your master password and accept this loss.
                    </p>
                  </div>
                </div>
              </div>

              {resetErrors.general && <ErrorBox message={resetErrors.general} />}

              <div>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    placeholder="Account password"
                    value={accountPassword}
                    onChange={(e) => {
                      setResetErrors((p) => ({ ...p, accountPassword: '', general: '' }));
                      setAccountPassword(e.target.value);
                    }}
                    className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 pr-12 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
                      resetErrors.accountPassword
                        ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {showResetPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {resetErrors.accountPassword && (
                  <p className="mt-1.5 text-sm text-red-500">{resetErrors.accountPassword}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    placeholder="New master password"
                    value={resetData.newMasterPassword}
                    onChange={(e) => {
                      setResetErrors((p) => ({ ...p, newMasterPassword: '', general: '' }));
                      setResetData((p) => ({ ...p, newMasterPassword: e.target.value }));
                    }}
                    className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 pr-12 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
                      resetErrors.newMasterPassword
                        ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {showResetPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {resetErrors.newMasterPassword && (
                  <p className="mt-1.5 text-sm text-red-500">{resetErrors.newMasterPassword}</p>
                )}
              </div>

              <div>
                <input
                  type={showResetPassword ? 'text' : 'password'}
                  placeholder="Confirm new master password"
                  value={resetData.confirmMasterPassword}
                  onChange={(e) => {
                    setResetErrors((p) => ({ ...p, confirmMasterPassword: '', general: '' }));
                    setResetData((p) => ({ ...p, confirmMasterPassword: e.target.value }));
                  }}
                  className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
                    resetErrors.confirmMasterPassword
                      ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                {resetErrors.confirmMasterPassword && (
                  <p className="mt-1.5 text-sm text-red-500">{resetErrors.confirmMasterPassword}</p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Password hint (optional)"
                  value={resetData.hint}
                  onChange={(e) => {
                    setResetErrors((p) => ({ ...p, hint: '', general: '' }));
                    setResetData((p) => ({ ...p, hint: e.target.value }));
                  }}
                  className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
                    resetErrors.hint
                      ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                {resetErrors.hint && (
                  <p className="mt-1.5 text-sm text-red-500">{resetErrors.hint}</p>
                )}
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmReset}
                  onChange={(e) => {
                    setConfirmReset(e.target.checked);
                    setResetErrors((p) => ({ ...p, acknowledged: '' }));
                  }}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-red-700 dark:text-red-300">
                  I understand this will generate a new encryption key and make all
                  existing vault items inaccessible.
                </span>
              </label>
              {resetErrors.acknowledged && (
                <p className="text-sm text-red-500">{resetErrors.acknowledged}</p>
              )}

              <button
                type="submit"
                disabled={resetting}
                className="w-full rounded-2xl bg-red-600 py-3.5 sm:py-4 font-bold text-white transition-all hover:bg-red-700 hover:shadow-lg disabled:opacity-60"
              >
                {resetting ? 'Resetting...' : 'Reset Master Password'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setResetErrors({});
                  setConfirmReset(false);
                  setAccountPassword('');
                  setResetData({ newMasterPassword: '', confirmMasterPassword: '', hint: '' });
                }}
                className="w-full text-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Cancel
              </button>
            </form>
          )}
        </AuthCard>
      </div>
    </div>
  );
}

function AuthCard({ title, subtitle, children, onBack }) {
  return (
    <div className="bg-white/88 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl sm:rounded-[32px] shadow-[0_20px_60px_rgba(37,99,235,0.14)] border border-white dark:border-slate-600 p-5 sm:p-7 md:p-9 w-full max-w-[430px] mx-auto min-w-0">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-6 transition-colors"
      >
        <ArrowLeft size={17} />
        Back
      </button>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 dark:text-white">{title}</h2>
      <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6 sm:mb-7 text-sm sm:text-base">{subtitle}</p>
      {children}
    </div>
  );
}

function Feature({ icon: Icon, title, text }) {
  return (
    <div className="rounded-3xl border border-white/80 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-5 shadow-sm">
      <Icon size={24} className="text-blue-600 dark:text-blue-400" />
      <h3 className="font-bold text-slate-900 dark:text-slate-100 mt-4">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{text}</p>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div className="mb-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
      {message}
    </div>
  );
}

export default EnterMasterPasswordPage;