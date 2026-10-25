import { promises as fs } from 'node:fs';
import { ThaiIdCardMonitor } from '../src/pcsc/index.js';

async function main() {
  console.log('⚡ Starting Thai National ID Card Reader...');
  console.log('👉 Insert a card into your smart card reader (e.g. Zoweetek ZW-12026-3)...\n');

  const monitor = new ThaiIdCardMonitor({
    photo: true, // Set to true to read JPEG photo
    autoRead: true,
  });

  monitor.on('reader', (readerName) => {
    console.log(`🔌 Card reader detected: ${readerName}`);
  });

  monitor.on('reader-removed', (readerName) => {
    console.log(`❌ Card reader removed: ${readerName}`);
  });

  monitor.on('card-inserted', ({ reader }) => {
    console.log(`💳 Card inserted in [${reader}], reading personal data...`);
  });

  monitor.on('card-removed', ({ reader }) => {
    console.log(`👋 Card removed from [${reader}]\n`);
  });

  monitor.on('data', async ({ data }) => {
    console.log('\n================ THAI ID CARD DATA ================');
    console.log(`เลขประจำตัวประชาชน (Citizen ID): ${data.citizenId}`);
    console.log(`ชื่อ-นามสกุล (Thai): ${data.nameTh.full}`);
    console.log(`Name (English):     ${data.nameEn.full}`);
    console.log(
      `วันเกิด (Date of Birth):  ${data.dateOfBirth.iso} (B.E. ${data.dateOfBirth.raw.slice(0, 4)})`,
    );
    console.log(`เพศ (Gender):          ${data.gender}`);
    console.log(`สถานที่ออกบัตร (Issuer):  ${data.issuer}`);
    console.log(`วันออกบัตร (Issue Date): ${data.issueDate.iso}`);
    console.log(
      `วันหมดอายุ (Expire Date): ${data.expireDate.lifetime ? 'ตลอดชีพ (Lifetime)' : data.expireDate.iso}`,
    );
    console.log(`ที่อยู่ (Address):       ${data.address.full}`);

    if (data.photo) {
      await fs.writeFile('photo.jpg', data.photo);
      console.log('📸 Photo saved to photo.jpg');
    }
    console.log('===================================================\n');
  });

  monitor.on('error', ({ reader, error }) => {
    console.error(`⚠️ Error [${reader ?? 'system'}]:`, error.message);
  });

  await monitor.start();

  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping reader monitor...');
    monitor.stop();
    process.exit(0);
  });
}

main().catch(console.error);
