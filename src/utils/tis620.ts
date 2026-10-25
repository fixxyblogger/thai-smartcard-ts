/**
 * TIS-620 (Thai Industrial Standard 620-2533) decoder.
 *
 * Thai National ID cards store text in TIS-620. The mapping to Unicode is a
 * simple linear offset for the Thai block, so no external dependency (iconv,
 * full-icu) is required:
 *
 * - `0x00..0x7F` → ASCII (identical)
 * - `0xA1..0xFB` → `U+0E01..U+0E5B` (offset `0x0D60`)
 * - everything else is undefined in TIS-620 and is dropped
 *
 * @module
 */

const THAI_OFFSET = 0x0e01 - 0xa1;

/**
 * Decode a TIS-620 encoded byte array into a JavaScript (UTF-16) string.
 *
 * Bytes that are undefined in TIS-620 are skipped.
 *
 * @example
 * ```ts
 * decodeTis620(Uint8Array.of(0xb9, 0xd2, 0xc2)); // "นาย"
 * ```
 */
export function decodeTis620(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b >= 0xa1 && b <= 0xfb) {
      out += String.fromCharCode(b + THAI_OFFSET);
    }
    // 0x80..0xA0 and 0xFC..0xFF are undefined in TIS-620 → ignored.
  }
  return out;
}

/**
 * Encode a string into TIS-620 bytes. Characters that cannot be represented
 * are replaced with `?` (0x3F).
 *
 * Mostly useful for building test fixtures.
 */
export function encodeTis620(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  let i = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0x3f;
    if (cp < 0x80) {
      out[i++] = cp;
    } else if (cp >= 0x0e01 && cp <= 0x0e5b) {
      out[i++] = cp - THAI_OFFSET;
    } else {
      out[i++] = 0x3f;
    }
  }
  return out.subarray(0, i);
}
