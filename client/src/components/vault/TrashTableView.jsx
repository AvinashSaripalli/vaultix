import { useState, useMemo } from 'react';
import {
  Trash2,
  RotateCcw,
  Search,
  Folder,
  Lock,
  ArrowLeft,
  X,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Shield,
  Copy,
  Check,
  Calendar,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import ItemServiceIcon from '../common/ItemServiceIcon';
import ConfirmModal from '../common/ConfirmModal';
import ModalPortal, { ModalBackdrop } from '../common/ModalPortal';
import { getItemTypeMeta } from '../../utils/itemTypes';
import { secureCopyText } from '../../utils/clipboard';
import { showToast } from '../../utils/toast';

export default function TrashTableView({
  title = 'Company Vault',
  trashItems = [],
  folderTrashItems = [],
  isLoading = false,
  folders = [],
  onRestoreItem,
  onPurgeItem,
  onRestoreFolder,
  onPurgeFolder,
  onBatchRestore,
  onBatchPurge,
  onEmptyTrash,
  onClose,
  isSuperAdmin = true,
  isCompanyVault = true,
}) {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'passwords' | 'folders'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedFolderIds, setExpandedFolderIds] = useState(new Set());
  const [previewItem, setPreviewItem] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Confirmation modals state
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);
  const [confirmBatchPurgeOpen, setConfirmBatchPurgeOpen] = useState(false);
  const [singlePurgeTarget, setSinglePurgeTarget] = useState(null); // { type: 'password'|'folder', item }

  const totalTrashCount = trashItems.length + folderTrashItems.length;

  // Set of folder IDs that are in trash
  const trashedFolderIdSet = useMemo(() => {
    return new Set(folderTrashItems.map((f) => f.id));
  }, [folderTrashItems]);

  // Group child passwords by folderId
  const passwordsByFolderId = useMemo(() => {
    const map = new Map();
    trashItems.forEach((item) => {
      if (item.folderId) {
        if (!map.has(item.folderId)) map.set(item.folderId, []);
        map.get(item.folderId).push(item);
      }
    });
    return map;
  }, [trashItems]);

  // Filter passwords
  const filteredPasswords = useMemo(() => {
    if (!searchQuery.trim()) return trashItems;
    const q = searchQuery.toLowerCase();
    return trashItems.filter((item) => {
      const nameMatch = item.name?.toLowerCase().includes(q);
      const loginMatch = item.login?.toLowerCase().includes(q);
      const urlMatch = item.url?.toLowerCase().includes(q);
      const folderName =
        item.folder?.name ||
        folders.find((f) => f.id === item.folderId)?.name ||
        folderTrashItems.find((f) => f.id === item.folderId)?.name;
      const folderMatch = folderName?.toLowerCase().includes(q);
      return nameMatch || loginMatch || urlMatch || folderMatch;
    });
  }, [trashItems, searchQuery, folders, folderTrashItems]);

  // Filter folders
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return folderTrashItems;
    const q = searchQuery.toLowerCase();
    return folderTrashItems.filter((f) => f.name?.toLowerCase().includes(q));
  }, [folderTrashItems, searchQuery]);

  // Visible items based on tab
  const visiblePasswords = activeTab === 'folders' ? [] : filteredPasswords;
  const visibleFolders = activeTab === 'passwords' ? [] : filteredFolders;
  const visibleTotalCount = visiblePasswords.length + visibleFolders.length;

  // Toggle single item selection
  const toggleSelectId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all / deselect all visible
  const allVisibleSelected = useMemo(() => {
    if (visibleTotalCount === 0) return false;
    for (const p of visiblePasswords) {
      if (!selectedIds.has(p.id)) return false;
    }
    for (const f of visibleFolders) {
      if (!selectedIds.has(f.id)) return false;
    }
    return true;
  }, [visibleTotalCount, visiblePasswords, visibleFolders, selectedIds]);

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      visiblePasswords.forEach((p) => next.add(p.id));
      visibleFolders.forEach((f) => next.add(f.id));
      setSelectedIds(next);
    }
  };

  // Toggle folder expansion
  const toggleFolderExpanded = (folderId) => {
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Handle batch restore
  const handleExecuteBatchRestore = async () => {
    const selectedPasswordItems = trashItems.filter((p) => selectedIds.has(p.id));
    const selectedFolderList = folderTrashItems.filter((f) => selectedIds.has(f.id));
    if (onBatchRestore) {
      await onBatchRestore(selectedPasswordItems, selectedFolderList);
      setSelectedIds(new Set());
    }
  };

  // Handle batch purge
  const handleExecuteBatchPurge = async () => {
    const selectedPasswordItems = trashItems.filter((p) => selectedIds.has(p.id));
    const selectedFolderList = folderTrashItems.filter((f) => selectedIds.has(f.id));
    if (onBatchPurge) {
      await onBatchPurge(selectedPasswordItems, selectedFolderList);
      setSelectedIds(new Set());
    }
    setConfirmBatchPurgeOpen(false);
  };

  // Single purge confirmation
  const handleTriggerSinglePurge = (type, item) => {
    setSinglePurgeTarget({ type, item });
  };

  const handleConfirmSinglePurge = async () => {
    if (!singlePurgeTarget) return;
    const { type, item } = singlePurgeTarget;
    if (type === 'folder') {
      await onPurgeFolder?.(item);
    } else {
      await onPurgeItem?.(item);
    }
    setSinglePurgeTarget(null);
  };

  // Copy helper
  const handleCopy = (text, label) => {
    if (!text) return;
    secureCopyText(text, `Copied ${label}`);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    try {
      const diffMs = Date.now() - new Date(dateString).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 30) return `${diffDays} days ago`;
      const diffMonths = Math.floor(diffDays / 30);
      return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
    } catch {
      return '';
    }
  };

  // Resolve folder name for an item
  const resolveFolderName = (item) => {
    if (item.folder?.name) return item.folder.name;
    const active = folders.find((f) => f.id === item.folderId);
    if (active) return active.name;
    const trashed = folderTrashItems.find((f) => f.id === item.folderId);
    if (trashed) return trashed.name;
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden min-h-[600px] flex flex-col min-w-0">
      {/* 1. Header Toolbar (NO Metric Cards!) */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-lg border border-rose-100 dark:border-rose-900/60">
              {title}
            </span>
            <span className="text-slate-400 dark:text-slate-500 text-xs">•</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Trash & Recovery</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center font-bold text-sm border border-rose-200/80 dark:border-rose-900/60 shrink-0">
              <Trash2 size={16} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Trash
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
              {totalTrashCount} {totalTrashCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Deleted credentials and folders can be restored to their original locations or permanently removed.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {totalTrashCount > 0 && onEmptyTrash && (
            <button
              type="button"
              onClick={() => setConfirmEmptyOpen(true)}
              className="h-9 px-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-rose-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Permanently remove all items in trash"
            >
              <Trash2 size={14} />
              <span>Empty Trash</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ArrowLeft size={14} />
              <span>Back to Vault</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Controls Toolbar: Segmented Filters, Search & Batch Actions */}
      <div className="p-3.5 sm:px-6 bg-slate-50/70 dark:bg-slate-850/60 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Segmented Filter Pills */}
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs self-start">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Items ({totalTrashCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('passwords')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'passwords'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock size={12} />
            <span>Passwords ({trashItems.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('folders')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'folders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Folder size={12} />
            <span>Folders ({folderTrashItems.length})</span>
          </button>
        </div>

        {/* Search & Batch Actions Toolbar */}
        <div className="flex items-center gap-2 flex-1 md:max-w-lg md:justify-end">
          {/* Floating Batch Action Pill Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-1.5 mr-auto md:mr-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 px-2.5 py-1 rounded-xl shadow-xs animate-in fade-in zoom-in-95 duration-150">
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={handleExecuteBatchRestore}
                className="h-7 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Restore all selected items"
              >
                <RotateCcw size={11} />
                <span>Restore</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmBatchPurgeOpen(true)}
                className="h-7 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                title={isSuperAdmin ? 'Delete selected permanently' : 'Request deletion for selected'}
              >
                <Trash2 size={11} />
                <span>{isSuperAdmin ? 'Delete' : 'Request'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="h-7 w-7 rounded-lg hover:bg-indigo-200/60 dark:hover:bg-indigo-900/60 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition"
                title="Clear selection"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Search Input */}
          <div className="relative w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, login, or folder..."
              className="w-full h-9 pl-8.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition dark:bg-slate-750 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Content: Loading, Empty, or Table */}
      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center p-16 text-slate-500 dark:text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <span>Loading trash items...</span>
        </div>
      ) : totalTrashCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-400 dark:text-slate-500">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-750 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
            <Trash2 size={28} />
          </div>
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
            Trash is empty
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
            When passwords or folders are deleted, they will appear here so you can easily review and recover them anytime.
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Return to Vault
            </button>
          )}
        </div>
      ) : visibleTotalCount === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-400">
          <p className="text-sm">No items match "{searchQuery}"</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
          >
            Clear search filter
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile View (< md): High-Density Responsive Cards */}
          <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-700/60">
            {/* Passwords on Mobile */}
            {visiblePasswords.map((item) => {
              const folderName = resolveFolderName(item);
              const isParentInTrash = Boolean(item.folderId && trashedFolderIdSet.has(item.folderId));
              const typeMeta = getItemTypeMeta(item.type);
              const isSelected = selectedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 space-y-2.5 transition-colors ${
                    isSelected ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-750/50'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectId(item.id)}
                      className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />

                    <ItemServiceIcon name={item.name} type={item.type} size="sm" />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {item.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                          {typeMeta?.label?.toUpperCase() || 'LOGIN'}
                        </span>
                      </div>

                      {item.login && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                          {item.login}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="min-w-0">
                      {folderName ? (
                        <div className="flex items-center gap-1 truncate">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 truncate">
                            <Folder size={11} className="shrink-0" />
                            <span className="truncate">{folderName}</span>
                          </span>
                          {isParentInTrash && (
                            <span className="text-[10px] text-rose-500 font-medium shrink-0">
                              (Folder in Trash)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Vault Root</span>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {formatDate(item.deletedAt)}
                    </span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition"
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => onRestoreItem?.(item)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition"
                    >
                      <RotateCcw size={12} />
                      <span>Restore</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerSinglePurge('password', item)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                      title={isSuperAdmin ? 'Delete permanently' : 'Request permanent deletion'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Folders on Mobile */}
            {visibleFolders.map((folder) => {
              const isExpanded = expandedFolderIds.has(folder.id);
              const childPasswords = passwordsByFolderId.get(folder.id) || [];
              const count = Math.max(folder._count?.passwords ?? 0, childPasswords.length);
              const isSelected = selectedIds.has(folder.id);

              return (
                <div
                  key={folder.id}
                  className={`p-3.5 space-y-2.5 bg-amber-50/20 dark:bg-amber-950/10 transition-colors ${
                    isSelected ? 'ring-1 ring-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectId(folder.id)}
                      className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />

                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 flex items-center justify-center font-bold text-sm shrink-0">
                      <Folder size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {folder.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          FOLDER
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleFolderExpanded(folder.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 transition"
                      >
                        <span>Contains {count} {count === 1 ? 'password' : 'passwords'}</span>
                        {isExpanded ? <ChevronDown size={12} className="rotate-180" /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded child credentials on Mobile */}
                  {isExpanded && (
                    <div className="pl-6 border-l-2 border-amber-300 dark:border-amber-600 py-1 space-y-1.5 animate-in fade-in duration-150">
                      <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                        Passwords inside this folder:
                      </div>
                      {childPasswords.length > 0 ? (
                        childPasswords.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-750 border border-amber-200 dark:border-amber-900/50 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Lock size={12} className="text-slate-400 shrink-0" />
                              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                {child.name}
                              </span>
                              {child.login && (
                                <span className="text-slate-400 font-mono text-[11px] truncate">
                                  ({child.login})
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded font-medium border border-emerald-200/80 dark:border-emerald-800 shrink-0">
                              Auto-restores
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          No separate password entries found. Passwords will restore automatically with the folder.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {formatDate(folder.deletedAt)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onRestoreFolder?.(folder)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs"
                      >
                        <RotateCcw size={12} />
                        <span>Restore Folder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerSinglePurge('folder', folder)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition"
                        title={isSuperAdmin ? 'Delete folder permanently' : 'Request deletion'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View (>= md): High-Density Enterprise Table */}
          <div className="hidden md:block overflow-x-auto min-w-0">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-700/80 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider bg-slate-50/60 dark:bg-slate-750/40">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Select all visible items"
                    />
                  </th>
                  <th className="py-3 px-4 w-[34%]">ITEM & ACCOUNT</th>
                  <th className="py-3 px-4 w-[24%]">ORIGINAL LOCATION</th>
                  <th className="py-3 px-4 w-[20%]">DELETED DATE</th>
                  <th className="py-3 px-4 w-[22%] text-right pr-6">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-750/70 text-xs">
                {/* 1. Render Passwords */}
                {visiblePasswords.map((item) => {
                  const folderName = resolveFolderName(item);
                  const isParentInTrash = Boolean(item.folderId && trashedFolderIdSet.has(item.folderId));
                  const typeMeta = getItemTypeMeta(item.type);
                  const isSelected = selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors group ${
                        isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectId(item.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* ITEM & ACCOUNT */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <ItemServiceIcon name={item.name} type={item.type} size="sm" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                                {item.name}
                              </span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800">
                                {typeMeta?.label?.toUpperCase() || 'LOGIN'}
                              </span>
                            </div>
                            <div className="font-mono text-slate-500 dark:text-slate-400 text-xs truncate mt-0.5">
                              {item.login || <span className="text-slate-400 italic">No username</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ORIGINAL LOCATION */}
                      <td className="py-3 px-4">
                        {folderName ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 max-w-[200px] truncate">
                              <Folder size={12} className="shrink-0" />
                              <span className="truncate">{folderName}</span>
                            </span>
                            {isParentInTrash && (
                              <div className="text-[10px] text-rose-500 dark:text-rose-400 font-medium">
                                (Folder also in Trash)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200/70 dark:bg-slate-750 dark:text-slate-300 dark:border-slate-700">
                            {title} Root
                          </span>
                        )}
                      </td>

                      {/* DELETED DATE */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {formatDate(item.deletedAt)}
                        </div>
                        {item.deletedAt && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            {formatRelativeTime(item.deletedAt)}
                          </div>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3 px-4 text-right pr-6">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewItem(item)}
                            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold transition cursor-pointer"
                            title="Preview item details"
                          >
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => onRestoreItem?.(item)}
                            className="h-8 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 border border-emerald-200/80 dark:border-emerald-800 font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Restore password to its original folder"
                          >
                            <RotateCcw size={12} />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTriggerSinglePurge('password', item)}
                            className="h-8 px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            title={isSuperAdmin ? 'Permanently delete item' : 'Request permanent deletion'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* 2. Render Folders */}
                {visibleFolders.map((folder) => {
                  const isExpanded = expandedFolderIds.has(folder.id);
                  const childPasswords = passwordsByFolderId.get(folder.id) || [];
                  const count = Math.max(folder._count?.passwords ?? 0, childPasswords.length);
                  const isSelected = selectedIds.has(folder.id);

                  return (
                    <tbody key={`folder-group-${folder.id}`} className="border-t border-slate-100 dark:border-slate-750">
                      <tr
                        className={`bg-amber-50/20 dark:bg-amber-950/15 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 transition-colors group ${
                          isSelected ? 'ring-1 ring-indigo-500' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectId(folder.id)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        {/* FOLDER NAME & BADGE */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleFolderExpanded(folder.id)}
                              className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 flex items-center justify-center font-bold text-sm shrink-0 cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
                              title="Click to view passwords inside this folder"
                            >
                              <Folder size={16} />
                            </button>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                                  onClick={() => toggleFolderExpanded(folder.id)}
                                >
                                  {folder.name}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  FOLDER
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleFolderExpanded(folder.id)}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition cursor-pointer flex items-center gap-1"
                                >
                                  <span>Contains {count} {count === 1 ? 'password' : 'passwords'}</span>
                                  {isExpanded ? <ChevronDown size={11} className="rotate-180" /> : <ChevronDown size={11} />}
                                </button>
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                Restoring this folder restores all passwords inside it automatically
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* ORIGINAL LOCATION */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/70 dark:bg-slate-750 dark:text-slate-300 dark:border-slate-700">
                            {title} Root
                          </span>
                        </td>

                        {/* DELETED DATE */}
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {formatDate(folder.deletedAt)}
                          </div>
                          {folder.deletedAt && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              {formatRelativeTime(folder.deletedAt)}
                            </div>
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3 px-4 text-right pr-6">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onRestoreFolder?.(folder)}
                              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              title="Restore folder and all contained passwords"
                            >
                              <RotateCcw size={12} />
                              <span>Restore Folder</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTriggerSinglePurge('folder', folder)}
                              className="h-8 px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                              title={isSuperAdmin ? 'Permanently delete folder' : 'Request permanent deletion'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Child Row: Shows credentials inside this folder */}
                      {isExpanded && (
                        <tr className="bg-amber-50/40 dark:bg-amber-950/20 border-b border-amber-200/80 dark:border-amber-900/60">
                          <td className="py-2.5 px-4"></td>
                          <td colSpan="4" className="py-2.5 px-4">
                            <div className="pl-6 border-l-2 border-amber-300 dark:border-amber-600 py-1 space-y-2">
                              <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <FolderOpen size={13} />
                                <span>Passwords inside this folder ({childPasswords.length}):</span>
                              </div>

                              {childPasswords.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {childPasswords.map((child) => (
                                    <div
                                      key={child.id}
                                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white dark:bg-slate-750 border border-amber-200/80 dark:border-amber-900/50 text-xs shadow-2xs hover:border-indigo-300 transition"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <ItemServiceIcon name={child.name} type={child.type} size="xs" />
                                        <div className="min-w-0">
                                          <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                            {child.name}
                                          </div>
                                          {child.login && (
                                            <div className="text-[10px] text-slate-400 font-mono truncate">
                                              {child.login}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewItem(child)}
                                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                          title="Preview"
                                        >
                                          <Eye size={12} />
                                        </button>
                                        <span className="text-[9px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded font-medium border border-emerald-200/80 dark:border-emerald-800">
                                          Auto-restores
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                                  No individually tracked passwords found. When you restore this folder, all contents will be restored.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer: Security retention notice & total count */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                All credentials remain encrypted while in trash. Only authorized admins and owners can permanently erase data.
              </span>
            </div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
              Showing {visibleTotalCount} of {totalTrashCount} {totalTrashCount === 1 ? 'item' : 'items'}
            </div>
          </div>
        </div>
      )}

      {/* 4. Item Preview Modal */}
      {previewItem && (
        <ModalPortal open={Boolean(previewItem)} onClose={() => setPreviewItem(null)}>
          <ModalBackdrop onClose={() => setPreviewItem(null)}>
            <div
              className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 my-auto text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 min-w-0">
                  <ItemServiceIcon name={previewItem.name} type={previewItem.type} size="md" />
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                      {previewItem.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800">
                        {getItemTypeMeta(previewItem.type)?.label || 'Login'}
                      </span>
                      <span className="text-xs text-rose-500 font-semibold">• In Trash</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 flex items-center justify-center text-slate-500 dark:text-slate-300 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="py-4 space-y-3.5 text-xs">
                {/* Username / Login */}
                {previewItem.login && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Username / Login
                      </div>
                      <div className="text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-200 truncate mt-0.5">
                        {previewItem.login}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(previewItem.login, 'Username')}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-650 dark:hover:bg-slate-700 text-slate-500 transition"
                      title="Copy username"
                    >
                      {copiedField === 'Username' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                )}

                {/* Website / URL */}
                {previewItem.url && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Website / URL
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 truncate mt-0.5 font-medium">
                        {previewItem.url}
                      </div>
                    </div>
                    <a
                      href={previewItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-650 dark:hover:bg-slate-700 text-slate-500 transition"
                      title="Open in new tab"
                    >
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}

                {/* Original Folder & Deleted Date */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200/80 dark:border-slate-700">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Original Folder
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5 flex items-center gap-1">
                      <Folder size={12} className="text-amber-500 shrink-0" />
                      <span className="truncate">{resolveFolderName(previewItem) || 'Vault Root'}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200/80 dark:border-slate-700">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Deleted Date
                    </div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5 flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{formatDate(previewItem.deletedAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Safe Recovery Notice */}
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 flex items-start gap-2.5 text-emerald-800 dark:text-emerald-300">
                  <Shield size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    This credential was safely moved to trash. Restoring it will return all logins, passwords, and custom fields back to your active vault.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-750 transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const itemToRestore = previewItem;
                    setPreviewItem(null);
                    onRestoreItem?.(itemToRestore);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw size={13} />
                  <span>Restore Password</span>
                </button>
              </div>
            </div>
          </ModalBackdrop>
        </ModalPortal>
      )}

      {/* 5. Empty Trash Confirmation Modal */}
      <ConfirmModal
        open={confirmEmptyOpen}
        title="Empty Trash Permanently?"
        message={`Are you sure you want to permanently delete all ${totalTrashCount} items and folders from trash? This action cannot be undone and will securely erase all stored encryption keys.`}
        confirmLabel="Empty Trash Permanently"
        cancelLabel="Cancel"
        onConfirm={async () => {
          setConfirmEmptyOpen(false);
          await onEmptyTrash?.();
        }}
        onCancel={() => setConfirmEmptyOpen(false)}
      />

      {/* 6. Batch Purge Confirmation Modal */}
      <ConfirmModal
        open={confirmBatchPurgeOpen}
        title={isSuperAdmin ? 'Permanently Delete Selected?' : 'Request Deletion for Selected?'}
        message={
          isSuperAdmin
            ? `Are you sure you want to permanently delete ${selectedIds.size} selected items? This cannot be undone.`
            : `Submit a permanent deletion approval request for ${selectedIds.size} selected items to the Super Admin?`
        }
        confirmLabel={isSuperAdmin ? 'Delete Selected' : 'Submit Request'}
        cancelLabel="Cancel"
        onConfirm={handleExecuteBatchPurge}
        onCancel={() => setConfirmBatchPurgeOpen(false)}
      />

      {/* 7. Single Item/Folder Purge Confirmation Modal */}
      <ConfirmModal
        open={Boolean(singlePurgeTarget)}
        title={
          isSuperAdmin
            ? singlePurgeTarget?.type === 'folder'
              ? 'Permanently Delete Folder?'
              : 'Permanently Delete Password?'
            : singlePurgeTarget?.type === 'folder'
              ? 'Request Folder Purge'
              : 'Request Password Purge'
        }
        message={
          isSuperAdmin
            ? singlePurgeTarget?.type === 'folder'
              ? `Are you sure you want to permanently delete folder "${singlePurgeTarget?.item?.name}" and all passwords inside it? This cannot be undone and will be permanently erased.`
              : `Are you sure you want to permanently delete "${singlePurgeTarget?.item?.name}"? This cannot be undone and will be permanently erased.`
            : singlePurgeTarget?.type === 'folder'
              ? `Permanently deleting folders from a Company Vault requires Super Admin authorization. Confirming this will submit an approval request to the Super Admin. The folder will remain safely in Trash until approved.`
              : `Permanently deleting credentials from a Company Vault requires Super Admin authorization. Confirming this will submit an approval request to the Super Admin. The item will remain safely in Trash until approved.`
        }
        confirmLabel={isSuperAdmin ? 'Delete Permanently' : 'Submit Purge Request'}
        cancelLabel="Cancel"
        onConfirm={handleConfirmSinglePurge}
        onCancel={() => setSinglePurgeTarget(null)}
      />
    </div>
  );
}
