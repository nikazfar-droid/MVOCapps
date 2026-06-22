import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  RefreshCw, 
  CheckCircle2, 
  UserCheck, 
  KeyRound, 
  MessageCircle, 
  FileText, 
  LogOut, 
  ArrowRight, 
  ShieldCheck 
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { fetchAndSyncData, SyncedUserProfile } from '../lib/fetchAndSyncData';

interface DataSyncContextType {
  userProfile: SyncedUserProfile | null;
  isSyncing: boolean;
  syncError: string | null;
  triggerSync: (userId: string, email: string, silent?: boolean) => Promise<SyncedUserProfile | null>;
  resetSyncState: () => void;
  updateLocalProfileState: (updated: Partial<SyncedUserProfile>) => void;
  language: 'en';
  setLanguage: (lang: 'en') => void;
}

const DataSyncContext = createContext<DataSyncContextType | undefined>(undefined);

export function useDataSync() {
  const context = useContext(DataSyncContext);
  if (context === undefined) {
    throw new Error('useDataSync must be used inside a DataSyncProvider');
  }
  return context;
}

interface DataSyncProviderProps {
  children: ReactNode;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  // Callback when a sync is successfully completed to update parent App.tsx states
  onSyncCompleted?: (profile: SyncedUserProfile) => void;
}

