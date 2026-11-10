import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Copy, Check, RefreshCw, X, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

export default function MobileTwoFactorSheet({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true);
  const [totpStatus, setTotpStatus] = useState({ enabled: false });
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [password, setPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/2fa/totp/status');
      setTotpStatus(res.data);
    } catch {
      setError('Failed to load 2FA status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      setQrCode('');
      setSecret('');
      setTotpCode('');
      setPassword('');
      setBackupCodes([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartSetup = async () => {
    setBusy(true);
    setError('');
    hapticMedium();
    try {
      const res = await api.post('/2fa/totp/setup');
      setQrCode(res.data.qrCode);
      setSecret(res.data.secret);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start TOTP setup.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyEnable = async (e) => {
    e?.preventDefault();
    if (!totpCode || !password) {
      setError('Please provide your 6-digit code and account password.');
      return;
    }

    setBusy(true);
    setError('');
    hapticMedium();
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
      hapticSuccess();
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Check your code & password.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisableTOTP = async () => {
    if (!password) {
      setError('Enter your password to disable 2FA.');
      return;
    }

    const confirmDisable = window.confirm('Are you sure you want to disable Two-Factor Authentication?');
    if (!confirmDisable) return;

    setBusy(true);
    setError('');
    hapticMedium();
    try {
      await api.post('/2fa/totp/disable', { password });
      setPassword('');
      hapticSuccess();
      await loadStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not disable 2FA.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[88%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <KeyRound size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Two-Factor Authentication</h2>
              <p className="text-[10px] text-slate-400">TOTP Authenticator Apps (Google/Authy)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-indigo-500" />
              <span>Checking 2FA status...</span>
            </div>
          ) : totpStatus.enabled ? (
            /* 2FA IS ACTIVE */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
                <ShieldCheck size={28} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">2FA is Currently Active</h4>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Your account is secured with a TOTP authenticator.</p>
                </div>
              </div>

              {/* Disable Section */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Disable Two-Factor Authentication</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enter your current account password to disable 2FA security on mobile and web.
                </p>
                <input
                  type="password"
                  placeholder="Enter Account Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleDisableTOTP}
                  disabled={!password || busy}
                  className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs disabled:opacity-50 active:scale-98 transition"
                >
                  {busy ? 'Disabling...' : 'Disable 2FA Protection'}
                </button>
              </div>
            </div>
          ) : qrCode ? (
            /* SETUP IN PROGRESS: SHOW QR & VERIFY */
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Scan the QR code in Google Authenticator or 1Password, or enter the key manually:
                </p>
                <div className="p-3 bg-white rounded-2xl border border-slate-200 inline-block shadow-sm">
                  <img src={qrCode} alt="TOTP QR Code" className="w-44 h-44 mx-auto object-contain" />
                </div>
              </div>

              {/* Manual Secret Key */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Manual Setup Key</span>
                  <p className="text-xs font-mono font-bold text-slate-900 dark:text-white truncate select-all">{secret}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(secret);
                    setCopiedSecret(true);
                    setTimeout(() => setCopiedSecret(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-indigo-600 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1"
                >
                  {copiedSecret ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Verification Form */}
              <form onSubmit={handleVerifyEnable} className="space-y-2.5 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    6-Digit Authenticator Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.trim())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-base font-mono tracking-widest text-center text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Account Password (to confirm)
                  </label>
                  <input
                    type="password"
                    placeholder="Your account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={totpCode.length < 6 || !password || busy}
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20"
                >
                  {busy ? 'Verifying...' : 'Verify & Activate 2FA'}
                </button>
              </form>
            </div>
          ) : backupCodes.length > 0 ? (
            /* BACKUP CODES GENERATED */
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 text-xs space-y-1">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-200">Save Your Backup Codes</h4>
                <p className="text-indigo-700 dark:text-indigo-300 text-[11px]">
                  Store these one-time codes in a safe place. You will need them if you lose your phone or authenticator.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-center font-mono text-xs font-bold text-slate-900 dark:text-white">
                {backupCodes.map((code, idx) => (
                  <div key={idx} className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 select-all">
                    {code}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join('\n'));
                  setCopiedBackup(true);
                  setTimeout(() => setCopiedBackup(false), 2000);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-bold text-xs inline-flex items-center justify-center gap-1.5"
              >
                {copiedBackup ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedBackup ? 'All Codes Copied' : 'Copy All Backup Codes'}</span>
              </button>
            </div>
          ) : (
            /* 2FA NOT ENABLED: CALL TO ACTION */
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <KeyRound size={26} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Protect Your Account with 2FA</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  Add an extra layer of security. Whenever you sign in, you will be prompted for a 6-digit code from your authenticator app.
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartSetup}
                disabled={busy}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs active:scale-95 transition shadow-md shadow-indigo-600/20"
              >
                {busy ? 'Preparing...' : 'Set Up Authenticator App'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
