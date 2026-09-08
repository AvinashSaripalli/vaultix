export const ITEM_TYPES = [
  { value: 'LOGIN', label: 'Login' },
  { value: 'CARD', label: 'Credit / Debit Card' },
  { value: 'BANK_ACCOUNT', label: 'Bank Account' },
  { value: 'IDENTITY', label: 'Identity' },
  { value: 'SSH_KEY', label: 'SSH Key' },
  { value: 'API_TOKEN', label: 'API Token' },
  { value: 'DATABASE', label: 'Database' },
  { value: 'WIFI', label: 'WiFi' },
  { value: 'LICENSE', label: 'Software License' },
  { value: 'RECOVERY_CODE', label: 'Recovery Code' },
  { value: 'SECURE_NOTE', label: 'Secure Note' },
];

export const CUSTOM_FIELDS_KEY = '__customFields__';

export const getItemTypeMeta = (type) =>
  ITEM_TYPES.find((item) => item.value === type) || ITEM_TYPES[0];

export const CUSTOM_FIELD_ENTRIES = {
  [CUSTOM_FIELDS_KEY]: [{ key: 'value', label: 'Value', input: 'text' }],
};

// Custom fields are stored inside the encrypted fields object under the
// reserved `__customFields__` key as a JSON array of { name, value, sensitive }.
// Serialize such an array into the string that gets encrypted.
export const serializeCustomFields = (customFields) => {
  if (!Array.isArray(customFields)) return '';
  const cleaned = customFields
    .filter((field) => field && (String(field.name || '').trim() || String(field.value || '').trim()))
    .map((field) => ({
      name: String(field.name || '').trim(),
      value: String(field.value || ''),
      sensitive: !!field.sensitive,
    }));
  return cleaned.length ? JSON.stringify(cleaned) : '';
};

export const parseCustomFields = (raw) => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((field) => field && typeof field === 'object')
      .map((field) => ({
        name: String(field.name || ''),
        value: String(field.value || ''),
        sensitive: !!field.sensitive,
      }));
  } catch {
    return [];
  }
};

export const isSensitiveDefault = (type) =>
  type === 'CARD' ||
  type === 'BANK_ACCOUNT' ||
  type === 'IDENTITY' ||
  type === 'SSH_KEY' ||
  type === 'API_TOKEN' ||
  type === 'DATABASE' ||
  type === 'WIFI' ||
  type === 'LICENSE' ||
  type === 'RECOVERY_CODE';

