import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { useSelector } from 'react-redux';
import TagInput from '../common/TagInput';
import ItemFields from './ItemFields';
import CustomFieldsInput from '../common/CustomFieldsInput';
import {
  decryptText,
  encryptText,
  decryptFields,
  encryptFields,
  isEncryptedFormat,
} from '../../utils/crypto';
import { estimateStrength, checkBreachedPassword } from '../../utils/breachCheck';
import { isPasswordOld, isPasswordAtRisk } from '../../utils/passwordRisk';
import {
  ITEM_TYPES,
  getTypePlaceholder,
  emptyTypeFields,
  serializeCustomFields,
  parseCustomFields,
  CUSTOM_FIELDS_KEY,
} from '../../utils/itemTypes';

function EditMyVaultPasswordModal({
  open,
  password,
  folders,
  onClose,
  onSubmit,
}) {
  const { user, sessionMasterPassword } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    folderId: '',
    type: 'LOGIN',
    parentId: null,
    name: '',
    login: '',
    encryptedPassword: '',
    url: '',
    encryptedNote: '',
    tags: [],
    isSensitive: false,
    fields: {},
    customFields: [],
  });

  const [showPassword, setShowPassword] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState('');

  useEffect(() => {
    if (!password) return;

    setDecryptError('');

    const base = {
      folderId: password.folderId || '',
      type: password.type || 'LOGIN',
      parentId: password.parentId || null,
      name: password.name || '',
      login: password.login || '',
      url: password.url || '',
      tags: password.tags?.map((item) => item.tag?.name).filter(Boolean) || [],
      isSensitive: password.isSensitive || false,
      customFields: [],
    };

    if (!sessionMasterPassword) {
      setFormData({
        ...base,
        encryptedPassword: '',
        encryptedNote: '',
        fields: {},
      });
      setDecryptError('Session expired. Re-enter your master password to access encrypted fields, or type new values below.');
      return;
    }

    const initForm = async () => {
      setDecrypting(true);

      try {
        const isEncryptedPw = isEncryptedFormat(password.encryptedPassword);
        const plainPassword = isEncryptedPw
          ? await decryptText(password.encryptedPassword, sessionMasterPassword, user?.encryptionSalt)
          : password.encryptedPassword || '';

        const plainNote = password.encryptedNote && isEncryptedFormat(password.encryptedNote)
          ? await decryptText(password.encryptedNote, sessionMasterPassword, user?.encryptionSalt)
          : password.encryptedNote || '';

        const plainFields = password.encryptedFields
          ? (await decryptFields(password.encryptedFields, sessionMasterPassword, user?.encryptionSalt)) || {}
          : {};

        const { [CUSTOM_FIELDS_KEY]: customRaw, ...typedFields } = plainFields;

        setFormData({
          ...base,
          encryptedPassword: plainPassword,
          encryptedNote: plainNote,
          fields: typedFields,
          customFields: parseCustomFields(customRaw),
        });
      } catch {
        setFormData({
          ...base,
          encryptedPassword: '',
          encryptedNote: '',
          fields: {},
          customFields: [],
        });
        setDecryptError('Could not decrypt. Your session may have expired. Type new values below.');
      } finally {
        setDecrypting(false);
      }
    };

    initForm();

    setShowPassword(false);
  }, [password, sessionMasterPassword, user?.encryptionSalt]);

  if (!open) return null;

  const inputClass =
    'w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600';

  const updateField = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateTypeField = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: value },
    }));
  };

  const handleTypeChange = (e) => {
    const nextType = e.target.value;
    setFormData((prev) => ({
      ...prev,
      type: nextType,
      fields: emptyTypeFields(nextType),
      customFields: [],
    }));
  };

  const handleClose = () => {
    setShowPassword(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setDecryptError('Name is required');
      return;
    }

    if (formData.type === 'LOGIN' && (!formData.login || !formData.encryptedPassword)) {
      setDecryptError('Login and password are required for a login item');
      return;
    }

    if (!sessionMasterPassword) {
      setDecryptError('Session expired. Please re-enter your master password.');
      return;
    }

    try {
      const isLogin = formData.type === 'LOGIN';

      const encryptedPassword = isLogin
        ? await encryptText(formData.encryptedPassword, sessionMasterPassword, user?.encryptionSalt)
        : formData.encryptedPassword
          ? await encryptText(formData.encryptedPassword, sessionMasterPassword, user?.encryptionSalt)
          : '';

      const encryptedNote = formData.encryptedNote
        ? await encryptText(formData.encryptedNote, sessionMasterPassword, user?.encryptionSalt)
        : '';

      const fieldsPayload = { ...formData.fields };
      if (formData.customFields?.length) {
        fieldsPayload[CUSTOM_FIELDS_KEY] = serializeCustomFields(formData.customFields);
      }

      const encryptedFields = await encryptFields(
        fieldsPayload,
        sessionMasterPassword,
        user?.encryptionSalt
      );

      const strengthScore = isLogin ? estimateStrength(formData.encryptedPassword) : 0;

      const atRisk = isLogin
        ? ((await checkBreachedPassword(formData.encryptedPassword)).breached) ||
          isPasswordAtRisk(formData.encryptedPassword)
        : false;

      onSubmit({
        folderId: formData.folderId,
        parentId: formData.parentId,
        type: formData.type,
        name: formData.name.trim(),
        login: isLogin ? formData.login : '',
        url: isLogin ? formData.url : '',
        encryptedPassword,
        encryptedNote,
        encryptedFields,
        tags: formData.tags,
        isSensitive: formData.isSensitive,
        strengthScore,
        isWeak: strengthScore <= 2,
        isOld: isLogin ? isPasswordOld(password.lastUpdatedAt, password.createdAt) : false,
        isAtRisk: atRisk,
      });

      setShowPassword(false);
    } catch {
      setDecryptError('Encryption failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto dark:bg-slate-800">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Edit Password
            </h2>

            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
              Update password details in Personal Vault
            </p>
          </div>

          <button
            onClick={handleClose}
            className="h-9 w-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {decrypting && (
          <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-800 dark:bg-indigo-900/20">
            <p className="text-sm text-indigo-600 dark:text-indigo-400">Decrypting item…</p>
          </div>
        )}

        {decryptError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm text-amber-700 dark:text-amber-400">{decryptError}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select
              value={formData.type}
              onChange={handleTypeChange}
              className={inputClass}
            >
              {ITEM_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={formData.folderId}
              onChange={(e) => updateField('folderId', e.target.value)}
              className={inputClass}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder={getTypePlaceholder(formData.type)}
            className={inputClass}
          />

          {formData.type === 'LOGIN' ? (
            <div className="grid grid-cols-2 gap-4">
              <input
                value={formData.login}
                onChange={(e) => updateField('login', e.target.value)}
                placeholder="Login"
                className={inputClass}
              />

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.encryptedPassword}
                  onChange={(e) => updateField('encryptedPassword', e.target.value)}
                  placeholder="Password"
                  className={`${inputClass} pr-11`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <input
                value={formData.url}
                onChange={(e) => updateField('url', e.target.value)}
                placeholder="URL"
                className={inputClass}
              />

              <input
                type="text"
                value={formData.fields?.totpSecret || ''}
                onChange={(e) => updateTypeField('totpSecret', e.target.value)}
                placeholder="TOTP / Authenticator secret (optional)"
                className={inputClass}
              />
            </div>
          ) : (
            <ItemFields
              type={formData.type}
              values={formData.fields}
              onChange={updateTypeField}
              inputClass={inputClass}
            />
          )}

          <CustomFieldsInput
            fields={formData.customFields}
            onChange={(newFields) => updateField('customFields', newFields)}
            inputClass={inputClass}
          />

          <TagInput
            tags={formData.tags}
            setTags={(newTags) => updateField('tags', newTags)}
          />

          <textarea
            rows={2}
            value={formData.encryptedNote}
            onChange={(e) => updateField('encryptedNote', e.target.value)}
            placeholder={formData.type === 'SECURE_NOTE' ? 'Note contents' : 'Note'}
            className={`${inputClass} resize-none`}
          />

          {formData.type !== 'SECURE_NOTE' && (
            <label className="flex items-center gap-3 cursor-pointer select-none rounded-lg border border-slate-300 px-4 py-3 dark:border-slate-600">
              <input
                type="checkbox"
                checked={formData.isSensitive}
                onChange={(e) => updateField('isSensitive', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Secure — always ask master password before revealing this item
              </span>
            </label>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>

            <button
              onClick={handleSubmit}
              disabled={decrypting}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-60"
            >
              {decrypting ? <>&#9889; Processing…</> : <><KeyRound size={16} /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditMyVaultPasswordModal;
