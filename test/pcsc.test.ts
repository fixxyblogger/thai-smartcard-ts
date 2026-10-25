import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { THAI_ID_FIELDS } from '../src/id-card/commands.js';
import {
  type CardDataEvent,
  type CardInsertedEvent,
  ThaiIdCardMonitor,
  withPcscCard,
} from '../src/pcsc/index.js';
import { concatBytes } from '../src/utils/bytes.js';
import { encodeTis620 } from '../src/utils/tis620.js';

describe('ThaiIdCardMonitor & withPcscCard (PC/SC)', () => {
  function createMockPcsc() {
    const CardMode = { SHARED: 2, EXCLUSIVE: 1, DIRECT: 3 };
    const CardDisposition = { LEAVE: 0, RESET: 1, UNPOWER: 2 };
    const ReaderStatus = { PRESENT: 32, EMPTY: 16, MUTE: 512, UNAVAILABLE: 8 };

    class MockReader extends EventEmitter {
      readonly #name: string;
      constructor(name: string) {
        super();
        this.#name = name;
      }
      name() {
        return this.#name;
      }
      connect = vi.fn().mockImplementation(async () => {
        return {
          state: vi.fn().mockResolvedValue({
            atr: Uint8Array.of(0x3b, 0x68, 0x00),
          }),
          transaction: vi.fn().mockResolvedValue({
            end: vi.fn().mockResolvedValue(undefined),
          }),
          disconnect: vi.fn().mockResolvedValue(undefined),
          transmit: vi.fn().mockImplementation(async (cmd: Uint8Array) => {
            // SELECT
            if (cmd[0] === 0x00 && cmd[1] === 0xa4) {
              return Uint8Array.of(0x90, 0x00);
            }
            // READ BINARY
            if (cmd[0] === 0x80 && cmd[1] === 0xb0) {
              const offset = ((cmd[2] as number) << 8) | (cmd[3] as number);
              if (offset === THAI_ID_FIELDS.citizenId.offset) {
                return concatBytes([encodeTis620('1100100000018'), Uint8Array.of(0x90, 0x00)]);
              }
              if (offset === THAI_ID_FIELDS.nameTh.offset) {
                return concatBytes([encodeTis620('นาย#สมชาย##ใจดี'), Uint8Array.of(0x90, 0x00)]);
              }
              return concatBytes([encodeTis620('ทดสอบ'), Uint8Array.of(0x90, 0x00)]);
            }
            return Uint8Array.of(0x90, 0x00);
          }),
        };
      });
    }

    class MockClient extends EventEmitter {
      #running = false;
      running() {
        return this.#running;
      }
      start() {
        this.#running = true;
        return this;
      }
      stop() {
        this.#running = false;
      }
    }

    return {
      CardMode,
      CardDisposition,
      ReaderStatus,
      Reader: MockReader,
      Client: MockClient,
    };
  }

  it('runs monitor lifecycle: connects, detects reader, filters, and reads card on insertion', async () => {
    const mockPcsc = createMockPcsc();
    const mockReader1 = new mockPcsc.Reader('Zoweetek ZW-12026-3 00 00');
    const mockReader2 = new mockPcsc.Reader('Generic Other Reader 00');

    let clientInstance:
      | (EventEmitter & { running: () => boolean; start: () => unknown; stop: () => unknown })
      | undefined;

    class TestableClient extends EventEmitter {
      running = vi.fn().mockReturnValue(true);
      start = vi.fn().mockReturnValue(this);
      stop = vi.fn();
      constructor() {
        super();
        clientInstance = this;
      }
    }
    mockPcsc.Client = TestableClient as unknown as typeof mockPcsc.Client;

    const monitor = new ThaiIdCardMonitor({
      pcsc: mockPcsc as unknown as Parameters<typeof withPcscCard>[0],
      readerFilter: /Zoweetek/i,
      autoRead: true,
    });

    const readerEvents: string[] = [];
    const insertedEvents: CardInsertedEvent[] = [];
    const dataEvents: CardDataEvent[] = [];

    monitor.on('reader', (name) => readerEvents.push(name));
    monitor.on('card-inserted', (evt) => insertedEvents.push(evt));
    monitor.on('data', (evt) => dataEvents.push(evt));

    await monitor.start();
    expect(monitor.running).toBe(true);

    // Client emits readers
    clientInstance?.emit('reader', mockReader1);
    clientInstance?.emit('reader', mockReader2); // Should be filtered out

    expect(readerEvents).toEqual(['Zoweetek ZW-12026-3 00 00']);
    expect(monitor.readers).toEqual(['Zoweetek ZW-12026-3 00 00']);

    // Simulate card insertion on reader 1
    const mockStatusFlags = {
      has: (flag: number) => flag === mockPcsc.ReaderStatus.PRESENT,
      hasAny: () => false,
    };
    mockReader1.emit('change', mockStatusFlags, Uint8Array.of(0x3b, 0x68));

    expect(insertedEvents).toHaveLength(1);
    expect(insertedEvents[0]?.reader).toBe('Zoweetek ZW-12026-3 00 00');

    // Wait for autoRead to finish
    await new Promise((r) => setTimeout(r, 20));

    expect(dataEvents).toHaveLength(1);
    expect(dataEvents[0]?.data.citizenId).toBe('1100100000018');
    expect(dataEvents[0]?.data.nameTh.firstName).toBe('สมชาย');

    // Stop monitor
    monitor.stop();
    expect(clientInstance?.stop).toHaveBeenCalled();
  });

  it('withPcscCard establishes transaction and disposes properly', async () => {
    const mockPcsc = createMockPcsc();
    const mockReader = new mockPcsc.Reader('Test Reader');

    const result = await withPcscCard(
      mockPcsc as unknown as Parameters<typeof withPcscCard>[0],
      mockReader as unknown as Parameters<typeof withPcscCard>[1],
      async (transport) => {
        expect(transport.atr).toEqual(Uint8Array.of(0x3b, 0x68, 0x00));
        const res = await transport.transmit(Uint8Array.of(0x00, 0xa4));
        return res;
      },
    );

    expect(result).toEqual(Uint8Array.of(0x90, 0x00));
  });
});
