import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { ShieldAlert, CheckCircle2, XCircle, X, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import api from '../../services/api';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

export default function MobileApprovalsSheet({ isOpen, onClose }) {
  const { token, user } = useSelector((state) => state.auth);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actioningId, setActioningId] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/admin-approvals?tab=actionable', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch approval requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRequests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = async (requestId, type) => {
    const confirm = window.confirm(`Are you sure you want to ${type.toUpperCase()} this request?`);
    if (!confirm) return;

    setActioningId(requestId);
    hapticMedium();

    try {
      if (type === 'approve') {
        await api.post(`/admin-approvals/${requestId}/approve`, { note: 'Approved via Vaultix Mobile' }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await api.post(`/admin-approvals/${requestId}/reject`, { note: 'Rejected via Vaultix Mobile' }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      hapticSuccess();
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${type} request.`);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[85%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ShieldAlert size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Admin Approvals</h2>
              <p className="text-[10px] text-slate-400">Multi-Party Authorization Queue</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-indigo-500" />
              <span>Loading approvals queue...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-slate-400">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">All Requests Clear</p>
              <p className="text-[11px] text-slate-400">No pending administrative actions require your review.</p>
            </div>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                      {req.actionType || 'POLICY_ACTION'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                      {req.reason || 'Administrative Action Request'}
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Requested by <span className="font-semibold text-slate-700 dark:text-slate-300">{req.requestedBy?.fullName || 'Administrator'}</span>
                </div>

                {/* Approve / Reject Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAction(req.id, 'reject')}
                    disabled={actioningId === req.id}
                    className="py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold active:scale-95 transition"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAction(req.id, 'approve')}
                    disabled={actioningId === req.id}
                    className="py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold active:scale-95 transition shadow-xs"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
