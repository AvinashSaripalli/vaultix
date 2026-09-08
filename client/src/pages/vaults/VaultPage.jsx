import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

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
} from '../../features/vault/vaultSlice';

import VaultPolicyModal from '../../components/vault/VaultPolicyModal';

function VaultPage() {
  const dispatch = useDispatch();
  const { slug } = useParams();

  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [vaultShareOpen, setVaultShareOpen] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [prefillData, setPrefillData] = useState(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState({ open: false, item: null });
  const [policyOpen, setPolicyOpen] = useState(false);
  const [auditExportOpen, setAuditExportOpen] = useState(false);

  const { user, token, sessionMasterPassword, sessionRsaPrivateKey, sessionRsaPublicKey } = useSelector(
    (state) => state.auth
  );

  const isAdminUser = user?.role === 'ADMIN';

  const {
    selectedVault,
    folders,
    selectedFolderId,
    vaultsLoading,
    passwordsLoading,
    passwords,
    trashByVault,
    trashLoading,
    error,
  } = useSelector((state) => state.vault);

  const selectedFolder = folders.find((item) => item.id === selectedFolderId);

  const selectedFolderPermission = selectedFolder?.permissions?.find(
    (item) => item.userId === user?.id || item.user?.id === user?.id
  );
  const selectedFolderDeptMember = selectedFolder?.departmentMembers?.find(
    (dm) => dm.user?.id === user?.id
  );

  const selectedFolderAccess = (() => {
    if (user?.role === 'ADMIN') return 'ADMINISTRATOR';
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
    if (trashOpen && selectedVault?.id) {
      dispatch(fetchVaultTrash(selectedVault.id));
    }
  }, [dispatch, trashOpen, selectedVault?.id]);

  useEffect(() => {
    if (
      !selectedVault?.id ||
      !sessionRsaPrivateKey ||
      !sessionRsaPublicKey
    ) return;

    const itemsMissingMyKey = passwords.filter(
      (p) => !p.myWrappedKey && p.encryptedPassword
    );
    const itemsWithMyKey = passwords.filter((p) => p.myWrappedKey);

    if (itemsWithMyKey.length === 0 && itemsMissingMyKey.length === 0) return;

    let cancelled = false;

    const heal = async () => {
      const updates = [];

      // 1) Self-heal: I hold the item key — wrap it for any authorized user
      //    who is missing an entry (admins, department members, later-added members).
      for (const item of itemsWithMyKey) {
        if (cancelled) return;

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
      }

      // 2) Legacy migration: no wrapped key for me — try master-password
      //    decryption (works when I created the item under the old scheme),
      //    re-encrypt with a fresh AES key and wrap for all recipients.
      for (const item of itemsMissingMyKey) {
        if (cancelled || !sessionMasterPassword) break;

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
      }

      if (cancelled || updates.length === 0) return;

      try {
        await api.post('/passwords/batch-wrap', {
          wrappedPasswords: updates,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) {
          dispatch(fetchPasswordsByVault(selectedVault.id));
        }
      } catch {
        // best-effort
      }
    };

    heal();

    return () => { cancelled = true; };
  }, [passwords, selectedVault?.id, sessionRsaPrivateKey, sessionRsaPublicKey, sessionMasterPassword, user, token, dispatch]);

  const folderPasswords = useMemo(() => {
    if (!selectedFolder?.id) return [];

    return passwords.filter((item) => item.folderId === selectedFolder.id);
  }, [passwords, selectedFolder?.id]);

  const canAddPassword =
    user?.role === 'ADMIN' ||
    ['ADMINISTRATOR', 'READ_WRITE', 'FULL_ACCESS'].includes(selectedFolderAccess);

  const canShareFolder =
    !!selectedFolder &&
    (user?.role === 'ADMIN' || selectedFolderAccess === 'ADMINISTRATOR');

  const canDeleteFolder =
    !!selectedFolder &&
    (user?.role === 'ADMIN' || selectedFolderAccess === 'ADMINISTRATOR');

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

      const { rows, format, detectedSource } = await parseImportFile(file);

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
    await dispatch(restorePassword({ passwordId: item.id, vaultId: selectedVault.id }));
  };

  const handlePurgeTrashItem = (item) => {
    setConfirmPurge({ open: true, item });
  };

  const executePurgeTrash = async () => {
    if (!confirmPurge.item) return;
    await dispatch(purgePassword({ passwordId: confirmPurge.item.id, vaultId: selectedVault.id }));
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
      <div className="bg-white rounded-[30px] border border-slate-200 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
        <div className="px-8 py-6 border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Company Vault
              </p>

              <h1 className="text-[44px] leading-none font-bold text-slate-900 mt-1 dark:text-slate-100">
                {selectedFolder?.name || selectedVault?.name || 'Company Vault'}
              </h1>

              <FolderMembersSummary onClick={() => setUsersOpen(true)} />
            </div>

            <div className="flex items-center gap-3">
              {selectedFolder && canShareFolder && (
                <button
                  onClick={() => setShareOpen(true)}
                  className="h-[46px] px-5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                >
                  Share Folder
                </button>
              )}

              {selectedFolder && canAddPassword && (
                <button
                  onClick={() => dispatch(openAddPasswordModal())}
                  className="h-[46px] px-6 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold"
                >
                  Add password
                </button>
              )}

              <button
                onClick={() => setTrashOpen((prev) => !prev)}
                className={`h-[46px] px-5 rounded-full border text-sm font-semibold flex items-center gap-2 relative ${
                  trashOpen
                    ? 'bg-red-50 border-red-300 text-red-600 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'
                }`}
              >
                <Trash2 size={18} />
                {trashOpen ? 'Back' : 'Trash'}
                {!trashOpen && trashByVault[selectedVault?.id]?.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {trashByVault[selectedVault.id].length}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center dark:hover:bg-slate-700"
                >
                  <MoreVertical size={20} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-12 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg py-2 z-20 dark:bg-slate-800 dark:border-slate-600">
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
        </div>

        {(vaultsLoading || passwordsLoading) && (
          <div className="p-8 text-slate-500 dark:text-slate-400">Loading vault...</div>
        )}

        {error && <div className="p-8 text-red-600 dark:text-red-400">{error}</div>}

        {!vaultsLoading && !passwordsLoading && !error && trashOpen && (
          <div className="min-h-[640px]">
            <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
                Trash
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Deleted passwords in this vault can be restored or permanently removed.
              </p>
            </div>

            {trashLoading && (
              <div className="px-8 py-6 text-slate-500 dark:text-slate-400 text-sm">
                Loading trash...
              </div>
            )}

            {!trashLoading && (!trashByVault[selectedVault?.id] || trashByVault[selectedVault?.id]?.length === 0) && (
              <div className="px-8 py-10 text-center text-slate-500 dark:text-slate-400 text-sm">
                Trash is empty.
              </div>
            )}

            {!trashLoading && trashByVault[selectedVault?.id]?.length > 0 && (
              <div className="px-8 py-6 space-y-2">
                {trashByVault[selectedVault?.id].map((item) => (
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
              <div className="grid grid-cols-[420px_1fr] min-h-[640px]">
                <PasswordListPanel />
                <PasswordDetailsPanel
                  onShareVault={() => setVaultShareOpen(true)}
                  onAddLogin={(data) => {
                    // data can be string (legacy) or {name, url, tags}
                    const prefill = typeof data === 'string' ? { name: data } : data;
                    setPrefillData(prefill);
                    dispatch(openAddPasswordModal());
                  }}
                />
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