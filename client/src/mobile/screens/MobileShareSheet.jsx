import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Share2, X, Search, Check, ShieldCheck, User, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import { sharePasswordToUser, clearShareError } from '../../features/sharedPasswords/sharedPasswordsSlice';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';

export default function MobileShareSheet({
  isOpen,
  item,
  onClose,
  onSuccess,
}) {
  const dispatch = useDispatch();
  const { user: currentUser } = useSelector((state) => state.auth);
  const { sharing, shareError } = useSelector((state) => state.sharedPasswords);

  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [search, setSearch] = useState('');
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      try {
        setFetchingUsers(true);
        setLocalError('');
        const res = await api.get('/users/shareable');
        const list = (res.data || []).filter((u) => u.id !== currentUser?.id);
        setUsers(list);
      } catch (err) {
        setLocalError(err.response?.data?.message || 'Failed to fetch team members.');
      } finally {
        setFetchingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen, currentUser?.id]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, search]);

  if (!isOpen || !item) return null;

  const handleShare = async () => {
    if (!selectedUserId) {
      setLocalError('Please select a team member to share with.');
      return;
    }

    setLocalError('');
    hapticMedium();

    try {
      const result = await dispatch(
        sharePasswordToUser({
          passwordId: item.id,
          userId: selectedUserId,
          password: item,
        })
      );

      if (sharePasswordToUser.fulfilled.match(result)) {
        hapticSuccess();
        onSuccess?.(`Shared "${item.name}" successfully`);
        onClose();
      } else {
        setLocalError(result.payload || 'Failed to share credential.');
      }
    } catch (err) {
      setLocalError(err.message || 'Share failed');
    }
  };

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet Container */}
      <div className="w-full max-h-[85%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Share2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Share Credential</h2>
              <p className="text-[10px] text-slate-400">Zero-Knowledge RSA Key Exchange</p>
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {/* Item Preview Banner */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <ItemServiceIcon name={item.name} type={item.type} size="md" />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{item.login || item.type}</p>
            </div>
          </div>

          {/* Errors */}
          {(localError || shareError) && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{localError || shareError}</span>
            </div>
          )}

          {/* User Search Input */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search team member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Users List */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Select Recipient ({filteredUsers.length})
            </span>

            {fetchingUsers ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-indigo-500" />
                <span>Loading team members...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No eligible users found to share with.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {filteredUsers.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => {
                        hapticLight();
                        setSelectedUserId(u.id);
                        setLocalError('');
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {u.fullName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{u.fullName}</p>
                          <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                        </div>
                      </div>

                      <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center">
                        {isSelected && <div className="w-3 h-3 rounded-full bg-indigo-600" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer / Submit Button */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={handleShare}
            disabled={!selectedUserId || sharing}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs transition active:scale-98 shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            {sharing ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Encrypting &amp; Sharing...</span>
              </>
            ) : (
              <>
                <Share2 size={14} />
                <span>Share with {selectedUser?.fullName?.split(' ')[0] || 'User'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
