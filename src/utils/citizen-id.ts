/**
 * Thai 13-digit citizen ID helpers.
 *
 * The last digit is a checksum: for digits d0..d11,
 * `check = (11 - (Σ d[i] * (13 - i)) mod 11) mod 10`.
 *
 * @module
 */

/** Compute the check digit for the first 12 digits of a Thai citizen ID. */
export function citizenIdCheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) {
    throw new TypeError('Expected exactly 12 digits');
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (13 - i);
  }
  return (11 - (sum % 11)) % 10;
}

/**
 * Validate a Thai 13-digit citizen ID (เลขประจำตัวประชาชน).
 *
 * Dashes and whitespace are ignored, so `"1-2345-67890-12-1"` is accepted.
 */
export function isValidCitizenId(id: string): boolean {
  const digits = id.replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(digits)) return false;
  return citizenIdCheckDigit(digits.slice(0, 12)) === Number(digits[12]);
}

/**
 * Format a 13-digit citizen ID as `X-XXXX-XXXXX-XX-X`.
 * Returns the input unchanged if it is not 13 digits.
 */
export function formatCitizenId(id: string): string {
  const d = id.replace(/[\s-]/g, '');
  if (!/^\d{13}$/.test(d)) return id;
  return `${d[0]}-${d.slice(1, 5)}-${d.slice(5, 10)}-${d.slice(10, 12)}-${d[12]}`;
}
