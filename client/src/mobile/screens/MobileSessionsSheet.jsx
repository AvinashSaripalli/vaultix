import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Smartphone, Tablet, Globe, LogOut, Shield, Clock, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { fetchActiveSessions, revokeSession, revokeAllSessions } from '../../features/sessions/sessionsSlice';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Active now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function MobileSessionsSheet({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { sessions = [], loading, error } = useSelector((state) => state.sessions || {});
  const [revokingId, setRevokingId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchActiveSessions());
    }
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  const handleRevoke = async (session) => {
    const confirm = window.confirm(`Terminate session on ${session.deviceType || 'device'} (${session.ipAddress || 'unknown IP'})?`);
    if (!confirm) return;

    setRevokingId(session.id);
    hapticMedium();
    try {
      await dispatch(revokeSession(session.id));
      hapticSuccess();
      dispatch(fetchActiveSessions());
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    const confirm = window.confirm('Terminate all other active sessions? You will stay logged in only on this device.');
    if (!confirm) return;

    hapticMedium();
    try {
      await dispatch(revokeAllSessions());
      hapticSuccess();
      dispatch(fetchActiveSessions());
    } catch {
      //
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
              <Smartphone size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Active Sessions</h2>
              <p className="text-[10px] text-slate-400">Devices logged into your Vaultix account</p>
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-indigo-500" />
              <span>Loading devices...</span>
            </div>
          ) : (
            <>
              {/* CURRENT DEVICE */}
              {currentSession && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                    Current Device
                  </span>
                  <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Smartphone size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {currentSession.deviceType || 'Mobile Phone'}
                          </h4>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-white">
                            THIS DEVICE
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {currentSession.ipAddress} &middot; {formatTimeAgo(currentSession.lastActive)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OTHER ACTIVE DEVICES */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Other Sessions ({otherSessions.length})
                  </span>
                  {otherSessions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRevokeAll}
                      className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Revoke All Others
                    </button>
                  )}
                </div>

                {otherSessions.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No other devices currently active.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {otherSessions.map((s) => (
                      <div
                        key={s.id}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                            {s.deviceType === 'desktop' ? <Globe size={16} /> : <Smartphone size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {s.deviceType || 'Web Session'}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {s.ipAddress} &middot; {formatTimeAgo(s.lastActive)}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRevoke(s)}
                          disabled={revokingId === s.id}
                          className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold active:scale-95 transition"
                        >
                          {revokingId === s.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
