import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { validateEmail, validateMasterPassword, validateConfirmPassword, validateHint } from '../../utils/validation';
import {
  requestMasterRecoveryKey,
  resetMasterPasswordWithRecoveryKey,
} from '../../services/api';
import logo from '../../assets/Vaultix.png';
import bgImage from '../../assets/auth-bg.png';

function ForgotMasterPasswordPage() {
  const navigate = useNavigate();

  // Step 1 — email
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Step 2 — recover
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [hint, setHint] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSendKey = async (e) => {
    e.preventDefault();
    const emailCheck = validateEmail(email);
    if (emailCheck) {
      setEmailError(emailCheck);
      return;
    }
    setEmailError('');
    setSending(true);
    try {
      await requestMasterRecoveryKey(email);
      setSent(true);
    } catch (err) {
      setEmailError(
        err.response?.data?.message || 'Failed to send recovery key. Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    const keyError = recoveryKey.trim() ? '' : 'Recovery key is required';
    const masterError = validateMasterPassword(newMasterPassword);
    const confirmError = validateConfirmPassword(newMasterPassword, confirmMasterPassword);
    const hintError = validateHint(hint);

    if (keyError || masterError || confirmError || hintError) {
      setErrors({
        recoveryKey: keyError,
        newMasterPassword: masterError,
        confirmMasterPassword: confirmError,
        hint: hintError,
      });
      return;
    }

    setErrors({});
    setResetting(true);
    try {
      await resetMasterPasswordWithRecoveryKey({
        email: email.trim(),
        recoveryKey: recoveryKey.trim(),
        newMasterPassword,
        hint,
      });
      sessionStorage.removeItem('masterPasswordVerifier');
      sessionStorage.removeItem('vaultix-enc-session');
      sessionStorage.removeItem('vaultix-master-verified');
      setDone(true);
    } catch (err) {
      setErrors({
        general: err.response?.data?.message || 'Failed to reset master password. Please try again.',
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

          <h1 className="text-6xl font-black leading-[1.05] tracking-[-2px] text-[#020617] dark:text-white">
            Recover your master password.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 mt-6 text-[20px] leading-9 max-w-3xl">
            We'll send your recovery key to your email. Use it to set a new
            master password and restore access to your encrypted vault without
            losing your data.
          </p>

          <div className="mt-10 max-w-4xl">
            <ShieldCheck size={24} className="text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mt-4">
              Data-safe recovery
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
              Your recovery key unlocks an escrowed copy of your encryption keys,
              so resetting the master password preserves your stored passwords.
            </p>
          </div>
        </div>

        <Card title="Recover master password" subtitle="Restore access to your vault.">
          <div className="lg:hidden flex justify-center mb-4">
            <img src={logo} alt="Vaultix" className="w-40" />
          </div>

          {done ? (
            <div>
              <div className="flex flex-col items-center gap-3 mb-4">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
                  Your master password was reset successfully. Your vault data
                  has been preserved. You can now log in with your new master
                  password.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg"
              >
                Go to login
              </button>
            </div>
          ) : !sent ? (
            <form onSubmit={handleSendKey} className="space-y-4">
              {emailError && <ErrorBox message={emailError} />}

              <div className="relative">
                <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmailError('');
                    setEmail(e.target.value);
                  }}
                  className="w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 pl-12 pr-5 py-4 outline-none transition-all focus:ring-4 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
              >
                {sending ? 'Sending...' : 'Send recovery key'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                A recovery key has been sent to your email. Enter it below along
                with your new master password.
              </div>

              {errors.general && <ErrorBox message={errors.general} />}

              <div>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Recovery key"
                    value={recoveryKey}
                    onChange={(e) => {
                      setErrors((p) => ({ ...p, recoveryKey: '', general: '' }));
                      setRecoveryKey(e.target.value);
                    }}
                    className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 pl-12 pr-5 py-4 outline-none transition-all focus:ring-4 ${
                      errors.recoveryKey
                        ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {errors.recoveryKey && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.recoveryKey}</p>
                )}
              </div>

              <div>
                <div className="relative">
                  <LockKeyhole size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Set new master password"
                    value={newMasterPassword}
                    onChange={(e) => {
                      setErrors((p) => ({ ...p, newMasterPassword: '', general: '' }));
                      setNewMasterPassword(e.target.value);
                    }}
                    className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 pl-12 pr-12 py-4 outline-none transition-all focus:ring-4 ${
                      errors.newMasterPassword
                        ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                        : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.newMasterPassword && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.newMasterPassword}</p>
                )}
              </div>

              <div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm new master password"
                  value={confirmMasterPassword}
                  onChange={(e) => {
                    setErrors((p) => ({ ...p, confirmMasterPassword: '', general: '' }));
                    setConfirmMasterPassword(e.target.value);
                  }}
                  className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-5 py-4 outline-none transition-all focus:ring-4 ${
                    errors.confirmMasterPassword
                      ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                {errors.confirmMasterPassword && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.confirmMasterPassword}</p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Password hint (optional)"
                  value={hint}
                  onChange={(e) => {
                    setErrors((p) => ({ ...p, hint: '', general: '' }));
                    setHint(e.target.value);
                  }}
                  className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-5 py-4 outline-none transition-all focus:ring-4 ${
                    errors.hint
                      ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                {errors.hint && (
                  <p className="mt-1.5 text-sm text-red-500">{errors.hint}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={resetting}
                className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
              >
                {resetting ? 'Resetting...' : 'Reset Master Password'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setRecoveryKey('');
                  setNewMasterPassword('');
                  setConfirmMasterPassword('');
                  setHint('');
                  setErrors({});
                }}
                className="w-full text-center text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Resend recovery key
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-7 flex items-center justify-center gap-1.5 w-full text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ArrowLeft size={15} />
            Back to login
          </button>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="bg-white/88 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl sm:rounded-[32px] shadow-[0_20px_60px_rgba(37,99,235,0.14)] border border-white dark:border-slate-600 p-5 sm:p-7 md:p-9 w-full max-w-[430px] mx-auto min-w-0">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 dark:text-white">{title}</h2>
      <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6 sm:mb-7 text-sm sm:text-base">{subtitle}</p>
      {children}
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

export default ForgotMasterPasswordPage;
