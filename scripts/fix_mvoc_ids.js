import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// 1. Read Firebase config
const configPath = join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));

// 2. Initialize Firebase Client
const app = initializeApp(firebaseConfig);
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// 3. formatMvocId utility
function formatMvocId(input) {
  if (!input) input = '';
  const digits = input.replace(/\D/g, '');
  const paddedDigits = digits.padStart(4, '0');
  const finalDigits = paddedDigits.slice(-4);
  return `MVOC-${finalDigits}`;
}

async function runMigration() {
  console.log("Starting bulk MVOC ID formatting check...");
  
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);
    let updateCount = 0;
    
    console.log(`Found ${querySnapshot.size} total user profiles.`);
    
    querySnapshot.forEach((document) => {
      const userData = document.data();
      const currentId = userData.mvocId || '';
      
      const correctId = formatMvocId(currentId);
      
      // Check if format is incorrect
      if (currentId !== correctId) {
        console.log(`Mismatch found for User ${userData.email || document.id}: Current value "${currentId}" -> Correct format "${correctId}"`);
        const userRef = doc(db, 'users', document.id);
        batch.update(userRef, { mvocId: correctId });
        updateCount++;
      }
    });
    
    if (updateCount > 0) {
      console.log(`Committing batch write for ${updateCount} records...`);
      await batch.commit();
      console.log(`Migration successful! Successfully updated ${updateCount} profiles to 'MVOC-xxxx' format.`);
    } else {
      console.log("All profiles are already correctly formatted. No migration needed.");
    }
  } catch (error) {
    console.error("Migration encountered a fatal error:", error);
  }
}

runMigration();
