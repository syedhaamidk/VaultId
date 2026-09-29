/**
 * Passphrase strength meter — Shannon entropy with pattern penalties.
 *
 * Lightweight (~1 KB, no dependency). Gives a real entropy estimate in
 * bits, not just length or character-class rules. The 12-character floor
 * is the only hard gate in the UI; this meter only warns on weak scores.
 */

// Small list of common passwords to reject outright.
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', '123456',
  '12345678', '123456789', '1234567890', 'qwerty', 'qwerty123',
  'abc123', 'letmein', 'admin', 'welcome', 'monkey', 'dragon',
  'correcthorsebatterystaple', 'correct-horse-battery-staple',
]);

// Character pool sizes by class.
const POOL_LOWER = 26;
const POOL_UPPER = 26;
const POOL_DIGIT = 10;
const POOL_SYMBOL = 33; // ASCII printable symbols
const POOL_UNICODE = 143859; // approximate Unicode code points

/**
 * Calculate the effective pool size based on the characters used.
 * For non-ASCII, we use the full Unicode pool.
 */
function poolSize(passphrase) {
  let pool = 0;
  if (/[a-z]/.test(passphrase)) pool += POOL_LOWER;
  if (/[A-Z]/.test(passphrase)) pool += POOL_UPPER;
  if (/[0-9]/.test(passphrase)) pool += POOL_DIGIT;
  if (/[^a-zA-Z0-9]/.test(passphrase)) {
    // If there are non-ASCII characters, use the Unicode pool.
    if (/[^\x00-\x7F]/.test(passphrase)) {
      pool += POOL_UNICODE;
    } else {
      pool += POOL_SYMBOL;
    }
  }
  return pool || 1;
}

/**
 * Count the number of "effective" characters after penalizing patterns.
 * Repeated runs and sequences reduce the effective length.
 */
function effectiveLength(passphrase) {
  let effective = passphrase.length;

  // Penalize repeated runs (e.g., "aaaa" counts as ~2, not 4).
  const runMatches = passphrase.match(/(.)\1{2,}/g);
  if (runMatches) {
    for (const run of runMatches) {
      effective -= run.length - 2; // each run of n counts as 2
    }
  }

  // Penalize sequences (e.g., "abcd", "1234").
  let seqCount = 0;
  for (let i = 1; i < passphrase.length; i++) {
    const diff = passphrase.charCodeAt(i) - passphrase.charCodeAt(i - 1);
    if (diff === 1 || diff === -1) seqCount++;
  }
  effective -= Math.floor(seqCount / 2);

  return Math.max(effective, 1);
}

/**
 * Returns a strength estimate: { score: 0-4, label, entropy, warnings }.
 * score: 0=very weak, 1=weak, 2=fair, 3=good, 4=strong.
 */
export function estimateStrength(passphrase) {
  if (!passphrase) return { score: 0, label: 'Empty', entropy: 0, warnings: [] };

  const warnings = [];
  const normalized = passphrase.normalize('NFKC');

  // Reject common passwords outright.
  if (COMMON.has(normalized.toLowerCase())) {
    return { score: 0, label: 'Too common', entropy: 0, warnings: ['This is a commonly used password.'] };
  }

  const pool = poolSize(normalized);
  const effLen = effectiveLength(normalized);
  const entropy = Math.round(effLen * Math.log2(pool));

  // Map entropy to a 0-4 score.
  // < 40 bits = very weak, < 60 = weak, < 80 = fair, < 100 = good, >= 100 = strong.
  let score;
  if (entropy < 40) score = 0;
  else if (entropy < 60) score = 1;
  else if (entropy < 80) score = 2;
  else if (entropy < 100) score = 3;
  else score = 4;

  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

  if (score <= 1) warnings.push('Consider using a longer or more varied passphrase.');
  if (/^(.)\1+$/.test(normalized)) warnings.push('Repeated characters are easy to guess.');

  return { score, label: labels[score], entropy, warnings };
}
