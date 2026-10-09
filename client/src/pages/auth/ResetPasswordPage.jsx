import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import { validatePassword, validateConfirmPassword } from '../../utils/validation';
import { resetPasswordRequest } from '../../services/api';
import logo from '../../assets/Vaultix.png';
import bgImage from '../../assets/auth-bg.png';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <Shell>
        <AuthCard title="Invalid link" subtitle="This reset link is missing a token.">
          <ErrorBox message="The reset link is invalid or incomplete. Please request a new one." />
          <Link
            to="/forgot-password"
            className="mt-2 flex items-center justify-center gap-1.5 w-full rounded-2xl bg-blue-600 py-4 font-bold text-white hover:bg-blue-700"
          >
            Request a new link
          </Link>
        </AuthCard>
      </Shell>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const passwordError = validatePassword(password);
    const confirmError = validateConfirmPassword(password, confirm);
    if (passwordError || confirmError) {
      setErrors({ password: passwordError, confirm: confirmError });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await resetPasswordRequest(token, password);
      setDone(true);
    } catch (err) {
      setErrors({
        general: err.response?.data?.message || 'Failed to reset password. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <AuthCard title={done ? 'Password reset' : 'Set a new password'} subtitle={done ? 'You can now log in.' : 'Choose a strong new login password.'}>
        {done ? (
          <div>
            <div className="flex flex-col items-center gap-3 mb-4">
              <CheckCircle2 size={32} className="text-emerald-500" />
              <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
                Your password was reset successfully. You can now log in with
                your new password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full rounded-2xl bg-blue-600 py-3.5 sm:py-4 font-bold text-white hover:bg-blue-700 hover:shadow-lg"
            >
              Go to login
            </button>
          </div>
        ) : (
          <>
            {errors.general && <ErrorBox message={errors.general} />}

            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordInput
                value={password}
                showPassword={showPassword}
                error={errors.password}
                onToggle={() => setShowPassword((prev) => !prev)}
                onChange={(value) => {
                  setErrors((p) => ({ ...p, password: '', general: '' }));
                  setPassword(value);
                }}
                placeholder="New password"
              />

              <div>
                <PasswordInput
                  value={confirm}
                  showPassword={showPassword}
                  error={errors.confirm}
                  onToggle={() => setShowPassword((prev) => !prev)}
                  onChange={(value) => {
                    setErrors((p) => ({ ...p, confirm: '', general: '' }));
                    setConfirm(value);
                  }}
                  placeholder="Confirm new password"
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    8+ chars · uppercase · lowercase · number · special character
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-blue-600 py-3.5 sm:py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </form>
          </>
        )}

        {!done && (
          <Link
            to="/login"
            className="mt-7 flex items-center justify-center gap-1.5 w-full text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ArrowLeft size={15} />
            Back to login
          </Link>
        )}
      </AuthCard>
    </Shell>
  );
}

function Shell({ children }) {
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
            Protect your account.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 mt-6 text-[20px] leading-9 max-w-3xl">
            Set a new login password and keep your encrypted vault secure with
            Vaultix zero-knowledge protection.
          </p>

          <div className="mt-10 max-w-4xl">
            <ShieldCheck size={24} className="text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mt-4">
              Master password unchanged
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
              Resetting your login password does not alter your master
              password or your encrypted vault items.
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, showPassword, onToggle, error, placeholder }) {
  return (
    <div>
      <div className="relative">
        <LockKeyhole size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 pl-12 pr-12 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
            error
              ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
              : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
          }`}
        />

        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  );
}

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="bg-white/88 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl sm:rounded-[32px] shadow-[0_20px_60px_rgba(37,99,235,0.14)] border border-white dark:border-slate-600 p-5 sm:p-7 md:p-9 w-full max-w-[430px] mx-auto min-w-0">
      <div className="lg:hidden flex justify-center mb-4">
        <img src={logo} alt="Vaultix" className="w-40" />
      </div>
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

export default ResetPasswordPage;
