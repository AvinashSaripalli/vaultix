import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Trash2, RotateCcw } from 'lucide-react';
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
  restoreMyVaultPassword,
  purgeMyVaultPassword,
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

  const { folders, passwords, selectedFolderId, loading, trash, trashLoading } = useSelector(
    (state) => state.myVault
  );

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
  }, [dispatch]);

  useEffect(() => {
    if (trashOpen) {
      dispatch(fetchMyVaultTrash());
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
      showToast(`Folder "${item.name}" deleted`, 'info');
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

  const handleRestoreTrashItem = async (item) => {
    const result = await dispatch(restoreMyVaultPassword(item.id));
    if (restoreMyVaultPassword.fulfilled.match(result)) {
      dispatch(fetchMyVault());
      dispatch(fetchMyVaultTrash());
      showToast(`"${item.name}" restored to your vault`, 'success');
    } else {
      showToast(result.payload || 'Failed to restore item', 'error');
    }
  };

  const handlePurgeTrashItem = (item) => {
    setConfirmPurge({ open: true, item });
  };

  const executePurgeTrash = async () => {
    if (!confirmPurge.item) return;
    const itemToPurge = confirmPurge.item;
    const result = await dispatch(purgeMyVaultPassword(itemToPurge.id));
    if (purgeMyVaultPassword.fulfilled.match(result)) {
      dispatch(fetchMyVaultTrash());
      showToast(`"${itemToPurge.name}" permanently deleted`, 'info');
    } else {
      showToast(result.payload || 'Failed to delete permanently', 'error');
    }
    setConfirmPurge({ open: false, item: null });
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
          trashCount={trash?.length || 0}
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
            trashCount={trash?.length || 0}
            onToggleTrash={handleToggleTrash}
          />

          {trashOpen ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm dark:bg-slate-800 dark:border-slate-700 min-h-[600px] flex flex-col min-w-0">
              <div className="px-5 sm:px-8 py-5 sm:py-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Trash2 size={20} className="text-rose-500" />
                    <span>Trash</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                      {trash.length} {trash.length === 1 ? 'item' : 'items'}
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Deleted passwords are kept here safely. You can restore them anytime back to your vault.
                  </p>
                </div>
                {trash.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTrashOpen(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition self-start sm:self-auto"
                  >
                    Back to Items
                  </button>
                )}
              </div>

              {trashLoading && (
                <div className="flex-1 flex items-center justify-center p-12 text-slate-500 dark:text-slate-400 text-sm">
                  Loading trash...
                </div>
              )}

              {!trashLoading && trash.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 dark:text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400 mb-3 shadow-sm">
                    <Trash2 size={24} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Trash is empty
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                    No deleted passwords. Items you delete will appear here so you can easily recover them.
                  </p>
                </div>
              )}

              {!trashLoading && trash.length > 0 && (
                <div className="p-4 sm:p-6 space-y-2.5 flex-1 overflow-y-auto">
                  {trash.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50/60 dark:bg-slate-800 dark:hover:bg-slate-750 transition shadow-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          {item.login && <span className="truncate">{item.login}</span>}
                          {item.folder?.name && (
                            <>
                              <span>•</span>
                              <span className="truncate">📁 {item.folder.name}</span>
                            </>
                          )}
                          {item.deletedAt && (
                            <>
                              <span>•</span>
                              <span className="text-[11px] text-slate-400">
                                Deleted {new Date(item.deletedAt).toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestoreTrashItem(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition border border-emerald-200 dark:border-emerald-800"
                          title="Restore password to its folder"
                        >
                          <RotateCcw size={14} />
                          Restore
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePurgeTrashItem(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/50 transition border border-rose-200 dark:border-rose-800"
                          title="Permanently erase from database"
                        >
                          <Trash2 size={14} />
                          Delete permanently
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
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
          title={confirmDelete.type === 'folder' ? 'Delete Folder' : 'Delete Password'}
          message={
            confirmDelete.type === 'folder'
              ? `Are you sure you want to delete "${confirmDelete.item?.name}"? This action cannot be undone.`
              : `Are you sure you want to delete "${confirmDelete.item?.name}"? This action cannot be undone.`
          }
          confirmLabel="Delete"
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete({ open: false, type: '', item: null })}
        />

        <ConfirmModal
          open={confirmPurge.open}
          title="Permanently Delete"
          message={`Are you sure you want to permanently delete "${confirmPurge.item?.name}"? This cannot be undone.`}
          confirmLabel="Delete permanently"
          onConfirm={executePurgeTrash}
          onCancel={() => setConfirmPurge({ open: false, item: null })}
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