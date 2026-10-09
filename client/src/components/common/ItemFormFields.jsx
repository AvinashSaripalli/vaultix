import { useState } from 'react';
import { Eye, EyeOff, Sparkles, FolderDown } from 'lucide-react';
import ItemFields from '../myVault/ItemFields';
import CustomFieldsInput from './CustomFieldsInput';
import PasswordStrengthBar from './PasswordStrengthBar';
import TagInput from './TagInput';
import { generatePassword } from '../../utils/passwordGenerator';
import {
  ITEM_TYPES,
  emptyTypeFields,
  isSensitiveDefault,
  getTypePlaceholder,
} from '../../utils/itemTypes';

export const DEFAULT_SUGGESTED_TAGS = [
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

const DEFAULT_INPUT_CLASS =
  'w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600';

function ItemFormFields({
  formData,
  onChange,
  onChangeType,
  onChangeFields,
  onChangeCustomFields,
  folders = [],
  showFolderSelect = false,
  showTypeSelector = true,
  isTypeDisabled = false,
  showConfirmPassword = false,
  suggestedTags = DEFAULT_SUGGESTED_TAGS,
  inputClass = DEFAULT_INPUT_CLASS,
  passwordFieldName = 'password',
  noteFieldName = 'note',
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPasswordState, setShowConfirmPasswordState] = useState(false);

  const currentType = formData.type || 'LOGIN';
  const currentPassword = formData[passwordFieldName] || '';
  const currentNote = formData[noteFieldName] || '';

  const handleTypeSelect = (newType) => {
    if (isTypeDisabled) return;
    if (onChangeType) {
      onChangeType(newType);
    } else {
      onChange('type', newType);
      if (onChangeFields) {
        onChange('fields', emptyTypeFields(newType));
      }
      onChange('isSensitive', isSensitiveDefault(newType));
    }
  };

  const handleGeneratePassword = () => {
    const generated = generatePassword({
      length: 16,
      numbers: true,
      symbols: true,
      uppercase: true,
      lowercase: true,
    });
    onChange(passwordFieldName, generated);
    if (showConfirmPassword) {
      onChange('confirmPassword', generated);
    }
    setShowPassword(true);
  };

  return (
    <div className="space-y-4">
      {/* Item Type Picker */}
      {showTypeSelector && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5 dark:text-slate-300">
            Item Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ITEM_TYPES.map((t) => {
              const active = currentType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  disabled={isTypeDisabled}
                  onClick={() => handleTypeSelect(t.value)}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                    active
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-500 dark:text-indigo-300'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
                  } ${isTypeDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional Folder Select */}
      {showFolderSelect && folders.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 dark:text-slate-300">
            Folder
          </label>
          <div className="relative">
            <select
              value={formData.folderId || ''}
              onChange={(e) => onChange('folderId', e.target.value)}
              className={`${inputClass} pr-10 cursor-pointer`}
            >
              <option value="">(No folder / Vault root)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <FolderDown
              size={18}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* Title / Name */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1 dark:text-slate-300">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder={getTypePlaceholder(currentType)}
          value={formData.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          className={inputClass}
          required
        />
      </div>

      {/* Username / Login (for types that have login) */}
      {currentType !== 'SECURE_NOTE' && currentType !== 'CARD' && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 dark:text-slate-300">
            Username / Login
          </label>
          <input
            type="text"
            placeholder="e.g. user@example.com"
            value={formData.login || ''}
            onChange={(e) => onChange('login', e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {/* Primary Password / Secret */}
      {currentType !== 'SECURE_NOTE' && currentType !== 'IDENTITY' && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {currentType === 'API_TOKEN'
                ? 'API Token / Secret Key'
                : currentType === 'SSH_KEY'
                ? 'Private Key / Passphrase'
                : 'Password'}
            </label>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition"
              title="Generate strong random password"
            >
              <Sparkles size={13} />
              Generate
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter or generate secret"
              value={currentPassword}
              onChange={(e) => onChange(passwordFieldName, e.target.value)}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {currentPassword && (
            <div className="mt-2">
              <PasswordStrengthBar password={currentPassword} />
            </div>
          )}
        </div>
      )}

      {/* Confirm Password (when required) */}
      {showConfirmPassword && currentType === 'LOGIN' && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 dark:text-slate-300">
            Confirm Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPasswordState ? 'text' : 'password'}
              placeholder="Confirm password"
              value={formData.confirmPassword || ''}
              onChange={(e) => onChange('confirmPassword', e.target.value)}
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPasswordState((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition"
            >
              {showConfirmPasswordState ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      )}

      {/* URL / Website */}
      {currentType !== 'SECURE_NOTE' && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 dark:text-slate-300">
            Website URL / Host
          </label>
          <input
            type="text"
            placeholder="https://example.com"
            value={formData.url || ''}
            onChange={(e) => onChange('url', e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {/* Typed Fields (Card number, CVV, expiry, wifi ssid, identity fields, etc.) */}
      {formData.fields && (
        <ItemFields
          type={currentType}
          values={formData.fields}
          onChange={onChangeFields}
          inputClass={inputClass}
        />
      )}

      {/* Custom Key-Value Fields */}
      <CustomFieldsInput
        fields={formData.customFields || []}
        onChange={onChangeCustomFields}
        inputClass={inputClass}
      />

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1 dark:text-slate-300">
          Notes
        </label>
        <textarea
          rows={currentType === 'SECURE_NOTE' ? 6 : 3}
          placeholder="Secure notes or additional info"
          value={currentNote}
          onChange={(e) => onChange(noteFieldName, e.target.value)}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1 dark:text-slate-300">
          Tags
        </label>
        <TagInput
          tags={formData.tags || []}
          onChange={(nextTags) => onChange('tags', nextTags)}
          suggestions={suggestedTags}
        />
      </div>

      {/* Sensitive Item Toggle */}
      <div className="pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(formData.isSensitive)}
            onChange={(e) => onChange('isSensitive', e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Require master password verification to view / reveal
          </span>
        </label>
      </div>
    </div>
  );
}

export default ItemFormFields;
