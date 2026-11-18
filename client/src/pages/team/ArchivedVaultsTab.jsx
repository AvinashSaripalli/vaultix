import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Archive,
  Building2,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  ShieldCheck,
  Folder,
  Lock,
  ArrowRight,
  Loader2,
  Check,
  AlertCircle,
  FolderArchive,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';
import { showToast } from '../../utils/toast';
import ModalPortal, { ModalBackdrop } from '../../components/common/ModalPortal';
import ConfirmModal from '../../components/common/ConfirmModal';
import {
  unwrapItemKey,
  decryptTextWithAesKey,
  decryptFieldsWithAesKey,
  generateItemAesKey,
  encryptValueWithAesKey,
  encryptFieldsWithAesKey,
} from '../../utils/crypto';
import { getWrapRecipients, wrapItemKeysForUsers } from '../../utils/keyWrapping';
import { secureCopyText } from '../../utils/clipboard';
import { fetchVaults } from '../../features/vault/vaultSlice';

export default function ArchivedVaultsTab({ onCountChange }) {
  const { user, sessionRsaPrivateKey } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  const [archivedVaults, setArchivedVaults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals state
  const [reviewVault, setReviewVault] = useState(null);
  const [transferVault, setTransferVault] = useState(null);
  const [purgeVault, setPurgeVault] = useState(null);
  const [purging, setPurging] = useState(false);

  // Transfer all state
  const [companyVaults, setCompanyVaults] = useState([]);
  const [targetVaultId, setTargetVaultId] = useState('');
  const [targetFolders, setTargetFolders] = useState([]);
  const [targetFolderId, setTargetFolderId] = useState('');
  const [transferring, setTransferring] = useState(false);

  const fetchArchivedVaults = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/vaults/archived');
      setArchivedVaults(res.data || []);
      onCountChange?.((res.data || []).length);
    } catch (err) {
      console.error('Failed to fetch archived vaults:', err);
      setError(err.response?.data?.message || 'Failed to load archived vaults');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedVaults();
  }, []);

  // Fetch company vaults for transfer
  useEffect(() => {
    if (!transferVault) return;
    setTargetVaultId('');
    setTargetFolderId('');
    setTargetFolders([]);

    const loadCompanyVaults = async () => {
      try {
        const res = await api.get('/vaults');
        const active = (res.data || []).filter((v) => v.type !== 'PERSONAL' && !v.name.startsWith('Archived Vault -'));
        setCompanyVaults(active);
        if (active.length > 0) {
          setTargetVaultId(active[0].id);
        }
      } catch (err) {
        console.error('Failed to load company vaults:', err);
      }
    };

    loadCompanyVaults();
  }, [transferVault]);

  // Fetch folders for selected target vault
  useEffect(() => {
    if (!targetVaultId) {
      setTargetFolders([]);
      setTargetFolderId('');
      return;
    }

    const loadFolders = async () => {
      try {
        const res = await api.get(`/folders/vault/${targetVaultId}`);
        const active = (res.data || []).filter((f) => !f.deletedAt);
        setTargetFolders(active);
        if (active.length > 0) {
          setTargetFolderId(active[0].id);
        } else {
          setTargetFolderId('');
        }
      } catch (err) {
        console.error('Failed to load folders:', err);
        setTargetFolders([]);
        setTargetFolderId('');
      }
    };

    loadFolders();
  }, [targetVaultId]);

  const handleConfirmPurge = async () => {
    if (!purgeVault) return;

    try {
      setPurging(true);
      await api.delete(`/vaults/archived/${purgeVault.id}`);
      showToast('Archived vault permanently deleted', 'success');
      setArchivedVaults((prev) => prev.filter((v) => v.id !== purgeVault.id));
      onCountChange?.(archivedVaults.length - 1);
      dispatch(fetchVaults());
      setPurgeVault(null);
    } catch (err) {
      console.error('Failed to purge archived vault:', err);
      showToast(err.response?.data?.message || 'Failed to delete archive', 'error');
    } finally {
      setPurging(false);
    }
  };

  const handleTransferAll = async () => {
    if (!transferVault || !targetFolderId) return;

    try {
      setTransferring(true);

      // Decrypt and rewrap all passwords in the archived vault for the target folder
      const rewrappedPasswords = [];
      const recipientIds = await getWrapRecipients(targetFolderId, user?.id);

      for (const pw of transferVault.passwords || []) {
        let plainPassword = '';
        let plainNote = '';
        let plainFields = {};

        if (pw.myWrappedKey && sessionRsaPrivateKey) {
          try {
            const keyJwk = await unwrapItemKey(pw.myWrappedKey, sessionRsaPrivateKey);
            if (keyJwk) {
              plainPassword = pw.encryptedPassword
                ? await decryptTextWithAesKey(pw.encryptedPassword, keyJwk)
                : '';
              plainNote = pw.encryptedNote
                ? await decryptTextWithAesKey(pw.encryptedNote, keyJwk)
                : '';
              plainFields = pw.encryptedFields
                ? (await decryptFieldsWithAesKey(pw.encryptedFields, keyJwk)) || {}
                : {};
            }
          } catch (e) {
            console.warn('Failed to unwrap password for batch transfer:', e);
          }
        }

        const { aesKeyJwk } = await generateItemAesKey();
        const encryptedPassword = plainPassword ? await encryptValueWithAesKey(plainPassword, aesKeyJwk) : '';
        const encryptedNote = plainNote ? await encryptValueWithAesKey(plainNote, aesKeyJwk) : '';
        const encryptedFields = await encryptFieldsWithAesKey(plainFields, aesKeyJwk);
        const wrappedKeys = await wrapItemKeysForUsers(aesKeyJwk, recipientIds);

        rewrappedPasswords.push({
          id: pw.id,
          encryptedPassword,
          encryptedNote,
          encryptedFields,
          wrappedKeys,
        });
      }

      await api.post(`/vaults/archived/${transferVault.id}/transfer-all`, {
        targetFolderId,
        rewrappedPasswords,
      });

      showToast(`All passwords transferred to Company Vault successfully!`, 'success');
      setArchivedVaults((prev) => prev.filter((v) => v.id !== transferVault.id));
      onCountChange?.(archivedVaults.length - 1);
      dispatch(fetchVaults());
      setTransferVault(null);
    } catch (err) {
      console.error('Transfer all failed:', err);
      showToast(err.response?.data?.message || 'Transfer failed. Please try again.', 'error');
    } finally {
      setTransferring(false);
    }
  };

  const getCleanUserName = (vaultName) => {
    return vaultName.replace(/^Archived Vault -\s*/i, '').trim();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-950 dark:text-slate-100 flex items-center gap-2.5">
            <FolderArchive className="text-indigo-600 dark:text-indigo-400" size={24} />
            Archived Personal Vaults
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Personal vaults of deleted users preserved safely for company asset recovery.
          </p>
        </div>

        <button
          onClick={fetchArchivedVaults}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          <Loader2 className="animate-spin inline-block mr-2" size={16} /> Loading archived vaults...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && archivedVaults.length === 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            <Archive size={24} />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
            No Archived Vaults
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            When you delete an employee account, their personal credentials are automatically rescued and archived here so your company never loses access.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {archivedVaults.map((vault) => {
          const userName = getCleanUserName(vault.name);
          const count = vault.itemCount || (vault.passwords || []).length;
          const createdDate = new Date(vault.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          return (
            <div
              key={vault.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <FolderArchive size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {userName}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                        {count} {count === 1 ? 'password' : 'passwords'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Archived on {createdDate} • ID: <code className="text-[11px] font-mono">{vault.id}</code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <button
                    onClick={() => setReviewVault(vault)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition"
                    title="Review and decrypt passwords"
                  >
                    <Eye size={15} />
                    Review Passwords
                  </button>

                  <button
                    onClick={() => setTransferVault(vault)}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition"
                    title="Move all passwords to a company folder"
                  >
                    <Building2 size={15} />
                    Move to Company Vault
                  </button>

                  <button
                    onClick={() => setPurgeVault(vault)}
                    className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-800/60 dark:text-red-400 dark:hover:bg-red-900/20 transition"
                    title="Purge archive permanently"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Password items quick preview list */}
              {vault.passwords && vault.passwords.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-750 flex flex-wrap gap-2">
                  {vault.passwords.slice(0, 4).map((pw) => (
                    <span
                      key={pw.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-xs text-slate-700 dark:text-slate-300 font-medium"
                    >
                      <Lock size={12} className="text-slate-400" />
                      {pw.name}
                      {pw.login && <span className="text-slate-400 text-[11px]">({pw.login})</span>}
                    </span>
                  ))}
                  {vault.passwords.length > 4 && (
                    <span className="text-xs text-slate-400 self-center">
                      +{vault.passwords.length - 4} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Review Passwords Modal */}
      {reviewVault && (
        <ReviewArchivedPasswordsModal
          vault={reviewVault}
          sessionRsaPrivateKey={sessionRsaPrivateKey}
          onClose={() => setReviewVault(null)}
          onItemTransferred={fetchArchivedVaults}
        />
      )}

      {/* Move All to Company Vault Modal */}
      {transferVault && (
        <ModalPortal open={!!transferVault} onClose={() => setTransferVault(null)}>
          <ModalBackdrop onClose={() => setTransferVault(null)} disableBackdropClick={true}>
            <div
              className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Move All to Company Vault
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Batch transfer all {transferVault.passwords?.length || 0} passwords from {getCleanUserName(transferVault.name)} to a team folder.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Company Vault
                  </label>
                  <select
                    value={targetVaultId}
                    onChange={(e) => setTargetVaultId(e.target.value)}
                    disabled={transferring}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  >
                    {companyVaults.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Folder
                  </label>
                  {targetFolders.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      This vault has no active folders. Please create a folder in the target vault first.
                    </p>
                  ) : (
                    <select
                      value={targetFolderId}
                      onChange={(e) => setTargetFolderId(e.target.value)}
                      disabled={transferring}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                    >
                      {targetFolders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end items-center gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setTransferVault(null)}
                  disabled={transferring}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTransferAll}
                  disabled={transferring || !targetFolderId}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition flex items-center gap-2 shadow-sm"
                >
                  {transferring ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Re-encrypting & Transferring...
                    </>
                  ) : (
                    <>
                      <ArrowRight size={14} />
                      Transfer All
                    </>
                  )}
                </button>
              </div>
            </div>
          </ModalBackdrop>
        </ModalPortal>
      )}

      {/* Purge Confirm Modal */}
      {purgeVault && (
        <ConfirmModal
          open={!!purgeVault}
          title={`Purge Archive: ${getCleanUserName(purgeVault.name)}`}
          message={`Are you sure you want to permanently delete this archived vault and all ${purgeVault.passwords?.length || 0} passwords inside it? This cannot be undone.`}
          confirmLabel={purging ? 'Purging...' : 'Purge Archive'}
          onConfirm={handleConfirmPurge}
          onCancel={() => setPurgeVault(null)}
        />
      )}
    </div>
  );
}

// Modal for reviewing & decrypting individual passwords
function ReviewArchivedPasswordsModal({ vault, sessionRsaPrivateKey, onClose }) {
  const [decryptedMap, setDecryptedMap] = useState({});
  const [revealedPwMap, setRevealedPwMap] = useState({});
  const [decryptingId, setDecryptingId] = useState(null);

  const decryptItem = async (pw) => {
    if (decryptedMap[pw.id]) return;

    if (!pw.myWrappedKey || !sessionRsaPrivateKey) {
      showToast('No decryption escrow key found for this item.', 'error');
      return;
    }

    try {
      setDecryptingId(pw.id);
      const keyJwk = await unwrapItemKey(pw.myWrappedKey, sessionRsaPrivateKey);
      if (keyJwk) {
        const plainPassword = pw.encryptedPassword
          ? await decryptTextWithAesKey(pw.encryptedPassword, keyJwk)
          : '';
        const plainNote = pw.encryptedNote
          ? await decryptTextWithAesKey(pw.encryptedNote, keyJwk)
          : '';
        const plainFields = pw.encryptedFields
          ? await decryptFieldsWithAesKey(pw.encryptedFields, keyJwk)
          : {};

        setDecryptedMap((prev) => ({
          ...prev,
          [pw.id]: {
            password: plainPassword,
            note: plainNote,
            fields: plainFields,
          },
        }));
      }
    } catch (err) {
      console.error('Failed to decrypt archived password:', err);
      showToast('Decryption failed. Super Admin key could not unwrap this item.', 'error');
    } finally {
      setDecryptingId(null);
    }
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    secureCopyText(text);
    showToast(`${label} copied to clipboard`);
  };

  return (
    <ModalPortal open={true} onClose={onClose}>
      <ModalBackdrop onClose={onClose} disableBackdropClick={true}>
        <div
          className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-6 overflow-hidden max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Archived Passwords: {vault.name.replace(/^Archived Vault -\s*/i, '')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {vault.passwords?.length || 0} credentials left behind by this offboarded user.
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg"
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto flex-1 py-4 space-y-3">
            {(!vault.passwords || vault.passwords.length === 0) ? (
              <p className="text-sm text-slate-500 text-center py-6">No passwords found in this archive.</p>
            ) : (
              vault.passwords.map((pw) => {
                const dec = decryptedMap[pw.id];
                const isRevealed = revealedPwMap[pw.id];

                return (
                  <div
                    key={pw.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-750/50 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock size={16} className="text-indigo-600 dark:text-indigo-400" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{pw.name}</h4>
                        {pw.type && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                            {pw.type}
                          </span>
                        )}
                      </div>

                      {!dec && (
                        <button
                          onClick={() => decryptItem(pw)}
                          disabled={decryptingId === pw.id}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-sm"
                        >
                          {decryptingId === pw.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Eye size={13} />
                          )}
                          Decrypt Password
                        </button>
                      )}
                    </div>

                    {pw.login && (
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                        <span>Username / Email: <code className="font-mono">{pw.login}</code></span>
                        <button
                          onClick={() => handleCopy(pw.login, 'Username')}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          title="Copy username"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    )}

                    {dec && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Password:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-900 dark:text-slate-100 font-semibold">
                              {isRevealed ? dec.password || '(empty)' : '••••••••••••'}
                            </span>
                            <button
                              onClick={() => setRevealedPwMap((prev) => ({ ...prev, [pw.id]: !prev[pw.id] }))}
                              className="p-1 text-slate-400 hover:text-slate-600"
                              title={isRevealed ? 'Hide' : 'Show'}
                            >
                              {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button
                              onClick={() => handleCopy(dec.password, 'Password')}
                              className="p-1 text-slate-400 hover:text-slate-600"
                              title="Copy password"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </div>

                        {dec.note && (
                          <div className="text-xs text-slate-500 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Note:</p>
                            <p className="whitespace-pre-wrap">{dec.note}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
