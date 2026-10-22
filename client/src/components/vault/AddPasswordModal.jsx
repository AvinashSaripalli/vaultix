import { useEffect, useState } from 'react';
import { Eye, EyeOff, X, Sparkles } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  closeAddPasswordModal,
  createPassword,
} from '../../features/vault/vaultSlice';
import ModalPortal, { ModalBackdrop } from '../common/ModalPortal';
import ItemFormFields from '../common/ItemFormFields';
import {
  encryptValueWithAesKey,
  encryptFieldsWithAesKey,
  generateItemAesKey,
  wrapItemKey,
  decryptPrivateKey,
} from '../../utils/crypto';
import { generatePassword } from '../../utils/passwordGenerator';
import { getWrapRecipients, wrapItemKeysForUsers } from '../../utils/keyWrapping';
import { checkBreachedPassword, estimateStrength } from '../../utils/breachCheck';
import { isPasswordAtRisk } from '../../utils/passwordRisk';
import api from '../../services/api';
import {
  setSessionRsaPrivateKey,
  setSessionRsaPublicKey,
} from '../../features/auth/authSlice';
import {
  ITEM_TYPES,
  TYPE_FIELDS,
  emptyTypeFields,
  isSensitiveDefault,
  serializeCustomFields,
  CUSTOM_FIELDS_KEY,
} from '../../utils/itemTypes';
import { luhnCheck, validateExpiry, validateCVV, validatePIN } from '../../utils/cardValidation';

const SUGGESTED_TAGS = [
  'Production',
  'Testing',
  'Development',
  'Shared',
  'Private',
  'Critical',
  'Client',
  'Internal',
  'Cloud',
  'CRM',
  'Hosting',
  'Email',
  'Database',
  'Security',
  'Marketing',
  'Finance',
  'Support',
  'Temporary',
];

