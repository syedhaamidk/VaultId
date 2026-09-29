// @vitest-environment node
/**
 * Tests for Aadhaar (Verhoeff) and PAN validation.
 */
import { describe, it, expect } from 'vitest';
import { validateAadhaar, validatePAN, validateIndianDocument } from './documentValidation.js';

describe('validateAadhaar', () => {
  it('accepts a valid Aadhaar number', () => {
    const r = validateAadhaar('100000000001');
    expect(r.valid).toBe(true);
    expect(r.formatted).toBe('1000 0000 0001');
  });

  it('accepts an Aadhaar with spaces', () => {
    const r = validateAadhaar('1000 0000 0001');
    expect(r.valid).toBe(true);
  });

  it('rejects an Aadhaar with a bad checksum', () => {
    const r = validateAadhaar('100000000002');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('Invalid Aadhaar checksum.');
  });

  it('rejects an Aadhaar with too few digits', () => {
    const r = validateAadhaar('12345');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('Aadhaar must be 12 digits.');
  });

  it('rejects an Aadhaar with too many digits', () => {
    const r = validateAadhaar('1234567890123');
    expect(r.valid).toBe(false);
  });

  it('returns null error for empty input', () => {
    const r = validateAadhaar('');
    expect(r.valid).toBe(false);
    expect(r.error).toBeNull();
  });
});

describe('validatePAN', () => {
  it('accepts a valid PAN', () => {
    const r = validatePAN('ABCDE1234F');
    expect(r.valid).toBe(true);
    expect(r.formatted).toBe('ABCDE1234F');
  });

  it('accepts a lowercase PAN and normalizes it', () => {
    const r = validatePAN('abcde1234f');
    expect(r.valid).toBe(true);
    expect(r.formatted).toBe('ABCDE1234F');
  });

  it('rejects a PAN with the wrong format', () => {
    const r = validatePAN('ABCD12345F');
    expect(r.valid).toBe(false);
    expect(r.error).toBe('PAN must be in format ABCDE1234F.');
  });

  it('rejects a PAN with too few characters', () => {
    const r = validatePAN('ABC1234F');
    expect(r.valid).toBe(false);
  });

  it('returns null error for empty input', () => {
    const r = validatePAN('');
    expect(r.valid).toBe(false);
    expect(r.error).toBeNull();
  });
});

describe('validateIndianDocument', () => {
  it('detects and validates an Aadhaar', () => {
    const r = validateIndianDocument('100000000001');
    expect(r.type).toBe('aadhaar');
    expect(r.valid).toBe(true);
  });

  it('detects and validates a PAN', () => {
    const r = validateIndianDocument('ABCDE1234F');
    expect(r.type).toBe('pan');
    expect(r.valid).toBe(true);
  });

  it('returns null type for unrecognized input', () => {
    const r = validateIndianDocument('M1234567');
    expect(r.type).toBeNull();
  });
});
