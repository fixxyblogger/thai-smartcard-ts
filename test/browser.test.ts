import { describe, expect, it } from 'vitest';
import type { CardTransport, ThaiIdCardData } from '../dist/index.mjs';
import {
  ApduError,
  concatBytes,
  decodeTis620,
  encodeTis620,
  formatCitizenId,
  fromHex,
  isValidCitizenId,
  parseAddress,
  parseGender,
  parseName,
  parseThaiDate,
  photoToDataUrl,
  readBinary,
  readThaiIdCard,
  THAI_ID_FIELDS,
  toBase64,
  toHex,
  transceive,
} from '../dist/index.mjs';

describe('Browser environment compatibility for dist/index.mjs', () => {
  it('exports all pure browser-safe utilities and classes', () => {
    expect(typeof readThaiIdCard).toBe('function');
    expect(typeof photoToDataUrl).toBe('function');
    expect(typeof formatCitizenId).toBe('function');
    expect(typeof isValidCitizenId).toBe('function');
    expect(typeof encodeTis620).toBe('function');
    expect(typeof decodeTis620).toBe('function');
    expect(typeof toHex).toBe('function');
    expect(typeof fromHex).toBe('function');
    expect(typeof concatBytes).toBe('function');
    expect(typeof toBase64).toBe('function');
    expect(typeof transceive).toBe('function');
    expect(typeof readBinary).toBe('function');
    expect(typeof parseName).toBe('function');
    expect(typeof parseAddress).toBe('function');
    expect(typeof parseGender).toBe('function');
    expect(typeof parseThaiDate).toBe('function');
    expect(ApduError).toBeDefined();
    expect(THAI_ID_FIELDS).toBeDefined();
  });

  it('runs Thai ID card reading with mock transport without Node globals', async () => {
    const responses = new Map<number, Uint8Array>();
    responses.set(THAI_ID_FIELDS.citizenId.offset, encodeTis620('1100100000018'));
    responses.set(THAI_ID_FIELDS.nameTh.offset, encodeTis620('นางสาว#กานดา##รักเรียน'));
    responses.set(THAI_ID_FIELDS.nameEn.offset, encodeTis620('Miss#Kanda##Rakrian'));
    responses.set(THAI_ID_FIELDS.dateOfBirth.offset, encodeTis620('25350812'));
    responses.set(THAI_ID_FIELDS.gender.offset, encodeTis620('2'));
    responses.set(THAI_ID_FIELDS.issuer.offset, encodeTis620('สำนักทะเบียนท้องถิ่นเขตพญาไท'));
    responses.set(THAI_ID_FIELDS.issueDate.offset, encodeTis620('25630810'));
    responses.set(THAI_ID_FIELDS.expireDate.offset, encodeTis620('25710811'));
    responses.set(
      THAI_ID_FIELDS.address.offset,
      encodeTis620('123/45#หมู่ที่ 1#ตรอกทดสอบ#ซอยร่วมใจ#ถนนพหลโยธิน#สามเสนใน#พญาไท#กรุงเทพมหานคร'),
    );

    // Mock JPEG photo (starts with FF D8, ends with FF D9)
    const mockPhotoBytes = Uint8Array.of(
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x10,
      0x4a,
      0x46,
      0x49,
      0x46,
      0x00,
      0x01,
      0x01,
      0x00,
      0x00,
      0x01,
      0x00,
      0x01,
      0x00,
      0x00,
      0xff,
      0xdb,
      0x00,
      0x43,
      0x00,
      0x08,
      0x06,
      0x06,
      0xff,
      0xd9,
    );

    const transport: CardTransport = {
      transmit: async (cmd: Uint8Array) => {
        // SELECT DF
        if (cmd[0] === 0x00 && cmd[1] === 0xa4) {
          return Uint8Array.of(0x90, 0x00);
        }
        // READ BINARY: 80 B0 P1 P2 02 00 Le
        if (cmd[0] === 0x80 && cmd[1] === 0xb0) {
          const offset = ((cmd[2] as number) << 8) | (cmd[3] as number);
          if (offset === 0x017b) {
            // First photo chunk
            return concatBytes([mockPhotoBytes, Uint8Array.of(0x90, 0x00)]);
          }
          const data = responses.get(offset) ?? new Uint8Array(0);
          return concatBytes([data, Uint8Array.of(0x90, 0x00)]);
        }
        return Uint8Array.of(0x6a, 0x82);
      },
    };

    const card: ThaiIdCardData = await readThaiIdCard(transport, { photo: true });

    expect(card.citizenId).toBe('1100100000018');
    expect(isValidCitizenId(card.citizenId)).toBe(true);
    expect(formatCitizenId(card.citizenId)).toBe('1-1001-00000-01-8');
    expect(card.nameTh.full).toBe('นางสาว กานดา รักเรียน');
    expect(card.nameEn.full).toBe('Miss Kanda Rakrian');
    expect(card.gender).toBe('female');
    expect(card.dateOfBirth.iso).toBe('1992-08-12');
    expect(card.dateOfBirth.year).toBe(1992);
    expect(card.address.province).toBe('กรุงเทพมหานคร');
    expect(card.photo).toBeDefined();
    if (!card.photo) throw new Error('Expected photo bytes');

    const dataUrl = photoToDataUrl(card.photo);
    expect(dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
