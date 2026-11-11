import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  X,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound,
  CreditCard,
  FileText,
  User,
  Folder,
  Globe,
  Lock,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  Shield,
  Sliders,
} from 'lucide-react';
import {
  generateItemAesKey,
  encryptValueWithAesKey,
  encryptFieldsWithAesKey,
  encryptText,
  encryptFields,
  wrapItemKey,
  unwrapItemKey,
  decryptTextWithAesKey,
  decryptFieldsWithAesKey,
  decryptText,
  decryptFields,
  decryptPrivateKey,
} from '../../utils/crypto';
import { getWrapRecipients, wrapItemKeysForUsers } from '../../utils/keyWrapping';
import { generatePassword } from '../../utils/passwordGenerator';
import { estimateStrength, checkBreachedPassword } from '../../utils/breachCheck';
import { isPasswordAtRisk } from '../../utils/passwordRisk';
import {
  ITEM_TYPES,
  emptyTypeFields,
  serializeCustomFields,
  parseCustomFields,
  CUSTOM_FIELDS_KEY,
} from '../../utils/itemTypes';
import { createPassword, updatePassword, fetchPasswordsByVault } from '../../features/vault/vaultSlice';
import {
  createMyVaultPassword,
  updateMyVaultPassword,
  createMyVaultFolder,
  fetchMyVault,
} from '../../features/myVault/myVaultSlice';
import {
  setSessionRsaPrivateKey,
  setSessionRsaPublicKey,
} from '../../features/auth/authSlice';
import { hapticMedium, hapticSuccess, hapticLight } from '../../utils/haptics';
import api from '../../services/api';

const TYPES = [
  { id: 'LOGIN', label: 'Login', icon: KeyRound },
  { id: 'CARD', label: 'Card', icon: CreditCard },
  { id: 'SECURE_NOTE', label: 'Note', icon: FileText },
  { id: 'IDENTITY', label: 'Identity', icon: User },
];

