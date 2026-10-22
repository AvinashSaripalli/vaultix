import { useEffect, useState } from 'react';
import { Eye, EyeOff, X, Sparkles } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  closeEditPasswordModal,
  updatePassword,
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
import { getWrapRecipients, wrapItemKeysForUsers } from '../../utils/keyWrapping';
import { checkBreachedPassword, estimateStrength } from '../../utils/breachCheck';
import { isPasswordOld, isPasswordAtRisk } from '../../utils/passwordRisk';
import {
  clearCompanyPasswordEditCache,
  getCompanyPasswordEditCache,
} from '../../utils/companyPasswordEditCache';
import api from '../../services/api';
import {
  setSessionRsaPrivateKey,
  setSessionRsaPublicKey,
} from '../../features/auth/authSlice';
import { generatePassword } from '../../utils/passwordGenerator';
import {
  ITEM_TYPES,
  TYPE_FIELDS,
  emptyTypeFields,
  isSensitiveDefault,
  serializeCustomFields,
  parseCustomFields,
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

function EditPasswordModal() {
  const dispatch = useDispatch();

  const {
    isEditPasswordModalOpen,
    passwords,
    selectedPasswordId,
    actionLoading,
    folders,
  } = useSelector((state) => state.vault);

  const { user, sessionMasterPassword, sessionRsaPublicKey, sessionRsaPrivateKey } = useSelector((state) => state.auth);

  const selectedPassword = passwords.find(
    (item) => item.id === selectedPasswordId
  );

  const [formData, setFormData] = useState({
    name: '',
    type: 'LOGIN',
    login: '',
    encryptedPassword: '',
    encryptedNote: '',
    confirmPassword: '',
    url: '',
    folderId: '',
    tags: [],
    isSensitive: false,
    fields: {},
    customFields: [],
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const inputClass =
    'w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600';

  const currentFolder = folders.find((f) => f.id === formData.folderId);

  useEffect(() => {
    if (selectedPassword) {
      const cached = getCompanyPasswordEditCache(selectedPassword.id);
      const cachedFields = cached?.fields || {};
      const { [CUSTOM_FIELDS_KEY]: customRaw, ...typedFields } = cachedFields;

      setFormData({
        name: selectedPassword.name || '',
        type: selectedPassword.type || 'LOGIN',
        login: selectedPassword.login || '',
        encryptedPassword: cached?.password || '',
        encryptedNote: cached?.note || '',
        confirmPassword: cached?.password || '',
        url: selectedPassword.url || '',
        folderId: selectedPassword.folderId || '',
        tags:
          selectedPassword.tags
            ?.map((item) => item.tag?.name)
            .filter(Boolean) || [],
        isSensitive: selectedPassword.isSensitive || false,
        fields: typedFields || {},
        customFields: parseCustomFields(customRaw),
      });

      setLocalError('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [selectedPassword, isEditPasswordModalOpen]);

  if (!isEditPasswordModalOpen || !selectedPassword) return null;

  const handleClose = () => {
    clearCompanyPasswordEditCache(selectedPassword.id);
    setLocalError('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    dispatch(closeEditPasswordModal());
  };

  const handleChange = (e) => {
    setLocalError('');

    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleGenerate = () => {
    const pwd = generatePassword({ length: 16, useUppercase: true, useLowercase: true, useNumbers: true, useSymbols: true });
    setFormData((prev) => ({ ...prev, encryptedPassword: pwd, confirmPassword: pwd }));
    setShowPassword(true);
    setShowConfirmPassword(true);
    setLocalError('');
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

  const validateForm = () => {
    if (!formData.name.trim()) return 'Item name is required';
    if (!formData.folderId) return 'Folder is required';

    if (formData.type === 'LOGIN') {
      if (!formData.login.trim()) return 'Login is required';
      if (!formData.encryptedPassword) return 'Password is required';
      if (formData.encryptedPassword.length < 6) {
        return 'Password must be at least 6 characters';
      }
      if (formData.encryptedPassword !== formData.confirmPassword) {
        return 'Password and confirm password do not match';
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

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      login: formData.type === 'LOGIN' ? formData.login.trim() : '',
      password: formData.type === 'LOGIN' ? formData.encryptedPassword : '',
      note: formData.encryptedNote || '',
      url: formData.type === 'LOGIN' ? formData.url.trim() : '',
      folderId: formData.folderId,
      tags: formData.tags,
      isSensitive: formData.isSensitive,
      fields: formData.fields,
      customFields: formData.customFields,
    };

    await handleAdminVerified(payload);
  };

  const handleAdminVerified = async (formDataPayload) => {
    try {
      if (!formDataPayload) return;

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

      const encryptedPassword = formDataPayload.password
        ? await encryptValueWithAesKey(formDataPayload.password, aesKeyJwk)
        : '';

      const encryptedNote = formDataPayload.note
        ? await encryptValueWithAesKey(formDataPayload.note, aesKeyJwk)
        : '';

      const fieldsPayload = { ...formDataPayload.fields };
      if (formDataPayload.customFields?.length) {
        fieldsPayload[CUSTOM_FIELDS_KEY] = serializeCustomFields(formDataPayload.customFields);
      }

      const encryptedFields = await encryptFieldsWithAesKey(fieldsPayload, aesKeyJwk);

      const wrappedKeys = {};
      if (aesKeyJwk) {
        // Wrap for every authorized user: folder members, admins and
        // department members — so anyone with access can decrypt.
        const recipientIds = await getWrapRecipients(
          formDataPayload.folderId,
          user.id,
          currentFolder?.permissions || []
        );

        const wrapped = await wrapItemKeysForUsers(aesKeyJwk, recipientIds);
        Object.assign(wrappedKeys, wrapped);

        // Always guarantee the current editor can decrypt afterwards.
        if (!wrappedKeys[user.id] && sessionRsaPublicKey) {
          try {
            wrappedKeys[user.id] = await wrapItemKey(aesKeyJwk, sessionRsaPublicKey);
          } catch {
            // skip
          }
        }
      }

      const isLogin = formDataPayload.type === 'LOGIN';
      const strengthScore = isLogin ? estimateStrength(formDataPayload.password) : 5;

      const breach = isLogin
        ? await checkBreachedPassword(formDataPayload.password)
        : { breached: false };
      const atRisk = isLogin
        ? ((formDataPayload.password && breach.breached) ||
          isPasswordAtRisk(formDataPayload.password))
        : false;

      const resultPayload = {
        name: formDataPayload.name,
        type: formDataPayload.type,
        login: formDataPayload.login,
        encryptedPassword,
        encryptedNote,
        encryptedFields,
        wrappedKeys: Object.keys(wrappedKeys).length > 0 ? wrappedKeys : null,
        url: formDataPayload.url,
        folderId: formDataPayload.folderId,
        tags: formDataPayload.tags,
        isSensitive: formDataPayload.isSensitive,
        strengthScore,
        isWeak: strengthScore <= 2,
        isOld: isPasswordOld(selectedPassword.lastUpdatedAt, selectedPassword.createdAt),
        isAtRisk: atRisk,
      };

      const result = await dispatch(
        updatePassword({
          passwordId: selectedPassword.id,
          payload: resultPayload,
        })
      );

      if (updatePassword.fulfilled.match(result)) {
        clearCompanyPasswordEditCache(selectedPassword.id);
        dispatch(closeEditPasswordModal());
      } else {
        setLocalError(result.payload || 'Failed to update password');
      }
    } catch (err) {
      console.error('Update password failed:', err);
      setLocalError(
        err?.response?.data?.message ||
          err?.message ||
          'Encryption failed. Please try again.'
      );
    }
  };

  return (
    <ModalPortal open={isEditPasswordModalOpen} onClose={handleClose} closeOnEscape={false}>
      <ModalBackdrop onClose={handleClose} disableBackdropClick={true}>
        <div
          className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-4 sm:p-6 dark:bg-slate-800 max-h-[92vh] overflow-y-auto my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 mb-5 sm:mb-6">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Edit Password
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-slate-400 truncate">
                Update password details in {currentFolder?.name || 'folder'}
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
              folders={folders}
              showFolderSelect={true}
              showConfirmPassword={formData.type === 'LOGIN'}
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
                {actionLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </ModalBackdrop>
    </ModalPortal>
  );
}

export default EditPasswordModal;