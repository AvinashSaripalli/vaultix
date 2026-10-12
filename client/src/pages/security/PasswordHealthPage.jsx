import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ShieldCheck, AlertTriangle, Clock, AlertOctagon, Eye, KeyRound,
  TrendingDown, Sparkles, RefreshCw, CheckCircle2, ExternalLink,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import { fetchPasswordHealth } from '../../features/passwordHealth/passwordHealthSlice';

const SEVERITY_STYLES = {
  critical: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: AlertOctagon, iconColor: 'text-red-600', titleColor: 'text-red-800 dark:text-red-200', descColor: 'text-red-600 dark:text-red-400' },
  high: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: AlertTriangle, iconColor: 'text-amber-600', titleColor: 'text-amber-800 dark:text-amber-200', descColor: 'text-amber-600 dark:text-amber-400' },
  medium: { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', icon: Clock, iconColor: 'text-orange-600', titleColor: 'text-orange-800 dark:text-orange-200', descColor: 'text-orange-600 dark:text-orange-400' },
  low: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: Eye, iconColor: 'text-blue-600', titleColor: 'text-blue-800 dark:text-blue-200', descColor: 'text-blue-600 dark:text-blue-400' },
};

const STRENGTH_COLORS = { weak: '#ef4444', medium: '#f59e0b', strong: '#10b981', unknown: '#94a3b8' };
const AGE_COLORS = { fresh: '#10b981', months3: '#3b82f6', months6: '#f59e0b', over6m: '#ef4444' };

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-xl ${className}`} />;
}

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function PasswordHealthPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    total, securityScore, weakCount, oldCount, atRiskCount, sensitiveCount,
    strengthDistribution, ageDistribution, weakPasswords, oldPasswords,
    atRiskPasswords, recommendations, loading, error,
  } = useSelector((state) => state.passwordHealth);

  const vaults = useSelector((state) => state.vault?.vaults);
  const firstCompanyVaultSlug = vaults?.find((v) => v.type === 'COMPANY')?.slug;

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    dispatch(fetchPasswordHealth());
  }, [dispatch]);

  const scoreColor = securityScore >= 80 ? '#10b981' : securityScore >= 50 ? '#f59e0b' : '#ef4444';
  const scoreLabel = securityScore >= 80 ? 'Good' : securityScore >= 50 ? 'Needs Work' : 'Poor';

  const strengthData = [
    { name: 'Weak', value: strengthDistribution.weak, color: STRENGTH_COLORS.weak },
    { name: 'Medium', value: strengthDistribution.medium, color: STRENGTH_COLORS.medium },
    { name: 'Strong', value: strengthDistribution.strong, color: STRENGTH_COLORS.strong },
    { name: 'Unknown', value: strengthDistribution.unknown, color: STRENGTH_COLORS.unknown },
  ].filter((d) => d.value > 0);

  const ageData = [
    { name: '< 1 month', value: ageDistribution.fresh, color: AGE_COLORS.fresh },
    { name: '1-3 months', value: ageDistribution.months3, color: AGE_COLORS.months3 },
    { name: '3-6 months', value: ageDistribution.months6, color: AGE_COLORS.months6 },
    { name: '> 6 months', value: ageDistribution.over6m, color: AGE_COLORS.over6m },
  ].filter((d) => d.value > 0);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'weak', label: `Weak (${weakCount})` },
    { key: 'old', label: `Old (${oldCount})` },
    { key: 'breach', label: `At Risk (${atRiskCount})` },
  ];

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-6 pb-8">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                <ShieldCheck size={22} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  Password Health
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
                  Monitor password strength, detect breaches, and get recommendations
                </p>
              </div>
            </div>
            <button
              onClick={() => dispatch(fetchPasswordHealth())}
              disabled={loading}
              className="h-9 sm:h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center justify-center gap-2 transition disabled:opacity-50 self-start sm:self-auto shrink-0 shadow-sm"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-4">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-[350px]" />
              <Skeleton className="h-[350px]" />
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-indigo-500 to-purple-600" />
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mb-2">
                  <KeyRound size={18} />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Passwords</p>
                <p className="text-2xl font-bold text-indigo-600 mt-0.5">{total}</p>
              </div>
              <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-amber-500 to-orange-600" />
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white mb-2">
                  <AlertTriangle size={18} />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Weak Passwords</p>
                <p className="text-2xl font-bold text-amber-600 mt-0.5">{weakCount}</p>
                {total > 0 && <p className="text-xs text-slate-400 mt-1">{Math.round((weakCount / total) * 100)}% of total</p>}
              </div>
              <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-orange-500 to-red-500" />
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-white mb-2">
                  <Clock size={18} />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Old Passwords</p>
                <p className="text-2xl font-bold text-orange-600 mt-0.5">{oldCount}</p>
                {total > 0 && <p className="text-xs text-slate-400 mt-1">{Math.round((oldCount / total) * 100)}% of total</p>}
              </div>
              <div className="relative rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] bg-gradient-to-br from-red-500 to-rose-600" />
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white mb-2">
                  <AlertOctagon size={18} />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">At Risk (Breaches)</p>
                <p className="text-2xl font-bold text-red-600 mt-0.5">{atRiskCount}</p>
                {total > 0 && <p className="text-xs text-slate-400 mt-1">{Math.round((atRiskCount / total) * 100)}% of total</p>}
              </div>
            </div>

            {/* Security Score + Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Security Score Gauge */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 flex flex-col">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Security Score</h3>
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-primary)" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="50" fill="none"
                        stroke={scoreColor}
                        strokeWidth="10"
                        strokeDasharray={`${(securityScore / 100) * 314.16} 314.16`}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold" style={{ color: scoreColor }}>{securityScore}</span>
                      <span className="text-sm font-medium" style={{ color: scoreColor }}>{scoreLabel}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Strength Distribution */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Strength Distribution</h3>
                {strengthData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie data={strengthData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {strengthData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center">
                    <p className="text-sm text-slate-400">No data available</p>
                  </div>
                )}
              </div>

              {/* Age Distribution */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Password Age</h3>
                {ageData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={ageData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                          }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {ageData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center">
                    <p className="text-sm text-slate-400">No data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={18} className="text-indigo-600" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Recommendations</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.map((rec, idx) => {
                    const style = SEVERITY_STYLES[rec.severity] || SEVERITY_STYLES.low;
                    const Icon = style.icon;
                    return (
                      <div key={idx} className={`rounded-2xl border ${style.bg} ${style.border} p-4`}>
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${style.bg}`}>
                            <Icon size={16} className={style.iconColor} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${style.titleColor}`}>{rec.title}</p>
                            <p className={`text-xs mt-1 ${style.descColor}`}>{rec.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Detailed Tabs */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden">
              <div className="flex gap-1 p-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                      activeTab === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={18} className="text-emerald-600" />
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Strong</p>
                      </div>
                      <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{strengthDistribution.strong}</p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Passwords with high strength scores</p>
                    </div>
                    <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={18} className="text-amber-600" />
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Needs Attention</p>
                      </div>
                      <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">{weakCount + oldCount + atRiskCount}</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Passwords requiring action</p>
                    </div>
                    <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown size={18} className="text-red-600" />
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200">Sensitive</p>
                      </div>
                      <p className="text-3xl font-bold text-red-700 dark:text-red-300">{sensitiveCount}</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">Sensitive items in vault</p>
                    </div>
                  </div>
                )}

                {activeTab === 'weak' && (
                  <PasswordTable
                    passwords={weakPasswords}
                    emptyMessage="No weak passwords found"
                    columns={['name', 'login', 'strength']}
                    onNavigateVault={(slug) => navigate(`/vaults/${slug}`)}
                  />
                )}

                {activeTab === 'old' && (
                  <PasswordTable
                    passwords={oldPasswords}
                    emptyMessage="No old passwords found"
                    columns={['name', 'login', 'age']}
                    onNavigateVault={(slug) => navigate(`/vaults/${slug}`)}
                  />
                )}

                {activeTab === 'breach' && (
                  <PasswordTable
                    passwords={atRiskPasswords}
                    emptyMessage="No at-risk passwords found"
                    columns={['name', 'login', 'vault']}
                    onNavigateVault={(slug) => navigate(`/vaults/${slug}`)}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function PasswordTable({ passwords, emptyMessage, columns, onNavigateVault }) {
  if (!passwords.length) {
    return (
      <div className="text-center py-12">
        <CheckCircle2 size={32} className="mx-auto text-emerald-400 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Login</th>
            {columns.includes('strength') && (
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Strength</th>
            )}
            {columns.includes('age') && (
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Updated</th>
            )}
            {columns.includes('vault') && (
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vault</th>
            )}
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {passwords.map((pw) => (
            <tr key={pw.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
              <td className="px-4 py-3">
                <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{pw.name}</span>
                {pw.url && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{pw.url}</p>}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{pw.login || '-'}</td>
              {columns.includes('strength') && (
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
                    {pw.strengthScore != null ? `Score: ${pw.strengthScore}` : 'Weak'}
                  </span>
                </td>
              )}
              {columns.includes('age') && (
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {pw.updatedAt ? formatTimeAgo(pw.updatedAt) : '-'}
                </td>
              )}
              {columns.includes('vault') && (
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                    {pw.vault?.name || '-'}
                  </span>
                </td>
              )}
              <td className="px-4 py-3 text-right">
                {pw.vault?.slug && (
                  <button
                    onClick={() => onNavigateVault?.(pw.vault.slug)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30 transition"
                  >
                    <ExternalLink size={12} />
                    Go to Vault
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PasswordHealthPage;
