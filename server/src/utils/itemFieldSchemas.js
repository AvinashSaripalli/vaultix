/**
 * Field schemas for each ItemType.
 * Used server-side to validate that encryptedFields contains the correct keys
 * for the given item type, preventing corrupted or mismatched data.
 */

const ITEM_FIELD_SCHEMAS = {
  LOGIN: {
    optional: ['totpSecret'],
    required: [],
  },
  CARD: {
    required: ['cardholderName', 'cardNumber', 'expiry', 'cvv'],
    optional: ['brand'],
  },
  BANK_ACCOUNT: {
    required: ['accountHolder', 'accountNumber', 'routingNumber'],
    optional: ['iban', 'swiftCode'],
  },
  IDENTITY: {
    required: ['firstName', 'lastName', 'dob', 'idNumber', 'email', 'phone'],
    optional: ['address1', 'address2', 'city', 'state', 'postalCode', 'country'],
  },
  SECURE_NOTE: {
    required: [],
    optional: [],
  },
  SSH_KEY: {
    required: ['username', 'privateKey'],
    optional: ['passphrase', 'publicKey', 'host', 'port', 'keyType', 'fingerprint'],
  },
  API_TOKEN: {
    required: ['token', 'issuer'],
    optional: ['username', 'scopes', 'expiry', 'baseUrl'],
  },
  DATABASE: {
    required: ['dbName', 'username', 'password'],
    optional: ['host', 'port', 'database', 'driver', 'connectionString'],
  },
  WIFI: {
    required: ['ssid', 'password'],
    optional: ['security', 'isHidden', 'band'],
  },
  LICENSE: {
    required: ['licenseKey'],
    optional: ['product', 'vendor', 'email', 'purchasedAt', 'expiry', 'seats', 'url'],
  },
  RECOVERY_CODE: {
    required: ['code'],
    optional: ['service', 'username', 'used'],
  },
};

// `__customFields__` is a reserved key accepted for every item type. It carries
// an array of user-defined custom fields (each { key, value, sensitive }) so any
// item can be extended without schema changes.
const CUSTOM_FIELDS_KEY = '__customFields__';

function isAllowedKey(schema, key) {
  return (
    key === CUSTOM_FIELDS_KEY ||
    schema.required.includes(key) ||
    schema.optional.includes(key)
  );
}

const VALID_ITEM_TYPES = Object.keys(ITEM_FIELD_SCHEMAS);

/**
 * Validates that the provided encryptedFields object (parsed JSON) contains
 * exactly the expected keys for the given ItemType.
 *
 * Handles both formats:
 * - Old format: single AES-GCM envelope with { iv, content, ... } keys
 * - New format: per-field envelopes with field-specific keys
 *
 * Returns { valid: true } or { valid: false, message: string }.
 */
function validateItemFields(type, fields) {
  if (!VALID_ITEM_TYPES.includes(type)) {
    return { valid: false, message: `Invalid item type: ${type}` };
  }

const schema = ITEM_FIELD_SCHEMAS[type];
    const allAllowed = new Set([...schema.required, ...schema.optional]);

    if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
      const hasEncryptionEnvelope = 'iv' in fields && 'content' in fields;

      if (hasEncryptionEnvelope) {
        return { valid: true };
      }

      const providedKeys = Object.keys(fields);
      const disallowed = providedKeys.filter((k) => !isAllowedKey(schema, k));

      if (disallowed.length > 0) {
        return {
          valid: false,
          message: `Unexpected fields for ${type}: ${disallowed.join(', ')}`,
        };
      }
    }

  if (schema.required.length > 0) {
    if (!fields || typeof fields !== 'object') {
      return {
        valid: false,
        message: `${type} requires fields: ${schema.required.join(', ')}`,
      };
    }

    const hasEncryptionEnvelope = 'iv' in fields && 'content' in fields;
    if (hasEncryptionEnvelope) {
      return { valid: true };
    }

    const missing = schema.required.filter(
      (key) => !(key in fields) || fields[key] === undefined
    );

    if (missing.length > 0) {
      return {
        valid: false,
        message: `Missing required fields for ${type}: ${missing.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates the 'login' field is appropriate for the given ItemType.
 * LOGIN type requires a non-empty login. Other types allow empty.
 */
function validateLoginForType(type, login) {
  if (type === 'LOGIN' && (!login || !login.trim())) {
    return { valid: false, message: 'Login / Email is required for LOGIN items' };
  }
  return { valid: true };
}

module.exports = {
  ITEM_FIELD_SCHEMAS,
  VALID_ITEM_TYPES,
  CUSTOM_FIELDS_KEY,
  validateItemFields,
  validateLoginForType,
};
