import { describe, expect, it } from 'vitest';
import type { CardTransport } from '../src/apdu.js';
import { getResponseCommand, readBinary, THAI_ID_FIELDS } from '../src/id-card/commands.js';
import {
  isJpeg,
  parseAddress,
  parseGender,
  parseName,
  photoToDataUrl,
  trimJpeg,
} from '../src/id-card/parse.js';
import { readThaiIdCard } from '../src/id-card/read.js';
import { concatBytes } from '../src/utils/bytes.js';
import { encodeTis620 } from '../src/utils/tis620.js';

describe('Thai ID Card APDU commands & parsers', () => {
  it('builds read binary APDUs', () => {
    const cmd = readBinary(0x0004, 0x0d);
    expect(cmd).toEqual(Uint8Array.of(0x80, 0xb0, 0x00, 0x04, 0x02, 0x00, 0x0d));
  });

  it('selects correct GET RESPONSE command depending on ATR', () => {
    // Standard card
    const getResStd = getResponseCommand(Uint8Array.of(0x3b, 0x68, 0x00));
    expect(getResStd(0x10)).toEqual(Uint8Array.of(0x00, 0xc0, 0x00, 0x00, 0x10));

    // Cards with ATR starting with 3B 67 expect P2 = 01
    const getRes67 = getResponseCommand(Uint8Array.of(0x3b, 0x67, 0x00));
    expect(getRes67(0x10)).toEqual(Uint8Array.of(0x00, 0xc0, 0x00, 0x01, 0x10));
  });

  it('parses Thai and English names separated by #', () => {
    const th = parseName('นาย#สมชาย##ใจดี');
    expect(th.prefix).toBe('นาย');
    expect(th.firstName).toBe('สมชาย');
    expect(th.middleName).toBe('');
    expect(th.lastName).toBe('ใจดี');
    expect(th.full).toBe('นาย สมชาย ใจดี');

    const en = parseName('Mr.#Somchai##Jaidee');
    expect(en.prefix).toBe('Mr.');
    expect(en.firstName).toBe('Somchai');
    expect(en.lastName).toBe('Jaidee');
    expect(en.full).toBe('Mr. Somchai Jaidee');
  });

  it('parses address separated by #', () => {
    const addr = parseAddress(
      '123/45#หมู่ที่ 1#ตรอกทดสอบ#ซอยร่วมใจ#ถนนสุขุมวิท#คลองเตย#คลองเตย#กรุงเทพมหานคร',
    );
    expect(addr.houseNo).toBe('123/45');
    expect(addr.villageNo).toBe('หมู่ที่ 1');
    expect(addr.lane).toBe('ตรอกทดสอบ');
    expect(addr.alley).toBe('ซอยร่วมใจ');
    expect(addr.road).toBe('ถนนสุขุมวิท');
    expect(addr.subdistrict).toBe('คลองเตย');
    expect(addr.district).toBe('คลองเตย');
    expect(addr.province).toBe('กรุงเทพมหานคร');
    expect(addr.full).toContain(
      '123/45 หมู่ที่ 1 ตรอกทดสอบ ซอยร่วมใจ ถนนสุขุมวิท คลองเตย คลองเตย กรุงเทพมหานคร',
    );
  });

  it('parses gender codes', () => {
    expect(parseGender('1')).toBe('male');
    expect(parseGender('2')).toBe('female');
    expect(parseGender('0')).toBe('unknown');
  });

  it('detects and trims JPEG data with filler bytes', () => {
    const sampleJpeg = Uint8Array.of(0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9, 0x00, 0x00);
    expect(isJpeg(sampleJpeg)).toBe(true);
    expect(trimJpeg(sampleJpeg)).toEqual(Uint8Array.of(0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9));

    const nonJpeg = Uint8Array.of(0x00, 0x01, 0x02);
    expect(isJpeg(nonJpeg)).toBe(false);
    expect(trimJpeg(nonJpeg)).toEqual(nonJpeg);
  });

  it('generates data URL from photo bytes', () => {
    const photo = Uint8Array.of(0xff, 0xd8, 0xff, 0xd9);
    expect(photoToDataUrl(photo)).toBe('data:image/jpeg;base64,/9j/2Q==');
  });
});

describe('readThaiIdCard with mock transport', () => {
  it('reads all card fields correctly', async () => {
    // Prepare fake card database mapped by offset
    const responses = new Map<number, Uint8Array>();

    responses.set(THAI_ID_FIELDS.citizenId.offset, encodeTis620('1100100000018'));
    responses.set(THAI_ID_FIELDS.nameTh.offset, encodeTis620('นาย#สมชาย##ใจดี'));
    responses.set(THAI_ID_FIELDS.nameEn.offset, encodeTis620('Mr.#Somchai##Jaidee'));
    responses.set(THAI_ID_FIELDS.dateOfBirth.offset, encodeTis620('25300115'));
    responses.set(THAI_ID_FIELDS.gender.offset, encodeTis620('1'));
    responses.set(THAI_ID_FIELDS.issuer.offset, encodeTis620('สำนักทะเบียนกลาง'));
    responses.set(THAI_ID_FIELDS.issueDate.offset, encodeTis620('25600510'));
    responses.set(THAI_ID_FIELDS.expireDate.offset, encodeTis620('25700114'));
    responses.set(
      THAI_ID_FIELDS.address.offset,
      encodeTis620('99/9#หมู่ที่ 2####บางซื่อ#บางซื่อ#กรุงเทพมหานคร'),
    );

    const mockTransport: CardTransport = {
      transmit: async (cmd: Uint8Array) => {
        // SELECT DF
        if (cmd[0] === 0x00 && cmd[1] === 0xa4) {
          return Uint8Array.of(0x90, 0x00);
        }
        // READ BINARY: 80 B0 P1 P2 02 00 Le
        if (cmd[0] === 0x80 && cmd[1] === 0xb0) {
          const offset = ((cmd[2] as number) << 8) | (cmd[3] as number);
          const data = responses.get(offset) ?? new Uint8Array(0);
          return concatBytes([data, Uint8Array.of(0x90, 0x00)]);
        }
        return Uint8Array.of(0x6a, 0x82);
      },
    };

    const data = await readThaiIdCard(mockTransport);
    expect(data.citizenId).toBe('1100100000018');
    expect(data.nameTh.full).toBe('นาย สมชาย ใจดี');
    expect(data.nameEn.full).toBe('Mr. Somchai Jaidee');
    expect(data.dateOfBirth.iso).toBe('1987-01-15');
    expect(data.gender).toBe('male');
    expect(data.issuer).toBe('สำนักทะเบียนกลาง');
    expect(data.issueDate.year).toBe(2017);
    expect(data.expireDate.year).toBe(2027);
    expect(data.address.houseNo).toBe('99/9');
    expect(data.address.province).toBe('กรุงเทพมหานคร');
    expect(data.photo).toBeUndefined();
  });
});
