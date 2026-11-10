import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Activity, X, Search, RefreshCw, Filter, ShieldCheck, KeyRound, Folder, User } from 'lucide-react';
import { fetchActivityLogs } from '../../features/vault/vaultSlice';
import { hapticLight, hapticMedium } from '../../utils/haptics';

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export default function MobileActivityLogSheet({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { activityLogs = [], activityLoading } = useSelector((state) => state.vault);
  
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchActivityLogs());
    }
  }, [isOpen, dispatch]);

  const filteredLogs = useMemo(() => {
    let list = activityLogs || [];

    if (filterAction !== 'ALL') {
      list = list.filter((l) => (l.action || '').toUpperCase().includes(filterAction));
    }

    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (l) =>
        (l.itemName || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.user?.fullName || '').toLowerCase().includes(q)
    );
  }, [activityLogs, search, filterAction]);

  if (!isOpen) return null;

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
              <Activity size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Audit Activity Log</h2>
              <p className="text-[10px] text-slate-400">Enterprise zero-knowledge event trail</p>
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

        {/* Filter bar & Search */}
        <div className="px-5 pt-3 pb-2 space-y-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {['ALL', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'SHARE'].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  hapticLight();
                  setFilterAction(action);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition active:scale-95 ${
                  filterAction === action
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2.5">
          {activityLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-indigo-500" />
              <span>Fetching activity records...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No audit records match your filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  <Activity size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatTimestamp(log.createdAt)}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">
                    {log.itemName || log.details || 'Vault Mutation'}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    by <span className="font-semibold text-slate-700 dark:text-slate-300">{log.user?.fullName || log.userName || 'System'}</span>
                    {log.ipAddress && ` • ${log.ipAddress}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
