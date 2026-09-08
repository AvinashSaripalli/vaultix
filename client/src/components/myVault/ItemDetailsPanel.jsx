import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Edit2,
  Eye,
  EyeOff,
  ExternalLink,
  FolderPlus,
  Lock,
  Share2,
  Trash2,
  Users,
} from 'lucide-react';
import {
  decryptText,
  decryptFields,
  generateTOTP,
  isEncryptedFormat,
} from '../../utils/crypto';
import { secureCopyText } from '../../utils/clipboard';
import { showToast } from '../../utils/toast';
import {
  TYPE_FIELDS,
  getItemTypeMeta,
  maskFieldValue,
  parseCustomFields,
  CUSTOM_FIELDS_KEY,
} from '../../utils/itemTypes';
import ItemTypeBadge from './ItemTypeBadge';
import TotpField from './TotpField';
import DecryptDialog from '../common/DecryptDialog';

function ItemDetailsPanel({
  item,
  parent,
  children,
  onSelectChild,
  onAddChild,
  onShare,
  onEdit,
  onDelete,
  onManageShares,
  user,
  sessionMasterPassword,
  samples,
}) {
  const [decryptedPassword, setDecryptedPassword] = useState(null);
  const [decryptedFields, setDecryptedFields] = useState(null);
  const [decryptedNote, setDecryptedNote] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [revealed, setRevealed] = useState({});
  const [totpRevealed, setTotpRevealed] = useState(false);
  const [showDecryptDialog, setShowDecryptDialog] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');

  const salt = user?.encryptionSalt;

  const decryptAll = useCallback(
    async (masterPassword) => {
      const result = { password: '', fields: {}, note: null };

      if (item.encryptedPassword && isEncryptedFormat(item.encryptedPassword)) {
        result.password = await decryptText(item.encryptedPassword, masterPassword, salt);
      } else {
        result.password = item.encryptedPassword || '';
      }

      if (item.encryptedFields) {
        result.fields = (await decryptFields(item.encryptedFields, masterPassword, salt)) || {};
      }

      if (item.encryptedNote && isEncryptedFormat(item.encryptedNote)) {
        result.note = await decryptText(item.encryptedNote, masterPassword, salt);
      } else {
        result.note = item.encryptedNote || null;
      }

      return result;
    },
    [item, salt]
  );

  useEffect(() => {
    setDecryptedPassword(null);
    setDecryptedFields(null);
    setDecryptedNote(null);
    setShowPassword(false);
    setRevealed({});
    setTotpRevealed(false);
    setShowDecryptDialog(false);
    setDecryptError('');

    if (!item || !sessionMasterPassword) return;

    (async () => {
      try {
        const decrypted = await decryptAll(sessionMasterPassword);
        setDecryptedPassword(decrypted.password);
        setDecryptedFields(decrypted.fields);
        setDecryptedNote(decrypted.note);
      } catch {
        // fall back to on-demand decryption
      }
    })();
  }, [item, sessionMasterPassword, salt, decryptAll]);

  if (!item) return null;

  const typeMeta = getItemTypeMeta(item.type);

  const copyText = (value, label) => {
    if (!value) {
      showToast('Nothing to copy', 'info');
      return;
    }
    secureCopyText(value, `${label || 'Item'} copied`);
  };

  const handleDecryptDialog = async (masterPassword) => {
    try {
      setDecrypting(true);
      setDecryptError('');
      const decrypted = await decryptAll(masterPassword);
      applySessionDecrypt(decrypted);
      setShowDecryptDialog(false);
    } catch {
      setDecryptError('Wrong master password');
      throw new Error('Wrong master password');
    } finally {
      setDecrypting(false);
    }
  };

  const applySessionDecrypt = (decrypted) => {
    setDecryptedPassword(decrypted.password);
    setDecryptedFields(decrypted.fields);
    setDecryptedNote(decrypted.note);
  };

  const handlePasswordEye = () => {
    if (showPassword) {
      setShowPassword(false);
      return;
    }

    if (decryptedPassword !== null) {
      setShowPassword(true);
    } else if (sessionMasterPassword) {
      setDecrypting(true);
      decryptAll(sessionMasterPassword)
        .then((decrypted) => {
          applySessionDecrypt(decrypted);
          setShowPassword(true);
        })
        .catch(() => {
          setShowDecryptDialog(true);
        })
        .finally(() => setDecrypting(false));
    } else {
      setShowDecryptDialog(true);
    }
  };

  const handlePasswordCopy = () => {
    if (decryptedPassword !== null) {
      copyText(decryptedPassword, 'Password');
    } else if (sessionMasterPassword) {
      setDecrypting(true);
      decryptAll(sessionMasterPassword)
        .then((decrypted) => {
          applySessionDecrypt(decrypted);
          copyText(decrypted.password, 'Password');
        })
        .catch(() => {
          setShowDecryptDialog(true);
        })
        .finally(() => setDecrypting(false));
    } else {
      setShowDecryptDialog(true);
    }
  };

  const handleFieldAction = (field, mode) => {
    const value = (decryptedFields || {})[field.key];

    if (mode === 'copy' && value !== undefined && value !== null) {
      copyText(value, field.label);
      return;
    }

    if (mode === 'reveal' && value !== undefined && value !== null) {
      setRevealed((prev) => ({ ...prev, [field.key]: !prev[field.key] }));
      return;
    }

    if (sessionMasterPassword) {
      setDecrypting(true);
      decryptAll(sessionMasterPassword)
        .then((decrypted) => {
          applySessionDecrypt(decrypted);
          const decryptedValue = (decrypted.fields || {})[field.key];
          if (mode === 'copy') {
            copyText(decryptedValue, field.label);
          } else {
            setRevealed((prev) => ({ ...prev, [field.key]: true }));
          }
        })
        .catch(() => {
          setShowDecryptDialog(true);
        })
        .finally(() => setDecrypting(false));
    } else {
      setShowDecryptDialog(true);
    }
  };

  const handleCustomValue = (mode, custom, index) => {
    const run = (fields) => {
      const customList = parseCustomFields(fields[CUSTOM_FIELDS_KEY]);
      const target = customList[index];
      if (!target) return;
      if (mode === 'copy') {
        copyText(target.value, target.name || 'Custom field');
      } else {
        setRevealed((prev) => ({ ...prev, [`__custom_${index}`]: true }));
      }
    };

    if (mode === 'copy' && custom?.value) {
      copyText(custom.value, custom.name || 'Custom field');
      return;
    }

    if (!sessionMasterPassword) {
      setShowDecryptDialog(true);
      return;
    }

    setDecrypting(true);
    decryptAll(sessionMasterPassword)
      .then((decrypted) => {
        applySessionDecrypt(decrypted);
        run(decrypted.fields || {});
      })
      .catch(() => {
        setShowDecryptDialog(true);
      })
      .finally(() => setDecrypting(false));
  };

  const handleCustomReveal = (custom, index) => handleCustomValue('reveal', custom, index);
  const handleCustomCopy = (custom, index) => handleCustomValue('copy', custom, index);

  const totpSecret = (decryptedFields || {}).totpSecret;

  const handleTotpReveal = () => {
    if (totpRevealed) {
      setTotpRevealed(false);
      return;
    }

    if (totpSecret) {
      setTotpRevealed(true);
      return;
    }

    if (sessionMasterPassword) {
      setDecrypting(true);
      decryptAll(sessionMasterPassword)
        .then((decrypted) => {
          applySessionDecrypt(decrypted);
          setTotpRevealed(true);
        })
        .catch(() => {
          setShowDecryptDialog(true);
        })
        .finally(() => setDecrypting(false));
    } else {
      setShowDecryptDialog(true);
    }
  };

  const handleTotpCopy = () => {
    const copyCode = (secret) => {
      generateTOTP(secret).then((result) => copyText(result?.code, 'Code'));
    };

    if (totpSecret) {
      copyCode(totpSecret);
      return;
    }

    if (sessionMasterPassword) {
      setDecrypting(true);
      decryptAll(sessionMasterPassword)
        .then((decrypted) => {
          applySessionDecrypt(decrypted);
          copyCode((decrypted.fields || {}).totpSecret);
        })
        .catch(() => {
          setShowDecryptDialog(true);
        })
        .finally(() => setDecrypting(false));
    } else {
      setShowDecryptDialog(true);
    }
  };

  const renderField = (field) => {
    const value = (decryptedFields || {})[field.key];
    const isRevealed = revealed[field.key];
    const display = field.copy ? (isRevealed ? value || '' : maskFieldValue(value, field)) : value || '';

    return (
      <div key={field.key} className="border-b border-slate-200 py-5 dark:border-slate-700">
        <div className="grid grid-cols-[140px_1fr_80px] items-center">
          <p className="text-slate-500 dark:text-slate-400">{field.label}</p>
          <p className="text-slate-900 truncate dark:text-slate-100">{display || '—'}</p>
          <div className="flex justify-end items-center gap-3">
            {field.input === 'password' && (
              <button
                onClick={() => handleFieldAction(field, 'reveal')}
                className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
              >
                {isRevealed ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
            {field.copy && (
              <button
                onClick={() => handleFieldAction(field, 'copy')}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <Copy size={17} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const customFields = parseCustomFields((decryptedFields || {})[CUSTOM_FIELDS_KEY]);

  const renderCustomField = (custom, index) => {
    const isRevealed = revealed[`__custom_${index}`];
    const display = custom.sensitive
      ? isRevealed
        ? custom.value
        : '••••••••••••'
      : custom.value || '';

    return (
      <div key={`__custom_${index}`} className="border-b border-slate-200 py-5 dark:border-slate-700">
        <div className="grid grid-cols-[140px_1fr_80px] items-center">
          <p className="text-slate-500 dark:text-slate-400">{custom.name || 'Custom Field'}</p>
          <p className="text-slate-900 truncate dark:text-slate-100">{display || '—'}</p>
          <div className="flex justify-end items-center gap-3">
            {custom.sensitive && (
              <button
                onClick={() => {
                  if (isRevealed) {
                    setRevealed((prev) => ({ ...prev, [`__custom_${index}`]: false }));
                  } else {
                    handleCustomReveal(custom, index);
                  }
                }}
                className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
              >
                {isRevealed ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            )}
            <button
              onClick={() => handleCustomCopy(custom, index)}
              className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <Copy size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const typeFields = TYPE_FIELDS[item.type] || [];
  const hasLogin = item.type === 'LOGIN';

  return (
    <>
      <DecryptDialog
        open={showDecryptDialog}
        onDecrypt={handleDecryptDialog}
        onClose={() => {
          setShowDecryptDialog(false);
          setDecryptError('');
        }}
        error={decryptError}
        decrypting={decrypting}
      />

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {item.name}
            </h1>
            <ItemTypeBadge type={item.type} />
            {item.isSensitive && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium dark:bg-emerald-900/20 dark:text-emerald-400">
                <Lock size={12} />
                Secure
              </span>
            )}
          </div>
          {parent && (
            <button
              onClick={() => onSelectChild(parent.id)}
              className="text-slate-500 mt-2 text-sm hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              Part of: {parent.name}
            </button>
          )}
          {!parent && (
            <p className="text-slate-500 mt-2 text-sm dark:text-slate-400">
              {typeMeta.label} in Personal Vault
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onShare(item)}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
            title="Share"
          >
            <Share2 size={17} />
          </button>
          <button
            onClick={() => onEdit(item)}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
            title="Edit"
          >
            <Edit2 size={17} />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="w-10 h-10 rounded-full border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            title="Delete"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-6 bg-white dark:border-slate-700 dark:bg-slate-800">
        {hasLogin && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {item.login}
            </h2>
            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">Account details</p>
          </div>
        )}

        <div>
          {hasLogin && (
            <>
              <div className="border-b border-slate-200 py-5 dark:border-slate-700">
                <div className="grid grid-cols-[140px_1fr_80px] items-center">
                  <p className="text-slate-500 dark:text-slate-400">Login</p>
                  <p className="text-slate-900 truncate dark:text-slate-100">{item.login}</p>
                  <div className="flex justify-end items-center gap-3">
                    <button
                      onClick={() => copyText(item.login, 'Login')}
                      className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-200 py-5 dark:border-slate-700">
                <div className="grid grid-cols-[140px_1fr_80px] items-center">
                  <p className="text-slate-500 dark:text-slate-400">Password</p>
                  <p className="text-slate-900 truncate dark:text-slate-100">
                    {showPassword ? decryptedPassword || '' : '••••••••••••'}
                  </p>
                  <div className="flex justify-end items-center gap-3">
                    <button
                      onClick={handlePasswordEye}
                      className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button
                      onClick={handlePasswordCopy}
                      className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-200 py-5 dark:border-slate-700">
                <div className="grid grid-cols-[140px_1fr_80px] items-center">
                  <p className="text-slate-500 dark:text-slate-400">URL</p>
                  {item.url ? (
                    <a
                      href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-400"
                    >
                      {item.url}
                    </a>
                  ) : (
                    <p className="text-slate-900 dark:text-slate-100">No URL</p>
                  )}
                  <div className="flex justify-end items-center gap-3">
                    {item.url && (
                      <a
                        href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                      >
                        <ExternalLink size={17} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {hasLogin && totpSecret && (
            <TotpField
              secret={totpSecret}
              revealed={totpRevealed}
              onReveal={handleTotpReveal}
              onCopy={handleTotpCopy}
            />
          )}

          {!hasLogin && typeFields.length > 0 && typeFields.map(renderField)}

          {customFields.length > 0 && customFields.map(renderCustomField)}

          {(item.encryptedNote || item.type === 'SECURE_NOTE') && (
            <div className="border-b border-slate-200 py-5 dark:border-slate-700">
              <div className="grid grid-cols-[140px_1fr_40px] items-start">
                <p className="text-slate-500 dark:text-slate-400">Note</p>
                <p className="text-slate-900 break-words dark:text-slate-100">
                  {decryptedNote || '—'}
                </p>
              </div>
            </div>
          )}

          {item.tags?.length > 0 && (
            <div className="border-b border-slate-200 py-5 dark:border-slate-700">
              <div className="grid grid-cols-[140px_1fr_40px] items-start">
                <p className="text-slate-500 dark:text-slate-400">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map((tagItem) => (
                    <span
                      key={tagItem.tag?.id || tagItem.tag?.name}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium dark:bg-indigo-900/20 dark:text-indigo-400"
                    >
                      {tagItem.tag?.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 mt-7">
          <button
            onClick={onAddChild}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <FolderPlus size={16} />
            Add Password
          </button>
          <button
            onClick={() => onManageShares(item)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            <Users size={16} />
            Manage Access
          </button>
        </div>
      </div>

      {children.length > 0 && (
        <div className="rounded-2xl border border-slate-200 p-6 mt-6 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 dark:text-slate-100">
            Inside this password ({children.length})
          </h2>
          <div className="space-y-2">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => onSelectChild(child.id)}
                className="w-full text-left rounded-xl border border-slate-200 px-4 py-3 hover:bg-slate-50 flex items-center justify-between dark:border-slate-700 dark:hover:bg-slate-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ItemTypeBadge type={child.type} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate dark:text-slate-100">
                      {child.name}
                    </p>
                    <p className="text-sm text-slate-500 truncate dark:text-slate-400">
                      {child.login || '—'}
                    </p>
                  </div>
                </div>
                {child.isSensitive && <Lock size={13} className="text-emerald-600 shrink-0 dark:text-emerald-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default ItemDetailsPanel;
