import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Smartphone, KeyRound, Copy, Check, RefreshCw } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import { startRegistration } from '@simplewebauthn/browser';
import { logoutUser } from '../../features/auth/authSlice';

function TwoFactorSettingsPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [status, setStatus] = useState('loading');
  const [totpStatus, setTotpStatus] = useState({ enabled: false });
  const [webauthnCreds, setWebauthnCreds] = useState([]);

  // TOTP setup state
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(-1);

  const loadStatus = async () => {
    try {
      const [totpRes, webauthnRes] = await Promise.all([
        api.get('/2fa/totp/status'),
        api.get('/2fa/webauthn/credentials'),
      ]);
      setTotpStatus(totpRes.data);
      setWebauthnCreds(webauthnRes.data?.credentials || []);
    } catch {
      setError('Failed to load 2FA status');
    } finally {
      setStatus('loaded');
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSetupTOTP = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/2fa/totp/setup');
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set up TOTP');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEnableTOTP = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/2fa/totp/verify-enable', {
        code: totpCode,
        password,
      });
      setBackupCodes(res.data.backupCodes || []);
      setQrCode('');
      setSecret('');
      setTotpCode('');
      setPassword('');
      setStatus('backup-codes');
      setMessage(res.data.message);
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to enable 2FA');
    } finally {
      setBusy(false);
    }
  };

  const handleDisableTOTP = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.post('/2fa/totp/disable', {
        password,
        code: totpCode || undefined,
      });
      setPassword('');
      setTotpCode('');
      setMessage('2FA disabled successfully');
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/2fa/totp/regenerate-backup-codes', { password });
      setBackupCodes(res.data.backupCodes || []);
      setStatus('backup-codes');
      setPassword('');
      setMessage('Backup codes regenerated successfully. Store them safely.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to regenerate backup codes');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterWebAuthn = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const beginRes = await api.post('/2fa/webauthn/register-begin');
      const { options, challenge } = beginRes.data;

      const attestation = await startRegistration(options);

      const finishRes = await api.post('/2fa/webauthn/register-finish', {
        response: attestation,
        challenge,
      });

      if (finishRes.data?.verified) {
        setMessage('Security key registered successfully');
        await loadStatus();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register security key');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveWebAuthn = async (credentialId) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.delete(`/2fa/webauthn/credentials/${credentialId}`);
      setMessage('Security key removed');
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove security key');
    } finally {
      setBusy(false);
    }
  };

  const copyBackupCode = (code, index) => {
    navigator.clipboard?.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(-1), 2000);
  };

  const inputClass = (field, errs) =>
    `w-full rounded-xl border bg-white dark:bg-slate-700 dark:text-slate-200 px-4 py-3 outline-none transition-all focus:ring-4 ${
      errs[field]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-200 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-100'
    }`;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 min-w-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-xl shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">Two-Factor Authentication</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1">Protect your account with an extra layer of security</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
            {message}
          </div>
        )}

        {/* TOTP Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-3 sm:gap-4 pb-5 border-b border-slate-100 dark:border-slate-700 flex-wrap sm:flex-nowrap">
            <Smartphone size={22} className="text-slate-400 dark:text-slate-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">Authenticator App</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Use an app like Google Authenticator, Authy, or 1Password</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${
              totpStatus.enabled
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              <ShieldCheck size={13} />
              {totpStatus.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Disable form */}
          {totpStatus.enabled && !qrCode && status !== 'backup-codes' && (
            <form onSubmit={handleDisableTOTP} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Account Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass('password', {})}
                  placeholder="Enter your account password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Current 2FA Code (optional)</label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className={inputClass('totpCode', {})}
                  placeholder="6-digit 2FA code"
                  inputMode="numeric"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-60 transition"
                >
                  <ShieldOff size={16} />
                  {busy ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </form>
          )}

          {/* Setup QR code */}
          {!totpStatus.enabled && qrCode && status !== 'backup-codes' && (
            <form onSubmit={handleVerifyEnableTOTP} className="mt-5 space-y-4">
              <div className="flex flex-col items-center gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-6">
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
                  Scan this QR code with your authenticator app
                </p>
                <img src={qrCode} alt="TOTP QR Code" className="w-56 h-56 rounded-lg" />
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  If you can't scan it, manually enter this secret:
                </p>
                <code className="text-xs bg-slate-100 dark:bg-slate-700 rounded px-3 py-1 font-mono break-all text-slate-600 dark:text-slate-300">
                  {secret}
                </code>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Verification Code</label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputClass('totpCode', {})} text-center tracking-[0.4em] font-mono`}
                  placeholder="6-digit code"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Account Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass('password', {})}
                  placeholder="Confirm your account password"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setQrCode(''); setSecret(''); }}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition"
                >
                  {busy ? 'Verifying...' : 'Enable 2FA'}
                </button>
              </div>
            </form>
          )}

          {/* No setup - show enable button */}
          {!totpStatus.enabled && !qrCode && status !== 'backup-codes' && (
            <div className="mt-5">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Enable two-factor authentication to add an extra layer of security to your account.
              </p>
              <button
                type="button"
                onClick={handleSetupTOTP}
                disabled={busy}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition"
              >
                <Smartphone size={16} />
                {busy ? 'Preparing...' : 'Set Up Authenticator'}
              </button>
            </div>
          )}

          {/* Backup codes display */}
          {status === 'backup-codes' && backupCodes.length > 0 && totpStatus.enabled && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 flex items-start gap-3">
                <KeyRound size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  <p className="font-semibold mb-1">Save these backup codes in a safe place</p>
                  <p>Each code can only be used once. If you lose your authenticator app, you can use these codes to log in.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {backupCodes.map((code, i) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => copyBackupCode(code, i)}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 font-mono text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <span>{code}</span>
                    {copiedIndex === i ? (
                      <Check size={14} className="text-emerald-500" />
                    ) : (
                      <Copy size={14} className="text-slate-400" />
                    )}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStatus('loaded')}
                className="w-full rounded-xl bg-slate-100 dark:bg-slate-700 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                Done - I've saved my codes
              </button>
            </div>
          )}

          {/* Regenerate backup codes */}
          {totpStatus.enabled && status !== 'backup-codes' && !qrCode && (
            <button
              type="button"
              onClick={handleRegenerateBackupCodes}
              className="mt-5 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-60"
              disabled={busy || !password}
            >
              <RefreshCw size={14} />
              Regenerate backup codes
            </button>
          )}
        </div>

        {/* WebAuthn Section */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 sm:p-6 lg:p-8">
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100 dark:border-slate-700">
            <KeyRound size={22} className="text-slate-400 dark:text-slate-500" />
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Security Keys</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Add hardware security keys (YubiKey, Google Titan, etc.)</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {webauthnCreds.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {cred.friendlyName || `Security Key (${cred.credentialId.slice(0, 8)}...)`}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Added {new Date(cred.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveWebAuthn(cred.credentialId)}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}

            {webauthnCreds.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No security keys registered yet. Add one for additional 2FA options.
              </p>
            )}

            <button
              type="button"
              onClick={handleRegisterWebAuthn}
              disabled={busy}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              <KeyRound size={16} />
              {busy ? 'Registering...' : 'Register Security Key'}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default TwoFactorSettingsPage;
