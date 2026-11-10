import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { User, Lock, KeyRound, ShieldAlert, Check, AlertTriangle, Eye, EyeOff, X, RefreshCw, Copy } from 'lucide-react';
import { updateProfile, changePassword, changeMasterPassword } from '../../features/auth/authSlice';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';
import api from '../../services/api';

export default function MobileProfileSheet({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'security' | 'recovery'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  // Profile Form
  const [fullName, setFullName] = useState(user?.fullName || '');

  // Account Password Form
  const [currentAccountPassword, setCurrentAccountPassword] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [confirmAccountPassword, setConfirmAccountPassword] = useState('');

  // Master Password Form
  const [currentMasterPassword, setCurrentMasterPassword] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');

  // Emergency Recovery Key
  const [recoveryKey, setRecoveryKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  const handleUpdateName = async (e) => {
    e?.preventDefault();
    if (!fullName.trim()) return;

    setSaving(true);
    setError('');
    setSuccess('');
    hapticMedium();

    try {
      const res = await dispatch(updateProfile({ fullName: fullName.trim() }));
      if (res.error) throw new Error(res.error.message || 'Failed to update name');
      hapticSuccess();
      setSuccess('Profile name updated successfully.');
    } catch (err) {
      setError(err.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeAccountPassword = async (e) => {
    e?.preventDefault();
    if (newAccountPassword !== confirmAccountPassword) {
      setError('New passwords do not match');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    hapticMedium();

    try {
      const res = await dispatch(changePassword({
        currentPassword: currentAccountPassword,
        newPassword: newAccountPassword,
      }));
      if (res.error) throw new Error(res.error.message || 'Failed to change password');
      hapticSuccess();
      setSuccess('Account password changed successfully.');
      setCurrentAccountPassword('');
      setNewAccountPassword('');
      setConfirmAccountPassword('');
    } catch (err) {
      setError(err.message || 'Password change failed');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeMasterPassword = async (e) => {
    e?.preventDefault();
    if (newMasterPassword !== confirmMasterPassword) {
      setError('New master passwords do not match');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    hapticMedium();

    try {
      const res = await dispatch(changeMasterPassword({
        currentMasterPassword,
        newMasterPassword,
      }));
      if (res.error) throw new Error(res.error.message || 'Failed to change master password');
      hapticSuccess();
      setSuccess('Master password changed and keys re-encrypted.');
      setCurrentMasterPassword('');
      setNewMasterPassword('');
      setConfirmMasterPassword('');
    } catch (err) {
      setError(err.message || 'Master password change failed');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateRecoveryKey = async () => {
    setSaving(true);
    setError('');
    hapticMedium();
    try {
      const res = await api.post('/recovery-key/generate');
      setRecoveryKey(res.data?.recoveryKey || '');
      hapticSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not generate recovery key');
    } finally {
      setSaving(false);
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
              <User size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">User Profile &amp; Security</h2>
              <p className="text-[10px] text-slate-400">{user?.email || 'Manage credentials & recovery'}</p>
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

        {/* Tab Switcher */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('info');
                setError('');
                setSuccess('');
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'info'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Info
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('security');
                setError('');
                setSuccess('');
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'security'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Passwords
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('recovery');
                setError('');
                setSuccess('');
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'recovery'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Recovery Key
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs">
              <Check size={15} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {activeTab === 'info' ? (
            /* PERSONAL INFO */
            <form onSubmit={handleUpdateName} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 opacity-80"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !fullName.trim()}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20"
              >
                {saving ? 'Updating...' : 'Save Profile Changes'}
              </button>
            </form>
          ) : activeTab === 'security' ? (
            /* PASSWORDS */
            <div className="space-y-5">
              {/* Change Account Password */}
              <form onSubmit={handleChangeAccountPassword} className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Change Account Password</span>
                <input
                  type="password"
                  placeholder="Current account password"
                  value={currentAccountPassword}
                  onChange={(e) => setCurrentAccountPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="password"
                  placeholder="New account password (min 8 chars)"
                  value={newAccountPassword}
                  onChange={(e) => setNewAccountPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="password"
                  placeholder="Confirm new account password"
                  value={confirmAccountPassword}
                  onChange={(e) => setConfirmAccountPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!currentAccountPassword || !newAccountPassword || saving}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs disabled:opacity-50"
                >
                  Update Account Password
                </button>
              </form>

              {/* Change Master Password */}
              <form onSubmit={handleChangeMasterPassword} className="space-y-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">Change Master Encryption Password</span>
                <p className="text-[10px] text-slate-400">Re-encrypts your zero-knowledge RSA private key</p>
                <input
                  type="password"
                  placeholder="Current master password"
                  value={currentMasterPassword}
                  onChange={(e) => setCurrentMasterPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="password"
                  placeholder="New master password"
                  value={newMasterPassword}
                  onChange={(e) => setNewMasterPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="password"
                  placeholder="Confirm new master password"
                  value={confirmMasterPassword}
                  onChange={(e) => setConfirmMasterPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={!currentMasterPassword || !newMasterPassword || saving}
                  className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-bold text-xs disabled:opacity-50"
                >
                  Re-Encrypt Vault &amp; Change Master Password
                </button>
              </form>
            </div>
          ) : (
            /* EMERGENCY RECOVERY KEY */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-xs space-y-1">
                <h4 className="font-bold text-amber-900 dark:text-amber-200">Emergency Recovery Key</h4>
                <p className="text-amber-700 dark:text-amber-300 text-[11px] leading-relaxed">
                  If you forget your master password, this 32-character key is the ONLY way to recover your encrypted vault. Vaultix zero-knowledge architecture means our servers cannot reset it for you.
                </p>
              </div>

              {recoveryKey ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Your Active Recovery Key</span>
                  <p className="text-sm font-mono font-bold tracking-wider text-slate-900 dark:text-white select-all break-all">
                    {recoveryKey}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(recoveryKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2000);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey ? 'Copied to Clipboard' : 'Copy Recovery Key'}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateRecoveryKey}
                  disabled={saving}
                  className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20"
                >
                  {saving ? 'Generating...' : 'View / Generate Emergency Recovery Key'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
