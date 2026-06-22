import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');

if (!existsSync(serviceAccountPath)) {
  console.error('\x1b[31m%s\x1b[0m', 'Error: serviceAccountKey.json not found in the root directory.');
  console.log('To run this force-delete script, please generate a private key for your service account');
  console.log('from the Firebase Console (Settings -> Service Accounts) and save it as "serviceAccountKey.json"');
  console.log('in the project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function forceDeleteEvent() {
  const eventId = 'lXCK1mGCLnR8Gqe07Ytq';
  try {
    const eventRef = db.collection('events').doc(eventId);
    const snap = await eventRef.get();
    
    if (!snap.exists) {
      console.log(`\x1b[33m%s\x1b[0m`, `Event with ID "${eventId}" does not exist in Firestore.`);
      return;
    }
    
    console.log(`Deleting event: "${snap.data().title}" (ID: ${eventId})...`);
    await eventRef.delete();
    console.log('\x1b[32m%s\x1b[0m', 'Force deletion completed successfully!');
  } catch (error) {
    console.error('Error force deleting event:', error);
  }
}

forceDeleteEvent();
