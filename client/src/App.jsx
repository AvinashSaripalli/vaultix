import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  dismissSessionWarning,
  fetchMe,
  refreshSession,
  setSessionMasterPassword,
  setSessionRsaPrivateKey,
  setSessionRsaPublicKey,
  setMasterVerified,
  lockVault as lockVaultAction,
} from './features/auth/authSlice';
import { restoreEncryptedSession } from './utils/secureSession';
import useInactivityLogout, { touchActivity } from './hooks/useInactivityLogout';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import useLockVault from './hooks/useLockVault';
import SessionWarningModal from './components/security/SessionWarningModal';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import ForgotMasterPasswordPage from './pages/auth/ForgotMasterPasswordPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import SetMasterPasswordPage from './pages/auth/SetMasterPasswordPage';
import EnterMasterPasswordPage from './pages/auth/EnterMasterPasswordPage';
import VaultPage from './pages/vaults/VaultPage';
import ProtectedRoute from './routes/ProtectedRoute';
import MasterProtectedRoute from './routes/MasterProtectedRoute';
import ActivityLogPage from './pages/activity/ActivityLogPage';
import TeamManagementPage from './pages/team/TeamManagementPage';
import DepartmentsPage from './pages/team/DepartmentsPage';
import MyDepartmentsPage from './pages/team/MyDepartmentsPage';
import EditUserPage from './pages/team/EditUserPage';
import InviteUserPage from './pages/team/InviteUserPage';
import MyVaultPage from './pages/vaults/MyVaultPage';
import SharedWithMePage from './pages/shared/SharedWithMePage';
import ProfilePage from './pages/profile/ProfilePage';
import VerifyEmailPage from './pages/auth/VerifyEmailPage';
import TwoFactorSettingsPage from './pages/security/TwoFactorSettingsPage';
import VaultTimeoutSettingsPage from './pages/security/VaultTimeoutSettingsPage';
import PasswordHealthPage from './pages/security/PasswordHealthPage';
import SessionsPage from './pages/security/SessionsPage';
import ClipboardSettingsPage from './pages/security/ClipboardSettingsPage';
import StatusBar from './components/common/StatusBar';
import api from './services/api';
import { decryptPrivateKey } from './utils/crypto';

