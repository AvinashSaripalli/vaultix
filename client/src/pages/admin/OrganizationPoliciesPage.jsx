import { useEffect, useState, useMemo } from 'react';
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
  Download,
  Sparkles,
  ShieldAlert,
  Layers,
  Check,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import api from '../../services/api';
import { isSuperAdmin } from '../../utils/roles';
import { showToast } from '../../utils/toast';

const TIMEOUT_OPTIONS = [
  { value: 15, label: '15m', fullLabel: '15 Min (Strict)' },
  { value: 30, label: '30m', fullLabel: '30 Min (Recommended)' },
  { value: 60, label: '1h', fullLabel: '1 Hour (Standard)' },
  { value: 120, label: '2h', fullLabel: '2 Hours (Relaxed)' },
  { value: null, label: 'None', fullLabel: 'No Limit' },
];

const PASSWORD_LENGTH_OPTIONS = [
  { value: 8, label: '8', fullLabel: '8 Chars (Standard)' },
  { value: 10, label: '10', fullLabel: '10 Chars (Good)' },
  { value: 12, label: '12', fullLabel: '12 Chars (Recommended)' },
  { value: 14, label: '14', fullLabel: '14 Chars (High Defense)' },
  { value: 16, label: '16+', fullLabel: '16+ Chars (Maximum)' },
];

