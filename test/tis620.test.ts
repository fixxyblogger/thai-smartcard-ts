import { describe, expect, it } from 'vitest';
import { decodeTis620, encodeTis620 } from '../src/utils/tis620.js';

describe('TIS-620 codec', () => {
  it('decodes ASCII without alteration', () => {
    const bytes = new TextEncoder().encode('Hello World 123!');
    expect(decodeTis620(bytes)).toBe('Hello World 123!');
  });

  it('decodes Thai characters correctly', () => {
    // ก (0xE01) in TIS-620 is 0xA1; ข is 0xA2
    const bytes = Uint8Array.of(0xa1, 0xa2);
    expect(decodeTis620(bytes)).toBe('กข');
  });

  it('round-trips full Thai phrases', () => {
    const phrase = 'นาย สมชาย ใจดี ๑๒๓๔';
    const encoded = encodeTis620(phrase);
    expect(decodeTis620(encoded)).toBe(phrase);
  });

  it('ignores undefined byte ranges in TIS-620', () => {
    // 0x80..0xA0 and 0xFC..0xFF are undefined
    const bytes = Uint8Array.of(0x80, 0xa1, 0xff, 0xa2);
    expect(decodeTis620(bytes)).toBe('กข');
  });

  it('replaces unsupported characters with question mark on encode', () => {
    const text = 'Hello 🚀 World';
    const encoded = encodeTis620(text);
    expect(decodeTis620(encoded)).toBe('Hello ? World');
  });
});
