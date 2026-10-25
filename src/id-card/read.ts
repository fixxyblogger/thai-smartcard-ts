/**
 * High-level Thai National ID card reading over any {@link CardTransport}.
 *
 * @module
 */

import { type CardTransport, transceive } from '../apdu.js';
import { concatBytes } from '../utils/bytes.js';
import type { ThaiDate } from '../utils/date.js';
import {
  getResponseCommand,
  readBinary,
  SELECT_THAI_ID_APPLET,
  THAI_ID_FIELDS,
  THAI_ID_PHOTO,
  type ThaiIdField,
} from './commands.js';
import {
  decodeField,
  type Gender,
  isJpeg,
  parseAddress,
  parseCardDate,
  parseGender,
  parseName,
  type ThaiAddress,
  type ThaiName,
  trimJpeg,
} from './parse.js';

/** Data read from a Thai National ID card. */
export interface ThaiIdCardData {
  /** 13-digit citizen ID (เลขประจำตัวประชาชน), digits only. */
  citizenId: string;
  /** Thai name (ชื่อ-นามสกุล ภาษาไทย). */
  nameTh: ThaiName;
  /** English name. */
  nameEn: ThaiName;
  /** Date of birth (converted from B.E.). */
  dateOfBirth: ThaiDate;
  gender: Gender;
  /** Issuing office (สถานที่ออกบัตร). */
  issuer: string;
  /** Card issue date. */
  issueDate: ThaiDate;
  /** Card expiry date. `lifetime` is `true` for non-expiring cards. */
  expireDate: ThaiDate;
  /** Registered address (ที่อยู่ตามทะเบียนบ้าน). */
  address: ThaiAddress;
  /**
   * JPEG photo bytes, present only when `photo: true` was requested.
   * Use `Buffer.from(photo)` in Node.js to write it to disk.
   */
  photo?: Uint8Array;
}

/** Options for {@link readThaiIdCard}. */
export interface ReadThaiIdCardOptions {
  /** Also read the JPEG photo (~20 extra APDUs, ~1–3 s). Default `false`. */
  photo?: boolean;
  /** Called after each photo chunk, e.g. for a progress bar. */
  onPhotoProgress?: (completed: number, total: number) => void;
  /** Abort the read between APDUs. */
  signal?: AbortSignal;
}

/**
 * Low-level session bound to a transport. Use this if you need individual
 * fields; otherwise prefer {@link readThaiIdCard}.
 */
export class ThaiIdCardSession {
  readonly #transport: CardTransport;
  readonly #getResponse: (length: number) => Uint8Array;
  #selected = false;

  constructor(transport: CardTransport) {
    this.#transport = transport;
    this.#getResponse = getResponseCommand(transport.atr);
  }

  /** Send a command, handling GET RESPONSE according to the card's ATR. */
  send(command: Uint8Array): Promise<Uint8Array> {
    return transceive(this.#transport, command, { getResponse: this.#getResponse });
  }

  /** Select the Thai personal-data applet. Called automatically by readers. */
  async select(): Promise<void> {
    await this.send(SELECT_THAI_ID_APPLET);
    this.#selected = true;
  }

  async #ensureSelected(): Promise<void> {
    if (!this.#selected) await this.select();
  }

  /** Read raw bytes at an arbitrary offset of the applet. */
  async readRaw(offset: number, length: number): Promise<Uint8Array> {
    await this.#ensureSelected();
    return this.send(readBinary(offset, length));
  }

  /** Read a text field and decode it from TIS-620. */
  async readText(field: ThaiIdField): Promise<string> {
    const { offset, length } = THAI_ID_FIELDS[field];
    return decodeField(await this.readRaw(offset, length));
  }

  /** Read the JPEG photo. */
  async readPhoto(options: Omit<ReadThaiIdCardOptions, 'photo'> = {}): Promise<Uint8Array> {
    const { offset, chunkSize, chunks } = THAI_ID_PHOTO;
    const parts: Uint8Array[] = [];
    for (let i = 0; i < chunks; i++) {
      options.signal?.throwIfAborted();
      parts.push(await this.readRaw(offset + i * chunkSize, chunkSize));
      options.onPhotoProgress?.(i + 1, chunks);
    }
    const jpeg = concatBytes(parts);
    return isJpeg(jpeg) ? trimJpeg(jpeg) : jpeg;
  }

  /** Read every text field (and optionally the photo). */
  async readAll(options: ReadThaiIdCardOptions = {}): Promise<ThaiIdCardData> {
    const text = {} as Record<ThaiIdField, string>;
    for (const field of Object.keys(THAI_ID_FIELDS) as ThaiIdField[]) {
      options.signal?.throwIfAborted();
      text[field] = await this.readText(field);
    }

    const data: ThaiIdCardData = {
      citizenId: text.citizenId.replace(/\D/g, ''),
      nameTh: parseName(text.nameTh),
      nameEn: parseName(text.nameEn),
      dateOfBirth: parseCardDate(text.dateOfBirth),
      gender: parseGender(text.gender),
      issuer: text.issuer,
      issueDate: parseCardDate(text.issueDate),
      expireDate: parseCardDate(text.expireDate),
      address: parseAddress(text.address),
    };

    if (options.photo) data.photo = await this.readPhoto(options);
    return data;
  }
}

/**
 * Read a Thai National ID card.
 *
 * @example
 * ```ts
 * const data = await readThaiIdCard(transport, { photo: true });
 * console.log(data.citizenId, data.nameTh.full);
 * ```
 */
export function readThaiIdCard(
  transport: CardTransport,
  options?: ReadThaiIdCardOptions,
): Promise<ThaiIdCardData> {
  return new ThaiIdCardSession(transport).readAll(options);
}
