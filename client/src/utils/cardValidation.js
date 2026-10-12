/**
 * Card validation utilities for the Vaultix password manager.
 * Provides Luhn algorithm, expiry validation, and card network detection.
 */

/**
 * Detect card network from card number.
 * Returns { name, icon, pattern } or null.
 */
export function detectCardNetwork(cardNumber) {
  if (!cardNumber) return null;

  const cleaned = cardNumber.replace(/[\s-]/g, '');

  if (/^4[0-9]{5,}$/.test(cleaned)) {
    return { name: 'Visa', icon: 'visa', pattern: /^4/ };
  }
  if (/^5[1-5][0-9]{4,}$/.test(cleaned) || /^2[2-7][0-9]{4,}$/.test(cleaned)) {
    return { name: 'Mastercard', icon: 'mastercard', pattern: /^(?:5[1-5]|2[2-7])/ };
  }
  if (/^3[47][0-9]{4,}$/.test(cleaned)) {
    return { name: 'Amex', icon: 'amex', pattern: /^3[47]/ };
  }
  if (/^(?:60|6521|6522|508[5-9]|353|356|81|82)[0-9]{4,}$/.test(cleaned)) {
    return { name: 'RuPay', icon: 'rupay', pattern: /^(?:60|6521|6522|508[5-9]|353|356|81|82)/ };
  }
  if (/^3(?:0[0-5]|[68][0-9])[0-9]{4,}$/.test(cleaned)) {
    return { name: 'Diners Club', icon: 'diners', pattern: /^3(?:0[0-5]|[68])/ };
  }
  if (/^6(?:011|5[0-9]{2})[0-9]{4,}$/.test(cleaned)) {
    return { name: 'Discover', icon: 'discover', pattern: /^6(?:011|5)/ };
  }
  if (/^(?:2131|1800|35\d{3})\d{4,}$/.test(cleaned)) {
    return { name: 'JCB', icon: 'jcb', pattern: /^(?:2131|1800|35)/ };
  }
  if (/^63[7-9][0-9]{4,}$/.test(cleaned)) {
    return { name: 'UnionPay', icon: 'unionpay', pattern: /^63[7-9]/ };
  }

  return null;
}

/**
 * Luhn algorithm check for card number validity.
 * Returns true if the number passes the Luhn check.
 */
export function luhnCheck(cardNumber) {
  if (!cardNumber) return false;

  const cleaned = cardNumber.replace(/[\s-]/g, '');

  if (!/^\d+$/.test(cleaned) || cleaned.length < 13 || cleaned.length > 19) {
    return false;
  }

  let sum = 0;
  let alternate = false;

  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i], 10);

    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

/**
 * Validate expiry date in MM/YY format.
 * Returns { valid: boolean, message: string, expired: boolean }.
 */
export function validateExpiry(expiry) {
  if (!expiry || typeof expiry !== 'string') {
    return { valid: false, message: 'Expiry date is required', expired: false };
  }

  const match = expiry.match(/^(\d{1,2})\s*\/\s*(\d{2})$/);
  if (!match) {
    return { valid: false, message: 'Use MM/YY format', expired: false };
  }

  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);

  if (month < 1 || month > 12) {
    return { valid: false, message: 'Invalid month (01-12)', expired: false };
  }

  const fullYear = 2000 + year;
  const now = new Date();
  const expiryEnd = new Date(fullYear, month, 0, 23, 59, 59);

  if (expiryEnd < now) {
    return { valid: false, message: 'Card has expired', expired: true };
  }

  return { valid: true, message: '', expired: false };
}

/**
 * Auto-format MM/YY input as user types.
 */
export function formatExpiryInput(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

/**
 * Validate CVV (3 or 4 digits).
 */
export function validateCVV(cvv) {
  if (!cvv) return { valid: false, message: 'CVV is required' };
  if (!/^\d{3,4}$/.test(String(cvv).trim())) {
    return { valid: false, message: 'CVV must be 3 or 4 digits' };
  }
  return { valid: true, message: '' };
}

/**
 * Validate PIN (typically 4-6 digits).
 */
export function validatePIN(pin) {
  if (!pin) return { valid: true, message: '' };
  if (!/^\d{4,6}$/.test(String(pin).trim())) {
    return { valid: false, message: 'PIN must be 4-6 digits' };
  }
  return { valid: true, message: '' };
}

/**
 * Format card number with spaces every 4 digits.
 */
export function formatCardNumber(cardNumber) {
  if (!cardNumber) return '';
  const cleaned = String(cardNumber).replace(/\D/g, '').slice(0, 19);
  return cleaned.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Full card validation. Returns an object with field-level errors.
 */
export function validateCard(fields = {}) {
  const errors = {};

  if (!fields.cardholderName?.trim()) {
    errors.cardholderName = 'Cardholder name is required';
  }

  if (!luhnCheck(fields.cardNumber)) {
    errors.cardNumber = 'Invalid card number';
  }

  const expiryResult = validateExpiry(fields.expiry);
  if (!expiryResult.valid) {
    errors.expiry = expiryResult.message;
  }

  const cvvResult = validateCVV(fields.cvv);
  if (!cvvResult.valid) {
    errors.cvv = cvvResult.message;
  }

  if (fields.pin) {
    const pinResult = validatePIN(fields.pin);
    if (!pinResult.valid) {
      errors.pin = pinResult.message;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    network: detectCardNetwork(fields.cardNumber),
  };
}
