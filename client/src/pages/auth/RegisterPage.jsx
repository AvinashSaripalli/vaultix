import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { clearError, registerUser } from '../../features/auth/authSlice';
import { validateEmail, validatePassword, validateFullName } from '../../utils/validation';
import api from '../../services/api';
import logo from '../../assets/Vaultix.png';
import bgImage from '../../assets/auth-bg.png';

function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  const inviteToken = searchParams.get('token');

  const { loading, error, isAuthenticated, userLoaded } = useSelector(
    (state) => state.auth
  );

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    if (isAuthenticated && userLoaded) navigate('/set-master-password');
  }, [isAuthenticated, userLoaded, navigate]);  useEffect(() => {
    if (!inviteToken) return;

    let cancelled = false;

    api
      .get(`/invitations/${inviteToken}`)
      .then((res) => {
        if (cancelled) return;
        setInviteEmail(res.data.email || '');
        setFormData((prev) => ({ ...prev, email: res.data.email || '' }));
      })
      .catch((err) => {
        if (cancelled) return;
        setInviteError(
          err.response?.data?.message || 'Invalid invitation link'
        );
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  useEffect(() => {
    return () => dispatch(clearError());
  }, [dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const nameError = validateFullName(formData.fullName);
    const emailError = validateEmail(formData.email);
    const passwordError = validatePassword(formData.password);
    if (nameError || emailError || passwordError) {
      setErrors({ fullName: nameError, email: emailError, password: passwordError });
      return;
    }
    setErrors({});
    dispatch(registerUser({ ...formData, token: inviteToken }));
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
            Start securing your business passwords today.
          </h1>

          <p className="text-slate-600 dark:text-slate-300 mt-6 text-[20px] leading-9 max-w-3xl">
            Create your Vaultix workspace to manage company credentials,
            personal vaults, password sharing, and secure access control.
          </p>

          <div className="grid grid-cols-3 gap-4 mt-10 max-w-4xl">
            <Feature
              icon={ShieldCheck}
              title="Encrypted Vaults"
              text="Keep sensitive credentials protected."
            />

            <Feature
              icon={LockKeyhole}
              title="Master Security"
              text="Add verification before access."
            />

            <Feature
              icon={Users}
              title="Team Sharing"
              text="Share passwords safely."
            />
          </div>
        </div>

        <AuthCard
          title="Create account"
          subtitle="Start managing passwords securely."
        >
          <div className="lg:hidden flex justify-center mb-4">
            <img src={logo} alt="Vaultix" className="w-40" />
          </div>

          {inviteLoading && (
            <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
              Checking your invitation...
            </div>
          )}

          {inviteError && <ErrorBox message={inviteError} />}

          {error && <ErrorBox message={error} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              placeholder="Full name"
              value={formData.fullName}
              error={errors.fullName}
              onChange={(value) => {
                setErrors((p) => ({ ...p, fullName: '' }));
                setFormData((p) => ({ ...p, fullName: value }));
              }}
            />

            <Input
              type="email"
              placeholder="Email address"
              value={formData.email}
              error={errors.email}
              disabled={!!inviteEmail}
              onChange={(value) => {
                setErrors((p) => ({ ...p, email: '' }));
                setFormData((p) => ({ ...p, email: value }));
              }}
            />

            {inviteEmail && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Email is locked to the address your invitation was sent to.
              </p>
            )}

            {/* Password Field With Eye Icon */}
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
                  required
                  className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-5 pr-12 py-4 outline-none transition-all focus:ring-4 ${
                    errors.password
                      ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
                      : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  {showPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || inviteLoading || !!inviteError}
              className="w-full rounded-2xl bg-blue-600 py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
            >
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-600 dark:text-slate-300">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600">
              Login
            </Link>
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
      <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6 sm:mb-7 text-sm sm:text-base">{subtitle}</p>
      {children}
    </div>
  );
}

function Input({ type, placeholder, value, onChange, error, disabled }) {
  return (
    <div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required
        className={`w-full rounded-2xl border bg-white/90 dark:bg-slate-800/90 dark:text-slate-100 px-4 sm:px-5 py-3 sm:py-4 text-sm sm:text-base outline-none transition-all focus:ring-4 ${
          disabled
            ? 'opacity-60 cursor-not-allowed'
            : ''
        } ${
          error
            ? 'border-red-300 dark:border-red-700 focus:border-red-500 focus:ring-red-100'
            : 'border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100'
        }`}
      />
      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
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

export default RegisterPage;