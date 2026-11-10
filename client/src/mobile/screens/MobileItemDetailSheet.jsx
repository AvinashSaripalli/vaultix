import { useState, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  ExternalLink,
  X,
  Pencil,
  Trash2,
  ArrowLeft,
  Share2,
  CreditCard,
  FileText,
  User,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import { hapticMedium, hapticLight } from '../../utils/haptics';
import { parseCustomFields } from '../../utils/itemTypes';

export default function MobileItemDetailSheet({
  item,
  decryptedPassword = '',
  decryptedNote = '',
  decryptedFields = {},
  onClose,
  onCopyText,
  onEdit,
  onDelete,
  onShare,
}) {
  const [revealed, setRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  if (!item) return null;

  const itemType = item.type || 'LOGIN';

  const handleCopy = (field, text, label) => {
    if (!text) return;
    hapticMedium();
    onCopyText(text, label);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const displayPassword = revealed
    ? decryptedPassword || item.password || '••••••••••••'
    : '••••••••••••••••';

  // Merge fields
  const fields = {
    ...(item.fields || {}),
    ...(decryptedFields || {}),
  };

  const customFieldsList = useMemo(() => {
    return parseCustomFields(item.customFields || item.encryptedCustomFields || []);
  }, [item]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Tap backdrop to dismiss */}
      <div className="flex-1" onClick={onClose} />

      {/* Bottom Sheet Card */}
      <div className="w-full max-h-[90%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-750 p-5 space-y-4 overflow-y-auto animate-slideUp shadow-2xl text-slate-900 dark:text-white transition-colors duration-200">
        {/* Top Handle */}
        <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1" />

        {/* Navigation Bar */}
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 py-1 px-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 active:scale-95 transition"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-1.5">
            {onShare && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onShare(item);
                }}
                className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 active:scale-95 transition"
                title="Share item"
              >
                <Share2 size={15} />
              </button>
            )}

            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onEdit(item);
                }}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition"
                title="Edit item"
              >
                <Pencil size={15} />
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onDelete(item);
                }}
                className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900/40 active:scale-95 transition"
                title="Delete item"
              >
                <Trash2 size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Hero Display Header */}
        <div className="flex flex-col items-center text-center py-1">
          <ItemServiceIcon name={item.name} type={itemType} size="lg" className="mb-2 shadow-lg" />
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">{item.name}</h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {item.folder?.name || 'Root Vault'}
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {itemType}
            </span>
          </div>
        </div>

        {/* 1. LOGIN TYPE DETAILS */}
        {itemType === 'LOGIN' && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs">
            {/* Username / Login */}
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Username / Email
                </span>
                <p className="text-xs font-mono font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                  {item.login || '—'}
                </p>
              </div>
              {item.login && (
                <button
                  type="button"
                  onClick={() => handleCopy('login', item.login, 'Username')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition active:scale-95 ${
                    copiedField === 'login'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  {copiedField === 'login' ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedField === 'login' ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            {/* Password */}
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Password
                </span>
                <p className="text-xs font-mono font-semibold text-slate-900 dark:text-white tracking-wider mt-0.5 select-all">
                  {displayPassword}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setRevealed(!revealed);
                  }}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 active:scale-95 transition shadow-xs"
                  title={revealed ? 'Hide' : 'Show'}
                >
                  {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>

                <button
                  type="button"
                  onClick={() => handleCopy('password', decryptedPassword || item.password, 'Password')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition active:scale-95 ${
                    copiedField === 'password'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                  }`}
                >
                  {copiedField === 'password' ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedField === 'password' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Website URL */}
            {item.url && (
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Website URL
                  </span>
                  <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                    {item.url}
                  </p>
                </div>
                <a
                  href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 shadow-xs"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            )}
          </div>
        )}

        {/* 2. CARD TYPE DETAILS */}
        {itemType === 'CARD' && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs">
            {/* Cardholder Name */}
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Cardholder Name
                </span>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                  {fields.cardholderName || item.cardholderName || '—'}
                </p>
              </div>
              {(fields.cardholderName || item.cardholderName) && (
                <button
                  type="button"
                  onClick={() => handleCopy('cardholder', fields.cardholderName || item.cardholderName, 'Cardholder')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 shadow-xs"
                >
                  {copiedField === 'cardholder' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              )}
            </div>

            {/* Card Number */}
            <div className="p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Card Number
                </span>
                <p className="text-xs font-mono font-bold text-slate-900 dark:text-white tracking-widest mt-0.5">
                  {revealed
                    ? fields.cardNumber || item.cardNumber || '••••••••••••••••'
                    : '•••• •••• •••• ••••'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setRevealed(!revealed)}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy('cardnum', fields.cardNumber || item.cardNumber, 'Card Number')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs"
                >
                  {copiedField === 'cardnum' ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* Expiry & CVV */}
            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-800">
              <div className="p-3.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Expires
                </span>
                <p className="text-xs font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                  {fields.expiryDate || fields.expirationDate || item.expiryDate || '—'}
                </p>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Security CVV
                  </span>
                  <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {revealed ? fields.cvv || item.cvv || '•••' : '•••'}
                  </p>
                </div>
                {(fields.cvv || item.cvv) && (
                  <button
                    type="button"
                    onClick={() => handleCopy('cvv', fields.cvv || item.cvv, 'CVV')}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700"
                  >
                    {copiedField === 'cvv' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. SECURE NOTE TYPE DETAILS */}
        {itemType === 'SECURE_NOTE' && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Encrypted Note Body
              </span>
              <button
                type="button"
                onClick={() => handleCopy('note', decryptedNote || item.note || item.notes, 'Note')}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 shadow-xs inline-flex items-center gap-1"
              >
                {copiedField === 'note' ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedField === 'note' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-all leading-relaxed max-h-48 overflow-y-auto">
              {decryptedNote || item.note || item.notes || 'No note contents.'}
            </div>
          </div>
        )}

        {/* 4. IDENTITY TYPE DETAILS */}
        {itemType === 'IDENTITY' && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs text-xs">
            {/* Full Name */}
            <div className="p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Full Name</span>
                <p className="font-semibold text-slate-900 dark:text-white">{fields.fullName || item.fullName || '—'}</p>
              </div>
              {(fields.fullName || item.fullName) && (
                <button
                  type="button"
                  onClick={() => handleCopy('id-name', fields.fullName || item.fullName, 'Full Name')}
                  className="p-1 rounded bg-white dark:bg-slate-800 text-indigo-600"
                >
                  <Copy size={12} />
                </button>
              )}
            </div>

            {/* Email */}
            {(fields.email || item.email) && (
              <div className="p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Email</span>
                  <p className="font-mono text-slate-900 dark:text-white">{fields.email || item.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('id-email', fields.email || item.email, 'Email')}
                  className="p-1 rounded bg-white dark:bg-slate-800 text-indigo-600"
                >
                  <Copy size={12} />
                </button>
              </div>
            )}

            {/* Phone */}
            {(fields.phone || item.phone) && (
              <div className="p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Phone</span>
                  <p className="font-mono text-slate-900 dark:text-white">{fields.phone || item.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('id-phone', fields.phone || item.phone, 'Phone')}
                  className="p-1 rounded bg-white dark:bg-slate-800 text-indigo-600"
                >
                  <Copy size={12} />
                </button>
              </div>
            )}

            {/* Passport / National ID */}
            {(fields.passportNumber || fields.nationalId) && (
              <div className="p-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Passport / ID</span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white">
                    {fields.passportNumber || fields.nationalId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy('id-doc', fields.passportNumber || fields.nationalId, 'ID Number')}
                  className="p-1 rounded bg-white dark:bg-slate-800 text-indigo-600"
                >
                  <Copy size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Custom Fields (if any) */}
        {customFieldsList.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
              Custom Attributes
            </span>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs text-xs">
              {customFieldsList.map((cf, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">{cf.name}</span>
                    <p className="font-mono text-slate-900 dark:text-white">{cf.value}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(`cf-${idx}`, cf.value, cf.name)}
                    className="p-1 rounded bg-white dark:bg-slate-800 text-indigo-600"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes (if login or card has notes) */}
        {itemType !== 'SECURE_NOTE' && (decryptedNote || item.note || item.notes) && (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 space-y-1 text-xs shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Notes
            </span>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {decryptedNote || item.note || item.notes}
            </p>
          </div>
        )}

        {/* Security / Metadata Card */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 p-3.5 space-y-2 text-xs shadow-xs">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Folder</span>
            <span className="text-slate-900 dark:text-slate-200 font-semibold">{item.folder?.name || 'Default'}</span>
          </div>
          {item.updatedAt && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Last Modified</span>
              <span className="text-slate-900 dark:text-slate-200 font-semibold">
                {new Date(item.updatedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-white font-bold text-xs transition active:scale-95 shadow-xs"
        >
          Close
        </button>
      </div>
    </div>
  );
}
