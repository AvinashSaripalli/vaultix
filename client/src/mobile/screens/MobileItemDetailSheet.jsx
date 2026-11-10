import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, ExternalLink, X, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import { hapticMedium, hapticLight } from '../../utils/haptics';

export default function MobileItemDetailSheet({
  item,
  decryptedPassword = '',
  decryptedNotes = '',
  onClose,
  onCopyText,
  onEdit,
  onDelete,
}) {
  const [revealed, setRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  if (!item) return null;

  const handleCopy = (field, text, label) => {
    hapticMedium();
    onCopyText(text, label);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const displayPassword = revealed ? decryptedPassword || item.password || '••••••••••••' : '••••••••••••••••';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Tap backdrop to dismiss */}
      <div className="flex-1" onClick={onClose} />

      {/* Bottom Sheet Card */}
      <div className="w-full max-h-[88%] rounded-t-[32px] bg-slate-900 border-t border-slate-750 p-5 space-y-4 overflow-y-auto animate-slideUp shadow-2xl">
        {/* Top Handle */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto -mt-1 mb-1" />

        {/* Navigation Bar */}
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 py-1 px-2.5 rounded-xl bg-indigo-500/10 active:scale-95 transition"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  hapticLight();
                  onEdit(item);
                }}
                className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700 active:scale-95 transition"
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
                className="w-8 h-8 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-400 flex items-center justify-center hover:bg-rose-900/40 active:scale-95 transition"
                title="Delete item"
              >
                <Trash2 size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center hover:bg-slate-700 active:scale-95 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Hero Display Header */}
        <div className="flex flex-col items-center text-center py-1">
          <ItemServiceIcon name={item.name} type={item.type} size="lg" className="mb-2 shadow-lg" />
          <h2 className="text-lg font-extrabold text-white tracking-tight">{item.name}</h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-slate-400 font-medium">
              {item.folder?.name || 'Company Vault'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400">
              {item.type || 'LOGIN'}
            </span>
          </div>
        </div>

        {/* Credential Inset Card */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 divide-y divide-slate-800/80 overflow-hidden">
          {/* Username / Login */}
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Username / Email
              </span>
              <p className="text-xs font-mono font-semibold text-white truncate mt-0.5">
                {item.login || '—'}
              </p>
            </div>
            {item.login && (
              <button
                type="button"
                onClick={() => handleCopy('login', item.login, 'Username')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition active:scale-95 ${
                  copiedField === 'login'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-800 text-indigo-400 border border-slate-700'
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Password
              </span>
              <p className="text-xs font-mono font-semibold text-white tracking-wider mt-0.5 select-all">
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
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition"
                title={revealed ? 'Hide' : 'Show'}
              >
                {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>

              <button
                type="button"
                onClick={() => handleCopy('password', decryptedPassword || item.password, 'Password')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition active:scale-95 ${
                  copiedField === 'password'
                    ? 'bg-emerald-500 text-white shadow-xs'
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Website URL
                </span>
                <p className="text-xs font-mono text-indigo-400 truncate mt-0.5">
                  {item.url}
                </p>
              </div>
              <a
                href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>

        {/* Security / Metadata Card */}
        <div className="rounded-2xl bg-slate-950/60 border border-slate-800/80 p-3.5 space-y-2 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Folder</span>
            <span className="text-slate-200 font-semibold">{item.folder?.name || 'Default'}</span>
          </div>
          {item.updatedAt && (
            <div className="flex justify-between text-slate-400">
              <span>Last Modified</span>
              <span className="text-slate-200 font-semibold">
                {new Date(item.updatedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs transition active:scale-95"
        >
          Close
        </button>
      </div>
    </div>
  );
}
