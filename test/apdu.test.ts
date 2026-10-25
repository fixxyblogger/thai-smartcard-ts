import { describe, expect, it, vi } from 'vitest';
import { ApduError, type CardTransport, parseApduResponse, transceive } from '../src/apdu.js';

describe('APDU & transceive', () => {
  it('parses successful APDU responses', () => {
    const raw = Uint8Array.of(0x01, 0x02, 0x90, 0x00);
    const parsed = parseApduResponse(raw);
    expect(parsed.data).toEqual(Uint8Array.of(0x01, 0x02));
    expect(parsed.sw1).toBe(0x90);
    expect(parsed.sw2).toBe(0x00);
    expect(parsed.sw).toBe(0x9000);
  });

  it('throws on responses less than 2 bytes', () => {
    expect(() => parseApduResponse(Uint8Array.of(0x90))).toThrow(RangeError);
  });

  it('handles immediate 90 00 response in transceive', async () => {
    const transport: CardTransport = {
      transmit: vi.fn().mockResolvedValue(Uint8Array.of(0xca, 0xfe, 0x90, 0x00)),
    };
    const cmd = Uint8Array.of(0x00, 0x01);
    const res = await transceive(transport, cmd);
    expect(res).toEqual(Uint8Array.of(0xca, 0xfe));
    expect(transport.transmit).toHaveBeenCalledTimes(1);
  });

  it('handles 61 xx (GET RESPONSE chaining)', async () => {
    const transport: CardTransport = {
      transmit: vi
        .fn()
        // 1st: initial cmd returns 61 02 (2 bytes available)
        .mockResolvedValueOnce(Uint8Array.of(0x61, 0x02))
        // 2nd: GET RESPONSE 02 returns data and 90 00
        .mockResolvedValueOnce(Uint8Array.of(0xaa, 0xbb, 0x90, 0x00)),
    };
    const cmd = Uint8Array.of(0x80, 0xb0, 0x00, 0x04, 0x02, 0x00, 0x0d);
    const res = await transceive(transport, cmd);
    expect(res).toEqual(Uint8Array.of(0xaa, 0xbb));
    expect(transport.transmit).toHaveBeenCalledTimes(2);
  });

  it('handles 6C xx (wrong length Le retry)', async () => {
    const transport: CardTransport = {
      transmit: vi
        .fn()
        .mockResolvedValueOnce(Uint8Array.of(0x6c, 0x04))
        .mockResolvedValueOnce(Uint8Array.of(0x11, 0x22, 0x33, 0x44, 0x90, 0x00)),
    };
    const cmd = Uint8Array.of(0x00, 0xc0, 0x00, 0x00, 0x10);
    const res = await transceive(transport, cmd);
    expect(res).toEqual(Uint8Array.of(0x11, 0x22, 0x33, 0x44));
    expect(transport.transmit).toHaveBeenCalledTimes(2);
  });

  it('throws ApduError when card status is not 9000', async () => {
    const transport: CardTransport = {
      transmit: vi.fn().mockResolvedValue(Uint8Array.of(0x6a, 0x82)),
    };
    const cmd = Uint8Array.of(0x00, 0xa4);
    await expect(transceive(transport, cmd)).rejects.toThrow(ApduError);
  });

  it('guards against excessive GET RESPONSE chaining loop', async () => {
    const transport: CardTransport = {
      transmit: vi.fn().mockResolvedValue(Uint8Array.of(0x61, 0x05)),
    };
    await expect(transceive(transport, Uint8Array.of(0x00), { maxChain: 3 })).rejects.toThrow(
      'Too many chained GET RESPONSE calls',
    );
  });
});
