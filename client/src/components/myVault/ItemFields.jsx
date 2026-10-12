import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Sparkles, CreditCard, Landmark } from 'lucide-react';
import { TYPE_FIELDS } from '../../utils/itemTypes';
import { generatePassword } from '../../utils/passwordGenerator';
import {
  detectCardNetwork,
  luhnCheck,
  validateExpiry,
  validateCVV,
  validatePIN,
  formatCardNumber,
  formatExpiryInput,
} from '../../utils/cardValidation';

function ItemFields({ type, values, onChange, inputClass }) {
  const fields = TYPE_FIELDS[type] || [];
  const [revealedKeys, setRevealedKeys] = useState({});

  const toggleReveal = (key) => {
    setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerateForField = (key) => {
    const generated = generatePassword({
      length: 18,
      useUppercase: true,
      useLowercase: true,
      useNumbers: true,
      useSymbols: true,
    });
    onChange(key, generated);
    setRevealedKeys((prev) => ({ ...prev, [key]: true }));
  };

  const { errors, network } = useMemo(() => {
    const newErrors = {};
    let detectedNetwork = null;

    if (type === 'CARD') {
      const cardNumber = values?.cardNumber;
      const expiry = values?.expiry;
      const validFrom = values?.validFrom;
      const cvv = values?.cvv;
      const pin = values?.pin;

      if (cardNumber) {
        detectedNetwork = detectCardNetwork(cardNumber);
        if (!luhnCheck(cardNumber)) {
          newErrors.cardNumber = 'Invalid card number (check digits)';
        }
      }

      if (expiry) {
        const result = validateExpiry(expiry);
        if (!result.valid) newErrors.expiry = result.message;
      }

      if (validFrom && !/^\d{2}\/\d{2}$/.test(validFrom)) {
        newErrors.validFrom = 'Use MM/YY format';
      }

      if (cvv) {
        const result = validateCVV(cvv);
        if (!result.valid) newErrors.cvv = result.message;
      }

      if (pin) {
        const result = validatePIN(pin);
        if (!result.valid) newErrors.pin = result.message;
      }
    }

    if (type === 'BANK_ACCOUNT') {
      const mpin = values?.mpin;
      if (mpin && !/^\d{4,6}$/.test(String(mpin).trim())) {
        newErrors.mpin = 'MPIN / TPIN must be 4 to 6 digits';
      }
    }

    return { errors: newErrors, network: detectedNetwork };
  }, [type, values]);

  // Persist auto-detected card brand into form state so it gets saved in encryptedFields
  useEffect(() => {
    if (type !== 'CARD' || !onChange) return;
    const detectedBrand = network?.name || '';
    if ((values?.brand || '') !== detectedBrand) {
      onChange('brand', detectedBrand);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, network?.name]);

  if (fields.length === 0) return null;

  const displayValues = { ...values };
  if (type === 'CARD' && network) {
    displayValues.brand = network.name;
  }

  return (
    <div className="space-y-3 pt-1">
      {type === 'CARD' && (
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 text-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <CreditCard size={18} className="text-indigo-200 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                {displayValues.cardType || 'Payment Card'}
                {displayValues.issuingBank ? ` • ${displayValues.issuingBank}` : ''}
              </p>
              <p className="text-sm font-mono tracking-widest truncate mt-0.5">
                {displayValues.cardNumber
                  ? formatCardNumber(displayValues.cardNumber)
                  : '•••• •••• •••• ••••'}
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-white/15 text-xs font-bold tracking-wide">
              {network?.name || 'CARD'}
            </span>
            {displayValues.expiry && (
              <p className="text-[11px] text-indigo-200 font-mono mt-0.5">
                EXP {displayValues.expiry}
              </p>
            )}
          </div>
        </div>
      )}

      {type === 'BANK_ACCOUNT' && (
        <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-700 via-teal-700 to-slate-900 text-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <Landmark size={18} className="text-emerald-200 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200 truncate">
                {displayValues.bankName || 'Bank & NetBanking'}
                {displayValues.accountType ? ` • ${displayValues.accountType}` : ''}
              </p>
              <p className="text-sm font-mono tracking-wider truncate mt-0.5">
                {displayValues.accountNumber
                  ? `A/C: ${displayValues.accountNumber}`
                  : 'Account & NetBanking Credentials'}
              </p>
            </div>
          </div>
          {displayValues.routingNumber && (
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-white/15 text-xs font-mono font-semibold shrink-0">
              {displayValues.routingNumber}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {fields.map((field) => {
          const fieldValue = displayValues?.[field.key] ?? '';
          const isPasswordInput = field.input === 'password';
          const isRevealed = Boolean(revealedKeys[field.key]);

          const value =
            field.key === 'cardNumber' && fieldValue
              ? formatCardNumber(fieldValue)
              : fieldValue;

          const isFullWidth = Boolean(field.multiline || field.fullWidth);

          return (
            <div
              key={field.key}
              className={`flex flex-col ${isFullWidth ? 'md:col-span-2' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.canGenerate && (
                  <button
                    type="button"
                    onClick={() => handleGenerateForField(field.key)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition"
                    title={`Generate strong ${field.label}`}
                  >
                    <Sparkles size={11} />
                    Generate
                  </button>
                )}
              </div>

              {field.input === 'select' ? (
                <select
                  value={value}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Select {field.label}...</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.multiline ? (
                <div className="relative">
                  <textarea
                    rows={3}
                    value={value}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder || field.label}
                    className={`${inputClass} font-mono text-xs resize-y pr-10 ${
                      isPasswordInput && !isRevealed ? '[-webkit-text-security:disc]' : ''
                    }`}
                  />
                  {isPasswordInput && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(field.key)}
                      aria-label={isRevealed ? `Hide ${field.label}` : `Show ${field.label}`}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition"
                    >
                      {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              ) : (
                <div className="relative">
                  {field.key === 'cardNumber' && network && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-600 dark:text-indigo-400 pointer-events-none">
                      {network.name}
                    </span>
                  )}
                  <input
                    type={isPasswordInput ? (isRevealed ? 'text' : 'password') : field.input}
                    inputMode={
                      field.key === 'cardNumber' ||
                      field.key === 'cvv' ||
                      field.key === 'pin' ||
                      field.key === 'mpin'
                        ? 'numeric'
                        : undefined
                    }
                    value={value}
                    readOnly={field.readOnly}
                    onChange={
                      field.readOnly
                        ? undefined
                        : (e) => {
                            let val = e.target.value;
                            if (field.key === 'cardNumber') {
                              val = val.replace(/\D/g, '').slice(0, 19);
                            } else if (field.key === 'expiry' || field.key === 'validFrom') {
                              val = formatExpiryInput(val);
                            } else if (field.key === 'cvv') {
                              val = val.replace(/\D/g, '').slice(0, 4);
                            } else if (field.key === 'pin' || field.key === 'mpin') {
                              val = val.replace(/\D/g, '').slice(0, 6);
                            } else if (field.key === 'routingNumber' || field.key === 'swiftCode') {
                              val = val.toUpperCase();
                            }
                            onChange(field.key, val);
                          }
                    }
                    placeholder={field.placeholder || field.label}
                    className={`${inputClass} ${
                      field.key === 'cardNumber' && network ? 'pl-20' : ''
                    } ${isPasswordInput ? 'pr-10' : ''} ${
                      isPasswordInput && isRevealed ? 'font-mono tracking-wider' : ''
                    } ${
                      errors[field.key] ? 'border-red-400 dark:border-red-500' : ''
                    } ${
                      field.readOnly
                        ? 'bg-slate-50 dark:bg-slate-600/60 cursor-default text-slate-500 dark:text-slate-300'
                        : ''
                    }`}
                  />
                  {isPasswordInput && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(field.key)}
                      aria-label={isRevealed ? `Hide ${field.label}` : `Show ${field.label}`}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition"
                    >
                      {isRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  )}
                </div>
              )}

              {errors[field.key] && (
                <span className="text-xs text-red-500 dark:text-red-400 mt-1">
                  {errors[field.key]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ItemFields;
