import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Trash2, RotateCcw, Folder, Lock, Search } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';

import MyVaultHeader from '../../components/myVault/MyVaultHeader';
import MyVaultSidebar from '../../components/myVault/MyVaultSidebar';
import MyVaultPasswordWorkspace from '../../components/myVault/MyVaultPasswordWorkspace';

import CreateFolderModal from '../../components/myVault/CreateFolderModal';
import EditFolderModal from '../../components/myVault/EditFolderModal';

import AddMyVaultPasswordModal from '../../components/myVault/AddMyVaultPasswordModal';
import EditMyVaultPasswordModal from '../../components/myVault/EditMyVaultPasswordModal';

import SharePasswordModal from '../../components/myVault/SharePasswordModal';
import ManagePasswordSharesModal from '../../components/myVault/ManagePasswordSharesModal';
import ViewMyVaultPasswordModal from '../../components/myVault/ViewMyVaultPasswordModal';
import VerifyMasterPasswordModal from '../../components/security/VerifyMasterPasswordModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { showToast } from '../../utils/toast';

import {
  createMyVaultFolder,
  createMyVaultPassword,
  deleteMyVaultFolder,
  deleteMyVaultPassword,
  fetchMyVault,
  fetchMyVaultTrash,
  fetchMyVaultFolderTrash,
  restoreMyVaultPassword,
  purgeMyVaultPassword,
  restoreMyVaultFolder,
  purgeMyVaultFolder,
  setSelectedFolderId,
  updateMyVaultFolder,
  updateMyVaultPassword,
} from '../../features/myVault/myVaultSlice';

import {
  clearShareError,
  removePasswordShare,
  sharePasswordToUser,
} from '../../features/sharedPasswords/sharedPasswordsSlice';

