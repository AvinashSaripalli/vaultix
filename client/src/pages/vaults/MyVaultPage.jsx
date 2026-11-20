import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Trash2, RotateCcw, Folder, Lock, Search } from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';

import MyVaultHeader from '../../components/myVault/MyVaultHeader';
import MyVaultSidebar from '../../components/myVault/MyVaultSidebar';
import MyVaultPasswordWorkspace from '../../components/myVault/MyVaultPasswordWorkspace';
import TrashTableView from '../../components/vault/TrashTableView';

import CreateFolderModal from '../../components/myVault/CreateFolderModal';
import EditFolderModal from '../../components/myVault/EditFolderModal';

import AddMyVaultPasswordModal from '../../components/myVault/AddMyVaultPasswordModal';
import EditMyVaultPasswordModal from '../../components/myVault/EditMyVaultPasswordModal';

import SharePasswordModal from '../../components/myVault/SharePasswordModal';
import ManagePasswordSharesModal from '../../components/myVault/ManagePasswordSharesModal';
import ViewMyVaultPasswordModal from '../../components/myVault/ViewMyVaultPasswordModal';
import TransferToCompanyModal from '../../components/myVault/TransferToCompanyModal';
import ExportPersonalVaultModal from '../../components/myVault/ExportPersonalVaultModal';
import VerifyMasterPasswordModal from '../../components/security/VerifyMasterPasswordModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import FolderHistoryPanel from '../../components/folder/FolderHistoryPanel';
import { showToast } from '../../utils/toast';
import { notifyVaultMutated, subscribeToVaultMutations } from '../../utils/vaultSync';

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
    vault,
    folders,
    passwords,
    selectedFolderId,
    loading,
    trash,
    trashLoading,
    folderTrash,
    folderTrashLoading,
  } = useSelector((state) => state.myVault);

  const [historyFolder, setHistoryFolder] = useState(null);
  const totalTrashCount = (trash?.length || 0) + (folderTrash?.length || 0);

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
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedPasswordForTransfer, setSelectedPasswordForTransfer] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [viewPasswordOpen, setViewPasswordOpen] = useState(false);
  const [selectedPasswordForView, setSelectedPasswordForView] = useState(null);
  const [selectedPasswordId, setSelectedPasswordId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, type: '', item: null });
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [pendingSharePassword, setPendingSharePassword] = useState(null);
  const [trashOpen, setTrashOpen] = useState(false);

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

  useEffect(() => {
    const unsubscribe = subscribeToVaultMutations(() => {
      dispatch(fetchMyVault());
      if (trashOpen) {
        dispatch(fetchMyVaultTrash());
        dispatch(fetchMyVaultFolderTrash());
      }
    });
    return unsubscribe;
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

  useEffect(() => {
    const handler = () => openAddPasswordModal();
    window.addEventListener('vaultix:mobile-add-item', handler);
    return () => window.removeEventListener('vaultix:mobile-add-item', handler);
  }, []);

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
      notifyVaultMutated({ id: selectedFolderForEdit.id, action: 'UPDATE_FOLDER', vaultType: 'personal' });
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
      notifyVaultMutated({
        id: result.payload?.id,
        folderId: payload.folderId,
        action: 'CREATE',
        vaultType: 'personal',
        name: payload.name,
        login: payload.login,
        url: payload.url,
        decryptedPassword: payload.rawPassword,
        decryptedFields: payload.rawFields,
        decryptedNote: payload.rawNote,
        updatedAt: result.payload?.updatedAt || new Date().toISOString(),
      });
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
      notifyVaultMutated({
        id: selectedPasswordForEdit.id,
        folderId: data.folderId,
        action: 'UPDATE',
        vaultType: 'personal',
        name: data.name,
        login: data.login,
        url: data.url,
        decryptedPassword: data.rawPassword,
        decryptedFields: data.rawFields,
        decryptedNote: data.rawNote,
        updatedAt: result.payload?.updatedAt || new Date().toISOString(),
      });
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
      notifyVaultMutated({ id: item.id, action: 'DELETE_FOLDER', vaultType: 'personal' });
      showToast(`Folder "${item.name}" and its passwords moved to Trash`, 'info');
    } else if (type === 'password') {
      await dispatch(deleteMyVaultPassword(item.id));
      dispatch(fetchMyVaultTrash());
      notifyVaultMutated({ id: item.id, action: 'DELETE', vaultType: 'personal' });
      showToast(`${item.name} moved to Trash`, 'info', 6000, {
        label: 'Undo',
        onClick: () => handleRestoreTrashItem(item),
      });
    }

    setConfirmDelete({ open: false, type: '', item: null });
  };

  const handleOpenTransfer = (password) => {
    setSelectedPasswordForTransfer(password);
    setTransferModalOpen(true);
  };

  const handlePasswordTransferred = (transferredItem) => {
    dispatch(fetchMyVault());
    if (transferredItem?.id) {
      notifyVaultMutated({
        id: transferredItem.id,
        folderId: transferredItem.folderId,
        action: 'MOVE',
        vaultType: 'personal',
      });
    }
    setSelectedPasswordId(null);
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
      notifyVaultMutated({ id: folder.id, action: 'RESTORE_FOLDER', vaultType: 'personal' });
      dispatch(fetchMyVault());
      dispatch(fetchMyVaultFolderTrash());
      dispatch(fetchMyVaultTrash());
      showToast(`Folder "${folder.name}" and its passwords restored`, 'success');
    } else {
      showToast(result.payload || 'Failed to restore folder', 'error');
    }
  };

  const handlePurgeTrashFolder = async (folder) => {
    const result = await dispatch(purgeMyVaultFolder(folder.id));
    if (purgeMyVaultFolder.fulfilled.match(result)) {
      notifyVaultMutated({ id: folder.id, action: 'PURGE_FOLDER', vaultType: 'personal' });
      dispatch(fetchMyVaultFolderTrash());
      dispatch(fetchMyVaultTrash());
      showToast(`Folder "${folder.name}" permanently deleted`);
    } else {
      showToast(result.payload || 'Failed to delete folder permanently', 'error');
    }
  };

  const handleRestoreTrashItem = async (item) => {
    const result = await dispatch(restoreMyVaultPassword(item.id));
    if (restoreMyVaultPassword.fulfilled.match(result)) {
      notifyVaultMutated({ id: item.id, action: 'RESTORE', vaultType: 'personal' });
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

  const handlePurgeTrashItem = async (item) => {
    const result = await dispatch(purgeMyVaultPassword(item.id));
    if (purgeMyVaultPassword.fulfilled.match(result)) {
      notifyVaultMutated({ id: item.id, action: 'PURGE', vaultType: 'personal' });
      dispatch(fetchMyVaultTrash());
      showToast(`"${item.name}" permanently deleted`);
    } else {
      showToast(result.payload || 'Failed to delete permanently', 'error');
    }
  };

  const handleBatchRestore = async (items, foldersToRestore) => {
    let count = 0;
    for (const folder of foldersToRestore) {
      const res = await dispatch(restoreMyVaultFolder(folder.id));
      if (restoreMyVaultFolder.fulfilled.match(res)) count++;
    }
    for (const item of items) {
      const res = await dispatch(restoreMyVaultPassword(item.id));
      if (restoreMyVaultPassword.fulfilled.match(res)) count++;
    }
    dispatch(fetchMyVault());
    dispatch(fetchMyVaultTrash());
    dispatch(fetchMyVaultFolderTrash());
    showToast(`Restored ${count} ${count === 1 ? 'item' : 'items'}`);
  };

  const handleBatchPurge = async (items, foldersToPurge) => {
    let count = 0;
    for (const item of items) {
      const res = await dispatch(purgeMyVaultPassword(item.id));
      if (purgeMyVaultPassword.fulfilled.match(res)) count++;
    }
    for (const folder of foldersToPurge) {
      const res = await dispatch(purgeMyVaultFolder(folder.id));
      if (purgeMyVaultFolder.fulfilled.match(res)) count++;
    }
    dispatch(fetchMyVaultTrash());
    dispatch(fetchMyVaultFolderTrash());
    showToast(`Permanently deleted ${count} ${count === 1 ? 'item' : 'items'}`);
  };

  const handleEmptyTrash = async () => {
    let count = 0;
    for (const item of (trash || [])) {
      const res = await dispatch(purgeMyVaultPassword(item.id));
      if (purgeMyVaultPassword.fulfilled.match(res)) count++;
    }
    for (const folder of (folderTrash || [])) {
      const res = await dispatch(purgeMyVaultFolder(folder.id));
      if (purgeMyVaultFolder.fulfilled.match(res)) count++;
    }
    dispatch(fetchMyVaultTrash());
    dispatch(fetchMyVaultFolderTrash());
    showToast('Personal trash emptied permanently');
  };

  const handleToggleTrash = () => {
    setTrashOpen((prev) => !prev);
  };

  return (
    <AppLayout>
      <div className="space-y-5 sm:space-y-6 min-w-0">
        <div className={selectedPasswordId ? 'hidden xl:block' : 'block'}>
          <MyVaultHeader
            folders={folders}
            onCreateFolder={() => setFolderModalOpen(true)}
            onCreatePassword={() => openAddPasswordModal()}
            onOpenExport={() => setExportModalOpen(true)}
            trashOpen={trashOpen}
            trashCount={totalTrashCount}
            onToggleTrash={handleToggleTrash}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-4 sm:gap-5 items-stretch min-w-0">
          <div className={selectedPasswordId ? 'hidden xl:block' : 'block'}>
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
              onViewHistory={(folder) => setHistoryFolder(folder)}
              trashOpen={trashOpen}
              trashCount={totalTrashCount}
              onToggleTrash={handleToggleTrash}
            />
          </div>

          {trashOpen ? (
            <TrashTableView
              title="Personal Vault"
              trashItems={trash || []}
              folderTrashItems={folderTrash || []}
              isLoading={trashLoading || folderTrashLoading}
              folders={folders}
              onRestoreItem={handleRestoreTrashItem}
              onPurgeItem={handlePurgeTrashItem}
              onRestoreFolder={handleRestoreTrashFolder}
              onPurgeFolder={handlePurgeTrashFolder}
              onBatchRestore={handleBatchRestore}
              onBatchPurge={handleBatchPurge}
              onEmptyTrash={handleEmptyTrash}
              onClose={() => setTrashOpen(false)}
              isSuperAdmin={true}
              isCompanyVault={false}
            />
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
              onTransferToCompany={handleOpenTransfer}
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

        <TransferToCompanyModal
          open={transferModalOpen}
          item={selectedPasswordForTransfer}
          onClose={() => {
            setTransferModalOpen(false);
            setSelectedPasswordForTransfer(null);
          }}
          onTransferred={handlePasswordTransferred}
        />

        <ExportPersonalVaultModal
          open={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          passwords={passwords}
          folders={folders}
          selectedFolderId={selectedFolderId}
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
        <FolderHistoryPanel
          open={Boolean(historyFolder)}
          onClose={() => setHistoryFolder(null)}
          vaultId={vault?.id}
          folder={historyFolder}
        />
      </div>
    </AppLayout>
  );
}

export default MyVaultPage;