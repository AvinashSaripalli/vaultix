const encoder = new TextEncoder();
const decoder = new TextDecoder();

// KDF configuration.
// PBKDF2-SHA256 is used to derive the AES key from the master password.
// New ciphertext ("v2" envelopes) uses a strong iteration count and a
// freshly-generated per-ciphertext salt. Decryption is backward compatible
// with older envelopes that used a fixed salt and 100k iterations.
export const KDF_ITERATIONS_CURRENT = 600000;
export const KDF_ITERATIONS_LEGACY = 100000;
export const KDF_VERSION = 2;

function getSaltBytes(salt) {
  return encoder.encode(salt || 'vault-salt');
}

export function isEncryptedFormat(value) {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed.iv) && Array.isArray(parsed.content);
  } catch {
    return false;
  }
}

const isVersion2 = (parsed) => parsed && parsed.kdf === 'PBKDF2' && parsed.v === 2;

// Extract the KDF parameters (iteration count + salt) that were used to
// produce an envelope. Returns null for legacy (100k + provided salt) data.
function resolveKdfParams(parsed, salt) {
  if (isVersion2(parsed)) {
    return { iterations: parsed.iterations || KDF_ITERATIONS_CURRENT, salt: parsed.salt };
  }
  return { iterations: KDF_ITERATIONS_LEGACY, salt };
}

export async function encryptText(text, masterPassword, salt) {
  if (!text) return '';

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Random per-ciphertext salt for uniqueness, combined with the per-user salt
  // for domain separation. The random salt is stored in the ciphertext
  // envelope so it can be reproduced on decrypt.
  const randomSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const kdfSalt = new Uint8Array(randomSalt.length + getSaltBytes(salt).length);
  kdfSalt.set(randomSalt, 0);
  kdfSalt.set(getSaltBytes(salt), randomSalt.length);

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: kdfSalt,
      iterations: KDF_ITERATIONS_CURRENT,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );

  return JSON.stringify({
    v: KDF_VERSION,
    kdf: 'PBKDF2',
    iterations: KDF_ITERATIONS_CURRENT,
    salt: Array.from(kdfSalt),
    iv: Array.from(iv),
    content: Array.from(new Uint8Array(encrypted)),
  });
}

async function generateAesKey() {
  return window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function exportAesKey(key) {
  const jwk = await window.crypto.subtle.exportKey('jwk', key);
  return JSON.stringify(jwk);
}

async function importAesKey(jwkStr) {
  const jwk = JSON.parse(jwkStr);
  return window.crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptTextWithAesKey(text) {
  if (!text) return { encryptedData: '', aesKeyJwk: '' };
  const key = await generateAesKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );
  const aesKeyJwk = await exportAesKey(key);
  const encryptedData = JSON.stringify({
    iv: Array.from(iv),
    content: Array.from(new Uint8Array(encrypted)),
  });
  return { encryptedData, aesKeyJwk };
}

// Generate a brand-new AES item key and return its exported JWK. Used for
// company/typed items where a single item key wraps password, note AND typed
// fields so any authorized user can decrypt them all.
export async function generateItemAesKey() {
  const key = await generateAesKey();
  const aesKeyJwk = await exportAesKey(key);
  return { aesKeyJwk };
}

// Encrypt an arbitrary text value using a *provided* AES item key (the same
// key that is RSA-wrapped and distributed to authorized users). Used so typed
// fields share a single item key with the password/note.
export async function encryptValueWithAesKey(value, aesKeyJwk) {
  if (value === undefined || value === null || value === '') return '';
  if (!aesKeyJwk) return '';
  const key = await importAesKey(aesKeyJwk);
  const toEncrypt = Array.isArray(value) ? JSON.stringify(value) : String(value);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(toEncrypt)
  );
  return JSON.stringify({
    iv: Array.from(iv),
    content: Array.from(new Uint8Array(encrypted)),
  });
}

export async function encryptFieldsWithAesKey(fields, aesKeyJwk) {
  if (!fields || !aesKeyJwk) return '';
  const keys = Object.keys(fields).filter(
    (key) => fields[key] !== '' && fields[key] != null
  );
  if (keys.length === 0) return '';
  const encrypted = {};
  for (const key of keys) {
    const cipher = await encryptValueWithAesKey(fields[key], aesKeyJwk);
    if (cipher) encrypted[key] = cipher;
  }
  return Object.keys(encrypted).length ? JSON.stringify(encrypted) : '';
}

