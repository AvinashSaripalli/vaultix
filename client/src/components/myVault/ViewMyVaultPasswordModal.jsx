import { useEffect, useState } from 'react';
import { X, Eye, EyeOff, Copy, ExternalLink, ShieldAlert, KeyRound, Lock } from 'lucide-react';
import { useSelector } from 'react-redux';
import { decryptText, decryptFields, isEncryptedFormat } from '../../utils/crypto';
import { secureCopyText } from '../../utils/clipboard';
import VerifyMasterPasswordModal from '../security/VerifyMasterPasswordModal';
import ModalPortal, { ModalBackdrop } from '../common/ModalPortal';
import ItemTypeBadge from './ItemTypeBadge';
import {
  CUSTOM_FIELDS_KEY,
  TYPE_FIELDS,
  getItemTypeMeta,
  isFieldMasked,
  maskFieldValue,
  parseCustomFields,
} from '../../utils/itemTypes';
import { formatCardNumber } from '../../utils/cardValidation';
import TotpField from './TotpField';

function ViewMyVaultPasswordModal({ open, password, onClose }) {
  const { user, sessionMasterPassword } = useSelector((state) => state.auth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [decryptedPassword, setDecryptedPassword] = useState(null);
  const [decryptedNote, setDecryptedNote] = useState(null);
  const [decryptedFields, setDecryptedFields] = useState({});
  const [revealedFields, setRevealedFields] = useState({});
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [sensitiveVerified, setSensitiveVerified] = useState(false);

  useEffect(() => {
    if (open && password) {
      setLoading(true);
      setError('');
      setShowDecrypted(false);
      setRevealedFields({});
      setDecryptedPassword(null);
      setDecryptedNote(null);
      setDecryptedFields({});
      setSensitiveVerified(false);

      if (!isEncryptedFormat(password.encryptedPassword) && !isEncryptedFormat(password.encryptedFields)) {
        setDecryptedPassword(password.encryptedPassword || '');
        setDecryptedNote(password.encryptedNote || null);
        try {
          setDecryptedFields(
            typeof password.encryptedFields === 'string'
              ? JSON.parse(password.encryptedFields)
              : password.encryptedFields || {}
          );
        } catch {
          setDecryptedFields({});
        }
        setLoading(false);
        return;
      }

      if (!sessionMasterPassword) {
        setLoading(false);
        setReVerifyOpen(true);
        return;
      }

      (async () => {
        try {
          let plainPassword = '';
          if (password.encryptedPassword) {
            plainPassword = isEncryptedFormat(password.encryptedPassword)
              ? await decryptText(
                  password.encryptedPassword,
                  sessionMasterPassword,
                  user?.encryptionSalt
                )
              : password.encryptedPassword;
          }

          let noteText = null;
          if (password.encryptedNote) {
            noteText = isEncryptedFormat(password.encryptedNote)
              ? await decryptText(
                  password.encryptedNote,
                  sessionMasterPassword,
                  user?.encryptionSalt
                )
              : password.encryptedNote;
          }

          let plainFields = {};
          if (password.encryptedFields) {
            plainFields =
              (await decryptFields(
                password.encryptedFields,
                sessionMasterPassword,
                user?.encryptionSalt
              )) || {};
          }

          setDecryptedPassword(plainPassword);
          setDecryptedNote(noteText);
          setDecryptedFields(plainFields);
        } catch {
          setError('Failed to decrypt. Wrong master password.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [open, password, sessionMasterPassword, user?.encryptionSalt]);

  const handleCopy = (value, fieldName = 'Password') => {
    if (!value) return;

    // Check sensitive re-prompt
    if (password?.isSensitive && !sensitiveVerified) {
      setPendingAction(() => () => {
        secureCopyText(value);
      });
      setReVerifyOpen(true);
      return;
    }

    secureCopyText(value);
  };

  const handleTogglePasswordReveal = () => {
    if (!showDecrypted && password?.isSensitive && !sensitiveVerified) {
      setPendingAction(() => () => {
        setShowDecrypted(true);
      });
      setReVerifyOpen(true);
      return;
    }
    setShowDecrypted((prev) => !prev);
  };

  const toggleFieldReveal = (key) => {
    if (!revealedFields[key] && password?.isSensitive && !sensitiveVerified) {
      setPendingAction(() => () => {
        setRevealedFields((prev) => ({ ...prev, [key]: true }));
      });
      setReVerifyOpen(true);
      return;
    }
    setRevealedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClose = () => {
    setDecryptedPassword(null);
    setDecryptedNote(null);
    setDecryptedFields({});
    setRevealedFields({});
    setShowDecrypted(false);
    setSensitiveVerified(false);
    setError('');
    onClose();
  };

  if (!open || !password) return null;

  const itemType = password.type || 'LOGIN';
  const typeMeta = getItemTypeMeta(itemType);
  const typeFieldDefs = (() => {
    const base = [...(TYPE_FIELDS[itemType] || [])];
    if (decryptedFields?.accountHolder && !base.some((f) => f.key === 'accountHolder')) {
      base.push({ key: 'accountHolder', label: 'Account Holder Name', copy: true });
    }
    if (decryptedFields?.routingNumber && !base.some((f) => f.key === 'routingNumber')) {
      base.push({ key: 'routingNumber', label: 'IFSC / Routing Code', copy: true });
    }
    return base;
  })();
  const customFields = parseCustomFields(decryptedFields?.[CUSTOM_FIELDS_KEY]);

  const displayPassword = decryptedPassword || '';
  const displayNote = decryptedNote ?? (password.encryptedNote || 'No note');
  const totpSecret = decryptedFields?.totp || null;

  return (
    <ModalPortal open={open} onClose={handleClose}>
      <ModalBackdrop onClose={handleClose}>
        <div
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 dark:bg-slate-800 my-auto max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300">
                <KeyRound size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ItemTypeBadge type={itemType} />
                  {password.isSensitive && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                      <Lock size={11} /> Sensitive
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-slate-900 truncate mt-1 dark:text-slate-100">
                  {password.name}
                </h2>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Content */}
          <div className="py-4 space-y-4 overflow-y-auto flex-1">
            {loading ? (
              <div className="rounded-xl border border-slate-200 p-8 text-center dark:border-slate-700">
                <p className="text-sm text-slate-500 dark:text-slate-400">Decrypting item data...</p>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : (
              <>
                {/* Standard Login User / Customer ID */}
                {(itemType === 'LOGIN' || password.login) && (
                  <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between dark:border-slate-700">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {itemType === 'BANK_ACCOUNT' ? 'Customer ID / Username' : 'Username / Login'}
                      </p>
                      <p className="font-medium text-slate-900 mt-0.5 truncate dark:text-slate-100">
                        {password.login || '-'}
                      </p>
                    </div>
                    {password.login && (
                      <button
                        onClick={() => handleCopy(password.login, 'Username')}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 shrink-0 ml-2 text-slate-600 dark:text-slate-300"
                        title="Copy username"
                      >
                        <Copy size={15} />
                      </button>
                    )}
                  </div>
                )}

                {/* Standard Password Field */}
                {(itemType === 'LOGIN' || displayPassword) && (
                  <div className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between dark:border-slate-700">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-500 dark:text-slate-400">Password</p>
                      <p className="font-mono font-medium text-slate-900 mt-0.5 break-all dark:text-slate-100">
                        {showDecrypted ? displayPassword || '(empty)' : '••••••••••••'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <button
                        onClick={handleTogglePasswordReveal}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                        title={showDecrypted ? 'Hide password' : 'Show password'}
                      >
                        {showDecrypted ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button
                        onClick={() => handleCopy(displayPassword, 'Password')}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                        title="Copy password"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Built-in TOTP Authenticator */}
                {totpSecret && (
                  <TotpField
                    secret={totpSecret}
                    revealed={true}
                    onReveal={() => {}}
                    onCopy={(code) => handleCopy(code, 'TOTP')}
                  />
                )}

                {/* Typed Fields (e.g. Bank Account Number, IFSC, CVV, Card Number) */}
                {typeFieldDefs.map((field) => {
                  const rawValue = decryptedFields?.[field.key];
                  if (rawValue === undefined || rawValue === null || rawValue === '') return null;

                  const isMaskedDef = isFieldMasked(itemType, field.key) || field.masked || field.input === 'password';
                  const isRevealed = !!revealedFields[field.key];
                  const displayVal = isMaskedDef
                    ? isRevealed
                      ? String(rawValue)
                      : maskFieldValue(itemType, field.key, rawValue)
                    : itemType === 'CARD' && field.key === 'cardNumber'
                    ? formatCardNumber(rawValue)
                    : String(rawValue);

                  return (
                    <div
                      key={field.key}
                      className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between dark:border-slate-700"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{field.label}</p>
                        <p
                          className={`font-medium mt-0.5 break-all dark:text-slate-100 ${
                            isMaskedDef && !isRevealed ? 'tracking-wider font-mono' : ''
                          }`}
                        >
                          {displayVal}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {isMaskedDef && (
                          <button
                            onClick={() => toggleFieldReveal(field.key)}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                            title={isRevealed ? 'Hide' : 'Reveal'}
                          >
                            {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        )}
                        <button
                          onClick={() => handleCopy(rawValue, field.label)}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                          title={`Copy ${field.label}`}
                        >
                          <Copy size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Custom Fields */}
                {customFields.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Custom Fields</p>
                    {customFields.map((cf, idx) => {
                      const isRevealed = !!revealedFields[`custom_${idx}`];
                      const displayVal = cf.sensitive
                        ? isRevealed
                          ? cf.value
                          : '••••••••••••'
                        : cf.value;
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200 p-3.5 flex items-center justify-between dark:border-slate-700"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400">{cf.name}</p>
                            <p className="font-medium text-slate-900 mt-0.5 break-all dark:text-slate-100">
                              {displayVal}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            {cf.sensitive && (
                              <button
                                onClick={() => toggleFieldReveal(`custom_${idx}`)}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                              >
                                {isRevealed ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                            )}
                            <button
                              onClick={() => handleCopy(cf.value, cf.name)}
                              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                            >
                              <Copy size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Website URL */}
                {password.url && (
                  <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Website / NetBanking URL</p>
                    <a
                      href={password.url.startsWith('http') ? password.url : `https://${password.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5 inline-flex items-center gap-1.5 dark:text-indigo-400 break-all"
                    >
                      {password.url}
                      <ExternalLink size={14} className="shrink-0" />
                    </a>
                  </div>
                )}

                {/* Tags */}
                {password?.tags?.length > 0 && (
                  <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tags</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {password.tags
                        .map((item) => (typeof item === 'string' ? item : item.tag?.name))
                        .filter(Boolean)
                        .map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium dark:bg-indigo-900/30 dark:text-indigo-300"
                          >
                            {name}
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {displayNote && displayNote !== 'No note' && (
                  <div className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Note</p>
                    <p className="font-medium text-slate-900 mt-1 whitespace-pre-wrap break-all dark:text-slate-100 text-sm">
                      {displayNote}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 shrink-0">
            <button
              onClick={handleClose}
              className="w-full bg-slate-900 text-white rounded-xl py-2.5 font-medium hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>

        {/* Re-verify Master Password Modal for Sensitive Step-up */}
        <VerifyMasterPasswordModal
          open={reVerifyOpen}
          onClose={() => {
            setReVerifyOpen(false);
            setPendingAction(null);
          }}
          onVerified={() => {
            setReVerifyOpen(false);
            setSensitiveVerified(true);
            if (pendingAction) {
              pendingAction();
              setPendingAction(null);
            }
          }}
        />
      </ModalBackdrop>
    </ModalPortal>
  );
}

export default ViewMyVaultPasswordModal;