import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Download,
  FileSpreadsheet,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Loader2,
  AlertCircle,
  Building2,
  Folder,
} from 'lucide-react';
import ModalPortal, { ModalBackdrop } from '../common/ModalPortal';
import api from '../../services/api';
import { showToast } from '../../utils/toast';
import { downloadExport } from '../../utils/vaultImportExport';
import {
  unwrapItemKey,
  decryptTextWithAesKey,
  decryptFieldsWithAesKey,
  decryptText,
  decryptFields,
  isEncryptedFormat,
  decryptPrivateKey,
} from '../../utils/crypto';
import {
  setSessionRsaPrivateKey,
  setSessionRsaPublicKey,
} from '../../features/auth/authSlice';

const EXPORT_FORMATS = [
  {
    id: 'csv',
    name: 'CSV (.csv)',
    badge: 'Spreadsheet',
    desc: 'Comma-separated values with formula-injection sanitization. Compatible with Excel & Google Sheets.',
    icon: FileSpreadsheet,
    color: 'emerald',
  },
  {
    id: 'excel',
    name: 'Excel (.xlsx)',
    badge: 'Microsoft Excel',
    desc: 'Native Microsoft Excel workbook format with styled column headers.',
    icon: FileSpreadsheet,
    color: 'green',
  },
  {
    id: 'bitwarden',
    name: 'Bitwarden JSON (.json)',
    badge: 'Migration',
    desc: 'Standard Bitwarden export schema for easy migration to Bitwarden or 1Password.',
    icon: FileText,
    color: 'blue',
  },
  {
    id: 'json',
    name: 'Standard JSON (.json)',
    badge: 'Developer',
    desc: 'Structured JSON array of credentials and metadata for programmatic use.',
    icon: FileText,
    color: 'indigo',
  },
];