export default function MobileItemEditorSheet({
  isOpen,
  mode = 'create', // 'create' | 'edit'
  item = null,
  targetVault = null,
  folders: foldersProp = null,
  initialDecryptedPassword = '',
  initialDecryptedNote = '',
  initialDecryptedFields = {},
  onClose,
  onSaved,
}) {
  const dispatch = useDispatch();

  const {
    selectedVault,
    selectedFolderId,
    folders = [],
    actionLoading,
  } = useSelector((state) => state.vault);

  const effectiveVault = targetVault || selectedVault;
  const effectiveFolders = foldersProp && foldersProp.length > 0 ? foldersProp : folders;
  const isPersonalVault = effectiveVault?.type === 'PERSONAL' || item?.type === 'PERSONAL' || item?.vaultId === 'PERSONAL_VAULT';

  const {
    user,
    sessionMasterPassword,
    sessionRsaPublicKey,
    sessionRsaPrivateKey,
  } = useSelector((state) => state.auth);

  // Form State
  const [itemType, setItemType] = useState('LOGIN');
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [folderId, setFolderId] = useState('');
  const [isSensitive, setIsSensitive] = useState(false);
  const [fields, setFields] = useState(emptyTypeFields('LOGIN'));
  const [customFields, setCustomFields] = useState([]);

  // UI Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genUppercase, setGenUppercase] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Strength computation
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: 'None', color: 'bg-slate-200 dark:bg-slate-700' };
    const score = estimateStrength(password);
    if (score <= 1) return { score, label: 'Very Weak', color: 'bg-rose-500', text: 'text-rose-500' };
    if (score === 2) return { score, label: 'Weak', color: 'bg-amber-500', text: 'text-amber-500' };
    if (score === 3) return { score, label: 'Good', color: 'bg-yellow-500', text: 'text-yellow-500' };
    if (score === 4) return { score, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500' };
    return { score: 5, label: 'Very Strong', color: 'bg-indigo-500', text: 'text-indigo-500' };
  }, [password]);

  // Populate data when opening in edit mode
  useEffect(() => {
    if (!isOpen) return;
    setError('');

    if (mode === 'edit' && item) {
      setItemType(item.type || 'LOGIN');
      setName(item.name || '');
      setLogin(item.login || '');
      setUrl(item.url || '');
      setFolderId(item.folderId || '');
      setIsSensitive(Boolean(item.isSensitive));

      const incomingFields =
        initialDecryptedFields && Object.keys(initialDecryptedFields).length > 0
          ? initialDecryptedFields
          : item.decryptedFields || item.fields || {};

      const { [CUSTOM_FIELDS_KEY]: customRaw, ...typedFields } = incomingFields;
      setFields({ ...emptyTypeFields(item.type || 'LOGIN'), ...typedFields });

      const initialCustom = customRaw || item.customFields || item.encryptedCustomFields;
      setCustomFields(parseCustomFields(initialCustom || []));

      const initialPw = initialDecryptedPassword || item.decryptedPassword || item.password || '';
      const initialNt = initialDecryptedNote || item.decryptedNote || item.note || item.notes || '';
      setPassword(initialPw);
      setNote(initialNt);

      // Self-healing: if password, note, or typed fields are still empty, decrypt them on the fly
      const needsPw = item.encryptedPassword && !initialPw;
      const needsNt = item.encryptedNote && !initialNt;
      const needsFlds = item.encryptedFields && Object.keys(typedFields).length === 0;

      if (needsPw || needsNt || needsFlds) {
        (async () => {
          try {
            let pwd = '';
            let nt = '';
            let flds = {};

            if (item.myWrappedKey && sessionRsaPrivateKey) {
              try {
                const aesKeyJwk = await unwrapItemKey(item.myWrappedKey, sessionRsaPrivateKey);
                if (needsPw && item.encryptedPassword) pwd = await decryptTextWithAesKey(item.encryptedPassword, aesKeyJwk);
                if (needsNt && item.encryptedNote) nt = await decryptTextWithAesKey(item.encryptedNote, aesKeyJwk);
                if (needsFlds && item.encryptedFields) flds = await decryptFieldsWithAesKey(item.encryptedFields, aesKeyJwk);
              } catch (wrapErr) {
                console.warn('unwrapItemKey failed in editor, attempting master password fallback:', wrapErr);
              }
            }

            if ((!pwd && needsPw) || (!nt && needsNt) || (Object.keys(flds).length === 0 && needsFlds)) {
              if (sessionMasterPassword) {
                if (needsPw && !pwd && item.encryptedPassword) {
                  pwd = await decryptText(item.encryptedPassword, sessionMasterPassword, user?.encryptionSalt);
                }
                if (needsNt && !nt && item.encryptedNote) {
                  nt = await decryptText(item.encryptedNote, sessionMasterPassword, user?.encryptionSalt);
                }
                if (needsFlds && Object.keys(flds).length === 0 && item.encryptedFields) {
                  flds = await decryptFields(item.encryptedFields, sessionMasterPassword, user?.encryptionSalt);
                }
              }
            }

            if (pwd) setPassword(pwd);
            if (nt) setNote(nt);
            if (flds && Object.keys(flds).length > 0) {
              const { [CUSTOM_FIELDS_KEY]: cRaw, ...tFields } = flds;
              setFields((prev) => ({ ...prev, ...tFields }));
              if (cRaw) setCustomFields(parseCustomFields(cRaw));
            }
          } catch (err) {
            console.warn('MobileItemEditorSheet self-decrypt error:', err);
          }
        })();
      }
    } else {
      // Reset for create mode
      setItemType('LOGIN');
      setName('');
      setLogin('');
      setPassword('');
      setUrl('');
      setNote('');
      setFolderId(selectedFolderId || (folders[0]?.id || ''));
      setIsSensitive(false);
      setFields(emptyTypeFields('LOGIN'));
      setCustomFields([]);
    }
  }, [
    isOpen,
    mode,
    item,
    initialDecryptedPassword,
    initialDecryptedNote,
    initialDecryptedFields,
    selectedFolderId,
    folders,
    sessionRsaPrivateKey,
    sessionMasterPassword,
    user?.encryptionSalt,
  ]);

  if (!isOpen) return null;

  // Handle inline password generator
  const handleGenerate = () => {
    hapticMedium();
    const newPw = generatePassword({
      length: genLength,
      uppercase: genUppercase,
      lowercase: true,
      numbers: genNumbers,
      symbols: genSymbols,
    });
    setPassword(newPw);
  };

  // Add / Remove custom fields
  const handleAddCustomField = () => {
    hapticLight();
    setCustomFields((prev) => [...prev, { id: Date.now().toString(), name: '', value: '', isSecret: false }]);
  };

  const handleRemoveCustomField = (id) => {
    hapticLight();
    setCustomFields((prev) => prev.filter((cf) => cf.id !== id));
  };

  const handleCustomFieldChange = (id, key, val) => {
    setCustomFields((prev) => prev.map((cf) => (cf.id === id ? { ...cf, [key]: val } : cf)));
  };

  // Submission handler with client-side zero-knowledge encryption
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      setError('Please provide an item name.');
      return;
    }

    setError('');
    setSubmitting(true);
    hapticMedium();

    try {
      if (isPersonalVault) {
        if (!sessionMasterPassword) {
          setError('Master password session missing. Please lock and unlock your vault.');
          setSubmitting(false);
          return;
        }

        const isLogin = itemType === 'LOGIN';
        const encryptedPassword = isLogin && password
          ? await encryptText(password, sessionMasterPassword, user?.encryptionSalt)
          : '';
        const encryptedNote = note
          ? await encryptText(note, sessionMasterPassword, user?.encryptionSalt)
          : '';

        const fieldsPayload = { ...fields };
        if (customFields.length > 0) {
          fieldsPayload[CUSTOM_FIELDS_KEY] = serializeCustomFields(customFields);
        }
        const encryptedFields = await encryptFields(
          fieldsPayload,
          sessionMasterPassword,
          user?.encryptionSalt
        );

        let targetFolderId = folderId;
        if (!targetFolderId && effectiveFolders.length > 0) {
          targetFolderId = effectiveFolders[0].id;
        }

        if (!targetFolderId) {
          try {
            const newFld = await dispatch(createMyVaultFolder({ name: 'Personal' }));
            if (newFld.payload?.id) {
              targetFolderId = newFld.payload.id;
            }
          } catch {
            //
          }
        }

        const strengthScore = isLogin ? estimateStrength(password) : 5;
        const breach = isLogin && password ? await checkBreachedPassword(password) : { breached: false };
        const atRisk = isLogin ? (breach.breached || isPasswordAtRisk(password)) : false;

        const payload = {
          name: name.trim(),
          type: itemType,
          login: isLogin ? login.trim() : '',
          url: isLogin ? url.trim() : '',
          encryptedPassword,
          encryptedNote,
          encryptedFields,
          folderId: targetFolderId,
          isSensitive,
          strengthScore,
          atRisk,
        };

        if (mode === 'edit' && item?.id) {
          const res = await dispatch(updateMyVaultPassword({ passwordId: item.id, data: payload }));
          if (res.error) throw new Error(res.error.message || 'Failed to update personal item');
        } else {
          const res = await dispatch(createMyVaultPassword(payload));
          if (res.error) throw new Error(res.error.message || 'Failed to create personal item');
        }

        dispatch(fetchMyVault());
        hapticSuccess();
        onSaved?.();
        onClose();
        return;
      }

      let rsaPrivateKey = sessionRsaPrivateKey;
      let rsaPublicKey = sessionRsaPublicKey;

      // Recover keypair if lost from session state
      if ((!rsaPrivateKey || !rsaPublicKey) && user?.id && sessionMasterPassword) {
        try {
          const kpRes = await api.get('/keypair');
          if (kpRes.data?.encryptedPrivateKey) {
            rsaPrivateKey = await decryptPrivateKey(
              kpRes.data.encryptedPrivateKey,
              sessionMasterPassword,
              kpRes.data.salt
            );
            dispatch(setSessionRsaPrivateKey(rsaPrivateKey));
            if (kpRes.data.publicKey) {
              rsaPublicKey = kpRes.data.publicKey;
              dispatch(setSessionRsaPublicKey(rsaPublicKey));
            }
          }
        } catch {
          // Keypair fetch failed
        }
      }

      if (!user?.id || !rsaPrivateKey || !rsaPublicKey) {
        setError('Encryption keys are unavailable. Please lock and re-enter your master password.');
        setSubmitting(false);
        return;
      }

      // Generate single AES-GCM item key
      const { aesKeyJwk } = await generateItemAesKey();

      // Encrypt password & note
      const encryptedPassword = password ? await encryptValueWithAesKey(password, aesKeyJwk) : '';
      const encryptedNote = note ? await encryptValueWithAesKey(note, aesKeyJwk) : '';

      // Encrypt typed & custom fields
      const fieldsPayload = { ...fields };
      if (customFields.length > 0) {
        fieldsPayload[CUSTOM_FIELDS_KEY] = serializeCustomFields(customFields);
      }
      const encryptedFields = await encryptFieldsWithAesKey(fieldsPayload, aesKeyJwk);

      // Wrap keys for authorized folder recipients
      const wrappedKeys = {};
      const targetFolder = folders.find((f) => f.id === folderId);
      const recipientIds = await getWrapRecipients(folderId, user.id, targetFolder?.permissions || []);
      const wrapped = await wrapItemKeysForUsers(aesKeyJwk, recipientIds);
      Object.assign(wrappedKeys, wrapped);

      // Always guarantee current user can unwrap
      if (!wrappedKeys[user.id] && rsaPublicKey) {
        try {
          wrappedKeys[user.id] = await wrapItemKey(aesKeyJwk, rsaPublicKey);
        } catch {
          // Skip
        }
      }

      const isLogin = itemType === 'LOGIN';
      const strengthScore = isLogin ? estimateStrength(password) : 5;
      const breach = isLogin && password ? await checkBreachedPassword(password) : { breached: false };
      const atRisk = isLogin ? (breach.breached || isPasswordAtRisk(password)) : false;

      const payload = {
        name: name.trim(),
        type: itemType,
        login: isLogin ? login.trim() : '',
        encryptedPassword,
        encryptedNote,
        encryptedFields,
        wrappedKeys: Object.keys(wrappedKeys).length > 0 ? wrappedKeys : null,
        url: isLogin ? url.trim() : '',
        vaultId: selectedVault?.id,
        folderId: folderId || null,
        isSensitive,
        strengthScore,
        atRisk,
      };

      if (mode === 'edit' && item?.id) {
        const res = await dispatch(updatePassword({ passwordId: item.id, payload }));
        if (res.error) throw new Error(res.error.message || 'Failed to update item');
      } else {
        const res = await dispatch(createPassword(payload));
        if (res.error) throw new Error(res.error.message || 'Failed to create item');
      }

      if (selectedVault?.id) {
        dispatch(fetchPasswordsByVault(selectedVault.id));
      }

      hapticSuccess();
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to encrypt and save item.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end select-none animate-fadeIn">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Editor Sheet */}
      <div className="w-full max-h-[92%] rounded-t-[32px] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl animate-slideUp overflow-hidden transition-colors duration-200">
        
        {/* Sticky Sheet Header */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 py-1 rounded-lg"
          >
            Cancel
          </button>
          <h2 className="text-sm font-black text-slate-900 dark:text-white">
            {mode === 'edit' ? 'Edit Item' : 'New Item'}
          </h2>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
          >
            {submitting ? <RefreshCw size={13} className="animate-spin" /> : <span>Save</span>}
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          
          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Item Type Picker Pills */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1 mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-800">
              {TYPES.map((t) => {
                const IconComponent = t.icon;
                const active = itemType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setItemType(t.id);
                    }}
                    className={`py-2 px-1 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1 transition ${
                      active
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <IconComponent size={14} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Item Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              Title / Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. GitHub, Netflix, Work WiFi"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* ========================================================= */}
          {/* LOGIN TYPE FIELDS */}
          {/* ========================================================= */}
          {itemType === 'LOGIN' && (
            <>
              {/* Username / Email */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                  Username or Email
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="user@example.com"
                    autoCapitalize="none"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Password Field + Generator Trigger */}
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      hapticLight();
                      setShowGenerator(!showGenerator);
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 active:scale-95 transition"
                  >
                    <Sparkles size={12} />
                    <span>{showGenerator ? 'Close Generator' : 'Generate'}</span>
                  </button>
                </div>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 font-mono transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="pt-1 px-1 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1 flex-1 mr-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${
                            i <= strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`font-bold ${strength.text || 'text-slate-500'}`}>{strength.label}</span>
                  </div>
                )}
              </div>

              {/* Inline Generator Expander */}
              {showGenerator && (
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/50 space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sliders size={13} className="text-indigo-600 dark:text-indigo-400" />
                      <span>Password Generator</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-bold inline-flex items-center gap-1 active:scale-95"
                    >
                      <RefreshCw size={11} />
                      <span>Generate</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                      <span>Length: {genLength} chars</span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="40"
                      value={genLength}
                      onChange={(e) => setGenLength(Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-700 dark:text-slate-300 font-medium pt-1">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={genSymbols}
                        onChange={(e) => setGenSymbols(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>Symbols (!@#)</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={genNumbers}
                        onChange={(e) => setGenNumbers(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>Numbers (123)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Website URL */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                  Website URL
                </label>
                <div className="relative">
                  <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </>
          )}

          {/* ========================================================= */}
          {/* CARD TYPE FIELDS */}
          {/* ========================================================= */}
          {itemType === 'CARD' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={fields.cardholderName || ''}
                  onChange={(e) => setFields({ ...fields, cardholderName: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                  Card Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={fields.cardNumber || ''}
                  onChange={(e) => setFields({ ...fields, cardNumber: e.target.value })}
                  placeholder="4532 •••• •••• 8890"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Expiration (MM/YY)
                  </label>
                  <input
                    type="text"
                    value={fields.expiration || fields.expiry || fields.expiryDate || ''}
                    onChange={(e) => setFields({ ...fields, expiration: e.target.value, expiry: e.target.value, expiryDate: e.target.value })}
                    placeholder="12/28"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-center font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    CVV / CVC
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={fields.cvv || ''}
                    onChange={(e) => setFields({ ...fields, cvv: e.target.value })}
                    placeholder="•••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 text-center font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* IDENTITY TYPE FIELDS */}
          {/* ========================================================= */}
          {itemType === 'IDENTITY' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={fields.firstName || ''}
                    onChange={(e) => setFields({ ...fields, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={fields.lastName || ''}
                    onChange={(e) => setFields({ ...fields, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                  Email
                </label>
                <input
                  type="email"
                  value={fields.email || ''}
                  onChange={(e) => setFields({ ...fields, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
                  Passport / ID Number
                </label>
                <input
                  type="text"
                  value={fields.passportNumber || ''}
                  onChange={(e) => setFields({ ...fields, passportNumber: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
          )}

          {/* Folder Assignment Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              Folder
            </label>
            <div className="relative">
              <Folder size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 appearance-none transition"
              >
                <option value="">{isPersonalVault && effectiveFolders.length === 0 ? 'Default (Personal)' : 'No Folder (Root Vault)'}</option>
                {effectiveFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Encrypted Secure Notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
              {itemType === 'SECURE_NOTE' ? 'Secure Encrypted Content *' : 'Secure Notes'}
            </label>
            <textarea
              rows={itemType === 'SECURE_NOTE' ? 6 : 3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add encrypted notes, recovery codes, or sensitive info..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-indigo-500 transition resize-none"
            />
          </div>

          {/* Custom Fields (Optional) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Custom Fields
              </label>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 active:scale-95"
              >
                <Plus size={12} />
                <span>Add Field</span>
              </button>
            </div>

            {customFields.map((cf) => (
              <div key={cf.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Field label"
                  value={cf.name}
                  onChange={(e) => handleCustomFieldChange(cf.id, 'name', e.target.value)}
                  className="w-1/3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                />
                <input
                  type={cf.isSecret ? 'password' : 'text'}
                  placeholder="Value"
                  value={cf.value}
                  onChange={(e) => handleCustomFieldChange(cf.id, 'value', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCustomField(cf.id)}
                  className="p-2 text-rose-500 hover:text-rose-700"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
