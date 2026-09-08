import { useEffect, useMemo, useState } from 'react';
import { showToast } from '../../utils/toast';
import {
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Trash2,
  Pencil,
  Lock,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../services/api';
import {
  deletePassword,
  openEditPasswordModal,
  selectPassword,
} from '../../features/vault/vaultSlice';
import ConfirmModal from '../common/ConfirmModal';
import VerifyMasterPasswordModal from '../security/VerifyMasterPasswordModal';
import { unwrapItemKey, decryptTextWithAesKey, decryptText, safeDecryptText, decryptPrivateKey, decryptFieldsWithAesKey } from '../../utils/crypto';
import { secureCopyText } from '../../utils/clipboard';
import { setCompanyPasswordEditCache } from '../../utils/companyPasswordEditCache';
import { setSessionRsaPrivateKey, setSessionRsaPublicKey } from '../../features/auth/authSlice';
import { TYPE_FIELDS, parseCustomFields, CUSTOM_FIELDS_KEY, getItemTypeMeta } from '../../utils/itemTypes';
import { detectCardNetwork } from '../../utils/cardValidation';

function PasswordDetailsPanel({ onShareVault, onAddLogin }) {
  const dispatch = useDispatch();

  const {
    passwords,
    selectedPasswordId,
    actionLoading,
    folders,
    selectedFolderId,
    selectedVault,
  } = useSelector((state) => state.vault);

  const {
    user,
    token,
    sessionMasterPassword,
    sessionRsaPrivateKey,
    sessionRsaPublicKey,
  } = useSelector((state) => state.auth);

  const selectedPassword = passwords.find(
    (item) => item.id === selectedPasswordId
  );

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

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

  const canView =
    user?.role === 'ADMIN' ||
    ['ADMINISTRATOR', 'READ_WRITE', 'READ_ONLY', 'FULL_ACCESS'].includes(
      selectedFolderAccess
    );

  const canEdit =
    user?.role === 'ADMIN' ||
    ['ADMINISTRATOR', 'READ_WRITE', 'FULL_ACCESS'].includes(
      selectedFolderAccess
    );

  const canDelete =
    user?.role === 'ADMIN' ||
    ['ADMINISTRATOR', 'FULL_ACCESS'].includes(selectedFolderAccess);

  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [revealedFields, setRevealedFields] = useState({});
  const [decryptedPasswords, setDecryptedPasswords] = useState({});
  const [decryptedNotes, setDecryptedNotes] = useState({});
  const [decryptedFieldsMap, setDecryptedFieldsMap] = useState({});
  const [confirmDelete, setConfirmDelete] = useState({ open: false, name: '', passwordId: null });
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Pre-decrypt typed (fields) items as soon as they are selected so masked
  // values are shown instead of '-' and the copy buttons work on first click.
  // Values stay masked; revealing/copying still goes through handleAction.
  useEffect(() => {
    if (!selectedPasswordId) return;
    const activeItem = passwords.find((item) => item.id === selectedPasswordId);
    if (!activeItem || !activeItem.encryptedFields || decryptedFieldsMap[activeItem.id]) return;

    decryptWithRefreshRetry(activeItem.id)
      .then(({ originalPassword, originalNote, originalFields }) => {
        setDecryptedPasswords((prev) => ({ ...prev, [activeItem.id]: originalPassword }));
        setDecryptedNotes((prev) => ({ ...prev, [activeItem.id]: originalNote }));
        setDecryptedFieldsMap((prev) => ({
          ...prev,
          [activeItem.id]: originalFields || {},
        }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPasswordId]);

  const sameNamePasswords = useMemo(() => {
    if (!selectedPassword) return [];

    return passwords.filter(
      (item) =>
        item.name?.trim().toLowerCase() ===
          selectedPassword.name?.trim().toLowerCase() &&
        (selectedFolderId ? item.folderId === selectedFolderId : true)
    );
  }, [passwords, selectedPassword, selectedFolderId]);

  if (!selectedPassword) {
    return (
      <div className="p-8">
        <div className="flex items-start justify-between gap-4">
          <p className="text-slate-500 dark:text-slate-400">Select a password to view details.</p>
          {user?.role === 'ADMIN' && onShareVault && selectedVault && (
            <button
              onClick={onShareVault}
              className="h-10 px-5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 shrink-0"
            >
              Share Vault
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleAction = (actionName, item) => {
    if (!item) return;

    if (actionName === 'view' && visiblePasswords[item.id]) {
      setVisiblePasswords((prev) => ({
        ...prev,
        [item.id]: false,
      }));
      return;
    }

    if (actionName === 'copy-login') {
      secureCopyText(item.login || '', 'Login copied');
      return;
    }

    if (actionName === 'delete') {
      setConfirmDelete({ open: true, name: item.name, passwordId: item.id });
      return;
    }

    if (
      item.isSensitive &&
      item.createdById !== user?.id &&
      (actionName === 'view' || actionName === 'copy-password' || actionName === 'edit')
    ) {
      setPendingAction({ actionName, item });
      setReVerifyOpen(true);
      return;
    }

    executeAction(actionName, item.id);
  };

  const getPasswordById = (passwordId) =>
    sameNamePasswords.find((item) => item.id === passwordId);

  const getTagNames = (item) => {
    return item.tags?.map((tagItem) => tagItem.tag?.name).filter(Boolean) || [];
  };

  const ensureSessionKeys = async () => {
    let rsaPrivateKey = sessionRsaPrivateKey;
    let rsaPublicKey = sessionRsaPublicKey;

    // Self-heal: if session keys were lost (refresh, stale unlock), recover
    // them from the server-stored keypair using the session master password.
    if ((!rsaPrivateKey || !rsaPublicKey) && user?.id && sessionMasterPassword) {
      try {
        const kpRes = await api.get('/keypair', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (kpRes.data?.encryptedPrivateKey) {
          rsaPrivateKey = await decryptPrivateKey(
            kpRes.data.encryptedPrivateKey,
            sessionMasterPassword,
            kpRes.data.salt
          );
          dispatch(setSessionRsaPrivateKey(rsaPrivateKey));
          if (kpRes.data.publicKey) {
            rsaPublicKey = kpRes.data.publicKey;
            dispatch(setSessionRsaPublicKey(rsaPublicKey));
          }
        }
      } catch (err) {
        console.error('Key recovery failed:', err);
      }
    }

    return { rsaPrivateKey };
  };

  const decryptPasswordItem = async (item) => {
    const { rsaPrivateKey } = await ensureSessionKeys();

    if (item.myWrappedKey && rsaPrivateKey) {
      try {
        const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, rsaPrivateKey);
        const originalPassword = await decryptTextWithAesKey(
          item.encryptedPassword,
          aesKeyJwk
        );
        const originalNote = item.encryptedNote
          ? await decryptTextWithAesKey(item.encryptedNote, aesKeyJwk)
          : '';
        const originalFields = item.encryptedFields
          ? await decryptFieldsWithAesKey(item.encryptedFields, aesKeyJwk)
          : {};
        return { originalPassword, originalNote, originalFields };
      } catch {
        // Typed items store their fields encrypted with the shared item AES key
        // (NOT the master password), so we cannot silently produce empty fields
        // here — surface the failure so the caller can refresh + retry.
        if (item.encryptedFields) {
          throw new Error('Failed to decrypt typed fields via item key');
        }
        // fall through to master password fallback (legacy LOGIN items)
      }
    }

    if (sessionMasterPassword && item.createdBy?.encryptionSalt) {
      try {
        const originalPassword = await decryptText(
          item.encryptedPassword,
          sessionMasterPassword,
          item.createdBy.encryptionSalt
        );
        const originalNote = item.encryptedNote
          ? await safeDecryptText(
              item.encryptedNote,
              sessionMasterPassword,
              item.createdBy.encryptionSalt
            )
          : '';
        return { originalPassword, originalNote, originalFields: {} };
      } catch {
        // fall through to error
      }
    }

    throw new Error('Failed to decrypt. This password may not have been shared with you.');
  };

  const decryptWithRefreshRetry = async (passwordId) => {
    const activePassword = getPasswordById(passwordId);

    try {
      return await decryptPasswordItem(activePassword);
    } catch (error) {
      // Another key-holder may have wrapped this item for us after the
      // list was loaded — fetch the fresh copy once and retry.
      try {
        const res = await api.get(`/passwords/${passwordId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.myWrappedKey) {
          return await decryptPasswordItem(res.data);
        }
      } catch {
        // fall through
      }

      throw error;
    }
  };

  const executeAction = async (actionName, passwordId) => {
    try {
      const activePassword = getPasswordById(passwordId);

      if (!activePassword) return;

      if (actionName === 'delete' && canDelete) {
        setConfirmDelete({ open: true, name: activePassword.name, passwordId: activePassword.id });
        return;
      }

      if (actionName === 'copy-login' && canView) {
        secureCopyText(activePassword.login || '', 'Login copied');
        return;
      }

      const { originalPassword, originalNote, originalFields } = await decryptWithRefreshRetry(passwordId);

      if (actionName === 'view' && canView) {
        setDecryptedPasswords((prev) => ({
          ...prev,
          [activePassword.id]: originalPassword,
        }));

        setDecryptedNotes((prev) => ({
          ...prev,
          [activePassword.id]: originalNote,
        }));

        setDecryptedFieldsMap((prev) => ({
          ...prev,
          [activePassword.id]: originalFields || {},
        }));

        setVisiblePasswords((prev) => ({
          ...prev,
          [activePassword.id]: !prev[activePassword.id],
        }));

        await api.post(
          `/passwords/${activePassword.id}/view-log`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      if (actionName === 'copy-password' && canView) {
        secureCopyText(originalPassword, 'Password copied');

        await api.post(
          `/passwords/${activePassword.id}/copy-log`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      if (actionName === 'edit' && canEdit) {
        setCompanyPasswordEditCache(activePassword.id, {
          password: originalPassword,
          note: originalNote,
          fields: originalFields,
        });

        dispatch(selectPassword(activePassword.id));
        dispatch(openEditPasswordModal());
      }
    } catch {
      showToast(
        'Failed to decrypt password. This password may not have been shared with you.',
        'error'
      );
    }
  };

  const canAddLogin = user?.role === 'ADMIN' || ['ADMINISTRATOR', 'READ_WRITE'].includes(selectedFolderAccess);

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Selected password group</p>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {selectedPassword.name}
            </h2>
            {selectedPassword.isSensitive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Lock size={12} />
                Secured
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-2 dark:text-slate-400">
            {sameNamePasswords.length} account
            {sameNamePasswords.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canAddLogin && onAddLogin && (
            <button
              onClick={() =>
                onAddLogin({
                  name: selectedPassword.name,
                  url: selectedPassword.url,
                  tags: (selectedPassword.tags || []).map((t) => t.tag?.name).filter(Boolean),
                })
              }
              className="h-10 px-5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5"
              title="Add another login to this service"
            >
              <Plus size={16} />
              Add Login
            </button>
          )}
          {user?.role === 'ADMIN' && onShareVault && selectedVault && (
            <button
              onClick={onShareVault}
              className="h-10 px-5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
            >
              Share Vault
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {sameNamePasswords.map((item, index) => {
          const isVisible = !!visiblePasswords[item.id];
          const tagNames = getTagNames(item);
          const isLoginItem = !item.type || item.type === 'LOGIN';
          const decryptedFields = decryptedFieldsMap[item.id] || {};
          const typeFields = TYPE_FIELDS[item.type] || [];
          // The card network is auto-detected from the card number, so derive
          // it when the stored data doesn't include it explicitly.
          const displayFields = (() => {
            if (
              item.type !== 'CARD' ||
              !decryptedFields.cardNumber ||
              decryptedFields.brand
            ) {
              return decryptedFields;
            }
            const network = detectCardNetwork(decryptedFields.cardNumber);
            return network
              ? { ...decryptedFields, brand: network.name }
              : decryptedFields;
          })();
          const customFields = parseCustomFields(decryptedFields[CUSTOM_FIELDS_KEY]);

          return (
            <div
              key={item.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-5 mb-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight dark:text-slate-100">
                    {getItemTypeMeta(item.type).label}
                    {sameNamePasswords.length > 1 ? ` #${index + 1}` : ''}
                  </h3>
                  {item.isSensitive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-[11px] font-semibold dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <ShieldCheck size={12} />
                      Secured
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={() => handleAction('edit', item)}
                      className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => handleAction('delete', item)}
                      disabled={actionLoading}
                      className="w-9 h-9 rounded-xl border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 overflow-hidden dark:border-slate-700">
                {isLoginItem ? (
                  <>
                    <DetailRow
                      label="Login"
                      value={item.login || '-'}
                      action={
                        <button
                          onClick={() =>
                            handleAction('copy-login', item)
                          }
                          className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                        >
                          <Copy size={16} />
                        </button>
                      }
                    />

                    <DetailRow
                      label="Password"
                      value={
                        isVisible
                          ? decryptedPasswords[item.id] || ''
                          : '••••••••••••'
                      }
                      action={
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              handleAction('view', item)
                            }
                            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          >
                            {isVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>

                          <button
                            onClick={() =>
                              handleAction('copy-password', item)
                            }
                            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                      }
                    />

                    <DetailRow
                      label="URL"
                      value={
                        item.url ? (
                          <a
                            href={
                              item.url.startsWith('http')
                                ? item.url
                                : `https://${item.url}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline break-all dark:text-blue-400 dark:hover:text-blue-400"
                          >
                            {item.url}
                          </a>
                        ) : (
                          'No URL'
                        )
                      }
                      action={
                        item.url ? (
                          <a
                            href={
                              item.url.startsWith('http')
                                ? item.url
                                : `https://${item.url}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          >
                            <ExternalLink size={16} />
                          </a>
                        ) : null
                      }
                    />
                  </>
                ) : (
                  <>
                    {typeFields.map((field) => {
                      const rawValue = displayFields[field.key];
                      const fieldVisible = !!revealedFields[item.id]?.[field.key];
                      const value =
                        rawValue !== undefined && rawValue !== null && rawValue !== ''
                          ? field.copy && !fieldVisible
                            ? '••••••••••••'
                            : String(rawValue)
                          : '-';

                      const handleSecretField = (action) => {
                        // Sensitive items created by others require re-verification
                        // before any field can be revealed or copied.
                        if (
                          item.isSensitive &&
                          item.createdById !== user?.id
                        ) {
                          setPendingAction({ actionName: action, item, fieldKey: field.key });
                          setReVerifyOpen(true);
                          return;
                        }
                        if (action === 'view-field') {
                          setRevealedFields((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...(prev[item.id] || {}),
                              [field.key]: !fieldVisible,
                            },
                          }));
                        } else if (action === 'copy-field') {
                          if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
                            secureCopyText(String(rawValue), `${field.label} copied`);
                          }
                        }
                      };

                      return (
                        <DetailRow
                          key={field.key}
                          label={field.label}
                          value={value}
                          action={
                            field.copy ? (
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleSecretField('view-field')}
                                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                  title={fieldVisible ? 'Hide' : 'Reveal'}
                                >
                                  {fieldVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                                <button
                                  onClick={() => handleSecretField('copy-field')}
                                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                  title="Copy"
                                >
                                  <Copy size={16} />
                                </button>
                              </div>
                            ) : null
                          }
                        />
                      );
                    })}
                    {customFields.map((custom, idx) => {
                      const cfKey = `__custom_${idx}`;
                      const cfVisible = !!revealedFields[item.id]?.[cfKey];
                      const cfSensitive = !!custom.sensitive;
                      const cfValue = custom.value
                        ? cfSensitive && !cfVisible
                          ? '••••••••••••'
                          : String(custom.value)
                        : '-';

                      const handleCustomField = (action) => {
                        if (item.isSensitive && item.createdById !== user?.id) {
                          setPendingAction({ actionName: action, item, fieldKey: cfKey });
                          setReVerifyOpen(true);
                          return;
                        }
                        if (action === 'view-field') {
                          setRevealedFields((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...(prev[item.id] || {}),
                              [cfKey]: !cfVisible,
                            },
                          }));
                        } else if (action === 'copy-field') {
                          if (custom.value) {
                            secureCopyText(
                              String(custom.value),
                              `${custom.name || 'Field'} copied`
                            );
                          }
                        }
                      };

                      return (
                        <DetailRow
                          key={cfKey}
                          label={custom.name || 'Custom Field'}
                          value={cfValue}
                          action={
                            <div className="flex items-center gap-3">
                              {cfSensitive && (
                                <button
                                  onClick={() => handleCustomField('view-field')}
                                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                  title={cfVisible ? 'Hide' : 'Reveal'}
                                >
                                  {cfVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                              )}
                              <button
                                onClick={() => handleCustomField('copy-field')}
                                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                title="Copy"
                              >
                                <Copy size={16} />
                              </button>
                            </div>
                          }
                        />
                      );
                    })}
                  </>
                )}

                <DetailRow
                  label="Note"
                  value={
                    isVisible
                      ? decryptedNotes[item.id] || 'No note'
                      : ''
                  }
                />

                <DetailRow
                  label="Tags"
                  value={
                    tagNames.length ? (
                      <div className="flex flex-wrap gap-2">
                        {tagNames.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-medium dark:bg-blue-900/20 dark:text-blue-400"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">No tags</span>
                    )
                  }
                />
              </div>
            </div>
          );
        })}
        {canAddLogin && onAddLogin && (
          <button
            onClick={() =>
              onAddLogin({
                name: selectedPassword.name,
                url: selectedPassword.url,
                tags: (selectedPassword.tags || []).map((t) => t.tag?.name).filter(Boolean),
              })
            }
            className="w-full rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 p-6 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
          >
            <span className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:border-indigo-200 dark:group-hover:border-indigo-700 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              <Plus size={18} />
            </span>
            <span className="text-sm font-semibold">Add another login to {selectedPassword.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-500 text-center max-w-sm">
              Same service, different account — e.g., personal vs work Vercel. It will appear as Account {sameNamePasswords.length + 1} in this group.
            </span>
          </button>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete.open}
        title="Delete Password"
        message={`Are you sure you want to delete "${confirmDelete.name}"? This action cannot be undone.`}
        onConfirm={async () => {
          if (!confirmDelete.passwordId) return;
          const result = await dispatch(deletePassword(confirmDelete.passwordId));
          if (deletePassword.fulfilled.match(result)) {
            dispatch(selectPassword(null));
          }
          setConfirmDelete({ open: false, name: '', passwordId: null });
        }}
        onCancel={() => {
          setConfirmDelete({ open: false, name: '', passwordId: null });
        }}
      />

      <VerifyMasterPasswordModal
        open={reVerifyOpen}
        onClose={() => {
          setReVerifyOpen(false);
          setPendingAction(null);
        }}
        onVerified={() => {
          setReVerifyOpen(false);
          const action = pendingAction;
          setPendingAction(null);
          if (!action) return;

          if (action.actionName === 'view-field') {
            setRevealedFields((prev) => ({
              ...prev,
              [action.item.id]: {
                ...(prev[action.item.id] || {}),
                [action.fieldKey]: true,
              },
            }));
            return;
          }

          if (action.actionName === 'copy-field') {
            if (action.fieldKey.startsWith('__custom_')) {
              const customList = parseCustomFields(
                decryptedFieldsMap[action.item.id]?.[CUSTOM_FIELDS_KEY]
              );
              const customEntry = customList[Number(action.fieldKey.replace('__custom_', ''))];
              if (customEntry?.value) {
                secureCopyText(
                  String(customEntry.value),
                  `${customEntry.name || 'Field'} copied`
                );
              }
              return;
            }
            const fieldMeta = (TYPE_FIELDS[action.item.type] || []).find(
              (f) => f.key === action.fieldKey
            );
            const fieldValue = decryptedFieldsMap[action.item.id]?.[action.fieldKey];
            if (fieldMeta && fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
              secureCopyText(String(fieldValue), `${fieldMeta.label} copied`);
            }
            return;
          }

          executeAction(action.actionName, action.item.id);
        }}
      />
    </div>
  );
}


function DetailRow({ label, value, action }) {
  return (
    <div className="grid grid-cols-[120px_1fr_80px] items-center border-b border-slate-200 last:border-b-0 px-4 py-4 dark:border-slate-700">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>

      <div className="text-sm text-slate-900 break-all dark:text-slate-100">
        {value}
      </div>

      <div className="flex justify-end">{action}</div>
    </div>
  );
}

export default PasswordDetailsPanel;