/**
 * Script: create_test_event.js
 * Cipta event ujian di lokasi semasa untuk test QR Scanner
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const path = require('path');

// Load service account
let serviceAccount;
try {
  serviceAccount = require('../serviceAccountKey.json');
} catch (e) {
  console.error('❌ serviceAccountKey.json tidak dijumpai. Sila letakkan di root projek.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function createTestEvent() {
  // Koordinat lokasi anda sekarang (dari Google Maps link)
  const LAT = 2.9563433985136855;
  const LON = 101.53324153779846;

  const eventData = {
    title: '🧪 Event Ujian Geofencing MVOC',
    date: '22 Jun 2026 - 12:42 AM',
    location: 'Lokasi Semasa Nik Azfar (Test)',
    rsvps: 0,
    limit: 50,
    featured: true,
    registered: false,
    organizer: 'Admin Test',
    badge: 'TEST',
    image: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600&auto=format&fit=crop&q=80',
    category: 'ongoing',
    warningText: '',
    creatorId: 'admin-test',
    latitude: LAT,
    longitude: LON,
    gmapsLink: 'https://maps.app.goo.gl/T6fZyqUTFo3yBgbg7',
    createdAt: Timestamp.now(),
    isTestEvent: true
  };

  try {
    const docRef = await db.collection('events').add(eventData);
    console.log('\n✅ EVENT UJIAN BERJAYA DICIPTA!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Event ID  : ${docRef.id}`);
    console.log(`📌 Nama      : ${eventData.title}`);
    console.log(`📍 Lokasi    : ${eventData.location}`);
    console.log(`🌐 Latitude  : ${LAT}`);
    console.log(`🌐 Longitude : ${LON}`);
    console.log(`🗺️  GMaps     : ${eventData.gmapsLink}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📱 AKSES DARI PHONE (sambungkan WiFi yang sama):');
    console.log('   http://192.168.0.104:3000/');
    console.log('\n⚡ LANGKAH UJIAN:');
    console.log('   1. Buka http://192.168.0.104:3000/ di phone');
    console.log('   2. Log masuk sebagai ahli biasa');
    console.log('   3. Minta admin buka "Imbas Kad QR Ahli" di dashboard');
    console.log('   4. Pilih event: "🧪 Event Ujian Geofencing MVOC"');
    console.log('   5. Admin scan QR Card ahli dari phone ahli\n');
  } catch (err) {
    console.error('❌ Gagal cipta event:', err.message);
  }

  process.exit(0);
}

createTestEvent();