export const TYPE_FIELDS = {
  LOGIN: [],
  CARD: [
    { key: 'cardholderName', label: 'Cardholder Name', input: 'text' },
    { key: 'brand', label: 'Card Network', input: 'text', readOnly: true },
    { key: 'cardNumber', label: 'Card Number', input: 'text', copy: true },
    { key: 'expiry', label: 'Expiry (MM/YY)', input: 'text', copy: true },
    { key: 'cvv', label: 'CVV', input: 'password', copy: true },
  ],
  BANK_ACCOUNT: [
    { key: 'accountHolder', label: 'Account Holder', input: 'text' },
    { key: 'accountNumber', label: 'Account Number', input: 'text', copy: true },
    { key: 'routingNumber', label: 'Routing Number / IFSC Code', input: 'text', copy: true },
    { key: 'iban', label: 'IBAN', input: 'text', copy: true },
    { key: 'swiftCode', label: 'SWIFT / BIC Code', input: 'text', copy: true },
  ],
  IDENTITY: [
    { key: 'firstName', label: 'First Name', input: 'text' },
    { key: 'lastName', label: 'Last Name', input: 'text' },
    { key: 'dob', label: 'Date of Birth', input: 'text' },
    { key: 'idNumber', label: 'ID / Passport / SSN', input: 'password', copy: true },
    { key: 'email', label: 'Email', input: 'text' },
    { key: 'phone', label: 'Phone', input: 'text' },
    { key: 'address1', label: 'Address Line 1', input: 'text' },
    { key: 'address2', label: 'Address Line 2', input: 'text' },
    { key: 'city', label: 'City', input: 'text' },
    { key: 'state', label: 'State / Province', input: 'text' },
    { key: 'postalCode', label: 'Postal / ZIP Code', input: 'text' },
    { key: 'country', label: 'Country', input: 'text' },
  ],
  SSH_KEY: [
    { key: 'username', label: 'Username', input: 'text' },
    { key: 'host', label: 'Host', input: 'text' },
    { key: 'port', label: 'Port', input: 'text' },
    { key: 'keyType', label: 'Key Type (ed25519/RSA)', input: 'text' },
    { key: 'privateKey', label: 'Private Key', input: 'password', copy: true },
    { key: 'passphrase', label: 'Passphrase', input: 'password', copy: true },
    { key: 'publicKey', label: 'Public Key (optional)', input: 'text' },
    { key: 'fingerprint', label: 'Fingerprint', input: 'text', copy: true },
  ],
  API_TOKEN: [
    { key: 'token', label: 'Token / Secret Key', input: 'password', copy: true },
    { key: 'issuer', label: 'Service / Issuer', input: 'text' },
    { key: 'username', label: 'Username (optional)', input: 'text' },
    { key: 'scopes', label: 'Scopes / Permissions', input: 'text' },
    { key: 'expiry', label: 'Expiry (optional)', input: 'text' },
    { key: 'baseUrl', label: 'API Base URL (optional)', input: 'text' },
  ],
  DATABASE: [
    { key: 'dbName', label: 'Database Name', input: 'text' },
    { key: 'host', label: 'Host', input: 'text' },
    { key: 'port', label: 'Port', input: 'text' },
    { key: 'driver', label: 'Driver (postgres/mysql...)', input: 'text' },
    { key: 'username', label: 'Username', input: 'text' },
    { key: 'password', label: 'Password', input: 'password', copy: true },
    { key: 'database', label: 'Instance / Schema (optional)', input: 'text' },
    { key: 'connectionString', label: 'Connection String (optional)', input: 'password', copy: true },
  ],
  WIFI: [
    { key: 'ssid', label: 'Network Name (SSID)', input: 'text' },
    { key: 'password', label: 'WiFi Password', input: 'password', copy: true },
    { key: 'security', label: 'Security (WPA2/WPA3...)', input: 'text' },
    { key: 'isHidden', label: 'Hidden network', input: 'text', readOnly: true },
    { key: 'band', label: 'Band (2.4GHz/5GHz)', input: 'text' },
  ],
  LICENSE: [
    { key: 'licenseKey', label: 'License Key', input: 'password', copy: true },
    { key: 'product', label: 'Product / Software', input: 'text' },
    { key: 'vendor', label: 'Vendor', input: 'text' },
    { key: 'email', label: 'Licensed Email', input: 'text' },
    { key: 'purchasedAt', label: 'Purchase Date', input: 'text' },
    { key: 'expiry', label: 'Expiry Date', input: 'text' },
    { key: 'seats', label: 'Seats / Devices', input: 'text' },
    { key: 'url', label: 'License Page URL', input: 'text' },
  ],
  RECOVERY_CODE: [
    { key: 'code', label: 'Recovery Code', input: 'password', copy: true },
    { key: 'service', label: 'Service / Account', input: 'text' },
    { key: 'username', label: 'Username (optional)', input: 'text' },
    { key: 'used', label: 'Status (unused/used)', input: 'text' },
  ],
  SECURE_NOTE: [],
};

export const emptyTypeFields = (type) => {
  const fields = {};
  (TYPE_FIELDS[type] || []).forEach((field) => {
    fields[field.key] = '';
  });
  return fields;
};

export const maskFieldValue = (value, field) => {
  if (!value) return '';
  if (!field?.copy) return value;
  if (value.length <= 4) return '••••';
  return '•••• •••• ' + value.slice(-4);
};

export const getTypePlaceholder = (type) => {
  switch (type) {
    case 'CARD':
      return 'e.g. HDFC Credit Card';
    case 'BANK_ACCOUNT':
      return 'e.g. SBI Savings Account';
    case 'IDENTITY':
      return 'e.g. My Passport';
    case 'SECURE_NOTE':
      return 'e.g. WiFi Router Settings';
    case 'SSH_KEY':
      return 'e.g. Production Server SSH Key';
    case 'API_TOKEN':
      return 'e.g. GitHub Personal Access Token';
    case 'DATABASE':
      return 'e.g. Staging PostgreSQL DB';
    case 'WIFI':
      return 'e.g. Office WiFi';
    case 'LICENSE':
      return 'e.g. JetBrains License';
    case 'RECOVERY_CODE':
      return 'e.g. Google Account Recovery';
    default:
      return 'e.g. Gmail';
  }
};
