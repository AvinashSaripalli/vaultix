import { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  Clock,
  Lock,
} from 'lucide-react';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
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
  const [showPassword, setShowPassword] = useState(false);
  const [revealedFields, setRevealedFields] = useState({});

  if (!item) {
    return (
      <div className="h-full min-h-[450px] flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-500">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4 text-slate-400">
          <KeyRound size={28} />
        </div>
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No credential selected</h3>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
          Select an item from the shared list on the left to view details and credentials.
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
    <div className="space-y-6 min-w-0">
      {/* Mobile Back Button */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="lg:hidden inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <ArrowLeft size={16} />
          <span>Back to shared list</span>
        </button>
      )}

      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
          <ItemServiceIcon name={passwordEntry.name} type={itemType} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 truncate">
                {passwordEntry.name || 'Untitled Credential'}
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                {typeMeta?.label || 'LOGIN'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Shared by</span>
              <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                {item.sharedBy?.fullName || 'Teammate'}
              </strong>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-slate-400" />
                {formatDate(item.createdAt)}
              </span>
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {passwordEntry.url && (
            <a
              href={
                passwordEntry.url.startsWith('http')
                  ? passwordEntry.url
                  : `https://${passwordEntry.url}`
              }
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Open website"
            >
              <ExternalLink size={14} />
              <span>Launch</span>
            </a>
          )}

          {onLeaveShare && (
            <button
              type="button"
              onClick={() => onLeaveShare(item)}
              className="h-9 px-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100 text-rose-600 text-xs font-semibold flex items-center gap-1.5 transition dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
              title="Remove from your shared list"
            >
              <Trash2 size={14} />
              <span>Leave Share</span>
            </button>
          )}
        </div>
      </div>

      {/* Security Verification Banner */}
      <div className="rounded-2xl bg-indigo-50/70 border border-indigo-100 p-3.5 sm:p-4 flex items-start gap-3 dark:bg-indigo-900/20 dark:border-indigo-800/60">
        <div className="h-8 w-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
          <ShieldCheck size={18} />
        </div>
        <div className="text-xs text-indigo-950 dark:text-indigo-200 min-w-0 space-y-0.5">
          <p className="font-bold">Zero-Knowledge RSA-4096 Protection</p>
          <p className="text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
            This item is encrypted specifically for your private key. The server stores only ciphertext and has zero knowledge of your secrets.
          </p>
        </div>
      </div>

      {/* Credential Details Card */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-200 dark:border-slate-700 dark:divide-slate-700">
        
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
                  title="Open in new tab"
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

      {/* Sharing Metadata Summary Box */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-750/50">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Sharing & Access Metadata
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Shared By</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {item.sharedBy?.fullName || 'Teammate'} ({item.sharedBy?.email || 'User'})
            </span>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Access Permission</span>
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Read Only (Decryption Authorized)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, action, isMono = false }) {
  return (
    <div className="flex flex-col gap-1 sm:grid sm:grid-cols-[130px_1fr_auto] sm:gap-3 sm:items-center px-4 py-3 sm:py-3.5 min-w-0">
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
