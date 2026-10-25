/**
 * PC/SC integration built on [`pcsc-mini`](https://github.com/kofi-q/pcsc-mini)
 * (prebuilt native bindings for Windows, macOS and Linux — no node-gyp).
 *
 * `pcsc-mini` is an **optional peer dependency**; install it alongside this
 * package to use this entry point:
 *
 * ```sh
 * npm install thai-smartcard-ts pcsc-mini
 * ```
 *
 * @module
 */

import { EventEmitter } from 'node:events';
import type * as Pcsc from 'pcsc-mini';
import type { CardTransport } from '../apdu.js';
import {
  type ReadThaiIdCardOptions,
  readThaiIdCard,
  type ThaiIdCardData,
} from '../id-card/read.js';

type PcscModule = typeof Pcsc;

/** Payload of the `card-inserted` event. */
export interface CardInsertedEvent {
  reader: string;
  atr: Uint8Array;
}

/** Payload of the `data` event. */
export interface CardDataEvent {
  reader: string;
  atr: Uint8Array;
  data: ThaiIdCardData;
}

/** Payload of the `error` event. */
export interface MonitorErrorEvent {
  /** Reader name, when the error relates to a specific reader. */
  reader?: string;
  error: Error;
}

/** Events emitted by {@link ThaiIdCardMonitor}. */
export interface ThaiIdCardMonitorEvents {
  /** A reader was detected. */
  reader: [name: string];
  /** A reader was unplugged. */
  'reader-removed': [name: string];
  /** A card was inserted (before reading starts). */
  'card-inserted': [event: CardInsertedEvent];
  /** A card was removed. */
  'card-removed': [event: { reader: string }];
  /** Card data was read successfully. */
  data: [event: CardDataEvent];
  /** Something went wrong. The monitor keeps running. */
  error: [event: MonitorErrorEvent];
}

/** Options for {@link ThaiIdCardMonitor}. */
export interface ThaiIdCardMonitorOptions
  extends Omit<ReadThaiIdCardOptions, 'signal' | 'onPhotoProgress'> {
  /**
   * Only watch readers whose name matches. Useful with combo devices that
   * expose several PC/SC slots (e.g. `/ZW-12026/i`).
   */
  readerFilter?: RegExp | ((name: string) => boolean);
  /** Automatically read cards on insertion and emit `data`. Default `true`. */
  autoRead?: boolean;
  /** Inject a `pcsc-mini` module instance (mainly for tests). */
  pcsc?: PcscModule;
}

const errorOf = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

async function loadPcsc(): Promise<PcscModule> {
  try {
    const mod = (await import('pcsc-mini')) as PcscModule & { default?: PcscModule };
    return mod.default ?? mod;
  } catch (cause) {
    throw new Error(
      'thai-smartcard-ts/pcsc requires the optional peer dependency "pcsc-mini". Install it with: npm install pcsc-mini',
      { cause },
    );
  }
}

/**
 * Connect to the card in `reader` and expose it as a {@link CardTransport}
 * inside an exclusive PC/SC transaction. The connection is released when
 * `fn` settles.
 */
export async function withPcscCard<T>(
  pcsc: PcscModule,
  reader: Pcsc.Reader,
  fn: (transport: CardTransport) => Promise<T>,
): Promise<T> {
  const card = await reader.connect(pcsc.CardMode.SHARED);
  try {
    const { atr } = await card.state();
    const txn = await card.transaction();
    try {
      return await fn({ atr, transmit: (command) => card.transmit(command) });
    } finally {
      await txn.end(pcsc.CardDisposition.LEAVE).catch(() => {});
    }
  } finally {
    await card.disconnect(pcsc.CardDisposition.LEAVE).catch(() => {});
  }
}

/**
 * Watches PC/SC readers and reads Thai National ID cards on insertion.
 *
 * @example
 * ```ts
 * import { ThaiIdCardMonitor } from 'thai-smartcard-ts/pcsc';
 *
 * const monitor = new ThaiIdCardMonitor({ photo: true });
 * monitor.on('data', ({ data }) => console.log(data.citizenId, data.nameTh.full));
 * monitor.on('error', ({ error }) => console.error(error));
 * await monitor.start();
 * ```
 */
export class ThaiIdCardMonitor extends EventEmitter<ThaiIdCardMonitorEvents> {
  readonly #options: ThaiIdCardMonitorOptions;
  #pcsc: PcscModule | undefined;
  #client: Pcsc.Client | undefined;
  readonly #readers = new Map<string, Pcsc.Reader>();
  readonly #present = new Set<string>();

  constructor(options: ThaiIdCardMonitorOptions = {}) {
    super();
    this.#options = options;
  }

  /** Names of currently attached (and filtered) readers. */
  get readers(): string[] {
    return [...this.#readers.keys()];
  }

  /** `true` while monitoring. */
  get running(): boolean {
    return this.#client?.running() ?? false;
  }

  /** Start monitoring readers. Resolves once the PC/SC client is running. */
  async start(): Promise<this> {
    if (this.running) return this;
    const pcsc = this.#options.pcsc ?? (await loadPcsc());
    this.#pcsc = pcsc;
    const client = new pcsc.Client();
    client.on('reader', (reader) => this.#onReader(reader));
    client.on('error', (error) => this.emit('error', { error: errorOf(error) }));
    this.#client = client;
    client.start();
    return this;
  }

  /** Stop monitoring and release the PC/SC context. */
  stop(): void {
    this.#client?.stop();
    this.#client = undefined;
    this.#readers.clear();
    this.#present.clear();
  }

  /** Manually read the card currently inserted in `readerName`. */
  async read(readerName: string, options: ReadThaiIdCardOptions = {}): Promise<ThaiIdCardData> {
    const reader = this.#readers.get(readerName);
    if (!reader || !this.#pcsc) throw new Error(`Reader not available: ${readerName}`);
    return withPcscCard(this.#pcsc, reader, (transport) =>
      readThaiIdCard(transport, { photo: this.#options.photo, ...options }),
    );
  }

  #accepts(name: string): boolean {
    const filter = this.#options.readerFilter;
    if (!filter) return true;
    return typeof filter === 'function' ? filter(name) : filter.test(name);
  }

  #onReader(reader: Pcsc.Reader): void {
    const name = reader.name();
    if (!this.#accepts(name)) return;
    const pcsc = this.#pcsc as PcscModule;

    this.#readers.set(name, reader);
    this.emit('reader', name);

    reader.on('change', (status, atr) => {
      const present = status.has(pcsc.ReaderStatus.PRESENT) && !status.has(pcsc.ReaderStatus.MUTE);
      const wasPresent = this.#present.has(name);

      if (present && !wasPresent) {
        this.#present.add(name);
        this.emit('card-inserted', { reader: name, atr });
        if (this.#options.autoRead ?? true) void this.#autoRead(name, atr);
      } else if (
        !present &&
        wasPresent &&
        status.hasAny(pcsc.ReaderStatus.EMPTY, pcsc.ReaderStatus.UNAVAILABLE)
      ) {
        this.#present.delete(name);
        this.emit('card-removed', { reader: name });
      }
    });

    reader.on('disconnect', () => {
      this.#readers.delete(name);
      this.#present.delete(name);
      this.emit('reader-removed', name);
    });
  }

  async #autoRead(name: string, atr: Uint8Array): Promise<void> {
    try {
      const data = await this.read(name);
      this.emit('data', { reader: name, atr, data });
    } catch (e) {
      this.emit('error', { reader: name, error: errorOf(e) });
    }
  }
}
