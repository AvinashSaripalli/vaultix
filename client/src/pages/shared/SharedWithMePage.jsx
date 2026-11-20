import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Share2,
  ChevronLeft,
  ChevronRight,
  User,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import AppLayout from '../../components/layout/AppLayout';
import SharedItemDetailsPanel from './SharedItemDetailsPanel';
import ModalPortal, { ModalBackdrop } from '../../components/common/ModalPortal';
import ConfirmModal from '../../components/common/ConfirmModal';
import VerifyMasterPasswordModal from '../../components/security/VerifyMasterPasswordModal';
import ItemServiceIcon from '../../components/common/ItemServiceIcon';
import ItemTypeBadge from '../../components/myVault/ItemTypeBadge';
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
import { getItemTypeMeta } from '../../utils/itemTypes';
import { secureCopyText } from '../../utils/clipboard';
import { showToast } from '../../utils/toast';
import { hapticLight } from '../../utils/haptics';
import api from '../../services/api';
import { setSessionRsaPrivateKey, setSessionRsaPublicKey } from '../../features/auth/authSlice';

function getPaginationItems(current, total) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 'ellipsis-end', total];
  }
  if (current >= total - 2) {
    return [1, 'ellipsis-start', total - 2, total - 1, total];
  }
  return [1, 'ellipsis-start', current - 1, current, current + 1, 'ellipsis-end', total];
}

