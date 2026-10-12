import React, { useState } from 'react';
import { Clock, Save, Trash2, ShieldCheck } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';

const DELAY_OPTIONS = [
  { value: 5, label: '5 seconds' },
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
];

const CLEAR_DELAY_KEY = 'vaultix_clipboard_clear_delay';

function loadCurrentDelay() {
  try {
    const stored = parseInt(localStorage.getItem(CLEAR_DELAY_KEY), 10);
    return !isNaN(stored) && stored > 0 ? stored : 15;
  } catch {
    return 15;
  }
}

const INITIAL_DELAY = loadCurrentDelay();

function ClipboardSettingsPage() {
  const [delay, setDelay] = useState(INITIAL_DELAY);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem(CLEAR_DELAY_KEY, String(delay));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClearNow = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText('').catch(() => {});
    }
    setSaved(false);
  };

  return (
    <AppLayout>
      <div className="w-full min-w-0 space-y-5 sm:space-y-6 pb-8">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm">
          <div className="flex items-center gap-3.5 sm:gap-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
              <Clock size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                Clipboard Auto-Clear
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Configure how long copied secrets stay on your clipboard
              </p>
            </div>
          </div>
        </div>

        {saved && (
          <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
            <ShieldCheck size={16} />
            Settings saved successfully
          </div>
        )}

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 sm:p-6 lg:p-8 shadow-sm">
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Auto-clear after</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
                Copied passwords, usernames, and notes are automatically wiped from the clipboard after this delay.
                The clipboard also clears immediately when you switch away from the browser window for extra protection.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {DELAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDelay(opt.value)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      delay === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-200 dark:ring-blue-800'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-medium mb-1 flex items-center gap-2">
                <Clock size={15} className="text-blue-600 dark:text-blue-400" />
                Current setting
              </p>
              <p>
                Clipboard clears after{' '}
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {delay < 60 ? `${delay} seconds` : `${delay / 60} minute${delay / 60 > 1 ? 's' : ''}`}
                </span>{' '}
                and on losing window focus.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClearNow}
                className="inline-flex items-center justify-center gap-2 h-10 sm:h-11 px-5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm"
              >
                <Trash2 size={15} />
                <span>Clear clipboard now</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center justify-center gap-2 h-10 sm:h-11 px-6 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition shadow-sm"
              >
                <Save size={16} />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
export default ClipboardSettingsPage;
