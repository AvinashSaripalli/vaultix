import { useState } from 'react';
import { Eye, EyeOff, Sparkles, FolderDown, SlidersHorizontal, RefreshCw } from 'lucide-react';
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
  const [showGenOptions, setShowGenOptions] = useState(false);
  const [genLength, setGenLength] = useState(20);
  const [genUppercase, setGenUppercase] = useState(true);
  const [genLowercase, setGenLowercase] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genExcludeAmbiguous, setGenExcludeAmbiguous] = useState(false);

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

  const handleGeneratePassword = (opts = {}) => {
    const config = {
      length: opts.length ?? genLength,
      useUppercase: opts.useUppercase ?? genUppercase,
      useLowercase: opts.useLowercase ?? genLowercase,
      useNumbers: opts.useNumbers ?? genNumbers,
      useSymbols: opts.useSymbols ?? genSymbols,
      excludeAmbiguous: opts.excludeAmbiguous ?? genExcludeAmbiguous,
    };
    const generated = generatePassword(config);
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
              {currentType === 'API_TOKEN'
                ? 'API Token / Secret Key'
                : currentType === 'SSH_KEY'
                ? 'Private Key / Passphrase'
                : 'Password'}
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleGeneratePassword()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition"
                title="Generate password with current settings"
              >
                <Sparkles size={13} />
                Generate
              </button>
              <button
                type="button"
                onClick={() => setShowGenOptions((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border transition ${
                  showGenOptions
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
                title="Customize generator settings"
              >
                <SlidersHorizontal size={13} />
                Options
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter or generate secret"
              value={currentPassword}
              onChange={(e) => onChange(passwordFieldName, e.target.value)}
              className={`${inputClass} pr-12 ${showPassword ? 'font-mono tracking-wider' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Inline Generator Controls Drawer */}
          {showGenOptions && (
            <div className="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3 dark:border-slate-700 dark:bg-slate-800/60 animate-slide-up">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Length</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-750 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    {genLength}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleGeneratePassword()}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition"
                    title="Regenerate"
                  >
                    <RefreshCw size={13} />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={genLength}
                onChange={(e) => {
                  const len = Number(e.target.value);
                  setGenLength(len);
                  handleGeneratePassword({ length: len });
                }}
                className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 dark:bg-slate-700"
              />

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { key: 'upper', label: 'A-Z', state: genUppercase, set: setGenUppercase, prop: 'useUppercase' },
                  { key: 'lower', label: 'a-z', state: genLowercase, set: setGenLowercase, prop: 'useLowercase' },
                  { key: 'nums', label: '0-9', state: genNumbers, set: setGenNumbers, prop: 'useNumbers' },
                  { key: 'syms', label: '!@#', state: genSymbols, set: setGenSymbols, prop: 'useSymbols' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      const next = !item.state;
                      item.set(next);
                      handleGeneratePassword({ [item.prop]: next });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                      item.state
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                        : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const next = !genExcludeAmbiguous;
                    setGenExcludeAmbiguous(next);
                    handleGeneratePassword({ excludeAmbiguous: next });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                    genExcludeAmbiguous
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-600 dark:text-indigo-300'
                      : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                  title="Avoid similar characters (1, l, I, 0, O)"
                >
                  No Ambiguous
                </button>
              </div>
            </div>
          )}

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
              className={`${inputClass} pr-12 ${showConfirmPasswordState ? 'font-mono tracking-wider' : ''}`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPasswordState((prev) => !prev)}
              aria-label={showConfirmPasswordState ? 'Hide confirm password' : 'Show confirm password'}
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
