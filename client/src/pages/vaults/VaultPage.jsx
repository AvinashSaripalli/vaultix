import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useSearchParams, Link } from 'react-router-dom';

import AppLayout from '../../components/layout/AppLayout';
import PasswordListPanel from '../../components/vault/PasswordListPanel';
import PasswordDetailsPanel from '../../components/vault/PasswordDetailsPanel';
import FolderItemsTableView from '../../components/vault/FolderItemsTableView';
import TrashTableView from '../../components/vault/TrashTableView';
import AddPasswordModal from '../../components/vault/AddPasswordModal';
import EditPasswordModal from '../../components/vault/EditPasswordModal';
import AddFolderModal from '../../components/vault/AddFolderModal';
import ShareFolderModal from '../../components/folder/ShareFolderModal';
import ShareVaultModal from '../../components/vault/ShareVaultModal';
import FolderHistoryPanel from '../../components/folder/FolderHistoryPanel';
import FolderMembersSummary from '../../components/folder/FolderMembersSummary';
import FolderUsersModal from '../../components/folder/FolderUsersModal';
import ConfirmModal from '../../components/common/ConfirmModal';
import { safeDecryptText, unwrapItemKey, decryptTextWithAesKey, decryptPrivateKey, encryptTextWithAesKey, encryptValueWithAesKey, generateItemAesKey, encryptFieldsWithAesKey, wrapItemKey, isEncryptedFormat } from '../../utils/crypto';
import { getWrapRecipients, wrapItemKeysForUsers, clearKeyWrappingCaches } from '../../utils/keyWrapping';
import { ITEM_TYPES, serializeCustomFields, CUSTOM_FIELDS_KEY } from '../../utils/itemTypes';

const TYPE_MAP = Object.fromEntries(ITEM_TYPES.map((item) => [item.value, true]));
import { showToast } from '../../utils/toast';
import { setSessionRsaPrivateKey, setSessionRsaPublicKey } from '../../features/auth/authSlice';
import { parseImportFile, downloadExport, detectFileFormat } from '../../utils/vaultImportExport';

import api from '../../services/api';

import {
  MoreVertical,
  History,
  Users,
  Download,
  Upload,
  Trash2,
  ChevronDown,
  RotateCcw,
  Shield,
  Plus,
  ArrowLeft,
  Search,
  Folder,
  Lock,
  ShieldAlert,
  FolderOpen,
} from 'lucide-react';

import {
  fetchPasswordsByVault,
  fetchVaultBySlug,
  fetchFoldersByVault,
  openAddPasswordModal,
  deleteFolder,
  fetchVaultTrash,
  fetchVaultFolderTrash,
  restorePassword,
  purgePassword,
  restoreFolder,
  purgeFolder,
  selectPassword,
  selectFolder,
  clearSelectedFolder,
} from '../../features/vault/vaultSlice';

import VaultPolicyModal from '../../components/vault/VaultPolicyModal';
import { subscribeToVaultMutations } from '../../utils/vaultSync';

