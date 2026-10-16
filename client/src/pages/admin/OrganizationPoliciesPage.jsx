import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import {
  ShieldCheck,
  Smartphone,
  Clock,
  KeyRound,
  Clipboard,
  Save,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Building2,
  Lock,
  UserCheck,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import api from '../../services/api';
import { isSuperAdmin } from '../../utils/roles';
import { showToast } from '../../utils/toast';

const TIMEOUT_OPTIONS = [
  { value: null, label: 'No Limit (User Choice)' },
  { value: 15, label: '15 Minutes (Strict)' },
  { value: 30, label: '30 Minutes (Recommended)' },
  { value: 60, label: '1 Hour (Standard)' },
  { value: 120, label: '2 Hours (Relaxed)' },
];

const PASSWORD_LENGTH_OPTIONS = [
  { value: 8, label: '8 Characters (Standard)' },
  { value: 10, label: '10 Characters (Good)' },
  { value: 12, label: '12 Characters (Recommended)' },
  { value: 14, label: '14 Characters (High Security)' },
  { value: 16, label: '16 Characters (Maximum Defense)' },
];

const CLIPBOARD_OPTIONS = [
  { value: null, label: 'No Limit (User Choice)' },
  { value: 15, label: '15 Seconds (Strict)' },
  { value: 30, label: '30 Seconds (Recommended)' },
  { value: 60, label: '60 Seconds (Standard)' },
];

function OrganizationPoliciesPage() {
  const { user, token } = useSelector((state) => state.auth);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Initial loaded policy
  const [originalPolicy, setOriginalPolicy] = useState(null);

  // Form state
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [maxVaultTimeoutMinutes, setMaxVaultTimeoutMinutes] = useState(null);
  const [minMasterPasswordLength, setMinMasterPasswordLength] = useState(8);
  const [requireMasterPasswordSpecial, setRequireMasterPasswordSpecial] = useState(true);
  const [clipboardTimeoutSeconds, setClipboardTimeoutSeconds] = useState(null);
  const [requireDualAdminApproval, setRequireDualAdminApproval] = useState(true);

  const [updatedAt, setUpdatedAt] = useState(null);
  const [updatedBy, setUpdatedBy] = useState(null);

  useEffect(() => {
    if (!isSuperAdmin(user)) return;

    let cancelled = false;
    const fetchPolicy = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const res = await api.get('/organization-policy', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;
        const p = res.data?.policy || res.data;
        setOriginalPolicy(p);
        setRequireTwoFactor(Boolean(p.requireTwoFactor));
        setMaxVaultTimeoutMinutes(p.maxVaultTimeoutMinutes ?? null);
        setMinMasterPasswordLength(p.minMasterPasswordLength ?? 8);
        setRequireMasterPasswordSpecial(p.requireMasterPasswordSpecial !== false);
        setClipboardTimeoutSeconds(p.clipboardTimeoutSeconds ?? null);
        setRequireDualAdminApproval(p.requireDualAdminApproval !== false);
        setUpdatedAt(p.updatedAt);
        setUpdatedBy(p.updatedBy);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err.response?.data?.message || 'Failed to load organization policy');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPolicy();
    return () => {
      cancelled = true;
    };
  }, [user, token]);

  if (!isSuperAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const isDirty = originalPolicy && (
    requireTwoFactor !== Boolean(originalPolicy.requireTwoFactor) ||
    maxVaultTimeoutMinutes !== (originalPolicy.maxVaultTimeoutMinutes ?? null) ||
    minMasterPasswordLength !== (originalPolicy.minMasterPasswordLength ?? 8) ||
    requireMasterPasswordSpecial !== (originalPolicy.requireMasterPasswordSpecial !== false) ||
    clipboardTimeoutSeconds !== (originalPolicy.clipboardTimeoutSeconds ?? null) ||
    requireDualAdminApproval !== (originalPolicy.requireDualAdminApproval !== false)
  );

  const handleReset = () => {
    if (!originalPolicy) return;
    setRequireTwoFactor(Boolean(originalPolicy.requireTwoFactor));
    setMaxVaultTimeoutMinutes(originalPolicy.maxVaultTimeoutMinutes ?? null);
    setMinMasterPasswordLength(originalPolicy.minMasterPasswordLength ?? 8);
    setRequireMasterPasswordSpecial(originalPolicy.requireMasterPasswordSpecial !== false);
    setClipboardTimeoutSeconds(originalPolicy.clipboardTimeoutSeconds ?? null);
    setRequireDualAdminApproval(originalPolicy.requireDualAdminApproval !== false);
    setSuccessMessage('');
    setErrorMessage('');
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const payload = {
        requireTwoFactor,
        maxVaultTimeoutMinutes,
        minMasterPasswordLength,
        requireMasterPasswordSpecial,
        clipboardTimeoutSeconds,
        requireDualAdminApproval,
      };

      const res = await api.put('/organization-policy', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const updated = res.data.policy;
      setOriginalPolicy(updated);
      setUpdatedAt(updated.updatedAt);
      setUpdatedBy(updated.updatedBy);
      setSuccessMessage('Organization security policies updated successfully. Enforcement is active immediately.');
      showToast('Organization security policies saved');
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to update organization security policies');
      showToast(err.response?.data?.message || 'Failed to update policies', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-6 pb-12">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <ShieldCheck size={26} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                    Organization Security Policies
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    <Building2 size={12} /> Enterprise
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Enforce baseline security standards for all employees, vaults, and account credentials
                </p>
              </div>
            </div>

            {updatedAt && (
              <div className="text-left sm:text-right text-xs text-slate-500 dark:text-slate-400 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-700">
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  Last updated {new Date(updatedAt).toLocaleDateString()}
                </p>
                {updatedBy && (
                  <p className="text-[11px] text-slate-400">
                    by {updatedBy.fullName || updatedBy.email}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400 flex items-center gap-3">
            <AlertTriangle size={18} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-3">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-500">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium">Loading organization security policies...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Policy 1: Mandatory 2FA */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                        Mandatory Two-Factor Authentication (2FA)
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          requireTwoFactor
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {requireTwoFactor ? 'Enforced' : 'Optional'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      Require all team members to set up 2FA (Authenticator App / TOTP or Backup Codes) before they can access shared company vaults and shared passwords.
                    </p>
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Lock size={13} className="text-slate-400" />
                      <span>Users without 2FA can still log in and access their personal vault, but company vaults remain blocked until 2FA is activated.</span>
                    </div>
                  </div>
                </div>

                <div className="sm:shrink-0 pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireTwoFactor}
                      onChange={(e) => setRequireTwoFactor(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Policy 2: Maximum Vault Idle Timeout */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Clock size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      Enforced Maximum Vault Idle Timeout
                    </h2>
                    {maxVaultTimeoutMinutes && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Max {maxVaultTimeoutMinutes}m
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Impose an organization-wide ceiling on how long vaults can remain unlocked during inactivity. Personal user settings that exceed this ceiling will be automatically clamped down.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 mt-4">
                    {TIMEOUT_OPTIONS.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setMaxVaultTimeoutMinutes(opt.value)}
                        className={`rounded-xl border px-3.5 py-3 text-xs sm:text-sm font-medium transition-all text-left sm:text-center ${
                          maxVaultTimeoutMinutes === opt.value
                            ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-200 dark:ring-amber-800'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Policy 3: Master Password Complexity & Minimum Length */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <KeyRound size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      Master Password Minimum Length
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Min {minMasterPasswordLength} Chars
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Set the minimum character length required for master passwords and accounts across all organization members.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-4">
                    {PASSWORD_LENGTH_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMinMasterPasswordLength(opt.value)}
                        className={`rounded-xl border px-3.5 py-3 text-xs sm:text-sm font-medium transition-all text-left sm:text-center ${
                          minMasterPasswordLength === opt.value
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-200 dark:ring-emerald-800'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Require Special Characters & Numbers
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Mandates uppercase, lowercase, numbers, and special symbols (!@#$%^&*...)
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requireMasterPasswordSpecial}
                        onChange={(e) => setRequireMasterPasswordSpecial(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Policy 4: Clipboard Auto-Clear Ceiling */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  <Clipboard size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      Enforced Clipboard Auto-Clear Timeout
                    </h2>
                    {clipboardTimeoutSeconds && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        Max {clipboardTimeoutSeconds}s
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    Set a maximum duration that copied sensitive passwords remain in employee clipboards before being purged.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
                    {CLIPBOARD_OPTIONS.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setClipboardTimeoutSeconds(opt.value)}
                        className={`rounded-xl border px-3.5 py-3 text-xs sm:text-sm font-medium transition-all text-left sm:text-center ${
                          clipboardTimeoutSeconds === opt.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-200 dark:ring-blue-800'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Policy 5: Dual-Admin Approval */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-sm transition hover:border-slate-300 dark:hover:border-slate-600">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                        Strict Super Admin Approval for Critical Operations
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          requireDualAdminApproval
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {requireDualAdminApproval ? 'Enforced' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      High-stakes administrative operations initiated by administrators (such as deleting an administrator account, company vault resources, or purging data) require explicit sign-off from a Super Admin.
                    </p>
                    <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Lock size={13} className="text-slate-400" />
                      <span>Administrators can initiate requests, but only Super Admins hold executive authority to authorize and execute them.</span>
                    </div>
                  </div>
                </div>

                <div className="sm:shrink-0 pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireDualAdminApproval}
                      onChange={(e) => setRequireDualAdminApproval(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="sticky bottom-4 z-20 rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {isDirty ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved policy modifications
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-400">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    All policies in sync with active database
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition"
                  >
                    <RotateCcw size={15} />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 sm:h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving Policies...' : 'Save Security Policies'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}

export default OrganizationPoliciesPage;
