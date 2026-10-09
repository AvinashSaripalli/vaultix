import { Fragment, useEffect, useMemo, useState, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  Activity,
  Folder,
  KeyRound,
  Database,
  CheckCircle2,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  LogIn,
  Share2,
  ShieldAlert,
  Bell,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import AppLayout from '../../components/layout/AppLayout';
import { fetchActivityLogs } from '../../features/vault/vaultSlice';
import api from '../../services/api';

const PAGE_SIZE = 10;
const ACTIVITY_PAGE_SIZE = 10;

const ACTION_FILTERS = [
  { label: 'All Actions', value: 'ALL' },
  { label: 'Create', value: 'CREATE' },
  { label: 'Update', value: 'UPDATE' },
  { label: 'Delete', value: 'DELETE' },
  { label: 'View', value: 'VIEW' },
  { label: 'Copy', value: 'COPY' },
  { label: 'Share', value: 'SHARE' },
];

const TYPE_FILTERS = [
  { label: 'All Types', value: 'ALL' },
  { label: 'Password', value: 'PASSWORD' },
  { label: 'Folder', value: 'FOLDER' },
  { label: 'Vault', value: 'VAULT' },
];

const LOGIN_STATUS_FILTERS = [
  { label: 'All Status', value: 'ALL' },
  { label: 'Success', value: 'SUCCESS' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Blocked', value: 'BLOCKED' },
];

const UNREAD_TYPE_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'Actions', value: 'ACTIVITY' },
  { label: 'Logins', value: 'LOGIN' },
  { label: 'Alerts', value: 'ALERT' },
];

const TABS = [
  { id: 'actions', label: 'Actions' },
  { id: 'login', label: 'Login History' },
  { id: 'unread', label: 'Unread' },
];

function formatAction(action) {
  switch (action) {
    case 'CREATE_FOLDER': return 'Create Folder';
    case 'UPDATE_FOLDER': return 'Update Folder';
    case 'DELETE_FOLDER': return 'Delete Folder';
    case 'CREATE_PASSWORD': return 'Create Password';
    case 'UPDATE_PASSWORD': return 'Update Password';
    case 'DELETE_PASSWORD': return 'Delete Password';
    case 'VIEW_PASSWORD': return 'View Password';
    case 'COPY_PASSWORD': return 'Copy Password';
    case 'SHARE_PASSWORD': return 'Share Password';
    case 'SHARE_FOLDER': return 'Share Folder';
    case 'CREATE_VAULT': return 'Create Vault';
    case 'UPDATE_VAULT': return 'Update Vault';
    case 'DELETE_VAULT': return 'Delete Vault';
    case 'IMPORT_PASSWORDS': return 'Import Passwords';
    case 'SHARE_VAULT': return 'Share Vault';
    default: return action?.replaceAll('_', ' ') || '-';
  }
}

function getActionBadge(action) {
  if (action?.startsWith('CREATE')) return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400';
  if (action?.startsWith('UPDATE')) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  if (action?.startsWith('DELETE')) return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';
  if (action?.startsWith('VIEW')) return 'bg-blue-50 text-blue-700';
  if (action?.startsWith('COPY')) return 'bg-sky-50 text-sky-700 dark:bg-sky-900/20';
  if (action?.startsWith('SHARE')) return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400';
  if (action?.startsWith('IMPORT')) return 'bg-violet-50 text-violet-700 dark:bg-violet-900/20';
  return 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
}

function getActionIcon(action) {
  if (action?.includes('PASSWORD')) return <KeyRound size={15} />;
  if (action?.includes('FOLDER')) return <Folder size={15} />;
  if (action?.includes('VAULT')) return <Database size={15} />;
  return <Activity size={15} />;
}

