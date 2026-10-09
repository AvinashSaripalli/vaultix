import { useEffect, useRef, useState } from 'react';
import { subscribeToast } from '../../utils/toast';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

const TYPE_STYLES = {
  success: 'bg-emerald-600/95 border-emerald-500/50 text-white shadow-emerald-950/20',
  error: 'bg-rose-600/95 border-rose-500/50 text-white shadow-rose-950/20',
  info: 'bg-indigo-600/95 border-indigo-500/50 text-white shadow-indigo-950/20',
  warning: 'bg-amber-500/95 border-amber-400/50 text-white shadow-amber-950/20',
};

const TYPE_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

function StatusBar() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToast((next) => {
      setToast(next);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setToast(null), next.duration);
    });

    return () => {
      unsubscribe();
      clearTimeout(timerRef.current);
    };
  }, []);

  if (!toast) return null;

  const Icon = TYPE_ICONS[toast.type] || Info;
  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  return (
    <div
      role="status"
      className={`fixed bottom-5 right-5 z-[10000] max-w-sm sm:max-w-md flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-md border animate-toast-in ${style}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{toast.message}</span>
      </div>
      <button
        type="button"
        onClick={() => setToast(null)}
        className="shrink-0 p-1 -mr-1 rounded-lg hover:bg-white/20 transition text-white/80 hover:text-white"
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default StatusBar;
