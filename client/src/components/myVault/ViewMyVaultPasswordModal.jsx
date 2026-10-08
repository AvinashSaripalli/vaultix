import { useEffect, useState } from 'react';
import { X, Eye, EyeOff, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import { useSelector } from 'react-redux';
import { decryptText, isEncryptedFormat } from '../../utils/crypto';
import { secureCopyText } from '../../utils/clipboard';
import VerifyMasterPasswordModal from '../security/VerifyMasterPasswordModal';
import ModalPortal from '../common/ModalPortal';

function ViewMyVaultPasswordModal({ open, password, onClose }) {
  const { user, sessionMasterPassword } = useSelector((state) => state.auth);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [decryptedPassword, setDecryptedPassword] = useState(null);
  const [decryptedNote, setDecryptedNote] = useState(null);
  const [showDecrypted, setShowDecrypted] = useState(false);
  const [reVerifyOpen, setReVerifyOpen] = useState(false);

  useEffect(() => {
    if (open && password) {
      setLoading(true);
      setError('');
      setShowDecrypted(false);
      setDecryptedPassword(null);
      setDecryptedNote(null);

      if (!isEncryptedFormat(password.encryptedPassword)) {
        setDecryptedPassword(password.encryptedPassword);
        setDecryptedNote(password.encryptedNote || null);
        setLoading(false);
        return;
      }

      if (!sessionMasterPassword) {
        setLoading(false);
        setReVerifyOpen(true);
        return;
      }

      (async () => {
        try {
          const decrypted = await decryptText(
            password.encryptedPassword,
            sessionMasterPassword,
            user?.encryptionSalt
          );

          let noteText = null;
          if (password.encryptedNote && isEncryptedFormat(password.encryptedNote)) {
            noteText = await decryptText(
              password.encryptedNote,
              sessionMasterPassword,
              user?.encryptionSalt
            );
          }

          setDecryptedPassword(decrypted);
          setDecryptedNote(noteText);
        } catch {
          setError('Failed to decrypt. Wrong master password.');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [open, password, sessionMasterPassword, user?.encryptionSalt]);

  const handleCopy = (value) => {
    if (!value) return;
    secureCopyText(value);
  };

  const handleClose = () => {
    setDecryptedPassword(null);
    setDecryptedNote(null);
    setShowDecrypted(false);
    setError('');
    onClose();
  };

  if (!open || !password) return null;

  const displayPassword = decryptedPassword || '••••••••••••';
  const displayNote = decryptedNote ?? (password.encryptedNote || 'No note');

  return (
    <ModalPortal open={open} onClose={handleClose}>
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={handleClose}
      >
        <div
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 dark:bg-slate-800 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">View Password</h2>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">Name</p>
            <p className="font-semibold text-slate-900 mt-1 dark:text-slate-100">{password.name}</p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-between dark:border-slate-700">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Login</p>
              <p className="font-medium text-slate-900 mt-1 dark:text-slate-100">{password.login}</p>
            </div>
            <button
              onClick={() => handleCopy(password.login)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Copy size={16} />
            </button>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-200 p-6 text-center dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">Decrypting...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 p-4 flex items-center justify-between dark:border-slate-700">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Password</p>
                  <p className="font-medium text-slate-900 mt-1 break-all dark:text-slate-100">
                    {showDecrypted ? displayPassword : '••••••••••••'}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <button
                    onClick={() => setShowDecrypted(!showDecrypted)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    {showDecrypted ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => decryptedPassword && handleCopy(displayPassword)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">URL</p>
                {password.url ? (
                  <a
                    href={password.url.startsWith('http') ? password.url : `https://${password.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline mt-1 inline-flex items-center gap-1 dark:text-blue-400 dark:hover:text-blue-400"
                  >
                    {password.url}
                    <ExternalLink size={14} />
                  </a>
                ) : (
                  <p className="font-medium text-slate-900 mt-1 dark:text-slate-100">No URL</p>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">Tags</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {password?.tags?.length
                    ? password.tags
                        .map((item) => item.tag?.name)
                        .filter(Boolean)
                        .map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium dark:bg-indigo-900/20 dark:text-indigo-400"
                          >
                            {name}
                          </span>
                        ))
                    : <p className="font-medium text-slate-900 dark:text-slate-100">No tags</p>}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">Note</p>
                <p className="font-medium text-slate-900 mt-1 break-all dark:text-slate-100">{displayNote}</p>
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleClose}
          className="w-full mt-5 bg-indigo-600 text-white rounded-xl py-3 font-medium hover:bg-indigo-700"
        >
          Done
        </button>
      </div>

      <VerifyMasterPasswordModal
        open={reVerifyOpen}
        onClose={() => {
          setReVerifyOpen(false);
          handleClose();
        }}
        onVerified={() => {
          setReVerifyOpen(false);
        }}
      />
      </div>
    </ModalPortal>
  );
}

export default ViewMyVaultPasswordModal;