function SharedWithMePage() {
  const dispatch = useDispatch();
  const { sharedWithMe, loading, error } = useSelector((state) => state.sharedPasswords);
  const { sessionMasterPassword, sessionRsaPrivateKey, user, token } = useSelector(
    (state) => state.auth
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShareId, setSelectedShareId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [decryptedData, setDecryptedData] = useState({});
  const [decryptingId, setDecryptingId] = useState(null);
  const [decryptError, setDecryptError] = useState('');
  const [reVerifyOpen, setReVerifyOpen] = useState(false);
  const [pendingActionItem, setPendingActionItem] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState({ open: false, item: null, loading: false });

  useEffect(() => {
    dispatch(fetchSharedWithMe());
  }, [dispatch]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return sharedWithMe.filter((i) => {
      if (!q) return true;
      return (
        i.password?.name?.toLowerCase().includes(q) ||
        i.password?.login?.toLowerCase().includes(q) ||
        i.password?.url?.toLowerCase().includes(q) ||
        i.sharedBy?.fullName?.toLowerCase().includes(q) ||
        i.sharedBy?.email?.toLowerCase().includes(q)
      );
    });
  }, [sharedWithMe, searchTerm]);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalItems = filteredItems.length;
  const isAll = pageSize === 'all';
  const effectivePageSize = isAll ? Math.max(totalItems, 1) : Number(pageSize);
  const totalPages = Math.ceil(totalItems / effectivePageSize) || 1;
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);

  const startIndex = (validPage - 1) * effectivePageSize;
  const endIndex = isAll ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, startIndex, endIndex]);

  // Maintain valid selection
  useEffect(() => {
    if (paginatedItems.length > 0) {
      const exists = paginatedItems.some((i) => i.id === selectedShareId);
      if (!exists && window.innerWidth >= 1280) {
        setSelectedShareId(paginatedItems[0].id);
      }
    } else {
      setSelectedShareId(null);
    }
  }, [paginatedItems, selectedShareId]);

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

        {/* Main Workspace (Identical Company Vault Split Grid) */}
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
            <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] 2xl:grid-cols-[340px_1fr] min-h-[640px] divide-y xl:divide-y-0 xl:divide-x divide-slate-200 dark:divide-slate-700 min-w-0">
              
              {/* Left Side: PasswordListPanel Style (Company Vault Exact Match) */}
              <div className={`min-w-0 ${selectedShareId ? 'hidden xl:block' : 'block'}`}>
                <div className="bg-white p-3 sm:p-4 border-r border-slate-200 dark:bg-slate-800 dark:border-slate-700 flex flex-col justify-between min-h-[640px] h-full min-w-0">
                  <div>
                    {/* Search items... input */}
                    <div className="relative mb-3">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 pl-8.5 pr-3 text-xs sm:text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-100"
                      />
                    </div>

                    {/* NAME (totalItems) Header */}
                    <div className="flex items-center justify-between mb-2 px-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span>NAME</span>
                        <span className="text-slate-400 dark:text-slate-500 font-semibold normal-case">
                          ({totalItems})
                        </span>
                      </div>
                      {totalItems > 0 && !isAll && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal lowercase">
                          {startIndex + 1}–{endIndex} of {totalItems}
                        </span>
                      )}
                    </div>

                    {/* Items List (Card buttons matching Company Vault) */}
                    <div className="space-y-2">
                      {paginatedItems.map((item) => {
                        const active = item.id === selectedShareId;
                        const pwd = item.password || {};
                        const meta = getItemTypeMeta(pwd?.type);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              hapticLight();
                              handleSelectShare(item);
                            }}
                            className={`w-full text-left p-2.5 sm:px-3 sm:py-2.5 rounded-xl border transition-all active:scale-[0.99] flex items-center gap-3 min-w-0 ${
                              active
                                ? 'bg-indigo-50/90 border-indigo-200 shadow-sm dark:bg-indigo-900/25 dark:border-indigo-800'
                                : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/80 dark:bg-slate-800 dark:border-slate-700/80 dark:hover:border-slate-600 dark:hover:bg-slate-700/60 shadow-xs'
                            }`}
                          >
                            <ItemServiceIcon name={pwd.name} type={pwd.type} size="sm" />

                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {pwd.name || 'Untitled'}
                              </div>

                              <div className="flex items-center gap-1.5 mt-1 min-w-0 flex-wrap">
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate min-w-0 max-w-[130px]">
                                  {pwd.login || meta.label}
                                </span>

                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 truncate max-w-[100px] shrink-0"
                                  title={`Shared by ${item.sharedBy?.fullName || 'User'}`}
                                >
                                  <User size={9} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span className="truncate">{item.sharedBy?.fullName || 'User'}</span>
                                </span>

                                <ItemTypeBadge type={pwd.type} size="xs" />
                              </div>
                            </div>

                            <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 shrink-0" />
                          </button>
                        );
                      })}

                      {!filteredItems.length && (
                        <p className="text-slate-500 text-sm py-8 text-center dark:text-slate-400">No items found.</p>
                      )}
                    </div>
                  </div>

                  {/* Pagination Bar (Matching Company Vault) */}
                  {totalPages > 1 && !isAll && (
                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1 select-none">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={validPage === 1}
                        aria-label="Previous page"
                        title="Previous page"
                        className="h-8 px-2 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition shrink-0"
                      >
                        <ChevronLeft size={14} />
                        <span className="hidden sm:inline">Prev</span>
                      </button>

                      <div className="flex items-center gap-1 min-w-0 justify-center overflow-hidden">
                        {getPaginationItems(validPage, totalPages).map((pItem, idx) => {
                          if (typeof pItem === 'string') {
                            return (
                              <span
                                key={`ellipsis-${idx}`}
                                className="h-8 w-4 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium select-none shrink-0"
                              >
                                …
                              </span>
                            );
                          }

                          const isActive = pItem === validPage;
                          return (
                            <button
                              key={pItem}
                              type="button"
                              onClick={() => setCurrentPage(pItem)}
                              aria-label={`Page ${pItem}`}
                              aria-current={isActive ? 'page' : undefined}
                              className={`h-8 min-w-[32px] px-1.5 rounded-lg text-xs font-semibold transition shrink-0 flex items-center justify-center ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {pItem}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={validPage === totalPages}
                        aria-label="Next page"
                        title="Next page"
                        className="h-8 px-2 sm:px-2.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 transition shrink-0"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: PasswordDetailsPanel Style */}
              <div className={`min-w-0 ${!selectedShareId ? 'hidden xl:block' : 'block'}`}>
                <div className="p-4 sm:p-6 lg:p-7 bg-white dark:bg-slate-800 min-h-[640px]">
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
