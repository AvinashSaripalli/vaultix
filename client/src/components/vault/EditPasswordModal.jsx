import { useEffect, useState } from 'react';
import { Eye, EyeOff, X, Sparkles } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  closeEditPasswordModal,
  updatePassword,
} from '../../features/vault/vaultSlice';
import TagInput from '../common/TagInput';
import ItemFields from '../myVault/ItemFields';
import CustomFieldsInput from '../common/CustomFieldsInput';
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
  emptyTypeFields,
  isSensitiveDefault,
  serializeCustomFields,
  parseCustomFields,
  CUSTOM_FIELDS_KEY,
} from '../../utils/itemTypes';

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
    <>
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Edit Password
              </h2>
              <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                Update password details in {currentFolder?.name || 'folder'}
              </p>
            </div>

            <button onClick={handleClose} className="text-slate-500 dark:text-slate-400">
              <X size={22} />
            </button>
          </div>

          {localError && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {localError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 dark:text-slate-400">
                  Item type
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleTypeChange}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                >
                  {ITEM_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 dark:text-slate-400">
                  Name
                </label>
                <input
                  name="name"
                  type="text"
                  placeholder="Item name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 dark:text-slate-400">
                  Folder
                </label>
                <select
                  name="folderId"
                  value={formData.folderId}
                  onChange={handleChange}
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  required
                >
                  <option value="">Select folder</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.type === 'LOGIN' ? (
                <>
                  <input
                    name="login"
                    type="text"
                    placeholder="Login / Email"
                    value={formData.login}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                    required
                  />

                  <div className="relative">
                    <input
                      name="encryptedPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={formData.encryptedPassword}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-xl px-4 pr-20 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleGenerate}
                      title="Generate strong password"
                      className="absolute right-10 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50 flex items-center justify-center"
                    >
                      <Sparkles size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      name="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="w-full border border-slate-300 rounded-xl px-4 pr-12 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                      required
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  <input
                    name="url"
                    type="text"
                    placeholder="URL"
                    value={formData.url}
                    onChange={handleChange}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                  />
                </>
              ) : (
                <div className="sm:col-span-2">
                  <ItemFields
                    type={formData.type}
                    values={formData.fields}
                    onChange={handleFieldChange}
                    inputClass={inputClass}
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <CustomFieldsInput
                  fields={formData.customFields}
                  onChange={(newFields) =>
                    setFormData((prev) => ({ ...prev, customFields: newFields }))
                  }
                  inputClass={inputClass}
                />
              </div>

              <textarea
                name="encryptedNote"
                placeholder="Note"
                value={formData.encryptedNote}
                onChange={handleChange}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 min-h-[90px] sm:col-span-2"
              />

              <div className="sm:col-span-2">
                <TagInput
                  tags={formData.tags}
                  setTags={(newTags) => setFormData((prev) => ({ ...prev, tags: newTags }))}
                  suggestions={SUGGESTED_TAGS}
                />
              </div>

              <label className="flex items-center gap-3 sm:col-span-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.isSensitive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isSensitive: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                    Secure — require master password verification before revealing
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Users must verify their master password every time they view or copy this password
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-600"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={actionLoading}
                className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium disabled:opacity-50"
              >
                {actionLoading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default EditPasswordModal;