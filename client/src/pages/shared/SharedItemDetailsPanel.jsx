import { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  Clock,
  Lock,
  Key,
} from 'lucide-react';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import ItemTypeBadge from '../../components/myVault/ItemTypeBadge';
import {
  CUSTOM_FIELDS_KEY,
  TYPE_FIELDS,
  getItemTypeMeta,
  isFieldMasked,
  maskFieldValue,
  parseCustomFields,
} from '../../utils/itemTypes';

export default function SharedItemDetailsPanel({
  item,
  decrypted,
  isDecrypting = false,
  onCopy,
  onLeaveShare,
  onBack,
  onRequestDecrypt,
}) {
  const [activeTab, setActiveTab] = useState('credentials');
  const [showPassword, setShowPassword] = useState(false);
  const [revealedFields, setRevealedFields] = useState({});

  if (!item) {
    return (
      <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4 text-slate-400">
          <KeyRound size={28} />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No credential selected</h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
          Select an item from the list on the left to view its credential details.
        </p>
      </div>
    );
  }

  const passwordEntry = item.password || {};
  const itemType = passwordEntry.type || 'LOGIN';
  const typeMeta = getItemTypeMeta(itemType);

  const displayPassword = decrypted?.password || '';
  const displayNote = decrypted?.note || (passwordEntry.encryptedNote ? null : 'No note');
  const fieldsObj = decrypted?.fields || {};

  const typeFieldDefs = (() => {
    const base = [...(TYPE_FIELDS[itemType] || [])];
    if (fieldsObj?.accountHolder && !base.some((f) => f.key === 'accountHolder')) {
      base.push({ key: 'accountHolder', label: 'Account Holder Name', copy: true });
    }
    if (fieldsObj?.routingNumber && !base.some((f) => f.key === 'routingNumber')) {
      base.push({ key: 'routingNumber', label: 'IFSC / Routing Code', copy: true });
    }
    return base;
  })();

  const customFields = parseCustomFields(fieldsObj?.[CUSTOM_FIELDS_KEY]);

  const tagNames = Array.isArray(passwordEntry.tags)
    ? passwordEntry.tags.map((t) => (typeof t === 'string' ? t : t.tag?.name || t.name)).filter(Boolean)
    : [];

  const handlePasswordVisibility = async () => {
    if (!decrypted && onRequestDecrypt) {
      const ok = await onRequestDecrypt(item);
      if (ok) setShowPassword(true);
      return;
    }
    setShowPassword((prev) => !prev);
  };

  const handleFieldReveal = async (key) => {
    if (!decrypted && onRequestDecrypt) {
      const ok = await onRequestDecrypt(item);
      if (ok) {
        setRevealedFields((prev) => ({ ...prev, [key]: !prev[key] }));
      }
      return;
    }
    setRevealedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Recently';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0">
      {/* Mobile Back Button */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="xl:hidden inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ArrowLeft size={16} />
          <span>Back to items</span>
        </button>
      )}

      {/* Top Header Row (Matching Company Vault style) */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3.5 min-w-0">
            <ItemServiceIcon name={passwordEntry.name} type={itemType} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {passwordEntry.name || 'Untitled Credential'}
                </h2>
                <ItemTypeBadge type={itemType} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400 break-words">
                Shared by <strong className="font-semibold text-slate-700 dark:text-slate-300">{item.sharedBy?.fullName || 'User'}</strong> • {formatDate(item.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center flex-wrap gap-2 shrink-0">
          {passwordEntry.url && (
            <a
              href={
                passwordEntry.url.startsWith('http')
                  ? passwordEntry.url
                  : `https://${passwordEntry.url}`
              }
              target="_blank"
              rel="noreferrer"
              className="h-9 sm:h-10 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-600"
              title="Open website"
            >
              <ExternalLink size={15} className="text-indigo-600 dark:text-indigo-400" />
              <span>Launch</span>
            </a>
          )}

          {onLeaveShare && (
            <button
              type="button"
              onClick={() => onLeaveShare(item)}
              className="h-9 sm:h-10 px-3.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40 text-rose-600 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
              title="Remove from your shared list"
            >
              <Trash2 size={15} />
              <span>Leave Share</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Row (Matching Company Vault Credentials & Fields vs Security) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition shadow-xs ${
            activeTab === 'credentials'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
          }`}
        >
          <Key size={14} />
          <span>Credentials & Fields</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition ${
            activeTab === 'security'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
          }`}
        >
          <ShieldCheck size={14} />
          <span>Security & E2EE Info</span>
        </button>
      </div>

      {/* Tab 1: Credentials & Fields (Matching Company Vault) */}
      {activeTab === 'credentials' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 dark:bg-slate-800 dark:border-slate-700 space-y-4 shadow-xs">
            {/* Inner Sub-Card Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  {typeMeta?.label || 'Login Details'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Shared by {item.sharedBy?.fullName || 'User'}
                </p>
              </div>
            </div>

            {/* Inner Rows Table with Option 1 Bold Dark Slate */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden dark:border-slate-700">
              
              {/* Login Row */}
              {(itemType === 'LOGIN' || passwordEntry.login) && (
                <DetailRow
                  label="Login"
                  value={passwordEntry.login || '—'}
                  action={
                    passwordEntry.login ? (
                      <button
                        type="button"
                        onClick={() => onCopy(passwordEntry.login, 'Login')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                        title="Copy login"
                      >
                        <Copy size={16} />
                      </button>
                    ) : null
                  }
                />
              )}

              {/* Password Row */}
              {(itemType === 'LOGIN' || displayPassword || passwordEntry.encryptedPassword) && (
                <DetailRow
                  label="Password"
                  isMono={showPassword}
                  value={
                    isDecrypting ? (
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Decrypting...</span>
                    ) : showPassword ? (
                      displayPassword || '—'
                    ) : (
                      '••••••••••••'
                    )
                  }
                  action={
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePasswordVisibility}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                        title={showPassword ? 'Hide' : 'Reveal'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!displayPassword && onRequestDecrypt) {
                            await onRequestDecrypt(item);
                          } else if (displayPassword) {
                            onCopy(displayPassword, 'Password');
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                        title="Copy password"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  }
                />
              )}

              {/* URL Row */}
              {passwordEntry.url && (
                <DetailRow
                  label="URL"
                  value={
                    <a
                      href={
                        passwordEntry.url.startsWith('http')
                          ? passwordEntry.url
                          : `https://${passwordEntry.url}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline break-all dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {passwordEntry.url}
                    </a>
                  }
                  action={
                    <div className="flex items-center gap-1.5">
                      <a
                        href={
                          passwordEntry.url.startsWith('http')
                            ? passwordEntry.url
                            : `https://${passwordEntry.url}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                        title="Open link"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <button
                        type="button"
                        onClick={() => onCopy(passwordEntry.url, 'URL')}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                        title="Copy URL"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  }
                />
              )}

              {/* Dynamic Type-Specific Fields */}
              {typeFieldDefs.map((field) => {
                const rawValue = fieldsObj?.[field.key];
                if (!rawValue && !field.required) return null;
                const masked = isFieldMasked(field);
                const isRevealed = Boolean(revealedFields[field.key]);
                const shownValue = masked && !isRevealed ? maskFieldValue(rawValue, field) : rawValue || '—';
                const isUrlField = field.key === 'url' || field.key === 'baseUrl';

                return (
                  <DetailRow
                    key={field.key}
                    label={field.label}
                    isMono={masked && isRevealed}
                    value={
                      isUrlField && rawValue ? (
                        <a
                          href={String(rawValue).startsWith('http') ? String(rawValue) : `https://${rawValue}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline break-all dark:text-blue-400"
                        >
                          {String(rawValue)}
                        </a>
                      ) : (
                        String(shownValue)
                      )
                    }
                    action={
                      <div className="flex items-center gap-1.5">
                        {masked && (
                          <button
                            type="button"
                            onClick={() => handleFieldReveal(field.key)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                            title={isRevealed ? 'Hide' : 'Reveal'}
                          >
                            {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        )}
                        {field.copy && rawValue && (
                          <button
                            type="button"
                            onClick={() => onCopy(String(rawValue), field.label)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                            title={`Copy ${field.label}`}
                          >
                            <Copy size={16} />
                          </button>
                        )}
                      </div>
                    }
                  />
                );
              })}

              {/* Custom Fields */}
              {customFields.map((cf, idx) => {
                const cfKey = `custom_${idx}`;
                const isRevealed = Boolean(revealedFields[cfKey]);
                const shownValue = cf.sensitive && !isRevealed ? '••••••••••••' : cf.value || '—';

                return (
                  <DetailRow
                    key={cfKey}
                    label={cf.name || `Field ${idx + 1}`}
                    isMono={cf.sensitive && isRevealed}
                    value={shownValue}
                    action={
                      <div className="flex items-center gap-1.5">
                        {cf.sensitive && (
                          <button
                            type="button"
                            onClick={() => handleFieldReveal(cfKey)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                            title={isRevealed ? 'Hide' : 'Reveal'}
                          >
                            {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        )}
                        {cf.value && (
                          <button
                            type="button"
                            onClick={() => onCopy(cf.value, cf.name || 'Custom Field')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                            title="Copy field"
                          >
                            <Copy size={16} />
                          </button>
                        )}
                      </div>
                    }
                  />
                );
              })}

              {/* Note Row */}
              <DetailRow
                label="Note"
                value={
                  displayNote ? (
                    <span className="whitespace-pre-wrap">{displayNote}</span>
                  ) : passwordEntry.encryptedNote ? (
                    <button
                      type="button"
                      onClick={() => onRequestDecrypt && onRequestDecrypt(item)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
                    >
                      <Lock size={12} />
                      <span>Decrypt note</span>
                    </button>
                  ) : (
                    'No note'
                  )
                }
                action={
                  displayNote && displayNote !== 'No note' ? (
                    <button
                      type="button"
                      onClick={() => onCopy(displayNote, 'Note')}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-750 transition"
                      title="Copy note"
                    >
                      <Copy size={16} />
                    </button>
                  ) : null
                }
              />

              {/* Tags Row */}
              <DetailRow
                label="Tags"
                value={
                  tagNames.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tagNames.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2.5 py-0.5 text-xs font-medium dark:bg-blue-900/30 dark:text-blue-300"
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
        </div>
      ) : (
        /* Tab 2: Security & E2EE Info */
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 dark:bg-slate-800 dark:border-slate-700 space-y-4 shadow-xs">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Zero-Knowledge Cryptographic Verification
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verified asymmetric end-to-end encryption details
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Encryption Mechanism</span>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  This password entry was re-encrypted by the sender using your RSA-4096 public key. The server stores only encrypted ciphertext. Only your master password and private key can decrypt it.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Shared By</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.sharedBy?.fullName || 'User'} ({item.sharedBy?.email || 'User'})
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Access Level</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Read Only (Decryption Authorized)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, action, isMono = false }) {
  return (
    <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr_auto] sm:gap-3 sm:items-center border-b border-slate-200 last:border-b-0 px-3.5 sm:px-4 py-3 sm:py-3.5 dark:border-slate-700/80 min-w-0">
      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight shrink-0">
        {label}
      </p>

      <div className="flex items-center justify-between gap-2 min-w-0 sm:contents">
        <div
          className={`text-xs sm:text-sm font-medium text-slate-900 break-all min-w-0 flex-1 dark:text-slate-100 ${
            isMono ? 'font-mono tracking-wider select-all' : ''
          }`}
        >
          {value}
        </div>

        {action ? <div className="flex justify-end shrink-0">{action}</div> : <div className="hidden sm:block" />}
      </div>
    </div>
  );
}
