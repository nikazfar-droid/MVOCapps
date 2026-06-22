import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

const configPath = join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function run() {
  const usersSnap = await getDocs(collection(db, 'users'));
  const chaptersMap = {};
  usersSnap.forEach(d => {
    const data = d.data();
    const ch = data.chapter || 'None';
    chaptersMap[ch] = (chaptersMap[ch] || 0) + 1;
  });
  console.log("Chapters distribution in users collection:");
  console.log(JSON.stringify(chaptersMap, null, 2));
}

run().catch(console.error);
