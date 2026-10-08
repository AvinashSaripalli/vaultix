import { Clock, ShieldAlert } from 'lucide-react';
import ModalPortal from '../common/ModalPortal';

function SessionWarningModal({ open, secondsLeft, onExtend, onLock }) {
  if (!open) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeLabel =
    mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`;

  return (
    <ModalPortal open={open}>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="w-full max-w-md rounded-2xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800 shadow-2xl overflow-hidden animate-slide-up"
        role="alertdialog"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-desc"
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <ShieldAlert size={22} className="text-white" />
          </div>
          <div>
            <h2 id="session-warning-title" className="text-lg font-bold text-white">
              Session expiring soon
            </h2>
            <p className="text-amber-100 text-sm">Your vault will lock automatically</p>
          </div>
        </div>

        <div className="px-6 py-5">
          <p id="session-warning-desc" className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Due to inactivity, your session will end and your vault will be locked to
            protect your credentials.
          </p>

          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 py-3">
            <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            <span className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {timeLabel}
            </span>
            <span className="text-sm text-amber-600 dark:text-amber-400">remaining</span>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onLock}
              className="flex-1 rounded-xl border border-[var(--border-primary)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Lock now
            </button>
            <button
              type="button"
              onClick={onExtend}
              className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Stay signed in
            </button>
          </div>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}

export default SessionWarningModal;
