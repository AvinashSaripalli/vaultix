import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Trash2, RotateCcw, X, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { fetchVaultTrash, restorePassword, fetchPasswordsByVault } from '../../features/vault/vaultSlice';
import { fetchMyVaultTrash, restoreMyVaultPassword, fetchMyVault } from '../../features/myVault/myVaultSlice';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';

export default function MobileTrashSheet({
  isOpen,
  isPersonalVault = false,
  selectedVault = null,
  onClose,
  onRefresh,
}) {
  const dispatch = useDispatch();
  const { selectedVault: reduxVault, trashByVault = {} } = useSelector((state) => state.vault);
  const { trash: myVaultTrash = [] } = useSelector((state) => state.myVault);

  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  const vaultId = (selectedVault || reduxVault)?.id;
  const trashItems = isPersonalVault
    ? myVaultTrash
    : (vaultId && trashByVault[vaultId] ? trashByVault[vaultId] : []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      if (isPersonalVault) {
        dispatch(fetchMyVaultTrash()).finally(() => setLoading(false));
      } else if (vaultId) {
        dispatch(fetchVaultTrash(vaultId)).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, [isOpen, isPersonalVault, vaultId, dispatch]);

  if (!isOpen) return null;

  const handleRestore = async (item) => {
    if (!item?.id) return;
    setRestoringId(item.id);
    hapticMedium();

    try {
      if (isPersonalVault) {
        await dispatch(restoreMyVaultPassword(item.id));
        hapticSuccess();
        dispatch(fetchMyVaultTrash());
        dispatch(fetchMyVault());
        onRefresh?.();
      } else if (vaultId) {
        await dispatch(restorePassword({ passwordId: item.id, vaultId }));
        hapticSuccess();
        dispatch(fetchVaultTrash(vaultId));
        dispatch(fetchPasswordsByVault(vaultId));
        onRefresh?.();
      }
    } catch {
      // Restore failed
    } finally {
      setRestoringId(null);
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
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Trash2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Trash Bin</h2>
              <p className="text-[10px] text-slate-400">Items auto-delete after 30 days</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          
          {loading ? (
            <div className="py-12 text-center">
              <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Loading deleted items...</p>
            </div>
          ) : trashItems.length === 0 ? (
            <div className="py-12 text-center space-y-2 text-slate-400">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                <Trash2 size={20} />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Trash is empty</p>
              <p className="text-[11px] text-slate-400">Deleted items will appear here for 30 days before permanent removal.</p>
            </div>
          ) : (
            trashItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <ItemServiceIcon name={item.name} type={item.type} size="md" />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.name}</h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {item.login || item.folderName || 'Personal Vault'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRestore(item)}
                  disabled={restoringId === item.id}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition shrink-0 ml-2"
                >
                  {restoringId === item.id ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  <span>Restore</span>
                </button>
              </div>
            ))
          )}

        </div>
      </div>
    </div>
  );
}