function VaultPage() {
  const dispatch = useDispatch();
  const { slug } = useParams();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [vaultShareOpen, setVaultShareOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prefillData, setPrefillData] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const trashOpen = searchParams.get('tab') === 'trash';
  const setTrashOpen = (open) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (open) {
          next.set('tab', 'trash');
        } else {
          next.delete('tab');
        }
        return next;
      },
      { replace: true }
    );
  };
  const [policyOpen, setPolicyOpen] = useState(false);
  const [auditExportOpen, setAuditExportOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const { user, token, sessionMasterPassword, sessionRsaPrivateKey, sessionRsaPublicKey } = useSelector(
    (state) => state.auth
  );

  const isAdminUser = ['SUPER_ADMIN', 'ADMIN'].includes(user?.role);

  const {
    selectedVault,
    folders,
    selectedFolderId,
    vaultsLoading,
    passwordsLoading,
    passwords,
    selectedPasswordId,
    trashByVault,
    trashLoading,
    folderTrashByVault,
    folderTrashLoading,
    error,
  } = useSelector((state) => state.vault);

  const trashItems = trashByVault[selectedVault?.id] || [];
  const folderTrashItems = folderTrashByVault[selectedVault?.id] || [];
  const totalTrashCount = trashItems.length + folderTrashItems.length;

  const selectedFolder = folders.find((item) => item.id === selectedFolderId);

  const selectedFolderPermission = selectedFolder?.permissions?.find(
    (item) => item.userId === user?.id || item.user?.id === user?.id
  );
  const selectedFolderDeptMember = selectedFolder?.departmentMembers?.find(
    (dm) => dm.user?.id === user?.id
  );

  const selectedFolderAccess = (() => {
    if (isAdminUser) return 'ADMINISTRATOR';
    const direct = selectedFolderPermission?.accessLevel || null;
    const dept = selectedFolderDeptMember?.accessLevel || null;

    // Direct FORBIDDEN is an explicit deny that wins over department access
    if (direct === 'FORBIDDEN') return 'FORBIDDEN';

    // Blocked user check
    const isBlocked = Array.isArray(selectedFolder?.blockedUserIds) && selectedFolder.blockedUserIds.includes(user?.id);
    if (isBlocked && !direct) return 'FORBIDDEN';

    // Department FORBIDDEN is also an explicit deny
    if (dept === 'FORBIDDEN' && !direct) return 'FORBIDDEN';

    if (!direct && !dept) return null;
    if (!direct) return dept;
    if (!dept) return direct;

    const RANK = { READ_ONLY: 0, READ_WRITE: 1, FULL_ACCESS: 2, ADMINISTRATOR: 3 };
    const getRank = (lvl) => RANK[lvl] ?? -1;
    return getRank(direct) >= getRank(dept) ? direct : dept;
  })();

  const isFolderForbidden = Boolean(
    !isAdminUser &&
    selectedFolder &&
    (
      selectedFolderAccess === 'FORBIDDEN' ||
      !selectedFolderAccess ||
      selectedFolderPermission?.accessLevel === 'FORBIDDEN' ||
      (Array.isArray(selectedFolder?.blockedUserIds) && selectedFolder.blockedUserIds.includes(user?.id))
    )
  );

  const canAddPassword =
    !isFolderForbidden &&
    (isAdminUser || ['ADMINISTRATOR', 'READ_WRITE', 'FULL_ACCESS'].includes(selectedFolderAccess));

  const canShareFolder =
    !isFolderForbidden &&
    !!selectedFolder &&
    (isAdminUser || selectedFolderAccess === 'ADMINISTRATOR');

  const canDeleteFolder =
    !isFolderForbidden &&
    !!selectedFolder &&
    (isAdminUser || selectedFolderAccess === 'ADMINISTRATOR');

  const canManageFolderMembers =
    !isFolderForbidden &&
    !!selectedFolder &&
    (isAdminUser || selectedFolderAccess === 'ADMINISTRATOR');

  const canExport =
    !isFolderForbidden &&
    (isAdminUser || ['ADMINISTRATOR', 'FULL_ACCESS'].includes(selectedFolderAccess));

  const canImport =
    !isFolderForbidden &&
    (isAdminUser || ['ADMINISTRATOR', 'FULL_ACCESS'].includes(selectedFolderAccess));

  const canViewTrash =
    isAdminUser ||
    (selectedFolder
      ? ['ADMINISTRATOR', 'FULL_ACCESS'].includes(selectedFolderAccess)
      : folders.some((f) => {
          const direct = f.permissions?.find((p) => p.userId === user?.id || p.user?.id === user?.id)?.accessLevel;
          const dept = f.departmentMembers?.find((dm) => dm.user?.id === user?.id)?.accessLevel;
          return (
            ['ADMINISTRATOR', 'FULL_ACCESS'].includes(direct) ||
            ['ADMINISTRATOR', 'FULL_ACCESS'].includes(dept)
          );
        }));

  const isTrashView = trashOpen && canViewTrash;

  useEffect(() => {
    if (isFolderForbidden && selectedPasswordId) {
      dispatch(selectPassword(null));
    }
  }, [isFolderForbidden, selectedPasswordId, dispatch]);

  useEffect(() => {
    const handler = () => {
      setPrefillData(null);
      dispatch(openAddPasswordModal());
    };
    window.addEventListener('vaultix:mobile-add-item', handler);
    return () => window.removeEventListener('vaultix:mobile-add-item', handler);
  }, [dispatch]);

  useEffect(() => {
    if (slug) {
      dispatch(fetchVaultBySlug(slug));
    }
  }, [dispatch, slug]);

  useEffect(() => {
    if (selectedVault?.id) {
      dispatch(fetchPasswordsByVault(selectedVault.id));
      dispatch(fetchFoldersByVault(selectedVault.id));
    }
  }, [dispatch, selectedVault?.id]);

  useEffect(() => {
    if (selectedVault?.id && canViewTrash) {
      dispatch(fetchVaultTrash(selectedVault.id));
      dispatch(fetchVaultFolderTrash(selectedVault.id));
    }
  }, [dispatch, selectedVault?.id, trashOpen, canViewTrash]);

  useEffect(() => {
    const unsubscribe = subscribeToVaultMutations(() => {
      if (selectedVault?.id) {
        dispatch(fetchPasswordsByVault(selectedVault.id));
        dispatch(fetchFoldersByVault(selectedVault.id));
        if (canViewTrash) {
          dispatch(fetchVaultTrash(selectedVault.id));
          dispatch(fetchVaultFolderTrash(selectedVault.id));
        }
      }
    });
    return unsubscribe;
  }, [dispatch, selectedVault?.id, canViewTrash]);

  const healedItemIdsRef = useRef(new Set());
  const isHealingRef = useRef(false);

  useEffect(() => {
    if (
      !selectedVault?.id ||
      !sessionRsaPrivateKey ||
      !sessionRsaPublicKey ||
      isHealingRef.current
    ) return;

    const unhealedItems = passwords.filter((p) => !healedItemIdsRef.current.has(p.id));
    if (unhealedItems.length === 0) return;

    const itemsMissingMyKey = unhealedItems.filter(
      (p) => !p.myWrappedKey && p.encryptedPassword
    );
    const itemsWithMyKey = unhealedItems.filter((p) => p.myWrappedKey);

    if (itemsWithMyKey.length === 0 && itemsMissingMyKey.length === 0) return;

    let cancelled = false;
    isHealingRef.current = true;

    const heal = async () => {
      try {
        const updates = [];

        // 1) Self-heal: I hold the item key — wrap it for any authorized user
        //    who is missing an entry (admins, department members, later-added members).
        for (const item of itemsWithMyKey) {
          if (cancelled) return;
          healedItemIdsRef.current.add(item.id);

          try {
            const recipientIds = await getWrapRecipients(item.folderId, user?.id);
            const have = new Set(item.wrappedUserIds || [user?.id]);
            const missing = recipientIds.filter((uid) => !have.has(uid));

            if (missing.length === 0) continue;

            const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, sessionRsaPrivateKey);
            const additions = await wrapItemKeysForUsers(aesKeyJwk, missing);

            if (Object.keys(additions).length > 0) {
              updates.push({ id: item.id, wrappedKeys: additions });
            }
          } catch {
            // skip items that fail to re-wrap
          }

          // Yield main thread so UI stays 100% smooth
          await new Promise((resolve) => setTimeout(resolve, 60));
        }

        // 2) Legacy migration: no wrapped key for me — try master-password
        //    decryption (works when I created the item under the old scheme),
        //    re-encrypt with a fresh AES key and wrap for all recipients.
        for (const item of itemsMissingMyKey) {
          if (cancelled || !sessionMasterPassword) break;
          healedItemIdsRef.current.add(item.id);

          try {
            const plainPassword = await safeDecryptText(
              item.encryptedPassword, sessionMasterPassword, user?.encryptionSalt
            );

            if (!plainPassword || (isEncryptedFormat(plainPassword))) {
              continue;
            }

            const { encryptedData: reEncrypted, aesKeyJwk } = await encryptTextWithAesKey(plainPassword);

            let reEncryptedNote = undefined;
            if (item.encryptedNote) {
              const plainNote = await safeDecryptText(
                item.encryptedNote, sessionMasterPassword, user?.encryptionSalt
              );
              if (plainNote && !isEncryptedFormat(plainNote)) {
                const { encryptedData } = await encryptTextWithAesKey(plainNote);
                reEncryptedNote = encryptedData;
              }
            }

            const recipientIds = await getWrapRecipients(item.folderId, user?.id);
            const wrappedKeys = await wrapItemKeysForUsers(aesKeyJwk, recipientIds);

            updates.push({
              id: item.id,
              encryptedPassword: reEncrypted,
              ...(reEncryptedNote !== undefined && { encryptedNote: reEncryptedNote }),
              wrappedKeys,
            });
          } catch {
            // skip
          }

          // Yield main thread so PBKDF2 doesn't block interactions
          await new Promise((resolve) => setTimeout(resolve, 80));
        }

        if (cancelled || updates.length === 0) return;

        try {
          await api.post('/passwords/batch-wrap', {
            wrappedPasswords: updates,
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          showToast(`Synchronized encryption keys for ${updates.length} items with team`, 'success');
          dispatch(fetchPasswordsByVault(selectedVault.id));
        } catch {
          // best-effort
        }
      } finally {
        isHealingRef.current = false;
      }
    };

    heal();

    return () => {
      cancelled = true;
      isHealingRef.current = false;
    };
  }, [passwords, selectedVault?.id, sessionRsaPrivateKey, sessionRsaPublicKey, sessionMasterPassword, user, token]);

  const folderPasswords = useMemo(() => {
    if (!selectedFolder?.id) return [];

    return passwords.filter((item) => item.folderId === selectedFolder.id);
  }, [passwords, selectedFolder?.id]);

  const handleExport = (format) => {
    if (!canExport) {
      showToast('You do not have permission to export passwords from this folder', 'error');
      return;
    }

    if (!selectedVault?.id) {
      showToast('Vault not loaded', 'error');
      return;
    }

    if (!selectedFolder?.id) {
      showToast('Please select a folder first', 'error');
      return;
    }

    if (!folderPasswords.length) {
      showToast('No passwords found in this folder', 'error');
      return;
    }

    handleExportVerified(format);
  };

  const handleExportVerified = async (format = 'excel') => {
    try {
      // Self-heal session keys before attempting bulk decryption.
      let rsaKey = sessionRsaPrivateKey;
      if (!rsaKey && user?.id && sessionMasterPassword) {
        try {
          const kpRes = await api.get('/keypair', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (kpRes.data?.encryptedPrivateKey) {
            rsaKey = await decryptPrivateKey(
              kpRes.data.encryptedPrivateKey,
              sessionMasterPassword,
              kpRes.data.salt
            );
            dispatch(setSessionRsaPrivateKey(rsaKey));
            if (kpRes.data.publicKey) {
              dispatch(setSessionRsaPublicKey(kpRes.data.publicKey));
            }
          }
        } catch (err) {
          console.error('Key recovery failed during export:', err);
        }
      }

      const rows = [];

      for (const item of folderPasswords) {
        let originalPassword = '';
        let originalNote = '';

        if (item.myWrappedKey && rsaKey) {
          try {
            const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, rsaKey);
            originalPassword = await decryptTextWithAesKey(item.encryptedPassword, aesKeyJwk);
            originalNote = item.encryptedNote
              ? await decryptTextWithAesKey(item.encryptedNote, aesKeyJwk)
              : '';
          } catch {
            // skip this password
          }
        }

        rows.push({
          Name: item.name || '',
          Type: item.type || 'LOGIN',
          Login: item.login || '',
          Password: originalPassword || '[Encrypted]',
          URL: item.url || '',
          Note: originalNote || '',
          Tags:
            item.tags
              ?.map((tagItem) => tagItem.tag?.name)
              .filter(Boolean)
              .join(', ') || '',
        });
      }

      const baseName = selectedFolder?.name || selectedVault?.name || 'passwords';
      downloadExport(rows, format, baseName);
      setExportMenuOpen(false);
      showToast(`Exported ${rows.length} passwords as ${format.toUpperCase()}`);
    } catch {
      showToast('Export failed. Unable to decrypt passwords.', 'error');
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    const format = detectFileFormat(file);
    if (format === 'keepass') {
      showToast(
        'Direct KeePass KDBX import is not supported for security. Use File > Export > CSV in KeePass and import that CSV instead.',
        'error'
      );
      return;
    }

    if (!selectedVault?.id) {
      showToast('Vault not loaded', 'error');
      return;
    }

    if (!selectedFolder?.id) {
      showToast('Please select a folder first', 'error');
      return;
    }

    setImportFile(file);
    handleImportVerified(file);
  };

  const handleImportVerified = async (importFileArg) => {
    try {
      const file = importFileArg || importFile;
      if (!file) return;

      const { rows } = await parseImportFile(file);

      const publicKeysCache = {};
      const getPublicKeyForUser = async (uid) => {
        if (publicKeysCache[uid]) return publicKeysCache[uid];
        try {
          const res = await api.get(`/keypair/${uid}/public`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          publicKeysCache[uid] = res.data.publicKey;
          return res.data.publicKey;
        } catch {
          return null;
        }
      };

      let folderMemberIds = [];
      try {
        const folderRes = await api.get(`/folders/${selectedFolder.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const permissions = folderRes.data?.permissions || [];
        folderMemberIds = permissions.map((p) => p.userId || p.user?.id).filter(Boolean);
      } catch {
        // best-effort
      }

      if (!folderMemberIds.includes(user.id)) {
        folderMemberIds.push(user.id);
      }

      const encryptedRows = [];

      for (const row of rows) {
        const name = row.Name || row.name || '';
        const login = row.Login || row.login || '';
        const password = row.Password || row.password || '';
        const url = row.URL || row.Url || row.url || '';
        const note = row.Note || row.note || '';
        const tagsText = row.Tags || row.tags || '';

        const tags = tagsText
          ? String(tagsText)
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [];

        let type = String(row.Type || row.type || 'LOGIN').toUpperCase();
        if (!TYPE_MAP[type]) type = 'LOGIN';

        if (!name) continue;
        if (!row.encryptedFields) {
          if (type === 'LOGIN' && (!login || !password)) continue;
        }

        const wrappedKeys = {};

        if (type === 'LOGIN') {
          const { encryptedData: encryptedPassword, aesKeyJwk } = await encryptTextWithAesKey(
            String(password)
          );

          const { encryptedData: encryptedNote } = note
            ? await encryptTextWithAesKey(String(note))
            : { encryptedData: '' };

          const fieldsPayload = {};
          const customFields = row.Fields || row.customFields;
          if (customFields?.length) {
            fieldsPayload[CUSTOM_FIELDS_KEY] = serializeCustomFields(customFields);
          }
          const encryptedFields = await encryptFieldsWithAesKey(fieldsPayload, aesKeyJwk);

          if (aesKeyJwk) {
            for (const uid of folderMemberIds) {
              const pubKey = await getPublicKeyForUser(uid);
              if (pubKey) {
                try {
                  wrappedKeys[uid] = await wrapItemKey(aesKeyJwk, pubKey);
                } catch {
                  // skip
                }
              }
            }
          }

          encryptedRows.push({
            name: String(name).trim(),
            type,
            login: String(login).trim(),
            encryptedPassword,
            encryptedNote,
            encryptedFields,
            url: String(url).trim(),
            tags,
            wrappedKeys: Object.keys(wrappedKeys).length > 0 ? wrappedKeys : null,
          });
          continue;
        }

        // Typed items (CARD, SSH_KEY, API_TOKEN, ...) — single item AES key
        // encrypts note + typed fields so shared users can decrypt.
        const { aesKeyJwk: itemAesKeyJwk } = await generateItemAesKey();

        const encryptedNote = note
          ? await encryptValueWithAesKey(String(note), itemAesKeyJwk)
          : '';

        const fieldsPayload = {};
        const seen = new Set(['Name', 'Type', 'Login', 'Password', 'URL', 'Note', 'Tags', 'Fields']);
        for (const [key, value] of Object.entries(row)) {
          if (seen.has(key)) continue;
          if (value === '' || value === undefined || value === null) continue;
          fieldsPayload[key] = String(value);
        }
        const customFields = row.Fields || row.customFields;
        if (customFields?.length) {
          fieldsPayload[CUSTOM_FIELDS_KEY] = serializeCustomFields(customFields);
        }
        const encryptedFields = await encryptFieldsWithAesKey(fieldsPayload, itemAesKeyJwk);

        if (itemAesKeyJwk) {
          for (const uid of folderMemberIds) {
            const pubKey = await getPublicKeyForUser(uid);
            if (pubKey) {
              try {
                wrappedKeys[uid] = await wrapItemKey(itemAesKeyJwk, pubKey);
              } catch {
                // skip
              }
            }
          }
        }

        encryptedRows.push({
          name: String(name).trim(),
          type,
          login: login ? String(login).trim() : '',
          encryptedPassword: '',
          encryptedNote,
          encryptedFields,
          url: String(url).trim(),
          tags,
          wrappedKeys: Object.keys(wrappedKeys).length > 0 ? wrappedKeys : null,
        });
      }

      if (!encryptedRows.length) {
        showToast('No valid rows found. Required columns: Name/Title and either Login/Password or typed fields', 'error');
        setImportFile(null);
        return;
      }

      await api.post(
        '/passwords/import-excel',
        {
          vaultId: selectedVault.id,
          folderId: selectedFolder.id,
          rows: encryptedRows,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      dispatch(fetchPasswordsByVault(selectedVault.id));
      showToast(`${encryptedRows.length} passwords imported successfully`);
      setMenuOpen(false);
      setImportFile(null);
    } catch (error) {
      showToast(error.response?.data?.message || error.message || 'Failed to import file', 'error');
      setMenuOpen(false);
    }
  };

  const handleRestoreTrashItem = async (item) => {
    const result = await dispatch(restorePassword({ passwordId: item.id, vaultId: selectedVault.id }));
    if (restorePassword.fulfilled.match(result)) {
      dispatch(fetchFoldersByVault(selectedVault.id));
      dispatch(fetchPasswordsByVault(selectedVault.id));
      dispatch(fetchVaultTrash(selectedVault.id));
      dispatch(fetchVaultFolderTrash(selectedVault.id));

      const restoredFolderId = result.payload?.folderId || item.folderId;
      const targetFolder = folders.find((f) => f.id === restoredFolderId);
      const folderName = result.payload?.folderName || item.folder?.name || targetFolder?.name;

      if (restoredFolderId) {
        dispatch(selectFolder(restoredFolderId));
        showToast(
          result.payload?.folderRestored
            ? `Restored "${item.name}" and folder "${folderName}"`
            : `Restored "${item.name}" to folder "${folderName}"`
        );
      } else {
        dispatch(clearSelectedFolder());
        showToast(`Restored "${item.name}" to vault`);
      }

      dispatch(selectPassword(item.id));
      setTrashOpen(false);
    } else {
      showToast(result.payload || 'Failed to restore password', 'error');
    }
  };

  const handleRestoreTrashFolder = async (folder) => {
    const result = await dispatch(restoreFolder({ folderId: folder.id, vaultId: selectedVault.id }));
    if (restoreFolder.fulfilled.match(result)) {
      dispatch(fetchFoldersByVault(selectedVault.id));
      dispatch(fetchPasswordsByVault(selectedVault.id));
      dispatch(fetchVaultTrash(selectedVault.id));
      dispatch(fetchVaultFolderTrash(selectedVault.id));
      dispatch(selectFolder(folder.id));
      setTrashOpen(false);
      showToast(`Restored folder "${folder.name}" and its passwords`);
    } else {
      showToast(result.payload || 'Failed to restore folder', 'error');
    }
  };

  const handlePurgeTrashFolder = async (folder) => {
    const result = await dispatch(purgeFolder({ folderId: folder.id, vaultId: selectedVault.id }));
    if (purgeFolder.fulfilled.match(result)) {
      if (result.payload?.approvalRequired) {
        showToast(result.payload.message || 'Permanent purge request submitted for Super Admin approval', 'info');
      } else {
        dispatch(fetchVaultFolderTrash(selectedVault.id));
        dispatch(fetchVaultTrash(selectedVault.id));
        showToast(`Permanently deleted folder "${folder.name}"`);
      }
    } else {
      showToast(result.payload || 'Failed to permanently delete folder', 'error');
    }
  };

  const handlePurgeTrashItem = async (item) => {
    const result = await dispatch(purgePassword({ passwordId: item.id, vaultId: selectedVault.id }));
    if (purgePassword.fulfilled.match(result)) {
      if (result.payload?.approvalRequired) {
        showToast(result.payload.message || 'Permanent purge request submitted for Super Admin approval', 'info');
      } else {
        dispatch(fetchVaultTrash(selectedVault.id));
        showToast(`Permanently deleted "${item.name}"`);
      }
    } else {
      showToast(result.payload || 'Failed to permanently delete item', 'error');
    }
  };

  const handleBatchRestore = async (items, foldersToRestore) => {
    let successCount = 0;
    for (const folder of foldersToRestore) {
      const res = await dispatch(restoreFolder({ folderId: folder.id, vaultId: selectedVault.id }));
      if (restoreFolder.fulfilled.match(res)) successCount++;
    }
    for (const item of items) {
      const res = await dispatch(restorePassword({ passwordId: item.id, vaultId: selectedVault.id }));
      if (restorePassword.fulfilled.match(res)) successCount++;
    }
    dispatch(fetchFoldersByVault(selectedVault.id));
    dispatch(fetchPasswordsByVault(selectedVault.id));
    dispatch(fetchVaultTrash(selectedVault.id));
    dispatch(fetchVaultFolderTrash(selectedVault.id));
    showToast(`Restored ${successCount} ${successCount === 1 ? 'item' : 'items'}`);
  };

  const handleBatchPurge = async (items, foldersToPurge) => {
    let count = 0;
    for (const item of items) {
      const res = await dispatch(purgePassword({ passwordId: item.id, vaultId: selectedVault.id }));
      if (purgePassword.fulfilled.match(res)) {
        if (!res.payload?.approvalRequired) count++;
      }
    }
    for (const folder of foldersToPurge) {
      const res = await dispatch(purgeFolder({ folderId: folder.id, vaultId: selectedVault.id }));
      if (purgeFolder.fulfilled.match(res)) {
        if (!res.payload?.approvalRequired) count++;
      }
    }
    dispatch(fetchVaultTrash(selectedVault.id));
    dispatch(fetchVaultFolderTrash(selectedVault.id));
    if (user?.role === 'SUPER_ADMIN') {
      showToast(`Permanently deleted ${count} ${count === 1 ? 'item' : 'items'}`);
    } else {
      showToast('Permanent deletion approval requests submitted to Super Admin', 'info');
    }
  };

  const handleEmptyTrash = async () => {
    let count = 0;
    for (const item of trashItems) {
      const res = await dispatch(purgePassword({ passwordId: item.id, vaultId: selectedVault.id }));
      if (purgePassword.fulfilled.match(res)) {
        if (!res.payload?.approvalRequired) count++;
      }
    }
    for (const folder of folderTrashItems) {
      const res = await dispatch(purgeFolder({ folderId: folder.id, vaultId: selectedVault.id }));
      if (purgeFolder.fulfilled.match(res)) {
        if (!res.payload?.approvalRequired) count++;
      }
    }
    dispatch(fetchVaultTrash(selectedVault.id));
    dispatch(fetchVaultFolderTrash(selectedVault.id));
    if (user?.role === 'SUPER_ADMIN') {
      showToast('Trash emptied permanently');
    } else {
      showToast('Permanent deletion approval requests submitted to Super Admin', 'info');
    }
  };

  const handleAuditExport = async (format) => {
    if (!canExport) {
      showToast('You do not have permission to export audit logs', 'error');
      return;
    }

    try {
      const folderParam = selectedFolder?.id ? `&folderId=${selectedFolder.id}` : '';
      const res = await api.get(`/activity/vault/${selectedVault.id}/export?format=${format}${folderParam}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const cleanName = selectedFolder?.name
        ? `${selectedFolder.name.replace(/[^a-zA-Z0-9_-]/g, '_')}-audit.${format}`
        : `vault-audit-${selectedVault.id}.${format}`;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setAuditExportOpen(false);
      showToast(`Audit exported as ${format.toUpperCase()}`);
    } catch (err) {
      let errorMsg = 'Failed to export audit';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed.message) errorMsg = parsed.message;
        } catch {
          /* ignore */
        }
      } else if (err.response?.data?.message) {
        errorMsg = err.response.data.message;
      }
      showToast(errorMsg, 'error');
    }
  };

  const canManagePolicy = isAdminUser || selectedFolderAccess === 'ADMINISTRATOR';

  return (
    <AppLayout>
      {isTrashView ? (
        <TrashTableView
          title={selectedVault?.name || 'Company Vault'}
          trashItems={trashItems}
          folderTrashItems={folderTrashItems}
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
          isSuperAdmin={user?.role === 'SUPER_ADMIN'}
          isCompanyVault={true}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-sm min-w-0">
          <div className={`px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 rounded-t-2xl ${selectedPasswordId ? 'hidden xl:block' : 'block'}`}>
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${selectedPasswordId ? 'hidden xl:flex' : 'flex'}`}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Company Vault
                </p>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <h1
                    className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate max-w-2xl"
                    title={selectedFolder?.name || `${selectedVault?.name || 'Company Vault'} — All Passwords`}
                  >
                    {selectedFolder?.name || `${selectedVault?.name || 'Company Vault'} — All Passwords`}
                  </h1>
                  {isFolderForbidden && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/80 shadow-xs">
                      <ShieldAlert size={13} className="text-rose-500" />
                      Access Forbidden
                    </span>
                  )}
                </div>

                {!isFolderForbidden && (
                  <FolderMembersSummary onClick={canManageFolderMembers ? () => setUsersOpen(true) : undefined} />
                )}
              </div>

              <div className="relative flex items-center flex-wrap gap-2 sm:gap-2.5 shrink-0" ref={menuRef}>
                {isFolderForbidden ? (
                  <button
                    type="button"
                    onClick={() => dispatch(clearSelectedFolder())}
                    className="h-9 sm:h-10 inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition shadow-sm"
                  >
                    <FolderOpen size={15} className="text-slate-400" />
                    <span>All Passwords</span>
                  </button>
                ) : (
                  <>
                    {selectedFolder && canShareFolder && (
                      <button
                        onClick={() => setShareOpen(true)}
                        className="h-9 sm:h-10 inline-flex items-center justify-center px-3.5 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition shadow-sm"
                      >
                        Share Folder
                      </button>
                    )}

                {(selectedFolder ? canAddPassword : (isAdminUser || folders.length > 0)) && (
                  <button
                    onClick={() => {
                      setPrefillData(null);
                      dispatch(openAddPasswordModal());
                    }}
                    className="h-9 sm:h-10 inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold transition shadow-sm"
                  >
                    <Plus size={16} className="shrink-0" />
                    <span>Add Item</span>
                  </button>
                )}

                {canViewTrash && (
                  <button
                    type="button"
                    onClick={() => setTrashOpen(true)}
                    className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 relative transition shadow-sm"
                    title="View deleted passwords in Trash"
                  >
                    <Trash2 size={16} className="text-slate-500 dark:text-slate-400 shrink-0" />
                    <span>Trash</span>
                    {totalTrashCount > 0 && (
                      <span className="ml-0.5 h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                        {totalTrashCount}
                      </span>
                    )}
                  </button>
                )}

              <div className="sm:relative">
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 inline-flex items-center justify-center text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition shadow-sm"
                  aria-label="More options"
                >
                  <MoreVertical size={18} />
                </button>

                {menuOpen && (
                  <div className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 sm:top-12 sm:mt-0 w-full sm:w-64 min-w-[220px] bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-30 dark:bg-slate-800 dark:border-slate-600">
                    <button
                      onClick={() => {
                        setHistoryOpen(true);
                        setMenuOpen(false);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                    >
                      <History size={16} className="text-slate-500 dark:text-slate-400" />
                      History
                    </button>

                    {canManageFolderMembers && (
                      <button
                        onClick={() => {
                          setUsersOpen(true);
                          setMenuOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <Users size={16} className="text-slate-500 dark:text-slate-400" />
                        Manage Members
                      </button>
                    )}

                    {isAdminUser && (
                      <button
                        onClick={() => {
                          setPolicyOpen(true);
                          setMenuOpen(false);
                        }}
                        disabled={!canManagePolicy}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Shield size={16} className="text-slate-500 dark:text-slate-400" />
                        Vault Policy
                      </button>
                    )}

                    {selectedFolder && (
                      <>
                        {canExport && (
                          <>
                            <button
                              onClick={() => {
                                setExportMenuOpen((prev) => !prev);
                              }}
                              className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                              <Download size={16} className="text-slate-500 dark:text-slate-400" />
                              Export
                              <ChevronDown size={14} className="ml-auto text-slate-400" />
                            </button>

                            {exportMenuOpen && (
                              <div className="py-1 border-t border-slate-100 dark:border-slate-700">
                                <button
                                  onClick={() => { setMenuOpen(false); handleExport('csv'); }}
                                  className="flex items-center gap-3 w-full px-6 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  CSV (.csv)
                                </button>
                                <button
                                  onClick={() => { setMenuOpen(false); handleExport('excel'); }}
                                  className="flex items-center gap-3 w-full px-6 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                                  Excel (.xlsx)
                                </button>
                                <button
                                  onClick={() => { setMenuOpen(false); handleExport('bitwarden'); }}
                                  className="flex items-center gap-3 w-full px-6 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                  Bitwarden (.json)
                                </button>
                                <button
                                  onClick={() => { setMenuOpen(false); handleExport('json'); }}
                                  className="flex items-center gap-3 w-full px-6 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  JSON (.json)
                                </button>
                              </div>
                            )}

                            <button
                              onClick={() => {
                                setAuditExportOpen((prev) => !prev);
                              }}
                              className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                              <History size={16} className="text-slate-500 dark:text-slate-400" />
                              Export audit
                              <ChevronDown size={14} className="ml-auto text-slate-400" />
                            </button>

                            {auditExportOpen && (
                              <div className="py-1 border-t border-slate-100 dark:border-slate-700">
                                <button
                                  onClick={() => { setMenuOpen(false); handleAuditExport('csv'); }}
                                  className="flex items-center gap-3 w-full px-6 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Audit CSV (.csv)
                                </button>
                                <button
                                  onClick={() => { setMenuOpen(false); handleAuditExport('json'); }}
                                  className="flex items-center gap-3 w-full px-6 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  Audit JSON (.json)
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        {(canImport || (!selectedFolder && canAddPassword)) && (
                          <label className="flex items-center gap-3 w-full px-4 py-2 text-sm hover:bg-slate-50 cursor-pointer dark:hover:bg-slate-700">
                            <Upload size={16} className="text-slate-500 dark:text-slate-400" />
                            Import (CSV / Excel / JSON)
                            <input
                              type="file"
                              accept=".csv,.xlsx,.xls,.json,.kdbx,.kdb"
                              onChange={(e) => {
                                handleImportFile(e);
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </>
                    )}

                    {canDeleteFolder && (
                      <button
                        onClick={() => {
                          setConfirmDelete(true);
                          setMenuOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={16} />
                        Delete Folder
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>

        {(vaultsLoading || passwordsLoading) && (
          <div className="p-4 sm:p-8 text-slate-500 dark:text-slate-400">Loading vault...</div>
        )}

        {error && (
          <div className="p-4 sm:p-8">
            {error.toLowerCase().includes('two-factor') || error.toLowerCase().includes('2fa') ? (
              <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                      Two-Factor Authentication Required
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 max-w-xl">
                      {error}
                    </p>
                  </div>
                </div>
                <Link
                  to="/security/2fa"
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm transition shrink-0 shadow-sm"
                >
                  Enable 2FA Now
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        {!vaultsLoading && !passwordsLoading && !error && (
          isFolderForbidden ? (
            <div className="min-h-[520px] flex items-center justify-center p-6 sm:p-12">
              <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 p-8 sm:p-10 shadow-xl shadow-slate-900/5 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200/80 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 shadow-sm">
                  <ShieldAlert size={34} className="stroke-[2.2]" />
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                  Access Restricted
                </h2>

                <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
                  You do not have permission to view or access credentials in this folder.
                </p>
              </div>
            </div>
          ) : (
            !selectedPasswordId ? (
              <FolderItemsTableView
                onAddPassword={() => {
                  setPrefillData(null);
                  dispatch(openAddPasswordModal());
                }}
              />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] 2xl:grid-cols-[340px_1fr] min-h-[640px] divide-y xl:divide-y-0 xl:divide-x divide-slate-200 dark:divide-slate-700 min-w-0">
                <div className={`min-w-0 ${selectedPasswordId ? 'hidden xl:block' : 'block'}`}>
                  <PasswordListPanel />
                </div>
                <div className={`min-w-0 ${!selectedPasswordId ? 'hidden xl:block' : 'block'}`}>
                  <PasswordDetailsPanel
                    onBackToList={() => dispatch(selectPassword(null))}
                    onShareVault={() => setVaultShareOpen(true)}
                    onAddLogin={(data) => {
                      // data can be string (legacy) or {name, url, tags}
                      const prefill = typeof data === 'string' ? { name: data } : data;
                      setPrefillData(prefill);
                      dispatch(openAddPasswordModal());
                    }}
                  />
                </div>
              </div>
            )
          )
        )}
      </div>
      )}
      
      <ShareFolderModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        folderId={selectedFolder?.id || null}
        vaultId={selectedVault?.id || null}
      />

      <ShareVaultModal
        open={vaultShareOpen}
        onClose={() => setVaultShareOpen(false)}
        vaultId={selectedVault?.id || null}
      />

      <FolderHistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        folderId={selectedFolder?.id || null}
      />

      <FolderUsersModal
        open={usersOpen}
        onClose={() => setUsersOpen(false)}
        folderId={selectedFolder?.id || null}
        folderName={selectedFolder?.name || ''}
        onSaved={() => {
          if (selectedVault?.id) {
            dispatch(fetchFoldersByVault(selectedVault.id));
          }
        }}
      />

      <ConfirmModal
        open={confirmDelete}
        title="Move Folder to Trash"
        message={`Are you sure you want to move "${selectedFolder?.name}" and all its passwords to Trash? You can restore them anytime.`}
        confirmLabel="Move to Trash"
        onConfirm={async () => {
          if (!selectedFolder) return;
          const folderName = selectedFolder.name;
          const vaultId = selectedVault?.id;
          const result = await dispatch(deleteFolder(selectedFolder.id));
          if (deleteFolder.rejected.match(result)) {
            showToast(result.payload || 'Failed to move folder to Trash', 'error');
          } else {
            showToast(`Folder "${folderName}" and its passwords moved to Trash`, 'info');
            if (vaultId) {
              dispatch(fetchFoldersByVault(vaultId));
              dispatch(fetchVaultTrash(vaultId));
              dispatch(fetchVaultFolderTrash(vaultId));
              dispatch(fetchPasswordsByVault(vaultId));
            }
          }
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <VaultPolicyModal
        open={policyOpen}
        onClose={() => setPolicyOpen(false)}
        vaultId={selectedVault?.id || null}
      />

      <AddFolderModal />
      <AddPasswordModal prefill={prefillData} onPrefillConsumed={() => setPrefillData(null)} />
      <EditPasswordModal />
    </AppLayout>
  );
}

export default VaultPage;