import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useSearchParams, Link } from 'react-router-dom';

import AppLayout from '../../components/layout/AppLayout';
import PasswordListPanel from '../../components/vault/PasswordListPanel';
import PasswordDetailsPanel from '../../components/vault/PasswordDetailsPanel';
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
import { getWrapRecipients, wrapItemKeysForUsers } from '../../utils/keyWrapping';
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
} from 'lucide-react';

import {
  fetchPasswordsByVault,
  fetchVaultBySlug,
  fetchFoldersByVault,
  openAddPasswordModal,
  deleteFolder,
  fetchVaultTrash,
  restorePassword,
  purgePassword,
  selectPassword,
} from '../../features/vault/vaultSlice';

import VaultPolicyModal from '../../components/vault/VaultPolicyModal';

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
  const [trashSearch, setTrashSearch] = useState('');
  const [confirmPurge, setConfirmPurge] = useState({ open: false, item: null });
  const [policyOpen, setPolicyOpen] = useState(false);
  const [auditExportOpen, setAuditExportOpen] = useState(false);

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

  const isAdminUser = ['OWNER', 'ADMIN'].includes(user?.role);

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
    error,
  } = useSelector((state) => state.vault);

  const trashItems = trashByVault[selectedVault?.id] || [];

  const filteredTrash = useMemo(() => {
    if (!trashSearch.trim()) return trashItems;
    const q = trashSearch.toLowerCase();
    return trashItems.filter((item) => {
      const nameMatch = item.name?.toLowerCase().includes(q);
      const loginMatch = item.login?.toLowerCase().includes(q);
      const folderName = item.folder?.name || folders.find((f) => f.id === item.folderId)?.name;
      const folderMatch = folderName?.toLowerCase().includes(q);
      return nameMatch || loginMatch || folderMatch;
    });
  }, [trashItems, trashSearch, folders]);

  const selectedFolder = folders.find((item) => item.id === selectedFolderId);

  const selectedFolderPermission = selectedFolder?.permissions?.find(
    (item) => item.userId === user?.id || item.user?.id === user?.id
  );
  const selectedFolderDeptMember = selectedFolder?.departmentMembers?.find(
    (dm) => dm.user?.id === user?.id
  );

  const selectedFolderAccess = (() => {
    if (isAdminUser) return 'ADMINISTRATOR';
    const RANK = { READ_ONLY: 0, READ_WRITE: 1, FULL_ACCESS: 2, ADMINISTRATOR: 3 };
    const getRank = (lvl) => RANK[lvl] ?? -1;
    const direct = selectedFolderPermission?.accessLevel || null;
    const dept = selectedFolderDeptMember?.accessLevel || null;
    if (!direct && !dept) return null;
    if (!direct) return dept;
    if (!dept) return direct;
    return getRank(direct) >= getRank(dept) ? direct : dept;
  })();

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
    if (selectedVault?.id) {
      dispatch(fetchVaultTrash(selectedVault.id));
    }
  }, [dispatch, selectedVault?.id]);

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

  const canAddPassword =
    isAdminUser ||
    ['ADMINISTRATOR', 'READ_WRITE', 'FULL_ACCESS'].includes(selectedFolderAccess);

  const canShareFolder =
    !!selectedFolder &&
    (isAdminUser || selectedFolderAccess === 'ADMINISTRATOR');

  const canDeleteFolder =
    !!selectedFolder &&
    (isAdminUser || selectedFolderAccess === 'ADMINISTRATOR');

  const handleExport = (format) => {
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
      dispatch(fetchPasswordsByVault(selectedVault.id));
      dispatch(fetchVaultTrash(selectedVault.id));
      showToast(`Restored "${item.name}"`);
    } else {
      showToast(result.payload || 'Failed to restore password', 'error');
    }
  };

  const handlePurgeTrashItem = (item) => {
    setConfirmPurge({ open: true, item });
  };

  const executePurgeTrash = async () => {
    if (!confirmPurge.item) return;
    const item = confirmPurge.item;
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
    setConfirmPurge({ open: false, item: null });
  };

  const handleAuditExport = async (format) => {
    try {
      const res = await api.get(`/activity/vault/${selectedVault.id}/export?format=${format}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-audit-${selectedVault.id}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setAuditExportOpen(false);
      showToast(`Audit exported as ${format.toUpperCase()}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to export audit', 'error');
    }
  };

  const canManagePolicy = isAdminUser || selectedFolderAccess === 'ADMINISTRATOR';

  return (
    <AppLayout>
      <div className="bg-white rounded-2xl border border-slate-200 dark:bg-slate-800 dark:border-slate-700 shadow-sm min-w-0">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 rounded-t-2xl">
          {trashOpen ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Company Vault
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    {selectedVault?.name || 'Vault'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 mt-1">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                    <Trash2 size={18} />
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Trash
                  </h1>
                  {trashItems.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                      {trashItems.length} {trashItems.length === 1 ? 'deleted item' : 'deleted items'}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Deleted passwords in this vault can be restored to their original folders or permanently removed.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setTrashOpen(false)}
                  className="h-9 sm:h-10 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 text-xs sm:text-sm font-semibold transition shadow-sm"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Vault</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Company Vault
                </p>

                <h1
                  className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mt-1 dark:text-slate-100 truncate max-w-2xl"
                  title={selectedFolder?.name || selectedVault?.name || 'Company Vault'}
                >
                  {selectedFolder?.name || selectedVault?.name || 'Company Vault'}
                </h1>

                <FolderMembersSummary onClick={() => setUsersOpen(true)} />
              </div>

              <div className="relative flex items-center flex-wrap gap-2 sm:gap-2.5 shrink-0" ref={menuRef}>
                {selectedFolder && canShareFolder && (
                  <button
                    onClick={() => setShareOpen(true)}
                    className="h-9 sm:h-10 inline-flex items-center justify-center px-3.5 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition shadow-sm"
                  >
                    Share Folder
                  </button>
                )}

                {selectedFolder && canAddPassword && (
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

                <button
                  type="button"
                  onClick={() => setTrashOpen(true)}
                  className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 relative transition shadow-sm"
                  title="View deleted passwords in Trash"
                >
                  <Trash2 size={16} className="text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>Trash</span>
                  {trashItems.length > 0 && (
                    <span className="ml-0.5 h-5 min-w-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                      {trashItems.length}
                    </span>
                  )}
                </button>

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

                    {selectedFolder && (
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
            </div>
          </div>
        )}
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

        {!vaultsLoading && !passwordsLoading && !error && trashOpen && (
          <div className="min-h-[500px] flex flex-col p-4 sm:p-6 lg:p-8">
            {/* Search within trash if items exist */}
            {trashItems.length > 0 && (
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
                  Showing {filteredTrash.length} of {trashItems.length} {trashItems.length === 1 ? 'item' : 'items'}
                </div>
              </div>
            )}

            {trashLoading && (
              <div className="flex-1 flex items-center justify-center p-12 text-slate-500 dark:text-slate-400 text-sm">
                Loading trash...
              </div>
            )}

            {!trashLoading && trashItems.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400 dark:text-slate-500">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-750 flex items-center justify-center text-slate-400 mb-3 shadow-inner">
                  <Trash2 size={28} />
                </div>
                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Trash is empty
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                  No deleted passwords in this vault. When you delete passwords, they will appear here so you can recover them anytime.
                </p>
                <button
                  type="button"
                  onClick={() => setTrashOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-200 text-xs font-semibold transition"
                >
                  Return to Passwords
                </button>
              </div>
            )}

            {!trashLoading && trashItems.length > 0 && filteredTrash.length === 0 && (
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
                {filteredTrash.map((item) => {
                  const folderName = item.folder?.name || folders.find((f) => f.id === item.folderId)?.name;
                  return (
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
                            {folderName && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-650">
                                <Folder size={11} className="text-slate-400 shrink-0" />
                                <span className="truncate max-w-[150px]">{folderName}</span>
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
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!vaultsLoading && !passwordsLoading && !error && !trashOpen && (
          <>
            {!selectedFolderId ? (
              <div className="min-h-[640px] flex flex-col items-center justify-center text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 dark:bg-indigo-900/40 dark:text-indigo-300">
                  <Users size={28} />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Select a folder
                </h2>

                <p className="text-slate-500 mt-2 text-sm dark:text-slate-400">
                  Click a folder from the left sidebar to view your passwords.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] min-h-[640px] divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-700 min-w-0">
                <div className={`${selectedPasswordId ? 'hidden md:block' : 'block'} min-w-0`}>
                  <PasswordListPanel />
                </div>
                <div className={`${!selectedPasswordId ? 'hidden md:block' : 'block'} min-w-0`}>
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
            )}
          </>
        )}
      </div>
      
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
        title="Delete Folder"
        message={`Are you sure you want to delete "${selectedFolder?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          dispatch(deleteFolder(selectedFolder.id));
          setConfirmDelete(false);
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={confirmPurge.open}
        title="Permanently Delete"
        message={`Are you sure you want to permanently delete "${confirmPurge.item?.name}"? This cannot be undone.`}
        confirmLabel="Delete permanently"
        onConfirm={executePurgeTrash}
        onCancel={() => setConfirmPurge({ open: false, item: null })}
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