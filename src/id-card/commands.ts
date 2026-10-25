/**
 * APDU commands for the Thai National ID Card (บัตรประจำตัวประชาชน).
 *
 * All read commands use the proprietary `80 B0 P1 P2 02 00 Le` READ BINARY
 * variant against the "Thailand Personal" applet.
 *
 * @module
 */

/** AID of the Thai personal-data applet: `A0 00 00 00 54 48 00 01`. */
export const THAI_ID_AID: Uint8Array = Uint8Array.of(
  0xa0,
  0x00,
  0x00,
  0x00,
  0x54,
  0x48,
  0x00,
  0x01,
);

/** `SELECT` by DF name for {@link THAI_ID_AID}. */
export const SELECT_THAI_ID_APPLET: Uint8Array = Uint8Array.of(
  0x00,
  0xa4,
  0x04,
  0x00,
  0x08,
  ...THAI_ID_AID,
);

/** Build a Thai ID `READ BINARY` command for `length` bytes at `offset`. */
export function readBinary(offset: number, length: number): Uint8Array {
  if (offset < 0 || offset > 0xffff) throw new RangeError(`Invalid offset ${offset}`);
  if (length < 1 || length > 0xff) throw new RangeError(`Invalid length ${length}`);
  return Uint8Array.of(0x80, 0xb0, (offset >> 8) & 0xff, offset & 0xff, 0x02, 0x00, length);
}

/** A readable text field on the card. */
export interface FieldLocation {
  offset: number;
  length: number;
}

/** Locations of the text fields in the personal-data applet. */
export const THAI_ID_FIELDS: {
  readonly citizenId: FieldLocation;
  readonly nameTh: FieldLocation;
  readonly nameEn: FieldLocation;
  readonly dateOfBirth: FieldLocation;
  readonly gender: FieldLocation;
  readonly issuer: FieldLocation;
  readonly issueDate: FieldLocation;
  readonly expireDate: FieldLocation;
  readonly address: FieldLocation;
} = {
  citizenId: { offset: 0x0004, length: 0x0d },
  nameTh: { offset: 0x0011, length: 0x64 },
  nameEn: { offset: 0x0075, length: 0x64 },
  dateOfBirth: { offset: 0x00d9, length: 0x08 },
  gender: { offset: 0x00e1, length: 0x01 },
  issuer: { offset: 0x00f6, length: 0x64 },
  issueDate: { offset: 0x0167, length: 0x08 },
  expireDate: { offset: 0x016f, length: 0x08 },
  address: { offset: 0x1579, length: 0x64 },
};

/** Name of a readable text field. */
export type ThaiIdField = keyof typeof THAI_ID_FIELDS;

/** Photo (JPEG) storage: 20 consecutive 255-byte chunks starting at `0x017B`. */
export const THAI_ID_PHOTO: {
  readonly offset: number;
  readonly chunkSize: number;
  readonly chunks: number;
} = {
  offset: 0x017b,
  chunkSize: 0xff,
  chunks: 20,
};

/**
 * GET RESPONSE command. Cards whose ATR begins with `3B 67` expect `P2 = 01`;
 * all others use the standard `00 C0 00 00 Le`.
 */
export function getResponseCommand(atr?: Uint8Array): (length: number) => Uint8Array {
  const p2 = atr && atr[0] === 0x3b && atr[1] === 0x67 ? 0x01 : 0x00;
  return (length) => Uint8Array.of(0x00, 0xc0, 0x00, p2, length);
}
