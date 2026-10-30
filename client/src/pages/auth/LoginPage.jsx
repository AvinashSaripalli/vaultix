import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Users, KeyRound, Smartphone, ShieldEllipsis } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { clearError, loginUser, logoutUser, verify2FA } from '../../features/auth/authSlice';
import { validateEmail, validatePassword } from '../../utils/validation';
import api from '../../services/api';
import {
  generateWebAuthnAuthOptions,
  completeWebAuthnAuthentication,
} from '../../utils/webauthnAuth';
import logo from '../../assets/Vaultix.png';
import bgImage from '../../assets/auth-bg.png';

function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user, loading, error, isAuthenticated, userLoaded } = useSelector(
    (state) => state.auth
  );

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // 2FA state
  const [requires2FA, setRequires2FA] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [twoFactorTab, setTwoFactorTab] = useState('totp');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [webauthnLoading, setWebauthnLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && userLoaded && !requires2FA) {
      navigate(
        user.hasMasterPassword || user.masterPasswordHint
          ? '/enter-master-password'
          : '/set-master-password'
      );
    }
  }, [isAuthenticated, user, userLoaded, navigate, requires2FA]);

  useEffect(() => {
    return () => dispatch(clearError());
  }, [dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }
    setErrors({});
    const result = await dispatch(loginUser(formData));
    if (result.payload?.requires2FA) {
      setRequires2FA(true);
      setPendingEmail(formData.email);
      setPendingPassword(formData.password);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    const payload = {
      email: pendingEmail,
      password: pendingPassword,
    };

    if (twoFactorTab === 'backup') {
      if (!backupCode) {
        setErrors({ backupCode: 'Backup code is required' });
        return;
      }
      payload.backupCode = backupCode;
    } else {
      if (!twoFactorCode) {
        setErrors({ twoFactorCode: 'Verification code is required' });
        return;
      }
      payload.twoFactorCode = twoFactorCode;
      payload.twoFactorMethod = 'totp';
    }

    const result = await dispatch(verify2FA(payload));
    if (verify2FA.fulfilled.match(result)) {
      setRequires2FA(false);
    }
  };

  const handleWebAuthn = async () => {
    setErrors({});
    setWebauthnLoading(true);
    try {
      // Get the user's WebAuthn credentials
      const credsRes = await api.post('/2fa/webauthn/authenticate-begin', {
        credentialIds: [],
      });
      const { options, challenge } = credsRes.data;

      const assertion = await completeWebAuthnAuthentication(options);
      const verifyRes = await api.post('/2fa/webauthn/authenticate-finish', {
        response: assertion,
        challenge,
      });

      if (verifyRes.data?.verified) {
        const userId = verifyRes.data.userId;
        // Login with the verified WebAuthn credential - use the access token flow
        // The server has verified the credential, now complete login
        const result = await dispatch(loginUser({
          email: pendingEmail,
          password: pendingPassword,
          webauthnVerified: true,
        }));

        if (result.payload?.token) {
          setRequires2FA(false);
          navigate('/enter-master-password');
        }
      }
    } catch {
      setErrors({ twoFactorCode: 'WebAuthn authentication failed. Please try again.' });
    } finally {
      setWebauthnLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequires2FA(false);
    setPendingEmail('');
    setPendingPassword('');
    setTwoFactorCode('');
    setBackupCode('');
  };

  const inputClass = (field) =>
    `w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-5 py-4 outline-none transition-all focus:ring-4 ${
      errors[field]
        ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
    }`;

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
            Secure password management for your business.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 mt-6 text-[20px] leading-9 max-w-3xl">
            Store, organize, and share credentials safely with personal vaults,
            company vaults, master password protection, and controlled access.
          </p>

          <div className="grid grid-cols-3 gap-4 mt-10 max-w-4xl">
            <Feature icon={ShieldCheck} title="Secure Vaults" text="Protect sensitive credentials." />
            <Feature icon={LockKeyhole} title="Master Lock" text="Verify before vault access." />
            <Feature icon={Users} title="Safe Sharing" text="Share passwords with control." />
          </div>
        </div>

        <AuthCard
          title={requires2FA ? 'Two-Factor Authentication' : 'Welcome back'}
          subtitle={requires2FA ? 'Enter your 2FA code to continue' : 'Login to access your secure vault.'}
        >
          <div className="lg:hidden flex justify-center mb-4">
            <img src={logo} alt="Vaultix" className="w-40" />
          </div>

          {error && <ErrorBox message={error} />}

          {!requires2FA ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="Email address"
                value={formData.email}
                error={errors.email}
                onChange={(value) => {
                  setErrors((p) => ({ ...p, email: '' }));
                  setFormData((p) => ({ ...p, email: value }));
                }}
              />

              <div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => {
                      setErrors((p) => ({ ...p, password: '' }));
                      setFormData((p) => ({ ...p, password: e.target.value }));
                    }}
                    className={inputClass('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-sm text-red-500">{errors.password}</p>}
              </div>

              <div className="flex justify-end -mt-1">
                <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* 2FA method tabs */}
              <div className="flex gap-2 rounded-xl bg-slate-100 dark:bg-slate-700 p-1">
                <button
                  type="button"
                  onClick={() => setTwoFactorTab('totp')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    twoFactorTab === 'totp'
                      ? 'bg-white dark:bg-slate-800 text-blue-700 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Smartphone size={15} />
                  Authenticator
                </button>
                <button
                  type="button"
                  onClick={() => setTwoFactorTab('backup')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    twoFactorTab === 'backup'
                      ? 'bg-white dark:bg-slate-800 text-blue-700 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <KeyRound size={15} />
                  Backup Code
                </button>
              </div>

              {twoFactorTab === 'totp' ? (
                <form onSubmit={handle2FASubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Authenticator Code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={twoFactorCode}
                      onChange={(e) => {
                        setErrors((p) => ({ ...p, twoFactorCode: '' }));
                        setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      }}
                      className={`${inputClass('twoFactorCode')} text-center text-xl tracking-[0.5em] font-mono`}
                    />
                    {errors.twoFactorCode && <p className="mt-1.5 text-sm text-red-500">{errors.twoFactorCode}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
                  >
                    {loading ? 'Verifying...' : 'Verify & Login'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handle2FASubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Backup Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. XXXX-XXXX"
                      value={backupCode}
                      onChange={(e) => {
                        setErrors((p) => ({ ...p, backupCode: '' }));
                        setBackupCode(e.target.value);
                      }}
                      className={`${inputClass('backupCode')} text-center font-mono tracking-wider`}
                    />
                    {errors.backupCode && <p className="mt-1.5 text-sm text-red-500">{errors.backupCode}</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
                  >
                    {loading ? 'Verifying...' : 'Verify & Login'}
                  </button>
                </form>
              )}

              <div className="relative flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
                <span className="text-xs text-slate-400 dark:text-slate-500">or</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-600" />
              </div>

              <button
                type="button"
                onClick={handleWebAuthn}
                disabled={webauthnLoading}
                className="w-full rounded-2xl border border-slate-300 dark:border-slate-600 py-4 font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <ShieldEllipsis size={18} />
                {webauthnLoading ? 'Authenticating...' : 'Use Security Key'}
              </button>
            </div>
          )}

          {!requires2FA && (
            <p className="mt-7 text-center text-sm text-slate-600 dark:text-slate-300">
              Don’t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    dispatch(logoutUser());
                    navigate('/register');
                  }}
                  className="font-semibold text-blue-600"
                >
                  Create account
                </button>
            </p>
          )}

          {requires2FA && (
            <button
              type="button"
              onClick={handleBackToLogin}
              className="mt-5 w-full text-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              ← Back to login
            </button>
          )}

          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck size={13} className="text-emerald-500" />
            End-to-end encrypted · Zero-knowledge architecture
          </p>
        </AuthCard>
      </div>
    </div>
  );
}

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="bg-white/88 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl sm:rounded-[32px] shadow-[0_20px_60px_rgba(37,99,235,0.14)] border border-white dark:border-slate-600 p-5 sm:p-7 md:p-9 w-full max-w-[430px] mx-auto min-w-0">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 dark:text-white">{title}</h2>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 sm:mt-2 mb-5 sm:mb-7">{subtitle}</p>
      {children}
    </div>
  );
}

function Input({ type, placeholder, value, onChange, error }) {
  return (
    <div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
          error
            ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
            : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
        }`}
      />
      {error && <p className="mt-1.5 text-xs sm:text-sm text-red-500">{error}</p>}
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

export default LoginPage;
