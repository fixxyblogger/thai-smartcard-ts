/**
 * Transport-agnostic APDU helpers (ISO/IEC 7816-4).
 *
 * The SDK never talks to hardware directly. Anything that can send a command
 * APDU and return the raw response bytes (data + SW1 SW2) can be used as a
 * {@link CardTransport} — `pcsc-mini`, `@pokusew/pcsclite`, WebUSB, a mock in
 * tests, etc.
 *
 * @module
 */

import { concatBytes, toHex } from './utils/bytes.js';

/** Minimal interface the SDK needs to talk to a smart card. */
export interface CardTransport {
  /**
   * Send a command APDU and resolve with the raw response, **including** the
   * trailing status word (SW1 SW2).
   */
  transmit(command: Uint8Array): Promise<Uint8Array>;
  /**
   * The card's Answer-To-Reset. Optional, but recommended: some Thai ID card
   * generations (ATR starting with `3B 67`) require a different GET RESPONSE
   * command.
   */
  readonly atr?: Uint8Array;
}

/** A parsed response APDU. */
export interface ApduResponse {
  /** Response data without the status word. */
  data: Uint8Array;
  sw1: number;
  sw2: number;
  /** `(sw1 << 8) | sw2`, e.g. `0x9000`. */
  sw: number;
}

/** Status word for successful completion. */
export const SW_SUCCESS = 0x9000;

/** Error thrown when a card returns a non-success status word. */
export class ApduError extends Error {
  /** The full status word, e.g. `0x6A82`. */
  readonly sw: number;
  /** The command that failed. */
  readonly command: Uint8Array;

  constructor(sw: number, command: Uint8Array, message?: string) {
    const swHex = sw.toString(16).toUpperCase().padStart(4, '0');
    super(message ?? `Card returned status ${swHex} for command ${toHex(command)}`);
    this.name = 'ApduError';
    this.sw = sw;
    this.command = command;
  }
}

/** Split a raw response into data and status word. */
export function parseApduResponse(raw: Uint8Array): ApduResponse {
  if (raw.length < 2) {
    throw new RangeError(`Response too short (${raw.length} bytes); expected at least SW1 SW2`);
  }
  const sw1 = raw[raw.length - 2] as number;
  const sw2 = raw[raw.length - 1] as number;
  return { data: raw.subarray(0, raw.length - 2), sw1, sw2, sw: (sw1 << 8) | sw2 };
}

/** Options for {@link transceive}. */
export interface TransceiveOptions {
  /**
   * Builds the GET RESPONSE command used when the card answers `61 xx`.
   * Defaults to `00 C0 00 00 xx`.
   */
  getResponse?: (length: number) => Uint8Array;
  /** Maximum number of chained GET RESPONSE calls (safety net). Default `32`. */
  maxChain?: number;
}

const defaultGetResponse = (length: number): Uint8Array =>
  Uint8Array.of(0x00, 0xc0, 0x00, 0x00, length);

/**
 * Send a command and transparently handle the T=0 protocol dance:
 *
 * - `61 xx` → issue GET RESPONSE for `xx` bytes (repeated while chained)
 * - `6C xx` → re-send the command with the corrected `Le = xx`
 *
 * Resolves with the response **data** (status word stripped) or rejects with
 * {@link ApduError} for any non-`9000` final status.
 */
export async function transceive(
  transport: CardTransport,
  command: Uint8Array,
  options: TransceiveOptions = {},
): Promise<Uint8Array> {
  const getResponse = options.getResponse ?? defaultGetResponse;
  const maxChain = options.maxChain ?? 32;

  let res = parseApduResponse(await transport.transmit(command));

  if (res.sw1 === 0x6c) {
    const retry = command.slice();
    retry[retry.length - 1] = res.sw2;
    res = parseApduResponse(await transport.transmit(retry));
  }

  const chunks: Uint8Array[] = [res.data];
  let chain = 0;
  while (res.sw1 === 0x61) {
    if (++chain > maxChain) {
      throw new ApduError(res.sw, command, 'Too many chained GET RESPONSE calls');
    }
    res = parseApduResponse(await transport.transmit(getResponse(res.sw2)));
    chunks.push(res.data);
  }

  if (res.sw !== SW_SUCCESS) throw new ApduError(res.sw, command);
  return chunks.length === 1 ? (chunks[0] as Uint8Array) : concatBytes(chunks);
}
