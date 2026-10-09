const DEFAULTS = {
  length: 16,
  useUppercase: true,
  useLowercase: true,
  useNumbers: true,
  useSymbols: true,
  excludeAmbiguous: false,
};

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';
const AMBIGUOUS = 'il1Lo0O';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generatePassword(options = {}) {
  const {
    length = DEFAULTS.length,
    useUppercase = DEFAULTS.useUppercase,
    useLowercase = DEFAULTS.useLowercase,
    useNumbers = DEFAULTS.useNumbers,
    useSymbols = DEFAULTS.useSymbols,
    excludeAmbiguous = DEFAULTS.excludeAmbiguous,
  } = options;

  let chars = '';
  if (useLowercase) chars += LOWERCASE;
  if (useUppercase) chars += UPPERCASE;
  if (useNumbers) chars += NUMBERS;
  if (useSymbols) chars += SYMBOLS;

  if (!chars) return '';

  let available = chars;
  if (excludeAmbiguous) {
    available = [...available].filter((c) => !AMBIGUOUS.includes(c)).join('');
  }

  if (!available) return '';

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);

  let password = '';
  for (let i = 0; i < length; i++) {
    password += available[array[i] % available.length];
  }

  const required = [];
  if (useLowercase) required.push(LOWERCASE);
  if (useUppercase) required.push(UPPERCASE);
  if (useNumbers) required.push(NUMBERS);
  if (useSymbols) required.push(SYMBOLS);

  const pwArray = password.split('');
  for (let i = 0; i < required.length; i++) {
    const set = required[i];
    let filtered = set;
    if (excludeAmbiguous) {
      filtered = [...set].filter((c) => !AMBIGUOUS.includes(c)).join('');
    }
    const randomChar = filtered[array[i] % filtered.length];
    pwArray[i] = randomChar;
  }

  return shuffleArray(pwArray).join('');
}

const PASSPHRASE_WORDS = [
  'amber', 'anchor', 'apollo', 'arch', 'arctic', 'arrow', 'aspect', 'atlas', 'atom', 'aurora',
  'beacon', 'blaze', 'breeze', 'bridge', 'bronze', 'canyon', 'castle', 'cedar', 'charge', 'chrome',
  'cipher', 'cobalt', 'comet', 'copper', 'crest', 'crystal', 'delta', 'domain', 'dragon', 'eagle',
  'echo', 'eclipse', 'ember', 'falcon', 'feather', 'flame', 'forest', 'fossil', 'galaxy', 'glacier',
  'granite', 'harbor', 'haven', 'hawk', 'horizon', 'hybrid', 'impact', 'indigo', 'island', 'jasper',
  'jungle', 'knight', 'legend', 'lotus', 'lunar', 'matrix', 'meadow', 'meteor', 'monarch', 'nebula',
  'nexus', 'oasis', 'ocean', 'olive', 'omega', 'onyx', 'oracle', 'orchid', 'orbit', 'origin',
  'panther', 'peak', 'pearl', 'phoenix', 'planet', 'plasma', 'prism', 'pulse', 'pyramid', 'quantum',
  'quarry', 'quartz', 'radar', 'raven', 'realm', 'ridge', 'river', 'rocket', 'ruby', 'safari',
  'shadow', 'signal', 'silver', 'solar', 'spark', 'sphere', 'spirit', 'summit', 'titan', 'topaz',
  'torch', 'tunnel', 'twilight', 'vector', 'velvet', 'vessel', 'vortex', 'walnut', 'zenith', 'zephyr'
];

export function generatePassphrase(options = {}) {
  const {
    numWords = 4,
    separator = '-',
    capitalize = true,
    includeNumber = true,
  } = options;

  const selected = [];
  const array = new Uint32Array(numWords);
  crypto.getRandomValues(array);

  for (let i = 0; i < numWords; i++) {
    let word = PASSPHRASE_WORDS[array[i] % PASSPHRASE_WORDS.length];
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    selected.push(word);
  }

  let result = selected.join(separator);
  if (includeNumber) {
    const num = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (0xffffffff + 1) * 90 + 10);
    result += `${separator}${num}`;
  }

  return result;
}

export function generatePin(length = 6) {
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  let pin = '';
  for (let i = 0; i < length; i++) {
    pin += (array[i] % 10).toString();
  }
  return pin;
}