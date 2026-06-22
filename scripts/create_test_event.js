import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const configPath = join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// =============================================
// Koordinat lokasi anda sekarang
// dari Google Maps: https://maps.app.goo.gl/T6fZyqUTFo3yBgbg7
// =============================================
const LAT = 2.9563433985136855;
const LON = 101.53324153779846;

async function createTestEvent() {
  const eventData = {
    title: '🧪 Test Kehadiran MVOC - Lokasi Nik Azfar',
    date: '22 Jun 2026',
    location: 'Lokasi Semasa (Test Geofencing)',
    rsvps: 0,
    limit: 50,
    featured: true,
    registered: false,
    organizer: 'Admin HQ',
    badge: 'TEST',
    image: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600&auto=format&fit=crop&q=80',
    category: 'ongoing',
    warningText: '',
    creatorId: 'admin-script',
    latitude: LAT,
    longitude: LON,
    gmapsLink: 'https://maps.app.goo.gl/T6fZyqUTFo3yBgbg7',
    isTestEvent: true,
  };

  try {
    const docRef = await addDoc(collection(db, 'events'), eventData);
    console.log('\n✅ EVENT UJIAN BERJAYA DICIPTA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Event ID  : ${docRef.id}`);
    console.log(`📌 Nama      : ${eventData.title}`);
    console.log(`📍 Lokasi    : ${eventData.location}`);
    console.log(`🌐 Latitude  : ${LAT}`);
    console.log(`🌐 Longitude : ${LON}`);
    console.log(`🗺️  GMaps     : ${eventData.gmapsLink}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📱 AKSES DARI PHONE (pastikan WiFi sama):');
    console.log('   http://192.168.0.104:3000/');
    console.log('\n⚡ LANGKAH UJIAN:');
    console.log('   1. Buka http://192.168.0.104:3000/ di phone (WiFi sama)');
    console.log('   2. Log masuk sebagai AHLI BIASA (bukan admin)');
    console.log('   3. Admin: Buka "Imbas Kad QR Ahli" di Admin Dashboard');
    console.log('   4. Admin: Pilih event "🧪 Test Kehadiran MVOC - Lokasi Nik Azfar"');
    console.log('   5. Admin: Aktifkan "Pintas Geofencing" untuk ujian ini');
    console.log('   6. Admin: Scan QR Digital Card dari phone ahli');
    console.log('   7. Sepatutnya kehadiran +30 XP berjaya direkodkan!\n');
  } catch (err) {
    console.error('❌ Gagal cipta event:', err.message || err);
  }

  process.exit(0);
}

createTestEvent();
