import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import {
  Shield, KeyRound, AlertTriangle, Clock, Activity, LogIn,
  ExternalLink, Eye, ArrowRight, TrendingUp, Users, ShieldCheck,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import {
  fetchSecuritySummary, fetchPasswordActivity, fetchRecentPasswords,
  fetchLoginActivity, fetchRecentActivityLogs,
} from '../../features/dashboard/dashboardSlice';

const RANGE_OPTIONS = [
  { label: '7D', value: '7D' },
  { label: '30D', value: '30D' },
  { label: 'Month', value: 'THIS_MONTH' },
  { label: 'Last', value: 'LAST_MONTH' },
  { label: '6M', value: '6M' },
];

const ACTION_MAP = {
  CREATE_PASSWORD: { label: 'Password Created', icon: KeyRound, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  UPDATE_PASSWORD: { label: 'Password Updated', icon: KeyRound, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  DELETE_PASSWORD: { label: 'Password Deleted', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  VIEW_PASSWORD: { label: 'Password Viewed', icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  COPY_PASSWORD: { label: 'Password Copied', icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  CREATE_FOLDER: { label: 'Folder Created', icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  DELETE_FOLDER: { label: 'Folder Deleted', icon: Activity, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  SHARE_PASSWORD: { label: 'Password Shared', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  SHARE_FOLDER: { label: 'Folder Shared', icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  LOGIN: { label: 'Login', icon: LogIn, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  REGISTER: { label: 'Account Registered', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  CREATE_VAULT: { label: 'Vault Created', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
};

function getActionMeta(action) {
  return ACTION_MAP[action] || { label: action?.replaceAll('_', ' ') || 'Action', icon: Activity, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-700' };
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />;
}

function StatCard({ icon, label, value, subtext, gradient, valueColor, onClick }) {
  const IconEl = icon;
  return (
    <button
      onClick={onClick}
      className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-left overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 group min-w-0"
    >
      <div className={`absolute inset-0 opacity-[0.03] ${gradient}`} />
      <div className="flex items-center gap-3 mb-1.5">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${gradient} text-white shrink-0`}>
          <IconEl size={18} />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${valueColor || 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
      {subtext && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtext}</p>}
    </button>
  );
}

function LoadingSkeletonRow() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-30" />)}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="h-[480px] xl:col-span-2" />
        <Skeleton className="h-[480px]" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const vaults = useSelector((state) => state.vault?.vaults);
  const {
    totalPasswords, weakPasswords, oldPasswords, riskPasswords, securityScore,
    passwordTrend, recentPasswords, loginTotal, loginSuccess, loginFailed, loginBlocked,
    recentLogins, recentActivityLogs, summaryLoading, activityLoading, recentLoading,
    loginLoading, activityLogsLoading, error,
  } = useSelector((state) => state.dashboard);

  const [range, setRange] = useState('6M');
  const [vaultType, setVaultType] = useState(() => user?.role === 'ADMIN' ? 'COMPANY' : 'PERSONAL');

  useEffect(() => {
    dispatch(fetchSecuritySummary(vaultType));
    dispatch(fetchRecentPasswords(vaultType));
    dispatch(fetchLoginActivity());
    dispatch(fetchRecentActivityLogs());
  }, [dispatch, vaultType]);

  useEffect(() => {
    dispatch(fetchPasswordActivity({ range, vaultType }));
  }, [dispatch, range, vaultType]);

  const loading = summaryLoading || activityLoading || recentLoading;

  const scoreColor = securityScore >= 80 ? '#10b981' : securityScore >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = securityScore >= 80 ? 'Good' : securityScore >= 50 ? 'Needs Work' : 'Poor';

  const firstCompanyVaultSlug = vaults?.find((v) => v.type === 'COMPANY')?.slug;

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6 pb-8">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                  <Shield size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">Security Dashboard</h1>
                  <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
                    Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {user?.fullName?.split(' ')[0] || 'there'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {user?.role === 'ADMIN' && (
                <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-700 p-1">
                  {['COMPANY', 'PERSONAL'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setVaultType(type)}
                      className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                        vaultType === type ? 'bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {type === 'COMPANY' ? 'Company' : 'Personal'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vault context description */}
        <div className={`rounded-2xl border px-4 sm:px-5 py-3.5 sm:py-4 flex items-center gap-3 ${vaultType === 'COMPANY' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${vaultType === 'COMPANY' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <p className={`text-xs sm:text-sm font-semibold ${vaultType === 'COMPANY' ? 'text-indigo-900 dark:text-indigo-200' : 'text-emerald-900 dark:text-emerald-200'}`}>
              {vaultType === 'COMPANY' ? 'Company Vault Dashboard' : 'Personal Vault Dashboard'}
            </p>
            <p className={`text-xs mt-0.5 ${vaultType === 'COMPANY' ? 'text-indigo-700 dark:text-indigo-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {vaultType === 'COMPANY'
                ? 'Showing organization-wide analytics — shared passwords, team activity, and overall security health for your Company Vault.'
                : 'Showing private analytics — your personal passwords, weak/old/at-risk counts, and your own security score.'}
            </p>
          </div>
          <span className={`ml-auto hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${vaultType === 'COMPANY' ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700' : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700'}`}>
            <span className={`h-2 w-2 rounded-full ${vaultType === 'COMPANY' ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
            {vaultType === 'COMPANY' ? 'Company' : 'Personal'}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 sm:px-5 py-3 sm:py-4">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && !error && <LoadingSkeletonRow />}

        {/* Content */}
        {!loading && !error && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                icon={KeyRound} label="Total Passwords" value={totalPasswords || 0}
                subtext={vaultType === 'COMPANY' ? 'Company vault' : 'Personal vault'}
                gradient="bg-gradient-to-br from-indigo-500 to-purple-600"
                valueColor="text-indigo-600"
                onClick={() => vaultType === 'COMPANY' && firstCompanyVaultSlug ? navigate(`/vaults/${firstCompanyVaultSlug}`) : navigate('/my-vault')}
              />
              <StatCard
                icon={AlertTriangle} label="Weak Passwords" value={weakPasswords || 0}
                subtext={totalPasswords > 0 ? `${Math.round((weakPasswords / totalPasswords) * 100)}% of total` : 'No data'}
                gradient="bg-gradient-to-br from-amber-500 to-orange-600"
                valueColor="text-amber-600"
                onClick={() => navigate('/security/password-health')}
              />
              <StatCard
                icon={Clock} label="Old Passwords" value={oldPasswords || 0}
                subtext={totalPasswords > 0 ? `${Math.round((oldPasswords / totalPasswords) * 100)}% of total` : 'No data'}
                gradient="bg-gradient-to-br from-orange-500 to-red-500"
                valueColor="text-orange-600"
                onClick={() => navigate('/security/password-health')}
              />
              <StatCard
                icon={Shield} label="At Risk" value={riskPasswords || 0}
                subtext={totalPasswords > 0 ? `${Math.round((riskPasswords / totalPasswords) * 100)}% of total` : 'No data'}
                gradient="bg-gradient-to-br from-red-500 to-rose-600"
                valueColor="text-red-600"
                onClick={() => navigate('/security/password-health')}
              />
            </div>

            {/* Charts Row — taller and more spacious */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 sm:gap-6">
              {/* Password Activity Chart */}
              <div className="xl:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-indigo-600" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Password Activity</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {RANGE_OPTIONS.map((item) => (
                      <button
                        key={item.value}
                        onClick={() => setRange(item.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                          range === item.value ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chart summary stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-4 py-3">
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">Total Added</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                      {passwordTrend?.reduce((sum, d) => sum + (d.added || 0), 0) || 0}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800 px-4 py-3">
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-0.5">Total Deleted</p>
                    <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                      {passwordTrend?.reduce((sum, d) => sum + (d.deleted || 0), 0) || 0}
                    </p>
                  </div>
                </div>

                <div className="h-[340px]">
                  {passwordTrend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={passwordTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          dy={8}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          width={36}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-primary)',
                            color: 'var(--text-primary)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            fontSize: '13px',
                          }}
                          labelStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '16px', color: 'var(--text-secondary)' }} />
                        <Line
                          type="monotone"
                          dataKey="added"
                          name="Added"
                          stroke="#10b981"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                          activeDot={{ r: 7 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="deleted"
                          name="Deleted"
                          stroke="#f43f5e"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#f43f5e', strokeWidth: 0 }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                      <TrendingUp size={36} className="text-slate-200 dark:text-slate-600" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">No password activity in this period</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Security Score */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-w-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Security Score</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Overall vault health</p>
                  </div>
                  <button
                    onClick={() => navigate('/security/password-health')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Full Report →
                  </button>
                </div>

                {/* Large radial chart */}
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="w-full" style={{ height: '280px' }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadialBarChart
                        cx="50%"
                        cy="50%"
                        innerRadius="58%"
                        outerRadius="88%"
                        barSize={18}
                        data={[{ name: 'Score', value: securityScore, fill: scoreColor }]}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                        <RadialBar background={{ fill: 'var(--bg-skeleton)' }} dataKey="value" cornerRadius={20} />
                        <text
                          x="50%" y="43%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={scoreColor}
                          style={{ fontSize: '48px', fontWeight: 700 }}
                        >
                          {securityScore}
                        </text>
                        <text
                          x="50%" y="57%"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill={scoreColor}
                          style={{ fontSize: '16px', fontWeight: 600 }}
                        >
                          {scoreLabel}
                        </text>
                      </RadialBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-auto">
                  {[
                    { label: 'Weak', value: weakPasswords, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' },
                    { label: 'Old', value: oldPasswords, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
                    { label: 'At Risk', value: riskPasswords, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-xl border ${s.bg} p-2.5 sm:p-3 text-center`}>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
                      <p className={`font-bold text-xl sm:text-2xl ${s.color}`}>{s.value || 0}</p>
                      {totalPasswords > 0 && (
                        <p className={`text-[11px] sm:text-xs mt-0.5 ${s.color} opacity-75`}>
                          {Math.round(((s.value || 0) / totalPasswords) * 100)}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Login Activity + Quick Actions + Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
              {/* Login Activity */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <LogIn size={16} className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Login Activity</h3>
                </div>
                {loginLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                      <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-2.5 sm:p-3 text-center">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Success</p>
                        <p className="text-xl sm:text-2xl font-bold text-emerald-700 dark:text-emerald-300">{loginSuccess || 0}</p>
                      </div>
                      <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-2.5 sm:p-3 text-center">
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">Failed</p>
                        <p className="text-xl sm:text-2xl font-bold text-red-700 dark:text-red-300">{loginFailed || 0}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-2.5 sm:p-3 text-center">
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Blocked</p>
                        <p className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-200">{loginBlocked || 0}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Total: {loginTotal || 0} attempts</p>
                    {recentLogins?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Recent</p>
                        {recentLogins.slice(0, 3).map((log) => (
                          <div key={log.id} className="flex items-center gap-2.5 text-xs">
                            <div className={`h-2 w-2 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : log.status === 'FAILED' ? 'bg-red-500' : 'bg-slate-400'}`} />
                            <span className="text-slate-700 dark:text-slate-300 font-medium capitalize">{log.status.toLowerCase()}</span>
                            <span className="text-slate-400 dark:text-slate-500 ml-auto">{formatTimeAgo(log.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Quick Actions */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <ExternalLink size={16} className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Quick Actions</h3>
                </div>
                <div className="space-y-3">
                  <button onClick={() => navigate('/my-vault')} className="w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition group text-left">
                    <div className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800/50 transition shrink-0">
                      <KeyRound size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Go to My Vault</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Manage your passwords</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-indigo-600 transition shrink-0" />
                  </button>
                  <button onClick={() => navigate('/activity-log')} className="w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-600 hover:bg-amber-50/40 dark:hover:bg-amber-900/20 transition group text-left">
                    <div className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center group-hover:bg-amber-200 dark:group-hover:bg-amber-800/50 transition shrink-0">
                      <Activity size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">View Activity Log</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Audit trail of all actions</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-amber-600 transition shrink-0" />
                  </button>
                  <button onClick={() => navigate('/security/password-health')} className="w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/20 transition group text-left">
                    <div className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/50 transition shrink-0">
                      <ShieldCheck size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Password Health</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Strength analysis & recommendations</p>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 transition shrink-0" />
                  </button>
                  {user?.role === 'ADMIN' && (
                    <>
                      <button onClick={() => firstCompanyVaultSlug ? navigate(`/vaults/${firstCompanyVaultSlug}`) : null} className="w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/20 transition group text-left">
                        <div className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/50 transition shrink-0">
                          <Shield size={18} className="text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Company Vault</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Manage company passwords</p>
                        </div>
                        <ArrowRight size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-emerald-600 transition shrink-0" />
                      </button>
                      <button onClick={() => navigate('/team-management')} className="w-full flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/40 dark:hover:bg-purple-900/20 transition group text-left">
                        <div className="h-9 sm:h-10 w-9 sm:w-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/50 transition shrink-0">
                          <Users size={18} className="text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Team Management</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Manage users & invitations</p>
                        </div>
                        <ArrowRight size={16} className="text-slate-400 dark:text-slate-500 group-hover:text-purple-600 transition shrink-0" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 min-w-0">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recent Activity</h3>
                </div>
                {activityLogsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : recentActivityLogs?.length > 0 ? (
                  <div className="space-y-3">
                    {recentActivityLogs.map((log) => {
                      const meta = getActionMeta(log.action);
                      const Icon = meta.icon;
                      return (
                        <div key={log.id} className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                            <Icon size={14} className={meta.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{meta.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {log.metadata?.name || log.targetId || ''}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                              {log.user?.fullName || 'Unknown'} · {formatTimeAgo(log.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <button onClick={() => navigate('/activity-log')} className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 pt-2">
                      View all activity →
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Activity size={24} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Passwords Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl overflow-hidden min-w-0">
              <div className="p-4 sm:p-6 pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound size={16} className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recent Passwords</h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-4">Latest passwords in your {vaultType === 'COMPANY' ? 'company' : 'personal'} vault</p>
              </div>
              {recentLoading ? (
                <div className="p-4 sm:p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : recentPasswords?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px]">
                    <thead>
                      <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50">
                        <th className="text-left px-4 sm:px-6 py-3 sm:py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
                        <th className="text-left px-4 sm:px-6 py-3 sm:py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Login</th>
                        <th className="text-left px-4 sm:px-6 py-3 sm:py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vault</th>
                        <th className="text-center px-4 sm:px-6 py-3 sm:py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Weak</th>
                        <th className="text-center px-4 sm:px-6 py-3 sm:py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Old</th>
                        <th className="text-center px-4 sm:px-6 py-3 sm:py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Risk</th>
                        <th className="text-right px-4 sm:px-6 py-3 sm:py-3.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {recentPasswords.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                          <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                            <span className="font-medium text-slate-900 dark:text-slate-100 text-sm">{row.name}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">{row.login}</td>
                          <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                              {row.vault?.name || '-'}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              row.isWeak ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            }`}>{row.isWeak ? 'Yes' : 'No'}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              row.isOld ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            }`}>{row.isOld ? 'Yes' : 'No'}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              row.isAtRisk ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            }`}>{row.isAtRisk ? 'Yes' : 'No'}</span>
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-right text-xs text-slate-400 dark:text-slate-500">{formatTimeAgo(row.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 px-6">
                  <KeyRound size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No passwords found</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Add passwords to see them here</p>
                </div>
              )}
              {recentPasswords?.length > 0 && (
                <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 text-right">
                  <button onClick={() => navigate('/my-vault')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    View all passwords →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

export default DashboardPage;