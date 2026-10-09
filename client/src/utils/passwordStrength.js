const COMMON_WORDS = [
  'password', 'passwrd', 'p@ssword', 'p@ssw0rd',
  'admin', 'login', 'welcome', 'master',
  'iloveyou', 'sunshine', 'princess',
  'qwerty', 'letmein', 'monkey', 'dragon', 'charlie',
  'trustno1', 'football', 'baseball', 'hockey',
  'shadow', 'superman', 'batman', 'naruto',
  'hello', 'changeme', 'default',
];

const SEQ_PATTERNS = [
  /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i,
  /012|123|234|345|456|567|678|789/,
  /qwerty|asdf|zxcv|qwer|wert|erty|rtyu|tyui|yuio|uiop|sdfg|dfgh|fghj|ghjk|hjkl|xcvb|cvbn|vbnm/i,
];

export function getPasswordStrength(password) {
  if (!password) {
    return { score: 0, label: 'Weak', color: 'red', tip: 'Enter a password' };
  }

  let rawScore = 0;

  if (password.length >= 16) rawScore += 3;
  else if (password.length >= 12) rawScore += 2;
  else if (password.length >= 8) rawScore += 1;

  if (/[a-z]/.test(password)) rawScore += 1;
  if (/[A-Z]/.test(password)) rawScore += 1;
  if (/[0-9]/.test(password)) rawScore += 1;
  if (/[^A-Za-z0-9]/.test(password)) rawScore += 1;

  let penalty = 0;

  if (/(.)\1{2,}/.test(password)) penalty += 1;
  if (SEQ_PATTERNS.some((p) => p.test(password))) penalty += 1;

  if (/^[a-z]+$/.test(password) || /^[A-Z]+$/.test(password)) penalty += 2;
  else if (!/[A-Z]/.test(password) && password.length >= 8) penalty += 1;

  if (COMMON_WORDS.some((word) => password.toLowerCase().includes(word))) penalty += 2;
  if (/(?:19|20)\d{2}/.test(password)) penalty += 1;

  const score = Math.max(0, rawScore - penalty);

  if (score <= 1 || password.length < 8) {
    const tip = password.length < 8 ? 'Use at least 8 characters' : 'Mix letters, numbers & symbols';
    return { score: 1, label: 'Weak', color: 'red', tip };
  }
  if (score <= 3 || password.length < 12) {
    const tip = !/[^A-Za-z0-9]/.test(password) ? 'Add special symbols (!@#$)' : 'Make it longer for better security';
    return { score: 2, label: 'Medium', color: 'orange', tip };
  }
  if (score <= 5 || password.length < 16) {
    return { score: 3, label: 'Good', color: 'blue', tip: 'Good strength. Consider 16+ chars.' };
  }
  return { score: 4, label: 'Strong', color: 'green', tip: 'Strong and resilient password' };
}