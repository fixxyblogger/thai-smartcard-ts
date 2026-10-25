import { describe, expect, it } from 'vitest';
import { citizenIdCheckDigit, formatCitizenId, isValidCitizenId } from '../src/utils/citizen-id.js';

describe('Thai citizen ID helpers', () => {
  // Valid test IDs matching standard Mod-11 Thai ID checksum formula:
  // e.g. 1-1001-00000-01-9 -> check digit 9
  // 12*1 + 11*1 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 0 + 3*0 + 2*1 = 12 + 11 + 2 = 25.
  // 25 mod 11 = 3. 11 - 3 = 8 mod 10 = 8.
  it('computes check digit accurately', () => {
    // "110010000001" -> 8
    expect(citizenIdCheckDigit('110010000001')).toBe(8);
    // "123456789012"
    // 1*13 + 2*12 + 3*11 + 4*10 + 5*9 + 6*8 + 7*7 + 8*6 + 9*5 + 0*4 + 1*3 + 2*2 = 328
    // 328 mod 11 = 9 -> 11 - 9 = 2 mod 10 = 2
    expect(citizenIdCheckDigit('123456789012')).toBe(1);
  });

  it('throws on non-12 digit inputs for citizenIdCheckDigit', () => {
    expect(() => citizenIdCheckDigit('123')).toThrow(TypeError);
    expect(() => citizenIdCheckDigit('1234567890123')).toThrow(TypeError);
    expect(() => citizenIdCheckDigit('12345678901a')).toThrow(TypeError);
  });

  it('validates 13-digit IDs correctly', () => {
    expect(isValidCitizenId('1100100000018')).toBe(true);
    expect(isValidCitizenId('1-1001-00000-01-8')).toBe(true);
    expect(isValidCitizenId('1100100000010')).toBe(false);
    expect(isValidCitizenId('12345')).toBe(false);
    expect(isValidCitizenId('abcdefghijklm')).toBe(false);
  });

  it('formats 13-digit IDs with standard dashes', () => {
    expect(formatCitizenId('1100100000018')).toBe('1-1001-00000-01-8');
    expect(formatCitizenId('1-1001-00000-01-8')).toBe('1-1001-00000-01-8');
    expect(formatCitizenId('invalid')).toBe('invalid');
  });
});
