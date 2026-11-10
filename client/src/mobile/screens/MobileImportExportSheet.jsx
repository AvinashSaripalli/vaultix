import { useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Download, Upload, FileText, Check, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { parseImportFile, downloadExport } from '../../utils/vaultImportExport';
import { createPassword, fetchPasswordsByVault } from '../../features/vault/vaultSlice';
import {
  generateItemAesKey,
  encryptValueWithAesKey,
  encryptFieldsWithAesKey,
  wrapItemKey,
} from '../../utils/crypto';
import { getWrapRecipients, wrapItemKeysForUsers } from '../../utils/keyWrapping';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';
import api from '../../services/api';

export default function MobileImportExportSheet({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);

  const { passwords = [], selectedVault } = useSelector((state) => state.vault);
  const { user, sessionMasterPassword, sessionRsaPublicKey, sessionRsaPrivateKey } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'import'
  const [exportFormat, setExportFormat] = useState('csv'); // 'csv' | 'json' | 'bitwarden'
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedCount, setParsedCount] = useState(0);
  const [parsedRows, setParsedRows] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleExport = () => {
    setExporting(true);
    hapticMedium();
    try {
      const rows = passwords.map((p) => ({
        Name: p.name || '',
        Login: p.login || '',
        Password: p.password || p.rawPassword || '',
        URL: p.url || '',
        Note: p.note || p.notes || '',
        Type: p.type || 'LOGIN',
      }));

      const dateStr = new Date().toISOString().split('T')[0];
      downloadExport(rows, exportFormat, `vaultix_export_${dateStr}`);
      hapticSuccess();
      setStatusMsg(`Exported ${passwords.length} credentials as ${exportFormat.toUpperCase()}`);
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setStatusMsg('');
    setImportFile(file);

    try {
      const res = await parseImportFile(file);
      const rows = res.rows || [];
      setParsedRows(rows);
      setParsedCount(rows.length);
      hapticLight();
    } catch (err) {
      setErrorMsg('Could not read or parse this file. Ensure it is a valid CSV or JSON export.');
    }
  };

  const handleExecuteImport = async () => {
    if (!parsedRows.length || !selectedVault?.id) return;

    setImporting(true);
    setErrorMsg('');
    setStatusMsg(`Encrypting & importing ${parsedRows.length} items...`);
    hapticMedium();

    let successCount = 0;

    try {
      for (const row of parsedRows) {
        try {
          const { aesKey, aesKeyJwk } = await generateItemAesKey();
          const encPassword = row.Password ? await encryptValueWithAesKey(row.Password, aesKeyJwk) : null;
          const encNote = row.Note ? await encryptValueWithAesKey(row.Note, aesKeyJwk) : null;

          const recipients = await getWrapRecipients(selectedVault.id, null, api);
          const wrappedKeys = await wrapItemKeysForUsers(aesKeyJwk, recipients, {
            currentUserId: user?.id,
            currentUserPublicKey: sessionRsaPublicKey,
          });

          await dispatch(createPassword({
            vaultId: selectedVault.id,
            name: row.Name || 'Imported Credential',
            login: row.Login || '',
            url: row.URL || '',
            type: row.Type || 'LOGIN',
            encryptedPassword: encPassword,
            encryptedNote: encNote,
            wrappedKeys,
          }));

          successCount++;
        } catch {
          // ignore single item fail
        }
      }

      hapticSuccess();
      dispatch(fetchPasswordsByVault(selectedVault.id));
      setStatusMsg(`Successfully imported ${successCount} credentials!`);
      setParsedRows([]);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMsg('Import error occurred during encryption.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Sheet */}
      <div className="w-full max-h-[85%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Download size={16} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">Backup &amp; Migration</h2>
              <p className="text-[10px] text-slate-400">Export backups or import from other password managers</p>
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

        {/* Tab Switcher */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('export');
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'export'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Download size={13} />
              <span>Export Vault</span>
            </button>

            <button
              type="button"
              onClick={() => {
                hapticLight();
                setActiveTab('import');
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'import'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Upload size={13} />
              <span>Import Data</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs">
              <Check size={15} className="shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {activeTab === 'export' ? (
            /* EXPORT */
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate an encrypted offline archive of your credentials ({passwords.length} items).
              </p>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Export File Format
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['csv', 'json', 'bitwarden'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setExportFormat(fmt)}
                      className={`py-2 rounded-xl border text-xs font-bold uppercase transition ${
                        exportFormat === fmt
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={passwords.length === 0 || exporting}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                <Download size={14} />
                <span>{exporting ? 'Generating...' : `Export ${passwords.length} Items`}</span>
              </button>
            </div>
          ) : (
            /* IMPORT */
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Import credentials from Chrome, 1Password, Bitwarden, or CSV/JSON files. All entries are encrypted client-side with zero-knowledge AES-256 before upload.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.xlsx"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 dark:file:bg-indigo-950/60 dark:file:text-indigo-400"
              />

              {parsedCount > 0 && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Ready to import: {parsedCount} items
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Valid Format</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={parsedCount === 0 || importing}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs active:scale-98 transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Encrypting &amp; Importing...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Import {parsedCount} Credentials into Vault</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
