import { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import api from '../../services/api';
import ModalPortal from '../common/ModalPortal';

function ManagePasswordSharesModal({ open, password, onClose, onRemoveShare }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !password?.id) return;

    const fetchShares = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/my-vault/passwords/${password.id}/shares`);
        setShares(res.data);
      } catch (error) {
        console.error('Fetch password shares error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchShares();
  }, [open, password]);

  const handleRemove = async (shareId) => {
    await onRemoveShare(shareId);
    setShares((prev) => prev.filter((item) => item.id !== shareId));
  };

  if (!open) return null;

  return (
    <ModalPortal open={open} onClose={onClose}>
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 dark:bg-slate-800 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Manage Access</h2>

          <button onClick={onClose} className="text-slate-500 dark:text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 mb-4 dark:bg-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">Password</p>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{password?.name}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading shared users...</p>
        ) : shares.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No users have access.</p>
        ) : (
          <div className="space-y-3">
            {shares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-600"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {share.sharedWith?.fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {share.sharedWith?.email}
                  </p>
                </div>

                <button
                  onClick={() => handleRemove(share.id)}
                  className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </ModalPortal>
  );
}

export default ManagePasswordSharesModal;