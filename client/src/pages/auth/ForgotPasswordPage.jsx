import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, ArrowLeft } from 'lucide-react';
import { validateEmail } from '../../utils/validation';
import { requestPasswordReset } from '../../services/api';
import logo from '../../assets/Vaultix.png';
import bgImage from '../../assets/auth-bg.png';

function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
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
            Reset your Vaultix password.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 mt-6 text-[20px] leading-9 max-w-3xl">
            Enter the email associated with your account and we will send you
            a secure link to set a new password. Your encrypted vault data
            stays protected.
          </p>

          <div className="mt-10 max-w-4xl">
            <ShieldCheck size={24} className="text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mt-4">
              Zero-knowledge protection
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-xl">
              Resetting your login password never touches your master password
              or your encrypted vault items.
            </p>
          </div>
        </div>

        <AuthCard title="Forgot password?" subtitle="We’ll email you a reset link.">
          <div className="lg:hidden flex justify-center mb-4">
            <img src={logo} alt="Vaultix" className="w-40" />
          </div>

          {sent ? (
            <div>
              <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                If an account exists for that email, a password reset link has
                been sent. Check your inbox (including spam).
              </div>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
                className="w-full rounded-2xl bg-blue-600 py-3.5 sm:py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg"
              >
                Send again
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <ErrorBox message={error} />}

              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(value) => {
                  setError('');
                  setEmail(value);
                }}
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-blue-600 py-3.5 sm:py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
              >
                {loading ? 'Sending...' : 'Send reset link'}
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
        </AuthCard>
      </div>
    </div>
  );
}

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="bg-white/88 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl sm:rounded-[32px] shadow-[0_20px_60px_rgba(37,99,235,0.14)] border border-white dark:border-slate-600 p-5 sm:p-7 md:p-9 w-full max-w-[430px] mx-auto min-w-0">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-950 dark:text-white">{title}</h2>
      <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6 sm:mb-7 text-sm sm:text-base">{subtitle}</p>
      {children}
    </div>
  );
}

function Input({ type, placeholder, value, onChange }) {
  return (
    <div className="relative">
      <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 pl-12 pr-5 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100"
      />
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

export default ForgotPasswordPage;
