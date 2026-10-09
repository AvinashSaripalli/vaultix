import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Bell,
  CheckCircle2,
  KeyRound,
  LockKeyhole,
  LogIn,
  Share2,
  ShieldAlert,
  Activity,
  Folder,
  Database,
  RefreshCw,
  Sun,
  Moon,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../../features/auth/authSlice';
import { toggleTheme } from '../../features/theme/themeSlice';
import useLockVault from '../../hooks/useLockVault';
import { useLayout } from '../../context/LayoutContext';
import api from '../../services/api';

function getItemIcon(type, meta) {
  if (type === 'LOGIN') {
    return {
      icon: <LogIn size={15} />,
      className:
        meta?.status === 'SUCCESS'
          ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
          : 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400',
    };
  }

  if (type === 'ACTIVITY') {
    const action = meta?.action || '';
    if (action.includes('PASSWORD'))
      return { icon: <KeyRound size={15} />, className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' };
    if (action.includes('FOLDER'))
      return { icon: <Folder size={15} />, className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' };
    if (action.includes('VAULT'))
      return { icon: <Database size={15} />, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' };
    return { icon: <Activity size={15} />, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' };
  }

  if (type === 'SHARE_PASSWORD' || type === 'SHARE_FOLDER' || type === 'SHARE_VAULT')
    return { icon: <Share2 size={15} />, className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' };

  if (type === 'SECURITY' || type === 'WEAK_PASSWORD')
    return { icon: <ShieldAlert size={15} />, className: 'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400' };

  if (type === 'PASSWORD')
    return { icon: <KeyRound size={15} />, className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' };

  return { icon: <Bell size={15} />, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' };
}

function getTypeBadge(type) {
  if (type === 'LOGIN')
    return { label: 'Login', className: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' };
  if (type === 'ACTIVITY')
    return { label: 'Action', className: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' };
  return { label: 'Alert', className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400' };
}

function Topbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const lockVault = useLockVault();
  const { user, isMasterVerified } = useSelector((state) => state.auth);
  const { mode } = useSelector((state) => state.theme);
  const { sidebarCollapsed, toggleSidebarCollapse, toggleMobileSidebar } = useLayout();

  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const userMenuRef = useRef(null);

  const fetchRecentActivity = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    setLoading(true);
    try {
      const params = {};
      const lastViewed = localStorage.getItem('lastViewedAt');
      if (lastViewed) {
        params.since = lastViewed;
      }
      const res = await api.get('/notifications/recent-activity', { params });
      setItems(res.data?.items || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (err) {
      if (err?.response?.status !== 401) {
        console.error('fetchRecentActivity error:', err);
      }
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentActivity();
    const interval = setInterval(fetchRecentActivity, 30000);
    return () => clearInterval(interval);
  }, [fetchRecentActivity]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (item) => {
    if (item.type !== 'ACTIVITY' && item.type !== 'LOGIN') {
      try {
        await api.patch(`/notifications/${item.sourceId}/read`);
      } catch (err) {
        console.error('markAsRead error:', err);
      }
    }
    localStorage.setItem('lastViewedAt', new Date().toISOString());
    fetchRecentActivity();
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
    } catch (err) {
      console.error('markAllRead error:', err);
    }
    localStorage.setItem('lastViewedAt', new Date().toISOString());
    fetchRecentActivity();
  };

  const activityCount = items.filter((i) => i.type === 'ACTIVITY').length;
  const loginCount = items.filter((i) => i.type === 'LOGIN').length;
  const alertCount = items.filter(
    (i) => i.type !== 'ACTIVITY' && i.type !== 'LOGIN'
  ).length;

  const handleOpen = () => {
    if (!open) {
      fetchRecentActivity();
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="h-16 sm:h-[72px] bg-[var(--bg-topbar)] border-b border-[var(--border-primary)] flex items-center justify-between px-3 sm:px-6 lg:px-8 transition-colors duration-200">
      {/* Left side: drawer/collapse toggles + title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile drawer toggle */}
        <button
          onClick={toggleMobileSidebar}
          className="lg:hidden h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
          title="Open navigation menu"
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>

        {/* Desktop collapse toggle */}
        <button
          onClick={toggleSidebarCollapse}
          className="hidden lg:flex h-10 w-10 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar"
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <h2 className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] truncate">
          Password Manager
        </h2>
        {isMasterVerified && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Vault unlocked
          </span>
        )}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {isMasterVerified && (
          <button
            onClick={() => lockVault()}
            className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-10 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] px-2.5 sm:px-3 text-xs sm:text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Lock vault (Ctrl+Shift+L)"
          >
            <LockKeyhole size={16} />
            <span className="hidden sm:inline">Lock</span>
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => dispatch(toggleTheme())}
          className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
          title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {mode === 'dark' ? (
            <Sun size={17} className="text-amber-400" />
          ) : (
            <Moon size={17} className="text-slate-600" />
          )}
        </button>

        {/* Activity notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleOpen}
            className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Bell size={17} className="text-[var(--text-secondary)]" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4.5 min-w-4.5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-12 w-[calc(100vw-24px)] sm:w-[400px] max-w-[400px] bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl shadow-xl z-50 overflow-hidden">
              {/* Header */}
              <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--border-primary)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--text-primary)] text-sm">Recent Activity</h3>
                  {unreadCount > 0 && (
                    <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={fetchRecentActivity}
                    disabled={loading}
                    className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  </button>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate('/activity-log?tab=unread');
                    }}
                    className="text-xs text-[var(--text-muted)] font-medium hover:text-[var(--text-secondary)] transition-colors"
                  >
                    View all →
                  </button>
                </div>
              </div>

              {/* Items list */}
              <div className="max-h-[380px] sm:max-h-[420px] overflow-y-auto divide-y divide-[var(--border-secondary)]">
                {loading && items.length === 0 && (
                  <div className="p-6 text-center text-sm text-[var(--text-muted)]">
                    Loading...
                  </div>
                )}

                {!loading && items.length === 0 && (
                  <div className="p-8 text-center text-sm text-[var(--text-muted)]">
                    No recent activity.
                  </div>
                )}

                {items.map((item) => {
                  const { icon, className: iconClass } = getItemIcon(item.type, item.meta);
                  const { label: badgeLabel, className: badgeClass } = getTypeBadge(item.type);
                  const isUnread = !item.isRead;

                  return (
                    <button
                      key={item.id}
                      onClick={() => markAsRead(item)}
                      className={`w-full text-left px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors flex items-start gap-3 ${
                        isUnread ? 'bg-indigo-50/40 dark:bg-indigo-900/20' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${iconClass}`}
                      >
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isUnread && (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
                          )}
                          {!isUnread && item.type !== 'ACTIVITY' && item.type !== 'LOGIN' && (
                            <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                          )}
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                            {item.title}
                          </p>
                        </div>
                        {item.message && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                            {item.message}
                          </p>
                        )}
                        <p className="text-[11px] text-[var(--text-muted)] mt-1">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {/* Type badge */}
                      <span
                        className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-1 ${badgeClass}`}
                      >
                        {badgeLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Footer summary */}
              <div className="px-4 sm:px-5 py-2.5 border-t border-[var(--border-secondary)] flex items-center justify-between bg-[var(--bg-hover)]">
                <p className="text-[11px] text-[var(--text-muted)] truncate">
                  {activityCount} actions · {loginCount} logins · {alertCount} alerts
                </p>
                <p className="text-[11px] font-semibold text-[var(--text-secondary)] shrink-0 ml-2">
                  {unreadCount} unread
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User avatar with dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 sm:gap-2.5 hover:bg-[var(--bg-hover)] rounded-xl px-1.5 sm:px-2 py-1.5 transition-colors"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 text-xs sm:text-sm font-semibold shrink-0">
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="leading-tight text-left min-w-0 hidden sm:block">
              <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] max-w-[100px] lg:max-w-[130px] truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] max-w-[120px] truncate hidden md:block">
                {user?.email || ''}
              </p>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-12 w-48 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl shadow-xl z-50 overflow-hidden">
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  navigate('/profile');
                }}
                className="w-full text-left px-4 py-3 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors font-medium"
              >
                Profile
              </button>
              <div className="border-t border-[var(--border-secondary)]" />
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  dispatch(logoutUser());
                  navigate('/login');
                }}
                className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Topbar;