export async function decryptFieldsWithAesKey(encryptedFields, aesKeyJwk) {
  if (!encryptedFields || !aesKeyJwk) return null;
  try {
    const key = await importAesKey(aesKeyJwk);
    const parsed = typeof encryptedFields === 'string'
      ? JSON.parse(encryptedFields)
      : encryptedFields;

    if (!parsed || typeof parsed !== 'object') return null;

    if (Array.isArray(parsed.iv) && Array.isArray(parsed.content)) {
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(parsed.iv) },
        key,
        new Uint8Array(parsed.content)
      );
      const text = decoder.decode(decrypted);
      try {
        const obj = JSON.parse(text);
        if (obj && typeof obj === 'object') return obj;
      } catch {
        return { _value: text };
      }
    }

    const result = {};
    for (const [fieldKey, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') continue;
      try {
        const env = JSON.parse(value);
        if (!env || typeof env !== 'object' || !env.iv || !env.content) continue;
        const plain = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(env.iv) },
          key,
          new Uint8Array(env.content)
        );
        result[fieldKey] = decoder.decode(plain);
      } catch {
        result[fieldKey] = '';
      }
    }
    return Object.keys(result).length ? result : null;
  } catch {
    return null;
  }
}

export async function decryptTextWithAesKey(encryptedData, aesKeyJwk) {
  if (!encryptedData || !aesKeyJwk) return '';
  const key = await importAesKey(aesKeyJwk);
  const parsed = JSON.parse(encryptedData);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(parsed.iv) },
    key,
    new Uint8Array(parsed.content)
  );
  return decoder.decode(decrypted);
}

export async function decryptText(encryptedText, masterPassword, salt) {
  if (!encryptedText) return '';

  const parsed = JSON.parse(encryptedText);
  const { iterations, salt: kdfSalt } = resolveKdfParams(parsed, salt || 'vault-salt');

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: isVersion2(parsed) && kdfSalt ? new Uint8Array(kdfSalt) : getSaltBytes(kdfSalt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(parsed.iv),
    },
    key,
    new Uint8Array(parsed.content)
  );

  return decoder.decode(decrypted);
}

export async function safeDecryptText(encryptedText, masterPassword, salt) {
  if (!encryptedText) return '';

  try {
    const parsed = JSON.parse(encryptedText);

    if (!parsed.iv || !parsed.content) {
      return encryptedText;
    }

    return await decryptText(encryptedText, masterPassword, salt);
  } catch {
    return encryptedText;
  }
}

export async function encryptFields(fields, masterPassword, salt) {
  if (!fields) return '';
  const keys = Object.keys(fields).filter((key) => fields[key]);
  if (keys.length === 0) return '';

  const encrypted = {};
  for (const key of keys) {
    encrypted[key] = await encryptText(String(fields[key]), masterPassword, salt);
  }
  return JSON.stringify(encrypted);
}

export async function decryptFields(encryptedFields, masterPassword, salt) {
  if (!encryptedFields) return null;

  try {
    let parsed;
    if (typeof encryptedFields === 'string') {
      parsed = JSON.parse(encryptedFields);
    } else {
      parsed = encryptedFields;
    }

    if (!parsed || typeof parsed !== 'object') return null;

    if (Array.isArray(parsed.iv) && Array.isArray(parsed.content)) {
      const decrypted = await decryptText(encryptedFields, masterPassword, salt);
      return decrypted ? JSON.parse(decrypted) : null;
    }

    const result = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.startsWith('{')) {
        try {
          const decrypted = await decryptText(value, masterPassword, salt);
          result[key] = decrypted || '';
        } catch {
          result[key] = '';
        }
      } else {
        result[key] = '';
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

export const MASTER_VERIFIER_MARKER = 'vaultix-master-verifier';

export const MASTER_VERIFIER_STORAGE_KEY = 'masterPasswordVerifier';export async function createMasterPasswordVerifier(masterPassword, salt) {
  return encryptText(MASTER_VERIFIER_MARKER, masterPassword, salt);
}

export async function verifyMasterPasswordLocally(
  enteredPassword,
  salt,
  { verifier, samples = [] } = {}
) {
  if (verifier) {
    try {
      const plain = await decryptText(verifier, enteredPassword, salt);
      return plain === MASTER_VERIFIER_MARKER;
    } catch {
      return false;
    }
  }

  let hasCandidates = false;

  for (const sample of samples) {
    if (!sample) continue;

    const encrypted = typeof sample === 'string' ? sample : sample.encrypted;
    const sampleSalt = typeof sample === 'string' ? salt : sample.salt || salt;

    if (!isEncryptedFormat(encrypted)) continue;

    hasCandidates = true;

    try {
      await decryptText(encrypted, enteredPassword, sampleSalt);
      return true;
    } catch {
      // try the next sample
    }
  }

  return hasCandidates ? false : null;
}

// ─── RSA-OAEP Key Pair Utilities (for per-user re-encryption) ───────────────

export async function generateKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateKeyJwk = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);

  return { publicKeyJwk, privateKeyJwk };
}

