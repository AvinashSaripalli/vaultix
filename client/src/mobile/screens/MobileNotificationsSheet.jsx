import { useState, useEffect, useMemo, Component } from 'react';
import {
  Bell,
  CheckCircle2,
  ShieldAlert,
  KeyRound,
  Share2,
  LogIn,
  X,
  RefreshCw,
  Database,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import api from '../../services/api';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts) || ts <= 0) return '';
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function safeString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return fallback;
  }
}

function getNotificationIcon(type, meta) {
  const t = String(type || '').toUpperCase();
  if (t === 'LOGIN') {
    return (
      <LogIn
        size={16}
        className={meta?.status === 'SUCCESS' ? 'text-indigo-500' : 'text-rose-500'}
      />
    );
  }
  if (t.includes('SECURITY') || t.includes('ALERT') || t.includes('WEAK')) {
    return <ShieldAlert size={16} className="text-rose-500" />;
  }
  if (t.includes('SHARE')) {
    return <Share2 size={16} className="text-indigo-500" />;
  }
  if (t.includes('PASSWORD') || t.includes('KEY')) {
    return <KeyRound size={16} className="text-amber-500" />;
  }
  if (t.includes('FOLDER') || t.includes('VAULT') || t.includes('DATABASE')) {
    return <Database size={16} className="text-emerald-500" />;
  }
  if (t.includes('ACTIVITY') || t.includes('ACTION')) {
    return <Activity size={16} className="text-indigo-500" />;
  }
  return <Bell size={16} className="text-indigo-500" />;
}

// Inner sheet error boundary to prevent entire mobile app crash
class SheetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn('SheetErrorBoundary caught:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="py-16 text-center space-y-3 px-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
            Unable to display notifications
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 py-1.5 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/60"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MobileNotificationsSheet({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD' | 'SECURITY'

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // Try recent-activity first (same as desktop Topbar), fallback to /notifications
      let raw = null;
      try {
        const resActivity = await api.get('/notifications/recent-activity');
        raw = resActivity?.data;
      } catch {
        const resNotif = await api.get('/notifications');
        raw = resNotif?.data;
      }

      let list = [];
      if (Array.isArray(raw)) {
        list = raw;
      } else if (Array.isArray(raw?.items)) {
        list = raw.items;
      } else if (Array.isArray(raw?.notifications)) {
        list = raw.notifications;
      }

      const count =
        typeof raw?.unreadCount === 'number'
          ? raw.unreadCount
          : list.filter((n) => n && !n.isRead).length;

      setNotifications(list);
      setUnreadCount(count);
    } catch (err) {
      console.warn('fetchNotifications error:', err);
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (id) => {
    if (!id) return;
    hapticLight();
    try {
      await api.patch(`/notifications/${encodeURIComponent(id)}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n && n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      window.dispatchEvent(new CustomEvent('vaultix:notifications-updated'));
    } catch (err) {
      console.warn('markAsRead error:', err);
    }
  };

  const handleMarkAllRead = async () => {
    hapticMedium();
    try {
      await api.patch('/notifications/mark-all-read');
      hapticSuccess();
      setNotifications((prev) => prev.map((n) => (n ? { ...n, isRead: true } : n)));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('vaultix:notifications-updated'));
    } catch (err) {
      console.warn('markAllRead error:', err);
    }
  };

  const filtered = useMemo(() => {
    const list = Array.isArray(notifications) ? notifications.filter(Boolean) : [];
    if (filter === 'UNREAD') {
      return list.filter((n) => !n.isRead);
    }
    if (filter === 'SECURITY') {
      return list.filter((n) => {
        const t = String(n.type || '').toUpperCase();
        return t.includes('SECURITY') || t.includes('ALERT') || t.includes('LOGIN');
      });
    }
    return list;
  }, [notifications, filter]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[85%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center relative shadow-xs">
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Notifications</h2>
              <p className="text-[10px] text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 py-1 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 active:scale-95 transition"
              >
                Mark all read
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setFilter('ALL');
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
              filter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            All ({notifications.length})
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setFilter('UNREAD');
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
              filter === 'UNREAD'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Unread ({unreadCount})
          </button>

          <button
            type="button"
            onClick={() => {
              hapticLight();
              setFilter('SECURITY');
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition shrink-0 ${
              filter === 'SECURITY'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Security & Logins
          </button>
        </div>

        {/* Notifications List */}
        <SheetErrorBoundary>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
            {loading ? (
              <div className="py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-indigo-500" />
                <span className="font-medium mt-1">Syncing notifications...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center space-y-2 text-slate-400">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800/60 flex items-center justify-center text-emerald-500 shadow-xs">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Notifications</p>
                <p className="text-[11px] text-slate-400">You're completely up to date.</p>
              </div>
            ) : (
              filtered.map((item, idx) => {
                if (!item) return null;
                const itemId = item.id || `notif-${idx}`;
                const titleStr = safeString(item.title, 'Notification');
                const messageStr = safeString(item.message, '');
                const timeStr = formatTimeAgo(item.createdAt);

                return (
                  <div
                    key={itemId}
                    onClick={() => !item.isRead && item.id && handleMarkAsRead(item.id)}
                    className={`p-3.5 rounded-2xl border transition flex items-start gap-3 cursor-pointer ${
                      !item.isRead
                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      {getNotificationIcon(item.type, item.meta)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {titleStr}
                        </h4>
                        {timeStr && (
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                            {timeStr}
                          </span>
                        )}
                      </div>

                      {messageStr && (
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                          {messageStr}
                        </p>
                      )}
                    </div>

                    {!item.isRead && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SheetErrorBoundary>
      </div>
    </div>
  );
}