export default function ExportPersonalVaultModal({
  open,
  onClose,
  passwords = [],
  folders = [],
  selectedFolderId = null,
}) {
  const dispatch = useDispatch();
  const { user, token, sessionMasterPassword, sessionRsaPrivateKey, sessionRsaPublicKey } = useSelector(
    (state) => state.auth
  );

  const [exportScope, setExportScope] = useState('ALL'); // 'ALL' | 'FOLDER'
  const [exportFormat, setExportFormat] = useState('csv');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [policyAllowed, setPolicyAllowed] = useState(true);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // Selected folder object if any
  const currentFolder = folders.find((f) => f.id === selectedFolderId);

  // Target passwords to export
  const targetPasswords = (exportScope === 'FOLDER' && currentFolder)
    ? passwords.filter((p) => p.folderId === currentFolder.id)
    : passwords;

  // Check policy on open
  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmPassword('');
    setExporting(false);

    let cancelled = false;
    const fetchPolicy = async () => {
      try {
        setPolicyLoading(true);
        const res = await api.get('/organization-policy/public', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.data) {
          setPolicyAllowed(res.data.allowPersonalVaultExport !== false);
        }
      } catch (err) {
        console.warn('Public policy check failed, defaulting to allowed:', err);
        if (!cancelled) setPolicyAllowed(true);
      } finally {
        if (!cancelled) setPolicyLoading(false);
      }
    };

    fetchPolicy();
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  if (!open) return null;

  const handleExport = async (e) => {
    e?.preventDefault();
    if (exporting) return;
    setError('');

    if (!policyAllowed) {
      setError('Personal vault export is prohibited by your organization security policy.');
      return;
    }

    if (targetPasswords.length === 0) {
      setError('There are no passwords to export in the selected scope.');
      return;
    }

    // Determine working master password: user input or session
    const effectiveMasterPassword = confirmPassword.trim() || sessionMasterPassword;

    if (!effectiveMasterPassword) {
      setError('Master Password is required to decrypt and authorize vault export.');
      return;
    }

    try {
      setExporting(true);

      // Verify master password if entered explicitly
      if (confirmPassword.trim()) {
        try {
          await api.post('/auth/verify-master-password', {
            masterPassword: confirmPassword.trim(),
          });
        } catch (verifyErr) {
          setError(verifyErr.response?.data?.message || 'Incorrect Master Password. Please try again.');
          setExporting(false);
          return;
        }
      }

      // Recover RSA private key if missing from session
      let rsaKey = sessionRsaPrivateKey;
      if (!rsaKey && user?.id && effectiveMasterPassword) {
        try {
          const kpRes = await api.get('/keypair', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (kpRes.data?.encryptedPrivateKey) {
            rsaKey = await decryptPrivateKey(
              kpRes.data.encryptedPrivateKey,
              effectiveMasterPassword,
              kpRes.data.salt
            );
            dispatch(setSessionRsaPrivateKey(rsaKey));
            if (kpRes.data.publicKey) {
              dispatch(setSessionRsaPublicKey(kpRes.data.publicKey));
            }
          }
        } catch (kpErr) {
          console.warn('RSA key recovery note during export:', kpErr);
        }
      }

      // Bulk client-side decryption
      const decryptedRows = [];

      for (const item of targetPasswords) {
        let plainPassword = '';
        let plainNote = '';
        let plainFields = {};

        // 1. Try unwrapping via RSA private key
        if (item.myWrappedKey && rsaKey) {
          try {
            const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, rsaKey);
            if (aesKeyJwk) {
              if (item.encryptedPassword) {
                plainPassword = await decryptTextWithAesKey(item.encryptedPassword, aesKeyJwk);
              }
              if (item.encryptedNote) {
                plainNote = await decryptTextWithAesKey(item.encryptedNote, aesKeyJwk);
              }
              if (item.encryptedFields) {
                plainFields = (await decryptFieldsWithAesKey(item.encryptedFields, aesKeyJwk)) || {};
              }
            }
          } catch (wrapErr) {
            console.warn(`Unwrap failed for "${item.name}", falling back to master password:`, wrapErr);
          }
        }

        // 2. Fallback to master password symmetric encryption
        if (!plainPassword && !plainNote && Object.keys(plainFields).length === 0 && effectiveMasterPassword) {
          if (item.encryptedPassword) {
            plainPassword = isEncryptedFormat(item.encryptedPassword)
              ? await decryptText(item.encryptedPassword, effectiveMasterPassword, user?.encryptionSalt)
              : item.encryptedPassword;
          }
          if (item.encryptedNote) {
            plainNote = isEncryptedFormat(item.encryptedNote)
              ? await decryptText(item.encryptedNote, effectiveMasterPassword, user?.encryptionSalt)
              : item.encryptedNote;
          }
          if (item.encryptedFields) {
            plainFields = isEncryptedFormat(item.encryptedFields)
              ? await decryptFields(item.encryptedFields, effectiveMasterPassword, user?.encryptionSalt)
              : (typeof item.encryptedFields === 'string' ? JSON.parse(item.encryptedFields || '{}') : item.encryptedFields || {});
          }
        }

        decryptedRows.push({
          Name: item.name || '',
          Type: item.type || 'LOGIN',
          Login: item.login || '',
          Password: plainPassword || '',
          URL: item.url || '',
          Note: plainNote || '',
          Folder: currentFolder?.name || '',
          ...plainFields,
        });
      }

      // Generate filename and trigger client-side download
      const dateStr = new Date().toISOString().split('T')[0];
      const scopeSuffix = (exportScope === 'FOLDER' && currentFolder)
        ? `_${currentFolder.name.replace(/\s+/g, '_').toLowerCase()}`
        : '';
      const filenameBase = `vaultix_personal_vault${scopeSuffix}_${dateStr}`;

      downloadExport(decryptedRows, exportFormat, filenameBase);

      // Log export event to server audit trail
      try {
        await api.post(
          '/personal-vault/export-log',
          {
            itemCount: decryptedRows.length,
            format: exportFormat,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } catch (logErr) {
        console.warn('Audit logging for personal vault export failed:', logErr);
      }

      showToast(`Exported ${decryptedRows.length} credentials as ${exportFormat.toUpperCase()}`);
      onClose();
    } catch (err) {
      console.error('Export failed:', err);
      setError('Decryption or file export failed. Please verify your Master Password.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <ModalPortal>
      <ModalBackdrop onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div
          className="relative w-full max-w-xl bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
                  <Download size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Export Personal Vault
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Download a decrypted backup of your private passwords and credentials.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleExport} className="p-5 sm:p-6 space-y-5">
            {/* Policy Block Notice */}
            {!policyLoading && !policyAllowed && (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3 text-rose-700 dark:text-rose-300 text-xs">
                <ShieldAlert size={18} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                <div>
                  <p className="font-bold">Export Prohibited by Security Policy</p>
                  <p className="mt-0.5 leading-relaxed">
                    Your organization administrator has disabled Personal Vault exporting to prevent unauthorized credential exfiltration. Contact your IT Super Admin for details.
                  </p>
                </div>
              </div>
            )}

            {/* Offboarding / Separation Reminder Banner */}
            {policyAllowed && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3 text-amber-800 dark:text-amber-300 text-xs">
                <Building2 size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">Taking Personal Backup or Offboarding?</p>
                  <p className="mt-0.5 text-amber-700/90 dark:text-amber-400/90 leading-relaxed">
                    If any passwords belong to company infrastructure, please use the <strong>Move to Company Vault</strong> button before departing so your team does not lose access.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Scope Selection */}
            {currentFolder && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Export Scope
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setExportScope('ALL')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      exportScope === 'ALL'
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-200 dark:ring-indigo-900/40'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs">All Personal Items</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {passwords.length} items total
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExportScope('FOLDER')}
                    className={`p-3 rounded-2xl border text-left transition ${
                      exportScope === 'FOLDER'
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-200 dark:ring-indigo-900/40'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="font-bold text-xs truncate flex items-center gap-1">
                      <Folder size={12} className="shrink-0" />
                      <span>{currentFolder.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {targetPasswords.length} items in folder
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Format Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Export File Format
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EXPORT_FORMATS.map((fmt) => {
                  const Icon = fmt.icon;
                  const isSelected = exportFormat === fmt.id;
                  return (
                    <div
                      key={fmt.id}
                      onClick={() => setExportFormat(fmt.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition select-none flex items-start gap-3 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xs ring-2 ring-indigo-200 dark:ring-indigo-900/40'
                          : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-750'
                      }`}
                    >
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {fmt.name}
                          </span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                            {fmt.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal line-clamp-2">
                          {fmt.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Master Password Re-prompt Security Guard */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Lock size={13} className="text-indigo-500" />
                  <span>Master Password Authorization</span>
                </label>
                {sessionMasterPassword && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Session Verified (Optional re-entry)
                  </span>
                )}
              </div>
              <input
                type="password"
                placeholder={sessionMasterPassword ? 'Optional: Re-enter to re-verify session' : 'Enter Master Password to authorize export'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={exporting || !policyAllowed}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 transition disabled:opacity-50"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Required for client-side cryptographic zero-knowledge decryption.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={exporting}
                className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={exporting || !policyAllowed || targetPasswords.length === 0}
                className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20 flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Decrypting & Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Export {targetPasswords.length} Credentials</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
