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
    } else if (type === 'password') {
      await dispatch(deleteMyVaultPassword(item.id));
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
    await dispatch(restoreMyVaultPassword(item.id));
  };

  const handlePurgeTrashItem = (item) => {
    setConfirmPurge({ open: true, item });
  };

  const executePurgeTrash = async () => {
    if (!confirmPurge.item) return;
    await dispatch(purgeMyVaultPassword(confirmPurge.item.id));
    setConfirmPurge({ open: false, item: null });
  };

  const handleToggleTrash = () => {
    setTrashOpen((prev) => !prev);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <MyVaultHeader
              folders={folders}
              onCreateFolder={() => setFolderModalOpen(true)}
              onCreatePassword={() => openAddPasswordModal()}
            />
          </div>
          <button
            onClick={handleToggleTrash}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${
              trashOpen
                ? 'bg-red-50 border-red-300 text-red-600 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
            }`}
          >
            <Trash2 size={18} />
            {trashOpen ? 'Back to Vault' : 'Trash'}
          </button>
        </div>

        {trashOpen ? (
          <div className="bg-white rounded-[30px] border border-slate-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
            <div className="px-8 py-6">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                Trash
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Deleted passwords can be restored or permanently removed.
              </p>
            </div>

            {trashLoading && (
              <div className="px-8 pb-6 text-slate-500 dark:text-slate-400 text-sm">
                Loading trash...
              </div>
            )}

            {!trashLoading && trash.length === 0 && (
              <div className="px-8 pb-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                Trash is empty.
              </div>
            )}

            {!trashLoading && trash.length > 0 && (
              <div className="px-8 pb-6 space-y-2">
                {trash.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {item.name}
                      </p>
                      {item.login && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {item.login}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => handleRestoreTrashItem(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                      <button
                        onClick={() => handlePurgeTrashItem(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
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
          <>
            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 sm:gap-5 min-w-0">
              <MyVaultSidebar
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelectFolder={(id) => dispatch(setSelectedFolderId(id))}
                onEditFolder={handleEditFolder}
                onDeleteFolder={handleDeleteFolder}
              />

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
            </div>
          </>
        )}

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