const CLIPBOARD_OPTIONS = [
  { value: 15, label: '15s', fullLabel: '15 Seconds (Strict)' },
  { value: 30, label: '30s', fullLabel: '30 Seconds (Recommended)' },
  { value: 60, label: '60s', fullLabel: '60 Seconds (Standard)' },
  { value: null, label: 'None', fullLabel: 'No Limit' },
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
  const [maxVaultTimeoutMinutes, setMaxVaultTimeoutMinutes] = useState(30);
  const [minMasterPasswordLength, setMinMasterPasswordLength] = useState(8);
  const [requireMasterPasswordSpecial, setRequireMasterPasswordSpecial] = useState(true);
  const [clipboardTimeoutSeconds, setClipboardTimeoutSeconds] = useState(30);
  const [requireDualAdminApproval, setRequireDualAdminApproval] = useState(true);
  const [allowPersonalVaultExport, setAllowPersonalVaultExport] = useState(true);

  // Active Category Tab
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'auth' | 'session' | 'governance'

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
        setAllowPersonalVaultExport(p.allowPersonalVaultExport !== false);
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

  // Dynamic Security Posture Score (0 - 100%)
  const securityScore = useMemo(() => {
    let score = 0;
    if (requireTwoFactor) score += 25;
    if (minMasterPasswordLength >= 14) score += 20;
    else if (minMasterPasswordLength >= 12) score += 18;
    else if (minMasterPasswordLength >= 10) score += 14;
    else score += 10;
    if (requireMasterPasswordSpecial) score += 10;
    if (maxVaultTimeoutMinutes && maxVaultTimeoutMinutes <= 15) score += 15;
    else if (maxVaultTimeoutMinutes && maxVaultTimeoutMinutes <= 30) score += 12;
    else if (maxVaultTimeoutMinutes) score += 8;
    if (clipboardTimeoutSeconds && clipboardTimeoutSeconds <= 15) score += 10;
    else if (clipboardTimeoutSeconds && clipboardTimeoutSeconds <= 30) score += 8;
    else if (clipboardTimeoutSeconds) score += 5;
    if (requireDualAdminApproval) score += 20;
    return Math.min(100, score);
  }, [
    requireTwoFactor,
    minMasterPasswordLength,
    requireMasterPasswordSpecial,
    maxVaultTimeoutMinutes,
    clipboardTimeoutSeconds,
    requireDualAdminApproval,
  ]);

  const postureStatus = useMemo(() => {
    if (securityScore >= 85) {
      return {
        label: 'Strict Defense',
        badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        circleClass: 'text-emerald-500',
        stroke: '#10b981',
      };
    }
    if (securityScore >= 60) {
      return {
        label: 'Balanced Defense',
        badgeClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        circleClass: 'text-amber-500',
        stroke: '#f59e0b',
      };
    }
    return {
      label: 'Relaxed Posture',
      badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      circleClass: 'text-rose-500',
      stroke: '#f43f5e',
    };
  }, [securityScore]);

  // One-click security presets
  const applyPreset = (preset) => {
    if (preset === 'strict') {
      setRequireTwoFactor(true);
      setMinMasterPasswordLength(14);
      setRequireMasterPasswordSpecial(true);
      setMaxVaultTimeoutMinutes(15);
      setClipboardTimeoutSeconds(15);
      setRequireDualAdminApproval(true);
      setAllowPersonalVaultExport(false); // Strict DLP blocks personal exports
      showToast('Strict Compliance preset applied');
    } else if (preset === 'standard') {
      setRequireTwoFactor(true);
      setMinMasterPasswordLength(12);
      setRequireMasterPasswordSpecial(true);
      setMaxVaultTimeoutMinutes(30);
      setClipboardTimeoutSeconds(30);
      setRequireDualAdminApproval(true);
      setAllowPersonalVaultExport(true);
      showToast('Balanced Enterprise preset applied');
    } else if (preset === 'relaxed') {
      setRequireTwoFactor(false);
      setMinMasterPasswordLength(8);
      setRequireMasterPasswordSpecial(false);
      setMaxVaultTimeoutMinutes(60);
      setClipboardTimeoutSeconds(60);
      setRequireDualAdminApproval(false);
      setAllowPersonalVaultExport(true);
      showToast('Relaxed preset applied');
    }
  };

  if (!isSuperAdmin(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const isDirty = originalPolicy && (
    requireTwoFactor !== Boolean(originalPolicy.requireTwoFactor) ||
    maxVaultTimeoutMinutes !== (originalPolicy.maxVaultTimeoutMinutes ?? null) ||
    minMasterPasswordLength !== (originalPolicy.minMasterPasswordLength ?? 8) ||
    requireMasterPasswordSpecial !== (originalPolicy.requireMasterPasswordSpecial !== false) ||
    clipboardTimeoutSeconds !== (originalPolicy.clipboardTimeoutSeconds ?? null) ||
    requireDualAdminApproval !== (originalPolicy.requireDualAdminApproval !== false) ||
    allowPersonalVaultExport !== (originalPolicy.allowPersonalVaultExport !== false)
  );

  const handleReset = () => {
    if (!originalPolicy) return;
    setRequireTwoFactor(Boolean(originalPolicy.requireTwoFactor));
    setMaxVaultTimeoutMinutes(originalPolicy.maxVaultTimeoutMinutes ?? null);
    setMinMasterPasswordLength(originalPolicy.minMasterPasswordLength ?? 8);
    setRequireMasterPasswordSpecial(originalPolicy.requireMasterPasswordSpecial !== false);
    setClipboardTimeoutSeconds(originalPolicy.clipboardTimeoutSeconds ?? null);
    setRequireDualAdminApproval(originalPolicy.requireDualAdminApproval !== false);
    setAllowPersonalVaultExport(originalPolicy.allowPersonalVaultExport !== false);
    setSuccessMessage('');
    setErrorMessage('');
    showToast('Policies reset to active database state');
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
        allowPersonalVaultExport,
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

  // Circular progress math (r=18, circumference = 2 * pi * 18 = 113.1)
  const circumference = 113.1;
  const strokeDashoffset = circumference - (securityScore / 100) * circumference;

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-6 pb-20">
        
        {/* Hero Header & Security Posture Meter */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 sm:p-7 shadow-sm backdrop-blur-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            
            {/* Title & Metadata */}
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
                <ShieldCheck size={26} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Organization Security Policies
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <Building2 size={12} /> Enterprise
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    SOC 2 / ISO 27001
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Enforce cryptographic, access, and governance baselines across all employee accounts and shared vaults.
                </p>
                {updatedAt && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5">
                    Last updated {new Date(updatedAt).toLocaleDateString()} {updatedBy ? `by ${updatedBy.fullName || updatedBy.email}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Scorecard & 1-Click Presets */}
            <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 shrink-0">
              
              {/* Security Posture Radial Score */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl px-4 py-2.5">
                <div className="relative flex items-center justify-center">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      className="text-slate-200 dark:text-slate-700"
                      fill="transparent"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      className={`${postureStatus.circleClass} transition-all duration-700`}
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-xs font-black text-slate-900 dark:text-white">
                    {securityScore}%
                  </span>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-400">
                    Security Posture
                  </div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {postureStatus.label}
                  </div>
                </div>
              </div>

              {/* Presets Segment */}
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-1 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyPreset('strict')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-2xs hover:shadow-xs"
                  title="Enforce 2FA, 14-char Master Password, 15m idle lock, 15s clipboard, Super Admin dual approval, and block personal export"
                >
                  Strict
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('standard')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition bg-indigo-600 text-white shadow-sm"
                  title="Balanced enterprise baseline recommended for daily work"
                >
                  Balanced
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('relaxed')}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-2xs hover:shadow-xs"
                  title="Permissive configuration for testing and sandbox environments"
                >
                  Relaxed
                </button>
              </div>

            </div>
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

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            All Policies (6)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('auth')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'auth'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Access & Authentication (2)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('session')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'session'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Session & DLP (3)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('governance')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 ${
              activeTab === 'governance'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Governance & Approvals (1)
          </button>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-500">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="mt-3 text-sm font-medium">Loading organization security policies...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* 2-Column Responsive Policy Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Policy 1: Mandatory 2FA */}
              {(activeTab === 'all' || activeTab === 'auth') && (
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                          <Smartphone size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              Mandatory 2FA
                            </h2>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                requireTwoFactor
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {requireTwoFactor ? 'Enforced' : 'Optional'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">TOTP Authenticator & FIDO2 Security Keys</p>
                        </div>
                      </div>

                      {/* Custom Toggle Switch */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={requireTwoFactor}
                          onChange={(e) => setRequireTwoFactor(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      Requires all team members to enroll in 2FA before unlocking shared corporate credentials and company vaults.
                    </p>

                    <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-750 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <Lock size={13} className="text-purple-500 shrink-0 mt-0.5" />
                      <span>Users without 2FA can access personal items, but company vaults remain locked.</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target: All Team Accounts</span>
                    <span className="font-semibold text-purple-600 dark:text-purple-400">Zero-Trust Access</span>
                  </div>
                </div>
              )}

              {/* Policy 2: Master Password Complexity & Length */}
              {(activeTab === 'all' || activeTab === 'auth') && (
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <KeyRound size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              Master Password Length
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Min {minMasterPasswordLength} Chars
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">PBKDF2 Client-Side Derivation</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      Enforces high-entropy character minimums across all member accounts during creation or rotation.
                    </p>

                    {/* Segmented Selector for Length */}
                    <div className="mt-3.5 grid grid-cols-5 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                      {PASSWORD_LENGTH_OPTIONS.map((opt) => {
                        const isSelected = minMasterPasswordLength === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setMinMasterPasswordLength(opt.value)}
                            className={`py-1.5 text-xs font-bold rounded-xl transition-all ${
                              isSelected
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title={opt.fullLabel}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Special Symbols Toggle */}
                    <div className="mt-3 flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-750">
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          Require Symbols & Numbers
                        </p>
                        <p className="text-[10px] text-slate-400">Mandates uppercase, numbers, and !@#$%^&*</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={requireMasterPasswordSpecial}
                          onChange={(e) => setRequireMasterPasswordSpecial(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target: Master Password Derivation</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">NIST 800-63B</span>
                  </div>
                </div>
              )}

              {/* Policy 3: Vault Idle Timeout Ceiling */}
              {(activeTab === 'all' || activeTab === 'session') && (
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <Clock size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              Vault Idle Timeout
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {maxVaultTimeoutMinutes ? `Max ${maxVaultTimeoutMinutes}m` : 'No Limit'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">Zero-Footprint Inactivity Auto-Lock</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      Imposes an organization ceiling on inactivity. Personal user preferences exceeding this duration are automatically clamped.
                    </p>

                    {/* Segmented Selector for Timeout */}
                    <div className="mt-3.5 grid grid-cols-5 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                      {TIMEOUT_OPTIONS.map((opt) => {
                        const isSelected = maxVaultTimeoutMinutes === opt.value;
                        return (
                          <button
                            key={String(opt.value)}
                            type="button"
                            onClick={() => setMaxVaultTimeoutMinutes(opt.value)}
                            className={`py-1.5 text-xs font-bold rounded-xl transition-all ${
                              isSelected
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title={opt.fullLabel}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-750 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <Lock size={13} className="text-amber-500 shrink-0 mt-0.5" />
                      <span>Purges cryptographic session keys from RAM upon idle timeout.</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target: Web & Mobile Workspaces</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">Anti-Shoulder Surfing</span>
                  </div>
                </div>
              )}

              {/* Policy 4: Clipboard Auto-Clear */}
              {(activeTab === 'all' || activeTab === 'session') && (
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Clipboard size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              Clipboard Auto-Clear
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {clipboardTimeoutSeconds ? `Max ${clipboardTimeoutSeconds}s` : 'No Limit'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">OS Clipboard Leak Prevention</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      Purges copied sensitive credentials from the operating system clipboard buffer to prevent snooping by untrusted background apps.
                    </p>

                    {/* Segmented Selector for Clipboard */}
                    <div className="mt-3.5 grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                      {CLIPBOARD_OPTIONS.map((opt) => {
                        const isSelected = clipboardTimeoutSeconds === opt.value;
                        return (
                          <button
                            key={String(opt.value)}
                            type="button"
                            onClick={() => setClipboardTimeoutSeconds(opt.value)}
                            className={`py-1.5 text-xs font-bold rounded-xl transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title={opt.fullLabel}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-750 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <CheckCircle2 size={13} className="text-blue-500 shrink-0 mt-0.5" />
                      <span>Zeroes memory buffer across Windows, macOS, Android, and iOS.</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target: Clipboard Buffer</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">Endpoint Protection</span>
                  </div>
                </div>
              )}

              {/* Policy 5: Strict Super Admin Approval (Governance) */}
              {(activeTab === 'all' || activeTab === 'governance') && (
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <UserCheck size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              Dual Super Admin Sign-off
                            </h2>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                requireDualAdminApproval
                                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {requireDualAdminApproval ? 'Enforced' : 'Disabled'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">Four-Eyes Administrative Approval</p>
                        </div>
                      </div>

                      {/* Custom Toggle Switch */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={requireDualAdminApproval}
                          onChange={(e) => setRequireDualAdminApproval(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      Destructive actions (purging company vaults, deleting admin accounts, or wiping logs) require explicit sign-off from a Super Admin.
                    </p>

                    <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-750 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <Lock size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                      <span>Prevents rogue administrator privilege escalation or accidental data loss.</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target: Admin Operations</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">Executive Sign-Off</span>
                  </div>
                </div>
              )}

              {/* Policy 6: Allow Personal Vault Export (DLP) */}
              {(activeTab === 'all' || activeTab === 'session') && (
                <div className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                          <Download size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                              Personal Vault Export
                            </h2>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                allowPersonalVaultExport
                                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              {allowPersonalVaultExport ? 'Permitted' : 'Blocked (DLP)'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">Data Loss Prevention & Offboarding</p>
                        </div>
                      </div>

                      {/* Custom Toggle Switch */}
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={allowPersonalVaultExport}
                          onChange={(e) => setAllowPersonalVaultExport(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-teal-600"></div>
                      </label>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                      Permits team members to export credentials stored in My Vault into CSV/Excel/JSON. If disabled, personal vault downloads are locked.
                    </p>

                    <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-750 flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <ShieldCheck size={14} className="text-teal-500 shrink-0 mt-0.5" />
                      <span>All export events verify Master Password and log item counts to the audit trail.</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Target: Personal Vaults</span>
                    <span className="font-semibold text-teal-600 dark:text-teal-400">Forensic Audit Log</span>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Actions Bar (Sticky Glassmorphic) */}
            <div className="sticky bottom-4 z-20 rounded-3xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                {isDirty ? (
                  <span className="inline-flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved policy modifications
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-slate-400 font-medium">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    All policies in sync with active database
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-2xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold transition shadow-xs"
                  >
                    <RotateCcw size={15} />
                    <span>Reset Changes</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={saving || !isDirty}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={16} />
                  <span>{saving ? 'Deploying Policies...' : 'Save & Deploy Policies'}</span>
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