function getUnreadItemIcon(type, meta) {
  if (type === 'LOGIN') {
    return {
      icon: <LogIn size={16} />,
      className:
        meta?.status === 'SUCCESS'
          ? 'bg-blue-50 text-blue-600'
          : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    };
  }
  if (type === 'ACTIVITY') {
    const action = meta?.action || '';
    if (action.includes('PASSWORD'))
      return { icon: <KeyRound size={16} />, className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' };
    if (action.includes('FOLDER'))
      return { icon: <Folder size={16} />, className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' };
    if (action.includes('VAULT'))
      return { icon: <Database size={16} />, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
    return { icon: <Activity size={16} />, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
  }
  if (type === 'SHARE_PASSWORD' || type === 'SHARE_FOLDER' || type === 'SHARE_VAULT')
    return { icon: <Share2 size={16} />, className: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400' };
  if (type === 'SECURITY' || type === 'WEAK_PASSWORD')
    return { icon: <ShieldAlert size={16} />, className: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' };
  if (type === 'PASSWORD')
    return { icon: <KeyRound size={16} />, className: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' };
  return { icon: <Bell size={16} />, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
}

function getTypeBadge(type) {
  if (type === 'LOGIN') return { label: 'Login', className: 'bg-blue-50 text-blue-700' };
  if (type === 'ACTIVITY') return { label: 'Action', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };
  return { label: 'Alert', className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' };
}

function getDateGroup(dateStr) {
  if (!dateStr) return 'Earlier';
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - today.getDay());

  if (date >= today) return 'Today';
  if (date >= yesterday) return 'Yesterday';
  if (date >= weekStart) return 'This Week';
  return 'Earlier';
}

function downloadCSV(filename, rows, headers) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h] ?? '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function renderPageButtons(current, total, onPageChange) {
  if (total <= 10) {
    return Array.from({ length: total }, (_, i) => i + 1).map((page) => (
      <button
        key={page}
        onClick={() => onPageChange(page)}
        className={`h-10 w-10 rounded-xl text-sm font-semibold ${
          current === page
            ? 'bg-indigo-600 text-white'
            : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        {page}
      </button>
    ));
  }

  const pages = [];
  const windowStart = Math.max(2, current - 2);
  const windowEnd = Math.min(total - 1, current + 2);

  pages.push(1);

  if (windowStart > 2) pages.push('...');

  for (let i = windowStart; i <= windowEnd; i++) {
    pages.push(i);
  }

  if (windowEnd < total - 1) pages.push('...');

  if (total > 1) pages.push(total);

  return pages.map((page, idx) => {
    if (page === '...') {
      return (
        <span key={`ellipsis-${idx}`} className="h-10 w-10 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          ...
        </span>
      );
    }
    return (
      <button
        key={page}
        onClick={() => onPageChange(page)}
        className={`h-10 w-10 rounded-xl text-sm font-semibold ${
          current === page
            ? 'bg-indigo-600 text-white'
            : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        {page}
      </button>
    );
  });
}

function renderSimplePageButtons(current, total, onPageChange) {
  if (total <= 4) {
    return Array.from({ length: total }, (_, i) => i + 1).map((page) => (
      <button
        key={page}
        onClick={() => onPageChange(page)}
        className={`h-10 w-10 rounded-xl text-sm font-semibold ${
          current === page
            ? 'bg-indigo-600 text-white'
            : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        {page}
      </button>
    ));
  }

  const pages = [];

  for (let i = 1; i <= 3; i++) {
    pages.push(i);
  }

  pages.push('...');

  pages.push(total);

  return pages.map((page, idx) => {
    if (page === '...') {
      return (
        <span key={`ellipsis-${idx}`} className="h-10 w-10 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          ...
        </span>
      );
    }
    return (
      <button
        key={page}
        onClick={() => onPageChange(page)}
        className={`h-10 w-10 rounded-xl text-sm font-semibold ${
          current === page
            ? 'bg-indigo-600 text-white'
            : 'border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        {page}
      </button>
    );
  });
}

function ActivityLogPage() {
  const dispatch = useDispatch();

  const { activityLogs, activityLoading, error } = useSelector(
    (state) => state.vault
  );
  const { user } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('actions');
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [departments, setDepartments] = useState([]);
  const [sortConfig, setSortConfig] = useState(null);

  const [loginActivities, setLoginActivities] = useState([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginStatusFilter, setLoginStatusFilter] = useState('ALL');

  const [allActivityItems, setAllActivityItems] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [unreadTypeFilter, setUnreadTypeFilter] = useState('ALL');
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const [expandedLogin, setExpandedLogin] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    dispatch(fetchActivityLogs(deptFilter === 'ALL' ? undefined : deptFilter));
  }, [dispatch, deptFilter]);

  useEffect(() => {
    // The departments endpoint is admin-only; skip for regular users.
    if (user?.role !== 'ADMIN') return;

    const fetchDepts = async () => {
      try {
        const res = await api.get('/departments');
        setDepartments(res.data || []);
      } catch {
        // departments are optional for the filter
      }
    };
    fetchDepts();
  }, [user?.role]);

  const fetchLoginActivities = useCallback(async () => {
    setLoginLoading(true);
    try {
      const res = await api.get('/login-activity');
      setLoginActivities(res.data?.activities || []);
      } catch (err) {
        console.error('fetchLoginActivities error:', err);
        setLoginActivities([]);
      } finally {
        setLoginLoading(false);
      }
  }, []);

  const fetchAllActivity = useCallback(async () => {
    setNotifLoading(true);
    try {
      const params = {};
      const lastViewed = localStorage.getItem('lastViewedAt');
      if (lastViewed) {
        params.since = lastViewed;
      }
      const res = await api.get('/notifications/recent-activity', { params });
      setAllActivityItems(res.data?.items || []);
      setTotalUnreadCount(res.data?.unreadCount || 0);
    } catch (err) {
      console.error('fetchAllActivity error:', err);
      setAllActivityItems([]);
      setTotalUnreadCount(0);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'login') fetchLoginActivities();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'unread') {
      fetchAllActivity();
      const interval = setInterval(fetchAllActivity, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const markAsRead = async (item) => {
    if (item.type !== 'ACTIVITY' && item.type !== 'LOGIN') {
      try {
        await api.patch(`/notifications/${item.sourceId}/read`);
      } catch (err) {
        console.error('markAsRead error:', err);
      }
    }
    localStorage.setItem('lastViewedAt', new Date().toISOString());
    fetchAllActivity();
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
    } catch (err) {
      console.error('markAllRead error:', err);
    }
    localStorage.setItem('lastViewedAt', new Date().toISOString());
    fetchAllActivity();
  };

  const unreadItems = useMemo(() => {
    return allActivityItems.filter((i) => !i.isRead);
  }, [allActivityItems]);

  // --- Actions tab ---
  const filteredLogs = useMemo(() => {
    const list = activityLogs.filter((log) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        log.user?.email?.toLowerCase().includes(q) ||
        log.user?.fullName?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q) ||
        log.targetId?.toLowerCase().includes(q) ||
        log.metadata?.name?.toLowerCase?.().includes(q);
      const matchesAction =
        actionFilter === 'ALL' || log.action?.startsWith(actionFilter);
      const matchesType =
        typeFilter === 'ALL' || log.action?.includes(typeFilter);
      return matchesSearch && matchesAction && matchesType;
    });
    if (!sortConfig) return list;
    const { key, dir } = sortConfig;
    const factor = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let va;
      let vb;
      if (key === 'date') {
        va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      } else if (key === 'user') {
        va = (a.user?.fullName || a.user?.email || '').toLowerCase();
        vb = (b.user?.fullName || b.user?.email || '').toLowerCase();
      } else if (key === 'action') {
        va = a.action || '';
        vb = b.action || '';
      } else if (key === 'target') {
        va = (a.metadata?.name || a.targetId || '').toLowerCase();
        vb = (b.metadata?.name || b.targetId || '').toLowerCase();
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * factor;
      }
      return String(va).localeCompare(String(vb)) * factor;
    });
  }, [activityLogs, search, actionFilter, typeFilter, sortConfig]);

  const totalPages = Math.ceil(filteredLogs.length / ACTIVITY_PAGE_SIZE) || 1;

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ACTIVITY_PAGE_SIZE;
    return filteredLogs.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  const groupedLogs = useMemo(() => {
    const groups = {};
    paginatedLogs.forEach((log) => {
      const group = getDateGroup(log.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(log);
    });
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    return order.filter((g) => groups[g]).map((g) => ({ label: g, items: groups[g] }));
  }, [paginatedLogs]);

  const startItem =
    filteredLogs.length === 0
      ? 0
      : (currentPage - 1) * ACTIVITY_PAGE_SIZE + 1;
  const endItem = Math.min(
    currentPage * ACTIVITY_PAGE_SIZE,
    filteredLogs.length
  );

  const handleSort = (key) => {
    setSortConfig((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    );
    setCurrentPage(1);
  };

  const sortIcon = (key) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.dir === 'asc' ? (
      <ArrowUp size={12} className="text-indigo-600" />
    ) : (
      <ArrowDown size={12} className="text-indigo-600" />
    );
  };

  // --- Login tab ---
  const filteredLogin = useMemo(() => {
    const q = search.toLowerCase();
    return loginActivities.filter((item) => {
      if (loginStatusFilter !== 'ALL' && item.status !== loginStatusFilter)
        return false;
      if (!q) return true;
      const userName = (
        item.user?.fullName ||
        item.user?.email ||
        ''
      ).toLowerCase();
      const email = (item.user?.email || '').toLowerCase();
      const ip = (item.ipAddress || '').toLowerCase();
      const status = (item.status || '').toLowerCase();
      return (
        userName.includes(q) ||
        email.includes(q) ||
        ip.includes(q) ||
        status.includes(q)
      );
    });
  }, [loginActivities, search, loginStatusFilter]);

  const paginatedLogin = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogin.slice(start, start + PAGE_SIZE);
  }, [filteredLogin, currentPage]);
  const loginTotalPages = Math.ceil(filteredLogin.length / PAGE_SIZE) || 1;

  const groupedLogin = useMemo(() => {
    const groups = {};
    paginatedLogin.forEach((item) => {
      const group = getDateGroup(item.createdAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    const order = ['Today', 'Yesterday', 'This Week', 'Earlier'];
    return order
      .filter((g) => groups[g])
      .map((g) => ({ label: g, items: groups[g] }));
  }, [paginatedLogin]);

  // --- Unread tab ---
  const filteredUnreadItems = useMemo(() => {
    const q = search.toLowerCase();
    return allActivityItems.filter((item) => {
      const matchesSearch =
        !q ||
        (item.title || '').toLowerCase().includes(q) ||
        (item.message || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (unreadTypeFilter === 'ACTIVITY') return item.type === 'ACTIVITY';
      if (unreadTypeFilter === 'LOGIN') return item.type === 'LOGIN';
      if (unreadTypeFilter === 'ALERT')
        return item.type !== 'ACTIVITY' && item.type !== 'LOGIN';

      return true;
    });
  }, [allActivityItems, search, unreadTypeFilter]);

  const paginatedUnread = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUnreadItems.slice(start, start + PAGE_SIZE);
  }, [filteredUnreadItems, currentPage]);
  const unreadTotalPages =
    Math.ceil(filteredUnreadItems.length / PAGE_SIZE) || 1;

  const unreadBadgeCount = useMemo(() => {
    return allActivityItems.filter(
      (i) => !i.isRead
    ).length;
  }, [allActivityItems]);

  // --- Handlers ---
  const resetFilters = () => {
    setSearch('');
    setActionFilter('ALL');
    setTypeFilter('ALL');
    setDeptFilter('ALL');
    setLoginStatusFilter('ALL');
    setUnreadTypeFilter('ALL');
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearch('');
    setActionFilter('ALL');
    setTypeFilter('ALL');
    setDeptFilter('ALL');
    setLoginStatusFilter('ALL');
    setUnreadTypeFilter('ALL');
    setExpandedLogin(null);
  };

  const handleRefresh = () => {
    if (activeTab === 'login') fetchLoginActivities();
    if (activeTab === 'unread') fetchAllActivity();
  };

  const handleExportCSV = () => {
    if (activeTab === 'actions') {
      const headers = ['Date', 'User', 'Email', 'Action', 'TargetID', 'TargetName'];
      const rows = filteredLogs.map((log) => ({
        Date: log.createdAt ? new Date(log.createdAt).toLocaleString() : '',
        User: log.user?.fullName || '',
        Email: log.user?.email || '',
        Action: formatAction(log.action),
        TargetID: log.targetId || '',
        TargetName: log.metadata?.name || '',
      }));
      downloadCSV('activity-log.csv', rows, headers);
    }
    if (activeTab === 'login') {
      const headers = ['Date', 'User', 'Email', 'IPAddress', 'Device', 'Status'];
      const rows = filteredLogin.map((item) => ({
        Date: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
        User: item.user?.fullName || '',
        Email: item.user?.email || '',
        IPAddress: item.ipAddress || '',
        Device: item.userAgent || '',
        Status: item.status || '',
      }));
      downloadCSV('login-history.csv', rows, headers);
    }
    if (activeTab === 'unread') {
      const headers = ['Date', 'Type', 'Title', 'Message'];
      const rows = filteredUnreadItems.map((item) => ({
        Date: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
        Type: item.type || '',
        Title: item.title || '',
        Message: item.message || '',
      }));
      downloadCSV('recent-activity.csv', rows, headers);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 min-w-0">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white px-4 sm:px-6 lg:px-8 py-5 sm:py-7 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-slate-100">Activity Log</h1>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Track actions, login history, and notifications in one place
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto no-scrollbar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'unread' && unreadBadgeCount > 0 && (
                    <span className="ml-2 h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                      {unreadBadgeCount > 99 ? '99+' : unreadBadgeCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <div className="relative w-full sm:w-[340px]">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                />
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                    setExpandedLogin(null);
                  }}
                  placeholder={
                    activeTab === 'actions'
                      ? 'Search by user, action, target...'
                      : activeTab === 'login'
                      ? 'Search by user, IP, status...'
                      : 'Search activity...'
                  }
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30"
                />
              </div>

              {activeTab === 'actions' && (
                <>
                  <select
                    value={actionFilter}
                    onChange={(e) => {
                      setActionFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30"
                  >
                    {ACTION_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30"
                  >
                    {TYPE_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  {departments.length > 0 && (
                    <select
                      value={deptFilter}
                      onChange={(e) => {
                        setDeptFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30"
                    >
                      <option value="ALL">All Departments</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}

              {activeTab === 'login' && (
                <select
                  value={loginStatusFilter}
                  onChange={(e) => {
                    setLoginStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/30"
                >
                  {LOGIN_STATUS_FILTERS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              )}

              {activeTab === 'unread' && (
                <div className="flex gap-2">
                  {UNREAD_TYPE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => {
                        setUnreadTypeFilter(f.value);
                        setCurrentPage(1);
                      }}
                      className={`h-11 px-4 rounded-xl text-sm font-semibold border transition ${
                        unreadTypeFilter === f.value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <RotateCcw size={16} />
                Reset
              </button>

              {(activeTab === 'login' || activeTab === 'unread') && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loginLoading || notifLoading}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <RefreshCw
                    size={16}
                    className={loginLoading || notifLoading ? 'animate-spin' : ''}
                  />
                  Refresh
                </button>
              )}

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <Download size={16} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* ── Actions Tab ── */}
        {activeTab === 'actions' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            {activityLoading && (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                Loading activity logs...
              </div>
            )}
            {error && (
              <div className="m-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            {!activityLoading && !error && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <th className="px-4 sm:px-6 py-3.5 sm:py-4">
                          <button
                            onClick={() => handleSort('date')}
                            className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            Date
                            {sortIcon('date')}
                          </button>
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 sm:py-4">
                          <button
                            onClick={() => handleSort('user')}
                            className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            User
                            {sortIcon('user')}
                          </button>
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 sm:py-4">
                          <button
                            onClick={() => handleSort('action')}
                            className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            Action
                            {sortIcon('action')}
                          </button>
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 sm:py-4">
                          <button
                            onClick={() => handleSort('target')}
                            className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            Target
                            {sortIcon('target')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedLogs.map((group, gi) => (
                        <Fragment key={group.label}>
                          {gi > 0 && (
                            <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                              <td colSpan={4} className="p-0" />
                            </tr>
                          )}
                          {group.items.map((log) => (
                            <tr
                              key={log.id}
                              className="border-t border-slate-100 hover:bg-slate-50/70 dark:border-slate-700 dark:hover:bg-slate-700/50"
                            >
                              <td className="whitespace-nowrap px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                                {log.createdAt
                                  ? new Date(log.createdAt).toLocaleString()
                                  : '-'}
                              </td>
                              <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm">
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-slate-100">
                                    {log.user?.fullName || 'User'}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {log.user?.email || '-'}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 sm:px-6 py-3.5 sm:py-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold ${getActionBadge(log.action)}`}
                                >
                                  {getActionIcon(log.action)}
                                  {formatAction(log.action)}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">
                                    {log.metadata?.name || log.targetId || '-'}
                                  </p>
                                  {log.metadata?.personalVault && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-700 shrink-0 dark:bg-teal-900/20 dark:text-teal-400">
                                      Personal Vault
                                    </span>
                                  )}
                                  {log.metadata?.vaultType === 'COMPANY' && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0 dark:bg-amber-900/20 dark:text-amber-400">
                                      Company Vault
                                    </span>
                                  )}
                                </div>
                                {log.metadata?.name && log.targetId && (
                                  <p className="text-xs text-slate-400 dark:text-slate-500">
                                    {log.targetId}
                                  </p>
                                )}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!filteredLogs.length && (
                  <div className="py-14 text-center">
                    <p className="text-slate-500 dark:text-slate-400">
                      No activity logs matched your filters.
                    </p>
                  </div>
                )}

                {filteredLogs.length > 0 && (
                  <div className="flex flex-col gap-3 sm:gap-4 border-t border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Showing {startItem} - {endItem} of {filteredLogs.length}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm disabled:opacity-50 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Previous
                      </button>
                      {renderPageButtons(currentPage, totalPages, setCurrentPage)}
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(p + 1, totalPages))
                        }
                        disabled={currentPage === totalPages}
                        className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm disabled:opacity-50 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Login Tab ── */}
        {activeTab === 'login' && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            {loginLoading && (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                Loading login history...
              </div>
            )}
            {!loginLoading && (
              <>
                {groupedLogin.map((group, gi) => (
                  <div key={group.label}>
                    {gi > 0 && (
                      <div className="border-t-2 border-slate-200 dark:border-slate-700" />
                    )}
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {group.items.map((item) => (
                        <div key={item.id}>
                          <div
                            onClick={() =>
                              setExpandedLogin(
                                expandedLogin === item.id ? null : item.id
                              )
                            }
                            className="flex items-center gap-3 sm:gap-4 px-3.5 sm:px-6 py-3.5 sm:py-4 hover:bg-slate-50/70 cursor-pointer dark:hover:bg-slate-700/50"
                          >
                            <div className="shrink-0">
                              {expandedLogin === item.id ? (
                                <ChevronDown
                                  size={16}
                                  className="text-slate-400 dark:text-slate-500"
                                />
                              ) : (
                                <ChevronRight
                                  size={16}
                                  className="text-slate-400 dark:text-slate-500"
                                />
                              )}
                            </div>
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold shrink-0">
                              {item.user?.fullName?.charAt(0) || 'U'}
                            </div>
                            <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 text-xs sm:text-sm items-center">
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate dark:text-slate-100">
                                  {item.user?.fullName || 'User'}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate sm:hidden dark:text-slate-400">
                                  {item.user?.email || '-'}
                                </p>
                              </div>
                              <div className="text-slate-600 truncate hidden sm:block dark:text-slate-300">
                                {item.user?.email || '-'}
                              </div>
                              <div className="text-slate-600 text-xs hidden md:block dark:text-slate-300">
                                {item.ipAddress || '-'}
                              </div>
                              <div>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold ${
                                    item.status === 'SUCCESS'
                                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                      : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                  }`}
                                >
                                  {item.status || '-'}
                                </span>
                              </div>
                              <div className="text-slate-500 text-xs whitespace-nowrap text-right lg:text-left dark:text-slate-400">
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleString()
                                  : '-'}
                              </div>
                            </div>
                          </div>
                          {expandedLogin === item.id && (
                            <div className="bg-slate-50 px-4 sm:px-6 py-4 border-t border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm sm:ml-9">
                                <div>
                                  <p className="text-xs text-slate-400 mb-1 dark:text-slate-500">
                                    IP Address
                                  </p>
                                  <p className="text-slate-700 dark:text-slate-300">
                                    {item.ipAddress || '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-1 dark:text-slate-500">
                                    Status
                                  </p>
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                      item.status === 'SUCCESS'
                                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                                    }`}
                                  >
                                    {item.status || '-'}
                                  </span>
                                </div>
                                <div className="col-span-1 sm:col-span-2">
                                  <p className="text-xs text-slate-400 mb-1 dark:text-slate-500">
                                    Device / User Agent
                                  </p>
                                  <p className="text-slate-700 text-xs break-words dark:text-slate-300">
                                    {item.userAgent || '-'}
                                  </p>
                                </div>
                                {item.location && (
                                  <div className="col-span-1 sm:col-span-2">
                                    <p className="text-xs text-slate-400 mb-1 dark:text-slate-500">
                                      Location
                                    </p>
                                    <p className="text-slate-700 dark:text-slate-300">
                                      {item.location}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {!filteredLogin.length && (
                  <div className="py-14 text-center">
                    <p className="text-slate-500 dark:text-slate-400">No login history found.</p>
                  </div>
                )}

                {filteredLogin.length > PAGE_SIZE && (
                  <div className="flex flex-col gap-3 sm:gap-4 border-t border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                      Page {currentPage} of {loginTotalPages}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(p - 1, 1))
                        }
                        disabled={currentPage === 1}
                        className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm disabled:opacity-50 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Previous
                      </button>
                      {renderSimplePageButtons(currentPage, loginTotalPages, setCurrentPage)}
                      <button
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(p + 1, loginTotalPages)
                          )
                        }
                        disabled={currentPage === loginTotalPages}
                        className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm disabled:opacity-50 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Unread Tab ── */}
        {activeTab === 'unread' && (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden dark:border-slate-700 dark:bg-slate-800">
            {/* Unread header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {filteredUnreadItems.length} item
                  {filteredUnreadItems.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-300 inline-block" />
                    {allActivityItems.filter((i) => i.type === 'ACTIVITY').length} actions
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />
                    {allActivityItems.filter((i) => i.type === 'LOGIN').length} logins
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-indigo-400 inline-block" />
                    {allActivityItems.filter((i) => i.type !== 'ACTIVITY' && i.type !== 'LOGIN').length} alerts
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {totalUnreadCount > 0 && (
                  <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount} unread
                  </span>
                )}
                {unreadItems.length > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs sm:text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition dark:text-indigo-400"
                  >
                    Mark all read
                  </button>
                )}
              </div>
            </div>

            {notifLoading && (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                Loading activity...
              </div>
            )}

            {!notifLoading && (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {paginatedUnread.map((item) => {
                  const { icon, className: iconClass } = getUnreadItemIcon(
                    item.type,
                    item.meta
                  );
                  const { label: badgeLabel, className: badgeClass } =
                    getTypeBadge(item.type);
                  const isAlert =
                    item.type !== 'ACTIVITY' && item.type !== 'LOGIN';
                  const isUnread = !item.isRead;

                  return (
                    <div
                      key={item.id}
                      onClick={() => isAlert && markAsRead(item)}
                      className={`flex items-start gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-4 transition ${
                        isAlert ? 'hover:bg-slate-50 cursor-pointer dark:hover:bg-slate-700' : ''
                      } ${isUnread ? 'bg-indigo-50/30 dark:bg-indigo-900/20' : ''}`}
                    >
                      {/* Icon */}
                      <div
                        className={`h-8 sm:h-9 w-8 sm:w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconClass}`}
                      >
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isUnread ? (
                            <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                          ) : isAlert ? (
                            <CheckCircle2
                              size={13}
                              className="text-green-500 shrink-0"
                            />
                          ) : null}
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {item.title}
                          </p>
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}`}
                          >
                            {badgeLabel}
                          </span>
                        </div>
                        {item.message && (
                          <p className="text-xs text-slate-500 mt-1 truncate dark:text-slate-400">
                            {item.message}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1.5 dark:text-slate-500">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!notifLoading && !paginatedUnread.length && (
              <div className="py-14 text-center">
                <p className="text-slate-500 dark:text-slate-400">
                  {search || unreadTypeFilter !== 'ALL'
                    ? 'No items match your filters.'
                    : 'No recent activity.'}
                </p>
              </div>
            )}

            {filteredUnreadItems.length > PAGE_SIZE && (
              <div className="flex flex-col gap-3 sm:gap-4 border-t border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Page {currentPage} of {unreadTotalPages} · {filteredUnreadItems.length} total
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm disabled:opacity-50 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Previous
                  </button>
                  {renderSimplePageButtons(currentPage, unreadTotalPages, setCurrentPage)}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, unreadTotalPages))
                    }
                    disabled={currentPage === unreadTotalPages}
                    className="rounded-xl border border-slate-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm disabled:opacity-50 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default ActivityLogPage;