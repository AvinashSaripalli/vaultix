import { useEffect, useRef, useState } from 'react';
import { subscribeToast } from '../../utils/toast';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

const TYPE_STYLES = {
  success: 'bg-emerald-600',
  error: 'bg-red-600',
  info: 'bg-indigo-600',
  warning: 'bg-amber-500',
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
      onClick={() => setToast(null)}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2.5 rounded-xl px-5 py-3 text-white text-sm font-medium shadow-lg animate-toast-in cursor-pointer ${style}`}
    >
      <Icon size={18} className="shrink-0" />
      <span>{toast.message}</span>
    </div>
  );
}

export default StatusBar;
