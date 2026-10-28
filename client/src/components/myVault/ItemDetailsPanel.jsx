import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Copy,
  Edit2,
  Eye,
  EyeOff,
  ExternalLink,
  Lock,
  Plus,
  Share2,
  Trash2,
  Users,
  Check,
  History,
  Sparkles,
  RefreshCw,
  KeyRound,
  Pencil,
} from 'lucide-react';
import api from '../../services/api';
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
  isFieldMasked,
  maskFieldValue,
  parseCustomFields,
  CUSTOM_FIELDS_KEY,
} from '../../utils/itemTypes';
import { detectCardNetwork, formatCardNumber } from '../../utils/cardValidation';
import ItemTypeBadge from './ItemTypeBadge';
import { formatItemAction, resolveFieldLabel, getActionBadge, getActionIcon } from '../../utils/activityActionFormatter';
import TotpField from './TotpField';
import DecryptDialog from '../common/DecryptDialog';
import VerifyMasterPasswordModal from '../security/VerifyMasterPasswordModal';

const SENSITIVE_VERIFY_TTL_MS = 3 * 60 * 1000; // 3 minutes per item

function PersonalAccountCard({
  item,
  index,
  totalCount,
  onShare,
  onEdit,
  onDelete,
  onManageShares,
  user,
  sessionMasterPassword,
  verifiedAtMap,
  onRequestVerify,
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

  const typeMeta = getItemTypeMeta(item.type);

  const copyText = (value, label) => {
    if (!value) {
      showToast('Nothing to copy', 'info');
      return;
    }
    secureCopyText(value, `${label || 'Item'} copied`);
    api.post(`/passwords/${item.id}/copy-log`, { mode: 'copy', clientSource: 'WEB' }).catch(() => {});
  };

  const applySessionDecrypt = (decrypted) => {
    setDecryptedPassword(decrypted.password);
    setDecryptedFields(decrypted.fields);
    setDecryptedNote(decrypted.note);
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

  const isItemRecentlyVerified = () => {
    if (!item?.isSensitive) return true;
    const ts = verifiedAtMap[item.id];
    return Boolean(ts && Date.now() - ts < SENSITIVE_VERIFY_TTL_MS);
  };

  const requireSensitiveVerification = (callback) => {
    if (isItemRecentlyVerified()) {
      callback();
      return;
    }
    onRequestVerify(item.id, callback);
  };

  const handlePasswordEye = () => {
    if (showPassword) {
      setShowPassword(false);
      return;
    }

    requireSensitiveVerification(() => {
      api.post(`/passwords/${item.id}/view-log`, { clientSource: 'WEB' }).catch(() => {});
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
    });
  };

  const handlePasswordCopy = () => {
    requireSensitiveVerification(() => {
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
    });
  };

  const resolvedFields = (() => {
    const raw = decryptedFields || {};
    if (item.type === 'CARD' && raw.cardNumber && !raw.brand) {
      const net = detectCardNetwork(raw.cardNumber);
      if (net) return { ...raw, brand: net.name };
    }
    return raw;
  })();

  const handleFieldAction = (field, mode) => {
    const masked = isFieldMasked(field);
    if (mode === 'reveal' && revealed[field.key]) {
      setRevealed((prev) => ({ ...prev, [field.key]: false }));
      return;
    }

    const perform = () => {
      const value = resolvedFields[field.key];

      if (mode === 'copy' && value !== undefined && value !== null) {
        copyText(value, field.label);
        return;
      }

      if (mode === 'reveal' && value !== undefined && value !== null) {
        api.post(`/passwords/${item.id}/view-log`, { clientSource: 'WEB' }).catch(() => {});
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

    if (masked) {
      requireSensitiveVerification(perform);
    } else {
      perform();
    }
  };

  const handleCustomValue = (mode, custom, idx) => {
    const perform = () => {
      const run = (fields) => {
        const customList = parseCustomFields(fields[CUSTOM_FIELDS_KEY]);
        const target = customList[idx];
        if (!target) return;
        if (mode === 'copy') {
          copyText(target.value, target.name || 'Custom field');
        } else {
          setRevealed((prev) => ({ ...prev, [`__custom_${idx}`]: true }));
        }
      };

      if (mode === 'copy' && custom?.value) {
        copyText(custom.value, custom.name || 'Custom field');
        return;
      }

      if (mode === 'reveal' && custom?.value) {
        api.post(`/passwords/${item.id}/view-log`, { clientSource: 'WEB' }).catch(() => {});
        setRevealed((prev) => ({ ...prev, [`__custom_${idx}`]: true }));
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

    if (custom?.sensitive) {
      requireSensitiveVerification(perform);
    } else {
      perform();
    }
  };

  const handleCustomReveal = (custom, idx) => handleCustomValue('reveal', custom, idx);
  const handleCustomCopy = (custom, idx) => handleCustomValue('copy', custom, idx);

  const totpSecret = resolvedFields.totpSecret;

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
    const value = resolvedFields[field.key];
    if ((value === undefined || value === null || value === '') && !field.required) {
      return null;
    }
    const isRevealed = Boolean(revealed[field.key]);
    const isSecret = isFieldMasked(field);
    const formattedPlain =
      field.key === 'cardNumber' && value ? formatCardNumber(value) : value || '';
    const display = isSecret
      ? isRevealed
        ? formattedPlain
        : maskFieldValue(value, field)
      : formattedPlain;

    return (
      <div key={field.key} className="border-b border-slate-200 py-3 sm:py-4 dark:border-slate-700 min-w-0">
        <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[150px_1fr_auto] sm:gap-3 sm:items-center min-w-0">
          <p className="text-[11px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">{field.label}</p>
          <div className="flex items-center justify-between gap-2 min-w-0 sm:contents">
            {field.key === 'url' && display ? (
              <a
                href={display.startsWith('http') ? display : `https://${display}`}
                target="_blank"
                rel="noreferrer"
                className="truncate text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 min-w-0 flex-1"
              >
                {display}
              </a>
            ) : (
              <p className={`text-xs sm:text-sm text-slate-900 break-all whitespace-pre-wrap min-w-0 flex-1 dark:text-slate-100 ${isSecret && isRevealed ? 'font-mono tracking-wider select-all font-semibold' : ''}`}>
                {display || '—'}
              </p>
            )}
            <div className="flex justify-end items-center gap-1.5 shrink-0">
              {isSecret && value && (
                <button
                  type="button"
                  onClick={() => handleFieldAction(field, 'reveal')}
                  aria-label={isRevealed ? `Hide ${field.label}` : `Show ${field.label}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                  title={isRevealed ? 'Hide' : 'Reveal'}
                >
                  {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
              {field.copy && value && (
                <CopyIconButton
                  onCopy={() => handleFieldAction(field, 'copy')}
                  title={`Copy ${field.label}`}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const customFields = parseCustomFields(resolvedFields[CUSTOM_FIELDS_KEY]);

  const renderCustomField = (custom, idx) => {
    const isRevealed = revealed[`__custom_${idx}`];
    const display = custom.sensitive
      ? isRevealed
        ? custom.value
        : '••••••••••••'
      : custom.value || '';

    return (
      <div key={`__custom_${idx}`} className="border-b border-slate-200 py-3 sm:py-4 dark:border-slate-700 min-w-0">
        <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[150px_1fr_auto] sm:gap-3 sm:items-center min-w-0">
          <p className="text-[11px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">{custom.name || 'Custom Field'}</p>
          <div className="flex items-center justify-between gap-2 min-w-0 sm:contents">
            <p className={`text-xs sm:text-sm text-slate-900 break-all min-w-0 flex-1 dark:text-slate-100 ${custom.sensitive && isRevealed ? 'font-mono tracking-wider select-all font-semibold' : ''}`}>
              {display || '—'}
            </p>
            <div className="flex justify-end items-center gap-2 shrink-0">
              {custom.sensitive && (
                <button
                  type="button"
                  onClick={() => {
                    if (isRevealed) {
                      setRevealed((prev) => ({ ...prev, [`__custom_${idx}`]: false }));
                    } else {
                      handleCustomReveal(custom, idx);
                    }
                  }}
                  aria-label={isRevealed ? 'Hide custom field' : 'Show custom field'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                  title={isRevealed ? 'Hide' : 'Reveal'}
                >
                  {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
              <CopyIconButton
                onCopy={() => handleCustomCopy(custom, idx)}
                title="Copy custom field"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const typeFields = (() => {
    const base = [...(TYPE_FIELDS[item.type] || [])];
    const raw = decryptedFields || {};
    if (raw.accountHolder && !base.some((f) => f.key === 'accountHolder')) {
      base.push({ key: 'accountHolder', label: 'Account Holder Name', copy: true });
    }
    if (raw.routingNumber && !base.some((f) => f.key === 'routingNumber')) {
      base.push({ key: 'routingNumber', label: 'IFSC / Routing Code', copy: true });
    }
    return base;
  })();
  const hasLogin = item.type === 'LOGIN';

  return (
    <div className="rounded-2xl border border-slate-200 p-4 sm:p-6 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-sm min-w-0">
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

      <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5 min-w-0">
        <div className="min-w-0 flex-1">
          {totalCount > 1 ? (
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {typeMeta.label} #{index + 1}
              </h2>
              {item.login && (
                <span className="text-xs sm:text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-2.5 py-0.5 rounded-lg truncate max-w-[240px]">
                  {item.login}
                </span>
              )}
            </div>
          ) : hasLogin ? (
            <>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 break-words truncate max-w-full">
                {item.login}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 dark:text-slate-400">Account details</p>
            </>
          ) : (
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
              {typeMeta.label} details
            </h2>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => onShare(item)}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition"
            title="Share item"
            aria-label="Share item"
          >
            <Share2 size={16} />
          </button>
          <button
            onClick={() => onManageShares(item)}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition"
            title="Manage shared access"
            aria-label="Manage shared access"
          >
            <Users size={16} />
          </button>
          <button
            onClick={() => onEdit(item)}
            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition"
            title="Edit"
            aria-label="Edit item"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="w-9 h-9 rounded-xl border border-red-200 text-red-500 flex items-center justify-center hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition"
            title="Delete"
            aria-label="Delete item"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div>
        {hasLogin && (
          <>
            <div className="border-b border-slate-200 py-3 sm:py-4 dark:border-slate-700 min-w-0">
              <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr_auto] sm:gap-3 sm:items-center min-w-0">
                <p className="text-[11px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Login</p>
                <div className="flex items-center justify-between gap-2 min-w-0 sm:contents">
                  <p className="text-xs sm:text-sm text-slate-900 break-all dark:text-slate-100 min-w-0 flex-1">{item.login}</p>
                  <div className="flex justify-end items-center gap-1.5 shrink-0">
                    <CopyIconButton onCopy={() => copyText(item.login, 'Login')} title="Copy login" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 py-3 sm:py-4 dark:border-slate-700 min-w-0">
              <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr_auto] sm:gap-3 sm:items-center min-w-0">
                <p className="text-[11px] sm:text-sm font-medium text-slate-500 dark:text-slate-400 shrink-0">Password</p>
                <div className="flex items-center justify-between gap-2 min-w-0 sm:contents">
                  <p className={`text-xs sm:text-sm text-slate-900 break-all min-w-0 flex-1 dark:text-slate-100 ${showPassword ? 'font-mono tracking-wider select-all font-semibold' : ''}`}>
                    {showPassword ? decryptedPassword || '' : '••••••••••••'}
                  </p>
                  <div className="flex justify-end items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handlePasswordEye}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                      title={showPassword ? 'Hide' : 'Reveal'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <CopyIconButton onCopy={handlePasswordCopy} title="Copy password" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 py-3 sm:py-5 dark:border-slate-700 min-w-0">
              <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr_auto] sm:gap-3 sm:items-center min-w-0">
                <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">URL</p>
                <div className="flex items-center justify-between gap-2 min-w-0 sm:contents">
                  {item.url ? (
                    <a
                      href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-400 min-w-0 flex-1"
                    >
                      {item.url}
                    </a>
                  ) : (
                    <p className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex-1">No URL</p>
                  )}
                  <div className="flex justify-end items-center gap-2 shrink-0">
                    {item.url && (
                      <a
                        href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                      >
                        <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
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
          <div className="border-b border-slate-200 py-3 sm:py-5 dark:border-slate-700 min-w-0">
            <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr_auto] sm:gap-3 sm:items-start min-w-0">
              <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">Note</p>
              <p className="text-xs sm:text-sm text-slate-900 break-words dark:text-slate-100 min-w-0">
                {decryptedNote || '—'}
              </p>
            </div>
          </div>
        )}

        {item.tags?.length > 0 && (
          <div className="py-3 sm:py-4 min-w-0">
            <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[130px_1fr_auto] sm:gap-3 sm:items-start min-w-0">
              <p className="text-[11px] sm:text-sm text-slate-500 dark:text-slate-400 shrink-0">Tags</p>
              <div className="flex flex-wrap gap-1.5 min-w-0">
                {item.tags.map((tagItem) => (
                  <span
                    key={tagItem.tag?.id || tagItem.tag?.name}
                    className="inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium dark:bg-indigo-900/20 dark:text-indigo-400"
                  >
                    {tagItem.tag?.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemDetailsPanel({
  item,
  groupItems,
  onAddChild,
  onShare,
  onEdit,
  onDelete,
  onManageShares,
  user,
  sessionMasterPassword,
}) {
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [pendingVerifyItemId, setPendingVerifyItemId] = useState(null);
  const [pendingSensitiveCallback, setPendingSensitiveCallback] = useState(null);
  const [verifiedAtMap, setVerifiedAtMap] = useState({});
  const { token } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('credentials');
  const [itemActivityLogs, setItemActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    setActiveTab('credentials');
  }, [item?.id]);

  useEffect(() => {
    if (!item?.id || activeTab !== 'activity') return;

    let isMounted = true;
    const fetchItemActivity = async () => {
      try {
        setActivityLoading(true);
        setActivityError('');
        const res = await api.get(`/passwords/${item.id}/activity?includeGroup=true`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) {
          setItemActivityLogs(res.data || []);
        }
      } catch (err) {
        if (isMounted) {
          setActivityError(err.response?.data?.message || 'Failed to load item activity');
        }
      } finally {
        if (isMounted) {
          setActivityLoading(false);
        }
      }
    };

    fetchItemActivity();
    return () => {
      isMounted = false;
    };
  }, [item?.id, activeTab, token]);

  if (!item) return null;

  const effectiveGroupItems = groupItems?.length ? groupItems : [item];
  const typeMeta = getItemTypeMeta(item.type);
  const hasLogin = item.type === 'LOGIN';

  return (
    <>
      <VerifyMasterPasswordModal
        open={reVerifyOpen}
        onClose={() => {
          setReVerifyOpen(false);
          setPendingVerifyItemId(null);
          setPendingSensitiveCallback(null);
        }}
        onVerified={() => {
          setReVerifyOpen(false);
          if (pendingVerifyItemId) {
            setVerifiedAtMap((prev) => ({ ...prev, [pendingVerifyItemId]: Date.now() }));
          }
          const fn = pendingSensitiveCallback;
          setPendingVerifyItemId(null);
          setPendingSensitiveCallback(null);
          if (typeof fn === 'function') fn();
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-5 sm:mb-6 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
              {item.name}
            </h1>
            <ItemTypeBadge type={item.type} />
            {item.isSensitive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium dark:bg-emerald-900/20 dark:text-emerald-400 shrink-0">
                <Lock size={12} />
                Secure
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1.5 text-xs sm:text-sm dark:text-slate-400">
            {effectiveGroupItems.length > 1
              ? `${effectiveGroupItems.length} accounts in Personal Vault`
              : `${typeMeta.label} in Personal Vault`}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {hasLogin && onAddChild && (
            <button
              onClick={onAddChild}
              className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition shadow-sm"
              title="Add another login to this service"
            >
              <Plus size={15} />
              <span>Add Login</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs: Credentials vs Activity */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700/80 pb-2 mb-5 overflow-x-auto scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition ${
            activeTab === 'credentials'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <KeyRound size={15} />
          <span>Credentials & Fields</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition ${
            activeTab === 'activity'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History size={15} />
          <span>Activity & History</span>
        </button>
      </div>

      {activeTab === 'credentials' && (
      <div className="space-y-5">
        {effectiveGroupItems.map((accountItem, idx) => (
          <PersonalAccountCard
            key={accountItem.id}
            item={accountItem}
            index={idx}
            totalCount={effectiveGroupItems.length}
            onShare={onShare}
            onEdit={onEdit}
            onDelete={onDelete}
            onManageShares={onManageShares}
            user={user}
            sessionMasterPassword={sessionMasterPassword}
            verifiedAtMap={verifiedAtMap}
            onRequestVerify={(itemId, callback) => {
              setPendingVerifyItemId(itemId);
              setPendingSensitiveCallback(() => callback);
              setReVerifyOpen(true);
            }}
          />
        ))}

        {hasLogin && onAddChild && (
          <button
            onClick={onAddChild}
            className="w-full rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 p-6 flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
          >
            <span className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 group-hover:border-indigo-200 dark:group-hover:border-indigo-700 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              <Plus size={18} />
            </span>
            <span className="text-sm font-semibold">Add another login to {item.name}</span>
            <span className="text-xs text-slate-500 dark:text-slate-500 text-center max-w-sm">
              Same service, different account — e.g., personal vs work {item.name}. It will appear as Account {effectiveGroupItems.length + 1} in this group.
            </span>
          </button>
        )}
      </div>
      )}

      {activeTab === 'activity' && (
        <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-slate-700/60">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>Personal Item Activity</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Audit timeline for {item.name}
                {effectiveGroupItems.length > 1 ? ` (${effectiveGroupItems.length} accounts in group)` : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setActivityLoading(true);
                api
                  .get(`/passwords/${item.id}/activity?includeGroup=true`, {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                  .then((res) => setItemActivityLogs(res.data || []))
                  .catch(() => {})
                  .finally(() => setActivityLoading(false));
              }}
              disabled={activityLoading}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <RefreshCw size={13} className={activityLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {activityLoading && (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading activity timeline...
            </div>
          )}

          {activityError && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {activityError}
            </div>
          )}

          {!activityLoading && !activityError && itemActivityLogs.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {itemActivityLogs.map((log) => {
                const isAutofill = log.action === 'AUTOFILL_PASSWORD';
                const isShare = log.action === 'SHARE_PASSWORD';
                const isRevokeShare = log.action === 'REVOKE_SHARE_PASSWORD' || log.action === 'REVOKE_PASSWORD_SHARE';
                const effectiveItemType = log.metadata?.itemType || item?.type || 'LOGIN';
                const fieldName = log.metadata?.fieldName;
                const fieldLabel = fieldName ? resolveFieldLabel(fieldName, effectiveItemType) : null;
                const label = formatItemAction(log.action, { ...log.metadata, itemType: effectiveItemType }, log);
                const icon = getActionIcon(log.action, effectiveItemType, fieldName);
                const badge = getActionBadge(log.action, effectiveItemType);

                return (
                  <div
                    key={log.id}
                    className="py-3.5 flex items-start gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 px-2 rounded-xl transition"
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${badge}`}>
                          {label}
                        </span>
                        {fieldLabel && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/60 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800/40">
                            Field: {fieldLabel}
                          </span>
                        )}
                        {(log.metadata?.clientSource === 'EXTENSION' || isAutofill) && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            via Chrome Extension
                          </span>
                        )}
                        {log.metadata?.domain && (
                          <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                            on {log.metadata.domain}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                        {log.metadata?.login && (
                          <span className="font-medium mr-2">
                            Account:{' '}
                            <span className="text-slate-900 dark:text-slate-100">
                              {log.metadata.login}
                            </span>
                          </span>
                        )}
                        {log.metadata?.moved &&
                          log.metadata?.fromFolderName &&
                          log.metadata?.toFolderName && (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Moved: {log.metadata.fromFolderName} → {log.metadata.toFolderName}
                            </span>
                          )}
                        {isShare && log.metadata?.sharedWithName && (
                          <span>Shared with {log.metadata.sharedWithName}</span>
                        )}
                        {isRevokeShare &&
                          (log.metadata?.revokedFromUserName ||
                            log.metadata?.revokedFromUserEmail) && (
                            <span>
                              Revoked from{' '}
                              {log.metadata.revokedFromUserName ||
                                log.metadata.revokedFromUserEmail}
                            </span>
                          )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                        <span>{log.user?.fullName || log.user?.email || 'You'}</span>
                        <span>•</span>
                        <span>
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!activityLoading && !activityError && !itemActivityLogs.length && (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              No recorded activity yet for this personal item.
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CopyIconButton({ onCopy, title = 'Copy to clipboard' }) {
  const [copied, setCopied] = useState(false);
  const handle = (e) => {
    e.stopPropagation();
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      type="button"
      onClick={handle}
      className={`p-1.5 rounded-lg transition-colors ${
        copied
          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400'
          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750'
      }`}
      title={copied ? 'Copied!' : title}
      aria-label={copied ? 'Copied' : title}
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
    </button>
  );
}

export default ItemDetailsPanel;