function AddPasswordModal({ prefill, prefillName, onPrefillConsumed }) {
  const dispatch = useDispatch();

  const {
    isAddPasswordModalOpen,
    selectedVault,
    selectedFolderId,
    actionLoading,
    folders,
  } = useSelector((state) => state.vault);

  const { user, sessionMasterPassword, sessionRsaPublicKey, sessionRsaPrivateKey } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    name: '',
    folderId: selectedFolderId || (folders[0]?.id || ''),
    type: 'LOGIN',
    login: '',
    encryptedPassword: '',
    encryptedNote: '',
    confirmPassword: '',
    url: '',
    tags: [],
    isSensitive: false,
    fields: emptyTypeFields('LOGIN'),
    customFields: [],
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const inputClass =
    'w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600';

  const effectivePrefill = prefill || (prefillName ? (typeof prefillName === 'string' ? { name: prefillName } : prefillName) : null);

  useEffect(() => {
    if (isAddPasswordModalOpen) {
      setFormData((prev) => ({
        ...prev,
        folderId: selectedFolderId || prev.folderId || (folders[0]?.id || ''),
      }));
    }
  }, [isAddPasswordModalOpen, selectedFolderId, folders]);

  useEffect(() => {
    if (isAddPasswordModalOpen && effectivePrefill) {
      setFormData((prev) => ({
        ...prev,
        name: effectivePrefill.name ?? prev.name,
        url: effectivePrefill.url ?? prev.url,
        tags: effectivePrefill.tags?.length ? effectivePrefill.tags : prev.tags,
      }));
    }
  }, [isAddPasswordModalOpen, effectivePrefill]);

  useEffect(() => {
    if (!isAddPasswordModalOpen && effectivePrefill && onPrefillConsumed) {
      onPrefillConsumed();
    }
  }, [isAddPasswordModalOpen, effectivePrefill, onPrefillConsumed]);

  if (!isAddPasswordModalOpen) return null;

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'LOGIN',
      login: '',
      encryptedPassword: '',
      encryptedNote: '',
      confirmPassword: '',
      url: '',
      tags: [],
      isSensitive: false,
      fields: emptyTypeFields('LOGIN'),
      customFields: [],
    });

    setShowPassword(false);
    setShowConfirmPassword(false);
    setLocalError('');
  };

  const handleClose = () => {
    resetForm();
    dispatch(closeAddPasswordModal());
  };

  const handleChange = (e) => {
    setLocalError('');

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleTypeChange = (e) => {
    const type = e.target.value;
    setLocalError('');
    setFormData((prev) => ({
      ...prev,
      type,
      login: '',
      encryptedPassword: '',
      confirmPassword: '',
      url: '',
      fields: emptyTypeFields(type),
      customFields: [],
      isSensitive: prev.isSensitive || isSensitiveDefault(type),
    }));
  };

  const handleFieldChange = (key, value) => {
    setLocalError('');
    setFormData((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: value },
    }));
  };

  const handleGenerate = () => {
    const pwd = generatePassword({ length: 16, useUppercase: true, useLowercase: true, useNumbers: true, useSymbols: true });
    setFormData((prev) => ({ ...prev, encryptedPassword: pwd, confirmPassword: pwd }));
    setShowPassword(true);
    setShowConfirmPassword(true);
    setLocalError('');
  };

  const validateForm = () => {
    if (!selectedVault?.id) return 'Vault is required';
    const effectiveFolderId = formData.folderId || selectedFolderId;
    if (!effectiveFolderId) return 'Please select a folder';
    if (!formData.name.trim()) return 'Password name is required';

    if (formData.type === 'LOGIN') {
      if (!formData.login.trim()) return 'Login / Email is required';
      if (!formData.encryptedPassword) return 'Password is required';
      if (formData.encryptedPassword.length < 6) {
        return 'Password must be at least 6 characters';
      }
    } else if (formData.type !== 'SECURE_NOTE') {
      const f = formData.fields || {};
      const requiredDefs = (TYPE_FIELDS[formData.type] || []).filter((field) => field.required);
      const missing = requiredDefs.filter((field) => !String(f[field.key] || '').trim());
      if (missing.length > 0) {
        return `Required fields missing: ${missing.map((m) => m.label).join(', ')}`;
      }
      if (formData.type === 'CARD') {
        if (!luhnCheck(f.cardNumber)) return 'Please enter a valid card number';
        const exp = validateExpiry(f.expiry);
        if (!exp.valid) return exp.message;
        const cvv = validateCVV(f.cvv);
        if (!cvv.valid) return cvv.message;
        if (f.pin) {
          const pin = validatePIN(f.pin);
          if (!pin.valid) return pin.message;
        }
      }
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    const effectiveFolderId = formData.folderId || selectedFolderId;

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      login: formData.type === 'LOGIN' ? formData.login.trim() : '',
      password: formData.type === 'LOGIN' ? formData.encryptedPassword : '',
      note: formData.encryptedNote || '',
      url: formData.type === 'LOGIN' ? formData.url.trim() : '',
      vaultId: selectedVault?.id,
      folderId: effectiveFolderId,
      tags: formData.tags,
      isSensitive: formData.isSensitive,
      fields: formData.fields,
      customFields: formData.customFields,
    };

    await handleAdminVerified(payload);
  };

  const handleAdminVerified = async (payload) => {
    try {
      if (!payload) return;

      let rsaPrivateKey = sessionRsaPrivateKey;
      let rsaPublicKey = sessionRsaPublicKey;

      // Self-heal: if session keys were lost (refresh, race), recover them
      // from the server-stored keypair using the session master password.
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
        } catch (err) {
          console.error('Key recovery failed:', err);
        }
      }

      if (!user?.id || !rsaPrivateKey || !rsaPublicKey) {
        setLocalError(
          'Encryption keys are not ready. Please lock the vault and re-enter your master password, then try again.'
        );
        return;
      }

      // A single item AES key encrypts the password (+ typed fields + note)
      // so every authorized user who unwraps their copy can decrypt all parts.
      const { aesKeyJwk } = await generateItemAesKey();

      const encryptedPassword = payload.password
        ? await encryptValueWithAesKey(payload.password, aesKeyJwk)
        : '';

      const encryptedNote = payload.note
        ? await encryptValueWithAesKey(payload.note, aesKeyJwk)
        : '';

      const fieldsPayload = { ...payload.fields };
      if (payload.customFields?.length) {
        fieldsPayload[CUSTOM_FIELDS_KEY] = serializeCustomFields(payload.customFields);
      }

      const encryptedFields = await encryptFieldsWithAesKey(fieldsPayload, aesKeyJwk);

      const wrappedKeys = {};
      if (aesKeyJwk) {
        // Wrap for every authorized user: folder members, admins and
        // department members — so anyone with access can decrypt.
        const targetFolder = folders.find((f) => f.id === payload.folderId) || selectedFolder;
        const recipientIds = await getWrapRecipients(
          payload.folderId,
          user.id,
          targetFolder?.permissions || []
        );

        const wrapped = await wrapItemKeysForUsers(aesKeyJwk, recipientIds);
        Object.assign(wrappedKeys, wrapped);

        // Always guarantee the creator can decrypt their own item.
        if (!wrappedKeys[user.id] && sessionRsaPublicKey) {
          try {
            wrappedKeys[user.id] = await wrapItemKey(aesKeyJwk, sessionRsaPublicKey);
          } catch {
            // skip
          }
        }
      }

      const isLogin = payload.type === 'LOGIN';
      const strengthScore = isLogin ? estimateStrength(payload.password) : 5;
      const breach = isLogin ? await checkBreachedPassword(payload.password) : { breached: false };
      const atRisk = isLogin ? (breach.breached || isPasswordAtRisk(payload.password)) : false;

      const result = await dispatch(
        createPassword({
          name: payload.name,
          type: payload.type,
          login: payload.login,
          encryptedPassword,
          encryptedNote,
          encryptedFields,
          wrappedKeys: Object.keys(wrappedKeys).length > 0 ? wrappedKeys : null,
          url: payload.url,
          vaultId: payload.vaultId,
          folderId: payload.folderId,
          tags: payload.tags,
          isSensitive: payload.isSensitive,
          strengthScore,
          isWeak: isLogin ? strengthScore <= 2 : false,
          isOld: false,
          isAtRisk: atRisk,
        })
      );

      if (createPassword.fulfilled.match(result)) {
        resetForm();
      } else {
        setLocalError(result.payload || 'Failed to create password');
      }
    } catch (err) {
      console.error('Add password failed:', err);
      setLocalError(
        err?.response?.data?.message ||
          err?.message ||
          'Encryption failed. Please try again.'
      );
    }
  };

  return (
    <ModalPortal open={isAddPasswordModalOpen} onClose={handleClose} closeOnEscape={false}>
      <ModalBackdrop onClose={handleClose} disableBackdropClick={true}>
        <div
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-4 sm:p-6 dark:bg-slate-800 max-h-[92vh] overflow-y-auto my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {effectivePrefill?.name ? `Add Login to ${effectivePrefill.name}` : 'Add Item'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-slate-400 truncate">
                {effectivePrefill?.name
                  ? `Add another account credential for ${effectivePrefill.name} in ${selectedFolder?.name || 'selected folder'}`
                  : `Add a login, card, bank account, secure note, or secret to ${selectedFolder?.name || 'selected folder'}`}
              </p>
            </div>

            <button onClick={handleClose} className="text-slate-500 dark:text-slate-400 p-1 shrink-0">
              <X size={22} />
            </button>
          </div>

          {localError && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!selectedFolderId && folders.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Folder <span className="text-red-500">*</span>
                </label>
                <select
                  name="folderId"
                  value={formData.folderId}
                  onChange={handleChange}
                  className={inputClass}
                  required
                >
                  <option value="" disabled>Select a folder</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <ItemFormFields
              formData={formData}
              onChange={(field, val) => {
                setLocalError('');
                setFormData((prev) => ({ ...prev, [field]: val }));
              }}
              onChangeType={(type) => {
                setLocalError('');
                setFormData((prev) => ({
                  ...prev,
                  type,
                  login: '',
                  encryptedPassword: '',
                  confirmPassword: '',
                  url: '',
                  fields: emptyTypeFields(type),
                  customFields: [],
                  isSensitive: prev.isSensitive || isSensitiveDefault(type),
                }));
              }}
              onChangeFields={handleFieldChange}
              onChangeCustomFields={(customFields) => {
                setLocalError('');
                setFormData((prev) => ({ ...prev, customFields }));
              }}
              showConfirmPassword={false}
              passwordFieldName="encryptedPassword"
              noteFieldName="encryptedNote"
              inputClass={inputClass}
            />

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-medium"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : effectivePrefill?.name ? 'Save Login' : 'Save Item'}
              </button>
            </div>
          </form>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}

export default AddPasswordModal;