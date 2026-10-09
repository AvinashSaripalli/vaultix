import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  clearError,
  logoutUser,
  setMasterPassword,
} from '../../features/auth/authSlice';
import {
  createMasterPasswordVerifier,
  MASTER_VERIFIER_STORAGE_KEY,
} from '../../utils/crypto';
import {
  validateMasterPassword,
  validateConfirmPassword,
  validateHint,
} from '../../utils/validation';
import logo from '../../assets/Vaultix.png';
import bgImage from '../../assets/auth-bg.png';

function SetMasterPasswordPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user, loading, error, isAuthenticated } = useSelector(
    (state) => state.auth
  );

  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    masterPassword: '',
    confirmMasterPassword: '',
    hint: '',
  });

  const [errors, setErrors] = useState({});
  const [recoveryKey, setRecoveryKey] = useState(null);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user?.hasMasterPassword || user?.masterPasswordHint) {
      navigate('/enter-master-password');
    }
  }, [isAuthenticated, user?.id, navigate]);

  useEffect(() => {
    return () => dispatch(clearError());
  }, [dispatch]);

  const updateField = (field, value) => {
    setErrors((prev) => ({ ...prev, [field]: '' }));
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const masterError = validateMasterPassword(formData.masterPassword);
    const confirmError = validateConfirmPassword(
      formData.masterPassword,
      formData.confirmMasterPassword
    );
    const hintError = validateHint(formData.hint);

    if (masterError || confirmError || hintError) {
      setErrors({
        masterPassword: masterError,
        confirmMasterPassword: confirmError,
        hint: hintError,
      });
      return;
    }

    setErrors({});

    const result = await dispatch(
      setMasterPassword({
        masterPassword: formData.masterPassword,
        hint: formData.hint,
      })
    );

    if (setMasterPassword.fulfilled.match(result)) {
      const verifier = await createMasterPasswordVerifier(
        formData.masterPassword,
        user?.encryptionSalt
      );
      sessionStorage.setItem(MASTER_VERIFIER_STORAGE_KEY, verifier);

      // Show the recovery key once so the user can save it safely before
      // continuing into the dashboard.
      if (result.payload?.recoveryKey) {
        setRecoveryKey(result.payload.recoveryKey);
        return;
      }

      navigate('/dashboard');
    }
  };

  return (
    <div
      className="min-h-screen overflow-y-auto bg-cover bg-center relative"
      style={{
        backgroundImage: `url(${bgImage})`,
      }}
    >
      <div className="absolute inset-0 bg-white/35 dark:bg-slate-950/60" />

      <div className="relative z-10 min-h-screen max-w-[1450px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_440px] items-center gap-8 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-0">
        <div className="max-w-[800px] hidden lg:block">
          <img
            src={logo}
            alt="Vaultix"
            className="w-64 mb-10"
          />

          <div className="inline-flex items-center gap-2 rounded-full bg-blue-100/80 dark:bg-blue-900/30 px-4 py-2 text-sm font-semibold text-blue-700 dark:text-blue-400 mb-6">
            <ShieldCheck size={16} />
            First-time security setup
          </div>

          <h1 className="text-6xl font-black leading-[1.05] tracking-[-2px] text-[#020617] dark:text-white">
            Protect your vault with a master password.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 mt-6 text-[20px] leading-9 max-w-3xl">
            Your master password protects access to
            sensitive credentials, private vaults,
            shared passwords, and secure actions.
          </p>

          <div className="grid grid-cols-3 gap-4 mt-10 max-w-4xl">
            <Feature
              icon={LockKeyhole}
              title="Private Access"
              text="Required before opening vaults."
            />

            <Feature
              icon={KeyRound}
              title="Sensitive Actions"
              text="Protect view, copy and edit."
            />

            <Feature
              icon={CheckCircle2}
              title="Safer Workspace"
              text="Useful in shared systems."
            />
          </div>
        </div>

        <AuthCard
          title="Set master password"
          subtitle="Create a strong password to unlock your workspace."
          onBack={() => {
            dispatch(logoutUser());
            navigate('/register');
          }}
        >
          <div className="lg:hidden flex justify-center mb-4">
            <img src={logo} alt="Vaultix" className="w-40" />
          </div>
          {recoveryKey ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 mb-2">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
                  Your master password is set. Save this recovery key in a safe
                  place — you need it to recover your vault if you ever forget
                  your master password.
                </p>
              </div>

              <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-900/20 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                  Your recovery key
                </p>
                <p className="text-2xl font-black tracking-[2px] text-blue-700 dark:text-blue-300 font-mono">
                  {showRecoveryKey
                    ? recoveryKey
                    : '••••-••••-••••'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowRecoveryKey((prev) => !prev)}
                  className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showRecoveryKey ? 'Hide recovery key' : 'Show recovery key'}
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                This key can also be sent to your email from the unlock screen if
                you forget your master password.
              </p>

              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg"
              >
                Continue to dashboard
              </button>
            </div>
          ) : (
          <>{
            error && <ErrorBox message={error} />
          }

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {/* Master Password */}
            <div>
              <div className="relative">
                <input
                  type={
                    showMasterPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Master password"
                  value={formData.masterPassword}
                  onChange={(e) =>
                    updateField(
                      'masterPassword',
                      e.target.value
                    )
                  }
                  required
                  className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 pr-12 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
                    errors.masterPassword
                      ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowMasterPassword(
                      !showMasterPassword
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  {showMasterPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
              {errors.masterPassword && (
                <p className="mt-1.5 text-sm text-red-500">{errors.masterPassword}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <div className="relative">
                <input
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  placeholder="Confirm master password"
                  value={
                    formData.confirmMasterPassword
                  }
                  onChange={(e) =>
                    updateField(
                      'confirmMasterPassword',
                      e.target.value
                    )
                  }
                  required
                  className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 pr-12 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
                    errors.confirmMasterPassword
                      ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
              {errors.confirmMasterPassword && (
                <p className="mt-1.5 text-sm text-red-500">{errors.confirmMasterPassword}</p>
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder="Password hint (optional — not required)"
                value={formData.hint}
                onChange={(e) =>
                  updateField(
                    'hint',
                    e.target.value
                  )
                }
                className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
                  errors.hint
                    ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                    : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                }`}
              />
              {errors.hint && (
                <p className="mt-1.5 text-sm text-red-500">{errors.hint}</p>
              )}
            </div>

            <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 text-sm text-blue-700 dark:text-blue-400">
              Use a password you can remember.
              This protects access to your
              stored credentials.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-blue-600 py-3.5 sm:py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
            >
              {loading
                ? 'Saving...'
                : 'Save Master Password'}
            </button>
          </form>
          </>
          )}
        </AuthCard>
      </div>
    </div>
  );
}

function AuthCard({
  title,
  subtitle,
  children,
  onBack,
}) {
  return (
    <div className="bg-white/88 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl sm:rounded-[32px] shadow-[0_20px_60px_rgba(37,99,235,0.14)] border border-white dark:border-slate-600 p-5 sm:p-7 md:p-9 w-full max-w-[440px] mx-auto min-w-0">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-6 transition-colors"
      >
        <ArrowLeft size={17} />
        Back
      </button>

      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 dark:text-white">
        {title}
      </h2>

      <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6 sm:mb-7 text-sm sm:text-base">
        {subtitle}
      </p>

      {children}
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}) {
  return (
    <div className="rounded-3xl border border-white/80 dark:border-slate-600/50 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm p-5 shadow-sm">
      <Icon
        size={24}
        className="text-blue-600 dark:text-blue-400"
      />

      <h3 className="font-bold text-slate-900 dark:text-slate-100 mt-4">
        {title}
      </h3>

      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
        {text}
      </p>
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

export default SetMasterPasswordPage;