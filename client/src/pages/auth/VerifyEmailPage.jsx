import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, ShieldCheck, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { verifyEmail, requestEmailVerification } from '../../features/auth/authSlice';
import logo from '../../assets/Vaultix.png';
import bgImage from '../../assets/auth-bg.png';

function VerifyEmailPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const { error, user, isAuthenticated } = useSelector((state) => state.auth);

  const [status, setStatus] = useState(token ? 'verifying' : 'not-sent');
  const [message, setMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token || status !== 'verifying') return;
    let cancelled = false;

    dispatch(verifyEmail(token)).then((result) => {
      if (cancelled) return;
      if (verifyEmail.fulfilled.match(result)) {
        setStatus('success');
        setMessage('Your email has been verified successfully!');
      } else {
        setStatus('error');
        setMessage(result.payload || 'Verification failed. The link may be invalid or expired.');
      }
    });

    return () => { cancelled = true; };
  }, [token, status, dispatch]);

  const handleResend = async () => {
    setResending(true);
    const result = await dispatch(requestEmailVerification());
    setResending(false);
    if (requestEmailVerification.fulfilled.match(result)) {
      setStatus('resend-success');
      setMessage('A new verification email has been sent. Please check your inbox.');
    } else {
      setStatus('error');
      setMessage(result.payload || 'Failed to resend verification email.');
    }
  };

  const statusConfig = {
    verifying: {
      icon: <Loader2 size={18} className="animate-spin text-blue-600" />,
      title: 'Verifying your email...',
      subtitle: 'Please wait while we confirm your email address.',
    },
    success: {
      icon: <CheckCircle2 size={48} className="text-emerald-500" />,
      title: 'Email verified!',
      subtitle: 'Your email address has been verified successfully.',
    },
    error: {
      icon: <AlertTriangle size={48} className="text-red-500" />,
      title: 'Verification failed',
      subtitle: 'We could not verify your email. The link may be invalid or expired.',
    },
    'not-sent': {
      icon: <MailCheck size={48} className="text-blue-500" />,
      title: 'Verify your email',
      subtitle: 'No verification token was provided. Enter your email below to receive a verification link, or resend it.',
    },
    'resend-success': {
      icon: <MailCheck size={48} className="text-emerald-500" />,
      title: 'Verification email sent',
      subtitle: 'Please check your inbox for the verification link.',
    },
  };

  const config = statusConfig[status] || statusConfig['not-sent'];

  return (
    <div
      className="min-h-screen overflow-y-auto bg-cover bg-center relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="absolute inset-0 bg-white/35 dark:bg-slate-950/60" />

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-[480px]">
          <div className="bg-white/88 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl sm:rounded-[32px] shadow-[0_20px_60px_rgba(37,99,235,0.14)] border border-white dark:border-slate-600 p-5 sm:p-7 md:p-9 text-center">
            <div className="flex justify-center mb-5">
              <img src={logo} alt="Vaultix" className="w-36 sm:w-44" />
            </div>

            <div className="flex justify-center mb-4">{config.icon}</div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white">{config.title}</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2 mb-6 sm:mb-7 text-sm sm:text-base">{config.subtitle}</p>

            {message && (
              <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                status === 'success' || status === 'resend-success'
                  ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                  : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              }`}>
                {message}
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {(status === 'error' || status === 'not-sent' || status === 'resend-success') && (
                <>
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending}
                      className="w-full rounded-2xl bg-blue-600 py-3.5 sm:py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg disabled:opacity-60"
                    >
                      {resending ? 'Sending...' : 'Resend Verification Email'}
                    </button>
                  )}

                  {status === 'error' && !isAuthenticated && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Please <Link to="/login" className="text-blue-600 font-semibold">log in</Link> to resend your verification email.
                    </p>
                  )}

                  <Link
                    to="/login"
                    className="block w-full rounded-2xl border border-slate-300 dark:border-slate-600 py-3.5 sm:py-4 font-bold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Go to Login
                  </Link>
                </>
              )}

              {status === 'success' && (
                <Link
                  to="/login"
                  className="block w-full rounded-2xl bg-blue-600 py-3.5 sm:py-4 font-bold text-white transition-all hover:bg-blue-700 hover:shadow-lg"
                >
                  Continue to Login
                </Link>
              )}

              {status === 'verifying' && (
                <p className="text-sm text-slate-400">This may take a moment...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmailPage;
