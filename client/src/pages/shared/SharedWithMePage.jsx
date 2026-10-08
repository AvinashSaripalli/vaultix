import { useEffect, useMemo, useState } from 'react';
import { Eye, ExternalLink, Globe, KeyRound, Search, Share2, User, Folder, ChevronRight } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import AppLayout from '../../components/layout/AppLayout';
import ViewSharedPasswordModal from './ViewSharedPasswordModal';
import ModalPortal from '../../components/common/ModalPortal';
import VerifyMasterPasswordModal from '../../components/security/VerifyMasterPasswordModal';
import { fetchSharedWithMe } from '../../features/sharedPasswords/sharedPasswordsSlice';
import { decryptText, isEncryptedFormat, rsaDecrypt, decryptTextWithAesKey, decryptPrivateKey } from '../../utils/crypto';
import api from '../../services/api';
import { setSessionRsaPrivateKey, setSessionRsaPublicKey } from '../../features/auth/authSlice';

function SharedWithMePage() {
  const dispatch = useDispatch();
  const { sharedWithMe, loading, error } = useSelector(
    (state) => state.sharedPasswords
  );
  const { sessionMasterPassword, sessionRsaPrivateKey, user, token } = useSelector(
    (state) => state.auth
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState(null);
  const [decryptError, setDecryptError] = useState('');
  const [decryptedData, setDecryptedData] = useState({});
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [pendingViewItem, setPendingViewItem] = useState(null);

  useEffect(() => { dispatch(fetchSharedWithMe()); }, [dispatch]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return sharedWithMe.filter((i) =>
      i.password?.name?.toLowerCase().includes(q) ||
      i.password?.login?.toLowerCase().includes(q) ||
      i.password?.url?.toLowerCase().includes(q) ||
      i.sharedBy?.fullName?.toLowerCase().includes(q)
    );
  }, [sharedWithMe, searchTerm]);

  const handleView = (item) => {
    setPendingViewItem(item);
    setReVerifyOpen(true);
  };

  const handleRequestDecrypt = async (item) => {
    const password = item.password;
    const isEncrypted = isEncryptedFormat(password?.encryptedPassword);

    if (!isEncrypted) {
      setDecryptedData((prev) => ({
        ...prev,
        [item.id]: { password: password.encryptedPassword, note: password.encryptedNote || null },
      }));
      return password.encryptedPassword;
    }

    if (!sessionMasterPassword) {
      setPendingViewItem(item);
      setReVerifyOpen(true);
      return null;
    }

    let rsaPrivateKey = sessionRsaPrivateKey;
    if (!rsaPrivateKey && user?.id) {
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
            dispatch(setSessionRsaPublicKey(kpRes.data.publicKey));
          }
        }
      } catch (err) {
        console.error('Key recovery failed:', err);
      }
    }

    if (!rsaPrivateKey && item.encryptedItemKey) {
      setDecryptError('Unable to decrypt. Please verify your master password.');
      return null;
    }

    try {
      setDecryptError('');

      let decrypted, noteText = null;

      if (item.encryptedItemKey && rsaPrivateKey) {
        const aesKeyJwk = await rsaDecrypt(item.encryptedItemKey, rsaPrivateKey);
        const encryptedData = item.reEncryptedPassword || password.encryptedPassword;
        decrypted = await decryptTextWithAesKey(encryptedData, aesKeyJwk);

        if (item.reEncryptedNote || (password.encryptedNote && isEncryptedFormat(password.encryptedNote))) {
          const noteData = item.reEncryptedNote || password.encryptedNote;
          noteText = await decryptTextWithAesKey(noteData, aesKeyJwk);
        }
      } else {
        const ownerSalt = password?.vault?.owner?.encryptionSalt;
        if (!ownerSalt) {
          setDecryptError('Encryption salt not available');
          return null;
        }
        decrypted = await decryptText(password.encryptedPassword, sessionMasterPassword, ownerSalt);

        if (password.encryptedNote && isEncryptedFormat(password.encryptedNote)) {
          noteText = await decryptText(password.encryptedNote, sessionMasterPassword, ownerSalt);
        }
      }

      setDecryptedData((prev) => ({
        ...prev,
        [item.id]: { password: decrypted, note: noteText },
      }));

      api.post(`/passwords/${password.id}/view-log`).catch(() => {});
      return decrypted;
    } catch {
      setDecryptError('Decryption failed. Your master password may be incorrect or the item was not re-encrypted for you.');
      return null;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 dark:bg-indigo-900/20">
            <Share2 size={22} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Shared With Me</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Passwords shared with you by other users</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700">
            <div className="relative max-w-sm">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none dark:text-slate-500" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, login, or shared by..."
                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-50/50 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800 dark:focus:ring-indigo-500/20"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-16">
              <div className="space-y-4 max-w-2xl mx-auto">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-700" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded-lg w-1/3 dark:bg-slate-700" />
                      <div className="h-3 bg-slate-200 rounded-lg w-1/4 dark:bg-slate-700" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="m-5 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">{error}</div>
          ) : filteredItems.length === 0 ? (
            <div className="min-h-[450px] flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-5 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-500">
                <Share2 size={28} />
              </div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                {searchTerm ? 'No matches found' : 'No shared passwords'}
              </h2>
              <p className="text-sm text-slate-500 mt-1.5 max-w-xs dark:text-slate-400">
                {searchTerm ? 'Try a different search term.' : 'Passwords shared with you will appear here.'}
              </p>
            </div>
          ) : (
            <div>
              <div className="hidden lg:grid grid-cols-[2fr_1.2fr_1fr_1.2fr_100px] gap-4 px-6 py-3.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400 sticky top-0 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-500">
                <p>Password</p>
                <p>URL</p>
                <p>Shared By</p>
                <p>Location</p>
                <p className="text-center">Action</p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredItems.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 lg:grid-cols-[2fr_1.2fr_1fr_1.2fr_100px] gap-4 items-center px-6 py-4.5 hover:bg-slate-50 transition-colors group dark:hover:bg-slate-700">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors dark:bg-indigo-900/20 dark:text-indigo-400">
                        <KeyRound size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-200">{item.password?.name}</p>
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5 dark:text-slate-400">
                          <User size={11} />
                          {item.password?.login || 'No login'}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="lg:hidden text-xs font-medium text-slate-400 mb-1 dark:text-slate-500">URL</p>
                      {item.password?.url ? (
                        <a href={item.password.url.startsWith('http') ? item.password.url : `https://${item.password.url}`} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate flex items-center gap-1.5">
                          <Globe size={13} className="shrink-0" />
                          <span className="truncate">{item.password.url}</span>
                          <ExternalLink size={11} className="shrink-0 opacity-60" />
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400 truncate flex items-center gap-1.5 dark:text-slate-500">
                          <Globe size={13} className="shrink-0" />
                          No URL
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="lg:hidden text-xs font-medium text-slate-400 mb-1 dark:text-slate-500">Shared By</p>
                      <p className="text-sm font-medium text-slate-700 truncate dark:text-slate-300">{item.sharedBy?.fullName || '-'}</p>
                    </div>

                    <div className="min-w-0">
                      <p className="lg:hidden text-xs font-medium text-slate-400 mb-1 dark:text-slate-500">Location</p>
                      <p className="text-sm text-slate-600 truncate flex items-center gap-1 dark:text-slate-300">
                        <Folder size={13} className="text-slate-400 shrink-0 dark:text-slate-500" />
                        <span className="truncate">{item.password?.vault?.name || '-'}</span>
                        <ChevronRight size={10} className="text-slate-300 shrink-0" />
                        <span className="truncate">{item.password?.folder?.name || '-'}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => handleView(item)}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 text-white px-3.5 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {decryptError && (
          <ModalPortal open={!!decryptError} onClose={() => setDecryptError('')}>
            <div
              className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setDecryptError('')}
            >
              <div
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl dark:bg-slate-800 my-auto"
                onClick={(e) => e.stopPropagation()}
              >
              <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Decryption Error</h2>
              </div>
              <div className="px-6 py-5">
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">{decryptError}</div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                  This password may not have been re-encrypted for your key pair. Ask the sender to share it again.
                </p>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex justify-end dark:bg-slate-800/50 dark:border-slate-700">
                <button
                  onClick={() => setDecryptError('')}
                  className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Close
                </button>
              </div>
            </div>
            </div>
          </ModalPortal>
        )}

        <ViewSharedPasswordModal
          open={viewOpen}
          item={selectedShare}
          decryptedData={decryptedData[selectedShare?.id]}
          onClose={() => { setViewOpen(false); setSelectedShare(null); }}
        />

        <VerifyMasterPasswordModal
          open={reVerifyOpen}
          onClose={() => {
            setReVerifyOpen(false);
            setPendingViewItem(null);
          }}
          onVerified={async () => {
            setReVerifyOpen(false);
            const itemToView = pendingViewItem;
            setPendingViewItem(null);
            if (itemToView) {
              const decrypted = await handleRequestDecrypt(itemToView);
              if (decrypted) {
                setSelectedShare(itemToView);
                setViewOpen(true);
              }
            }
          }}
        />
      </div>
    </AppLayout>
  );
}

export default SharedWithMePage;
