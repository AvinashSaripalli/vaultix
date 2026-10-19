import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  lockVault as lockVaultAction,
  showSessionWarning,
  updateSessionWarningSeconds,
  dismissSessionWarning,
} from '../features/auth/authSlice';
import { showToast } from '../utils/toast';

const DEFAULT_TIMEOUT_MINUTES = 15;
const WARNING_MS = 2 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 1000;
const LAST_ACTIVITY_KEY = 'vaultix-last-activity';

const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

const readLastActivity = () => {
  try {
    const raw = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  } catch {
    return 0;
  }
};

export const touchActivity = () => {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // storage unavailable
  }
};

export default function useInactivityLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isMasterVerified, sessionWarningOpen, user } = useSelector(
    (state) => state.auth
  );
  const warningShownRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !isMasterVerified) return;

    const timeoutMinutes = user?.vaultTimeoutMinutes || DEFAULT_TIMEOUT_MINUTES;
    const TIMEOUT_MS = Math.max(1, timeoutMinutes) * 60 * 1000;

    const checkInactivity = () => {
      const last = readLastActivity();
      if (!last) return;

      const elapsed = Date.now() - last;
      const remaining = TIMEOUT_MS - elapsed;

      if (remaining <= 0) {
        warningShownRef.current = false;
        dispatch(dismissSessionWarning());
        dispatch(lockVaultAction());
        showToast('Vault locked due to inactivity', 'info');
        if (location.pathname !== '/enter-master-password') {
          navigate('/enter-master-password');
        }
        return;
      }

      // Only show the warning if the timeout is long enough to matter
      if (remaining <= WARNING_MS) {
        const secondsLeft = Math.ceil(remaining / 1000);
        if (!warningShownRef.current) {
          warningShownRef.current = true;
          dispatch(showSessionWarning(secondsLeft));
        } else if (sessionWarningOpen) {
          dispatch(updateSessionWarningSeconds(secondsLeft));
        }
      } else if (warningShownRef.current) {
        warningShownRef.current = false;
        dispatch(dismissSessionWarning());
      }
    };

    const handleActivity = () => {
      touchActivity();
      if (warningShownRef.current) {
        warningShownRef.current = false;
        dispatch(dismissSessionWarning());
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };

    touchActivity();
    EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );
    window.addEventListener('focus', handleActivity);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(checkInactivity, CHECK_INTERVAL_MS);

    return () => {
      EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
      window.removeEventListener('focus', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [isAuthenticated, isMasterVerified, sessionWarningOpen, dispatch, navigate, location.pathname, user?.vaultTimeoutMinutes]);
}
