/**
 * thai-smartcard-ts — TypeScript SDK for reading Thai National ID cards
 * (บัตรประจำตัวประชาชน) via PC/SC APDU & JPEG photo in Node.js.
 *
 * This entry point is dependency-free and runtime-agnostic. For automatic
 * PC/SC reader monitoring in Node.js, see `thai-smartcard-ts/pcsc`.
 *
 * @packageDocumentation
 */

// APDU / transport
export {
  ApduError,
  type ApduResponse,
  type CardTransport,
  parseApduResponse,
  SW_SUCCESS,
  type TransceiveOptions,
  transceive,
} from './apdu.js';

// Thai National ID card
export {
  type FieldLocation,
  getResponseCommand,
  readBinary,
  SELECT_THAI_ID_APPLET,
  THAI_ID_AID,
  THAI_ID_FIELDS,
  THAI_ID_PHOTO,
  type ThaiIdField,
} from './id-card/commands.js';
export {
  decodeField,
  type Gender,
  isJpeg,
  parseAddress,
  parseCardDate,
  parseGender,
  parseName,
  photoToDataUrl,
  type ThaiAddress,
  type ThaiName,
  trimJpeg,
} from './id-card/parse.js';
export {
  type ReadThaiIdCardOptions,
  readThaiIdCard,
  type ThaiIdCardData,
  ThaiIdCardSession,
} from './id-card/read.js';

// Utilities
export { concatBytes, fromHex, toBase64, toHex } from './utils/bytes.js';
export { citizenIdCheckDigit, formatCitizenId, isValidCitizenId } from './utils/citizen-id.js';
export {
  BUDDHIST_ERA_OFFSET,
  beToCe,
  ceToBe,
  parseThaiDate,
  type ThaiDate,
  thaiDateToDate,
} from './utils/date.js';
export { decodeTis620, encodeTis620 } from './utils/tis620.js';
