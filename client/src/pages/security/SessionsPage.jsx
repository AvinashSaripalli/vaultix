import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Smartphone, Tablet, Globe, LogOut, Shield, Clock,
  RefreshCw,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import {
  fetchActiveSessions, revokeSession, revokeAllSessions,
} from '../../features/sessions/sessionsSlice';
import ConfirmModal from '../../components/common/ConfirmModal';

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatExpiry(dateStr) {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hrs > 24) return `${Math.floor(hrs / 24)}d remaining`;
  return `${hrs}h ${mins}m remaining`;
}

const SESSION_ICONS = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Globe,
};

function SessionsPage() {
  const dispatch = useDispatch();
  const { sessions, loading, error } = useSelector((state) => state.sessions);
  const [confirmRevoke, setConfirmRevoke] = useState({ open: false, session: null });
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  useEffect(() => {
    dispatch(fetchActiveSessions());
  }, [dispatch]);

  const currentSession = sessions.find((s) => s.isCurrent);
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  const handleRevoke = async () => {
    if (!confirmRevoke.session) return;
    await dispatch(revokeSession(confirmRevoke.session.id));
    setConfirmRevoke({ open: false, session: null });
  };

  const handleRevokeAll = async () => {
    await dispatch(revokeAllSessions());
    setConfirmRevokeAll(false);
    dispatch(fetchActiveSessions());
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 pb-8 min-w-0">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <Shield size={20} className="text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">Active Sessions</h1>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
                  Manage your active sessions across devices
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={() => dispatch(fetchActiveSessions())}
                disabled={loading}
                className="h-10 px-3.5 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition disabled:opacity-50"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              {otherSessions.length > 0 && (
                <button
                  onClick={() => setConfirmRevokeAll(true)}
                  className="h-10 px-3.5 sm:px-4 rounded-xl bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 flex items-center gap-2 transition"
                >
                  <LogOut size={14} />
                  Revoke All Others
                </button>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-5 py-4">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Current Session */}
            {currentSession && (
              <div className="bg-white dark:bg-slate-800 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Current Session</p>
                </div>
                <SessionCard session={currentSession} isCurrent />
              </div>
            )}

            {/* Other Sessions */}
            {otherSessions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4 px-1">
                  <Globe size={16} className="text-slate-500 dark:text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                    Other Active Sessions ({otherSessions.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {otherSessions.map((session) => (
                    <div key={session.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 sm:p-5">
                      <SessionCard
                        session={session}
                        onRevoke={() => setConfirmRevoke({ open: true, session })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!sessions.length && (
              <div className="text-center py-16">
                <Shield size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500 dark:text-slate-400">No active sessions found</p>
              </div>
            )}
          </>
        )}

        <ConfirmModal
          open={confirmRevoke.open}
          title="Revoke Session"
          message={`Are you sure you want to revoke this session? The user will be signed out immediately.`}
          confirmLabel="Revoke"
          onConfirm={handleRevoke}
          onCancel={() => setConfirmRevoke({ open: false, session: null })}
        />

        <ConfirmModal
          open={confirmRevokeAll}
          title="Revoke All Other Sessions"
          message="This will sign out all other active sessions immediately. Your current session will remain active."
          confirmLabel="Revoke All"
          onConfirm={handleRevokeAll}
          onCancel={() => setConfirmRevokeAll(false)}
        />
      </div>
    </AppLayout>
  );
}

function SessionCard({ session, isCurrent, onRevoke }) {
  const deviceKey = (session.device || 'desktop').toLowerCase();
  const Icon = SESSION_ICONS[deviceKey] || Globe;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
      <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
        <div className={`h-11 sm:h-12 w-11 sm:w-12 rounded-xl flex items-center justify-center shrink-0 ${
          isCurrent
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        }`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {session.browser} on {session.os}
            </p>
            {isCurrent && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase shrink-0">
                This Device
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Globe size={12} />
              {session.ipAddress || 'Unknown IP'}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatTimeAgo(session.createdAt)}
            </span>
            <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
              Expires: {formatExpiry(session.expiresAt)}
            </span>
          </div>
          {session.user && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate">
              {session.user.fullName} ({session.user.email})
            </p>
          )}
        </div>
      </div>
      {!isCurrent && onRevoke && (
        <div className="flex sm:justify-end pl-14 sm:pl-0 shrink-0">
          <button
            onClick={onRevoke}
            className="h-8 px-3 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1.5 transition"
          >
            <LogOut size={12} />
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}

export default SessionsPage;
