/**
 * Thai date helpers. Thai ID cards store dates as Buddhist Era (B.E.)
 * `YYYYMMDD` strings, where B.E. year = Gregorian (C.E.) year + 543.
 *
 * Month and/or day may be `00` when unknown (common for older citizens), and
 * some lifetime cards use a sentinel such as `99999999` for the expiry date.
 *
 * @module
 */

/** Difference between Buddhist Era and Common Era years. */
export const BUDDHIST_ERA_OFFSET = 543;

/** A date as stored on a Thai card, with both raw and normalized forms. */
export interface ThaiDate {
  /** The raw string as read from the card (e.g. `"25300115"`). */
  raw: string;
  /** Gregorian (C.E.) year, or `null` if unknown / lifetime. */
  year: number | null;
  /** Month `1..12`, or `null` if unknown. */
  month: number | null;
  /** Day of month `1..31`, or `null` if unknown. */
  day: number | null;
  /**
   * ISO-8601 calendar date `YYYY-MM-DD` when year, month and day are all
   * known; otherwise `null`.
   */
  iso: string | null;
  /** `true` when the card uses a "lifetime / no expiry" sentinel value. */
  lifetime: boolean;
}

const pad = (n: number, len = 2): string => String(n).padStart(len, '0');

/** Convert a Buddhist Era year to a Gregorian year. */
export const beToCe = (beYear: number): number => beYear - BUDDHIST_ERA_OFFSET;

/** Convert a Gregorian year to a Buddhist Era year. */
export const ceToBe = (ceYear: number): number => ceYear + BUDDHIST_ERA_OFFSET;

/**
 * Parse a `YYYYMMDD` date string.
 *
 * @param raw - The raw 8-digit string.
 * @param era - Era of the year component. Thai ID cards use `'BE'`.
 */
export function parseThaiDate(raw: string, era: 'BE' | 'CE' = 'BE'): ThaiDate {
  const value = raw.trim();
  const result: ThaiDate = {
    raw: value,
    year: null,
    month: null,
    day: null,
    iso: null,
    lifetime: false,
  };

  if (!/^\d{8}$/.test(value)) return result;

  if (/^9{8}$/.test(value) || value.startsWith('9999')) {
    result.lifetime = true;
    return result;
  }

  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(4, 6));
  const d = Number(value.slice(6, 8));

  if (y > 0) result.year = era === 'BE' ? beToCe(y) : y;
  if (m >= 1 && m <= 12) result.month = m;
  if (d >= 1 && d <= 31) result.day = d;

  if (result.year !== null && result.month !== null && result.day !== null) {
    result.iso = `${pad(result.year, 4)}-${pad(result.month)}-${pad(result.day)}`;
  }
  return result;
}

/**
 * Convert a {@link ThaiDate} to a JavaScript `Date` at UTC midnight, or
 * `null` if the date is incomplete.
 */
export function thaiDateToDate(date: ThaiDate): Date | null {
  return date.iso ? new Date(`${date.iso}T00:00:00.000Z`) : null;
}