// Human-friendly master-password recovery key (e.g. "XK7P-9M2Q-4TRH").
// Mirror of the server-side generator in server/src/utils/recoveryKey.js.
export function generateRecoveryKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = window.crypto.getRandomValues(new Uint8Array(12));
  const groups = [];
  for (let g = 0; g < 3; g += 1) {
    let group = '';
    for (let i = 0; i < 4; i += 1) {
      group += alphabet[random[g * 4 + i] % alphabet.length];
    }
    groups.push(group);
  }
  return groups.join('-');
}

async function getDeriveKeyForPrivateKey(masterPassword, salt, iterations, saltBytes) {
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPrivateKey(privateKeyJwk, masterPassword, salt) {
  const kdfSalt = window.crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await getDeriveKeyForPrivateKey(
    masterPassword,
    salt,
    KDF_ITERATIONS_CURRENT,
    kdfSalt
  );
  const privateKeyData = encoder.encode(JSON.stringify(privateKeyJwk));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    privateKeyData
  );
  return JSON.stringify({
    v: KDF_VERSION,
    kdf: 'PBKDF2',
    iterations: KDF_ITERATIONS_CURRENT,
    salt: Array.from(kdfSalt),
    iv: Array.from(iv),
    content: Array.from(new Uint8Array(encrypted)),
  });
}

export async function decryptPrivateKey(encryptedPrivateKey, masterPassword, salt) {
  // Prisma returns Json columns already parsed — accept object or string.
  const parsed =
    typeof encryptedPrivateKey === 'string'
      ? JSON.parse(encryptedPrivateKey)
      : encryptedPrivateKey;

  const params = resolveKdfParams(parsed, salt || 'vault-salt');
  const keySalt = isVersion2(parsed) && params.salt ? new Uint8Array(params.salt) : getSaltBytes(params.salt);
  const aesKey = await getDeriveKeyForPrivateKey(
    masterPassword,
    salt,
    params.iterations,
    keySalt
  );
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(parsed.iv) },
    aesKey,
    new Uint8Array(parsed.content)
  );
  return JSON.parse(decoder.decode(decrypted));
}

async function importPublicKey(publicKeyJwk) {
  return window.crypto.subtle.importKey(
    'jwk',
    publicKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
}

async function importPrivateKey(privateKeyJwk) {
  return window.crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt']
  );
}

export async function rsaEncrypt(plaintext, publicKeyJwk) {
  const publicKey = await importPublicKey(publicKeyJwk);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    encoder.encode(plaintext)
  );
  return JSON.stringify(Array.from(new Uint8Array(encrypted)));
}

export async function rsaDecrypt(ciphertextStr, privateKeyJwk) {
  const privateKey = await importPrivateKey(privateKeyJwk);
  const ciphertext = new Uint8Array(JSON.parse(ciphertextStr));
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    ciphertext
  );
  return decoder.decode(decrypted);
}

export async function reWrapItemKey(encryptedItemKeyStr, oldPrivateKeyJwk, newPublicKeyJwk) {
  const aesKeyJson = await rsaDecrypt(encryptedItemKeyStr, oldPrivateKeyJwk);
  return rsaEncrypt(aesKeyJson, newPublicKeyJwk);
}

export async function wrapItemKey(aesKeyJwkStr, publicKeyJwk) {
  return rsaEncrypt(aesKeyJwkStr, publicKeyJwk);
}

export async function unwrapItemKey(wrappedKeyStr, privateKeyJwk) {
  return rsaDecrypt(wrappedKeyStr, privateKeyJwk);
}

export async function wrapFolderKey(aesKeyJwkStr, publicKeyJwk) {
  return rsaEncrypt(aesKeyJwkStr, publicKeyJwk);
}

export async function unwrapFolderKey(wrappedKeyStr, privateKeyJwk) {
  return rsaDecrypt(wrappedKeyStr, privateKeyJwk);
}

// ─── TOTP Utilities ─────────────────────────────────────────────────────────

function base32ToBytes(base32) {
  if (!base32) return new Uint8Array();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

export async function generateTOTP(secret, stepSeconds = 30) {
  if (!secret || typeof secret !== 'string') return null;
  try {
    const keyBytes = base32ToBytes(secret);
    if (keyBytes.length === 0) return null;
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(epoch / stepSeconds);
    const secondsRemaining = stepSeconds - (epoch % stepSeconds);

    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setBigUint64(0, BigInt(timeStep), false);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, timeBuffer);
    const signatureBytes = new Uint8Array(signature);
    const offset = signatureBytes[signatureBytes.length - 1] & 0xf;
    const code =
      ((signatureBytes[offset] & 0x7f) << 24) |
      ((signatureBytes[offset + 1] & 0xff) << 16) |
      ((signatureBytes[offset + 2] & 0xff) << 8) |
      (signatureBytes[offset + 3] & 0xff);

    const otp = (code % 1000000).toString().padStart(6, '0');
    return { code: otp, secondsRemaining };
  } catch {
    return null;
  }
}