function MyVaultPage() {
  const dispatch = useDispatch();

  const {
    folders,
    passwords,
    selectedFolderId,
    loading,
    trash,
    trashLoading,
    folderTrash,
    folderTrashLoading,
  } = useSelector((state) => state.myVault);

  const [trashTab, setTrashTab] = useState('passwords'); // 'passwords' | 'folders'
  const [trashSearch, setTrashSearch] = useState('');
  const totalTrashCount = (trash?.length || 0) + (folderTrash?.length || 0);

  const filteredTrash = useMemo(() => {
    if (!trashSearch) return trash || [];
    const query = trashSearch.toLowerCase().trim();
    return (trash || []).filter(
      (item) =>
        item.name?.toLowerCase().includes(query) ||
        item.login?.toLowerCase().includes(query) ||
        item.folder?.name?.toLowerCase().includes(query)
    );
  }, [trash, trashSearch]);

  const filteredFolderTrash = useMemo(() => {
    if (!trashSearch) return folderTrash || [];
    const query = trashSearch.toLowerCase().trim();
    return (folderTrash || []).filter((folder) =>
      folder.name?.toLowerCase().includes(query)
    );
  }, [folderTrash, trashSearch]);

  const { sharing, shareError } = useSelector(
    (state) => state.sharedPasswords
  );

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editFolderOpen, setEditFolderOpen] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [addChildParent, setAddChildParent] = useState(null);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [manageSharesOpen, setManageSharesOpen] = useState(false);

  const [selectedPassword, setSelectedPassword] = useState(null);
  const [selectedFolderForEdit, setSelectedFolderForEdit] = useState(null);
  const [selectedPasswordForEdit, setSelectedPasswordForEdit] = useState(null);
  const [viewPasswordOpen, setViewPasswordOpen] = useState(false);
  const [selectedPasswordForView, setSelectedPasswordForView] = useState(null);
  const [selectedPasswordId, setSelectedPasswordId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, type: '', item: null });
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [pendingSharePassword, setPendingSharePassword] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState({ open: false, item: null });

  const { sessionMasterPassword } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchMyVault());
    dispatch(fetchMyVaultTrash());
    dispatch(fetchMyVaultFolderTrash());
  }, [dispatch]);

  useEffect(() => {
    if (trashOpen) {
      dispatch(fetchMyVaultTrash());
      dispatch(fetchMyVaultFolderTrash());
    }
  }, [dispatch, trashOpen]);

  const filteredPasswords = useMemo(() => {
    if (!selectedFolderId) return passwords;

    return passwords.filter((item) => item.folderId === selectedFolderId);
  }, [passwords, selectedFolderId]);

  const selectedFolder = folders.find((item) => item.id === selectedFolderId);
  const addFolderForChild = addChildParent
    ? folders.find((item) => item.id === addChildParent.folderId)
    : null;

  const openAddPasswordModal = (parent = null) => {
    setAddChildParent(parent);
    setPasswordModalOpen(true);
  };

  const handleCreateFolder = async (name) => {
    const result = await dispatch(createMyVaultFolder({ name }));

    if (createMyVaultFolder.fulfilled.match(result)) {
      setFolderModalOpen(false);
    }
  };

  const handleViewPassword = (password) => {
    setSelectedPasswordForView(password);
    setViewPasswordOpen(true);
  };

  const handleEditFolder = (folder) => {
    setSelectedFolderForEdit(folder);
    setEditFolderOpen(true);
  };

  const handleUpdateFolder = async (name) => {
    if (!selectedFolderForEdit) return;

    const result = await dispatch(
      updateMyVaultFolder({
        folderId: selectedFolderForEdit.id,
        name,
      })
    );

    if (updateMyVaultFolder.fulfilled.match(result)) {
      setEditFolderOpen(false);
      setSelectedFolderForEdit(null);
    }
  };

  const handleDeleteFolder = async (folder) => {
    setConfirmDelete({ open: true, type: 'folder', item: folder });
  };

  const handleCreatePassword = async (payload) => {
    const result = await dispatch(createMyVaultPassword(payload));

    if (createMyVaultPassword.fulfilled.match(result)) {
      setPasswordModalOpen(false);
      setAddChildParent(null);
    }
  };

  const handleEditPassword = (password) => {
    setSelectedPasswordForEdit(password);
    setEditPasswordOpen(true);
  };

  const handleUpdatePassword = async (data) => {
    if (!selectedPasswordForEdit) return;

    const result = await dispatch(
      updateMyVaultPassword({
        passwordId: selectedPasswordForEdit.id,
        data,
      })
    );

    if (updateMyVaultPassword.fulfilled.match(result)) {
      setEditPasswordOpen(false);
      setSelectedPasswordForEdit(null);
    }
  };

  const handleDeletePassword = async (password) => {
    setConfirmDelete({ open: true, type: 'password', item: password });
  };

  const executeDelete = async () => {
    const { type, item } = confirmDelete;
    if (!item) return;

    if (type === 'folder') {
      await dispatch(deleteMyVaultFolder(item.id));
      dispatch(fetchMyVault());
      dispatch(fetchMyVaultFolderTrash());
      dispatch(fetchMyVaultTrash());
      showToast(`Folder "${item.name}" and its passwords moved to Trash`, 'info');
    } else if (type === 'password') {
      await dispatch(deleteMyVaultPassword(item.id));
      dispatch(fetchMyVaultTrash());
      showToast(`${item.name} moved to Trash`, 'info', 6000, {
        label: 'Undo',
        onClick: () => handleRestoreTrashItem(item),
      });
    }

    setConfirmDelete({ open: false, type: '', item: null });
  };

  const handleOpenShare = (password) => {
    if (!sessionMasterPassword) {
      dispatch(clearShareError());
      setPendingSharePassword(password);
      setReVerifyOpen(true);
      return;
    }
    dispatch(clearShareError());
    setSelectedPassword(password);
    setShareModalOpen(true);
  };

  const handleSharePassword = async (userId) => {
    if (!selectedPassword) return;

    const result = await dispatch(
      sharePasswordToUser({
        passwordId: selectedPassword.id,
        userId,
        password: selectedPassword,
      })
    );

    if (sharePasswordToUser.fulfilled.match(result)) {
      setShareModalOpen(false);
      setSelectedPassword(null);
    }
  };

  const handleManageShares = (password) => {
    setSelectedPassword(password);
    setManageSharesOpen(true);
  };

  const handleRemoveShare = async (shareId) => {
    await dispatch(removePasswordShare(shareId));
  };

  const handleRestoreTrashFolder = async (folder) => {
    const result = await dispatch(restoreMyVaultFolder(folder.id));
    if (restoreMyVaultFolder.fulfilled.match(result)) {
      dispatch(fetchMyVault());
      dispatch(fetchMyVaultFolderTrash());
      dispatch(fetchMyVaultTrash());
      showToast(`Folder "${folder.name}" and its passwords restored`, 'success');
    } else {
      showToast(result.payload || 'Failed to restore folder', 'error');
    }
  };

  const handlePurgeTrashFolder = (folder) => {
    setConfirmPurge({ open: true, type: 'folder', item: folder });
  };

  const handleRestoreTrashItem = async (item) => {
    const result = await dispatch(restoreMyVaultPassword(item.id));
    if (restoreMyVaultPassword.fulfilled.match(result)) {
      dispatch(fetchMyVault());
      dispatch(fetchMyVaultTrash());
      dispatch(fetchMyVaultFolderTrash());
      showToast(
        result.payload?.folderRestored
          ? `Restored "${item.name}" and folder "${result.payload.folderName}"`
          : `"${item.name}" restored to your vault`,
        'success'
      );
    } else {
      showToast(result.payload || 'Failed to restore item', 'error');
    }
  };

  const handlePurgeTrashItem = (item) => {
    setConfirmPurge({ open: true, type: 'password', item });
  };

  const executePurgeTrash = async () => {
    if (!confirmPurge.item) return;
    const itemToPurge = confirmPurge.item;

    if (confirmPurge.type === 'folder') {
      const result = await dispatch(purgeMyVaultFolder(itemToPurge.id));
      if (purgeMyVaultFolder.fulfilled.match(result)) {
        dispatch(fetchMyVaultFolderTrash());
        dispatch(fetchMyVaultTrash());
        showToast(`Folder "${itemToPurge.name}" permanently deleted`, 'info');
      } else {
        showToast(result.payload || 'Failed to delete folder permanently', 'error');
      }
    } else {
      const result = await dispatch(purgeMyVaultPassword(itemToPurge.id));
      if (purgeMyVaultPassword.fulfilled.match(result)) {
        dispatch(fetchMyVaultTrash());
        showToast(`"${itemToPurge.name}" permanently deleted`, 'info');
      } else {
        showToast(result.payload || 'Failed to delete permanently', 'error');
      }
    }
    setConfirmPurge({ open: false, type: '', item: null });
  };

  const handleToggleTrash = () => {
    setTrashOpen((prev) => !prev);
  };

  return (
    <AppLayout>
      <div className="space-y-5 sm:space-y-6 min-w-0">
        <MyVaultHeader
          folders={folders}
          onCreateFolder={() => setFolderModalOpen(true)}
          onCreatePassword={() => openAddPasswordModal()}
          trashOpen={trashOpen}
          trashCount={totalTrashCount}
          onToggleTrash={handleToggleTrash}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 sm:gap-5 items-stretch min-w-0">
          <MyVaultSidebar
            folders={folders}
            selectedFolderId={selectedFolderId}
            onSelectFolder={(id) => {
              setTrashOpen(false);
              dispatch(setSelectedFolderId(id));
              setSelectedPasswordId(null);
            }}
            onEditFolder={handleEditFolder}
            onDeleteFolder={handleDeleteFolder}
            trashOpen={trashOpen}
            trashCount={totalTrashCount}
            onToggleTrash={handleToggleTrash}
          />

          {trashOpen ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm dark:bg-slate-800 dark:border-slate-700 min-h-[600px] flex flex-col min-w-0 p-4 sm:p-6 lg:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Trash2 size={20} className="text-rose-500" />
                    <span>Trash</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                      {totalTrashCount} {totalTrashCount === 1 ? 'item' : 'items'}
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Deleted passwords and folders are kept here safely. You can restore them anytime back to your vault.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTrashOpen(false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition self-start sm:self-auto"
                >
                  Back to Vault
                </button>
              </div>

              {/* Trash Tabs */}
              <div className="flex items-center gap-2 my-4 border-b border-slate-200 dark:border-slate-700 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setTrashTab('passwords');
                    setTrashSearch('');
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    trashTab === 'passwords'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  <Lock size={15} />
                  <span>Passwords</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      trashTab === 'passwords'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {trash?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTrashTab('folders');
                    setTrashSearch('');
                  }}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                    trashTab === 'folders'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                  }`}
                >
                  <Folder size={15} />
                  <span>Folders</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      trashTab === 'folders'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {folderTrash?.length || 0}
                  </span>
                </button>
              </div>

              {/* Passwords Tab */}
              {trashTab === 'passwords' && (
                <>
                  {(trash?.length || 0) > 0 && (
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={trashSearch}
                          onChange={(e) => setTrashSearch(e.target.value)}
                          placeholder="Search in trash by name, login, or folder..."
                          className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition dark:bg-slate-750 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
                        />
                        {trashSearch && (
                          <button
                            type="button"
                            onClick={() => setTrashSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Showing {filteredTrash.length} of {trash?.length || 0} {trash?.length === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                  )}

                  {trashLoading && (
                    <div className="flex-1 flex items-center justify-center p-12 text-slate-500 dark:text-slate-400 text-sm">
                      Loading trash...
                    </div>
                  )}

                  {!trashLoading && (!trash || trash.length === 0) && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-750 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                        <Trash2 size={28} />
                      </div>
                      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        No deleted passwords
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                        When you delete passwords, they will appear here so you can easily recover them anytime.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTrashOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 text-xs font-semibold transition"
                      >
                        Return to Vault
                      </button>
                    </div>
                  )}

                  {!trashLoading && (trash?.length || 0) > 0 && filteredTrash.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                      <p className="text-sm">No items match "{trashSearch}"</p>
                      <button
                        type="button"
                        onClick={() => setTrashSearch('')}
                        className="mt-2 text-xs text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        Clear search
                      </button>
                    </div>
                  )}

                  {!trashLoading && filteredTrash.length > 0 && (
                    <div className="space-y-2.5 flex-1 overflow-y-auto">
                      {filteredTrash.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50/70 dark:bg-slate-800 dark:hover:bg-slate-750/70 transition shadow-xs"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                              <Lock size={18} />
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {item.name}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                {item.login && (
                                  <span className="truncate max-w-[200px]" title={item.login}>
                                    {item.login}
                                  </span>
                                )}
                                {item.folder?.name && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-650">
                                    <Folder size={11} className="text-slate-400 shrink-0" />
                                    <span className="truncate max-w-[150px]">{item.folder.name}</span>
                                  </span>
                                )}
                                {item.deletedAt && (
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                    Deleted {new Date(item.deletedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleRestoreTrashItem(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition border border-emerald-200/70 dark:border-emerald-800"
                              title="Restore password to its original folder"
                            >
                              <RotateCcw size={13} />
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePurgeTrashItem(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 transition border border-rose-200/70 dark:border-rose-800"
                              title="Permanently erase from database"
                            >
                              <Trash2 size={13} />
                              Delete permanently
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Folders Tab */}
              {trashTab === 'folders' && (
                <>
                  {(folderTrash?.length || 0) > 0 && (
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={trashSearch}
                          onChange={(e) => setTrashSearch(e.target.value)}
                          placeholder="Search in trash by folder name..."
                          className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition dark:bg-slate-750 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
                        />
                        {trashSearch && (
                          <button
                            type="button"
                            onClick={() => setTrashSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Showing {filteredFolderTrash.length} of {folderTrash?.length || 0} {folderTrash?.length === 1 ? 'folder' : 'folders'}
                      </div>
                    </div>
                  )}

                  {folderTrashLoading && (
                    <div className="flex-1 flex items-center justify-center p-12 text-slate-500 dark:text-slate-400 text-sm">
                      Loading deleted folders...
                    </div>
                  )}

                  {!folderTrashLoading && (!folderTrash || folderTrash.length === 0) && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-750 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                        <Folder size={28} />
                      </div>
                      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        No deleted folders
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                        When you delete a folder, it will appear here along with its passwords so you can easily restore them anytime.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTrashOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 text-xs font-semibold transition"
                      >
                        Return to Vault
                      </button>
                    </div>
                  )}

                  {!folderTrashLoading && (folderTrash?.length || 0) > 0 && filteredFolderTrash.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
                      <p className="text-sm">No folders match "{trashSearch}"</p>
                      <button
                        type="button"
                        onClick={() => setTrashSearch('')}
                        className="mt-2 text-xs text-rose-600 dark:text-rose-400 hover:underline"
                      >
                        Clear search
                      </button>
                    </div>
                  )}

                  {!folderTrashLoading && filteredFolderTrash.length > 0 && (
                    <div className="space-y-2.5 flex-1 overflow-y-auto">
                      {filteredFolderTrash.map((folder) => {
                        const count = folder._count?.passwords ?? 0;
                        return (
                          <div
                            key={folder.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50/70 dark:bg-slate-800 dark:hover:bg-slate-750/70 transition shadow-xs"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                                <Folder size={18} />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {folder.name}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-650">
                                    <Lock size={11} className="text-slate-400 shrink-0" />
                                    <span>{count} {count === 1 ? 'password' : 'passwords'} inside</span>
                                  </span>
                                  {folder.deletedAt && (
                                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                      Deleted {new Date(folder.deletedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => handleRestoreTrashFolder(folder)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition border border-emerald-200/70 dark:border-emerald-800"
                                title="Restore folder and all its passwords"
                              >
                                <RotateCcw size={13} />
                                Restore
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePurgeTrashFolder(folder)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 transition border border-rose-200/70 dark:border-rose-800"
                                title="Permanently erase folder and all its passwords"
                              >
                                <Trash2 size={13} />
                                Delete permanently
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <MyVaultPasswordWorkspace
              loading={loading}
              passwords={filteredPasswords}
              selectedPasswordId={selectedPasswordId}
              onSelectPassword={setSelectedPasswordId}
              onViewPassword={handleViewPassword}
              onSharePassword={handleOpenShare}
              onEditPassword={handleEditPassword}
              onDeletePassword={handleDeletePassword}
              onManageShares={handleManageShares}
              onAddChild={openAddPasswordModal}
            />
          )}
        </div>

        <CreateFolderModal
          open={folderModalOpen}
          onClose={() => setFolderModalOpen(false)}
          onSubmit={handleCreateFolder}
        />

        <EditFolderModal
          open={editFolderOpen}
          folder={selectedFolderForEdit}
          onClose={() => {
            setEditFolderOpen(false);
            setSelectedFolderForEdit(null);
          }}
          onSubmit={handleUpdateFolder}
        />

        <AddMyVaultPasswordModal
          open={passwordModalOpen}
          folders={folders}
          selectedFolder={addFolderForChild || selectedFolder}
          parent={addChildParent}
          onClose={() => {
            setPasswordModalOpen(false);
            setAddChildParent(null);
          }}
          onSubmit={handleCreatePassword}
        />

        <EditMyVaultPasswordModal
          open={editPasswordOpen}
          password={selectedPasswordForEdit}
          folders={folders}
          onClose={() => {
            setEditPasswordOpen(false);
            setSelectedPasswordForEdit(null);
          }}
          onSubmit={handleUpdatePassword}
        />

        <SharePasswordModal
          open={shareModalOpen}
          password={selectedPassword}
          loading={sharing}
          error={shareError}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedPassword(null);
          }}
          onSubmit={handleSharePassword}
        />

        <ManagePasswordSharesModal
          open={manageSharesOpen}
          password={selectedPassword}
          onClose={() => {
            setManageSharesOpen(false);
            setSelectedPassword(null);
          }}
          onRemoveShare={handleRemoveShare}
        />
        <ViewMyVaultPasswordModal
          open={viewPasswordOpen}
          password={selectedPasswordForView}
          onClose={() => {
            setViewPasswordOpen(false);
            setSelectedPasswordForView(null);
          }}
        />

        <ConfirmModal
          open={confirmDelete.open}
          title={confirmDelete.type === 'folder' ? 'Move Folder to Trash' : 'Move Password to Trash'}
          message={
            confirmDelete.type === 'folder'
              ? `Are you sure you want to move folder "${confirmDelete.item?.name}" to Trash? Its passwords will also be moved to Trash. You can restore them anytime.`
              : `Are you sure you want to move "${confirmDelete.item?.name}" to Trash? You can restore it anytime.`
          }
          confirmLabel={confirmDelete.type === 'folder' ? 'Move to Trash' : 'Delete'}
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete({ open: false, type: '', item: null })}
        />

        <ConfirmModal
          open={confirmPurge.open}
          title={confirmPurge.type === 'folder' ? 'Permanently Delete Folder' : 'Permanently Delete Password'}
          message={
            confirmPurge.type === 'folder'
              ? `Are you sure you want to permanently delete folder "${confirmPurge.item?.name}" and all its passwords? This cannot be undone.`
              : `Are you sure you want to permanently delete "${confirmPurge.item?.name}"? This cannot be undone.`
          }
          confirmLabel="Delete permanently"
          onConfirm={executePurgeTrash}
          onCancel={() => setConfirmPurge({ open: false, type: '', item: null })}
        />

        <VerifyMasterPasswordModal
          open={reVerifyOpen}
          onClose={() => {
            setReVerifyOpen(false);
            setPendingSharePassword(null);
          }}
          onVerified={() => {
            setReVerifyOpen(false);
            const pw = pendingSharePassword;
            setPendingSharePassword(null);
            if (pw) {
              dispatch(clearShareError());
              setSelectedPassword(pw);
              setShareModalOpen(true);
            }
          }}
        />
      </div>
    </AppLayout>
  );
}

export default MyVaultPage;