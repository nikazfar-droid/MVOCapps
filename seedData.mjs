import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, setDoc, addDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "mvoc-app-b0efe",
  "appId": "1:1012491491831:web:507abf0f2f8ed8f4a036f2",
  "apiKey": "AIzaSyBQeaeOyA4BR953sRX6zebEiIa7xqo5T5I",
  "authDomain": "mvoc-app-b0efe.firebaseapp.com",
  "firestoreDatabaseId": "ai-studio-6f37dacc-d502-4e9f-b2aa-df88715268b1",
  "storageBucket": "mvoc-app-b0efe.firebasestorage.app",
  "messagingSenderId": "1012491491831",
  "measurementId": ""
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  console.log("Fetching users...");
  const usersSnap = await getDocs(collection(db, 'users'));
  const admins = [];
  usersSnap.forEach(d => {
    const data = d.data();
    if (data.role === 'admin' || data.role === 'super_admin') {
      admins.push({ id: d.id, ...data });
    }
  });

  console.log(`Found ${admins.length} admins.`);

  console.log("Deleting old events...");
  const eventsSnap = await getDocs(collection(db, 'events'));
  for (const docSnap of eventsSnap.docs) {
    await deleteDoc(docSnap.ref);
    // Delete corresponding QR Code config
    await deleteDoc(doc(db, 'qrCodes', docSnap.id));
  }

  console.log("Deleting old convoys...");
  const convoysSnap = await getDocs(collection(db, 'convoys'));
  for (const docSnap of convoysSnap.docs) {
    await deleteDoc(docSnap.ref);
    await deleteDoc(doc(db, 'qrCodes', docSnap.id));
  }

  console.log("Seeding new data...");
  for (const admin of admins) {
    const adminId = admin.id;
    const adminName = admin.name || "Unknown Admin";
    let chapter = "Selangor";
    if (admin.managedChapter) {
       chapter = Array.isArray(admin.managedChapter) ? admin.managedChapter[0] : admin.managedChapter;
    }

    // 1. Upcoming Event (June 24, 2026)
    const upcomingDate = new Date("2026-06-24T10:00:00Z");
    const upcomingExp = new Date("2026-06-25T10:00:00Z");
    const uRef = await addDoc(collection(db, 'events'), {
      title: `Upcoming Event by ${adminName}`,
      date: upcomingDate.toLocaleDateString(),
      location: `${chapter} HQ`,
      chapter: chapter,
      createdBy: adminId,
      status: 'active',
      createdAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'qrCodes', uRef.id), {
      status: 'active',
      expiresAt: Timestamp.fromDate(upcomingExp)
    });

    // 2. Ongoing Event (June 22, 2026)
    const ongoingDate = new Date("2026-06-22T10:00:00Z");
    const ongoingExp = new Date("2026-06-23T10:00:00Z");
    const oRef = await addDoc(collection(db, 'events'), {
      title: `Ongoing Event by ${adminName}`,
      date: ongoingDate.toLocaleDateString(),
      location: `${chapter} City Center`,
      chapter: chapter,
      createdBy: adminId,
      status: 'active',
      createdAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'qrCodes', oRef.id), {
      status: 'active',
      expiresAt: Timestamp.fromDate(ongoingExp)
    });

    // 3. Complete Event (June 19, 2026)
    const completeDate = new Date("2026-06-19T10:00:00Z");
    const completeExp = new Date("2026-06-20T10:00:00Z");
    const cRef = await addDoc(collection(db, 'events'), {
      title: `Complete Event by ${adminName}`,
      date: completeDate.toLocaleDateString(),
      location: `${chapter} Old Town`,
      chapter: chapter,
      createdBy: adminId,
      status: 'active', 
      createdAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'qrCodes', cRef.id), {
      status: 'active',
      expiresAt: Timestamp.fromDate(completeExp)
    });

    // 4. Convoy (June 20-25)
    const convoyDate = new Date("2026-06-23T08:00:00Z");
    const convoyExp = new Date("2026-06-24T08:00:00Z");
    const cvRef = await addDoc(collection(db, 'convoys'), {
      title: `Convoy Track by ${adminName}`,
      name: `Convoy Track by ${adminName}`,
      date: convoyDate.toLocaleDateString(),
      chapter: chapter,
      createdBy: adminId,
      leadAdmin: adminName,
      status: 'OPEN',
      createdAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'qrCodes', cvRef.id), {
      status: 'active',
      expiresAt: Timestamp.fromDate(convoyExp)
    });
  }

  console.log("Seeding complete!");
  process.exit(0);
}

run().catch(console.error);
