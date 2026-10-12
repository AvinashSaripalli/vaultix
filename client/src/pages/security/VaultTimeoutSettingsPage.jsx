import { useEffect, useState } from 'react';
import { Clock, Save, CheckCircle2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import api from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';

const TIMEOUT_OPTIONS = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
];

function VaultTimeoutSettingsPage() {
  const { user } = useSelector((state) => state.auth);

  const [currentTimeout, setCurrentTimeout] = useState(15);
  const [selectedTimeout, setSelectedTimeout] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/2fa/vault-timeout');
        if (cancelled) return;
        setCurrentTimeout(res.data.vaultTimeoutMinutes);
        setSelectedTimeout(res.data.vaultTimeoutMinutes);
      } catch {
        if (cancelled) return;
        // Fall back to the user object
        setCurrentTimeout(user?.vaultTimeoutMinutes || 15);
        setSelectedTimeout(user?.vaultTimeoutMinutes || 15);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.vaultTimeoutMinutes]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.put('/2fa/vault-timeout', {
        vaultTimeoutMinutes: selectedTimeout,
      });
      setCurrentTimeout(res.data.vaultTimeoutMinutes);
      setMessage('Vault timeout updated successfully. It will take effect on your next login.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update vault timeout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6 pb-8">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 shrink-0">
              <Clock size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                Vault Timeout
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Set how long your vault stays unlocked after inactivity
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <CheckCircle2 size={16} />
            {message}
          </div>
        )}

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 sm:p-6 lg:p-8 shadow-sm">
          {loading ? (
            <p className="text-center text-slate-500 dark:text-slate-400 py-8">Loading...</p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Vault locks after
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                  Your vault will automatically re-lock after this period of inactivity. You'll need to enter your master password again to unlock it.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {TIMEOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedTimeout(opt.value)}
                      className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                        selectedTimeout === opt.value
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-200 dark:ring-indigo-800'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-medium mb-1">Current setting</p>
                <p>
                  Vault auto-locks after{' '}
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {currentTimeout === 1 ? '1 minute' : currentTimeout === 60 ? '1 hour' : currentTimeout > 60 ? `${currentTimeout / 60} hours` : `${currentTimeout} minutes`}
                  </span>{' '}
                  of inactivity.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 h-10 sm:h-11 px-6 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm"
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

export default VaultTimeoutSettingsPage;
