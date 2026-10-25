import { describe, expect, it } from 'vitest';
import { concatBytes, fromHex, toBase64, toHex } from '../src/utils/bytes.js';

describe('Byte utilities', () => {
  it('formats bytes to hex', () => {
    const bytes = Uint8Array.of(0x00, 0xa4, 0x04, 0x00);
    expect(toHex(bytes)).toBe('00 A4 04 00');
    expect(toHex(bytes, '')).toBe('00A40400');
  });

  it('parses hex to bytes', () => {
    const parsed = fromHex('00 a4 04 00');
    expect(parsed).toEqual(Uint8Array.of(0x00, 0xa4, 0x04, 0x00));
  });

  it('throws on invalid hex input', () => {
    expect(() => fromHex('00 A')).toThrow(TypeError);
    expect(() => fromHex('00 G1')).toThrow(TypeError);
  });

  it('concatenates multiple Uint8Arrays', () => {
    const a = Uint8Array.of(1, 2);
    const b = Uint8Array.of(3, 4, 5);
    const c = Uint8Array.of(6);
    expect(concatBytes([a, b, c])).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6));
  });

  it('encodes base64 with correct padding', () => {
    // Standard test vectors
    expect(toBase64(new TextEncoder().encode(''))).toBe('');
    expect(toBase64(new TextEncoder().encode('f'))).toBe('Zg==');
    expect(toBase64(new TextEncoder().encode('fo'))).toBe('Zm8=');
    expect(toBase64(new TextEncoder().encode('foo'))).toBe('Zm9v');
    expect(toBase64(new TextEncoder().encode('foob'))).toBe('Zm9vYg==');
    expect(toBase64(new TextEncoder().encode('fooba'))).toBe('Zm9vYmE=');
    expect(toBase64(new TextEncoder().encode('foobar'))).toBe('Zm9vYmFy');
  });
});
