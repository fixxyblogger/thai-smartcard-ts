# thai-smartcard-ts 🇹🇭💳

[![npm version](https://img.shields.io/npm/v/thai-smartcard-ts.svg?style=flat-square&color=007acc)](https://www.npmjs.com/package/thai-smartcard-ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Dual ESM/CJS](https://img.shields.io/badge/module-ESM%20%2B%20CJS-brightgreen?style=flat-square)](https://github.com/fixxyblogger/thai-smartcard-ts)

Modern, lightweight, cross-platform TypeScript SDK for reading **Thai National ID Cards** (บัตรประจำตัวประชาชน) via PC/SC APDU and extracting cardholder JPEG photo in Node.js, Bun, and browser environments.

---

## ✨ Features

- 🇹🇭 **Complete Thai National ID Card Data Extraction**
  - Reads 13-digit Citizen ID (เลขบัตรประชาชน), Thai & English names (with titles), Date of Birth, Gender, Full Registered Address (บ้านเลขที่, ตำบล, อำเภอ, จังหวัด), Card Issuer, Issue/Expiry Dates.
  - Automatic Buddhist Era (พ.ศ.) ↔ Common Era (ค.ศ.) date conversions, supporting lifetime cards (`99999999`).
  - Native **TIS-620 decoding** without external dependencies (`iconv-lite` or ICU).
  - High-resolution **JPEG photo extraction** from the card's 20 consecutive flash chunks, with End-Of-Image (`FF D9`) trimming.
  - Built-in `photoToDataUrl()` helper for direct display in web UI (`<img src="...">`).
- 🔌 **Prebuilt Native PC/SC Support (No node-gyp!)**
  - Integrated with [`pcsc-mini`](https://github.com/kofi-q/pcsc-mini) containing pre-compiled native bindings for Windows (`winscard`), macOS (`CryptoTokenKit`), and Linux (`pcsc-lite`).
  - No C++ compilers, Visual Studio Build Tools, or Python required during installation.
  - `pcsc-mini` is an **optional peer dependency**: the core parsing and APDU logic remains 100% dependency-free and runtime-agnostic.
- 📦 **Modern Architecture**
  - Dual **ESM + CommonJS** output with TypeScript declarations (`.d.mts` / `.d.cts`).
  - Validated by [`publint`](https://github.com/bluwy/publint) and [`arethetypeswrong`](https://github.com/arethetypeswrong/arethetypeswrong.github.io).

---

## 🛠️ Hardware Compatibility

Works with standard ISO/IEC 7816 PC/SC contact smart card readers:
- **Zoweetek ZW-12026-3**
- **ACS ACR39U / ACR38U**
- **HID Omnikey 3121 / 3021**
- Any CCID-compliant USB smart card reader recognized by Windows (`winscard`) or macOS/Linux (`pcsc-lite`).

---

## 📦 Installation

```bash
# Core package (parsing, codecs, APDU definitions - zero runtime dependencies):
npm install thai-smartcard-ts

# To use hardware PC/SC smart card readers in Node.js, install the optional peer dependency:
npm install pcsc-mini
```

---

## 🚀 Quick Start

### 1. Reading Thai National ID Card with Event-Driven Monitor

Plug in your smart card reader and run:

```ts
import { ThaiIdCardMonitor } from 'thai-smartcard-ts/pcsc';
import { photoToDataUrl } from 'thai-smartcard-ts';

const monitor = new ThaiIdCardMonitor({
  photo: true, // Read JPEG photo (takes ~1-2s for 20 APDUs)
  autoRead: true, // Automatically read on card insertion
  readerFilter: /Generic|Zoweetek|ACS|Omnikey/i, // Optional reader filter
});

monitor.on('reader', (name) => console.log(`Reader ready: ${name}`));

monitor.on('card-inserted', ({ reader }) => {
  console.log(`Card detected in [${reader}], reading...`);
});

monitor.on('data', ({ data }) => {
  console.log('Citizen ID:', data.citizenId);
  console.log('Thai Name: ', data.nameTh.full);
  console.log('Eng Name:  ', data.nameEn.full);
  console.log('Birth Date:', data.dateOfBirth.iso); // e.g. "1992-10-10"
  console.log('Gender:    ', data.gender); // "male" | "female"
  console.log('Address:   ', data.address.full);
  console.log('Issuer:    ', data.issuer);

  if (data.photo) {
    const dataUrl = photoToDataUrl(data.photo);
    console.log('Photo URL: ', dataUrl.slice(0, 50) + '...');
  }
});

monitor.on('error', ({ reader, error }) => {
  console.error(`Error on reader ${reader}:`, error);
});

await monitor.start();
```

---

### 2. Reading with Custom / Existing Card Transports

If you use a different PC/SC library, WebUSB, or a mock transport in tests:

```ts
import { readThaiIdCard, type CardTransport } from 'thai-smartcard-ts';

const myTransport: CardTransport = {
  atr: myCard.atr,
  transmit: async (commandApdu: Uint8Array) => {
    return await myCard.send(commandApdu); // returns data + SW1 SW2
  },
};

const idCard = await readThaiIdCard(myTransport, { photo: false });
console.log(idCard.citizenId, idCard.nameTh.full);
```

---

## 🗂️ Data Model

### Thai National ID (`ThaiIdCardData`)
```ts
interface ThaiIdCardData {
  citizenId: string; // 13-digit string e.g. "1329900399108"
  nameTh: {
    prefix: string; // "น.ส."
    firstName: string; // "เสาวภาคย์"
    middleName: string; // ""
    lastName: string; // "สติมั่น"
    full: string; // "น.ส. เสาวภาคย์ สติมั่น"
  };
  nameEn: {
    prefix: string; // "Miss"
    firstName: string; // "Saowapark"
    middleName: string; // ""
    lastName: string; // "Satiman"
    full: string; // "Miss Saowapark Satiman"
  };
  dateOfBirth: ThaiDate; // { raw: "25351010", year: 1992, month: 10, day: 10, iso: "1992-10-10" }
  gender: 'male' | 'female' | 'unknown';
  issuer: string; // "ท้องถิ่นเขตคลองเตย/กรุงเทพมหานคร"
  issueDate: ThaiDate;
  expireDate: ThaiDate; // lifetime: boolean for non-expiring cards
  address: {
    houseNo: string;
    villageNo: string;
    lane: string;
    alley: string;
    road: string;
    subdistrict: string;
    district: string;
    province: string;
    full: string;
  };
  photo?: Uint8Array; // Raw JPEG bytes
}
```

---

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with v8 code coverage
npm run test:coverage

# Run live hardware reader demo
npm run example:id

# Full CI check (lint, typecheck, test, build, publint, attw)
npm run ci
```

---

## 🤝 Contributing

Contributions are welcome! Please ensure:
1. All tests pass (`npm run ci`).
2. New features or fixes include corresponding unit tests under `test/`.
3. Add a changeset describing the change: `npx changeset`.

---

## 📄 License

[MIT](LICENSE) © 2026 [fixxyblogger](https://github.com/fixxyblogger)