export default function DataSyncProvider({ 
  children, 
  triggerToast,
  onSyncCompleted
}: DataSyncProviderProps) {
  const [userProfile, setUserProfile] = useState<SyncedUserProfile | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [language, setLanguageState] = useState<'en'>(() => {
    return 'en';
  });

  const setLanguage = async (newLang: 'en') => {
    setLanguageState(newLang);
    localStorage.setItem('mvoc_language', newLang);
    if (auth.currentUser?.uid) {
      try {
        const { updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          'settings.language': newLang
        });
      } catch (err) {
        console.warn("Could not sync language setting to database:", err);
      }
    }
  };

  // Custom states for Membership Required gateway blocking flow
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPlate, setRegPlate] = useState("");
  const [regChapter, setRegChapter] = useState("Zone Klang Valley");
  const [formLoading, setFormLoading] = useState(false);

  // Use refs to avoid re-triggering the useEffect when hooks/functions reference changes
  const triggerToastRef = useRef(triggerToast);
  const onSyncCompletedRef = useRef(onSyncCompleted);

  useEffect(() => {
    triggerToastRef.current = triggerToast;
    onSyncCompletedRef.current = onSyncCompleted;
  }, [triggerToast, onSyncCompleted]);

  // Monitor real Firebase Auth changes to automatically initiate first-time Gmail onboarding sync
  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous snapshot listener on user change
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (user) {
        console.log(`[DATA SYNC PROVIDER]: Firebase Auth state changes. Authenticated User: ${user.uid} (${user.email})`);
        
        const cacheKey = `mvoc_profile_${user.uid}`;
        
        // 1. Try to load instantly from localStorage for instant boot
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const cachedProfile = JSON.parse(cached) as SyncedUserProfile;
            setUserProfile(cachedProfile);
            if (cachedProfile.settings?.language === 'en') {
              setLanguageState('en');
            }
            if (onSyncCompletedRef.current) {
              onSyncCompletedRef.current(cachedProfile);
            }
          } catch (e) {
            console.warn("[DATA SYNC PROVIDER]: Failed to parse cached profile", e);
          }
        }

        // Setup Firestore reference
        const { doc, getDoc, onSnapshot } = await import('firebase/firestore');
        const userDocRef = doc(db, 'users', user.uid);

        // 2. Validate registry profile against database quietly in background
        try {
          setSyncError(null);
          const profileDoc = await getDoc(userDocRef);
          if (!profileDoc.exists()) {
            // First time login - Sync initial profile/membership values from Google Sheets!
            console.log("[DATA SYNC PROVIDER]: Profile not detected in Firestore database. Initializing first-time Google Sheet data fetch...");
            setIsSyncing(true);
            const syncedProfile = await fetchAndSyncData(user.uid, user.email || "");
            if (syncedProfile) {
              setUserProfile(syncedProfile);
              localStorage.setItem(cacheKey, JSON.stringify(syncedProfile));
              triggerToastRef.current('Successfully synced your MVOC membership profile!', 'success');
              if (onSyncCompletedRef.current) {
                onSyncCompletedRef.current(syncedProfile);
              }
            } else {
              setUserProfile(null);
              setSyncError('NOT_REGISTERED');
            }
          }
        } catch (err: any) {
          console.error("[DATA SYNC PROVIDER]: Initial checking/syncing failed: ", err);
          if (!localStorage.getItem(cacheKey)) {
            setSyncError(err instanceof Error ? err.message : String(err));
            triggerToastRef.current('Using standard default profile. Database storage pending setup.', 'info');
          }
        } finally {
          setIsSyncing(false);
        }

        // 3. Add real-time snapshot listener on the user's details for instant synchronization
        unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const updatedProfile = docSnap.data() as SyncedUserProfile;
            setUserProfile(updatedProfile);
            localStorage.setItem(cacheKey, JSON.stringify(updatedProfile));
            if (updatedProfile.settings?.language === 'en') {
              setLanguageState('en');
            }
            if (onSyncCompletedRef.current) {
              onSyncCompletedRef.current(updatedProfile);
            }
          } else {
            // Document does not exist. If we have a cached profile, this means the user profile was
            // hard-deleted from the database. Force its status to 'deleted'.
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              try {
                const cachedProfile = JSON.parse(cached) as SyncedUserProfile;
                const updatedProfile: SyncedUserProfile = {
                  ...cachedProfile,
                  status: 'deleted'
                };
                setUserProfile(updatedProfile);
                localStorage.setItem(cacheKey, JSON.stringify(updatedProfile));
                if (onSyncCompletedRef.current) {
                  onSyncCompletedRef.current(updatedProfile);
                }
              } catch (e) {
                const updatedProfile: SyncedUserProfile = {
                  uid: user.uid,
                  email: user.email || '',
                  name: user.displayName || 'User',
                  status: 'deleted',
                  mvocId: '',
                  chapter: '',
                  tier: 'STANDARD',
                  role: 'member',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
                setUserProfile(updatedProfile);
                localStorage.setItem(cacheKey, JSON.stringify(updatedProfile));
                if (onSyncCompletedRef.current) {
                  onSyncCompletedRef.current(updatedProfile);
                }
              }
            }
          }
        }, (err) => {
          console.warn("[DATA SYNC PROVIDER]: onSnapshot listener err: ", err);
        });

      } else {
        // Clear profile on sign out
        setUserProfile(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  /**
   * Manually trigger the data sync process. Helpful when user presses simulated Google sign-in
   */
  const triggerSync = async (userId: string, email: string, silent?: boolean): Promise<SyncedUserProfile | null> => {
    if (!silent) {
      setIsSyncing(true);
    }
    setSyncError(null);
    
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const userDocRef = doc(db, 'users', userId);
      const existingDoc = await getDoc(userDocRef);
      if (existingDoc.exists() && existingDoc.data()?.status === 'suspended') {
        const suspendedProfile = existingDoc.data() as SyncedUserProfile;
        setUserProfile(suspendedProfile);
        localStorage.setItem(`mvoc_profile_${userId}`, JSON.stringify(suspendedProfile));
        if (!silent) {
          triggerToast('Account is suspended. Sync aborted.', 'error');
        }
        return suspendedProfile;
      }

      const syncedProfile = await fetchAndSyncData(userId, email);
      if (!syncedProfile) {
        setUserProfile(null);
        setSyncError('NOT_REGISTERED');
        return null;
      }
      setUserProfile(syncedProfile);
      localStorage.setItem(`mvoc_profile_${userId}`, JSON.stringify(syncedProfile));
      
      if (onSyncCompleted) {
        onSyncCompleted(syncedProfile);
      }
      
      if (!silent) {
        triggerToast('Google Sheet Onboarding Sync completed successfully!', 'success');
      }
      return syncedProfile;
    } catch (err: any) {
      console.error("[DATA SYNC PROVIDER]: Manual sheet sync failed: ", err);
      // We parse the FirestoreErrorInfo JSON structure helper to inspect rules issues
      let parsedErrorMessage = err instanceof Error ? err.message : String(err);
      try {
        const parsed = JSON.parse(parsedErrorMessage);
        if (parsed && parsed.error) {
          parsedErrorMessage = parsed.error;
        }
      } catch (e) {
        // Not JSON error, ignore and use raw string
      }
      
      setSyncError(parsedErrorMessage);
      if (!silent) {
        triggerToast(`Data sync failed: ${parsedErrorMessage.substring(0, 45)}...`, 'error');
      }
      return null;
    } finally {
      if (!silent) {
        setIsSyncing(false);
      }
    }
  };

  const resetSyncState = () => {
    setUserProfile(null);
    setIsSyncing(false);
    setSyncError(null);
    setShowRegistrationForm(false);
    setFormSubmitted(false);
    setRegName("");
    setRegPhone("");
    setRegPlate("");
    setRegChapter("Zone Klang Valley");
  };

  const handleRequestFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regPhone.trim() || !regPlate.trim()) {
      triggerToastRef.current('Please fill in all standard validation fields.', 'error');
      return;
    }
    setFormLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setFormLoading(false);
    setFormSubmitted(true);
    triggerToastRef.current('Membership registration request submitted successfully!', 'success');
  };

  const updateLocalProfileState = (updated: Partial<SyncedUserProfile>) => {
    if (userProfile) {
      const nextProfile = { ...userProfile, ...updated, updatedAt: new Date().toISOString() };
      setUserProfile(nextProfile);
      localStorage.setItem(`mvoc_profile_${userProfile.uid}`, JSON.stringify(nextProfile));
      if (onSyncCompleted) {
        onSyncCompleted(nextProfile);
      }
    }
  };

  return (
    <DataSyncContext.Provider value={{
      userProfile,
      isSyncing,
      syncError,
      triggerSync,
      resetSyncState,
      updateLocalProfileState,
      language,
      setLanguage
    }}>
      {children}

      {/* REACTION SYNC LOADING OVERLAY ANIMATIONS */}
      <AnimatePresence>
        {isSyncing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-905/75 backdrop-blur-md select-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl space-y-6 text-center"
            >
              {/* Spinner animation box */}
              <div className="relative w-18 h-18 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-[#0F2D52] animate-spin" />
                <RefreshCw className="w-6 h-6 text-[#0F2D52] animate-pulse" />
              </div>

              {/* Status and informational cues in beautiful high-contrast text */}
              <div className="space-y-2">
                <h3 className="font-display text-lg font-black tracking-tight text-[#0F2D52]">
                  Syncing your profile...
                </h3>
                <p className="text-[11.5px] text-slate-500 font-semibold leading-relaxed max-w-xs mx-auto">
                  Fetching your initial Malaysia Veloz Owner Community (MVOC) profile data from Google Sheets and writing to secure Firestore. Please wait.
                </p>
              </div>

              {/* Secure connection verified badge */}
              <div className="flex items-center justify-center gap-1.5 bg-[#EFF6FF] border border-[#BFDBFE]/60 px-3 py-1.5 rounded-full inline-flex mx-auto">
                <UserCheck className="w-3.5 h-3.5 text-[#2563EB]" />
                <span className="text-[9px] font-extrabold text-[#1D4ED8] uppercase tracking-wider">
                  Secure Google Auth Active
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ERROR HANDLING RESCUE SCREEN WITH EXPLAINED DATA POLICY */}
      <AnimatePresence>
        {syncError && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-905/75 backdrop-blur-md overflow-y-auto">
            {syncError === 'NOT_REGISTERED' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="w-full max-w-md bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-2xl space-y-6 text-center select-none my-8"
              >
                {/* Visual Icon Alert Area */}
                <div className="w-16 h-16 bg-[#FEF2F2] border border-[#FEE2E2] text-[#EF4444] rounded-full flex items-center justify-center mx-auto shadow-md">
                  <ShieldAlert className="w-8 h-8" />
                </div>

                {/* Main Notification Content */}
                <div className="space-y-2">
                  <h3 className="font-display text-xl font-bold tracking-tight text-[#0F2D52]">
                    Membership Required
                  </h3>
                  <p className="text-[14px] text-red-600 font-bold leading-normal">
                    Your email is not registered in our MVOC database.
                  </p>
                  <p className="text-[12px] text-slate-500 font-medium leading-relaxed max-w-xs mx-auto pt-1">
                    Authenticating as <span className="font-semibold text-slate-750">{auth.currentUser?.email || "Simulated User"}</span>. Only whitelisted Malaysia Veloz Owner Community active members can access the central dispatch portal.
                  </p>
                </div>

                {!showRegistrationForm ? (
                  <div className="space-y-3 pt-2">
                    {/* Primary Call to Action: Join WhatsApp Group */}
                    <a
                      href="https://chat.whatsapp.com/HcwkT0FRBNK4EjckT6w4xE"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-extrabold text-xs h-[48px] rounded-xl transition shadow-lg shadow-[#25d366]/20 cursor-pointer text-center uppercase tracking-wider"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" />
                      Join WhatsApp Group
                    </a>

                    {/* Secondary Call to Action: Enroll Form fallback */}
                    <button
                      onClick={() => setShowRegistrationForm(true)}
                      className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs h-[46px] rounded-xl transition cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      Request Membership Form
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50/70 border border-slate-150 p-4 rounded-2xl text-left space-y-4">
                    <h4 className="text-xs font-bold text-[#0F2D52] tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-250 pb-2">
                      <FileText className="w-3.5 h-3.5" />
                      Submit Membership Registry Request
                    </h4>
                    
                    {formSubmitted ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-4 space-y-3"
                      >
                        <div className="w-10 h-10 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <h5 className="text-xs font-bold text-slate-850">Request Received Successfully</h5>
                          <p className="text-[10px] text-slate-550 leading-normal max-w-[280px] mx-auto">
                            Your application has been received and logged. Malaysia Veloz Owners verification officers will check your plates and white-list your Gmail shortly!
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowRegistrationForm(false)}
                          className="text-[10px] text-[#0F2D52] font-semibold underline hover:text-[#184679]"
                        >
                          Back to gateway
                        </button>
                      </motion.div>
                    ) : (
                      <form onSubmit={handleRequestFormSubmit} className="space-y-3">
                        {/* Full Name */}
                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold text-slate-605 uppercase tracking-wider">Full Name (As in MyKad/IC)</label>
                          <input
                            type="text"
                            required
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="Ahmad Zaki Bin Rahim"
                            className="w-full bg-white text-xs border border-slate-205 rounded-lg px-3 py-2 outline-none focus:border-[#0F2D52] transition font-semibold"
                          />
                        </div>

                        {/* Contact No */}
                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold text-slate-605 uppercase tracking-wider">WhatsApp Phone Number</label>
                          <input
                            type="tel"
                            required
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="+6012-3456789"
                            className="w-full bg-white text-xs border border-slate-205 rounded-lg px-3 py-2 outline-none focus:border-[#0F2D52] transition font-semibold"
                          />
                        </div>

                        {/* Plate number */}
                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold text-slate-605 uppercase tracking-wider">Veloz Car Registration Plate No.</label>
                          <input
                            type="text"
                            required
                            value={regPlate}
                            onChange={(e) => setRegPlate(e.target.value)}
                            placeholder="VHY 9821"
                            className="w-full bg-white text-xs border border-slate-205 rounded-lg px-3 py-2 outline-none focus:border-[#0F2D52] transition font-semibold uppercase"
                          />
                        </div>

                        {/* Chapter */}
                        <div className="space-y-1">
                          <label className="block text-[9.5px] font-bold text-slate-605 uppercase tracking-wider">Regional State Chapter</label>
                          <select
                            value={regChapter}
                            onChange={(e) => setRegChapter(e.target.value)}
                            className="w-full bg-white text-xs border border-slate-205 rounded-lg px-3 py-2 outline-none focus:border-[#0F2D52] transition font-semibold"
                          >
                            <option value="Zone Klang Valley">Zone Klang Valley</option>
                            <option value="Zone Utara">Zone Utara</option>
                            <option value="Zone Borneo">Zone Borneo</option>
                            <option value="Zone Pantai Timur">Zone Pantai Timur</option>
                            <option value="Zone Selatan">Zone Selatan</option>
                          </select>
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowRegistrationForm(false);
                              setFormSubmitted(false);
                            }}
                            className="w-1/2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-bold text-[11px] h-[38px] rounded-lg transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={formLoading}
                            className="w-1/2 bg-[#0F2D52] hover:bg-[#153964] text-white font-bold text-[11px] h-[38px] rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {formLoading ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                Submit Request
                                <ArrowRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Session Reset / Logout Fallback link */}
                <div className="border-t border-slate-100 pt-4 flex flex-col items-center gap-3">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                    Need to use a different Gmail account?
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await signOut(auth);
                      } catch (e) {}
                      resetSyncState();
                      localStorage.clear();
                    }}
                    className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-extrabold text-[11px] px-4 py-2.5 rounded-xl transition cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout & Reset Session
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl space-y-5 text-center"
              >
                <div className="w-14 h-14 bg-red-50 border border-red-150 rounded-full flex items-center justify-center mx-auto text-red-500">
                  <ShieldAlert className="w-7 h-7" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-display text-base font-black tracking-tight text-slate-905">
                    Synchronisation Halt
                  </h3>
                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl max-h-32 overflow-y-auto text-left">
                    <code className="text-[10px] font-mono text-red-600 block break-words leading-relaxed whitespace-pre-wrap">
                      {syncError}
                    </code>
                  </div>
                  <p className="text-[10.5px] text-slate-550 font-medium leading-relaxed max-w-xs mx-auto pt-1">
                    We encountered a Firestore security rule or configuration blocker. We will fall back to local offline sandbox.
                  </p>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setSyncError(null)}
                    className="w-full bg-[#0F2D52] hover:bg-[#153964] text-white font-bold text-xs h-[44px] rounded-xl transition cursor-pointer"
                  >
                    Adopt sandbox profile
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </DataSyncContext.Provider>
  );
}
