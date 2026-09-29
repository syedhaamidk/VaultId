/**
 * Pure passphrase validation logic — testable without React.
 */

export const MIN_PASSPHRASE_LENGTH = 12;

/**
 * Validates a passphrase setup form.
 * @returns {{ normalizedLength: number, lengthOk: boolean, matchOk: boolean, isValid: boolean, errors: string[] }}
 */
export function validatePassphrase(passphrase, confirm, acknowledged) {
  const normalizedLength = passphrase.normalize('NFKC').length;
  const lengthOk = normalizedLength >= MIN_PASSPHRASE_LENGTH;
  const matchOk = passphrase === confirm && confirm.length > 0;
  const isValid = lengthOk && matchOk && Boolean(acknowledged);

  const errors = [];
  if (passphrase && !lengthOk) {
    errors.push(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters (currently ${normalizedLength}).`);
  }
  if (confirm && !matchOk) {
    errors.push('Passphrases do not match.');
  }

  return { normalizedLength, lengthOk, matchOk, isValid, errors };
}
