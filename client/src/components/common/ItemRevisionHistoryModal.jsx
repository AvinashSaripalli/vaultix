import { useEffect, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  History,
  RotateCcw,
  Clock,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Calendar,
  User,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import ModalPortal, { ModalBackdrop } from './ModalPortal';
import api from '../../services/api';
import { showToast } from '../../utils/toast';
import { secureCopyText } from '../../utils/clipboard';
import {
  decryptText,
  decryptFields,
  isEncryptedFormat,
  unwrapItemKey,
  decryptTextWithAesKey,
  decryptFieldsWithAesKey,
} from '../../utils/crypto';
import ConfirmModal from './ConfirmModal';

export default function ItemRevisionHistoryModal({
  open,
  onClose,
  item,
  isPersonal = false,
  onRestored,
}) {
  const { user, token, sessionMasterPassword, sessionRsaPrivateKey } = useSelector(
    (state) => state.auth
  );

  const [loading, setLoading] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [error, setError] = useState('');

  // Decryption state for selected revision
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedData, setDecryptedData] = useState({
    password: '',
    note: '',
    fields: {},
  });
  const [showPassword, setShowPassword] = useState(false);

  // Restore confirmation state
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // Fetch revisions when modal opens
  useEffect(() => {
    if (!open || !item?.id) return;
    setError('');
    setSelectedRevision(null);
    setDecryptedData({ password: '', note: '', fields: {} });
    setShowPassword(false);

    let cancelled = false;
    const fetchRevisions = async () => {
      try {
        setLoading(true);
        const endpoint = isPersonal
          ? `/personal-vault/passwords/${item.id}/revisions`
          : `/passwords/${item.id}/revisions`;

        const res = await api.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;
        setRevisions(res.data?.revisions || []);
        setCurrentVersion(res.data?.currentVersion || 1);
        if (res.data?.revisions?.length > 0) {
          setSelectedRevision(res.data.revisions[0]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Fetch revisions error:', err);
          setError(err.response?.data?.message || 'Failed to load revision history');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRevisions();
    return () => {
      cancelled = true;
    };
  }, [open, item?.id, isPersonal, token]);

  // Decrypt selected revision when changed
  useEffect(() => {
    if (!selectedRevision) return;

    let cancelled = false;
    const decryptRevision = async () => {
      try {
        setDecrypting(true);
        let plainPassword = '';
        let plainNote = '';
        let plainFields = {};

        // 1. Try unwrapping via RSA private key
        const myKey = selectedRevision.myWrappedKey || selectedRevision.wrappedKeys?.[user?.id];
        if (myKey && sessionRsaPrivateKey) {
          try {
            const aesKeyJwk = await unwrapItemKey(myKey, sessionRsaPrivateKey);
            if (aesKeyJwk) {
              if (selectedRevision.encryptedPassword) {
                plainPassword = await decryptTextWithAesKey(selectedRevision.encryptedPassword, aesKeyJwk);
              }
              if (selectedRevision.encryptedNote) {
                plainNote = await decryptTextWithAesKey(selectedRevision.encryptedNote, aesKeyJwk);
              }
              if (selectedRevision.encryptedFields) {
                plainFields = (await decryptFieldsWithAesKey(selectedRevision.encryptedFields, aesKeyJwk)) || {};
              }
            }
          } catch (unwrapErr) {
            console.warn('Unwrap failed for revision, trying master password:', unwrapErr);
          }
        }

        // 2. Fallback to Master Password symmetric derivation
        if (!plainPassword && !plainNote && Object.keys(plainFields).length === 0 && sessionMasterPassword) {
          if (selectedRevision.encryptedPassword) {
            plainPassword = isEncryptedFormat(selectedRevision.encryptedPassword)
              ? await decryptText(selectedRevision.encryptedPassword, sessionMasterPassword, user?.encryptionSalt)
              : selectedRevision.encryptedPassword;
          }
          if (selectedRevision.encryptedNote) {
            plainNote = isEncryptedFormat(selectedRevision.encryptedNote)
              ? await decryptText(selectedRevision.encryptedNote, sessionMasterPassword, user?.encryptionSalt)
              : selectedRevision.encryptedNote;
          }
          if (selectedRevision.encryptedFields) {
            plainFields = isEncryptedFormat(selectedRevision.encryptedFields)
              ? await decryptFields(selectedRevision.encryptedFields, sessionMasterPassword, user?.encryptionSalt)
              : typeof selectedRevision.encryptedFields === 'string'
              ? JSON.parse(selectedRevision.encryptedFields || '{}')
              : selectedRevision.encryptedFields || {};
          }
        }

        if (!cancelled) {
          setDecryptedData({
            password: plainPassword || '',
            note: plainNote || '',
            fields: plainFields || {},
          });
        }
      } catch (decErr) {
        if (!cancelled) {
          console.warn('Revision decryption error:', decErr);
        }
      } finally {
        if (!cancelled) setDecrypting(false);
      }
    };

    decryptRevision();
    return () => {
      cancelled = true;
    };
  }, [selectedRevision, sessionRsaPrivateKey, sessionMasterPassword, user?.id, user?.encryptionSalt]);

  if (!open) return null;

  const handleCopy = (text, label) => {
    if (!text) return;
    secureCopyText(text);
    showToast(`${label} copied to clipboard`);
  };

  const handleExecuteRestore = async () => {
    if (!confirmRestore || !item?.id) return;

    try {
      setRestoring(true);
      const endpoint = isPersonal
        ? `/personal-vault/passwords/${item.id}/revisions/${confirmRestore.id}/restore`
        : `/passwords/${item.id}/revisions/${confirmRestore.id}/restore`;

      const res = await api.post(
        endpoint,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast(`Restored version ${confirmRestore.version} as the active credential`);
      setConfirmRestore(null);
      if (onRestored) {
        onRestored(res.data?.password);
      }
      onClose();
    } catch (err) {
      console.error('Restore error:', err);
      showToast(err.response?.data?.message || 'Failed to restore revision', 'error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <ModalPortal>
      <ModalBackdrop onClose={onClose} disableBackdropClick={true}>
        <div
          className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
                <History size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                    Version History & Rollback
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Active: v{currentVersion}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {item?.name || 'Credential'} • Immutable changelog and instant zero-knowledge restore
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-center transition shrink-0"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
            {error && (
              <div className="p-3.5 mb-4 rounded-2xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Loader2 size={28} className="animate-spin mx-auto text-indigo-600" />
                <p className="text-xs font-medium">Loading revision history...</p>
              </div>
            ) : revisions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center mx-auto text-slate-400">
                  <Clock size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No revisions recorded yet</p>
                <p className="text-xs max-w-sm mx-auto text-slate-400 leading-relaxed">
                  This item is currently on its initial version (v{currentVersion}). When you or your teammates update credentials, prior snapshots are archived here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5 h-full">
                
                {/* Timeline List (Left) */}
                <div className="space-y-2.5 overflow-y-auto max-h-[460px] pr-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-1">
                    Historical Snapshots ({revisions.length})
                  </div>

                  {revisions.map((rev) => {
                    const isSelected = selectedRevision?.id === rev.id;
                    const dateFormatted = new Date(rev.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={rev.id}
                        onClick={() => setSelectedRevision(rev)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition select-none ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-200 dark:ring-indigo-900/40 shadow-xs'
                            : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                            v{rev.version}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {dateFormatted}
                          </span>
                        </div>

                        <div className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {rev.changeSummary || 'Details updated'}
                        </div>

                        <div className="mt-1 text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                          <User size={11} className="shrink-0" />
                          <span>{rev.createdBy?.fullName || rev.createdBy?.email || 'User'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Revision Inspector (Right) */}
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between overflow-y-auto">
                  {selectedRevision ? (
                    <div className="space-y-4">
                      {/* Inspector Header */}
                      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                              Snapshot Version {selectedRevision.version}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              Archived
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Created on {new Date(selectedRevision.createdAt).toLocaleString()} by {selectedRevision.createdBy?.fullName || selectedRevision.createdBy?.email}
                          </p>
                        </div>

                        {/* Restore Button */}
                        <button
                          type="button"
                          onClick={() => setConfirmRestore(selectedRevision)}
                          className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 shrink-0"
                          title="Roll back to this version"
                        >
                          <RotateCcw size={13} />
                          <span>Restore</span>
                        </button>
                      </div>

                      {/* Fields Preview */}
                      <div className="space-y-3">
                        {/* Title */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400">Title / Name</label>
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                            {selectedRevision.name}
                          </div>
                        </div>

                        {/* Login / Username */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400">Username / Login</label>
                          <div className="mt-0.5 flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100">
                            <span className="font-mono truncate">{selectedRevision.login || '(empty)'}</span>
                            {selectedRevision.login && (
                              <button
                                type="button"
                                onClick={() => handleCopy(selectedRevision.login, 'Username')}
                                className="h-6 w-6 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition"
                              >
                                <Copy size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Password */}
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-400">Password</label>
                          <div className="mt-0.5 flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100">
                            {decrypting ? (
                              <span className="text-slate-400 text-xs italic flex items-center gap-1.5">
                                <Loader2 size={12} className="animate-spin" /> Decrypting...
                              </span>
                            ) : decryptedData.password ? (
                              <span className="font-mono truncate">
                                {showPassword ? decryptedData.password : '••••••••••••••••'}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">
                                (Session locked — unlock master password to decrypt)
                              </span>
                            )}

                            <div className="flex items-center gap-1 shrink-0">
                              {decryptedData.password && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="h-6 w-6 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition"
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                  >
                                    {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(decryptedData.password, 'Password')}
                                    className="h-6 w-6 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition"
                                    title="Copy password"
                                  >
                                    <Copy size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* URL if any */}
                        {selectedRevision.url && (
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400">Website URL</label>
                            <div className="mt-0.5 flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100">
                              <span className="truncate">{selectedRevision.url}</span>
                              <a
                                href={selectedRevision.url.startsWith('http') ? selectedRevision.url : `https://${selectedRevision.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="h-6 w-6 rounded text-slate-400 hover:text-indigo-600 flex items-center justify-center transition"
                              >
                                <ExternalLink size={13} />
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Note if any */}
                        {decryptedData.note && (
                          <div>
                            <label className="text-[10px] uppercase font-bold text-slate-400">Secure Note</label>
                            <div className="mt-0.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                              {decryptedData.note}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 text-xs">
                      Select a revision from the left to inspect
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              Restoring a prior version creates a new snapshot without erasing history.
            </span>

            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      </ModalBackdrop>

      {/* Rollback Confirmation Modal */}
      {confirmRestore && (
        <ConfirmModal
          open={Boolean(confirmRestore)}
          title={`Restore Version ${confirmRestore.version}?`}
          message={`Are you sure you want to restore the credentials from version ${confirmRestore.version} (archived on ${new Date(confirmRestore.createdAt).toLocaleDateString()})? Your current active credentials (v${currentVersion}) will be safely preserved as a new version in history.`}
          confirmLabel={restoring ? 'Restoring...' : `Restore to v${confirmRestore.version}`}
          onConfirm={handleExecuteRestore}
          onCancel={() => setConfirmRestore(null)}
          loading={restoring}
        />
      )}
    </ModalPortal>
  );
}
