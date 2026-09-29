// @vitest-environment node
/**
 * Tests for passphrase validation logic and strength estimation.
 */
import { describe, it, expect } from 'vitest';
import { validatePassphrase, MIN_PASSPHRASE_LENGTH } from './passphraseValidation.js';
import { estimateStrength } from './passphraseStrength.js';

describe('validatePassphrase', () => {
  it('accepts a valid passphrase with matching confirm and acknowledgement', () => {
    const r = validatePassphrase('Correct-Horse-Battery-Staple', 'Correct-Horse-Battery-Staple', true);
    expect(r.isValid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('rejects a passphrase shorter than 12 characters', () => {
    const r = validatePassphrase('short', 'short', true);
    expect(r.lengthOk).toBe(false);
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters (currently 5).`);
  });

  it('counts characters after NFKC normalization', () => {
    // Full-width characters normalize to ASCII, so the length is the same.
    const fullWidth = 'ＣｏｒｒｅｃｔＨｏｒｓｅＢａｔｔｅｒｙ１'; // 22 chars full-width
    const r = validatePassphrase(fullWidth, fullWidth, true);
    expect(r.normalizedLength).toBe(fullWidth.normalize('NFKC').length);
    expect(r.lengthOk).toBe(true);
  });

  it('rejects when confirm does not match', () => {
    const r = validatePassphrase('Correct-Horse-Battery-Staple', 'Different-Passphrase-Here', true);
    expect(r.matchOk).toBe(false);
    expect(r.isValid).toBe(false);
    expect(r.errors).toContain('Passphrases do not match.');
  });

  it('rejects when acknowledgement is not checked', () => {
    const r = validatePassphrase('Correct-Horse-Battery-Staple', 'Correct-Horse-Battery-Staple', false);
    expect(r.isValid).toBe(false);
  });

  it('rejects an empty passphrase', () => {
    const r = validatePassphrase('', '', true);
    expect(r.isValid).toBe(false);
  });

  it('accepts exactly 12 characters', () => {
    const pp = 'a'.repeat(12);
    const r = validatePassphrase(pp, pp, true);
    expect(r.lengthOk).toBe(true);
    expect(r.isValid).toBe(true);
  });

  it('rejects 11 characters', () => {
    const pp = 'a'.repeat(11);
    const r = validatePassphrase(pp, pp, true);
    expect(r.lengthOk).toBe(false);
    expect(r.isValid).toBe(false);
  });
});

describe('estimateStrength', () => {
  it('rejects common passwords outright', () => {
    const r = estimateStrength('password');
    expect(r.score).toBe(0);
    expect(r.label).toBe('Too common');
  });

  it('gives a low score to a short passphrase', () => {
    const r = estimateStrength('abc');
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('gives a high score to a long, varied passphrase', () => {
    const r = estimateStrength('Correct-Horse-Battery-Staple-42!');
    expect(r.score).toBeGreaterThanOrEqual(3);
  });

  it('gives a higher score to a longer passphrase with the same character classes', () => {
    const short = 'abc123';
    const long = 'abc123def456ghi789';
    expect(estimateStrength(long).entropy).toBeGreaterThan(estimateStrength(short).entropy);
  });

  it('penalizes repeated characters', () => {
    const repeated = 'aaaaaaaaaaaa';
    const varied = 'abcdefghijkl';
    expect(estimateStrength(repeated).entropy).toBeLessThan(estimateStrength(varied).entropy);
  });

  it('returns empty score for empty passphrase', () => {
    const r = estimateStrength('');
    expect(r.score).toBe(0);
    expect(r.label).toBe('Empty');
  });
});
