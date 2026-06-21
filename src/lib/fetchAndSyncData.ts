import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

// Global Firestore Error Handler complying with ABAC security validation rules
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error('[DATABASE SYNC ERROR]: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface SyncedUserProfile {
  uid: string;
  name: string;
  shortName?: string;
  email: string;
  mvocId: string;
  chapter: string;
  tier: 'GOLD' | 'STANDARD';
  role: 'super_admin' | 'admin' | 'member';
  managedChapter?: string;
  photoURL?: string;
  createdAt: string;
  updatedAt: string;
  joinDate?: string;
  points?: number;
  status?: 'active' | 'suspended' | 'banned' | 'pending' | 'delete_requested' | 'deleted';
  patch_status?: boolean;
  officialPatch?: boolean;
  patch_url?: string;
  isWhatsAppPublic?: boolean;
  phoneNumber?: string;
  bloodType?: string;
  settings?: any;
  vehiclePlate?: string;
  isVerified?: boolean;
  patch?: string;
  requestDelete?: boolean;
  deleteRequestedAt?: string;
  disclaimerAccepted?: boolean;
  pdpaAccepted?: boolean;
}

export function formatMvocId(input: string): string {
  const digits = input.replace(/\D/g, '');
  const paddedDigits = digits.padStart(4, '0');
  const finalDigits = paddedDigits.slice(-4);
  return `MVOC-${finalDigits}`;
}

export function ensureMvocPrefix(id: string): string {
  return formatMvocId(id);
}

const GOOGLE_SHEET_ID = "1ZrZaf26p60i_n7ocJVp_yAw4xadNrjXodChaUWTrnmY";

/**
 * Fetches user profile/membership details from the Google Sheet and syncs it to Firestore.
 * Matches rows by the user's Gmail/Google account email.
 */
