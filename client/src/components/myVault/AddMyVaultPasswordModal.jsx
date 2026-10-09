import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Lock, X, Eye, EyeOff, FolderDown, Sparkles } from 'lucide-react';
import { useSelector } from 'react-redux';
import ModalPortal from '../common/ModalPortal';
import ItemFormFields from '../common/ItemFormFields';
import { encryptText, encryptFields } from '../../utils/crypto';
import { generatePassword } from '../../utils/passwordGenerator';
import { estimateStrength, checkBreachedPassword } from '../../utils/breachCheck';
import { isPasswordAtRisk } from '../../utils/passwordRisk';
import {
  ITEM_TYPES,
  emptyTypeFields,
  isSensitiveDefault,
  getTypePlaceholder,
  serializeCustomFields,
  CUSTOM_FIELDS_KEY,
} from '../../utils/itemTypes';

function AddMyVaultPasswordModal({
  open,
  folders,
  selectedFolder,
  parent,
  initialType = 'LOGIN',
  onClose,
  onSubmit,
}) {
  const { user, sessionMasterPassword } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    folderId: '',
    type: initialType,
    parentId: null,
    name: '',
    login: '',
    encryptedPassword: '',
    url: '',
    encryptedNote: '',
    tags: [],
    isSensitive: isSensitiveDefault(initialType),
    fields: emptyTypeFields(initialType),
    customFields: [],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [masterError, setMasterError] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!open) return;

    const type = initialType;
    const baseFolder = parent?.folderId || selectedFolder?.id || '';

    setFormData({
      folderId: baseFolder,
      type,
      parentId: parent?.id || null,
      name: '',
      login: '',
      encryptedPassword: '',
      url: '',
      encryptedNote: '',
      tags: [],
      isSensitive: isSensitiveDefault(type),
      fields: emptyTypeFields(type),
      customFields: [],
    });
    setShowPassword(false);
    setMasterError('');
    setFormError('');
  }, [open, parent, selectedFolder, initialType]);

  const fieldsValid = useMemo(() => {
    if (formData.type !== 'CARD') return true;
    const f = formData.fields;
    if (!f) return true;
    const errors = [];
    if (f.cardNumber && !/^\d{13,19}$/.test(f.cardNumber.replace(/[\s-]/g, ''))) errors.push('cardNumber');
    if (f.expiry && !/^\d{1,2}\s*\/\s*\d{2}$/.test(f.expiry)) errors.push('expiry');
    if (f.cvv && !/^\d{3,4}$/.test(f.cvv)) errors.push('cvv');
    return errors.length === 0;
  }, [formData.type, formData.fields]);

  if (!open) return null;

  const inputClass =
    'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600';

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateTypeField = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      fields: { ...prev.fields, [key]: value },
    }));
  };

  const changeType = (type) => {
    setFormData((prev) => ({
      ...prev,
      type,
      fields: emptyTypeFields(type),
      isSensitive: isSensitiveDefault(type),
      customFields: [],
    }));
  };

  const handleClose = () => {
    setShowPassword(false);
    setMasterError('');
    setFormError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!formData.folderId) {
      setFormError('Please select a folder');
      return;
    }

    if (!formData.name.trim()) {
      setFormError('Name is required');
      return;
    }

    if (formData.type === 'LOGIN' && (!formData.login || !formData.encryptedPassword)) {
      setFormError('Login and password are required for a login item');
      return;
    }

    if (formData.type === 'LOGIN' && !formData.encryptedPassword) {
      setFormError('Password is required for a login item');
      return;
    }

    if (formData.type !== 'LOGIN' && formData.type !== 'SECURE_NOTE' && !fieldsValid) {
      setFormError('Please fix the validation errors in the fields above');
      return;
    }

    if (!sessionMasterPassword) {
      setMasterError('Session expired. Please re-enter your master password.');
      return;
    }

    try {
      setEncrypting(true);
      setMasterError('');
      setFormError('');

      const isLogin = formData.type === 'LOGIN';

      const encryptedPassword = isLogin
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

      const payload = {
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
        isOld: false,
        isAtRisk: atRisk,
      };

      onSubmit(payload);
      setShowPassword(false);
    } catch {
      setMasterError('Encryption failed. Please re-enter your master password.');
    } finally {
      setEncrypting(false);
    }
  };

  return (
    <ModalPortal open={open} onClose={handleClose}>
      <div
        className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={handleClose}
      >
        <div
          className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto dark:bg-slate-800 dark:border-slate-700 my-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {parent ? `Add password to ${parent.name}` : 'Add Password'}
            </h2>
            <p className="text-sm text-slate-500 mt-1 dark:text-slate-400">
              Create a new password in Personal Vault
            </p>
          </div>
          <button
            onClick={handleClose}
            className="h-9 w-9 rounded-lg hover:bg-slate-100 flex items-center justify-center dark:hover:bg-slate-700"
          >
            <X size={19} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <ItemFormFields
            formData={formData}
            onChange={(field, val) => updateField(field, val)}
            onChangeType={changeType}
            onChangeFields={updateTypeField}
            onChangeCustomFields={(fields) => updateField('customFields', fields)}
            folders={folders}
            showFolderSelect={!parent}
            showConfirmPassword={false}
            passwordFieldName="encryptedPassword"
            noteFieldName="encryptedNote"
            inputClass={inputClass}
          />

          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            </div>
          )}

          {masterError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600 dark:text-red-400">{masterError}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleClose}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={encrypting}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
            >
              {encrypting ? (
                <><Lock size={16} className="animate-spin" /> Encrypting...</>
              ) : (
                <><KeyRound size={16} /> Save Item</>
              )}
            </button>
          </div>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}

export default AddMyVaultPasswordModal;
