import { Copy, ExternalLink, X, Eye, EyeOff, Globe, User, Folder, KeyRound } from 'lucide-react';
import { useState } from 'react';
import api from '../../services/api';
import { secureCopyText } from '../../utils/clipboard';
import ModalPortal from '../../components/common/ModalPortal';

function ViewSharedPasswordModal({ open, item, decryptedData, onClose }) {
  const [showPw, setShowPw] = useState(false);

  if (!open || !item) return null;

  const password = item.password;
  const displayPassword = decryptedData?.password || '';
  const displayNote = decryptedData?.note || 'No note';

  const handleCopy = (value) => {
    if (!value) return;
    secureCopyText(value);
    api.post(`/passwords/${password.id}/copy-log`).catch(() => {});
  };

  return (
    <ModalPortal open={open} onClose={onClose}>
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden dark:bg-slate-800 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300">
                <KeyRound size={22} />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider dark:text-indigo-400">Shared Password</p>
                <h2 className="text-xl font-bold text-slate-900 truncate dark:text-slate-100">{password?.name}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Shared by <span className="font-medium text-slate-700 dark:text-slate-300">{item.sharedBy?.fullName || 'a user'}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="h-9 w-9 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors shrink-0 dark:hover:bg-slate-700 dark:text-slate-500">
              <X size={19} />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="rounded-xl bg-slate-50 border border-slate-200 overflow-hidden dark:bg-slate-700/50 dark:border-slate-600">
            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-slate-600">
              <div className="p-4 space-y-3">
                <MetaItem icon={User} label="Shared by" value={item.sharedBy?.fullName} />
                <MetaItem icon={User} label="Owner" value={password?.vault?.owner?.fullName || 'Unknown'} />
              </div>
              <div className="p-4 space-y-3">
                <MetaItem icon={Folder} label="Vault" value={password?.vault?.name || '-'} />
                <MetaItem icon={Folder} label="Folder" value={password?.folder?.name || '-'} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 dark:border-slate-600 dark:divide-slate-700">
            <Row label="Login" value={password?.login} onCopy={() => handleCopy(password?.login)} copyIcon />

            <Row label="Password" value={showPw ? displayPassword : '••••••••••••'}>
              <IconBtn onClick={() => setShowPw((p) => !p)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </IconBtn>
              <IconBtn onClick={() => handleCopy(displayPassword)}>
                <Copy size={15} />
              </IconBtn>
            </Row>

            <Row label="URL" value={password?.url || 'No URL'} link onCopy={() => handleCopy(password?.url)} external />

            <Row label="Note" value={displayNote || 'No note'} />

            <Row label="Tags" value={password?.tags?.length ? password.tags.map((t) => t.tag?.name).filter(Boolean).join(', ') : 'No tags'} />
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between dark:bg-slate-700/50 dark:border-slate-700">
          <p className="text-xs text-slate-400 dark:text-slate-500">Securely shared via Vaultix</p>
          <button onClick={onClose} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-colors dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">Close</button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}

function MetaItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800 truncate dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value, children, link, onCopy, copyIcon, external }) {
  const isUrl = link && value && value !== 'No URL';
  return (
    <div className="flex items-center justify-between px-5 py-4 min-h-[52px]">
      <p className="text-sm text-slate-500 shrink-0 w-20 dark:text-slate-400">{label}</p>
      <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
        {children}
        {isUrl ? (
          <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[240px] flex items-center gap-1 dark:text-blue-400 dark:hover:text-blue-300">
            <Globe size={13} className="shrink-0" />
            <span className="truncate">{value}</span>
          </a>
        ) : (
          <span className="text-sm text-slate-900 truncate max-w-[240px] dark:text-slate-100">{value}</span>
        )}
        {onCopy ? (
          <IconBtn onClick={onCopy}>
            {external ? <ExternalLink size={15} /> : <Copy size={15} />}
          </IconBtn>
        ) : null}
      </div>
    </div>
  );
}

function IconBtn({ onClick, children, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${disabled ? 'text-slate-200 cursor-not-allowed dark:text-slate-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300'}`}>
      {children}
    </button>
  );
}

export default ViewSharedPasswordModal;
