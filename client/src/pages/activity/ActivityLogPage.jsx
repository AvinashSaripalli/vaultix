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
  Sparkles,
  Globe,
  Monitor,
  Smartphone,
  Laptop,
  CheckCheck,
  Copy,
  Check,
  MapPin,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import AppLayout from '../../components/layout/AppLayout';
import { fetchActivityLogs } from '../../features/vault/vaultSlice';
import api from '../../services/api';
import {
  formatItemAction,
  getActionBadge,
  getActionIcon,
  resolveItemType,
  resolveFieldLabel,
  getItemTypeBadge,
} from '../../utils/activityActionFormatter';

const PAGE_SIZE = 10;
const ACTIVITY_PAGE_SIZE = 10;

const ACTION_FILTERS = [
  { label: 'All Actions', value: 'ALL' },
  { label: 'Create', value: 'CREATE' },
  { label: 'Update', value: 'UPDATE' },
  { label: 'Delete / Revoke', value: 'DELETE' },
  { label: 'Restore', value: 'RESTORE' },
  { label: 'Autofill', value: 'AUTOFILL' },
  { label: 'View', value: 'VIEW' },
  { label: 'Copy', value: 'COPY' },
  { label: 'Share / Grant', value: 'SHARE' },
];

const TYPE_FILTERS = [
  { label: 'All Types', value: 'ALL' },
  { label: 'Password', value: 'PASSWORD' },
  { label: 'Folder', value: 'FOLDER' },
  { label: 'Vault', value: 'VAULT' },
  { label: 'Department', value: 'DEPARTMENT' },
  { label: 'User / Admin', value: 'USER' },
  { label: 'Security & 2FA', value: 'SECURITY' },
  { label: 'Approval', value: 'APPROVAL' },
];

