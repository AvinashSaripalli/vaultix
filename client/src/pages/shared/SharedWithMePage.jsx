import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Share2,
  Clock,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  Filter,
  Trash2,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import AppLayout from '../../components/layout/AppLayout';
import SharedItemDetailsPanel from './SharedItemDetailsPanel';
import ModalPortal, { ModalBackdrop } from '../../components/common/ModalPortal';
import ConfirmModal from '../../components/common/ConfirmModal';
import VerifyMasterPasswordModal from '../../components/security/VerifyMasterPasswordModal';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import { fetchSharedWithMe, removePasswordShare } from '../../features/sharedPasswords/sharedPasswordsSlice';
import {
  decryptText,
  decryptFields,
  isEncryptedFormat,
  rsaDecrypt,
  decryptTextWithAesKey,
  decryptFieldsWithAesKey,
  decryptPrivateKey,
} from '../../utils/crypto';
import { secureCopyText } from '../../utils/clipboard';
import { showToast } from '../../utils/toast';
import api from '../../services/api';
import { setSessionRsaPrivateKey, setSessionRsaPublicKey } from '../../features/auth/authSlice';

function SharedWithMePage() {
  const dispatch = useDispatch();
  const { sharedWithMe, loading, error } = useSelector((state) => state.sharedPasswords);
  const { sessionMasterPassword, sessionRsaPrivateKey, user, token } = useSelector(
    (state) => state.auth
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedShareId, setSelectedShareId] = useState(null);
  const [decryptedData, setDecryptedData] = useState({});
  const [decryptingId, setDecryptingId] = useState(null);
  const [decryptError, setDecryptError] = useState('');
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [pendingActionItem, setPendingActionItem] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState({ open: false, item: null, loading: false });

  useEffect(() => {
    dispatch(fetchSharedWithMe());
  }, [dispatch]);

  // Distinct types for filter chips
  const typeCounts = useMemo(() => {
    const counts = { ALL: sharedWithMe.length };
    sharedWithMe.forEach((i) => {
      const t = i.password?.type || 'LOGIN';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [sharedWithMe]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return sharedWithMe.filter((i) => {
      const itemType = i.password?.type || 'LOGIN';
      if (selectedType !== 'ALL' && itemType !== selectedType) {
        return false;
      }
      if (!q) return true;
      return (
        i.password?.name?.toLowerCase().includes(q) ||
        i.password?.login?.toLowerCase().includes(q) ||
        i.password?.url?.toLowerCase().includes(q) ||
        i.sharedBy?.fullName?.toLowerCase().includes(q) ||
        i.sharedBy?.email?.toLowerCase().includes(q)
      );
    });
  }, [sharedWithMe, searchTerm, selectedType]);

  // Keep a valid item selected if available
  useEffect(() => {
    if (filteredItems.length > 0) {
      const exists = filteredItems.some((i) => i.id === selectedShareId);
      if (!exists && window.innerWidth >= 1024) {
        setSelectedShareId(filteredItems[0].id);
      }
    } else {
      setSelectedShareId(null);
    }
  }, [filteredItems, selectedShareId]);

  const selectedShare = useMemo(() => {
    return sharedWithMe.find((i) => i.id === selectedShareId) || null;
  }, [sharedWithMe, selectedShareId]);

  const handleRequestDecrypt = async (item) => {
    if (!item) return false;
    if (decryptedData[item.id]) return true;

    const password = item.password;
    const isEncrypted =
      Boolean(item.encryptedItemKey) ||
      isEncryptedFormat(password?.encryptedPassword) ||
      isEncryptedFormat(password?.encryptedNote) ||
      Boolean(password?.encryptedFields);

    if (!isEncrypted) {
      setDecryptedData((prev) => ({
        ...prev,
        [item.id]: {
          password: password?.encryptedPassword || '',
          note: password?.encryptedNote || null,
          fields: null,
        },
      }));
      return true;
    }

    if (!sessionMasterPassword) {
      setPendingActionItem(item);
      setReVerifyOpen(true);
      return false;
    }

    setDecryptingId(item.id);

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
      setDecryptingId(null);
      return false;
    }

    try {
      setDecryptError('');

      let decrypted = '';
      let noteText = null;
      let fieldsObj = null;

      if (item.encryptedItemKey && rsaPrivateKey) {
        const aesKeyJwk = await rsaDecrypt(item.encryptedItemKey, rsaPrivateKey);
        const encryptedData = item.reEncryptedPassword || password?.encryptedPassword;
        if (encryptedData) {
          decrypted = await decryptTextWithAesKey(encryptedData, aesKeyJwk);
        }

        if (item.reEncryptedNote || (password?.encryptedNote && isEncryptedFormat(password.encryptedNote))) {
          const noteData = item.reEncryptedNote || password.encryptedNote;
          noteText = await decryptTextWithAesKey(noteData, aesKeyJwk);
        }

        if (item.reEncryptedFields || password?.encryptedFields) {
          const fieldsData = item.reEncryptedFields || password.encryptedFields;
          fieldsObj = await decryptFieldsWithAesKey(fieldsData, aesKeyJwk);
        }
      } else {
        const ownerSalt = password?.vault?.owner?.encryptionSalt;
        if (!ownerSalt) {
          setDecryptError('Encryption salt not available');
          setDecryptingId(null);
          return false;
        }
        if (password?.encryptedPassword) {
          decrypted = await decryptText(password.encryptedPassword, sessionMasterPassword, ownerSalt);
        }

        if (password?.encryptedNote && isEncryptedFormat(password.encryptedNote)) {
          noteText = await decryptText(password.encryptedNote, sessionMasterPassword, ownerSalt);
        }

        if (password?.encryptedFields) {
          fieldsObj = await decryptFields(password.encryptedFields, sessionMasterPassword, ownerSalt);
        }
      }

      setDecryptedData((prev) => ({
        ...prev,
        [item.id]: { password: decrypted || '', note: noteText, fields: fieldsObj },
      }));

      api.post(`/passwords/${password.id}/view-log`).catch(() => {});
      setDecryptingId(null);
      return true;
    } catch {
      setDecryptError('Decryption failed. Your master password may be incorrect or the item was not re-encrypted for you.');
      setDecryptingId(null);
      return false;
    }
  };

  const handleSelectShare = (item) => {
    setSelectedShareId(item.id);
    if (sessionMasterPassword && !decryptedData[item.id]) {
      handleRequestDecrypt(item);
    }
  };

  const handleCopy = (value, label = 'Item') => {
    if (!value) return;
    secureCopyText(value, `${label} copied to clipboard`);
    if (selectedShare?.password?.id) {
      api.post(`/passwords/${selectedShare.password.id}/copy-log`, { fieldName: label }).catch(() => {});
    }
  };

  const handleConfirmLeave = async () => {
    const item = confirmLeave.item;
    if (!item) return;
    setConfirmLeave((prev) => ({ ...prev, loading: true }));
    try {
      await dispatch(removePasswordShare(item.id)).unwrap();
      showToast('Successfully removed from your shared passwords', 'success');
      setConfirmLeave({ open: false, item: null, loading: false });
      if (selectedShareId === item.id) {
        setSelectedShareId(null);
      }
    } catch (err) {
      showToast(err || 'Failed to leave share', 'error');
      setConfirmLeave((prev) => ({ ...prev, loading: false }));
    }
  };

  const formatRelativeDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now - d;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5 sm:space-y-6 min-w-0">
        
        {/* Top Header Card */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 dark:bg-indigo-900/30 dark:border-indigo-800">
                <Share2 size={22} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                    Shared With Me
                  </h1>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                    {sharedWithMe.length} {sharedWithMe.length === 1 ? 'Credential' : 'Credentials'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Credentials securely shared with you by teammates • Zero-knowledge encrypted
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Master-Detail Split Workspace */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700 min-w-0">
          
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
            <div className="m-5 rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          ) : sharedWithMe.length === 0 ? (
            <div className="min-h-[480px] flex flex-col items-center justify-center text-center px-6">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-4 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-400">
                <Share2 size={28} />
              </div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                No shared credentials yet
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm dark:text-slate-400 leading-relaxed">
                When other team members share a password, card, or note with your account, it will appear here securely encrypted for your key pair.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] min-h-[580px] divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-700 min-w-0">
              
              {/* Left Pane (Master List) */}
              <div
                className={`${
                  selectedShare ? 'hidden lg:flex' : 'flex'
                } flex-col p-3.5 sm:p-4 bg-slate-50/50 dark:bg-slate-800/40 min-w-0`}
              >
                {/* Search Bar */}
                <div className="relative mb-3">
                  <Search
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
                  />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, login, or sender..."
                    className="w-full h-9 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-2 scrollbar-none text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedType('ALL')}
                    className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition ${
                      selectedType === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                    }`}
                  >
                    All ({typeCounts.ALL})
                  </button>
                  {Object.keys(typeCounts)
                    .filter((k) => k !== 'ALL' && typeCounts[k] > 0)
                    .map((typeKey) => (
                      <button
                        key={typeKey}
                        type="button"
                        onClick={() => setSelectedType(typeKey)}
                        className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition uppercase text-[10px] tracking-wider ${
                          selectedType === typeKey
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                        }`}
                      >
                        {typeKey} ({typeCounts[typeKey]})
                      </button>
                    ))}
                </div>

                {/* List of Shared Items */}
                <div className="space-y-1.5 overflow-y-auto flex-1 pr-1 max-h-[calc(100vh-320px)] lg:max-h-[600px]">
                  {filteredItems.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
                      No matches found.
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = item.id === selectedShareId;
                      const pwd = item.password || {};
                      const itemType = pwd.type || 'LOGIN';
                      const senderInitial = (item.sharedBy?.fullName?.[0] || 'U').toUpperCase();

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectShare(item)}
                          className={`p-3 rounded-xl cursor-pointer transition flex flex-col gap-2 min-w-0 ${
                            isSelected
                              ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-l-4 border-indigo-600 dark:border-indigo-500 shadow-xs'
                              : 'hover:bg-slate-100/70 dark:hover:bg-slate-750/60 border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2.5 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ItemServiceIcon name={pwd.name} type={itemType} size="sm" />
                              <div className="min-w-0">
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {pwd.name || 'Untitled'}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {pwd.login || (pwd.url ? pwd.url : 'No login')}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-600">
                              Read Only
                            </span>
                          </div>

                          {/* Footer Sender Meta */}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-[9px] font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                                {senderInitial}
                              </span>
                              <span className="truncate">
                                Shared by <strong className="font-semibold text-slate-700 dark:text-slate-300">{item.sharedBy?.fullName || 'Teammate'}</strong>
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                              {formatRelativeDate(item.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Pane (Detail Panel) */}
              <div
                className={`${
                  !selectedShare ? 'hidden lg:flex' : 'flex'
                } flex-col p-4 sm:p-6 lg:p-7 min-w-0 bg-white dark:bg-slate-800`}
              >
                <SharedItemDetailsPanel
                  item={selectedShare}
                  decrypted={selectedShare ? decryptedData[selectedShare.id] : null}
                  isDecrypting={decryptingId === selectedShare?.id}
                  onCopy={handleCopy}
                  onLeaveShare={(item) => setConfirmLeave({ open: true, item, loading: false })}
                  onBack={() => setSelectedShareId(null)}
                  onRequestDecrypt={handleRequestDecrypt}
                />
              </div>

            </div>
          )}
        </div>

        {/* Leave Share Confirmation Modal */}
        <ConfirmModal
          open={confirmLeave.open}
          title="Leave Shared Password"
          message={`Are you sure you want to remove "${confirmLeave.item?.password?.name}" from your shared list? You will no longer have access to this credential unless re-shared.`}
          confirmLabel="Leave Share"
          cancelLabel="Keep Access"
          loading={confirmLeave.loading}
          onConfirm={handleConfirmLeave}
          onCancel={() => setConfirmLeave({ open: false, item: null, loading: false })}
        />

        {/* Decryption Error Modal */}
        {decryptError && (
          <ModalPortal open={!!decryptError} onClose={() => setDecryptError('')}>
            <ModalBackdrop onClose={() => setDecryptError('')}>
              <div
                className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 my-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Decryption Failed</h2>
                </div>
                <div className="px-6 py-5">
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                    {decryptError}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                    This password could not be decrypted. It may not have been re-encrypted with your active RSA public key. Ask the sender to re-share the password.
                  </p>
                </div>
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex justify-end dark:bg-slate-800/50 dark:border-slate-700">
                  <button
                    onClick={() => setDecryptError('')}
                    className="h-9 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </ModalBackdrop>
          </ModalPortal>
        )}

        {/* Master Password Verification Modal */}
        <VerifyMasterPasswordModal
          open={reVerifyOpen}
          onClose={() => {
            setReVerifyOpen(false);
            setPendingActionItem(null);
          }}
          onVerified={async () => {
            setReVerifyOpen(false);
            const itemToDecrypt = pendingActionItem || selectedShare;
            setPendingActionItem(null);
            if (itemToDecrypt) {
              await handleRequestDecrypt(itemToDecrypt);
            }
          }}
        />

      </div>
    </AppLayout>
  );
}

export default SharedWithMePage;
