import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  KeyRound,
  LogIn,
  Search,
  Share2,
  ShieldAlert,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import api from '../../services/api';

const FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Unread', value: 'UNREAD' },
  { label: 'Security', value: 'SECURITY' },
  { label: 'Shared', value: 'SHARE_PASSWORD' },
  { label: 'Login', value: 'LOGIN' },
];

function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const res = await api.get('/notifications');

      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    await api.patch(`/notifications/${id}/read`);
    window.dispatchEvent(new CustomEvent('vaultix:notifications-updated'));
    fetchNotifications();
  };

  const markAllRead = async () => {
    await api.patch('/notifications/mark-all-read');
    window.dispatchEvent(new CustomEvent('vaultix:notifications-updated'));
    fetchNotifications();
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const matchesSearch =
        item.title?.toLowerCase().includes(search.toLowerCase()) ||
        item.message?.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'UNREAD') return !item.isRead;

      return item.type === activeFilter || item.type?.includes(activeFilter);
    });
  }, [notifications, activeFilter, search]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center dark:bg-indigo-900/50 dark:text-indigo-300">
                  <Bell size={22} />
                </div>

                <div>
                  <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                    Notifications
                  </h1>

                  <p className="text-slate-500 mt-1 dark:text-slate-400">
                    View your security alerts, shared password updates and login notices
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={markAllRead}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Mark All Read
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications..."
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-indigo-500/30"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setActiveFilter(filter.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    activeFilter === filter.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-indigo-50 px-5 py-3 dark:bg-indigo-900/20">
              <p className="text-xs text-indigo-500 font-medium dark:text-indigo-400">Unread</p>
              <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">
                {unreadCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden dark:bg-slate-800 dark:border-slate-700">
          {loading && (
            <div className="p-8 text-slate-500 dark:text-slate-400">Loading notifications...</div>
          )}

          {!loading &&
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => markAsRead(item.id)}
                className={`flex items-start gap-4 px-6 py-5 border-b border-slate-200 cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50 ${
                  !item.isRead ? 'bg-indigo-50/40 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-800'
                }`}
              >
                <NotificationIcon type={item.type} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                    )}

                    <h3 className="font-bold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </h3>
                  </div>

                  <p className="text-sm text-slate-600 mt-1 dark:text-slate-300">
                    {item.message}
                  </p>

                  <p className="text-xs text-slate-400 mt-2 dark:text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>

                {item.isRead && (
                  <CheckCircle2 size={18} className="text-green-500" />
                )}
              </div>
            ))}

          {!loading && !filteredNotifications.length && (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              No notifications found.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function NotificationIcon({ type }) {
  let icon = <Bell size={20} />;
  let className = 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';

  if (type === 'SHARE_PASSWORD') {
    icon = <Share2 size={20} />;
    className = 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300';
  }

  if (type === 'SECURITY' || type === 'WEAK_PASSWORD') {
    icon = <ShieldAlert size={20} />;
    className = 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-300';
  }

  if (type === 'LOGIN') {
    icon = <LogIn size={20} />;
    className = 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300';
  }

  if (type === 'PASSWORD') {
    icon = <KeyRound size={20} />;
    className = 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300';
  }

  return (
    <div
      className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${className}`}
    >
      {icon}
    </div>
  );
}

export default NotificationsPage;