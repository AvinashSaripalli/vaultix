import { useEffect, useState } from 'react';
import { Building2, Folder, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import ModalPortal, { ModalBackdrop } from '../common/ModalPortal';
import api from '../../services/api';
import { showToast } from '../../utils/toast';
import {
  decryptText,
  decryptFields,
  isEncryptedFormat,
  unwrapItemKey,
  decryptTextWithAesKey,
  decryptFieldsWithAesKey,
  generateItemAesKey,
  encryptValueWithAesKey,
  encryptFieldsWithAesKey,
} from '../../utils/crypto';
import { getWrapRecipients, wrapItemKeysForUsers } from '../../utils/keyWrapping';
import { CUSTOM_FIELDS_KEY, serializeCustomFields } from '../../utils/itemTypes';

export default function TransferToCompanyModal({
  open,
  item,
  onClose,
  onTransferred,
}) {
  const { user, sessionMasterPassword, sessionRsaPrivateKey } = useSelector((state) => state.auth);

  const [vaults, setVaults] = useState([]);
  const [selectedVaultId, setSelectedVaultId] = useState('');
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [loadingVaults, setLoadingVaults] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');

  // Fetch company vaults when modal opens
  useEffect(() => {
    if (!open) return;
    setSelectedVaultId('');
    setSelectedFolderId('');
    setFolders([]);
    setError('');

    const fetchCompanyVaults = async () => {
      setLoadingVaults(true);
      try {
        const res = await api.get('/vaults');
        const companyVaults = (res.data || []).filter((v) => v.type !== 'PERSONAL');
        setVaults(companyVaults);
        if (companyVaults.length > 0) {
          setSelectedVaultId(companyVaults[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch company vaults:', err);
        setError('Failed to load company vaults.');
      } finally {
        setLoadingVaults(false);
      }
    };

    fetchCompanyVaults();
  }, [open]);

  // Fetch folders when selected vault changes
  useEffect(() => {
    if (!selectedVaultId) {
      setFolders([]);
      setSelectedFolderId('');
      return;
    }

    const fetchVaultFolders = async () => {
      setLoadingFolders(true);
      try {
        const res = await api.get(`/folders/vault/${selectedVaultId}`);
        const activeFolders = (res.data || []).filter((f) => !f.deletedAt);
        setFolders(activeFolders);
        if (activeFolders.length > 0) {
          setSelectedFolderId(activeFolders[0].id);
        } else {
          setSelectedFolderId('');
        }
      } catch (err) {
        console.error('Failed to fetch folders for vault:', err);
        setFolders([]);
        setSelectedFolderId('');
      } finally {
        setLoadingFolders(false);
      }
    };

    fetchVaultFolders();
  }, [selectedVaultId]);

  if (!open || !item) return null;

  const handleTransfer = async () => {
    if (!selectedFolderId) {
      setError('Please select a destination folder in the company vault.');
      return;
    }

    setTransferring(true);
    setError('');

    try {
      // 1. Decrypt plaintext values from personal vault item
      let plainPassword = '';
      let plainNote = '';
      let plainFields = {};

      if (item.myWrappedKey && sessionRsaPrivateKey) {
        try {
          const keyJwk = await unwrapItemKey(item.myWrappedKey, sessionRsaPrivateKey);
          if (keyJwk) {
            plainPassword = item.encryptedPassword
              ? await decryptTextWithAesKey(item.encryptedPassword, keyJwk)
              : '';
            plainNote = item.encryptedNote
              ? await decryptTextWithAesKey(item.encryptedNote, keyJwk)
              : '';
            plainFields = item.encryptedFields
              ? (await decryptFieldsWithAesKey(item.encryptedFields, keyJwk)) || {}
              : {};
          }
        } catch (e) {
          console.warn('Failed unwrapping personal key, trying master password:', e);
        }
      }

      if (!plainPassword && !plainNote && Object.keys(plainFields).length === 0 && sessionMasterPassword) {
        const isEncryptedPw = isEncryptedFormat(item.encryptedPassword);
        plainPassword = isEncryptedPw
          ? await decryptText(item.encryptedPassword, sessionMasterPassword, user?.encryptionSalt)
          : item.encryptedPassword || '';
        plainNote = item.encryptedNote && isEncryptedFormat(item.encryptedNote)
          ? await decryptText(item.encryptedNote, sessionMasterPassword, user?.encryptionSalt)
          : item.encryptedNote || '';
        plainFields = item.encryptedFields
          ? (await decryptFields(item.encryptedFields, sessionMasterPassword, user?.encryptionSalt)) || {}
          : {};
      }

      // 2. Generate a new AES item key for the Company Vault item
      const { aesKeyJwk } = await generateItemAesKey();
      if (!aesKeyJwk) {
        throw new Error('Failed to generate company encryption key.');
      }

      // 3. Encrypt password, note, and typed fields with the new AES key
      const encryptedPassword = plainPassword
        ? await encryptValueWithAesKey(plainPassword, aesKeyJwk)
        : '';
      const encryptedNote = plainNote
        ? await encryptValueWithAesKey(plainNote, aesKeyJwk)
        : '';
      const encryptedFields = await encryptFieldsWithAesKey(plainFields, aesKeyJwk);

      // 4. Wrap the AES item key for all authorized members of the destination folder
      const recipientIds = await getWrapRecipients(selectedFolderId, user?.id);
      const wrappedKeys = await wrapItemKeysForUsers(aesKeyJwk, recipientIds);

      // 5. Submit transfer to backend
      const res = await api.post(`/personal-vault/passwords/${item.id}/transfer-to-company`, {
        targetFolderId: selectedFolderId,
        encryptedPassword,
        encryptedFields,
        encryptedNote,
        wrappedKeys,
      });

      showToast(`Transferred "${item.name}" to Company Vault successfully!`, 'success');
      onTransferred?.(res.data);
      onClose();
    } catch (err) {
      console.error('Transfer to company vault failed:', err);
      setError(err.response?.data?.message || err.message || 'Transfer failed. Please try again.');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <ModalPortal open={open} onClose={onClose} closeOnEscape={false}>
      <ModalBackdrop onClose={onClose} disableBackdropClick={true}>
        <div
          className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Move to Company Vault
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transfer &ldquo;{item.name}&rdquo; from your personal vault to a shared team folder.
              </p>
            </div>
          </div>

          {/* Explanation Alert */}
          <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Client-Side Re-Encryption
              </p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                This item will be re-encrypted with team keys so authorized department members and admins can access it, even if you change roles.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Destination Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Destination Company Vault
              </label>
              {loadingVaults ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
                  <Loader2 size={14} className="animate-spin" /> Loading vaults...
                </div>
              ) : vaults.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No company vaults available. Contact an administrator.
                </p>
              ) : (
                <select
                  value={selectedVaultId}
                  onChange={(e) => setSelectedVaultId(e.target.value)}
                  disabled={transferring}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                >
                  {vaults.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Destination Folder
              </label>
              {loadingFolders ? (
                <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
                  <Loader2 size={14} className="animate-spin" /> Loading folders...
                </div>
              ) : folders.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This vault has no active folders. Create a folder in this vault first.
                </p>
              ) : (
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  disabled={transferring}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="mt-6 flex justify-end items-center gap-2.5 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={transferring}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={transferring || !selectedFolderId}
              className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition flex items-center gap-2 shadow-sm"
            >
              {transferring ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Re-Encrypting & Transferring...
                </>
              ) : (
                <>
                  <ArrowRight size={14} />
                  Transfer to Company Vault
                </>
              )}
            </button>
          </div>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}
