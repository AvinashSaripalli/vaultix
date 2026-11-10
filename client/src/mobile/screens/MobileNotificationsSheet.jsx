import { useState, useEffect, useMemo } from 'react';
import { Bell, CheckCircle2, ShieldAlert, KeyRound, Share2, LogIn, X, RefreshCw, Check } from 'lucide-react';
import api from '../../services/api';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getNotificationIcon(type) {
  if (type?.includes('SECURITY') || type?.includes('ALERT')) {
    return <ShieldAlert size={16} className="text-rose-500" />;
  }
  if (type?.includes('SHARE')) {
    return <Share2 size={16} className="text-indigo-500" />;
  }
  if (type?.includes('LOGIN')) {
    return <LogIn size={16} className="text-amber-500" />;
  }
  return <Bell size={16} className="text-indigo-500" />;
}

export default function MobileNotificationsSheet({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      //
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
    hapticLight();
    try {
      await api.patch(`/notifications/${id}/read`);
      fetchNotifications();
      window.dispatchEvent(new CustomEvent('vaultix:notifications-updated'));
    } catch {
      //
    }
  };

  const handleMarkAllRead = async () => {
    hapticMedium();
    try {
      await api.patch('/notifications/mark-all-read');
      hapticSuccess();
      fetchNotifications();
      window.dispatchEvent(new CustomEvent('vaultix:notifications-updated'));
    } catch {
      //
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'UNREAD') {
      return notifications.filter((n) => !n.isRead);
    }
    return notifications;
  }, [notifications, filter]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[85%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center relative">
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Notifications</h2>
              <p className="text-[10px] text-slate-400">
                {unreadCount > 0 ? `${unreadCount} unread security notifications` : 'All caught up'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 py-1 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 active:scale-95 transition"
              >
                Mark all read
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setFilter('ALL');
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition ${
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
            className={`px-3 py-1 rounded-full text-xs font-bold transition ${
              filter === 'UNREAD'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-indigo-500" />
              <span>Checking notifications...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center space-y-2 text-slate-400">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                <CheckCircle2 size={24} className="text-emerald-500" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Notifications</p>
              <p className="text-[11px] text-slate-400">You're completely up to date.</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => !item.isRead && handleMarkAsRead(item.id)}
                className={`p-3.5 rounded-2xl border transition flex items-start gap-3 cursor-pointer ${
                  !item.isRead
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800/80'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                  {getNotificationIcon(item.type)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {item.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {item.message}
                  </p>
                </div>

                {!item.isRead && (
                  <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-2" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
