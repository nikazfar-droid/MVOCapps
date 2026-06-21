import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const configPath = join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function run() {
  const docId = 'UnDgCsLYzcq15mqj0zQj';
  const docRef = doc(db, 'announcements', docId);

  const newSubject = 'OFFICIAL MVOC MOBILE APP COMING SOON!';
  const newMessage = `Dear MVOC members,

Our community is taking a digital leap! The management is thrilled to announce that the MVOC Mobile Application will be launched soon to unify and simplify matters for all members.

🌟 Key App Features:

Digital Member Card: No more lost physical cards, everything is on your phone.

Instant Notifications: Convoy info, events, and official announcements straight to your screen.

Easy Registration: RSVPing for events and convoys is now more systematic.

Exclusive Promos: Enjoy special discounts at selected workshops & merchant partners.

📅 Launch:
The app will be available on the Google Play Store & App Store. Download links and registration guides will be shared in the near future. Make sure your phone is ready!

Thank you for your continuous support.

"MVOC at Your Fingertips"
— MVOC Management`;

  console.log(`Updating announcement ${docId} in Firestore...`);
  await updateDoc(docRef, {
    subject: newSubject,
    message: newMessage
  });
  console.log('Update successful!');
}

run().catch(console.error);
