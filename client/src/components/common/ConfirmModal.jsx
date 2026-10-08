import { AlertTriangle, X } from 'lucide-react';
import ModalPortal from './ModalPortal';

function ConfirmModal({ open, title, message, confirmLabel = 'Delete', cancelLabel = 'Cancel', onConfirm, onCancel, loading }) {
  if (!open) return null;

  return (
    <ModalPortal open={open} onClose={onCancel}>
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={onCancel}
      >
        <div
          className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-2xl my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center shrink-0"
          >
            <X size={18} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}

export default ConfirmModal;