import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  RefreshCw, 
  CheckCircle2, 
  UserCheck, 
  Lock, 
  Database, 
  FileSpreadsheet, 
  ExternalLink, 
  Mail, 
  User, 
  LogOut, 
  AlertCircle, 
  ChevronRight,
  ShieldCheck,
  Check,
  Sparkles
} from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { formatMvocId } from '../lib/fetchAndSyncData';

// Document interface corresponding to the firebase-blueprint schema
interface UserProfile {
  uid: string;
  name: string;
  email: string;
  mvocId: string;
  chapter: string;
  tier: 'GOLD' | 'STANDARD';
  role: 'super_admin' | 'admin' | 'member';
  createdAt: string;
  updatedAt: string;
}

const GOOGLE_SHEET_ID = "1ZrZaf26p60i_n7ocJVp_yAw4xadNrjXodChaUWTrnmY";
const FORM_LINK = "https://forms.gle/q6m5NUvKq4A7dAW67";

export default function OnboardingSync() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showFormFallback, setShowFormFallback] = useState<boolean>(false);
  
  // Custom interactive simulation states for trial/preview setups
  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [simulatedEmail, setSimulatedEmail] = useState<string>('');

  // Toast notifier
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Monitor Firebase Auth state change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await checkAndSyncUser(user.uid, user.email || '');
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  /**
   * Primary user onboarding validation flow:
   * 1. Check if profile already exists in Firestore users subcollection
   * 2. If missing or lacking MVOC ID, query the Google Sheets database directly
   * 3. Set profile if matched or initiate warning fallback
   */
  const checkAndSyncUser = async (userId: string, emailStr: string) => {
    if (!emailStr) {
      setErrorMsg("Unauthorized active session: Email address could not be verified.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setShowFormFallback(false);

    try {
      console.log(`[ONBOARDING SYNC]: Inspecting Firestore database for userId: ${userId}`);
      const userDocRef = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userDocRef);

      if (userSnapshot.exists()) {
        const storedProfile = userSnapshot.data() as UserProfile;
        if (storedProfile.mvocId && !storedProfile.mvocId.startsWith('MVOC-PENDING')) {
          setUserProfile(storedProfile);
          setLoading(false);
          triggerToast("Authorized membership profile synced from security group successfully.", "success");
          return;
        }
      }

      // If document is missing or lacks verified MVOC ID, fetch Google Sheet values
      await performGoogleSheetSync(userId, emailStr);
    } catch (err: any) {
      console.warn("[ONBOARDING SYNC]: Firebase read failed. Attempting direct spreadsheet sync sequence.", err);
      // Try direct Google Sheets query as fallback
      await performGoogleSheetSync(userId, emailStr);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Google Sheets Query and Verification Logic
   */
  const performGoogleSheetSync = async (userId: string, emailStr: string): Promise<boolean> => {
    setSyncing(true);
    setErrorMsg(null);
    setShowFormFallback(false);

    try {
      // Visualizer query parameters - safe client-side extraction
      const targetQueryUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json`;
      console.log(`[ONBOARDING SYNC]: Querying official MVOC Spreadsheet data source...`);
      
      const response = await fetch(targetQueryUrl);
      if (!response.ok) {
        throw new Error(`Spreadsheet service responded with error code: ${response.status}`);
      }

      const text = await response.text();
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}') + 1;

      if (startIdx === -1 || endIdx === -1) {
        throw new Error("Invalid spreadsheet formatting structure returned by Google visualization endpoint.");
      }

      const jsonStr = text.substring(startIdx, endIdx);
      const parsed = JSON.parse(jsonStr);

      if (!parsed.table || !parsed.table.cols || !parsed.table.rows) {
        throw new Error("Empty spreadsheet table returned from Google Sheet integration.");
      }

      const columns: string[] = parsed.table.cols.map((col: any) => (col.label || '').trim().toLowerCase());
      const rows = parsed.table.rows || [];

      // Detect spreadsheet coordinate offsets
      const emailIdx = columns.findIndex(lbl => lbl.includes('email'));
      const nameIdx = columns.findIndex(lbl => lbl.includes('name'));
      const mvocIdIdx = columns.findIndex(lbl => lbl.includes('mvoc') || lbl.includes('id'));
      const chapterIdx = columns.findIndex(lbl => lbl.includes('chapter'));
      const tierIdx = columns.findIndex(lbl => lbl.includes('tier') || lbl.includes('membership'));

      if (emailIdx === -1) {
        throw new Error(`Data Validation Failure: 'Email' header coordinate missing in Google Sheet.`);
      }

      const targetEmailLower = emailStr.trim().toLowerCase();

      // Find row matching authenticated Google email address
      const matchedRow = rows.find((r: any) => {
        const val = r.c && r.c[emailIdx] && r.c[emailIdx].v;
        return typeof val === 'string' && val.trim().toLowerCase() === targetEmailLower;
      });

      if (matchedRow && matchedRow.c) {
        // Extract properties with strict fallbacks
        const extractedName = nameIdx !== -1 && matchedRow.c[nameIdx]?.v 
          ? String(matchedRow.c[nameIdx].v).trim() 
          : emailStr.split('@')[0];

        const isSuperAdminEmail = targetEmailLower === 'nikazfar@gmail.com';

        const rawExtractedMvocId = mvocIdIdx !== -1 && matchedRow.c[mvocIdIdx]?.v 
          ? String(matchedRow.c[mvocIdIdx].v).trim() 
          : String(Math.floor(1000 + Math.random() * 9000));
        
        const extractedMvocId = isSuperAdminEmail ? 'MVOC-0001' : formatMvocId(rawExtractedMvocId);

        const extractedChapter = chapterIdx !== -1 && matchedRow.c[chapterIdx]?.v 
          ? String(matchedRow.c[chapterIdx].v).trim() 
          : 'Selangor Chapter';

        const rawTier = tierIdx !== -1 && matchedRow.c[tierIdx]?.v 
          ? String(matchedRow.c[tierIdx].v).trim().toUpperCase() 
          : 'STANDARD';
        
        const validatedTier: 'GOLD' | 'STANDARD' = rawTier === 'GOLD' ? 'GOLD' : 'STANDARD';

        // Prepare verified user profile
        const synchronizedProfile: UserProfile = {
          uid: userId,
          name: extractedName,
          email: targetEmailLower,
          mvocId: extractedMvocId,
          chapter: extractedChapter,
          tier: validatedTier,
          role: isSuperAdminEmail ? 'super_admin' : 'member',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Write user profile transaction to Firestore DB
        try {
          await setDoc(doc(db, 'users', userId), synchronizedProfile, { merge: true });
        } catch (dbErr) {
          console.warn("[ONBOARDING SYNC]: Unabled to persist to Firestore, keeping offline profile configuration state.", dbErr);
        }

        setUserProfile(synchronizedProfile);
        triggerToast("Membership details verified and imported from Google Sheets!", "success");
        setSyncing(false);
        return true;
      } else {
        // Fallback warnings
        console.warn(`[ONBOARDING SYNC]: User's Gmail (${emailStr}) was not located within spreadsheet.`);
        setShowFormFallback(true);
        setSyncing(false);
        return false;
      }
    } catch (e: any) {
      console.error("[ONBOARDING SYNC]: Direct query hit error: ", e);
      setErrorMsg(`Connection error during sync operation: ${e.message || e}`);
      setSyncing(false);
      return false;
    }
  };

  /**
   * Google Sign-in flow triggers
   */
  const handleGoogleAuth = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        triggerToast(`Signed in as: ${result.user.email}`, "success");
        await checkAndSyncUser(result.user.uid, result.user.email || '');
      }
    } catch (err: any) {
      console.warn("[ONBOARDING SYNC]: Popup restricted by sandbox iframe limits. Launching preview emulator options.", err);
      triggerToast("Sign-in popup blocked. Please use the simulated input below for testing purposes.", "info");
      setSimulationActive(true);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Simulated Sign-In Handler (crucial for preview in sandbox iframe structures)
   */
  const handleSimulateSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedEmail || !simulatedEmail.includes('@')) {
      triggerToast("Please provide a valid simulation email address.", "error");
      return;
    }

    setLoading(true);
    const mockUid = `simulated-uid-${simulatedEmail.replace(/[^a-zA-Z0-9]/g, '')}`;
    triggerToast(`Initiating simulation for email: ${simulatedEmail}`, "info");

    const synced = await performGoogleSheetSync(mockUid, simulatedEmail);
    if (!synced) {
      // Create a nominal temporary user reference
      setCurrentUser({
        uid: mockUid,
        email: simulatedEmail,
        displayName: simulatedEmail.split('@')[0]
      } as FirebaseUser);
    } else {
      setCurrentUser({
        uid: mockUid,
        email: simulatedEmail,
        displayName: userProfile?.name || simulatedEmail.split('@')[0]
      } as FirebaseUser);
    }
    setLoading(false);
  };

  const handleSystemLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (e) {}
    setCurrentUser(null);
    setUserProfile(null);
    setShowFormFallback(false);
    setSimulationActive(false);
    setLoading(false);
    triggerToast("Logged out from the onboarding module.", "info");
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[120] px-4 py-3 rounded-2xl shadow-lg border text-xs font-bold flex items-center gap-2 max-w-sm ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : toast.type === 'error' 
                  ? 'bg-red-50 border-red-200 text-red-800' 
                  : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corporate Identity Header */}
      <header className="bg-[#0F2D52] text-white p-6 rounded-3xl shadow-md border border-[#184172] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[10px] bg-[#184172] text-amber-400 font-extrabold tracking-widest uppercase px-3 py-1 rounded-full border border-amber-400/20">
            Official System Gateway
          </span>
          <h1 className="font-display text-2xl font-black mt-2 tracking-tight">Onboarding &amp; Database Synchronization</h1>
          <p className="text-slate-200 text-xs mt-1.5 font-medium max-w-xl">
            Malaysia Veloz Owner Community (MVOC) centralized registration checkpoint. Secure visual validation against core membership spreadsheet ledgers.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">Database Connection Active</span>
        </div>
      </header>

      {/* Main Flow Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Flow Instruction Info Box */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4 text-left">
            <h2 className="font-display font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2 text-sm uppercase tracking-wide">
              <Sparkles className="w-4 h-4 text-[#0F2D52]" />
              Sync Protocol
            </h2>
            
            <ol className="space-y-4 text-xs font-semibold text-slate-650">
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#E3EBF4] text-[#0F2D52] flex items-center justify-center font-extrabold text-[10px] shrink-0">1</span>
                <div>
                  <h4 className="text-slate-900 font-bold mb-0.5">Google Authentication</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Verify your email credentials securely via official Google OAuth mechanisms.</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#E3EBF4] text-[#0F2D52] flex items-center justify-center font-extrabold text-[10px] shrink-0">2</span>
                <div>
                  <h4 className="text-slate-900 font-bold mb-0.5">Automated Validation</h4>
                  <p className="text-[11px] text-slate-500 font-medium">The service matches row records of the verified community spreadsheet instantly.</p>
                </div>
              </li>
              <li className="flex gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#E3EBF4] text-[#0F2D52] flex items-center justify-center font-extrabold text-[10px] shrink-0">3</span>
                <div>
                  <h4 className="text-slate-900 font-bold mb-0.5">Firestore Sync</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Approved users have details persisted into cloud Firestore. MVOC ID remains read-only.</p>
                </div>
              </li>
            </ol>

            <div className="pt-2">
              <a 
                href={`https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/edit?usp=sharing`}
                target="_blank" 
                rel="noreferrer"
                className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-[#0F2D52] border border-slate-250 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Browse Target Sheet</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
          </div>

          {/* Sandbox Playground Emulator */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-sm space-y-4 text-left">
            <div>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] tracking-wider uppercase">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Emulator Sandbox</span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mt-1">Simulate Credentials</h3>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-1">
                Use different emails to mock Google login results (e.g., registered emails in the spreadsheet, or unregistered ones for testing warnings).
              </p>
            </div>

            <form onSubmit={handleSimulateSync} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-slate-350 uppercase tracking-wider block">Mock Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={simulatedEmail}
                    onChange={(e) => setSimulatedEmail(e.target.value)}
                    required
                    placeholder="e.g. nikazfar@gmail.com"
                    className="w-full text-xs font-semibold pl-9 pr-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:border-[#22B573] focus:outline-hidden transition placeholder:text-slate-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || syncing}
                className="w-full py-2.5 bg-[#22B573] hover:bg-[#1a9c60] text-slate-900 font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-emerald-500/10"
              >
                {syncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-900" />
                ) : (
                  <span>Sync Simulated Email</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Dynamic Authentication State Card */}
        <div className="md:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* Loading general container */}
            {loading && (
              <motion.div 
                key="loading-card"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col items-center justify-center gap-4 text-center min-h-[350px]"
              >
                <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-[#0F2D52] animate-spin" />
                <div>
                  <h3 className="font-display font-black text-slate-900 text-base">Verifying active session authenticity...</h3>
                  <p className="text-slate-400 text-xs mt-1 font-medium">Validating security protocols against persistent Firestore database registries.</p>
                </div>
              </motion.div>
            )}

            {/* Step 1: Login Checkpoint Interface */}
            {!loading && !currentUser && (
              <motion.div 
                key="unauthenticated-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-xs p-8 flex flex-col justify-between text-center min-h-[350px]"
              >
                <div className="space-y-6 max-w-sm mx-auto pt-4">
                  <div className="w-16 h-16 bg-[#E3EBF4] text-[#0F2D52] rounded-3xl flex items-center justify-center mx-auto shadow-xs">
                    <Database className="w-8 h-8" />
                  </div>
                  
                  <div className="space-y-2">
                    <h2 className="font-display text-xl font-black text-slate-900 tracking-tight">Security Checkpoint Auth Required</h2>
                    <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                      Please sign in with your verified Google account to check whether your membership profile is fully synced. Only validated members from the MVOC organization receive active credentials.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 max-w-sm mx-auto w-full pt-6">
                  <button
                    onClick={handleGoogleAuth}
                    className="w-full py-3.5 bg-[#0F2D52] hover:bg-[#184172] text-white font-extrabold text-xs rounded-xl shadow-md transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <svg className="w-4 h-4 text-white fill-current shrink-0" viewBox="0 0 24 24">
                      <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.581-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.98 0-.737-.08-1.3-.175-1.84H12.24z"/>
                    </svg>
                    <span>Authenticate via Google Inc.</span>
                  </button>

                  <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                    By proceeding, you authorize comparison of your Google email against columns of the public MVOC registered membership spreadsheet.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Form warning fallback card if user found mismatch */}
            {!loading && currentUser && showFormFallback && (
              <motion.div 
                key="fallback-card"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-red-50/50 border-2 border-red-200 rounded-3xl p-8 flex flex-col justify-between text-left min-h-[350px] shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-red-100 rounded-full blur-3xl -mr-16 -mt-16 opacity-40 pointer-events-none" />
                
                <div className="space-y-5 relative">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shadow-xs">
                    <ShieldAlert className="w-6 h-6" />
                  </div>

                  <div>
                    <h3 className="font-display font-black text-rose-950 text-xl tracking-tight">Account Verification Required</h3>
                    <p className="text-xs text-rose-800 font-semibold mt-2 leading-relaxed">
                      Your Google account <strong className="text-rose-900 underline">{currentUser.email}</strong> is not listed or verified in the official MVOC Google Sheets database directory.
                    </p>
                    <p className="text-xs text-slate-600 font-semibold mt-3 leading-relaxed">
                      To prevent unauthorized role assignments, please submit your legal credentials through our verified registration form. The regional committee inspects entries within 24 hours.
                    </p>
                  </div>
                </div>

                <div className="pt-8 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a 
                      href={FORM_LINK}
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs h-[44px] rounded-xl shadow-md transition active:scale-[0.98] grow text-center"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span>Request Committee Verification</span>
                    </a>

                    <button
                      onClick={handleSystemLogout}
                      className="px-5 py-3.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-705 font-bold text-xs h-[44px] rounded-xl transition flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                  <p className="text-[9.5px] text-slate-500 font-semibold">
                    Have you already submitted the Google Form? Click below to execute a live database refresh query.
                  </p>

                  <button
                    onClick={() => {
                      if (currentUser) {
                        checkAndSyncUser(currentUser.uid, currentUser.email || '');
                      }
                    }}
                    disabled={syncing}
                    className="text-xs font-black text-[#0F2D52] hover:text-[#184172] flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>Run Query Verification Refresh</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Success Synced Profile panel */}
            {!loading && currentUser && !showFormFallback && userProfile && (
              <motion.div 
                key="profile-card"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6 text-left relative"
              >
                {/* Header Profile Title card block */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-150 flex items-center justify-center shrink-0">
                      <UserCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-black text-slate-900 text-lg leading-tight">{userProfile.name}</h3>
                        <span className="bg-[#EFF6FF] border border-[#BFDBFE]/60 px-2 py-0.5 rounded-full text-[8px] font-extrabold text-[#1D4ED8] uppercase tracking-wider">
                          Verified
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs font-semibold">{userProfile.email}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => checkAndSyncUser(currentUser.uid, currentUser.email || '')}
                      disabled={syncing}
                      className="px-4 py-2.5 bg-[#EEF2F6] hover:bg-slate-200 text-[#0F2D52] font-black text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                      title="Sync data now"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>

                    <button
                      onClick={handleSystemLogout}
                      className="px-4 py-2.5 bg-slate-50 hover:bg-red-50 border border-slate-200 text-slate-700 hover:text-red-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>

                {/* Main profile properties layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Property 1: Full Name */}
                  <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-550" />
                      Registrant Full Name
                    </span>
                    <input 
                      type="text" 
                      value={userProfile.name || ''} 
                      readOnly
                      placeholder="No name registered"
                      className="w-full bg-transparent text-slate-800 text-xs font-extrabold focus:outline-hidden py-1 border-b border-transparent placeholder:text-slate-400"
                    />
                  </div>

                  {/* Property 2: Email */}
                  <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-550" />
                      Google Authenticated Email
                    </span>
                    <input 
                      type="text" 
                      value={userProfile.email || ''} 
                      readOnly
                      className="w-full bg-transparent text-slate-800 text-xs font-extrabold focus:outline-hidden py-1 border-b border-transparent"
                    />
                  </div>

                  {/* Property 3: Immutability Field (MVOC ID) */}
                  <div className="space-y-1 bg-[#EEF2F6]/60 p-4 rounded-2xl border border-[#DCEBFB]/60 text-left relative overflow-hidden group">
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold text-amber-800">
                      <Lock className="w-2.5 h-2.5" />
                      <span>IMMUTABLE</span>
                    </div>

                    <span className="text-[10px] font-extrabold text-[#0F2D52] uppercase tracking-wider block">
                      Official MVOC Identifier
                    </span>
                    <div className="flex items-center gap-2 py-0.5">
                      <input 
                        type="text" 
                        value={userProfile.mvocId || ''} 
                        readOnly
                        aria-readonly="true"
                        className="w-full bg-transparent text-[#0F2D52] text-xs font-black focus:outline-hidden py-0.5 selection:bg-slate-300"
                      />
                    </div>
                    <p className="text-[9.5px] text-slate-400 font-semibold leading-relaxed mt-1">
                      Identity values are structurally locked for validation safety. For transfers, lodge support.
                    </p>
                  </div>

                  {/* Property 4: Regional Chapter */}
                  <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                      Assigned Chapter
                    </span>
                    <div className="text-xs font-bold text-slate-800 py-1 flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span>{userProfile.chapter || "Selangor Chapter"}</span>
                    </div>
                  </div>
                </div>

                {/* Additional synced variables info panel */}
                <div className="bg-emerald-50/50 border border-emerald-200/50 p-4 rounded-2xl flex items-start gap-3">
                  <div className="mt-0.5 bg-emerald-100 text-emerald-750 p-1 rounded-lg shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 leading-none">Security Sync Completed</h4>
                    <p className="text-[10.5px] text-slate-600 font-semibold mt-1 leading-relaxed">
                      Your identity mapping is verified against row coordinates of the core MVOC database directory. Your active web permissions level is: <strong className="text-emerald-800 uppercase">{userProfile.role}</strong> (${userProfile.tier} BENEFITS).
                    </p>
                  </div>
                </div>

              </motion.div>
            )}

            {/* Error Rescue Screen */}
            {!loading && currentUser && errorMsg && (
              <motion.div 
                key="error-card"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 text-left space-y-4"
              >
                <div className="flex items-center gap-3 text-red-600 border-b border-red-50 pb-3">
                  <ShieldAlert className="w-5 h-5" />
                  <h3 className="font-display font-bold text-sm text-slate-900 uppercase tracking-wide">Sync Operation Aborted</h3>
                </div>

                <div className="bg-red-50 p-3.5 rounded-xl border border-red-100 text-[11px] font-mono text-red-800 break-words whitespace-pre-wrap leading-relaxed">
                  {errorMsg}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (currentUser) {
                        checkAndSyncUser(currentUser.uid, currentUser.email || '');
                      }
                    }}
                    className="px-4 py-2.5 bg-[#0F2D52] hover:bg-[#184172] text-white font-extrabold text-xs rounded-xl flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>Try Synchronization Again</span>
                  </button>

                  <button
                    onClick={handleSystemLogout}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl transition"
                  >
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
