import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, clearIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const dbId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

// 100% Network-Only configuration
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache()
}, dbId);

export const storage = getStorage(app);

// Clear any existing persistent state from IndexedDB to ensure the user does not see stale data
clearIndexedDbPersistence(db)
  .then(() => {
    console.log('[Firestore] IndexedDB offline persistence cleared successfully.');
  })
  .catch((err) => {
    console.warn('[Firestore] Error clearing IndexedDB offline persistence:', err);
  });

export const auth = getAuth(app);
export { CACHE_SIZE_UNLIMITED };

