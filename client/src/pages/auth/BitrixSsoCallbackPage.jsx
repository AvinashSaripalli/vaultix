import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ShieldAlert, RefreshCw, ArrowLeft } from 'lucide-react';
import { setUser, setMasterVerified } from '../../features/auth/authSlice';
import api from '../../services/api';
import logo from '../../assets/Vaultix.png';

export default function BitrixSsoCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [error, setError] = useState(null);
  const attemptedRef = useRef(false);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No SSO token received. Please access Vaultix through the Bitrix24 menu.');
      return;
    }

    if (attemptedRef.current) return;
    attemptedRef.current = true;

    // Immediately sanitize URL so the signed token is not left in browser history
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    (async () => {
      try {
        const response = await api.post('/auth/bitrix/sso', { token });
        const { token: jwtToken, refreshToken, user: userData } = response.data;

        if (jwtToken) {
          localStorage.setItem('token', jwtToken);
        }
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        if (userData) {
          localStorage.setItem('user', JSON.stringify(userData));
          dispatch(setUser(userData));
        }

        dispatch(setMasterVerified(false));

        // Seamless redirect: if user already has master password, unlock; otherwise setup
        if (userData.hasMasterPassword || userData.masterPasswordHint) {
          navigate('/enter-master-password', { replace: true });
        } else {
          navigate('/set-master-password', { replace: true });
        }
      } catch (err) {
        console.error('Bitrix SSO login failed:', err);
        setError(
          err.response?.data?.message ||
            'Bitrix24 Single Sign-On failed. The session may have expired. Please refresh Bitrix24.'
        );
      }
    })();
  }, [searchParams, navigate, dispatch]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary,#f8fafc)] dark:bg-slate-900 px-4 py-12">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-700 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">SSO Authentication Failed</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">{error}</p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                const bitrixPortalUrl = import.meta.env.VITE_BITRIX_PORTAL_URL || 'https://karnsphere.com';
                window.location.href = `${bitrixPortalUrl}/local/modules/kn.vaultix/vaultix_frame.php?redirect=1`;
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-md text-sm"
            >
              <RefreshCw size={16} />
              Retry Bitrix24 Login
            </button>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 py-3 font-semibold text-slate-700 dark:text-slate-200 transition-all hover:bg-slate-50 dark:hover:bg-slate-750 text-sm"
            >
              <ArrowLeft size={16} />
              Standard Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary,#f8fafc)] dark:bg-slate-900 px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        {logo && <img src={logo} alt="Vaultix" className="h-10 w-auto mb-2 opacity-90" />}
        <div className="relative">
          <div className="h-12 w-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Connecting via Bitrix24</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Verifying your enterprise credentials...</p>
        </div>
      </div>
    </div>
  );
}
