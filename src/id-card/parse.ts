/**
 * Pure parsers for raw Thai ID card field values. No I/O.
 *
 * @module
 */

import { toBase64 } from '../utils/bytes.js';
import { parseThaiDate, type ThaiDate } from '../utils/date.js';
import { decodeTis620 } from '../utils/tis620.js';

/** A person's name as stored on the card (`prefix#first#middle#last`). */
export interface ThaiName {
  /** Title, e.g. `นาย`, `นางสาว`, `Mr.`, `Miss`. */
  prefix: string;
  firstName: string;
  middleName: string;
  lastName: string;
  /** Space-joined non-empty parts, e.g. `"นาย สมชาย ใจดี"`. */
  full: string;
}

/** A Thai address as stored on the card. */
export interface ThaiAddress {
  /** บ้านเลขที่ */
  houseNo: string;
  /** หมู่ที่ (village number, usually includes the `หมู่ที่` label). */
  villageNo: string;
  /** ตรอก */
  lane: string;
  /** ซอย */
  alley: string;
  /** ถนน */
  road: string;
  /** ตำบล / แขวง */
  subdistrict: string;
  /** อำเภอ / เขต */
  district: string;
  /** จังหวัด */
  province: string;
  /** Space-joined non-empty parts. */
  full: string;
}

/** Gender as encoded on the card (`1` = male, `2` = female). */
export type Gender = 'male' | 'female' | 'unknown';

/** Decode TIS-620 bytes and strip padding (spaces, NULs and filler). */
export function decodeField(bytes: Uint8Array): string {
  return decodeTis620(bytes).replaceAll('\0', '').trim();
}

const joinParts = (parts: string[]): string => parts.filter(Boolean).join(' ');

/** Parse a `#`-separated name such as `นาย#สมชาย##ใจดี`. */
export function parseName(text: string): ThaiName {
  const [prefix = '', firstName = '', middleName = '', lastName = ''] = text
    .split('#')
    .map((s) => s.trim());
  return {
    prefix,
    firstName,
    middleName,
    lastName,
    full: joinParts([prefix, firstName, middleName, lastName]),
  };
}

/** Parse a `#`-separated address (8 parts). */
export function parseAddress(text: string): ThaiAddress {
  const parts = text.split('#').map((s) => s.trim());
  const [
    houseNo = '',
    villageNo = '',
    lane = '',
    alley = '',
    road = '',
    subdistrict = '',
    district = '',
    province = '',
  ] = parts;
  return {
    houseNo,
    villageNo,
    lane,
    alley,
    road,
    subdistrict,
    district,
    province,
    full: joinParts(parts),
  };
}

/** Parse the 1-byte gender field. */
export function parseGender(text: string): Gender {
  const v = text.trim();
  if (v === '1') return 'male';
  if (v === '2') return 'female';
  return 'unknown';
}

/** Parse a B.E. `YYYYMMDD` date field. */
export function parseCardDate(text: string): ThaiDate {
  return parseThaiDate(text, 'BE');
}

const JPEG_SOI = [0xff, 0xd8] as const;
const JPEG_EOI = [0xff, 0xd9] as const;

/** `true` when the bytes start with a JPEG SOI marker. */
export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === JPEG_SOI[0] && bytes[1] === JPEG_SOI[1];
}

/**
 * Trim filler bytes after the JPEG End-Of-Image marker. The card's photo area
 * is a fixed 5100 bytes, so the actual JPEG is usually followed by padding.
 */
export function trimJpeg(bytes: Uint8Array): Uint8Array {
  for (let i = bytes.length - 2; i >= 2; i--) {
    if (bytes[i] === JPEG_EOI[0] && bytes[i + 1] === JPEG_EOI[1]) {
      return bytes.subarray(0, i + 2);
    }
  }
  return bytes;
}

/** Convert JPEG bytes to a `data:image/jpeg;base64,…` URL (e.g. for `<img src>`). */
export function photoToDataUrl(photo: Uint8Array): string {
  return `data:image/jpeg;base64,${toBase64(photo)}`;
}