function App() {
  const dispatch = useDispatch();
  const location = useLocation();
  const {
    token, user, userLoaded, isMasterVerified,
    sessionMasterPassword, sessionRsaPublicKey, sessionRsaPrivateKey,
    sessionWarningOpen, sessionWarningSeconds,
  } = useSelector((state) => state.auth);
  const { mode } = useSelector((state) => state.theme);
  const [initDone, setInitDone] = useState(false);
  const [keysLoading, setKeysLoading] = useState(false);
  const lockVault = useLockVault();

  useInactivityLogout();
  useKeyboardShortcuts();

  useEffect(() => {
    (async () => {
      // Attempt silent restore of encrypted session from sessionStorage:
      try {
        const restored = await restoreEncryptedSession();
        if (restored) {
          if (restored.sessionMasterPassword) {
            dispatch(setSessionMasterPassword(restored.sessionMasterPassword));
            dispatch(setMasterVerified(true));
          }
          if (restored.rsaPrivateKey) {
            dispatch(setSessionRsaPrivateKey(restored.rsaPrivateKey));
          }
          if (restored.rsaPublicKey) {
            dispatch(setSessionRsaPublicKey(restored.rsaPublicKey));
          }
        }
      } catch {
        // ignore
      }

      if (token) {
        // Access token present — refresh the profile if we haven't loaded it.
        if (!userLoaded) {
          try {
            await dispatch(fetchMe()).unwrap();
          } catch {
            // expired/revoked token; the interceptor will have tried to refresh
          }
        }
        setInitDone(true);
        return;
      }

      // No stored access token — attempt a silent restore from the httpOnly
      // refresh cookie (server-side session). The readable `vaultix_session`
      // hint cookie tells us a session may exist, so anonymous visitors don't
      // trigger a doomed refresh request (and a 401 in the console).
      const hasSessionHint = document.cookie
        .split(';')
        .some((c) => c.trim().startsWith('vaultix_session='));
      if (hasSessionHint) {
        try {
          await dispatch(refreshSession()).unwrap();
        } catch {
          // no valid session cookie — user must sign in
        }
      }
      setInitDone(true);
    })();
  }, []);

  useEffect(() => {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  const isMasterPage = ['/enter-master-password', '/set-master-password', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/forgot-master-password'].includes(location.pathname);

  useEffect(() => {
    if (!initDone || !token || !isMasterVerified || isMasterPage || keysLoading) return;
    if (sessionRsaPublicKey && sessionRsaPrivateKey) return;

    if (!sessionMasterPassword) {
      dispatch(lockVaultAction());
      return;
    }

    let cancelled = false;
    setKeysLoading(true);

    (async () => {
      try {
        const kpRes = await api.get('/keypair');
        if (cancelled) return;
        if (kpRes.data?.encryptedPrivateKey) {
          const privateKeyJwk = await decryptPrivateKey(
            kpRes.data.encryptedPrivateKey,
            sessionMasterPassword,
            kpRes.data.salt
          );
          if (cancelled) return;
          dispatch(setSessionRsaPrivateKey(privateKeyJwk));
          if (kpRes.data.publicKey) {
            dispatch(setSessionRsaPublicKey(kpRes.data.publicKey));
          }
        }
      } catch (err) {
        console.error('Failed to load encryption keys:', err);
        if (!cancelled) {
          dispatch(lockVaultAction());
        }
      } finally {
        if (!cancelled) setKeysLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [initDone, token, isMasterVerified, isMasterPage, sessionRsaPublicKey, sessionRsaPrivateKey, sessionMasterPassword, dispatch, keysLoading]);

  if (!initDone) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-muted)] font-medium">Loading Vaultix...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <StatusBar />
      <SessionWarningModal
        open={sessionWarningOpen}
        secondsLeft={sessionWarningSeconds}
        onExtend={() => {
          touchActivity();
          dispatch(dismissSessionWarning());
        }}
        onLock={() => lockVault()}
      />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/forgot-master-password" element={<ForgotMasterPasswordPage />} />

      <Route
        path="/set-master-password"
        element={
          <ProtectedRoute>
            <SetMasterPasswordPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/enter-master-password"
        element={
          <ProtectedRoute>
            <EnterMasterPasswordPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={
          <MasterProtectedRoute>
            <DashboardPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/my-vault"
        element={
          <MasterProtectedRoute>
            <MyVaultPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/shared-with-me"
        element={
          <MasterProtectedRoute>
            <SharedWithMePage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/vaults/:slug"
        element={
          <MasterProtectedRoute>
            <VaultPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/activity-log"
        element={
          <MasterProtectedRoute>
            <ActivityLogPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <MasterProtectedRoute>
            <ProfilePage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/security/2fa"
        element={
          <MasterProtectedRoute>
            <TwoFactorSettingsPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/security/vault-timeout"
        element={
          <MasterProtectedRoute>
            <VaultTimeoutSettingsPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/security/password-health"
        element={
          <MasterProtectedRoute>
            <PasswordHealthPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/security/sessions"
        element={
          <MasterProtectedRoute>
            <SessionsPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/security/clipboard"
        element={
          <MasterProtectedRoute>
            <ClipboardSettingsPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/team-management"
        element={
          <MasterProtectedRoute>
            <TeamManagementPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/team-management/invite"
        element={
          <MasterProtectedRoute>
            <InviteUserPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/team-management/edit/:id"
        element={
          <MasterProtectedRoute>
            <EditUserPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/departments"
        element={
          <MasterProtectedRoute>
            <DepartmentsPage />
          </MasterProtectedRoute>
        }
      />

      <Route
        path="/my-departments"
        element={
          <MasterProtectedRoute>
            <MyDepartmentsPage />
          </MasterProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default App;