export async function fetchAndSyncData(userId: string, targetEmail: string): Promise<SyncedUserProfile | null> {
  if (!targetEmail) {
    throw new Error("Unable to sync profile details without an authorized Gmail address.");
  }

  console.log(`[ONBOARDING SYNC]: Initializing data sync for user ${userId} (${targetEmail})...`);
  
  let fetchedData: Partial<SyncedUserProfile> | null = null;
  
  const emailLower = targetEmail.trim().toLowerCase();
  const isSuperAdminEmail = emailLower === 'nikazfar@gmail.com';
  
  try {
    // We try to request the sheet values via two secure methods:
    // Method 1: Fetching Google Sheet visualizer query JSON (very robust for shared link-viewable files, works client-side)
    const sheetsVisualizerUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json`;
    const response = await fetch(sheetsVisualizerUrl);
    if (!response.ok) {
      throw new Error(`Sheets endpoint responded with status: ${response.status}`);
    }
    
    const textResult = await response.text();
    
    // Clean and parse Google's JSON wrapper: "/*O_o*/\ngoogle.visualization.Query.setResponse({...});"
    const jsonStart = textResult.indexOf('{');
    const jsonEnd = textResult.lastIndexOf('}') + 1;
    
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsedWrapper = JSON.parse(textResult.substring(jsonStart, jsonEnd));
      
      if (parsedWrapper && parsedWrapper.table) {
        const columns: string[] = parsedWrapper.table.cols.map((c: any) => 
          (c.label || '').trim().toLowerCase()
        );
        
        const rows = parsedWrapper.table.rows || [];
        
        // Find indices of critical columns dynamically to endure list headers order swaps
        const emailColIdx = columns.findIndex(lbl => lbl.includes('email'));
        const nameColIdx = columns.findIndex(lbl => lbl.includes('name'));
        const mvocIdColIdx = columns.findIndex(lbl => lbl.includes('mvoc') || lbl.includes('id'));
        const chapterColIdx = columns.findIndex(lbl => lbl.includes('chapter'));
        const tierColIdx = columns.findIndex(lbl => lbl.includes('tier') || lbl.includes('membership'));
        const plateColIdx = columns.findIndex(lbl => /plate|plat|pendaftaran/i.test(lbl));
        const phoneColIdx = columns.findIndex(lbl => lbl.includes('phone') || lbl.includes('telefon'));
        
        console.log(`[ONBOARDING SYNC]: Google Sheet detected columns: ${columns.join(', ')}`);
        
        // Find the matching row by email
        if (emailColIdx !== -1) {
          const matchingRow = rows.find((r: any) => {
            const rowEmailValue = r.c && r.c[emailColIdx] && r.c[emailColIdx].v;
            return typeof rowEmailValue === 'string' && 
                   rowEmailValue.trim().toLowerCase() === targetEmail.trim().toLowerCase();
          });
          
          if (matchingRow && matchingRow.c) {
            const nameVal = nameColIdx !== -1 ? matchingRow.c[nameColIdx]?.v : null;
            const mvocIdVal = mvocIdColIdx !== -1 ? matchingRow.c[mvocIdColIdx]?.v : null;
            const chapterVal = chapterColIdx !== -1 ? matchingRow.c[chapterColIdx]?.v : null;
            const tierRawVal = tierColIdx !== -1 ? matchingRow.c[tierColIdx]?.v : null;
            const plateVal = plateColIdx !== -1 ? matchingRow.c[plateColIdx]?.v : null;
            const phoneVal = phoneColIdx !== -1 ? matchingRow.c[phoneColIdx]?.v : null;
            
            // Normalize membership tier to allowed rule values (GOLD or STANDARD)
            let tierNormalized: 'GOLD' | 'STANDARD' = 'STANDARD';
            if (typeof tierRawVal === 'string' && tierRawVal.trim().toUpperCase() === 'GOLD') {
              tierNormalized = 'GOLD';
            }
            
            fetchedData = {
              name: typeof nameVal === 'string' ? nameVal.trim() : targetEmail.split('@')[0],
              mvocId: ensureMvocPrefix(typeof mvocIdVal === 'string' ? mvocIdVal.trim() : `MVOC-PENDING-${Math.floor(10000 + Math.random() * 90000)}`),
              chapter: typeof chapterVal === 'string' ? chapterVal.trim() : "Selangor Chapter",
              tier: tierNormalized,
              vehiclePlate: typeof plateVal === 'string' ? plateVal.trim() : undefined,
              phoneNumber: typeof phoneVal === 'string' ? phoneVal.trim() : undefined
            };
            
            console.log(`[ONBOARDING SYNC]: Successfully located and mapped spreadsheet record for: ${targetEmail}`);
          }
        }
      }
    }
  } catch (sheetError) {
    console.warn("[ONBOARDING SYNC]: Direct visualizer spreadsheet load skipped/denied. Trying fallback authentication key if present: ", sheetError);
    
    // Method 2: Optional official Sheets API with VITE_GOOGLE_SHEETS_API_KEY if declared
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_SHEETS_API_KEY;
    if (apiKey) {
      try {
        const officialSheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/A:Z?key=${apiKey}`;
        const response = await fetch(officialSheetsUrl);
        if (response.ok) {
          const data = await response.json();
          if (data && data.values && data.values.length > 0) {
            const headers: string[] = data.values[0].map((h: string) => h.trim().toLowerCase());
            const rows: string[][] = data.values.slice(1);
            
            const emailColIdx = headers.findIndex(lbl => lbl.includes('email'));
            const nameColIdx = headers.findIndex(lbl => lbl.includes('name'));
            const mvocIdColIdx = headers.findIndex(lbl => lbl.includes('mvoc') || lbl.includes('id'));
            const chapterColIdx = headers.findIndex(lbl => lbl.includes('chapter'));
            const tierColIdx = headers.findIndex(lbl => lbl.includes('tier') || lbl.includes('membership'));
            const plateColIdx = headers.findIndex(lbl => /plate|plat|pendaftaran/i.test(lbl));
            const phoneColIdx = headers.findIndex(lbl => lbl.includes('phone') || lbl.includes('telefon'));
            
            if (emailColIdx !== -1) {
              const matchingRow = rows.find(row => 
                row[emailColIdx] && row[emailColIdx].trim().toLowerCase() === targetEmail.trim().toLowerCase()
              );
              
              if (matchingRow) {
                const nameVal = nameColIdx !== -1 ? matchingRow[nameColIdx] : null;
                const mvocIdVal = mvocIdColIdx !== -1 ? matchingRow[mvocIdColIdx] : null;
                const chapterVal = chapterColIdx !== -1 ? matchingRow[chapterColIdx] : null;
                const tierRawVal = tierColIdx !== -1 ? matchingRow[tierColIdx] : null;
                const plateVal = plateColIdx !== -1 ? matchingRow[plateColIdx] : null;
                const phoneVal = phoneColIdx !== -1 ? matchingRow[phoneColIdx] : null;
                
                let tierNormalized: 'GOLD' | 'STANDARD' = 'STANDARD';
                if (tierRawVal && tierRawVal.trim().toUpperCase() === 'GOLD') {
                  tierNormalized = 'GOLD';
                }
                
                fetchedData = {
                  name: nameVal ? nameVal.trim() : targetEmail.split('@')[0],
                  mvocId: ensureMvocPrefix(mvocIdVal ? mvocIdVal.trim() : `MVOC-PENDING-${Math.floor(10000 + Math.random() * 90000)}`),
                  chapter: chapterVal ? chapterVal.trim() : "Selangor Chapter",
                  tier: tierNormalized,
                  vehiclePlate: plateVal ? plateVal.trim() : undefined,
                  phoneNumber: phoneVal ? phoneVal.trim() : undefined
                };
              }
            }
          }
        }
      } catch (officialError) {
        console.error("[ONBOARDING SYNC]: Fallback sheets key retrieval hit error: ", officialError);
      }
    }
  }

  // If the user email is not yet registered or declared in the spreadsheet,
  // we do NOT create any default profile and do NOT write to Firestore.
  if (!fetchedData && !isSuperAdminEmail) {
    console.log(`[ONBOARDING SYNC]: Gmail account ${targetEmail} not pre-listed in the Google Sheet. Aborting onboarding.`);
    return null;
  }

  // At this point, we either have fetchedData or the user is the Super Admin.
  const resolvedData = fetchedData || {
    name: "Nik Azfar Admin",
    mvocId: "MVOC-0001",
    chapter: "Selangor Chapter",
    tier: "GOLD"
  };

  // Fetch existing profile if it exists to preserve custom fields (like patch, isVerified, any manual field updates)
  let existingProfile: Partial<SyncedUserProfile> = {};
  try {
    const existingDoc = await getDoc(doc(db, 'users', userId));
    if (existingDoc.exists()) {
      existingProfile = existingDoc.data() || {};
    }
  } catch (e) {
    console.warn("[ONBOARDING SYNC]: Failed to load existing profile to merge:", e);
  }

  const finalProfile: SyncedUserProfile = {
    uid: userId,
    email: targetEmail,
    name: resolvedData.name || existingProfile.name || (isSuperAdminEmail ? 'Nik Azfar Admin' : ''),
    mvocId: formatMvocId(resolvedData.mvocId || existingProfile.mvocId || (isSuperAdminEmail ? 'MVOC-0001' : '')),
    chapter: resolvedData.chapter || existingProfile.chapter || 'Selangor Chapter',
    tier: resolvedData.tier || existingProfile.tier || (isSuperAdminEmail ? 'GOLD' : 'STANDARD'),
    role: existingProfile.role || (isSuperAdminEmail ? 'super_admin' : 'member'),
    createdAt: existingProfile.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (resolvedData.vehiclePlate !== undefined) {
    finalProfile.vehiclePlate = resolvedData.vehiclePlate;
  } else if (existingProfile.vehiclePlate !== undefined) {
    finalProfile.vehiclePlate = existingProfile.vehiclePlate;
  }

  if (resolvedData.phoneNumber !== undefined) {
    finalProfile.phoneNumber = resolvedData.phoneNumber;
  } else if (existingProfile.phoneNumber !== undefined) {
    finalProfile.phoneNumber = existingProfile.phoneNumber;
  }

  // Preserve all existing custom/offline properties (like patch, isVerified, points, joinDate, admin status etc.)
  if (existingProfile.patch !== undefined) {
    finalProfile.patch = existingProfile.patch;
  }
  if (existingProfile.isVerified !== undefined) {
    finalProfile.isVerified = existingProfile.isVerified;
  }
  if (existingProfile.status !== undefined) {
    finalProfile.status = existingProfile.status;
  }
  if (existingProfile.disclaimerAccepted !== undefined) {
    finalProfile.disclaimerAccepted = existingProfile.disclaimerAccepted;
  } else {
    finalProfile.disclaimerAccepted = false;
  }
  if (existingProfile.pdpaAccepted !== undefined) {
    finalProfile.pdpaAccepted = existingProfile.pdpaAccepted;
  } else {
    finalProfile.pdpaAccepted = false;
  }

  const hasPatch = finalProfile.patch_status === true || finalProfile.officialPatch === true || finalProfile.patch === 'mvoc_trusted_elite';
  const meetsCompliance = finalProfile.disclaimerAccepted === true && finalProfile.pdpaAccepted === true && hasPatch;

  if (existingProfile.points !== undefined) {
    finalProfile.points = meetsCompliance ? Math.max(existingProfile.points || 0, 30) : 0;
  } else {
    finalProfile.points = meetsCompliance ? 30 : 0;
  }
  if (existingProfile.joinDate !== undefined) {
    finalProfile.joinDate = existingProfile.joinDate;
  }
  if (existingProfile.shortName !== undefined) {
    finalProfile.shortName = existingProfile.shortName;
  }
  if (existingProfile.bloodType !== undefined) {
    finalProfile.bloodType = existingProfile.bloodType;
  }
  if (existingProfile.photoURL !== undefined) {
    finalProfile.photoURL = existingProfile.photoURL;
  }
  if (existingProfile.isWhatsAppPublic !== undefined) {
    finalProfile.isWhatsAppPublic = existingProfile.isWhatsAppPublic;
  }
  if (existingProfile.settings !== undefined) {
    finalProfile.settings = existingProfile.settings;
  }
  if (existingProfile.requestDelete !== undefined) {
    finalProfile.requestDelete = existingProfile.requestDelete;
  }
  if (existingProfile.deleteRequestedAt !== undefined) {
    finalProfile.deleteRequestedAt = existingProfile.deleteRequestedAt;
  }
  if (existingProfile.patch_status !== undefined) {
    finalProfile.patch_status = existingProfile.patch_status;
  }
  if (existingProfile.officialPatch !== undefined) {
    finalProfile.officialPatch = existingProfile.officialPatch;
  }
  if (existingProfile.patch_url !== undefined) {
    finalProfile.patch_url = existingProfile.patch_url;
  }
  if (existingProfile.managedChapter !== undefined) {
    finalProfile.managedChapter = existingProfile.managedChapter;
  }
  if (existingProfile.disclaimerAccepted !== undefined) {
    finalProfile.disclaimerAccepted = existingProfile.disclaimerAccepted;
  }
  if (existingProfile.pdpaAccepted !== undefined) {
    finalProfile.pdpaAccepted = existingProfile.pdpaAccepted;
  }

  // Write finalized profile records to Firestore
  const userPath = `users/${userId}`;
  try {
    await setDoc(doc(db, 'users', userId), finalProfile, { merge: true });
    console.log(`[ONBOARDING SYNC]: User profile synchronized successfully to Firestore at users/${userId}`);
    return finalProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
    return null;
  }
}

