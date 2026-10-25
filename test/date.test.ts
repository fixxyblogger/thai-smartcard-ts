import { describe, expect, it } from 'vitest';
import {
  BUDDHIST_ERA_OFFSET,
  beToCe,
  ceToBe,
  parseThaiDate,
  thaiDateToDate,
} from '../src/utils/date.js';

describe('Thai Date helpers', () => {
  it('converts BE and CE years correctly', () => {
    expect(BUDDHIST_ERA_OFFSET).toBe(543);
    expect(beToCe(2530)).toBe(1987);
    expect(ceToBe(1987)).toBe(2530);
  });

  it('parses valid Buddhist Era date YYYYMMDD', () => {
    const parsed = parseThaiDate('25300115', 'BE');
    expect(parsed).toEqual({
      raw: '25300115',
      year: 1987,
      month: 1,
      day: 15,
      iso: '1987-01-15',
      lifetime: false,
    });
    const date = thaiDateToDate(parsed);
    expect(date?.toISOString()).toBe('1987-01-15T00:00:00.000Z');
  });

  it('parses Common Era date YYYYMMDD', () => {
    const parsed = parseThaiDate('19870115', 'CE');
    expect(parsed.year).toBe(1987);
    expect(parsed.month).toBe(1);
    expect(parsed.day).toBe(15);
    expect(parsed.iso).toBe('1987-01-15');
  });

  it('handles unknown month and day (00)', () => {
    const parsed = parseThaiDate('24900000', 'BE');
    expect(parsed.year).toBe(1947);
    expect(parsed.month).toBeNull();
    expect(parsed.day).toBeNull();
    expect(parsed.iso).toBeNull();
    expect(thaiDateToDate(parsed)).toBeNull();
  });

  it('handles lifetime sentinels (99999999)', () => {
    const parsed = parseThaiDate('99999999', 'BE');
    expect(parsed.lifetime).toBe(true);
    expect(parsed.iso).toBeNull();
  });

  it('handles invalid date strings gracefully', () => {
    const parsed = parseThaiDate('not-a-date');
    expect(parsed.year).toBeNull();
    expect(parsed.iso).toBeNull();
  });
});
