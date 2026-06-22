import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, MapPin, Link as LinkIcon, Download, Plus, QrCode, AlertTriangle, Menu, Settings, CheckCircle2, Trash2, RefreshCw, Lock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, setDoc, Timestamp, onSnapshot, deleteDoc } from 'firebase/firestore';
import { calculateEffectiveXP } from '../lib/fetchAndSyncData';


interface AdminQRListProps {
  onClose: () => void;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  isAdmin: boolean;
}

export default function AdminQRList({ onClose, triggerToast, isAdmin }: AdminQRListProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [convoys, setConvoys] = useState<any[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<any[]>([]);
  const [allScanLogs, setAllScanLogs] = useState<any[]>([]);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // QR status and expiration model states
  const [qrConfigs, setQrConfigs] = useState<Record<string, { status: 'active' | 'disabled'; expiresAt: any }>>({});
  const [tempExpiries, setTempExpiries] = useState<Record<string, string>>({});

  // Strict role guard states
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [selectedAdminFilter, setSelectedAdminFilter] = useState('');
  const [selectedChapterFilter, setSelectedChapterFilter] = useState('');
  const [managedChapters, setManagedChapters] = useState<string[]>([]);
  const [chaptersList] = useState(['Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu', 'W.P Kuala Lumpur', 'W.P Labuan', 'W.P Putrajaya']);
  const [selectedChapterToCreate, setSelectedChapterToCreate] = useState('');

  // Create QR Code Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'events' | 'convoys' | 'attendance'>('events');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [customQrName, setCustomQrName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transactional Update to modify only chosen fields without overwriting other QR config data
  const handleUpdateQrField = async (itemId: string, updates: { status?: 'active' | 'disabled'; expiresAt?: Date | null }) => {
    try {
      const qrRef = doc(db, 'qrCodes', itemId);
      const qrSnap = await getDoc(qrRef);

      const firestoreUpdates: any = {};
      if (updates.status !== undefined) {
        firestoreUpdates.status = updates.status;
      }
      if (updates.expiresAt !== undefined) {
        firestoreUpdates.expiresAt = updates.expiresAt ? Timestamp.fromDate(updates.expiresAt) : null;
      }

      if (!qrSnap.exists()) {
        console.log(`[DEBUG] Initializing QR Configuration for Item ${itemId}`);
        const defaultData = {
          status: 'active',
          expiresAt: null,
          ...firestoreUpdates
        };
        await setDoc(qrRef, defaultData);
      } else {
        console.log(`[DEBUG] Transactional update on QR ${itemId} via updateDoc`);
        await updateDoc(qrRef, firestoreUpdates);
      }

      triggerToast('QR Configuration successfully synchronized with database!', 'success');

      // Refresh loaded config for specific item
      const freshSnap = await getDoc(qrRef);
      if (freshSnap.exists()) {
        setQrConfigs(prev => ({
          ...prev,
          [itemId]: freshSnap.data() as any
        }));
      }
    } catch (err: any) {
      console.error('[ERROR] Failed updating QR metrics:', err);
      triggerToast(`Database update failed: ${err.message || err}`, 'error');
    }
  };

  // 1. Strict Role check from firestore db users collection
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          console.log('[DEBUG] No authenticated user found, restricting access.');
          setCurrentUserRole('member');
          return;
        }
        
        console.log('[DEBUG] AdminQRList checking database role for user:', user.uid);
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
          const role = userSnap.data()?.role || 'member';
          console.log('[DEBUG] Database validated user role:', role);
          setCurrentUserRole(role);
          let mChapters: string[] = [];
          if (userSnap.data()?.managedChapter) {
            const mc = userSnap.data()?.managedChapter;
            mChapters = Array.isArray(mc) ? mc : [mc];
          }
          setManagedChapters(mChapters);
        } else {
          console.log('[DEBUG] No user profile exists, defaults to member.');
          setCurrentUserRole('member');
        }
      } catch (err) {
        console.error('[ERROR] Error fetching user role from Firestore:', err);
        setCurrentUserRole('member');
      } finally {
        setCheckingRole(false);
      }
    };

    fetchUserRole();
  }, []);

  // 2. Fetch events, convoys, and attendance from Firestore collections
  const fetchData = async () => {
    setLoadingData(true);
    console.log('[DEBUG] AdminQRList fetching events, convoys, and attendance...');

    // A. Fetch Events
    try {
      const eventsSnap = await getDocs(collection(db, 'events'));
      const evs = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('[DEBUG] Firestore: Loaded Events:', evs);
      setEvents(evs);
      const cRole = currentUserRole || (isAdmin ? 'super_admin' : 'member');
      if (cRole === 'super_admin') {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          const uList = usersSnap.docs
             .map(d => ({ id: d.id, ...d.data() }))
             .filter(u => u.role === 'admin' || u.role === 'super_admin');
          setUsersList(uList as any[]);
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('[ERROR] Failed fetching events collection:', err);
      triggerToast(`Events fetch error: ${err.message || String(err)}`, 'error');
    }

    // B. Fetch Convoys
    try {
      const convoySnap = await getDocs(collection(db, 'convoys'));
      const cvs = convoySnap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('[DEBUG] Firestore: Loaded Convoys:', cvs);
      setConvoys(cvs);
    } catch (err: any) {
      console.error('[ERROR] Failed fetching convoys collection:', err);
      triggerToast(`Convoys fetch error: ${err.message || String(err)}`, 'error');
    }

    // C. Fetch Attendance session logs
    try {
      const attendanceSnap = await getDocs(collection(db, 'attendance'));
      const sessions: any[] = [];
      
      for (const d of attendanceSnap.docs) {
        const sessionId = d.id;
        const sessionData = d.data();
        let attendeeCount = 0;
        
        // Fetch subcollection "attendees" to calculate count
        try {
          const attendeesSnap = await getDocs(collection(db, 'attendance', sessionId, 'attendees'));
          attendeeCount = attendeesSnap.size;
        } catch (subErr) {
          console.warn(`[WARNING] Failed reading attendees for session "${sessionId}":`, subErr);
        }
        
        sessions.push({
          id: sessionId,
          title: sessionData.title || sessionData.name || `Session ${sessionId}`,
          subtitle: sessionData.subtitle || `Created at ${sessionData.createdAt ? new Date(sessionData.createdAt).toLocaleDateString() : 'TBA'}`,
          attendeeCount,
          ...sessionData
        });
      }
      
      console.log('[DEBUG] Firestore: Loaded Attendance Sessions:', sessions);
      setAttendanceSessions(sessions);
    } catch (err: any) {
      console.error('[ERROR] Failed fetching attendance collection:', err);
      triggerToast(`Attendance sessions fetch error: ${err.message || String(err)}`, 'error');
    }

    // D. Fetch QR Configurations
    try {
      const qrCodesSnap = await getDocs(collection(db, 'qrCodes'));
      const qrs: Record<string, any> = {};
      qrCodesSnap.docs.forEach(d => {
        qrs[d.id] = d.data();
      });
      console.log('[DEBUG] Firestore: Loaded QR configs:', qrs);
      setQrConfigs(qrs);
    } catch (err: any) {
      console.error('[ERROR] Failed fetching qrCodes collection:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    const isAuthorized = isAdmin || currentUserRole === 'admin' || currentUserRole === 'super_admin';
    if (isAuthorized) {
      fetchData();
    }
  }, [isAdmin, currentUserRole]);

  // Real-time listener for scan activities (Admin dashboard)
  useEffect(() => {
    const isAuthorized = isAdmin || currentUserRole === 'admin' || currentUserRole === 'super_admin';
    if (!isAuthorized) return;

    const unsubscribe = onSnapshot(collection(db, 'scanLogs'), (snapshot) => {
      const logsList: any[] = [];
      snapshot.forEach((doc) => {
        logsList.push({ id: doc.id, ...doc.data() });
      });
      // Sort in-memory desc
      logsList.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      setAllScanLogs(logsList.slice(0, 100)); // Limit to latest 100 on frontend for performance
    }, (err) => {
      console.error('[ERROR] Error fetching live scan logs in AdminQRList:', err);
    });

    return () => unsubscribe();
  }, [isAdmin, currentUserRole]);

  // PNG/SVG download trigger with canvas rendering
  const downloadQR = (elementId: string, title: string) => {
    try {
      const svg = document.getElementById(elementId);
      if (!svg) {
        triggerToast('QR code element not found on this card.', 'error');
        return;
      }
      
      const svgString = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 300;
        canvas.height = 300;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, 300, 300);
          context.drawImage(image, 0, 0, 300, 300);
          
          const png = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = png;
          downloadLink.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          triggerToast('QR code downloaded successfully as PNG image!', 'success');
        } else {
          downloadRawSVG(url, title);
        }
      };
      image.onerror = () => {
        downloadRawSVG(url, title);
      };
      image.src = url;
    } catch (err: any) {
      console.error('[ERROR] QR Code download failure:', err);
      triggerToast(`Failed to parse QR for download: ${err.message || err}`, 'error');
    }
  };

  const downloadRawSVG = (blobUrl: string, title: string) => {
    const downloadLink = document.createElement('a');
    downloadLink.href = blobUrl;
    downloadLink.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    triggerToast('Fetched QR downloaded as SVG vector format!', 'success');
  };

  // Copy registration/attendance sharing Link
  const copyQRLink = (payload: any) => {
    try {
      const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const finalLink = `${window.location.origin}?action=attendance&qrPayload=${encodeURIComponent(payloadStr)}`;
      navigator.clipboard.writeText(finalLink);
      triggerToast('RSVP Scan-In registration link successfully copied!', 'success');
    } catch (err: any) {
      console.error('[ERROR] Failed copying shared link:', err);
      triggerToast('Unable to write to device clipboard.', 'error');
    }
  };

  // Dynamic creation submit writing live to Firestore
  const handleCreateQR = async () => {
    if (!customQrName.trim() && !selectedItemId) {
      triggerToast('Please select an item or fill in a custom name.', 'warning');
      return;
    }

    setIsSubmitting(true);
    const targetTitle = customQrName.trim() || (() => {
      if (selectedType === 'events') return events.find(e => e.id === selectedItemId)?.title;
      if (selectedType === 'convoys') return convoys.find(c => c.id === selectedItemId)?.title || convoys.find(c => c.id === selectedItemId)?.name;
      if (selectedType === 'attendance') return attendanceSessions.find(a => a.id === selectedItemId)?.title;
      return '';
    })() || 'New QR Generated';

    try {
      console.log(`[DEBUG] Adding custom live document to collection "${selectedType}":`, targetTitle);
      
      if (selectedType === 'events') {
        const docRef = await addDoc(collection(db, 'events'), {
          title: targetTitle,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          location: 'HQ Physical Compound',
          rsvps: 0,
          limit: 100,
          status: 'active',
          expiresAt: null,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || null,
          creatorId: auth.currentUser?.uid || null,
          chapter: selectedChapterToCreate || null
        });
        await setDoc(doc(db, 'qrCodes', docRef.id), { status: 'active', expiresAt: null });
      } else if (selectedType === 'convoys') {
        const docRef = await addDoc(collection(db, 'convoys'), {
          title: targetTitle,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          details: 'Dynamic state convoy. Pre-registrations active.',
          status: 'OPEN',
          status_qr: 'active',
          expiresAt: null,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || null,
          creatorId: auth.currentUser?.uid || null,
          chapter: selectedChapterToCreate || null
        });
        await setDoc(doc(db, 'qrCodes', docRef.id), { status: 'active', expiresAt: null });
      } else if (selectedType === 'attendance') {
        const docRef = await addDoc(collection(db, 'attendance'), {
          title: targetTitle,
          subtitle: `Created on ${new Date().toLocaleDateString()}`,
          status: 'active',
          expiresAt: null,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || null,
          chapter: selectedChapterToCreate || null
        });
        await setDoc(doc(db, 'qrCodes', docRef.id), { status: 'active', expiresAt: null });
      }

      if (auth.currentUser?.uid) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          last_event_created_date: new Date().toISOString()
        });
      }

      // Award Admin XP
      const adminUid = auth.currentUser?.uid;
      let actualXpAwarded = 0;
      let wasAwarded = false;

      if (adminUid && (selectedType === 'events' || selectedType === 'convoys')) {
        const titleLower = targetTitle.toLowerCase();
        const isVolunteer = titleLower.includes('sukarelawan') || titleLower.includes('volunteer');
        const isMajorEvent = titleLower.includes('major') || titleLower.includes('ajk');
        
        let memberXp = 10;
        if (isVolunteer) memberXp = 100;
        else if (isMajorEvent) memberXp = 50;
        
        const xpToAward = memberXp * 2; // 2x multiplier
        
        try {
          const adminUserRef = doc(db, 'users', adminUid);
          const adminUserSnap = await getDoc(adminUserRef);
          if (adminUserSnap.exists()) {
            const userData = adminUserSnap.data();
            const effectiveData = calculateEffectiveXP(userData);
            let currentXP = effectiveData.effectiveXP;
            
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const monthlyXpMap = userData.monthlyXp || {};
            const currentMonthXp = monthlyXpMap[currentMonth] || 0;
            
            if (currentMonthXp < 500) {
              actualXpAwarded = Math.min(xpToAward, 500 - currentMonthXp);
            }
            
            currentXP += actualXpAwarded;
            monthlyXpMap[currentMonth] = currentMonthXp + actualXpAwarded;
            
            const updates: any = {
              points: currentXP,
              lastActivityDate: now.toISOString(),
              monthlyXp: monthlyXpMap
            };
            
            await updateDoc(adminUserRef, updates);
            wasAwarded = true;
            console.log(`[DEBUG] Awarded ${actualXpAwarded} XP to admin ${adminUid} for event/convoy creation.`);
          }
        } catch (xpErr) {
          console.error('[ERROR] Failed to award admin XP:', xpErr);
        }
      }

      if (wasAwarded && actualXpAwarded > 0) {
        triggerToast(`Successfully initialized and synced "${targetTitle}" QR! (+${actualXpAwarded} XP Admin Multiplier)`, 'success');
      } else if (wasAwarded && actualXpAwarded === 0 && (selectedType === 'events' || selectedType === 'convoys')) {
        triggerToast(`Successfully initialized and synced "${targetTitle}" QR! (0 XP - Monthly 500 XP limit reached)`, 'info');
      } else {
        triggerToast(`Successfully initialized and synced "${targetTitle}" QR!`, 'success');
      }

      setIsCreateModalOpen(false);
      setCustomQrName('');
      setSelectedItemId('');
      await fetchData();
    } catch (e: any) {
      console.error('[ERROR] Firestore submission failed:', e);
      triggerToast(`Could not persistent save QR: ${e.message || e}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQRControlPanel = (itemId: string) => {
    const config = qrConfigs[itemId] || { status: 'active', expiresAt: null };
    const isDisabled = config.status === 'disabled';

    let isExpired = false;
    let expiryDateString = '';
    if (config.expiresAt) {
      const expDate = config.expiresAt.toDate ? config.expiresAt.toDate() : new Date(config.expiresAt);
      isExpired = expDate < new Date();
      const tzoffset = expDate.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(expDate.getTime() - tzoffset)).toISOString().slice(0, 16);
      expiryDateString = localISOTime;
    }

    const currentInputValue = tempExpiries[itemId] !== undefined ? tempExpiries[itemId] : expiryDateString;

    return (
      <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">QR Code Policy</span>
          <div className="flex gap-1.5">
            {isDisabled && (
              <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                Disabled
              </span>
            )}
            {isExpired && (
              <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">
                Expired
              </span>
            )}
            {!isDisabled && !isExpired && (
              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[8px] font-black uppercase px-1.5 py-0.5 rounded animate-pulse">
                Active
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleUpdateQrField(itemId, { status: isDisabled ? 'active' : 'disabled' })}
            className={`flex-1 py-1.5 px-3 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition border cursor-pointer ${
              isDisabled
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
            }`}
          >
            {isDisabled ? 'Enable QR Code' : 'Disable QR Code'}
          </button>
        </div>

        <div className="space-y-1">
          <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">Set Expiry Date &amp; Time</label>
          <div className="flex gap-1.5">
            <input
              type="datetime-local"
              value={currentInputValue}
              onChange={(e) => setTempExpiries(prev => ({ ...prev, [itemId]: e.target.value }))}
              className="flex-1 bg-slate-50 border border-slate-200 text-[10px] font-extrabold p-2 rounded-xl text-slate-700 outline-none focus:border-[#0f2d52]"
            />
            <button
              onClick={() => {
                const val = tempExpiries[itemId] !== undefined ? tempExpiries[itemId] : expiryDateString;
                const dateObj = val ? new Date(val) : null;
                handleUpdateQrField(itemId, { expiresAt: dateObj });
              }}
              className="bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-[9px] uppercase px-3 py-2 rounded-xl tracking-wider cursor-pointer shadow-sm"
            >
              Set
            </button>
            {config.expiresAt && (
              <button
                onClick={() => {
                  setTempExpiries(prev => {
                    const copy = { ...prev };
                    delete copy[itemId];
                    return copy;
                  });
                  handleUpdateQrField(itemId, { expiresAt: null });
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-extrabold text-[9px] uppercase px-2 py-2 rounded-xl tracking-wider cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const isAuthorizedFull = isAdmin || currentUserRole === 'admin' || currentUserRole === 'super_admin';

  if (checkingRole) {
    return (
      <div className="fixed inset-0 z-50 bg-[#05101E] flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
        <p className="text-white/80 font-bold uppercase tracking-widest text-xs">Validating Admin Credentials...</p>
      </div>
    );
  }

  if (!isAuthorizedFull) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0F2D52] flex flex-col items-center justify-center p-6 text-center text-white">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-black mb-2">ACCESS RESTRICTED</h2>
        <p className="text-white/70 mb-8 max-w-sm">
          Strict guard active. Only verified Admins and Super Admins in the Firestore database are authorized to view this page.
        </p>
        <button
          onClick={onClose}
          className="px-8 py-3 bg-white text-[#0F2D52] rounded-full font-bold uppercase tracking-wide hover:bg-slate-100 transition shadow-lg"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col pt-safe-top overflow-hidden bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:24px_24px]">
      
      {/* 1. Dashboard Native Header Block */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="p-2 -ml-2 text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display font-extrabold text-[#0e2340] text-lg tracking-tight">Admin Utility</h1>
          </div>
          <button 
            onClick={() => triggerToast('Admin Settings module initialized.', 'info')} 
            className="p-2 text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Headline & Dynamic Creation Trigger */}
      <div className="flex-shrink-0 px-6 pt-6 pb-2 max-w-xl mx-auto w-full">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-[#0e2340] tracking-tight">Admin QR Manager</h2>
            <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Operational Attendance Codes</p>
          </div>
          <button 
            onClick={() => {
              setCustomQrName('');
              setSelectedItemId('');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0F2D52] hover:bg-[#153e70] active:scale-95 text-white rounded-xl font-extrabold text-xs tracking-wider transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            ADD QR
          </button>
        </div>
      </div>

      {/* 3. Scrolling Feed Layout */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 max-w-md mx-auto w-full space-y-6">
        
        
      {/* Super Admin Filters */}
      {currentUserRole === 'super_admin' && (
        <div className="flex-shrink-0 px-6 pt-2 pb-4 max-w-xl mx-auto w-full">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500" /> MASTER CONTROL</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase">Filter by Admin</label>
                <select 
                  value={selectedAdminFilter}
                  onChange={(e) => setSelectedAdminFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value="">All Admins (Global)</option>
                  {usersList.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase">Filter by Chapter</label>
                <select 
                  value={selectedChapterFilter}
                  onChange={(e) => setSelectedChapterFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs font-bold text-slate-800"
                >
                  <option value="">All Chapters (Global)</option>
                  {chaptersList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

        {loadingData ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0F2D52] mb-3"></div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0F2D52]">Parsing Database Live Streams...</p>
          </div>
        ) : (
          <>
            {/* CARD 1: OFFICIAL EVENTS BLOCK */}
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Official Event Records</div>
              
              {(() => {
                const isSuperAdmin = currentUserRole === 'super_admin';
                const activeEvents = events.filter(ev => {
                  const config = qrConfigs[ev.id];
                  if (config?.expiresAt) {
                    const expDate = config.expiresAt.toDate ? config.expiresAt.toDate() : new Date(config.expiresAt);
                    if (new Date().getTime() - expDate.getTime() > 24 * 60 * 60 * 1000) return false;
                  }
                  if (isSuperAdmin) {
                    if (selectedAdminFilter && ev.createdBy !== selectedAdminFilter) return false;
                    if (selectedChapterFilter && ev.chapter !== selectedChapterFilter) return false;
                    return true;
                  }
                  return ev.createdBy === auth.currentUser?.uid || ev.adminId === auth.currentUser?.uid;
                });
                return activeEvents.length === 0 ? (
                /* Beautiful visual placeholder matching Event style when empty */
                <div className="bg-white rounded-2xl shadow-sm border-t-4 border-t-[#0e2340] p-6 border border-slate-200/80">
                  <div className="bg-[#0e2340] text-white flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg w-fit">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    UPCOMING EVENT (SAMPLE)
                  </div>
                  <h3 className="text-lg font-extrabold text-[#0e2340] mt-3">MVOC National Meet 2024</h3>
                  <div className="flex flex-col gap-2 mt-3 text-slate-600 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>15th December 2024</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>Putrajaya, Malaysia</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setCustomQrName('MVOC National Meet 2024');
                      setSelectedType('events');
                      setIsCreateModalOpen(true);
                    }}
                    className="flex items-center justify-center gap-2 w-full mt-4 py-2 bg-[#10B981] text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition shadow-sm hover:brightness-95 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    ACTIVATE LIVE RECORD
                  </button>
                  
                  <div className="mt-5 p-5 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-200/60 shadow-inner">
                    <div className="bg-white p-5 rounded-2xl shadow-md border border-slate-100 flex flex-col items-center justify-center">
                      <QRCodeSVG value={`${window.location.origin}?action=attendance&qrPayload=${encodeURIComponent(JSON.stringify({ type: 'attendance', context: 'event', refId: 'placeholder-event', name: 'MVOC National Meet 2024' }))}`} size={120} level="H" imageSettings={{ src: "/mvoc_logo.png", x: undefined, y: undefined, height: 22, width: 22, excavate: true }} />
                    </div>
                    <span className="text-[10px] font-black text-[#0e2340] mt-3 uppercase tracking-wider">Event Attendance</span>
                  </div>
                </div>
              ) : (
                activeEvents.map((event) => (

                  <div 
                    key={event.id}
                    className="bg-white rounded-2xl shadow-sm border-t-4 border-t-[#0e2340] p-6 border border-slate-200/80 mb-4"
                  >
                    <div className="bg-[#0e2340] text-white flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg w-fit">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      UPCOMING EVENT
                    </div>
                    <h3 className="text-lg font-extrabold text-[#0e2340] mt-3 leading-snug">{event.title}</h3>
                    
                    <div className="flex flex-col gap-2 mt-3 text-slate-600 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{event.date || 'To Be Announced'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{event.location || event.meetingPoint || 'Kuala Lumpur HQ'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-black uppercase text-slate-500">
                      <button 
                        onClick={() => downloadQR(`qr-event-${event.id}`, event.title)}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-[#10B981] hover:brightness-95 text-white font-extrabold rounded-xl shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        EXPORT ATTENDEE LIST
                      </button>
                      <button 
                        onClick={() => copyQRLink({ type: 'attendance', context: 'event', refId: String(event.id), name: event.title })}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl border border-slate-200/50 cursor-pointer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        COPY LINK
                      </button>
                    </div>

                    {(() => {
                      const config = qrConfigs[event.id] || { status: 'active', expiresAt: null };
                      const isQrDisabled = config.status === 'disabled';
                      let isQrExpired = false;
                      if (config.expiresAt) {
                        const expDate = config.expiresAt.toDate ? config.expiresAt.toDate() : new Date(config.expiresAt);
                        isQrExpired = expDate < new Date();
                      }
                      const isInactive = isQrDisabled || isQrExpired;

                      return (
                        <div className="mt-5 p-5 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-200/60 shadow-inner relative overflow-hidden">
                          <div className={`bg-white p-5 rounded-2xl shadow-md border border-slate-100 flex flex-col items-center justify-center transition-all ${isInactive ? 'opacity-20 grayscale' : ''}`}>
                            <QRCodeSVG 
                              id={`qr-event-${event.id}`} 
                              value={`${window.location.origin}?action=attendance&qrPayload=${encodeURIComponent(JSON.stringify({ type: 'attendance', context: 'event', refId: String(event.id), name: event.title }))}`} 
                              size={120} 
                              level="H"
                              imageSettings={{ src: "/mvoc_logo.png", x: undefined, y: undefined, height: 22, width: 22, excavate: true }}
                            />
                          </div>
                          {isInactive && (
                            <div className="absolute inset-0 bg-slate-100/50 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center">
                              <span className="bg-rose-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {isQrDisabled ? 'QR DISABLED' : 'QR EXPIRED'}
                              </span>
                            </div>
                          )}
                          {!isInactive && (
                            <span className="text-[10px] font-black text-[#0e2340] mt-3 uppercase tracking-wider">Event Attendance</span>
                          )}
                        </div>
                      );
                    })()}

                    {renderQRControlPanel(event.id)}
                  </div>
                ))
              );
              })()}
            </div>
            {/* CARD 2: ACTIVE CONVOYS BLOCK */}
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Active Convoy Tracks</div>
              
              {(() => {
                const isSuperAdmin = currentUserRole === 'super_admin';
                const activeConvoys = convoys.filter(cv => {
                  const config = qrConfigs[cv.id];
                  if (config?.expiresAt) {
                    const expDate = config.expiresAt.toDate ? config.expiresAt.toDate() : new Date(config.expiresAt);
                    if (new Date().getTime() - expDate.getTime() > 24 * 60 * 60 * 1000) return false;
                  }
                  if (isSuperAdmin) {
                    if (selectedAdminFilter && cv.createdBy !== selectedAdminFilter) return false;
                    if (selectedChapterFilter && cv.chapter !== selectedChapterFilter) return false;
                    return true;
                  }
                  return cv.createdBy === auth.currentUser?.uid || cv.adminId === auth.currentUser?.uid;
                });
                return activeConvoys.length === 0 ? (
                /* Beautiful visual placeholder matching Convoy layout style when empty */
                <div className="bg-white rounded-2xl shadow-sm border-t-4 border-t-[#4e6c92] p-6 border border-slate-200/80">
                  <div className="flex justify-between items-center">
                    <div className="bg-[#4e6c92] text-white flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1.5 rounded-lg w-fit">
                      <QrCode className="w-3.5 h-3.5 text-blue-200" />
                      ACTIVE CONVOY
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-[#10B981] font-extrabold animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span>
                      ● LIVE
                    </div>
                  </div>
                  <h3 className="text-lg font-extrabold text-[#0e2340] mt-3">Genting Highland Morning Drive</h3>
                  
                  <div className="bg-[#eff6ff] p-3 rounded-xl border border-blue-100 mt-3 text-xs space-y-1 text-[#0f2d52] font-semibold">
                    <div className="flex justify-between">
                      <span className="opacity-70">CONVOY ID:</span>
                      <span className="font-extrabold">GH-2024-081</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70">LEAD ADMIN:</span>
                      <span className="font-extrabold">Mohd Ridzuan</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setCustomQrName('Genting Highland Morning Drive');
                      setSelectedType('convoys');
                      setIsCreateModalOpen(true);
                    }}
                    className="flex justify-center items-center gap-1.5 w-full mt-4 py-2 bg-slate-800 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition hover:bg-slate-950 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    ACTIVATE LIVE RECORD
                  </button>

                  <div className="mt-5 p-5 bg-slate-200/70 rounded-2xl flex flex-col items-center justify-center border border-slate-300 shadow-inner">
                    <div className="bg-white p-5 pb-3 rounded-xl shadow-lg border border-slate-300 w-36 flex flex-col items-center relative">
                      <div className="absolute top-1.5 flex justify-between w-full px-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                      </div>
                      <div className="mt-1">
                        <QRCodeSVG value={`${window.location.origin}?action=attendance&qrPayload=${encodeURIComponent(JSON.stringify({ type: 'attendance', context: 'convoy', refId: 'placeholder-convoy', name: 'Genting Highland Morning Drive' }))}`} size={90} level="H" imageSettings={{ src: "/mvoc_logo.png", x: undefined, y: undefined, height: 17, width: 17, excavate: true }} />
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-[#0e2340] mt-3 uppercase tracking-wider">Convoy Check-in</span>
                  </div>
                </div>
              ) : (
                activeConvoys.map((convoy) => (

                  <div 
                    key={convoy.id}
                    className="bg-white rounded-2xl shadow-sm border-t-4 border-t-[#4e6c92] p-6 border border-slate-200/80 mb-4"
                  >
                    <div className="flex justify-between items-center">
                      <div className="bg-[#4e6c92] text-white flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1.5 rounded-lg w-fit">
                        <QrCode className="w-3.5 h-3.5 text-blue-200" />
                        ACTIVE CONVOY
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[#10B981] font-extrabold animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]"></span>
                        ● LIVE
                      </div>
                    </div>
                    <h3 className="text-lg font-extrabold text-[#0e2340] mt-3 leading-snug">{convoy.title || convoy.name}</h3>
                    
                    <div className="bg-[#eff6ff] p-3 rounded-xl border border-blue-50 mt-3 text-xs space-y-1 text-[#0f2d52] font-semibold">
                      <div className="flex justify-between">
                        <span className="opacity-70">CONVOY ID:</span>
                        <span className="font-extrabold truncate max-w-[150px]">{convoy.id.substring(0, 12).toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">LEAD ADMIN:</span>
                        <span className="font-extrabold truncate max-w-[150px]">{convoy.leadAdmin || 'Mohd Ridzuan'}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-black uppercase text-slate-500">
                      <button 
                        onClick={() => downloadQR(`qr-convoy-${convoy.id}`, convoy.title || convoy.name || 'convoy')}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-[#4e6c92] hover:brightness-95 text-white font-extrabold rounded-xl shadow-sm cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        DOWNLOAD QR
                      </button>
                      <button 
                        onClick={() => copyQRLink({ type: 'attendance', context: 'convoy', refId: String(convoy.id), name: convoy.title || convoy.name })}
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl border border-slate-200/50 cursor-pointer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        COPY LINK
                      </button>
                    </div>

                    {(() => {
                      const config = qrConfigs[convoy.id] || { status: 'active', expiresAt: null };
                      const isQrDisabled = config.status === 'disabled';
                      let isQrExpired = false;
                      if (config.expiresAt) {
                        const expDate = config.expiresAt.toDate ? config.expiresAt.toDate() : new Date(config.expiresAt);
                        isQrExpired = expDate < new Date();
                      }
                      const isInactive = isQrDisabled || isQrExpired;

                      return (
                        <div className="mt-5 p-5 bg-slate-200/60 rounded-2xl flex flex-col items-center justify-center border border-slate-300 shadow-inner relative overflow-hidden">
                          <div className={`bg-white p-5 pb-3 rounded-xl shadow-lg border border-slate-300 w-36 flex flex-col items-center relative transition-all ${isInactive ? 'opacity-20 grayscale' : ''}`}>
                            <div className="absolute top-1.5 flex justify-between w-full px-3">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                            </div>
                            <div className="mt-1">
                              <QRCodeSVG 
                                id={`qr-convoy-${convoy.id}`} 
                                value={`${window.location.origin}?action=attendance&qrPayload=${encodeURIComponent(JSON.stringify({ type: 'attendance', context: 'convoy', refId: String(convoy.id), name: convoy.title || convoy.name }))}`} 
                                size={90} 
                                level="H"
                                imageSettings={{ src: "/mvoc_logo.png", x: undefined, y: undefined, height: 17, width: 17, excavate: true }}
                              />
                            </div>
                          </div>
                          {isInactive && (
                            <div className="absolute inset-0 bg-slate-150/50 backdrop-blur-[1px] flex flex-col items-center justify-center p-3 text-center">
                              <span className="bg-rose-600 text-white text-[10px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg shadow-md flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {isQrDisabled ? 'QR DISABLED' : 'QR EXPIRED'}
                              </span>
                            </div>
                          )}
                          {!isInactive && (
                            <span className="text-[10px] font-black text-[#0e2340] mt-3 uppercase tracking-wider">Convoy Check-in</span>
                          )}
                        </div>
                      );
                    })()}

                    {renderQRControlPanel(convoy.id)}
                  </div>
                ))
              );
              })()}
            </div>
            {/* CARD 3: STATE CHAPTER QR (PERSISTENT) */}
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Persistent State Chapter QR</div>
              {(() => {
                const displayedChapters = currentUserRole === 'super_admin'
                  ? (selectedChapterFilter ? [selectedChapterFilter] : (selectedAdminFilter ? (usersList.find(u => u.id === selectedAdminFilter)?.managedChapter ? (Array.isArray(usersList.find(u => u.id === selectedAdminFilter).managedChapter) ? usersList.find(u => u.id === selectedAdminFilter).managedChapter : [usersList.find(u => u.id === selectedAdminFilter).managedChapter]) : []) : chaptersList))
                  : managedChapters;

                if (displayedChapters.length === 0) {
                  return (
                    <div className="bg-white rounded-2xl shadow-sm border-t-4 border-t-[#4d2500] p-6 border border-slate-200/80 text-center">
                      <p className="text-xs font-bold text-slate-500">Tiada Chapter State yang diuruskan.</p>
                    </div>
                  );
                }

                return displayedChapters.map((chap) => {
                  const chapId = 'chapter-' + chap.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                  return (
                    <div 
                      key={chap}
                      className="bg-white rounded-2xl shadow-sm border-t-4 border-t-[#4d2500] p-6 border border-slate-200/80 mb-4"
                    >
                      <div className="bg-[#4d2500] text-[#ffddb3] flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1.5 rounded-lg w-fit">
                        <QrCode className="w-3.5 h-3.5" />
                        STATE CHAPTER QR
                      </div>
                      <h3 className="text-lg font-extrabold text-[#0e2340] mt-3 leading-snug">{chap} Chapter</h3>
                      
                      <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-black uppercase text-slate-500">
                        <button 
                          onClick={() => downloadQR(`qr-${chapId}`, `${chap} Chapter`)}
                          className="flex items-center justify-center gap-1.5 py-2.5 bg-amber-700 hover:brightness-95 text-white font-extrabold rounded-xl shadow-sm cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          DOWNLOAD QR
                        </button>
                        <button 
                          onClick={() => copyQRLink({ type: 'attendance', context: 'chapter', refId: chap, name: `${chap} Chapter` })}
                          className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl border border-slate-200/50 cursor-pointer"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          COPY LINK
                        </button>
                      </div>

                      <div className="mt-5 p-5 bg-[#f8fafc] rounded-2xl flex flex-col items-center justify-center border border-slate-200/60 shadow-inner relative overflow-hidden">
                        <div className="bg-[#05101e] rounded-xl overflow-hidden shadow-lg border border-slate-800 w-full max-w-[160px] flex flex-col transition-all">
                          <div className="bg-[#0f2d52] px-2.5 py-1 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-rose-500"></span>
                            <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                            <span className="text-[7px] text-white/50 ml-1 font-bold">CHAPTER ENTRY</span>
                          </div>
                          <div className="bg-white p-3.5 flex justify-center items-center">
                            <QRCodeSVG 
                              id={`qr-${chapId}`} 
                              value={`${window.location.origin}?action=attendance&qrPayload=${encodeURIComponent(JSON.stringify({ type: 'attendance', context: 'chapter', refId: chap, name: chap + ' Chapter' }))}`} 
                              size={80} 
                              level="H"
                              imageSettings={{ src: "/mvoc_logo.png", x: undefined, y: undefined, height: 15, width: 15, excavate: true }}
                            />
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-[#0e2340] mt-3 uppercase tracking-wider">Permanent Chapter Check-in</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            
            {/* CARD 4: REAL-TIME SYSTEM SCAN LOGS */}
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live QR Scan Activity (All Users)</span>
                {allScanLogs.length > 0 && (
                  <button
                    onClick={async () => {
                      if (window.confirm("Ada anda pasti mahu memadamkan SEMUA rekod log imbasan QR dalam pangkalan data?")) {
                        try {
                          // Batch or individual deletion of visible logs
                          for (const log of allScanLogs) {
                            await deleteDoc(doc(db, 'scanLogs', log.id));
                          }
                          triggerToast('Telah berjaya membersihkan log imbasan', 'success');
                        } catch (err: any) {
                          triggerToast(`Gagal memadam log: ${err.message}`, 'error');
                        }
                      }
                    }}
                    className="text-[9px] text-[#B91C1C] hover:underline font-extrabold uppercase tracking-wide cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="w-2.5 h-2.5" /> Clear Logs
                  </button>
                )}
              </div>
              
              {allScanLogs.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200/80 text-center text-slate-500">
                  <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-705">Tiada imbasan QR dikesan lagi.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Apabila pengguna mengimbas kad kenalan atau check-in, rekod log akan dipaparkan di sini secara langsung.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3 max-h-[360px] overflow-y-auto">
                  {allScanLogs.map((log) => {
                    const dateObj = log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : new Date(log.timestamp || 0);
                    const isSuccess = log.status === 'success';
                    return (
                      <div 
                        key={log.id} 
                        className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all relative group ${
                          isSuccess ? 'bg-emerald-50/45 border-emerald-100' : 'bg-rose-50/45 border-rose-100'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          isSuccess ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                        }`}>
                          {isSuccess ? (
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 stroke-[2.5]" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-black text-[#0f2d52] truncate">
                              {log.userName || 'Anonymous'}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold">
                              {dateObj.toLocaleTimeString('ms-My', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          
                          <p className="text-[9.5px] text-slate-400 font-semibold truncate leading-none">
                            {log.userEmail || '(no email)'} • {log.mvocId || 'no ID'}
                          </p>

                          <p className="text-xs font-bold text-slate-705 pt-1 leading-normal">
                            {log.message}
                          </p>

                          <div className="mt-1 font-mono text-[8.5px] bg-slate-900/5 text-slate-500 rounded px-1.5 py-0.5 inline-block max-w-full truncate">
                            {log.scannedPayload}
                          </div>
                        </div>

                        {/* Hover delete button for admin to remove logs */}
                        <button
                          disabled={deletingLogId === log.id}
                          onClick={async (e) => {
                            e.stopPropagation();
                            setDeletingLogId(log.id);
                            try {
                              await deleteDoc(doc(db, 'scanLogs', log.id));
                              triggerToast('Rekod log berjaya dipadam', 'success');
                            } catch (err: any) {
                              triggerToast('Gagal memadam log', 'error');
                            } finally {
                              setDeletingLogId(null);
                            }
                          }}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded-lg transition-all absolute top-2 right-2 opacity-0 group-hover:opacity-100 cursor-pointer disabled:opacity-50"
                          title="Padam rekod log ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CARD 5: REAL-TIME ANALYTICS BLOCK */}
            <div className="pt-2">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">System Load Reports</div>
              <div className="bg-gradient-to-br from-[#0e2340] to-[#040e1a] text-white p-6 rounded-3xl shadow-xl border border-white/5 relative overflow-hidden select-none">
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#10B981]/5 to-transparent pointer-events-none" />
                <div className="relative">
                  <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">TOTAL QR SCANS TODAY</div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-4xl font-extrabold tracking-tight text-white">1,248</span>
                    <span className="text-[#10B981] text-[10px] font-black leading-tight flex items-center tracking-wide bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/25">+12% VS LAST WEEK</span>
                  </div>
                  
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ACTIVE POINTS</div>
                    <div className="text-lg font-black mt-0.5 text-white">24 Locations</div>
                  </div>
                  
                  <button 
                    onClick={() => triggerToast('Fetching unified real-time scanner metrics dashboard logs...', 'success')}
                    className="w-full mt-6 py-3 border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition-all rounded-xl text-center text-xs font-bold text-white uppercase tracking-wider cursor-pointer"
                  >
                    View Detailed Reports
                  </button>
                </div>
              </div>
            </div>

            {/* ACCESS INFO BADGE */}
            <div className="flex justify-center pt-2">
              <div className="bg-slate-900 border border-slate-800 text-white/75 px-5 py-2.5 rounded-2xl flex items-center gap-2 shadow-md">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span className="text-[9px] font-bold uppercase tracking-widest leading-none">
                  ADMIN CORE STORAGE CONSOLE
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 4. Overlay Create QR Modal Form */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-sm p-6 relative overflow-hidden text-left"
              id="create-qr-modal"
            >
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
                id="close-modal-btn"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h2 className="text-lg font-black text-[#0f2d52] mb-4">Create New QR Code</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">1. TARGET COLLECTION</label>
                  <select 
                    value={selectedType}
                    onChange={(e) => {
                      setSelectedType(e.target.value as any);
                      setSelectedItemId('');
                      setCustomQrName('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold text-slate-800"
                    id="select-category-type"
                  >
                    <option value="events">Official Events Feed</option>
                    <option value="convoys">Active Convoys Feed</option>
                    <option value="attendance">Chapters Attendance Sessions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">2. SYNC EXISTING DATABASE KEY</label>
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      setSelectedItemId(e.target.value);
                      if (e.target.value) {
                        setCustomQrName(''); 
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold text-slate-800"
                    id="select-item-id"
                  >
                    <option value="">Select Pre-loaded Dynamic Item ID...</option>
                    {selectedType === 'events' && events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                    {selectedType === 'convoys' && convoys.map((cv) => (
                      <option key={cv.id} value={cv.id}>{cv.title || cv.name || `Convoy ${cv.id}`}</option>
                    ))}
                    {selectedType === 'attendance' && attendanceSessions.map((att) => (
                      <option key={att.id} value={att.id}>{att.title}</option>
                    ))}
                  </select>
                </div>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-3 text-slate-400 font-extrabold text-[8px] uppercase tracking-wider">OR ENTRY NEW DOCUMENT</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                {(selectedType === 'events' || selectedType === 'convoys') && (
                  <div className="mb-4">
                    <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">OPTIONAL: ASSIGN TO CHAPTER</label>
                    <select 
                      value={selectedChapterToCreate}
                      onChange={(e) => setSelectedChapterToCreate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="">National / General (No Specific Chapter)</option>
                      {chaptersList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">3. MANUAL TITLE PERSISTENCE</label>
                  <input
                    type="text"
                    value={customQrName}
                    onChange={(e) => {
                      setCustomQrName(e.target.value);
                      if (e.target.value) {
                        setSelectedItemId(''); 
                      }
                    }}
                    placeholder="Enter Custom Meeting/Session Name..."
                    className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#0f2d52]"
                    id="input-custom-qr-name"
                  />
                  <p className="text-[9px] text-slate-400 mt-1 line-clamp-2">This will automatically instigate and write a brand new live record in Firestore database!</p>
                </div>

                <button 
                  onClick={handleCreateQR}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-[#0F2D52] text-white rounded-xl font-extrabold text-xs uppercase tracking-wider hover:bg-[#153e70] transition shadow-md mt-2 disabled:bg-slate-400 flex items-center justify-center gap-2 cursor-pointer"
                  id="submit-generate-qr-btn"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-white"></div>
                      WRITING TO CLOUD...
                    </>
                  ) : (
                    'Generate & Live Persist'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Minimalistic Bottom Persistent Navigation Matching Look of the Mockup Layout */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 md:max-w-md md:mx-auto shadow-xl z-[9999] pointer-events-auto flex justify-around items-center py-2 text-[10px] font-bold text-slate-400 uppercase select-none">
        <button 
          onClick={(e) => {
            console.log('AdminQRList Events Bottom Nav Button clicked!');
            onClose();
          }}
          className="relative z-[9999] flex flex-col items-center gap-1 text-slate-400 hover:text-[#0F2D52] transition-colors py-1 px-3 cursor-pointer"
          style={{ cursor: 'pointer' }}
        >
          <Calendar className="w-5 h-5 opacity-80" />
          <span>Events</span>
        </button>
        <button 
          onClick={(e) => {
            console.log('AdminQRList QR Manager Bottom Nav Button clicked!');
            triggerToast('QR Manager dashboard is currently live active.', 'success');
          }}
          className="relative z-[9999] flex flex-col items-center gap-1 text-blue-600 bg-blue-50/70 border border-blue-105 rounded-xl py-1.5 px-4 cursor-pointer"
          style={{ cursor: 'pointer' }}
        >
          <QrCode className="w-5 h-5 text-blue-600" />
          <span>QR Manager</span>
        </button>
        <button 
          onClick={(e) => {
            console.log('AdminQRList Members Bottom Nav Button clicked!');
            onClose(); 
            triggerToast('Redirecting to members directories view...', 'info'); 
          }}
          className="relative z-[9999] flex flex-col items-center gap-1 text-slate-400 hover:text-[#0F2D52] transition-colors py-1 px-3 cursor-pointer"
          style={{ cursor: 'pointer' }}
        >
          <svg className="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          <span>Members</span>
        </button>
        <button 
          onClick={(e) => {
            console.log('AdminQRList Profile Bottom Nav Button clicked!');
            onClose(); 
            triggerToast('Self profile view rendering...', 'info'); 
          }}
          className="relative z-[9999] flex flex-col items-center gap-1 text-slate-400 hover:text-[#0F2D52] transition-colors py-1 px-3 cursor-pointer"
          style={{ cursor: 'pointer' }}
        >
          <svg className="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Profile</span>
        </button>
      </div>

    </div>
  );
}