const VAULT_SCOPE_FILTERS = [
  { label: 'All Vaults', value: 'ALL' },
  { label: 'Personal Vault', value: 'PERSONAL' },
  { label: 'Company Vaults', value: 'COMPANY' },
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

function formatAction(action, metadata = {}, log = null) {
  return formatItemAction(action, metadata, log);
}

function parseUserAgent(ua = '') {
  if (!ua) return { device: 'Desktop', browser: 'Web Browser', label: 'Web Browser', icon: 'monitor' };

  let browser = 'Web Browser';
  let device = 'Desktop';
  let icon = 'monitor';

  // Check device/OS
  if (/android/i.test(ua)) {
    device = 'Android';
    icon = 'smartphone';
  } else if (/ipad|iphone|ipod/i.test(ua)) {
    device = 'iOS';
    icon = 'smartphone';
  } else if (/macintosh|mac os x/i.test(ua)) {
    device = 'macOS';
    icon = 'laptop';
  } else if (/windows/i.test(ua)) {
    device = 'Windows';
    icon = 'monitor';
  } else if (/linux/i.test(ua)) {
    device = 'Linux';
    icon = 'monitor';
  }

  // Check browser / client
  if (/vaultix-mobile|vaultix mobile|capacitor/i.test(ua)) {
    browser = 'Vaultix Mobile App';
    icon = 'smartphone';
  } else if (/vaultix-extension|chrome-extension/i.test(ua)) {
    browser = 'Vaultix Extension';
  } else if (/edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Mozilla Firefox';
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/postman/i.test(ua)) {
    browser = 'Postman API';
  }

  return { device, browser, label: `${browser} • ${device}`, icon };
}

function renderDeviceIcon(iconType) {
  if (iconType === 'smartphone') return <Smartphone size={14} className="text-slate-500 shrink-0" />;
  if (iconType === 'laptop') return <Laptop size={14} className="text-slate-500 shrink-0" />;
  return <Monitor size={14} className="text-slate-500 shrink-0" />;
}

function getUnreadItemIcon(type, meta) {
  if (type === 'LOGIN') {
    const isSuccess = meta?.status === 'SUCCESS';
    return {
      icon: <LogIn size={15} />,
      className: isSuccess
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
        : 'bg-rose-50 text-rose-600 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60',
    };
  }
  if (type === 'ACTIVITY') {
    const action = meta?.action || '';
    if (action.includes('PASSWORD'))
      return {
        icon: <KeyRound size={15} />,
        className: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
      };
    if (action.includes('FOLDER'))
      return {
        icon: <Folder size={15} />,
        className: 'bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/60',
      };
    if (action.includes('VAULT'))
      return {
        icon: <Database size={15} />,
        className: 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60',
      };
    return {
      icon: <Activity size={15} />,
      className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    };
  }
  if (type === 'SHARE_PASSWORD' || type === 'SHARE_FOLDER' || type === 'SHARE_VAULT')
    return {
      icon: <Share2 size={15} />,
      className: 'bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60',
    };
  if (type === 'SECURITY' || type === 'WEAK_PASSWORD')
    return {
      icon: <ShieldAlert size={15} />,
      className: 'bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60',
    };
  return {
    icon: <Bell size={15} />,
    className: 'bg-sky-50 text-sky-700 border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60',
  };
}

function getTypeBadge(type) {
  if (type === 'LOGIN') return { label: 'Login', className: 'bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400' };
  if (type === 'ACTIVITY') return { label: 'Action', className: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' };
  return { label: 'Alert', className: 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-400' };
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

const AVATAR_COLORS = [
  'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60',
  'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60',
  'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/60',
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60',
  'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60',
];

function getAvatarColorClass(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getUserInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'U';
}

function formatFriendlyDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return 'Today';
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
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
        className={`h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition ${
          current === page
            ? 'bg-indigo-600 text-white shadow-xs'
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
        <span key={`ellipsis-${idx}`} className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex items-center justify-center text-xs sm:text-sm text-slate-400 dark:text-slate-500">
          ...
        </span>
      );
    }
    return (
      <button
        key={page}
        onClick={() => onPageChange(page)}
        className={`h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition ${
          current === page
            ? 'bg-indigo-600 text-white shadow-xs'
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
        className={`h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition ${
          current === page
            ? 'bg-indigo-600 text-white shadow-xs'
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
        <span key={`ellipsis-${idx}`} className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 flex items-center justify-center text-xs sm:text-sm text-slate-400 dark:text-slate-500">
          ...
        </span>
      );
    }
    return (
      <button
        key={page}
        onClick={() => onPageChange(page)}
        className={`h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition ${
          current === page
            ? 'bg-indigo-600 text-white shadow-xs'
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
  const [vaultScopeFilter, setVaultScopeFilter] = useState('ALL');
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
    if (!['SUPER_ADMIN', 'ADMIN'].includes(user?.role)) return;

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
      const res = await api.get('/notifications/recent-activity');
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
    fetchAllActivity();
  }, [fetchAllActivity]);

  useEffect(() => {
    if (activeTab === 'login') fetchLoginActivities();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'unread') {
      fetchAllActivity();
      const interval = setInterval(fetchAllActivity, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchAllActivity]);

  useEffect(() => {
    const onUpdate = () => fetchAllActivity();
    window.addEventListener('vaultix:notifications-updated', onUpdate);
    return () => window.removeEventListener('vaultix:notifications-updated', onUpdate);
  }, [fetchAllActivity]);

  const markAsRead = async (item) => {
    try {
      await api.patch(`/notifications/${item.id}/read`);
    } catch (err) {
      console.error('markAsRead error:', err);
    }
    window.dispatchEvent(new CustomEvent('vaultix:notifications-updated'));
    fetchAllActivity();
  };

  const markAllRead = async () => {
    setTotalUnreadCount(0);
    window.dispatchEvent(new CustomEvent('vaultix:unread-count', { detail: 0 }));
    try {
      await api.patch('/notifications/mark-all-read');
    } catch (err) {
      console.error('markAllRead error:', err);
    }
    window.dispatchEvent(new CustomEvent('vaultix:notifications-updated'));
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
        log.metadata?.currentName?.toLowerCase?.().includes(q) ||
        log.metadata?.historicalName?.toLowerCase?.().includes(q) ||
        log.metadata?.previousName?.toLowerCase?.().includes(q) ||
        log.metadata?.newName?.toLowerCase?.().includes(q) ||
        log.metadata?.login?.toLowerCase?.().includes(q) ||
        log.metadata?.domain?.toLowerCase?.().includes(q) ||
        log.metadata?.name?.toLowerCase?.().includes(q);
      const matchesAction =
        actionFilter === 'ALL' ||
        log.action?.startsWith(actionFilter) ||
        (actionFilter === 'DELETE' && (log.action?.startsWith('REVOKE') || log.action?.startsWith('UNSHARE') || log.action?.startsWith('REMOVE'))) ||
        (actionFilter === 'SHARE' && log.action?.startsWith('GRANT'));

      let matchesType = true;
      if (typeFilter !== 'ALL') {
        if (typeFilter === 'SECURITY') {
          matchesType = ['ENABLE_2FA', 'DISABLE_2FA', 'VERIFY_EMAIL', 'REVOKE_SESSION', 'LOGIN', 'REGISTER', 'POLICY'].some((a) =>
            log.action?.includes(a)
          );
        } else if (typeFilter === 'APPROVAL') {
          matchesType =
            log.action?.includes('APPROVAL') ||
            log.action?.includes('APPROVE') ||
            log.action?.includes('REJECT');
        } else {
          matchesType =
            log.action?.includes(typeFilter) ||
            log.targetType?.toUpperCase()?.includes(typeFilter);
        }
      }

      let matchesVaultScope = true;
      if (vaultScopeFilter === 'PERSONAL') {
        matchesVaultScope = Boolean(log.metadata?.personalVault || log.metadata?.vaultType === 'PERSONAL');
      } else if (vaultScopeFilter === 'COMPANY') {
        matchesVaultScope = !log.metadata?.personalVault && log.metadata?.vaultType !== 'PERSONAL';
      }

      return matchesSearch && matchesAction && matchesType && matchesVaultScope;
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
        va = (a.metadata?.currentName || a.metadata?.name || a.targetId || '').toLowerCase();
        vb = (b.metadata?.currentName || b.metadata?.name || b.targetId || '').toLowerCase();
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * factor;
      }
      return String(va).localeCompare(String(vb)) * factor;
    });
  }, [activityLogs, search, actionFilter, typeFilter, vaultScopeFilter, sortConfig]);

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

  const unreadBadgeCount = totalUnreadCount;

  // --- Handlers ---
  const resetFilters = () => {
    setSearch('');
    setActionFilter('ALL');
    setTypeFilter('ALL');
    setVaultScopeFilter('ALL');
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
    setVaultScopeFilter('ALL');
    setDeptFilter('ALL');
    setLoginStatusFilter('ALL');
    setUnreadTypeFilter('ALL');
    setExpandedLogin(null);
  };

  const handleRefresh = () => {
    if (activeTab === 'actions') dispatch(fetchActivityLogs());
    if (activeTab === 'login') fetchLoginActivities();
    if (activeTab === 'unread') fetchAllActivity();
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
    actionFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    vaultScopeFilter !== 'ALL' ||
    deptFilter !== 'ALL' ||
    loginStatusFilter !== 'ALL' ||
    unreadTypeFilter !== 'ALL'
  );

  const handleExportCSV = () => {
    if (activeTab === 'actions') {
      const headers = ['Date', 'User', 'Email', 'Action', 'TargetID', 'TargetName', 'ItemType', 'Field'];
      const rows = filteredLogs.map((log) => {
        const itemType = resolveItemType(log);
        const fieldName = log.metadata?.fieldName;
        return {
          Date: log.createdAt ? new Date(log.createdAt).toLocaleString() : '',
          User: log.user?.fullName || '',
          Email: log.user?.email || '',
          Action: formatItemAction(log.action, log.metadata, log),
          TargetID: log.targetId || '',
          TargetName: log.metadata?.currentName || log.metadata?.name || '',
          ItemType: itemType || log.targetType || '',
          Field: fieldName ? resolveFieldLabel(fieldName, itemType) : '',
        };
      });
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
        {/* Header & Controls Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <div className="flex flex-col gap-4">
            {/* Top row: Title + Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  Activity Log
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Audit trail of vault access, credential usage, and security events.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loginLoading || notifLoading || activityLoading}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition shadow-xs"
                >
                  <RefreshCw
                    size={13}
                    className={loginLoading || notifLoading || activityLoading ? 'animate-spin' : ''}
                  />
                  <span>Refresh</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition shadow-xs"
                >
                  <Download size={13} />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto no-scrollbar">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`pb-2.5 px-3 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                  {tab.id === 'unread' && unreadBadgeCount > 0 && (
                    <span className="ml-2 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                      {unreadBadgeCount > 99 ? '99+' : unreadBadgeCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Single-Row Clean Filter Bar (Zero Clutter) */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <div className="relative flex-1 w-full">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
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
                      ? 'Filter by user, action, target...'
                      : activeTab === 'login'
                      ? 'Filter by user, IP, status...'
                      : 'Filter activity...'
                  }
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-4 text-xs sm:text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:placeholder-slate-500 dark:focus:ring-indigo-950/40"
                />
              </div>

              {activeTab === 'actions' && (
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar shrink-0">
                  <select
                    value={vaultScopeFilter}
                    onChange={(e) => {
                      setVaultScopeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 cursor-pointer transition shadow-2xs"
                  >
                    {VAULT_SCOPE_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        Vault: {item.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={actionFilter}
                    onChange={(e) => {
                      setActionFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 cursor-pointer transition shadow-2xs"
                  >
                    {ACTION_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        Action: {item.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 cursor-pointer transition shadow-2xs"
                  >
                    {TYPE_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        Type: {item.label}
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
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 cursor-pointer transition shadow-2xs"
                    >
                      <option value="ALL">Dept: All</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {activeTab === 'login' && (
                <div className="w-full sm:w-auto shrink-0">
                  <select
                    value={loginStatusFilter}
                    onChange={(e) => {
                      setLoginStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 cursor-pointer transition shadow-2xs"
                  >
                    {LOGIN_STATUS_FILTERS.map((item) => (
                      <option key={item.value} value={item.value}>
                        Status: {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeTab === 'unread' && (
                <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                  {UNREAD_TYPE_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => {
                        setUnreadTypeFilter(f.value);
                        setCurrentPage(1);
                      }}
                      className={`h-9 px-3 rounded-xl text-xs font-bold border transition ${
                        unreadTypeFilter === f.value
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
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
                {/* Mobile View: Clean card layout (< md) */}
                <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedLogs.map((log) => {
                    const itemType = resolveItemType(log);
                    const label = formatItemAction(log.action, log.metadata, log);
                    const badgeClass = getActionBadge(log.action, itemType);
                    const icon = getActionIcon(log.action, itemType, log.metadata?.fieldName);
                    const rawName = log.metadata?.currentName || log.metadata?.name;
                    const isRawIdOnly = !rawName && log.targetId;
                    const displayName = rawName || (isRawIdOnly ? `Item (${log.targetId.slice(0, 8)}...)` : '-');
                    const userName = log.user?.fullName || log.user?.email || 'User';

                    return (
                      <div key={log.id} className="p-4 space-y-2 hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${badgeClass}`}>
                              {icon}
                            </div>
                            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                              {label}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium shrink-0">
                            {formatFriendlyDate(log.createdAt)} {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <div className="pl-9 min-w-0">
                          <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {displayName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                            {log.metadata?.domain ? `${log.metadata.domain} • ` : ''}
                            {log.metadata?.login ? `${log.metadata.login} • ` : ''}
                            {userName}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop & Tablet View: Structured Table (>= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[760px] table-fixed">
                    <thead className="bg-slate-50/70 border-b border-slate-200/80 dark:border-slate-800/80 dark:bg-slate-850/60">
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <th className="w-[220px] px-5 py-3.5">
                          <button
                            onClick={() => handleSort('action')}
                            className="inline-flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition"
                          >
                            Event
                            {sortIcon('action')}
                          </button>
                        </th>
                        <th className="px-5 py-3.5">
                          <button
                            onClick={() => handleSort('target')}
                            className="inline-flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition"
                          >
                            Resource
                            {sortIcon('target')}
                          </button>
                        </th>
                        <th className="w-[250px] px-5 py-3.5">
                          <button
                            onClick={() => handleSort('user')}
                            className="inline-flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition"
                          >
                            User
                            {sortIcon('user')}
                          </button>
                        </th>
                        <th className="w-[140px] px-5 py-3.5 text-right">
                          <button
                            onClick={() => handleSort('date')}
                            className="inline-flex items-center gap-1.5 hover:text-slate-800 dark:hover:text-slate-200 transition ml-auto"
                          >
                            Time
                            {sortIcon('date')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {groupedLogs.map((group, gi) => (
                        <Fragment key={group.label}>
                          {gi > 0 && (
                            <tr className="border-t-2 border-slate-100 dark:border-slate-800">
                              <td colSpan={4} className="p-0" />
                            </tr>
                          )}
                          {group.items.map((log) => {
                            const itemType = resolveItemType(log);
                            const label = formatItemAction(log.action, log.metadata, log);
                            const badgeClass = getActionBadge(log.action, itemType);
                            const icon = getActionIcon(log.action, itemType, log.metadata?.fieldName);
                            const typeBadge = getItemTypeBadge(itemType);
                            const rawName = log.metadata?.currentName || log.metadata?.name;
                            const isRawIdOnly = !rawName && log.targetId;
                            const displayName = rawName || (isRawIdOnly ? `Item (${log.targetId.slice(0, 8)}...)` : '-');
                            const userName = log.user?.fullName || log.user?.email || 'User';
                            const hasRenameAudit = Boolean(
                              log.metadata?.renamed ||
                              (log.metadata?.previousName && log.metadata?.newName && log.metadata?.previousName !== log.metadata?.newName)
                            );

                            return (
                              <tr
                                key={log.id}
                                className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors"
                              >
                                {/* EVENT */}
                                <td className="align-middle px-5 py-3.5">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${badgeClass}`}>
                                      {icon}
                                    </div>
                                    <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                                      {label}
                                    </span>
                                  </div>
                                </td>

                                {/* RESOURCE */}
                                <td className="align-middle px-5 py-3.5">
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate"
                                        title={log.targetId ? `Item ID: ${log.targetId}` : undefined}
                                      >
                                        {displayName}
                                      </span>
                                      {typeBadge && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${typeBadge.className}`}>
                                          {typeBadge.label}
                                        </span>
                                      )}
                                    </div>

                                    {/* Clean, calm 2nd line metadata */}
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                                      {log.metadata?.domain && (
                                        <>
                                          <span className="text-indigo-600 dark:text-indigo-400 truncate max-w-[190px]">
                                            {log.metadata.domain}
                                          </span>
                                          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                                        </>
                                      )}
                                      {log.metadata?.login && (
                                        <>
                                          <span className="text-slate-700 dark:text-slate-300 truncate max-w-[150px]">
                                            {log.metadata.login}
                                          </span>
                                          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                                        </>
                                      )}
                                      <span className="text-slate-400 dark:text-slate-500 truncate">
                                        {log.metadata?.personalVault
                                          ? 'Personal Vault'
                                          : log.metadata?.vaultType === 'COMPANY'
                                          ? 'Company Vault'
                                          : log.metadata?.clientSource === 'EXTENSION' || log.action === 'AUTOFILL_PASSWORD'
                                          ? 'Extension'
                                          : 'Vault'}
                                      </span>
                                      {hasRenameAudit && (
                                        <>
                                          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
                                          <span className="text-indigo-500 font-sans truncate">
                                            Renamed: {log.metadata.previousName} → {log.metadata.newName}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* USER */}
                                <td className="align-middle px-5 py-3.5">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarColorClass(userName)}`}>
                                      {getUserInitials(log.user?.fullName, log.user?.email)}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate" title={log.user?.fullName}>
                                          {userName}
                                        </p>
                                        {log.user?.role === 'SUPER_ADMIN' && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0">
                                            Admin
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5" title={log.user?.email}>
                                        {log.user?.email || '-'}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* TIME */}
                                <td className="align-middle px-5 py-3.5 text-right whitespace-nowrap">
                                  {log.createdAt ? (
                                    <div>
                                      <p className="font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                                        {new Date(log.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                      </p>
                                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                        {formatFriendlyDate(log.createdAt)}
                                      </p>
                                    </div>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                              </tr>
                            );
                          })}
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
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                      Showing {startItem} - {endItem} of {filteredLogs.length}
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 sm:gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-8 sm:h-9 md:h-10 rounded-lg sm:rounded-xl border border-slate-300 px-3 sm:px-4 text-xs sm:text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                      >
                        Previous
                      </button>
                      {renderPageButtons(currentPage, totalPages, setCurrentPage)}
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(p + 1, totalPages))
                        }
                        disabled={currentPage === totalPages}
                        className="h-8 sm:h-9 md:h-10 rounded-lg sm:rounded-xl border border-slate-300 px-3 sm:px-4 text-xs sm:text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
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
                {/* Desktop View Header (>= md) */}
                <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                  <div className="col-span-4">User</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3">Device & Browser</div>
                  <div className="col-span-3 text-right">IP & Timestamp</div>
                </div>

                {/* Mobile View (< md) */}
                <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
                  {paginatedLogin.map((item) => {
                    const initials = getUserInitials(item.user?.fullName, item.user?.email);
                    const avatarColor = getAvatarColorClass(item.user?.email || item.user?.fullName);
                    const parsedUA = parseUserAgent(item.userAgent);
                    const isSuccess = item.status === 'SUCCESS';
                    const isExpanded = expandedLogin === item.id;
                    const dateFormatted = formatFriendlyDate(item.createdAt);
                    const timeFormatted = item.createdAt
                      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div key={item.id} className="p-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-750/50">
                        {/* Top: User info + Status badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`h-8 w-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate dark:text-white">
                                {item.user?.fullName || 'User'}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate dark:text-slate-500">
                                {item.user?.email || '-'}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold shrink-0 ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                                : 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
                            }`}
                          >
                            {isSuccess ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                            <span>{isSuccess ? 'Successful' : item.status || 'Failed'}</span>
                          </span>
                        </div>

                        {/* Mid: Device & IP */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                            {renderDeviceIcon(parsedUA.icon)}
                            <span>{parsedUA.label}</span>
                          </span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {item.ipAddress || '-'}
                          </span>
                          {item.location && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                              <MapPin size={11} /> {item.location}
                            </span>
                          )}
                        </div>

                        {/* Bottom: Date & Expand toggle */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100/80 dark:border-slate-700/40">
                          <span>
                            {timeFormatted} · {dateFormatted}
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedLogin(isExpanded ? null : item.id)}
                            className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                          >
                            <span>{isExpanded ? 'Hide info' : 'Inspect'}</span>
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        </div>

                        {/* Forensic Drawer for Mobile */}
                        {isExpanded && (
                          <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-2">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">User Agent String</span>
                              <p className="font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                                {item.userAgent || 'No user agent recorded'}
                              </p>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-slate-400">Exact Timestamp</span>
                              <span className="font-mono text-slate-700 dark:text-slate-300">
                                {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View Rows (>= md) */}
                <div className="hidden md:block divide-y divide-slate-100 dark:divide-slate-700/60">
                  {paginatedLogin.map((item) => {
                    const initials = getUserInitials(item.user?.fullName, item.user?.email);
                    const avatarColor = getAvatarColorClass(item.user?.email || item.user?.fullName);
                    const parsedUA = parseUserAgent(item.userAgent);
                    const isSuccess = item.status === 'SUCCESS';
                    const isExpanded = expandedLogin === item.id;
                    const dateFormatted = formatFriendlyDate(item.createdAt);
                    const timeFormatted = item.createdAt
                      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div key={item.id} className="transition">
                        <div
                          onClick={() => setExpandedLogin(isExpanded ? null : item.id)}
                          className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center hover:bg-slate-50/70 dark:hover:bg-slate-750/50 cursor-pointer"
                        >
                          {/* Col 1-4: User */}
                          <div className="col-span-4 flex items-center gap-3 min-w-0">
                            <div className={`h-8 w-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor}`}>
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate dark:text-white">
                                  {item.user?.fullName || 'User'}
                                </p>
                                {['SUPER_ADMIN', 'ADMIN'].includes(item.user?.role) && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 dark:bg-indigo-950/50 dark:text-indigo-300 shrink-0">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 truncate dark:text-slate-500">
                                {item.user?.email || '-'}
                              </p>
                            </div>
                          </div>

                          {/* Col 5-6: Status */}
                          <div className="col-span-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                                isSuccess
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60'
                              }`}
                            >
                              {isSuccess ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}
                              <span>{isSuccess ? 'Successful' : item.status || 'Failed'}</span>
                            </span>
                          </div>

                          {/* Col 7-9: Device & Browser */}
                          <div className="col-span-3 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 shrink-0">
                                {renderDeviceIcon(parsedUA.icon)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {parsedUA.label}
                                </p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                                  {parsedUA.device}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Col 10-12: Origin & Timestamp */}
                          <div className="col-span-3 flex items-center justify-between text-right">
                            <div className="min-w-0 flex-1 pr-3">
                              <p className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
                                {item.ipAddress || '-'}
                              </p>
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                {timeFormatted} · <span className="font-medium text-slate-600 dark:text-slate-400">{dateFormatted}</span>
                              </p>
                            </div>
                            <div className="text-slate-400 dark:text-slate-500 shrink-0">
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Security Inspector Box */}
                        {isExpanded && (
                          <div className="bg-slate-50/80 px-6 py-4 border-t border-b border-slate-100 dark:bg-slate-800/60 dark:border-slate-700/80">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              {/* Card 1: Auth Security */}
                              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800 shadow-2xs">
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                  <ShieldCheck size={14} className="text-indigo-500" />
                                  <span className="text-[11px] font-bold uppercase tracking-wider">Authentication Verdict</span>
                                </div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                  {isSuccess ? 'Verified Session & Credentials' : 'Authentication Denied / Blocked'}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                  Timestamp: <span className="font-mono text-slate-700 dark:text-slate-300">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</span>
                                </p>
                              </div>

                              {/* Card 2: Network Origin */}
                              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800 shadow-2xs">
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                  <Globe size={14} className="text-blue-500" />
                                  <span className="text-[11px] font-bold uppercase tracking-wider">Network Origin</span>
                                </div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-mono font-bold text-slate-900 dark:text-white">{item.ipAddress || 'Unknown IP'}</span>
                                  {item.ipAddress && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard.writeText(item.ipAddress);
                                      }}
                                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-semibold flex items-center gap-1"
                                    >
                                      <Copy size={11} /> Copy
                                    </button>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <MapPin size={11} /> {item.location || 'Local / Enterprise Subnet'}
                                </p>
                              </div>

                              {/* Card 3: Client Fingerprint */}
                              <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800 shadow-2xs">
                                <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                                  <Monitor size={14} className="text-emerald-500" />
                                  <span className="text-[11px] font-bold uppercase tracking-wider">Client Fingerprint</span>
                                </div>
                                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                  {parsedUA.browser} on {parsedUA.device}
                                </p>
                                <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 break-all leading-tight">
                                  {item.userAgent || 'No user agent header provided'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!filteredLogin.length && (
                  <div className="py-14 text-center">
                    <p className="text-slate-500 dark:text-slate-400">No login history found matching your filters.</p>
                  </div>
                )}

                {filteredLogin.length > PAGE_SIZE && (
                  <div className="flex flex-col gap-3 sm:gap-4 border-t border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                      Page {currentPage} of {loginTotalPages} · {filteredLogin.length} total
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 sm:gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(p - 1, 1))
                        }
                        disabled={currentPage === 1}
                        className="h-8 sm:h-9 md:h-10 rounded-lg sm:rounded-xl border border-slate-300 px-3 sm:px-4 text-xs sm:text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
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
                        className="h-8 sm:h-9 md:h-10 rounded-lg sm:rounded-xl border border-slate-300 px-3 sm:px-4 text-xs sm:text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
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
                  {filteredUnreadItems.length} item{filteredUnreadItems.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
                    {allActivityItems.filter((i) => i.type === 'ACTIVITY').length} actions
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                    {allActivityItems.filter((i) => i.type === 'LOGIN').length} logins
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block" />
                    {allActivityItems.filter((i) => i.type !== 'ACTIVITY' && i.type !== 'LOGIN').length} alerts
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {totalUnreadCount > 0 ? (
                  <>
                    <span className="h-6 px-2.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60 text-xs font-bold inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      {totalUnreadCount > 99 ? '99+' : totalUnreadCount} unread
                    </span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-indigo-200/80 bg-indigo-50/60 text-xs font-semibold text-indigo-700 hover:bg-indigo-100/70 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition shadow-2xs"
                    >
                      <CheckCheck size={13} />
                      <span>Mark all as read</span>
                    </button>
                  </>
                ) : (
                  <span className="h-6 px-2.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 text-xs font-semibold inline-flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    All caught up
                  </span>
                )}
              </div>
            </div>

            {notifLoading && (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                Loading activity...
              </div>
            )}

            {!notifLoading && (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
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
                  const dateFormatted = formatFriendlyDate(item.createdAt);
                  const timeFormatted = item.createdAt
                    ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={item.id}
                      onClick={() => isAlert && markAsRead(item)}
                      className={`flex items-start gap-3 sm:gap-4 px-4 sm:px-6 py-3.5 sm:py-4 transition ${
                        isAlert ? 'hover:bg-slate-50/80 cursor-pointer dark:hover:bg-slate-750/50' : 'hover:bg-slate-50/40 dark:hover:bg-slate-750/30'
                      } ${isUnread ? 'bg-indigo-50/25 dark:bg-indigo-950/20' : ''}`}
                    >
                      {/* Squircle Action Icon */}
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${iconClass}`}
                      >
                        {icon}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isUnread && (
                              <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 ring-4 ring-indigo-100 dark:ring-indigo-950/60" />
                            )}
                            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </p>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${badgeClass}`}
                            >
                              {badgeLabel}
                            </span>
                          </div>

                          <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                            {timeFormatted} · <span className="font-medium text-slate-600 dark:text-slate-400">{dateFormatted}</span>
                          </span>
                        </div>

                        {item.message && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">
                            {item.message}
                          </p>
                        )}

                        {item.meta?.actor && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                            <span>by</span>
                            <span className="font-medium text-slate-600 dark:text-slate-300">{item.meta.actor}</span>
                          </p>
                        )}
                      </div>

                      {/* Quick mark read for alert */}
                      {isAlert && isUnread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item);
                          }}
                          title="Mark as read"
                          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 transition"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!notifLoading && !paginatedUnread.length && (
              <div className="py-16 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-xs">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  {search || unreadTypeFilter !== 'ALL'
                    ? 'No matching notifications'
                    : "You're all caught up!"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {search || unreadTypeFilter !== 'ALL'
                    ? 'Try adjusting your search or filters.'
                    : 'There are no new unread notifications or collaborator activities.'}
                </p>
              </div>
            )}

            {filteredUnreadItems.length > PAGE_SIZE && (
              <div className="flex flex-col gap-3 sm:gap-4 border-t border-slate-200 px-4 sm:px-6 py-3.5 sm:py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center sm:text-left">
                  Page {currentPage} of {unreadTotalPages} · {filteredUnreadItems.length} total
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-8 sm:h-9 md:h-10 rounded-lg sm:rounded-xl border border-slate-300 px-3 sm:px-4 text-xs sm:text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
                  >
                    Previous
                  </button>
                  {renderSimplePageButtons(currentPage, unreadTotalPages, setCurrentPage)}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(p + 1, unreadTotalPages))
                    }
                    disabled={currentPage === unreadTotalPages}
                    className="h-8 sm:h-9 md:h-10 rounded-lg sm:rounded-xl border border-slate-300 px-3 sm:px-4 text-xs sm:text-sm font-medium disabled:opacity-40 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700 transition"
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