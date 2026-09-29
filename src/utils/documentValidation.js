/**
 * India-specific document validation: Aadhaar (Verhoeff checksum) and PAN.
 */

// ── Aadhaar ──────────────────────────────────────────────────────────────────
// 12 digits, last digit is a Verhoeff checksum. Format: XXXX XXXX XXXX.

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [2, 8, 0, 3, 7, 9, 6, 1, 4, 5],
  [3, 9, 1, 6, 0, 4, 8, 2, 5, 7],
  [4, 4, 2, 8, 3, 5, 1, 7, 6, 9],
  [5, 7, 3, 1, 6, 2, 9, 8, 0, 4],
  [6, 0, 6, 9, 8, 1, 4, 5, 7, 2],
  [7, 3, 8, 4, 5, 0, 2, 9, 1, 6],
  [8, 6, 9, 5, 4, 7, 0, 3, 2, 1],
  [9, 2, 4, 7, 1, 6, 5, 0, 3, 8],
];

const VERHOEFF_INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function verhoeffCheck(digits) {
  let c = 0;
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[digits.length - 1 - i]]];
  }
  return c === 0;
}

/**
 * Validates an Aadhaar number (12 digits, Verhoeff checksum).
 * Accepts with or without spaces.
 * @returns {{ valid: boolean, formatted: string|null, error: string|null }}
 */
export function validateAadhaar(input) {
  if (!input) return { valid: false, formatted: null, error: null };
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 12) {
    return { valid: false, formatted: null, error: 'Aadhaar must be 12 digits.' };
  }
  if (!verhoeffCheck(digits.split('').map(Number))) {
    return { valid: false, formatted: null, error: 'Invalid Aadhaar checksum.' };
  }
  const formatted = `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  return { valid: true, formatted, error: null };
}

// ── PAN ──────────────────────────────────────────────────────────────────────
// Format: ABCDE1234F (5 letters, 4 digits, 1 letter).

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Validates a PAN (Permanent Account Number).
 * @returns {{ valid: boolean, formatted: string|null, error: string|null }}
 */
export function validatePAN(input) {
  if (!input) return { valid: false, formatted: null, error: null };
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!PAN_REGEX.test(cleaned)) {
    return { valid: false, formatted: null, error: 'PAN must be in format ABCDE1234F.' };
  }
  return { valid: true, formatted: cleaned, error: null };
}

/**
 * Auto-detects and validates an Indian document number.
 * @returns {{ type: 'aadhaar'|'pan'|null, valid: boolean, formatted: string|null, error: string|null }}
 */
export function validateIndianDocument(input) {
  if (!input) return { type: null, valid: false, formatted: null, error: null };
  const digits = input.replace(/\D/g, '');
  if (digits.length === 12) {
    const r = validateAadhaar(input);
    return { type: 'aadhaar', ...r };
  }
  if (input.replace(/[^A-Z0-9]/gi).length === 10) {
    const r = validatePAN(input);
    return { type: 'pan', ...r };
  }
  return { type: null, valid: false, formatted: null, error: 'Unrecognized format.' };
}
