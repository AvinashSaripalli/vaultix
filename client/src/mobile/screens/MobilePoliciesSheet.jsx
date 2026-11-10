import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ShieldCheck, Lock, Smartphone, Clock, X, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import api from '../../services/api';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

export default function MobilePoliciesSheet({ isOpen, onClose }) {
  const { token, user } = useSelector((state) => state.auth);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Policy options
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [minMasterPasswordLength, setMinMasterPasswordLength] = useState(8);
  const [requireMasterPasswordSpecial, setRequireMasterPasswordSpecial] = useState(true);
  const [maxVaultTimeoutMinutes, setMaxVaultTimeoutMinutes] = useState(null);
  const [clipboardTimeoutSeconds, setClipboardTimeoutSeconds] = useState(null);
  const [requireDualAdminApproval, setRequireDualAdminApproval] = useState(true);

  const authHeaders = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/organization-policy', authHeaders);
      const data = res.data;
      if (data) {
        setRequireTwoFactor(Boolean(data.requireTwoFactor));
        setMinMasterPasswordLength(data.minMasterPasswordLength || 8);
        setRequireMasterPasswordSpecial(Boolean(data.requireMasterPasswordSpecial));
        setMaxVaultTimeoutMinutes(data.maxVaultTimeoutMinutes);
        setClipboardTimeoutSeconds(data.clipboardTimeoutSeconds);
        setRequireDualAdminApproval(Boolean(data.requireDualAdminApproval));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPolicy();
      setSuccess('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    hapticMedium();

    try {
      await api.put('/organization-policy', {
        requireTwoFactor,
        minMasterPasswordLength,
        requireMasterPasswordSpecial,
        maxVaultTimeoutMinutes,
        clipboardTimeoutSeconds,
        requireDualAdminApproval,
      }, authHeaders);
      hapticSuccess();
      setSuccess('Organization policies updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save policies');
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
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Organization Policies</h2>
              <p className="text-[10px] text-slate-400">Security enforcement for workspace members</p>
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

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-indigo-500" />
              <span>Loading organization policy...</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mandatory 2FA Toggle */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Enforce Two-Factor Authentication</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Require all members to enable TOTP 2FA</p>
                </div>
                <input
                  type="checkbox"
                  checked={requireTwoFactor}
                  onChange={(e) => setRequireTwoFactor(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {/* Min Master Password Length */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Min Master Password Length</h4>
                  <span className="text-xs font-mono font-bold text-indigo-600">{minMasterPasswordLength} chars</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="20"
                  step="2"
                  value={minMasterPasswordLength}
                  onChange={(e) => setMinMasterPasswordLength(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
              </div>

              {/* Require Special Characters */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Require Special Characters &amp; Numbers</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Strict entropy check for master passwords</p>
                </div>
                <input
                  type="checkbox"
                  checked={requireMasterPasswordSpecial}
                  onChange={(e) => setRequireMasterPasswordSpecial(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {/* Dual Admin Approval */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Dual Administrator Approval</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Require 2 admins to purge trash or delete folders</p>
                </div>
                <input
                  type="checkbox"
                  checked={requireDualAdminApproval}
                  onChange={(e) => setRequireDualAdminApproval(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {/* Max Vault Timeout */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">Max Allowed Vault Timeout</h4>
                <select
                  value={maxVaultTimeoutMinutes || ''}
                  onChange={(e) => setMaxVaultTimeoutMinutes(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                >
                  <option value="">No Limit (User Choice)</option>
                  <option value="15">15 Minutes (Strict)</option>
                  <option value="30">30 Minutes (Recommended)</option>
                  <option value="60">1 Hour (Standard)</option>
                  <option value="120">2 Hours (Relaxed)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20"
              >
                {saving ? 'Saving Policies...' : 'Save Organization Policy'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
