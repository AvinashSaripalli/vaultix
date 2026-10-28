export const ITEM_TYPES = [
  { value: 'LOGIN', label: 'Login' },
  { value: 'CARD', label: 'Credit / Debit Card' },
  { value: 'BANK_ACCOUNT', label: 'Bank & NetBanking' },
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
    { key: 'cardholderName', label: 'Cardholder Name', placeholder: 'e.g. Rajesh Kumar', input: 'text', required: true },
    { key: 'cardNumber', label: 'Card Number', placeholder: '4532 •••• •••• 1234', input: 'text', copy: true, masked: true, required: true },
    { key: 'brand', label: 'Card Network (Auto)', placeholder: 'Visa / Mastercard / RuPay / Amex', input: 'text', readOnly: true },
    { key: 'expiry', label: 'Expiry (MM/YY)', placeholder: 'MM/YY', input: 'text', copy: true, required: true },
    { key: 'cvv', label: 'CVV', placeholder: '3 or 4 digits', input: 'password', copy: true, masked: true, required: true },
    { key: 'pin', label: 'Card PIN (optional)', placeholder: '4 or 6 digit PIN', input: 'password', copy: true, masked: true },
  ],
  BANK_ACCOUNT: [
    { key: 'customerId', label: 'Customer ID / Username', placeholder: 'NetBanking login ID / User ID', input: 'text', copy: true },
    { key: 'accountNumber', label: 'Account Number (optional)', placeholder: 'Enter account number (optional)', input: 'text', copy: true, masked: true },
    { key: 'password', label: 'NetBanking Password', placeholder: 'Login password (optional)', input: 'password', copy: true, masked: true, canGenerate: true },
    { key: 'transactionPassword', label: 'Transaction Password (optional)', placeholder: 'Profile / payment approval password (optional)', input: 'password', copy: true, masked: true, canGenerate: true },
    { key: 'url', label: 'NetBanking URL (optional)', placeholder: 'https://netbanking.hdfcbank.com', input: 'text', copy: true, fullWidth: true },
  ],
  IDENTITY: [
    {
      key: 'idType',
      label: 'Document Type',
      input: 'select',
      options: ['PAN Card', 'Aadhaar / National ID', 'Passport', 'Driving License', 'SSN / Tax ID', 'Voter ID', 'Employee ID', 'Other'],
    },
    { key: 'idNumber', label: 'ID / Document Number', placeholder: 'PAN / Aadhaar / Passport / SSN', input: 'password', copy: true, masked: true, required: true },
    { key: 'firstName', label: 'First Name', placeholder: 'First name', input: 'text', required: true },
    { key: 'lastName', label: 'Last Name', placeholder: 'Last name', input: 'text', required: true },
    { key: 'dob', label: 'Date of Birth', placeholder: 'YYYY-MM-DD', input: 'text', required: true },
    { key: 'phone', label: 'Phone', placeholder: '+91 9876543210', input: 'text', copy: true },
    { key: 'email', label: 'Email', placeholder: 'user@example.com', input: 'text', copy: true },
    { key: 'address1', label: 'Address', placeholder: 'Street address, city, PIN', input: 'text' },
  ],
  SSH_KEY: [
    { key: 'username', label: 'Username', placeholder: 'e.g. ubuntu, root, git', input: 'text', copy: true, required: true },
    { key: 'host', label: 'Host / IP Address', placeholder: 'e.g. 192.168.1.10', input: 'text', copy: true },
    { key: 'port', label: 'Port', placeholder: '22', input: 'text', copy: true },
    { key: 'keyType', label: 'Key Type', placeholder: 'ed25519 / RSA', input: 'text' },
    { key: 'privateKey', label: 'Private Key (PEM / OpenSSH)', placeholder: '-----BEGIN OPENSSH PRIVATE KEY-----', input: 'password', multiline: true, copy: true, masked: true, required: true },
    { key: 'passphrase', label: 'Passphrase (optional)', placeholder: 'Key passphrase', input: 'password', copy: true, masked: true },
  ],
  API_TOKEN: [
    { key: 'token', label: 'API Token / Secret Key', placeholder: 'ghp_... or sk_live_...', input: 'password', copy: true, masked: true, required: true, canGenerate: true },
    { key: 'issuer', label: 'Service / Provider', placeholder: 'e.g. GitHub, Stripe, AWS', input: 'text', required: true },
    { key: 'username', label: 'Account / Client ID (optional)', placeholder: 'Account email or App ID', input: 'text', copy: true },
    { key: 'scopes', label: 'Scopes / Permissions', placeholder: 'e.g. repo, read:org', input: 'text' },
    { key: 'expiry', label: 'Expiry Date (optional)', placeholder: 'YYYY-MM-DD', input: 'text' },
    { key: 'baseUrl', label: 'API Base URL (optional)', placeholder: 'https://api.example.com/v1', input: 'text', copy: true },
  ],
  DATABASE: [
    { key: 'dbName', label: 'Database Name', placeholder: 'e.g. vaultix_prod', input: 'text', copy: true, required: true },
    {
      key: 'driver',
      label: 'Database Engine',
      input: 'select',
      options: ['PostgreSQL', 'MySQL / MariaDB', 'MongoDB', 'Redis', 'SQL Server', 'Oracle', 'SQLite', 'Other'],
    },
    { key: 'host', label: 'Host', placeholder: 'localhost or db.company.com', input: 'text', copy: true },
    { key: 'port', label: 'Port', placeholder: '5432 / 3306 / 27017', input: 'text', copy: true },
    { key: 'username', label: 'Username', placeholder: 'postgres / admin', input: 'text', copy: true, required: true },
    { key: 'password', label: 'Password', placeholder: 'Database password', input: 'password', copy: true, masked: true, required: true, canGenerate: true },
  ],
  WIFI: [
    { key: 'ssid', label: 'Network Name (SSID)', placeholder: 'e.g. Office-5G', input: 'text', copy: true, required: true },
    { key: 'password', label: 'WiFi Password', placeholder: 'WPA2/WPA3 password', input: 'password', copy: true, masked: true, required: true, canGenerate: true },
    {
      key: 'security',
      label: 'Security',
      input: 'select',
      options: ['WPA2/WPA3', 'WPA3', 'WPA2', 'WEP', 'Open'],
    },
    {
      key: 'band',
      label: 'Band',
      input: 'select',
      options: ['Dual Band (2.4GHz / 5GHz)', '5 GHz', '2.4 GHz'],
    },
  ],
  LICENSE: [
    { key: 'licenseKey', label: 'License Key', placeholder: 'XXXX-XXXX-XXXX-XXXX', input: 'password', copy: true, masked: true, required: true },
    { key: 'product', label: 'Product / Software', placeholder: 'e.g. JetBrains', input: 'text' },
    { key: 'email', label: 'Licensed Email', placeholder: 'licenses@company.com', input: 'text', copy: true },
    { key: 'expiry', label: 'Expiry Date', placeholder: 'YYYY-MM-DD', input: 'text' },
  ],
  RECOVERY_CODE: [
    { key: 'code', label: 'Recovery Code(s)', placeholder: 'Paste backup codes or recovery key', input: 'password', multiline: true, copy: true, masked: true, required: true },
    { key: 'service', label: 'Service / Account', placeholder: 'e.g. Google, GitHub, AWS', input: 'text' },
    { key: 'username', label: 'Username / Email', placeholder: 'admin@company.com', input: 'text', copy: true },
    {
      key: 'used',
      label: 'Status',
      input: 'select',
      options: ['Unused', 'Partially Used', 'Used'],
    },
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

export const isFieldMasked = (field) =>
  Boolean(field?.masked || field?.input === 'password');

export const maskFieldValue = (value, field) => {
  if (!value) return '';
  if (!isFieldMasked(field)) return value;
  const str = String(value);
  if (
    (field?.key === 'cardNumber' ||
      field?.key === 'accountNumber' ||
      field?.key === 'iban') &&
    str.length > 4
  ) {
    return '•••• •••• ' + str.slice(-4);
  }
  return '••••••••••••';
};

export const getTypePlaceholder = (type) => {
  switch (type) {
    case 'CARD':
      return 'e.g. HDFC Corporate Credit Card';
    case 'BANK_ACCOUNT':
      return 'e.g. HDFC Current Account / SBI Savings';
    case 'IDENTITY':
      return 'e.g. PAN Card / Passport';
    case 'SECURE_NOTE':
      return 'e.g. Production Recovery Notes';
    case 'SSH_KEY':
      return 'e.g. Production Server SSH Key';
    case 'API_TOKEN':
      return 'e.g. GitHub Access Token';
    case 'DATABASE':
      return 'e.g. Production PostgreSQL DB';
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