export async function forceSyncAllUsers(dbInstance: any): Promise<number> {
  const { collection, getDocs, writeBatch } = await import('firebase/firestore');
  const sheetsVisualizerUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json`;
  const response = await fetch(sheetsVisualizerUrl);
  if (!response.ok) {
    throw new Error(`Sheets endpoint responded with status: ${response.status}`);
  }
  
  const textResult = await response.text();
  const jsonStart = textResult.indexOf('{');
  const jsonEnd = textResult.lastIndexOf('}') + 1;
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Invalid spreadsheet format received");
  }

  const parsedWrapper = JSON.parse(textResult.substring(jsonStart, jsonEnd));
  if (!parsedWrapper || !parsedWrapper.table) {
    throw new Error("Missing table data in spreadsheet");
  }

  const columns: string[] = parsedWrapper.table.cols.map((c: any) => 
    (c.label || '').trim().toLowerCase()
  );
  const rows = parsedWrapper.table.rows || [];

  const emailColIdx = columns.findIndex(lbl => lbl.includes('email'));
  const nameColIdx = columns.findIndex(lbl => lbl.includes('name'));
  const mvocIdColIdx = columns.findIndex(lbl => lbl.includes('mvoc') || lbl.includes('id'));
  const chapterColIdx = columns.findIndex(lbl => lbl.includes('chapter'));
  const tierColIdx = columns.findIndex(lbl => lbl.includes('tier') || lbl.includes('membership'));
  const plateColIdx = columns.findIndex(lbl => /plate|plat|pendaftaran/i.test(lbl));
  const phoneColIdx = columns.findIndex(lbl => lbl.includes('phone') || lbl.includes('telefon'));

  if (emailColIdx === -1) {
     throw new Error("Could not detect email column in spreadsheet");
  }
  
  // Create a fast lookup map for google sheets data
  const sheetsDataMap = new Map<string, any>();
  for (const r of rows) {
     const emailVal = r.c && r.c[emailColIdx] && r.c[emailColIdx].v;
     if (typeof emailVal === 'string') {
        const lowerEmail = emailVal.trim().toLowerCase();
        
        const nameVal = nameColIdx !== -1 ? r.c[nameColIdx]?.v : null;
        const mvocIdVal = mvocIdColIdx !== -1 ? r.c[mvocIdColIdx]?.v : null;
        const chapterVal = chapterColIdx !== -1 ? r.c[chapterColIdx]?.v : null;
        const tierRawVal = tierColIdx !== -1 ? r.c[tierColIdx]?.v : null;
        const plateVal = plateColIdx !== -1 ? r.c[plateColIdx]?.v : null;
        const phoneVal = phoneColIdx !== -1 ? r.c[phoneColIdx]?.v : null;

        let tierNormalized: 'GOLD' | 'STANDARD' = 'STANDARD';
        if (typeof tierRawVal === 'string' && tierRawVal.trim().toUpperCase() === 'GOLD') {
           tierNormalized = 'GOLD';
        }

        sheetsDataMap.set(lowerEmail, {
           name: typeof nameVal === 'string' ? nameVal.trim() : undefined,
           mvocId: ensureMvocPrefix(typeof mvocIdVal === 'string' ? mvocIdVal.trim() : `MVOC-PENDING-${Math.floor(10000 + Math.random() * 90000)}`),
           chapter: typeof chapterVal === 'string' ? chapterVal.trim() : "Selangor Chapter",
           tier: tierNormalized,
           vehiclePlate: typeof plateVal === 'string' ? plateVal.trim() : undefined,
           phoneNumber: typeof phoneVal === 'string' ? phoneVal.trim() : undefined
        });
     }
  }

  const querySnapshot = await getDocs(collection(dbInstance, 'users'));
  const batch = writeBatch(dbInstance);
  let updatedCount = 0;

  querySnapshot.forEach((docSnap) => {
    const userData = docSnap.data();
    if (!userData.email) return;

    const emailKey = userData.email.trim().toLowerCase();
    
    // Ignore master admin overwrite completely
    if (emailKey === 'nikazfar@gmail.com') return;

    const matchedSheetRecord = sheetsDataMap.get(emailKey);
    if (matchedSheetRecord) {
      // Only strictly overwrite directory info, do NOT overwrite role, status, managedChapter
      const updates: any = {};
      if (matchedSheetRecord.name) updates.name = matchedSheetRecord.name;
      if (matchedSheetRecord.mvocId) updates.mvocId = formatMvocId(matchedSheetRecord.mvocId);
      if (matchedSheetRecord.chapter) updates.chapter = matchedSheetRecord.chapter;
      if (matchedSheetRecord.tier) updates.tier = matchedSheetRecord.tier;
      if (matchedSheetRecord.vehiclePlate !== undefined) updates.vehiclePlate = matchedSheetRecord.vehiclePlate;
      if (matchedSheetRecord.phoneNumber !== undefined) updates.phoneNumber = matchedSheetRecord.phoneNumber;

      updates.updatedAt = new Date().toISOString();

      batch.update(docSnap.ref, updates);
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
     await batch.commit();
  }

  return updatedCount;
}
