---
name: thai-smartcard
description: Domain knowledge, APDU command specs, and troubleshooting runbook for reading Thai National ID cards (PC/SC) in Node.js/TypeScript.
---

# Thai Smart Card (Thai National ID Card) Skill Guide

This skill provides domain knowledge, hardware specifics, APDU layouts, and debugging workflows for developing and maintaining the `thai-smartcard-ts` library.

---

## 1. Thai National ID Card (บัตรประจำตัวประชาชน)

### Applet Selection & APDU Protocol
- **AID (DF Name)**: `A0 00 00 00 54 48 00 01` (Thailand Personal Applet)
- **Select Command**: `00 A4 04 00 08 A0 00 00 00 54 48 00 01`
- **Read Binary Command**: `80 B0 P1 P2 02 00 Le`
  - `P1 P2`: 16-bit big-endian file offset
  - `Le`: length to read (up to `0xFF` / 255 bytes)

### Field Map & Offsets
| Field | Offset (Hex) | Length (Hex) | Format | Description |
|---|---|---|---|---|
| **Citizen ID** | `0x0004` | `0x0D` (13) | ASCII digits | เลขประจำตัวประชาชน 13 หลัก (มี Check Digit) |
| **Name (Thai)** | `0x0011` | `0x64` (100) | TIS-620 | `คำนำหน้า#ชื่อ#ชื่อกลาง#นามสกุล` |
| **Name (English)** | `0x0075` | `0x64` (100) | ASCII | `Prefix#First#Middle#Last` |
| **Date of Birth** | `0x00D9` | `0x08` (8) | B.E. `YYYYMMDD` | วันเกิด พ.ศ. (ลบ 543 เพื่อแปลงเป็น ค.ศ.) |
| **Gender** | `0x00E1` | `0x01` (1) | ASCII `1` or `2` | `1` = ชาย (Male), `2` = หญิง (Female) |
| **Card Issuer** | `0x00F6` | `0x64` (100) | TIS-620 | สถานที่ออกบัตร / สำนักทะเบียน |
| **Issue Date** | `0x0167` | `0x08` (8) | B.E. `YYYYMMDD` | วันออกบัตร |
| **Expire Date** | `0x016F` | `0x08` (8) | B.E. `YYYYMMDD` | วันหมดอายุ (`99999999` สำหรับตลอดชีพ) |
| **Address** | `0x1579` | `0x64` (100) | TIS-620 | `บ้านเลขที่#หมู่ที่#ตรอก#ซอย#ถนน#ตำบล#อำเภอ#จังหวัด` |
| **Photo (JPEG)** | `0x017B` | 20 × 255 B | Binary JPEG | รูปถ่ายขนาด 5,100 ไบต์ ตัดด้วย `FF D9` (EOI) |

### APDU T=0 Protocol Notes
- Status `61 xx`: Indicates `xx` bytes are ready. Issue `00 C0 00 P2 xx` (GET RESPONSE).
  - Standard cards: `P2 = 00`
  - Cards with ATR starting `3B 67`: Expect `P2 = 01`
- Status `6C xx`: Re-issue the exact same command with `Le = xx`.

---

## 2. Hardware Reference

Works with ISO/IEC 7816 PC/SC contact smart card readers:
- **Zoweetek ZW-12026-3** (Smart Card slot)
- **ACS ACR39U / ACR38U**
- **HID Omnikey 3121 / 3021**
- Generic CCID EMV Smartcard Readers

---

## 3. Troubleshooting Checklist
- **Linux (`pcsc-lite`)**: Ensure `pcscd` daemon is running (`sudo systemctl status pcscd`) and `libpcsclite-dev` is installed.
- **Windows**: The `winscard` API is native and built into `pcsc-mini` without extra drivers or compilation.
- **Card Read Error (`6A 82` File Not Found)**: Ensure `SELECT_THAI_ID_APPLET` is sent before sending `READ BINARY`.
- **Photo Read Slowdown**: Reading the full JPEG requires 20 APDU roundtrips. Pass `photo: false` if only text details are needed.
