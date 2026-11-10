import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Share2, Search, X, Copy, Check, Eye, EyeOff, RefreshCw, KeyRound, ExternalLink, ShieldCheck } from 'lucide-react';
import { fetchSharedWithMe } from '../../features/sharedPasswords/sharedPasswordsSlice';
import {
  rsaDecrypt,
  decryptTextWithAesKey,
  decryptFieldsWithAesKey,
  safeDecryptText,
} from '../../utils/crypto';
import { secureCopyText } from '../../utils/clipboard';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';

export default function MobileSharedWithMeSheet({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const { sharedWithMe = [], loading } = useSelector((state) => state.sharedPasswords);
  const { sessionRsaPrivateKey, sessionMasterPassword } = useSelector((state) => state.auth);

  const [search, setSearch] = useState('');
  const [selectedShare, setSelectedShare] = useState(null);
  const [decryptedMap, setDecryptedMap] = useState({});
  const [revealed, setRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchSharedWithMe());
      setSelectedShare(null);
      setRevealed(false);
    }
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  const handleSelectShare = async (item) => {
    setSelectedShare(item);
    setRevealed(false);
    hapticLight();

    if (decryptedMap[item.id]) return;

    try {
      if (item.encryptedItemKey && sessionRsaPrivateKey) {
        const aesKeyJwk = await rsaDecrypt(item.encryptedItemKey, sessionRsaPrivateKey);
        let pwd = '';
        let note = '';
        let fields = null;

        if (item.reEncryptedPassword) {
          pwd = await decryptTextWithAesKey(item.reEncryptedPassword, aesKeyJwk);
        }
        if (item.reEncryptedNote) {
          note = await decryptTextWithAesKey(item.reEncryptedNote, aesKeyJwk);
        }
        if (item.reEncryptedFields) {
          fields = await decryptFieldsWithAesKey(item.reEncryptedFields, aesKeyJwk);
        }

        setDecryptedMap((prev) => ({
          ...prev,
          [item.id]: { password: pwd, note, fields },
        }));
      }
    } catch (err) {
      console.warn('Failed to decrypt shared item with RSA key:', err);
    }
  };

  const handleCopy = (field, text, label) => {
    if (!text) return;
    hapticMedium();
    secureCopyText(text, label);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const filtered = sharedWithMe.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.password?.name?.toLowerCase().includes(q) ||
      item.password?.login?.toLowerCase().includes(q) ||
      item.sharedBy?.fullName?.toLowerCase().includes(q)
    );
  });

  const activeDecrypted = selectedShare ? decryptedMap[selectedShare.id] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[88%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Share2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Shared With Me</h2>
              <p className="text-[10px] text-slate-400">Credentials shared by colleagues</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:scale-95 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content View: List or Item Detail */}
        {selectedShare ? (
          /* DETAILS VIEW FOR SELECTED SHARED ITEM */
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <button
              type="button"
              onClick={() => setSelectedShare(null)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 mb-1"
            >
              ← Back to shared list
            </button>

            {/* Hero */}
            <div className="flex flex-col items-center text-center py-1">
              <ItemServiceIcon name={selectedShare.password?.name} type={selectedShare.password?.type} size="lg" className="mb-2 shadow-lg" />
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{selectedShare.password?.name}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Shared by <span className="font-bold text-slate-700 dark:text-slate-300">{selectedShare.sharedBy?.fullName || 'Colleague'}</span>
              </p>
            </div>

            {/* Credential Inset Card */}
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800/80 overflow-hidden shadow-xs">
              {/* Username */}
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Username / Email</span>
                  <p className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedShare.password?.login || '—'}
                  </p>
                </div>
                {selectedShare.password?.login && (
                  <button
                    type="button"
                    onClick={() => handleCopy('login', selectedShare.password.login, 'Username')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-indigo-600 border border-slate-200 dark:border-slate-700"
                  >
                    {copiedField === 'login' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                )}
              </div>

              {/* Password */}
              <div className="p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Password</span>
                  <p className="text-xs font-mono font-bold text-slate-900 dark:text-white tracking-wider mt-0.5 select-all">
                    {revealed ? activeDecrypted?.password || '••••••••••••' : '••••••••••••••••'}
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
                    onClick={() => handleCopy('password', activeDecrypted?.password, 'Password')}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs"
                  >
                    {copiedField === 'password' ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              {/* URL */}
              {selectedShare.password?.url && (
                <div className="p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Website URL</span>
                    <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                      {selectedShare.password.url}
                    </p>
                  </div>
                  <a
                    href={selectedShare.password.url.startsWith('http') ? selectedShare.password.url : `https://${selectedShare.password.url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 border border-slate-200 dark:border-slate-700"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>

            {/* Note (if any) */}
            {activeDecrypted?.note && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                <span className="text-[10px] font-bold uppercase text-slate-400">Decrypted Note</span>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{activeDecrypted.note}</p>
              </div>
            )}
          </div>
        ) : (
          /* SHARED ITEMS LIST */
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search shared items or colleagues..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
            </div>

            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-indigo-500" />
                <span>Loading shared items...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center space-y-2 text-slate-400">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-center text-slate-400">
                  <Share2 size={24} />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Shared Passwords</p>
                <p className="text-[11px] text-slate-400">Items shared with you by teammates will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectShare(item)}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer active:scale-98 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ItemServiceIcon name={item.password?.name} type={item.password?.type} size="md" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {item.password?.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate">
                          From: <span className="text-slate-700 dark:text-slate-300 font-semibold">{item.sharedBy?.fullName}</span>
                        </p>
                      </div>
                    </div>

                    <span className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold">
                      View
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
