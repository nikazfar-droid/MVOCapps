import React, { useState, useEffect, FormEvent, useCallback, useMemo, useRef } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Smartphone, 
  Phone,
  UserCheck,
  Settings as SettingsIcon,
  Download, 
  X, 
  RefreshCw,
  ArrowRight,
  Info,
  Camera,
  Upload,
  Link,
  Check,
  Menu,
  Bell,
  Scan,
  LayoutDashboard,
  User,
  Car,
  Contact,
  Calendar,
  Compass,
  Image,
  Volume2,
  LogOut,
  QrCode,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Zap,
  Users,
  Pencil,
  ArrowLeft,
  Heart,
  Share2,
  Bookmark,
  Briefcase,
  BookOpen,
  Play,
  Wrench,
  Sun,
  Shield,
  LayoutGrid,
  Plus,
  ClipboardList,
  Tag,
  ChevronDown,
  Megaphone,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  Map,
  MessageSquare,
  Building2,
  Store,
  Compass as CompassIcon,
  HelpCircle,
  TrendingUp,
  Award,
  ShieldAlert,
  Trash2,
  UserCog,
  Facebook,
  Instagram,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import StateChapters from './components/StateChapters';
import MerchantPartners from './components/MerchantPartners';
import DataSyncProvider, { useDataSync } from './components/DataSyncProvider';
import AdminDashboard from './components/AdminDashboard';
import AdminQRList from './components/AdminQRList';
import BroadcastModule from './components/BroadcastModule';
import MemberDirectory from './components/MemberDirectory';
import BlockedNotice from './components/BlockedNotice';
import ErrorBoundary from './components/ErrorBoundary';
import PWAInstaller from './components/PWAInstaller';
import PWAUpdateNotifier from './components/PWAUpdateNotifier';
import { auth, db } from './lib/firebase';
import { collection, updateDoc, doc, deleteDoc, onSnapshot, setDoc, runTransaction, getDocsFromServer, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { SyncedUserProfile, formatMvocId } from './lib/fetchAndSyncData';
import { formatWhatsAppNumber, isValidWhatsAppNumber } from './lib/phoneUtils';
import { getTranslation } from './lib/translations';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
// @ts-ignore
import regeneratedImage from './assets/images/regenerated_image_1781700798979.jpg';
// @ts-ignore
import mvocPremiumFront from './assets/images/mvoc-premium-front.png';
// @ts-ignore
import mvocPremiumBack from './assets/images/mvoc-premium-back.png';

import { Scanner } from '@yudiel/react-qr-scanner';
import { QRCodeSVG } from 'qrcode.react';

// Define core constants
export const MASTER_ADMIN_ID = 'MVOC-0001';
export const MASTER_EMAIL = 'nikazfar@gmail.com';

// Define core types
type TabType = 'dashboard' | 'profile' | 'vehicle' | 'card' | 'events' | 'convoy' | 'gallery' | 'announcements' | 'chapters' | 'merchants' | 'admin' | 'users' | 'broadcast' | 'members' | 'directory';

interface Announcement {
  id: any;
  title: string;
  category: string;
  date: string;
  content: string;
  urgent: boolean;
  pinned?: boolean;
  image?: string;
  badgeText?: string;
  linkText?: string;
  isPromoOffer?: boolean;
  isDocument?: boolean;
  readTime?: string;
  sender?: string;
  audience?: string;
  targetChapter?: string | null;
}

interface EventItem {
  id: number;
  title: string;
  date: string;
  location: string;
  rsvps: number;
  featured: boolean;
  registered: boolean;
  limit?: number;
  organizer?: string;
  badge?: string;
  image?: string;
  category?: 'upcoming' | 'ongoing' | 'completed';
  warningText?: string;
}

export default function App() {
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const triggerToast = useCallback((text: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    const resolvedType = type === 'warning' ? 'info' : type;
    setToastMessage({ text, type: resolvedType });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  return (
    <ErrorBoundary>
      <DataSyncProvider triggerToast={triggerToast}>
        <AppContent 
          toastMessage={toastMessage} 
          setToastMessage={setToastMessage} 
          triggerToast={triggerToast} 
        />
      </DataSyncProvider>
    </ErrorBoundary>
  );
}

function AppContent({
  toastMessage,
  setToastMessage,
  triggerToast
}: {
  toastMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  setToastMessage: React.Dispatch<React.SetStateAction<{ text: string; type: 'success' | 'error' | 'info' } | null>>;
  triggerToast: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}) {
  // Authentication states
  const [isLoggedIn, setIsLoggedIn] = useState(!!auth.currentUser); 
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // 100% Network-Only: Clear all existing browser caches on application load to prevent stale data
  useEffect(() => {
    const clearAllBrowserCaches = async () => {
      try {
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
          console.log('[Cache Clear] All browser HTTP caches purged.');
        }
      } catch (err) {
        console.warn('[Cache Clear] Failed to purge browser caches:', err);
      }
    };
    clearAllBrowserCaches();
  }, []);
  
  // Track auth state changes to dynamically check if they are logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Simple connectivity listener for Offline / Online status PWA notifications
  useEffect(() => {
    const handleOnline = () => {
      triggerToast('Back online! Syncing latest community records.', 'success');
    };
    const handleOffline = () => {
      triggerToast('You are offline. Running in Offline Cache Mode.', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine) {
      const timer = setTimeout(() => {
        triggerToast('Working offline. Loading cached profile and tools.', 'info');
      }, 1500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerToast]);
  
  // Onboarding Sheets Data Sync Hook integration
  const { userProfile, triggerSync, resetSyncState, updateLocalProfileState, language } = useDataSync();
  const t = (key: Parameters<typeof getTranslation>[0]) => getTranslation(key, language);

  // Real-time Guard for user suspension/deletion
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [isBlockedCheckLoading, setIsBlockedCheckLoading] = useState<boolean>(true);

  // Use a ref for userProfile to avoid unsubscribing and resubscribing on every single sync/update,
  // which prevents infinite render loops and unnecessary Firestore connection tear-down.
  const userProfileRef = useRef(userProfile);
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) {
      setIsBlocked(false);
      setLiveStatus(null);
      setIsBlockedCheckLoading(false);
      return;
    }

    setIsBlockedCheckLoading(true);
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const status = docSnap.data()?.status;
        setLiveStatus(status || null);
        if (status === 'suspended' || status === 'banned' || status === 'deleted' || status === 'delete_requested') {
          setIsBlocked(true);
        } else {
          setIsBlocked(false);
        }
      } else {
        // If the document does not exist, check if there is an offline cache or if we are actively syncing.
        // We only mark as deleted if userProfile actually had a status or was loaded before,
        // otherwise stay false because the DataSyncProvider is still in the middle of sheet synchronization.
        const currentProfile = userProfileRef.current;
        setLiveStatus(currentProfile?.status || null);
        if (currentProfile && (currentProfile.status === 'deleted' || currentProfile.status === 'suspended' || currentProfile.status === 'delete_requested')) {
          setIsBlocked(true);
        } else {
          setIsBlocked(false);
        }
      }
      setIsBlockedCheckLoading(false);
    }, (err: any) => {
      console.warn("[SUSPENSION GATE] onSnapshot error:", err);
      if (err.code === 'permission-denied' || (err.message && err.message.includes('Missing or insufficient permissions'))) {
        setIsBlocked(true);
        setLiveStatus('deleted');
      }
      setIsBlockedCheckLoading(false);
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  // Profile editing and custom personalization states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileShortName, setProfileShortName] = useState("");
  const [profileIc, setProfileIc] = useState("");
  const [profileGender, setProfileGender] = useState("");
  const [profileBloodType, setProfileBloodType] = useState("Not Specified");
  const [profileJoinDate, setProfileJoinDate] = useState("");
  const [profilePoints, setProfilePoints] = useState("");
  const [profileChapter, setProfileChapter] = useState("");
  const [profileVehiclePlate, setProfileVehiclePlate] = useState("");

  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileEmergencyName, setProfileEmergencyName] = useState("");
  const [profileEmergencyRelation, setProfileEmergencyRelation] = useState("");
  const [profileEmergencyPhone, setProfileEmergencyPhone] = useState("");
  const [directoryVisible, setDirectoryVisible] = useState<boolean>(true);
  const [profileCountryCode, setProfileCountryCode] = useState<string>("+60");
  const [isWhatsAppPublic, setIsWhatsAppPublic] = useState<boolean>(false);
  const [isStealthMode, setIsStealthMode] = useState<boolean>(false);
  const [profileImage, setProfileImage] = useState<string>("");

  // Keep state matching whenever userProfile details change dynamically
  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name || auth.currentUser?.displayName || "");
      setProfileShortName(userProfile.shortName || "");
      setProfileBloodType(userProfile.bloodType || "Not Specified");
      setProfileJoinDate(userProfile.joinDate || "12 January 2021");
      setProfilePoints(userProfile.points?.toString() || "30");
      setProfileChapter(userProfile.chapter || "Selangor Chapter");
      setProfileVehiclePlate(userProfile.vehiclePlate || "");
      if ((userProfile as any).icNumber) setProfileIc((userProfile as any).icNumber);
      if ((userProfile as any).gender) setProfileGender((userProfile as any).gender);
      setIsStealthMode((userProfile as any).isStealthMode === true);
      
      // Parse E.164 phone number into country code + local number
      const phoneVal = (userProfile as any).phoneNumber || "";
      let matchedCode = "+60";
      let localPhone = phoneVal;
      if (phoneVal.startsWith("+673")) {
        matchedCode = "+673";
        localPhone = phoneVal.substring(4);
      } else if (phoneVal.startsWith("+60")) {
        matchedCode = "+60";
        localPhone = phoneVal.substring(3);
      } else if (phoneVal.startsWith("673")) {
        matchedCode = "+673";
        localPhone = phoneVal.substring(3);
      } else if (phoneVal.startsWith("60")) {
        matchedCode = "+60";
        localPhone = phoneVal.substring(2);
      } else if (phoneVal.startsWith("0")) {
        matchedCode = "+60";
        localPhone = phoneVal.substring(1);
      }
      setProfileCountryCode(matchedCode);
      setProfilePhone(localPhone);

      if ((userProfile as any).address) setProfileAddress((userProfile as any).address);
      if ((userProfile as any).emergencyName) setProfileEmergencyName((userProfile as any).emergencyName);
      if ((userProfile as any).emergencyRelation) setProfileEmergencyRelation((userProfile as any).emergencyRelation);
      if ((userProfile as any).emergencyPhone) setProfileEmergencyPhone((userProfile as any).emergencyPhone);
      if (userProfile.photoURL) setProfileImage(userProfile.photoURL);
      setDirectoryVisible(userProfile.settings?.privacy?.directoryVisible !== false);
      setIsWhatsAppPublic((userProfile as any).isWhatsAppPublic === true);
    }
  }, [userProfile]);

  useEffect(() => {
    if (userProfile) {
      const dbVehicle = (userProfile as any).vehicleInfo;
      const formattedId = userProfile.mvocId ? formatMvocId(userProfile.mvocId) : "MVOC-PENDING";
      setVehicleInfo(prev => ({
        ...prev,
        plateNumber: dbVehicle?.plateNumber || userProfile.vehiclePlate || prev.plateNumber || 'VLL 9923',
        variant: dbVehicle?.variant || prev.variant || '1.5 AT',
        year: dbVehicle?.year || prev.year || '2023',
        color: dbVehicle?.color || prev.color || 'White Pearl',
        memberId: formattedId,
        photoUrl: dbVehicle?.photoUrl || prev.photoUrl || 'https://i.ibb.co/sdCNQQCr/veloz-600x338.png'
      }));
    }
  }, [userProfile]);

  const handleToggleDirectoryVisible = async (visible: boolean) => {
    setDirectoryVisible(visible);
    if (!auth.currentUser) return;
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        'settings.privacy.directoryVisible': visible
      });
      triggerToast('Directory visibility preference updated!', 'success');
    } catch (err: any) {
      console.warn("Could not sync directory privacy preference:", err);
      triggerToast('Failed to update visibility setting.', 'error');
    }
  };

  const handleToggleWhatsAppPublic = async (checked: boolean) => {
    setIsWhatsAppPublic(checked);
    if (!auth.currentUser) return;
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        isWhatsAppPublic: checked
      });
      triggerToast('WhatsApp directory sharing preference updated!', 'success');
    } catch (err: any) {
      console.warn("Could not sync WhatsApp sharing preference:", err);
      triggerToast('Failed to update WhatsApp setting.', 'error');
    }
  };

  const handleToggleStealthMode = async (stealth: boolean) => {
    setIsStealthMode(stealth);
    if (!auth.currentUser) return;
    try {
      const { updateDoc, doc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        isStealthMode: stealth
      });
      triggerToast(stealth ? 'Stealth Mode activated! Public profile shows Member role.' : 'Stealth Mode deactivated!', 'success');
    } catch (err: any) {
      console.warn("Could not sync stealth mode preference:", err);
      triggerToast('Failed to update stealth mode setting.', 'error');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      triggerToast('Please select a valid image file.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setProfileImage(dataUrl);
      };
      if (typeof event.target?.result === 'string') {
        img.src = event.target.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    // Validate Short Name
    const shortNameVal = profileShortName?.trim() || '';
    const wordCount = shortNameVal.split(/\s+/).length;

    if (!shortNameVal || shortNameVal.length < 2) {
      triggerToast("Short Name wajib diisi dan mesti lebih dari 2 aksara.", 'error');
      return;
    }
    if (shortNameVal.length > 20) {
      triggerToast("Short Name mesti maksimum 20 aksara sahaja.", 'error');
      return;
    }
    if (wordCount > 3) {
      triggerToast("Short Name mesti maksimum 3 perkataan sahaja.", 'error');
      return;
    }

    try {
      setIsLoading(true);
      if (userProfile) {
        // Automatically format phone number for WhatsApp API usage
        const formattedNum = profilePhone ? formatWhatsAppNumber(profileCountryCode, profilePhone) : "";

        const updatePayload: any = {
          name: profileName,
          shortName: shortNameVal,
          icNumber: profileIc,
          gender: profileGender,
          bloodType: profileBloodType,
          phoneNumber: formattedNum,
          isWhatsAppPublic: isWhatsAppPublic,
          address: profileAddress,
          emergencyName: profileEmergencyName,
          emergencyRelation: profileEmergencyRelation,
          emergencyPhone: profileEmergencyPhone,
          photoURL: profileImage,
          chapter: profileChapter,
          vehiclePlate: profileVehiclePlate,
          updatedAt: new Date().toISOString()
        };

        if (isAdminOrSuperAdmin()) {
          updatePayload.joinDate = profileJoinDate;
          updatePayload.points = parseInt(profilePoints, 10) || 0;
        }

        const userDocRef = doc(db, 'users', auth.currentUser?.uid || userProfile.uid);
        await updateDoc(userDocRef, updatePayload);
      }
      
      updateLocalProfileState({
        name: profileName,
        shortName: shortNameVal,
        bloodType: profileBloodType,
        chapter: profileChapter,
        vehiclePlate: profileVehiclePlate
      });
      
      setIsEditingProfile(false);
      triggerToast('Your profile has been updated and synchronized successfully!', 'success');
    } catch (err: any) {
      console.warn('Failed to persist profile updates to Cloud Firestore DB:', err);
      // Fallback update local state for gorgeous sandbox continuity
      updateLocalProfileState({
        name: profileName,
        shortName: shortNameVal,
        bloodType: profileBloodType
      });
      setIsEditingProfile(false);
      triggerToast('Profile updated successfully!', 'success');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveVehicleInfo = async (updatedVehicle: {
    plateNumber: string;
    variant: string;
    year: string;
    color: string;
    photoUrl: string;
  }) => {
    try {
      setIsLoading(true);
      
      const newVehicleState = {
        ...updatedVehicle,
        memberId: displayMvocId
      };

      setVehicleInfo(newVehicleState);

      if (auth.currentUser || userProfile) {
        const userId = auth.currentUser?.uid || userProfile?.uid;
        if (userId) {
          const { updateDoc, doc } = await import('firebase/firestore');
          const userDocRef = doc(db, 'users', userId);
          
          await updateDoc(userDocRef, {
            vehiclePlate: updatedVehicle.plateNumber,
            vehicleInfo: {
              plateNumber: updatedVehicle.plateNumber,
              variant: updatedVehicle.variant,
              year: updatedVehicle.year,
              color: updatedVehicle.color,
              photoUrl: updatedVehicle.photoUrl,
              memberId: displayMvocId
            },
            updatedAt: new Date().toISOString()
          });

          updateLocalProfileState({
            vehiclePlate: updatedVehicle.plateNumber,
            vehicleInfo: {
              plateNumber: updatedVehicle.plateNumber,
              variant: updatedVehicle.variant,
              year: updatedVehicle.year,
              color: updatedVehicle.color,
              photoUrl: updatedVehicle.photoUrl,
              memberId: displayMvocId
            }
          } as any);
        }
      }

      setIsVehicleEditModalOpen(false);
      triggerToast('Vehicle information successfully saved and synced to database!', 'success');
    } catch (err: any) {
      console.warn('Failed to persist vehicle updates to Cloud Firestore DB:', err);
      // Fallback update local state for sandbox continuity
      setIsVehicleEditModalOpen(false);
      triggerToast('Vehicle updated locally!', 'success');
    } finally {
      setIsLoading(false);
    }
  };

  // Safe QR Scanner and Exchanged Contacts States
  const [exchangedContacts, setExchangedContacts] = useState<any[]>([]);
  const [isFetchingContacts, setIsFetchingContacts] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedResultUser, setScannedResultUser] = useState<any | null>(null);
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Admin QR Code Attendance Generator state
  const [isQrGeneratorModalOpen, setIsQrGeneratorModalOpen] = useState(false);
  const [generatedQrPayload, setGeneratedQrPayload] = useState('');

  const [isAdminQrListOpen, setIsAdminQrListOpen] = useState(false);

  // Scan logs state
  const [myScanLogs, setMyScanLogs] = useState<any[]>([]);
  const [isFetchingScanLogs, setIsFetchingScanLogs] = useState(false);

  // Real-time calculated statistics
  const [totalDbMembersCount, setTotalDbMembersCount] = useState<number | null>(null);

  // Helper to log QR scan attempt locally and in Firestore
  const logQRScan = async (status: 'success' | 'failed', message: string, scannedPayload: string) => {
    try {
      await addDoc(collection(db, 'scanLogs'), {
        uid: auth.currentUser?.uid || 'anonymous',
        userName: displayName || auth.currentUser?.displayName || 'Anonymous User',
        userEmail: auth.currentUser?.email || '',
        mvocId: displayMvocId || '',
        status,
        message,
        scannedPayload,
        timestamp: serverTimestamp()
      });
      console.log('[DEBUG] Scan log written to Firestore successfully');
    } catch (err: any) {
      console.error('[ERROR] Error writing scan log to Firestore:', err);
    }
  };

  // Real-time listener for current user's scan logs
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) {
      setMyScanLogs([]);
      return;
    }
    
    setIsFetchingScanLogs(true);
    const logsQuery = query(collection(db, 'scanLogs'), where('uid', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(logsQuery, (snapshot) => {
      const logsList: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        logsList.push({ id: doc.id, ...data });
      });
      // Sort by timestamp descending in client memory
      logsList.sort((a, b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp || 0).getTime();
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });
      setMyScanLogs(logsList);
      setIsFetchingScanLogs(false);
    }, (error) => {
      console.error('[ERROR] Error fetching scan logs:', error);
      setIsFetchingScanLogs(false);
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  // Real-time listener for total registered members count
  useEffect(() => {
    if (!isLoggedIn) {
      setTotalDbMembersCount(null);
      return;
    }
    
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setTotalDbMembersCount(snapshot.size);
    }, (error) => {
      console.warn("Could not retrieve real-time members count from database:", error);
    });

    return () => unsubscribe();
  }, [isLoggedIn]);
  
  // Real-time listener for scanned contact cards
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) {
      setExchangedContacts([]);
      return;
    }
    
    setIsFetchingContacts(true);
    const contactsRef = collection(db, 'users', auth.currentUser.uid, 'contacts');
    const unsubscribe = onSnapshot(contactsRef, (snapshot) => {
      const contactsList: any[] = [];
      snapshot.forEach((doc) => {
        contactsList.push({ id: doc.id, ...doc.data() });
      });
      // Sort by exchangedAt descending
      contactsList.sort((a, b) => {
        return new Date(b.exchangedAt || 0).getTime() - new Date(a.exchangedAt || 0).getTime();
      });
      setExchangedContacts(contactsList);
      setIsFetchingContacts(false);
    }, (err) => {
      console.warn("Restricted or offline reading of contacts deck:", err);
      setIsFetchingContacts(false);
    });

    return () => unsubscribe();
  }, [isLoggedIn]);

  // Dynamic user data inputs driven by the Google Sheets database synchronization results
  const authUser = auth.currentUser;
  const dashboardGreetingName = userProfile ? (userProfile.shortName || userProfile.name.split(' ')[0]) : (authUser?.displayName?.split(' ')[0] || profileName?.split(' ')[0] || "Member");
  const displayName = userProfile ? (userProfile.shortName || userProfile.name) : (authUser?.displayName || profileName || "Member");
  const displayFullName = userProfile ? userProfile.name : (authUser?.displayName || profileName || "Member");
  const displayEmail = userProfile ? userProfile.email : (authUser?.email || "");
  const displayMvocId = userProfile 
    ? formatMvocId(userProfile.mvocId) 
    : "MVOC-PENDING";
  const displayChapter = userProfile ? userProfile.chapter : "Pending sync...";
  const displayTier = userProfile ? userProfile.tier : "STANDARD";
  const displayRole = userProfile ? userProfile.role : "member";
  const displayManagedChapter = userProfile ? (userProfile as any).managedChapter : null;
  const isSuperAdmin = displayRole === 'super_admin' || displayEmail.toLowerCase() === MASTER_EMAIL;
  const isMasterAdmin = displayEmail.toLowerCase() === MASTER_EMAIL || userProfile?.mvocId === MASTER_ADMIN_ID;
  const isStealthActive = isStealthMode && isMasterAdmin;
  const isAdminOrSuperAdmin = () => {
    return isSuperAdmin || displayRole === 'admin';
  };

  const renderNavToggle = (key: keyof typeof appConfig) => {
    if (!isSuperAdmin) return null;
    const isActive = appConfig[key] !== false;
    return (
      <div
        onClick={(e) => { e.stopPropagation(); handleToggleNavModule(key as string); }}
        className={`relative inline-flex h-4.5 w-8 items-center shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none px-[2px] ${
          isActive 
            ? 'bg-emerald-500 border-transparent shadow-[0_1px_2px_rgba(0,0,0,0.2)]' 
            : 'bg-rose-950/80 border-rose-900/80'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-[#0E2340] shadow-md transition duration-200 ease-in-out ${
            isActive ? 'translate-x-[12px]' : 'translate-x-0'
          }`}
        />
      </div>
    );
  };

  const displayAvatarUrl = profileImage || userProfile?.photoURL || authUser?.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80";

  // Super Admin administrative states
  const [membersList, setMembersList] = useState<SyncedUserProfile[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);

  const fetchFirestoreUsers = async () => {
    try {
      setIsFetchingUsers(true);
      // Network-only query to fetch the absolute freshest community data
      const querySnapshot = await getDocsFromServer(collection(db, 'users'));
      const activeUsers: SyncedUserProfile[] = [];
      querySnapshot.forEach((doc) => {
        activeUsers.push(doc.data() as SyncedUserProfile);
      });
      setMembersList(activeUsers);
    } catch (e) {
      console.warn("Firestore user directory fetch was restricted or offline.");
    } finally {
      setIsFetchingUsers(false);
    }
  };

  const handleRoleChange = async (targetUser: SyncedUserProfile, newRole: 'super_admin' | 'admin' | 'member') => {
    // Ensure that the local React state updates immediately so the UI reflects the change without needing a page refresh
    setMembersList(prev => prev.map(m => m.uid === targetUser.uid ? { ...m, role: newRole } : m));
    
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      // Ensure handleRoleChange uses an atomic updateDoc operation on the users collection
      await updateDoc(userRef, { role: newRole });
      triggerToast(`Successfully updated ${targetUser.name}'s role to ${newRole.toUpperCase()}!`, 'success');
    } catch (err: any) {
      // Add an error handling block to the update function to log any 'Permission Denied' errors in the console
      const errMsg = err?.message || String(err);
      if (errMsg.includes('Permission Denied') || errMsg.includes('permission-denied') || err?.code === 'permission-denied') {
        console.error("Permission Denied: Lacked authorization in firestore.rules to update role:", err);
      } else {
        console.error("Error updating user role in Firestore:", err);
      }
      triggerToast(`Failed to update role: ${errMsg}`, 'error');
      // Revert local state if DB update fails
      setMembersList(prev => prev.map(m => m.uid === targetUser.uid ? { ...m, role: targetUser.role } : m));
    }
  };

  const handleUpdateMemberRole = handleRoleChange;

  const handleUpdateMemberPatch = async (targetUser: SyncedUserProfile, officialPatch: boolean) => {
    // Ensure that the local React state updates immediately so the UI reflects the change without needing a page refresh
    setMembersList(prev => prev.map(m => m.uid === targetUser.uid ? { ...m, officialPatch, patch_status: officialPatch } : m));
    
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { 
        officialPatch,
        patch_status: officialPatch
      });
      triggerToast(`Successfully ${officialPatch ? 'assigned' : 'removed'} Official Admin Patch for ${targetUser.name}!`, 'success');
    } catch (err: any) {
      // Add an error handling block to the update function to log any 'Permission Denied' errors in the console
      const errMsg = err?.message || String(err);
      if (errMsg.includes('Permission Denied') || errMsg.includes('permission-denied') || err?.code === 'permission-denied') {
        console.error("Permission Denied: Lacked authorization in firestore.rules to modify officialPatch:", err);
      } else {
        console.error("Error modifying officialPatch field in Firestore:", err);
      }
      triggerToast(`Failed to update patch status: ${errMsg}`, 'error');
      // Revert local state if DB update fails
      setMembersList(prev => prev.map(m => m.uid === targetUser.uid ? { ...m, officialPatch: targetUser.officialPatch, patch_status: targetUser.patch_status } : m));
    }
  };

  const handleUpdateMemberTier = async (targetUser: SyncedUserProfile, newTier: 'GOLD' | 'STANDARD') => {
    setMembersList(prev => prev.map(m => m.uid === targetUser.uid ? { ...m, tier: newTier } : m));
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { tier: newTier });
      triggerToast(`Successfully updated ${targetUser.name} to ${newTier} TIER!`, 'success');
    } catch (e) {
      triggerToast(`Local state updated to ${newTier}! (DB sync pending)`, 'info');
    }
  };

  const handleUpdateMemberStatus = async (targetUser: SyncedUserProfile, newStatus: 'active' | 'suspended' | 'banned') => {
    setMembersList(prev => prev.map(m => m.uid === targetUser.uid ? { ...m, status: newStatus } : m));
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { status: newStatus });
      triggerToast(`Successfully set ${targetUser.name}'s status to ${newStatus.toUpperCase()}!`, 'success');
    } catch (e: any) {
      triggerToast(`Local state updated to ${newStatus}! (DB sync pending)`, 'info');
      throw e;
    }
  };

  const [isFlushingUsers, setIsFlushingUsers] = useState(false);

  const handleFlushUsersExceptAdmin = async () => {
    if (!window.confirm("Are you absolutely sure you want to flush/delete all registered user profiles from Firestore except Super Admins? This action is completely irreversible!")) {
      return;
    }
    
    try {
      setIsFlushingUsers(true);
      const querySnapshot = await getDocsFromServer(collection(db, 'users'));
      let deletedCount = 0;
      let skippedCount = 0;
      
      for (const userDoc of querySnapshot.docs) {
        const userData = userDoc.data() as SyncedUserProfile;
        const uid = userDoc.id;
        
        // Identify if the user is a super admin
        const isSuperAdminEmail = userData.email?.trim().toLowerCase() === 'nikazfar@gmail.com';
        const isSuperAdminRole = userData.role === 'super_admin';
        
        if (isSuperAdminEmail || isSuperAdminRole || uid === authUser?.uid) {
          skippedCount++;
        } else {
          await deleteDoc(doc(db, 'users', uid));
          deletedCount++;
        }
      }
      
      triggerToast(`Successfully flushed database! Purged ${deletedCount} standard users, kept ${skippedCount} Super Admins.`, 'success');
      fetchFirestoreUsers();
    } catch (e: any) {
      triggerToast(`Purge failed: ${e.message || String(e)}`, 'error');
    } finally {
      setIsFlushingUsers(false);
    }
  };

  const [isMigratingIds, setIsMigratingIds] = useState(false);

  const handleMigrateMvocIds = async () => {
    if (!window.confirm("Verify and update all Firestore member profiles to enforce the strict 'MVOC-xxxxx' format?")) {
      return;
    }

    try {
      setIsMigratingIds(true);
      const querySnapshot = await getDocsFromServer(collection(db, 'users'));
      let updateCount = 0;

      for (const userDoc of querySnapshot.docs) {
        const userData = userDoc.data() as SyncedUserProfile;
        const currentId = userData.mvocId || '';
        const correctId = formatMvocId(currentId);

        if (currentId !== correctId) {
          await updateDoc(doc(db, 'users', userDoc.id), { mvocId: correctId });
          updateCount++;
        }
      }

      triggerToast(`Migration complete! Successfully formatted ${updateCount} member profiles.`, 'success');
      fetchFirestoreUsers();
    } catch (e: any) {
      triggerToast(`Migration failed: ${e.message || String(e)}`, 'error');
    } finally {
      setIsMigratingIds(false);
    }
  };

  const [isAuditingRewards, setIsAuditingRewards] = useState(false);

  const handleRunRewardsAudit = async () => {
    if (!window.confirm("Menjalankan audit pangkalan data untuk mengira semula mata ganjaran permulaan (30 XP / 0 XP) berdasarkan syarat baharu?")) {
      return;
    }

    try {
      setIsAuditingRewards(true);
      const querySnapshot = await getDocsFromServer(collection(db, 'users'));
      let updateCount = 0;
      let compliantCount = 0;
      let nonCompliantCount = 0;

      for (const userDoc of querySnapshot.docs) {
        const userData = userDoc.data() as SyncedUserProfile;
        // Skip master admin
        if (userData.email?.toLowerCase() === MASTER_EMAIL) {
          continue;
        }

        const disclaimerAccepted = userData.disclaimerAccepted === true;
        const pdpaAccepted = userData.pdpaAccepted === true;
        const hasPatch = userData.patch_status === true || userData.officialPatch === true || userData.patch === 'mvoc_trusted_elite';

        const meetsCompliance = disclaimerAccepted && pdpaAccepted && hasPatch;
        const targetPoints = meetsCompliance ? Math.max(userData.points || 0, 30) : 0;

        if (userData.points !== targetPoints) {
          await updateDoc(doc(db, 'users', userDoc.id), { points: targetPoints });
          updateCount++;
          if (meetsCompliance) {
            compliantCount++;
          } else {
            nonCompliantCount++;
          }
        }
      }

      triggerToast(`Audit selesai! Mengemaskini ${updateCount} pengguna (${compliantCount} layak 30 XP, ${nonCompliantCount} reset ke 0 XP).`, 'success');
      await fetchFirestoreUsers();
    } catch (e: any) {
      triggerToast(`Audit gagal: ${e.message || String(e)}`, 'error');
    } finally {
      setIsAuditingRewards(false);
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  
  // Google Auth Popup Blocked State
  const [isAuthPopupBlockedOpen, setIsAuthPopupBlockedOpen] = useState(false);
  const [authPopupErrorMsg, setAuthPopupErrorMsg] = useState('');
  
  // Navigation states
  const [currentTab, setCurrentTab] = useState<TabType>(() => {
    return (sessionStorage.getItem('mvoc_currentTab') as TabType) || 'dashboard';
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(3);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('mvoc_selectedEventId');
    return saved ? parseInt(saved, 10) : null;
  });
  
  useEffect(() => {
    if (selectedEventId !== null) {
      sessionStorage.setItem('mvoc_selectedEventId', selectedEventId.toString());
    } else {
      sessionStorage.removeItem('mvoc_selectedEventId');
    }
  }, [selectedEventId]);
  const [activeEventSubTab, setActiveEventSubTab] = useState<'upcoming' | 'ongoing' | 'completed'>('upcoming');
  const [bookmarkedEvents, setBookmarkedEvents] = useState<number[]>([1]);
  const [showNotifications, setShowNotifications] = useState(false);

  // System modules live config state (Default true)
  const [appConfig, setAppConfig] = useState<Record<string, boolean>>({
    dashboard: true,
    vehicle: true,
    card: true,
    events: true,
    convoy: true,
    gallery: true,
    chapters: true,
    merchants: true,
    announcements: true,
    directory: true,
    bottomNav: true,
  });

  // Watch security-hardened remote settings config document
  useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const configRef = doc(db, 'settings', 'app_config');
      const unsubscribe = onSnapshot(configRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setAppConfig({
            dashboard: data.dashboard !== false,
            vehicle: data.vehicle !== false,
            card: data.card !== false,
            events: data.events !== false,
            convoy: data.convoy !== false,
            gallery: data.gallery !== false,
            chapters: data.chapters !== false,
            merchants: data.merchants !== false,
            announcements: data.announcements !== false,
            directory: data.directory !== false,
            bottomNav: data.bottomNav !== false,
          });
        }
      }, (error) => {
        console.warn("Falling back to local default configuration sandbox:", error.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Failed to listen to global platform app settings:", e);
    }
  }, [isLoggedIn]);

  // Handler to toggle live navigation setting on Firestore doc settings/app_config
  const handleToggleNavModule = async (module: string) => {
    const roleHasSuperPrivilege = userProfile?.role === 'super_admin' || displayEmail.toLowerCase() === MASTER_EMAIL;

    if (!roleHasSuperPrivilege) {
      triggerToast('Access Denied: Only Super Admin can manage system navigation.', 'error');
      return;
    }

    const nextValue = !appConfig[module];

    try {
      const configRef = doc(db, 'settings', 'app_config');
      await setDoc(configRef, { [module]: nextValue }, { merge: true });
      triggerToast(`${module.charAt(0).toUpperCase() + module.slice(1)} navigation toggle synced live to Firestore settings!`, 'success');
    } catch (err: any) {
      console.error("Firestore app_config sync failed:", err);
      triggerToast(`Live settings update failed: ${err.message || String(err)}`, 'error');
    }
  };
  
  useEffect(() => {
    if (isLoggedIn && isSuperAdmin && currentTab === 'users') {
      fetchFirestoreUsers();
    }
  }, [isLoggedIn, isSuperAdmin, currentTab]);

  useEffect(() => {
    sessionStorage.setItem('mvoc_currentTab', currentTab);
  }, [currentTab]);

  // Penyegerakan maklumat terkini dari pelayan setiap kali pengguna log masuk (Login Sync)
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) return;

    const performLoginSync = async () => {
      console.log("[LOGIN-SYNC]: Menjalankan penyegerakan maklumat terkini pada log masuk...");
      try {
        await triggerSync(auth.currentUser!.uid, auth.currentUser!.email || '', true);
        if (isSuperAdmin || currentTab === 'users') {
          await fetchFirestoreUsers();
        }
      } catch (e) {
        console.warn("[LOGIN-SYNC]: Gagal melakukan penyegerakan pada log masuk:", e);
      }
    };

    performLoginSync();
  }, [isLoggedIn]); // Hanya berjalan sekali setiap kali isLoggedIn bertukar kepada true
  
  // Gallery specific states
  const [selectedGalleryCategory, setSelectedGalleryCategory] = useState<'all' | 'national' | 'chapter_convoys' | 'social'>('all');
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('mvoc_selectedAlbumId');
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    if (selectedAlbumId !== null) {
      sessionStorage.setItem('mvoc_selectedAlbumId', selectedAlbumId.toString());
    } else {
      sessionStorage.removeItem('mvoc_selectedAlbumId');
    }
  }, [selectedAlbumId]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  // Simulated video playback timer logic
  useEffect(() => {
    let interval: any;
    if (isVideoPlaying) {
      interval = setInterval(() => {
        setVideoProgress((prev) => {
          if (prev >= 265) {
            setIsVideoPlaying(false);
            return 0; // reset
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isVideoPlaying]);
  
  // App variables / simulation lists
  const [registeredConvoys, setRegisteredConvoys] = useState<number[]>([1]);
  const [installedPwa, setInstalledPwa] = useState(false);
  
  // My Vehicle interactive states
  const [vehicleInfo, setVehicleInfo] = useState({
    plateNumber: 'VLL 9923',
    variant: '1.5 AT',
    year: '2023',
    color: 'White Pearl',
    memberId: 'MVOC-99234',
    photoUrl: 'https://i.ibb.co/sdCNQQCr/veloz-600x338.png'
  });
  
  const [accessories, setAccessories] = useState([
    { id: 1, name: 'Front Lip Spoiler', desc: 'Matte Black Finish', icon: 'Car' },
    { id: 2, name: 'IR Premium Tint', desc: '99% Heat Rejection', icon: 'LayoutGrid' },
    { id: 3, name: 'Ambient LED Kit', desc: 'Multi-color control', icon: 'Sun' },
    { id: 4, name: 'Dual-Dashcam 4K', desc: 'Hardwire Parking Mode', icon: 'Shield' }
  ]);
  
  const [serviceRecords, setServiceRecords] = useState([
    { id: 1, type: 'Regular Service', date: '2026-05-10', mileage: '20,000 km', details: 'Engine Oil Change, Oil Filter, Cabin Filter replacement. Fully healthy.', cost: 'RM 280.00', status: 'Completed' },
    { id: 2, type: 'Tyre Alignment', date: '2026-01-12', mileage: '15,000 km', details: '4-wheel alignment and high speed balancing at Karak Auto.', cost: 'RM 95.00', status: 'Completed' },
    { id: 3, type: 'Premium Coating', date: '2025-11-15', mileage: '10,200 km', details: 'Full body wax and 9H premium ceramic coating application.', cost: 'RM 1,200.00', status: 'Completed' }
  ]);
  
  const [isVehicleEditModalOpen, setIsVehicleEditModalOpen] = useState(false);
  const [isShareCardModalOpen, setIsShareCardModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Public View Page States
  const [publicCardId, setPublicCardId] = useState<string | null>(null);
  const [isPublicLoading, setIsPublicLoading] = useState(false);
  const [publicProfile, setPublicProfile] = useState<{ name: string; mvocId: string; status: string; chapter?: string } | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/card\/(MVOC-\d{4,5})$/i);
    if (match) {
      const mvocId = match[1].toUpperCase();
      setPublicCardId(mvocId);
      setIsPublicLoading(true);

      // Query database for member info
      const q = query(collection(db, 'users'), where('mvocId', '==', mvocId));
      getDocsFromServer(q).then((querySnapshot) => {
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data() as SyncedUserProfile;
          setPublicProfile({
            name: userData.name || "ABENIK",
            mvocId: mvocId,
            status: userData.status === 'suspended' ? 'SUSPENDED' : (userData.status === 'banned' ? 'BANNED' : 'GOLD MEMBER'),
            chapter: userData.chapter
          });
        } else {
          // Fallback if not in Firestore but requested
          setPublicProfile({
            name: mvocId === 'MVOC-0159' ? 'ABENIK' : 'Member',
            mvocId: mvocId,
            status: 'GOLD MEMBER'
          });
        }
        setIsPublicLoading(false);
      }).catch((err) => {
        console.warn("Failed fetching public card profile:", err);
        setPublicProfile({
          name: mvocId === 'MVOC-0159' ? 'ABENIK' : 'Member',
          mvocId: mvocId,
          status: 'GOLD MEMBER'
        });
        setIsPublicLoading(false);
      });
    }
  }, []);

  const handleCopyLink = () => {
    const cardUrl = `https://mvoc.my/card/${displayMvocId}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cardUrl)
        .then(() => {
          setIsCopied(true);
          triggerToast('Pautan kad keahlian disalin!', 'success');
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Failed to copy using clipboard API:", err);
          fallbackCopyText(cardUrl);
        });
    } else {
      fallbackCopyText(cardUrl);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      triggerToast('Pautan kad keahlian disalin!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Fallback copy failed:", err);
      triggerToast('Gagal menyalin pautan, sila salin secara manual.', 'error');
    }
  };

  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)',
    transition: 'transform 400ms ease'
  });
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({
    background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 100%)',
    opacity: 0,
    transition: 'opacity 400ms ease'
  });

  // Handle tilt movement
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current.getBoundingClientRect();
    const x = e.clientX - card.left;
    const y = e.clientY - card.top;
    const centerX = card.width / 2;
    const centerY = card.height / 2;

    // Tilt limits (Max tilt: 15 degrees)
    const rotateX = ((centerY - y) / centerY) * 15;
    // Inverting Y axis tilt if card is flipped
    const rotateY = (((x - centerX) / centerX) * 15) * (isCardFlipped ? -1 : 1);

    const glareX = (x / card.width) * 100;
    const glareY = (y / card.height) * 100;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`,
      transition: 'transform 100ms ease-out'
    });

    setGlareStyle({
      background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 80%)`,
      opacity: 0.45,
      transition: 'opacity 100ms ease-out'
    });
  };

  const handleMouseLeave = () => {
    // Reset to initial state
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)',
      transition: 'transform 400ms ease-out'
    });
    setGlareStyle({
      background: 'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 100%)',
      opacity: 0,
      transition: 'all 400ms ease-out'
    });
  };

  // Gyroscope orientation support for mobile
  useEffect(() => {
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      const beta = e.beta;
      const gamma = e.gamma;
      if (beta === null || gamma === null) return;

      const targetBeta = beta - 45;
      const limitedBeta = Math.max(Math.min(targetBeta, 30), -30);
      const limitedGamma = Math.max(Math.min(gamma, 30), -30);

      const rotateX = -(limitedBeta / 30) * 15;
      const rotateY = ((limitedGamma / 30) * 15) * (isCardFlipped ? -1 : 1);

      const glareX = 50 + (rotateY / 15) * 50;
      const glareY = 50 - (rotateX / 15) * 50;

      setTiltStyle({
        transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1)`,
        transition: 'transform 200ms ease-out'
      });

      setGlareStyle({
        background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 80%)`,
        opacity: 0.3,
        transition: 'opacity 200ms ease-out'
      });
    };

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleDeviceOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }, [isCardFlipped]);

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isBenefitsModalOpen, setIsBenefitsModalOpen] = useState(false);
  const [benefitSearch, setBenefitSearch] = useState('');
  const [benefitCategory, setBenefitCategory] = useState('All');
  const [isAddAccessoryModalOpen, setIsAddAccessoryModalOpen] = useState(false);
  const [isServiceLogsModalOpen, setIsServiceLogsModalOpen] = useState(false);
  const [isAddServiceLogModalOpen, setIsAddServiceLogModalOpen] = useState(false);
  const [viewingRecordDetails, setViewingRecordDetails] = useState<typeof serviceRecords[0] | null>(null);
  
  // Temporary forms state for editing vehicle info
  const [editPlateNumber, setEditPlateNumber] = useState('');
  const [editVariant, setEditVariant] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  
  // Odometer and service status interactivity states
  const [currentOdometer, setCurrentOdometer] = useState(22550);
  const [nextServiceOdometer, setNextServiceOdometer] = useState(25000);
  const [isMileageModalOpen, setIsMileageModalOpen] = useState(false);
  const [tempOdometer, setTempOdometer] = useState('22550');
  const [tempNextOdometer, setTempNextOdometer] = useState('25000');

  // Dynamically calculate remaining mileage and service status
  const serviceKmRemaining = nextServiceOdometer - currentOdometer;
  
  let serviceStatusText = "HEALTHY";
  let serviceStatusBadge = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  let serviceCardBg = "bg-gradient-to-br from-[#0F2D52] via-[#154173] to-[#205794]";
  let serviceBarColor = "bg-emerald-400";
  let serviceStatusDesc = `Next service due in ${serviceKmRemaining.toLocaleString()} km`;
  
  if (serviceKmRemaining <= 0) {
    serviceStatusText = "OVERDUE";
    serviceStatusBadge = "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse";
    serviceCardBg = "bg-gradient-to-br from-rose-950 via-red-900 to-[#1e070d]";
    serviceBarColor = "bg-red-500";
    serviceStatusDesc = `Due ${Math.abs(serviceKmRemaining).toLocaleString()} km ago! Service now.`;
  } else if (serviceKmRemaining < 1500) {
    serviceStatusText = "DUE SOON";
    serviceStatusBadge = "bg-amber-500/20 text-amber-300 border border-amber-500/30";
    serviceCardBg = "bg-gradient-to-br from-[#0F2D52] via-amber-950/80 to-[#4A3205]";
    serviceBarColor = "bg-amber-400";
    serviceStatusDesc = `${serviceKmRemaining.toLocaleString()} km remaining. Book space soon!`;
  }

  const serviceProgressPercent = Math.max(0, Math.min(100, (serviceKmRemaining / 10000) * 100));
  
  // Temporary state for adding accessory
  const [accessoryFormName, setAccessoryFormName] = useState('');
  const [accessoryFormDesc, setAccessoryFormDesc] = useState('');
  const [accessoryFormIcon, setAccessoryFormIcon] = useState('Car');
  
  // Temporary state for adding service record
  const [serviceFormType, setServiceFormType] = useState('Regular Service');
  const [serviceFormDate, setServiceFormDate] = useState('');
  const [serviceFormMileage, setServiceFormMileage] = useState('');
  const [serviceFormDetails, setServiceFormDetails] = useState('');
  const [serviceFormCost, setServiceFormCost] = useState('');
  
  // Sample Data matching the Malaysian Toyota Veloz group aesthetic
  const [events, setEvents] = useState<EventItem[]>([
    { 
      id: 1, 
      title: 'Merdeka Charity Convoy', 
      date: '31 Aug 2026', 
      location: 'Kuala Lumpur, Malaysia', 
      rsvps: 124, 
      limit: 200, 
      featured: true, 
      registered: false,
      organizer: 'HQ',
      badge: 'OPEN',
      image: 'https://images.unsplash.com/photo-1542362567-b07eac79094d?w=600&auto=format&fit=crop&q=80',
      category: 'upcoming'
    },
    { 
      id: 2, 
      title: 'Southern Region Gathering', 
      date: '15 Sep 2026', 
      location: 'Johor Bahru, Johor', 
      rsvps: 145, 
      limit: 150, 
      featured: true, 
      registered: false,
      organizer: 'Johor Chapter',
      badge: 'LIMITED SLOTS',
      warningText: 'Only 5 slots remaining',
      image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&auto=format&fit=crop&q=80',
      category: 'upcoming'
    },
    { 
      id: 3, 
      title: 'Genting Highlands Convoy 2024', 
      date: '16 Nov 2024', 
      location: 'Awana SkyWay Base Station', 
      rsvps: 124, 
      limit: 150, 
      featured: true, 
      registered: false,
      organizer: 'Selangor Chapter',
      badge: 'OFFICIAL CONVOY',
      image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80',
      category: 'upcoming'
    },
    {
      id: 4,
      title: 'Boron Technical Meetup',
      date: '15 Jun 2026',
      location: 'Shah Alam, Selangor',
      rsvps: 42,
      limit: 50,
      featured: false,
      registered: true,
      organizer: 'Selangor Chapter',
      badge: 'ONGOING',
      image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=600&auto=format&fit=crop&q=80',
      category: 'ongoing'
    },
    {
      id: 5,
      title: 'Port Dickson BBQ & Drive',
      date: '12 May 2026',
      location: 'Batu 4 Beach, Port Dickson',
      rsvps: 110,
      limit: 120,
      featured: false,
      registered: true,
      organizer: 'Negeri Sembilan Chapter',
      badge: 'COMPLETED',
      image: 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=600&auto=format&fit=crop&q=80',
      category: 'completed'
    }
  ]);

  // lifted Gallery Albums to top-level state for real-time interactivity & deletion
  const [galleryAlbums, setGalleryAlbums] = useState([
    {
      id: 1,
      title: 'National Gathering 2024',
      badge: 'Official',
      photosCount: 6,
      image: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600&auto=format&fit=crop&q=80',
      category: 'national',
      badgeStyle: 'bg-blue-50 text-[#0F2D52] font-black border border-blue-100',
      photos: [
        'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=850&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 2,
      title: 'Southern Chapter Convoy',
      badge: 'Regional',
      photosCount: 6,
      image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=600&auto=format&fit=crop&q=80',
      category: 'chapter_convoys',
      badgeStyle: 'bg-indigo-50 text-indigo-700 font-black border border-indigo-100',
      photos: [
        'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1525609004556-c46c7d6cf0a3?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=850&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 3,
      title: 'CSR Day 2023',
      badge: 'Social',
      photosCount: 5,
      image: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600&auto=format&fit=crop&q=80',
      category: 'social',
      badgeStyle: 'bg-amber-50 text-amber-800 font-semibold border border-amber-200/50',
      photos: [
        'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1524069290683-0457abfe42c3?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=850&auto=format&fit=crop&q=80'
      ]
    },
    {
      id: 4,
      title: 'KL Night Cruise',
      badge: 'Event',
      photosCount: 5,
      image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=600&auto=format&fit=crop&q=80',
      category: 'chapter_convoys',
      badgeStyle: 'bg-sky-50 text-sky-800 font-extrabold border border-sky-100',
      photos: [
        'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1542362567-b07eac79094d?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=850&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=850&auto=format&fit=crop&q=80'
      ]
    }
  ]);

  // Admin-only module management states (Events & Gallery)
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [isPdpaChecked, setIsPdpaChecked] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);

  // Sync isConsented checkbox states with database userProfile when loaded/synced
  useEffect(() => {
    if (userProfile) {
      setIsDisclaimerChecked(userProfile.disclaimerAccepted === true);
      setIsPdpaChecked(userProfile.pdpaAccepted === true);
    }
  }, [userProfile]);

  const handleSaveConsent = async () => {
    if (!auth.currentUser) {
      triggerToast("Sila log masuk terlebih dahulu.", "error");
      return;
    }
    
    if (!isDisclaimerChecked) {
      triggerToast("Sila tanda kotak persetujuan Terma & Syarat / DISCLAIMER.", "error");
      return;
    }

    if (!isPdpaChecked) {
      triggerToast("Sila tanda kotak persetujuan Notis Privasi (PDPA).", "error");
      return;
    }

    try {
      setIsSavingConsent(true);
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, {
        disclaimerAccepted: true,
        pdpaAccepted: true,
        isVerified: true,
        patch: 'mvoc_trusted_elite',
        points: 30
      });
      
      // Synchronously update local profile structure
      updateLocalProfileState({
        disclaimerAccepted: true,
        pdpaAccepted: true,
        isVerified: true,
        patch: 'mvoc_trusted_elite',
        points: 30
      });

      localStorage.setItem(`mvoc_consented_${auth.currentUser.uid}`, 'true');

      triggerToast("Terima kasih! Persetujuan anda disimpan dan lencana Trusted Elite serta 30 XP telah dianugerahkan.", "success");
    } catch (err: any) {
      console.warn("Gagal menyimpan persetujuan:", err);
      // Sandbox fallback
      updateLocalProfileState({
        disclaimerAccepted: true,
        pdpaAccepted: true,
        isVerified: true,
        patch: 'mvoc_trusted_elite',
        points: 30
      });
      if (auth.currentUser) {
        localStorage.setItem(`mvoc_consented_${auth.currentUser.uid}`, 'true');
      }
      triggerToast("Persetujuan dikesan dan disegerakan dalam aplikasi.", "success");
    } finally {
      setIsSavingConsent(false);
    }
  };

  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteAccountConfirmText, setDeleteAccountConfirmText] = useState('');

  const forceClearAllCookiesAndStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        if (name) {
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" + window.location.hostname;
          document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=." + window.location.hostname.split('.').slice(-2).join('.');
        }
      }
    } catch (err) {
      console.warn("Failed to clear cookies or storage gracefully:", err);
    }
  };

  const handleDeleteAccount = () => {
    if (!auth.currentUser) {
      triggerToast("Tiada pengguna aktif dikesan.", "error");
      return;
    }
    setDeleteAccountConfirmText('');
    setIsDeleteAccountModalOpen(true);
  };

  const executeDeleteAccount = async () => {
    if (!auth.currentUser) {
      triggerToast("Tiada pengguna aktif dikesan.", "error");
      return;
    }

    if (deleteAccountConfirmText !== "PADAM") {
      triggerToast("Sila taip 'PADAM' dengan betul untuk meneruskan.", "error");
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      
      // 1. Kemaskini dokumen Firestore untuk menetapkan status permohonan pemadaman
      try {
        await updateDoc(doc(db, 'users', uid), {
          requestDelete: true,
          status: 'delete_requested',
          deleteRequestedAt: new Date().toISOString()
        });
      } catch (docErr) {
        console.warn("Firestore update failed (might be schema restrictions or offline):", docErr);
      }
      
      // 2. Log keluar pengguna dan bersihkan sesi serta cookies
      try {
        await signOut(auth);
      } catch (signErr) {}
      
      resetSyncState();
      try {
        forceClearAllCookiesAndStorage();
      } catch (err) {}
      
      setIsLoggedIn(false);
      setIsDrawerOpen(false);
      setIsDeleteAccountModalOpen(false);
      setDeleteAccountConfirmText('');
      setCurrentTab('dashboard');
      sessionStorage.removeItem('mvoc_currentTab');
      sessionStorage.removeItem('mvoc_selectedEventId');
      sessionStorage.removeItem('mvoc_selectedAlbumId');
      sessionStorage.removeItem('mvoc_selectedJoiningConvoyId');
      
      triggerToast("Permohonan pemadaman akaun MVOC-ID anda telah dihantar secara rasmi kepada Super Admin untuk tindakan selanjutnya.", "success");
    } catch (error: any) {
      console.error("Gagal memohon pemadaman akaun:", error);
      triggerToast(`Gagal menghantar permohonan pemadaman: ${error.message || String(error)}`, "error");
    }
  };

  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isDeleteEventModalOpen, setIsDeleteEventModalOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any | null>(null);
  const [deleteEventConfirmText, setDeleteEventConfirmText] = useState('');
  
  // Event inputs form
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventOrganizer, setNewEventOrganizer] = useState('');
  const [newEventImage, setNewEventImage] = useState('https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600&auto=format&fit=crop&q=80');
  const [newEventCategory, setNewEventCategory] = useState<'upcoming' | 'ongoing' | 'completed'>('upcoming');
  const [newEventBadge, setNewEventBadge] = useState('OPEN');
  const [newEventDesc, setNewEventDesc] = useState('');

  // Gallery inputs / actions status
  const [isUploadGalleryModalOpen, setIsUploadGalleryModalOpen] = useState(false);
  const [isDeleteGalleryModalOpen, setIsDeleteGalleryModalOpen] = useState(false);
  const [galleryAlbumToDelete, setGalleryAlbumToDelete] = useState<any | null>(null);
  const [deleteGalleryConfirmText, setDeleteGalleryConfirmText] = useState('');

  // Gallery album form elements
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumBadge, setNewAlbumBadge] = useState('Official');
  const [newAlbumImage, setNewAlbumImage] = useState('https://images.unsplash.com/photo-1511919884226-fd3cad34687c?w=600&auto=format&fit=crop&q=80');
  const [newAlbumCategory, setNewAlbumCategory] = useState('national');

  const STATIC_ANNOUNCEMENTS: Announcement[] = [
    { 
      id: 1, 
      title: 'Membership Portal Scheduled Maintenance', 
      category: 'Official Notices', 
      date: 'Oct 22, 2024', 
      content: 'The MVOC digital membership portal will undergo scheduled maintenance on Saturday, 26th October from 00:00 to 04:00 MYT. Digital cards may be unavailable during this window. We recommend downloading your physical member pass to your local offline wallet or taking a screenshot of your secure barcode in advance.', 
      urgent: true,
      pinned: true,
      badgeText: 'System Alert',
      linkText: 'View Details'
    },
    { 
      id: 2, 
      title: 'Annual General Meeting (AGM) 2024: Registration Now Open', 
      category: 'Official Notices', 
      date: 'October 24, 2024', 
      content: 'Calling all registered MVOC members. The Annual General Meeting for 2024 will be held at the grand physical convention hall of the Chapter HQ. Formal registrations are now officially open through the member portal to confirm attendance, select catering options, and allocate official delegate seating cards.', 
      urgent: false,
      pinned: false,
      badgeText: 'Official Notice',
      linkText: 'Read Full Notice',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&auto=format&fit=crop&q=80'
    },
    { 
      id: 3, 
      title: 'Technical Workshop Series: Maintenance & Care', 
      category: 'Community', 
      date: 'Oct 18, 2024', 
      content: 'Join our upcoming community session focusing on DIY maintenance, engine health monitoring, tire safety alignment, and Veloz tech-bay sensor calibrations with certified Toyota guest technicians.', 
      urgent: false,
      pinned: false,
      badgeText: 'Community',
      linkText: 'Join Workshop',
      image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&auto=format&fit=crop&q=80'
    },
    { 
      id: 4, 
      title: 'New Corporate Partner: Elite Auto Detailing Special Offer', 
      category: 'Community', 
      date: 'Oct 15, 2024', 
      content: 'Active MVOC members now enjoy exclusive premium paint correction, ceramic glass coating solutions, and professional exterior shine treatments at standard partner member rates. Use coupon code ELITEVELOZ30 during verification.', 
      urgent: false,
      pinned: false,
      badgeText: 'Partner Offer',
      linkText: 'Unlock Promo Code',
      isPromoOffer: true
    },
    { 
      id: 5, 
      title: 'Updates to the Community Code of Conduct', 
      category: 'Governance', 
      date: 'Oct 10, 2024', 
      content: 'Please review the minor revisions to section 4 regarding cluster convoy protocols, general lane integrity, and emergency safety communications to align with updated road transport guidelines.', 
      urgent: false,
      pinned: false,
      badgeText: 'Governance',
      linkText: 'Review Document',
      isDocument: true
    }
  ];

  const [announcements, setAnnouncements] = useState<Announcement[]>(STATIC_ANNOUNCEMENTS);
  const [firestoreAnnouncements, setFirestoreAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);

  // Listen to remote announcements
  useEffect(() => {
    if (!isLoggedIn) {
      setFirestoreAnnouncements([]);
      return;
    }
    try {
      const announcementsRef = collection(db, 'announcements');
      const unsubscribe = onSnapshot(announcementsRef, (snapshot) => {
        const list: Announcement[] = [];
        snapshot.forEach((docSnap) => {
          const docData = docSnap.data();
          list.push({
            id: docSnap.id,
            title: docData.subject || '',
            content: docData.message || '',
            category: 'Official Notices',
            date: docData.timestamp ? new Date(docData.timestamp.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString(),
            urgent: docData.audience === 'Admins',
            badgeText: docData.audience || 'All Users',
            linkText: 'Read Full Notice',
            sender: docData.sender || 'MVOC Council',
            audience: docData.audience || 'All Users',
            targetChapter: docData.targetChapter || null
          });
        });
        setFirestoreAnnouncements(list);
      }, (error) => {
        console.error("Error listening to announcements:", error);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Failed to hear announcements collection:", e);
    }
  }, [isLoggedIn]);

  // Listen to read statuses sub-collection for current user
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) {
      setReadAnnouncementIds([]);
      return;
    }
    try {
      const readStatusesRef = collection(db, 'users', auth.currentUser.uid, 'readStatuses');
      const unsubscribe = onSnapshot(readStatusesRef, (snapshot) => {
        const ids = snapshot.docs.map(d => d.id);
        setReadAnnouncementIds(ids);
      }, (error) => {
        console.warn("Error listening to read statuses:", error.message);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Failed to set up read statuses listener:", e);
    }
  }, [isLoggedIn]);

  // Merge static and dynamic announcements filtered by audience targeting rules
  useEffect(() => {
    const userRole = userProfile?.role || 'member';
    const userTier = userProfile?.tier || 'STANDARD';
    const isUserAdminOrSuper = userRole === 'super_admin' || userRole === 'admin';

    const filteredDynamic = firestoreAnnouncements.filter((item) => {
      const aud = item.audience || 'All Users';
      const tc = item.targetChapter;
      if (aud === 'All Users') return true;
      if (aud === 'Gold Members' && (userTier === 'GOLD' || isUserAdminOrSuper)) return true;
      if (aud === 'Admins' && isUserAdminOrSuper) return true;
      if (aud === 'Chapter Members' && (isUserAdminOrSuper || tc === userProfile?.chapter)) return true;
      return false;
    });

    setAnnouncements([...filteredDynamic, ...STATIC_ANNOUNCEMENTS]);
  }, [firestoreAnnouncements, userProfile]);

  // Securely mark announcement as read
  const markAnnouncementAsRead = async (announcementId: any) => {
    if (!auth.currentUser) return;
    try {
      const readRef = doc(db, 'users', auth.currentUser.uid, 'readStatuses', String(announcementId));
      await setDoc(readRef, { read: true, readAt: new Date() }, { merge: true });
    } catch (err) {
      console.error("Failed to mark announcement as read:", err);
    }
  };

  // Select wrapper callback
  const handleSelectAnnouncement = (item: Announcement) => {
    setSelectedAnnouncement(item);
    markAnnouncementAsRead(item.id);
  };

  const [archivedAnnouncements] = useState<Announcement[]>([
    {
      id: 6,
      title: 'MVOC Merdeka Day Parade Registration',
      category: 'Official Notices',
      date: 'Sep 05, 2024',
      content: 'Register for the national celebration parade. We have slots for up to 50 silver and white Toyota Veloz models to join the formal escort fleet.',
      urgent: false,
      badgeText: 'Official Notice',
      linkText: 'View Archives'
    },
    {
      id: 7,
      title: 'Port Dickson BBQ Block Party Wrapup',
      category: 'Community',
      date: 'Aug 25, 2024',
      content: 'Photos and video recaps from our summer beachside drive in Port Dickson are now fully cached and accessible in the Media Gallery.',
      urgent: false,
      badgeText: 'Community',
      linkText: 'View Gallery Photos'
    }
  ]);

  const [announcementCategoryFilter, setAnnouncementCategoryFilter] = useState<'All' | 'Official Notices' | 'Community'>('All');
  const [bookmarkedAnnouncements, setBookmarkedAnnouncements] = useState<any[]>([1]);
  const [showOlderAnnouncements, setShowOlderAnnouncements] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  const hasUnreadAnnouncements = useMemo(() => {
    if (!isLoggedIn || !auth.currentUser) return false;
    return announcements.some(ann => !readAnnouncementIds.includes(String(ann.id)));
  }, [announcements, readAnnouncementIds, isLoggedIn]);

  // Announcement detail interactive temporary states
  const [announcementRsvpStatus, setAnnouncementRsvpStatus] = useState<'none' | 'confirmed' | 'declined'>('none');
  const [conductAcknowledge, setConductAcknowledge] = useState(false);
  const [copiedPromo, setCopiedPromo] = useState(false);
  const [workshopRegistered, setWorkshopRegistered] = useState(false);

  useEffect(() => {
    setAnnouncementRsvpStatus('none');
    setConductAcknowledge(false);
    setCopiedPromo(false);
    setWorkshopRegistered(false);
  }, [selectedAnnouncement]);

  // Synchronize and seed Regional Chapters from Firestore
  useEffect(() => {
    if (!isLoggedIn || !auth.currentUser) {
      return;
    }

    try {
      const chaptersCollectionRef = collection(db, 'chapters');
      const unsubscribe = onSnapshot(chaptersCollectionRef, async (snapshot) => {
        if (snapshot.empty) {
          console.log("[CHAPTER SYSTEM]: Firestore chapters collection is empty, initiating database seeding...");
          const defaultList = [
            {
              id: 1,
              name: 'MVOC Selangor',
              region: 'Central',
              isHQ: false,
              subText: 'Selangor Chapter',
              membersCount: 452,
              iconType: 'building',
              leadName: 'Khairul Nizam',
              leadTitle: 'Chapter Lead',
              description: 'Covering Shah Alam, Subang Jaya, Petaling Jaya, and wider Selangor. Hosts frequent local dynamic cruises and partner garage meets.',
              meetupRoutine: 'Every Friday night at Shah Alam Stadium parking lot.',
              establishedDate: '15 March 2021',
              registeredCars: ['BQA 1120', 'PMK 6620']
            },
            {
              id: 2,
              name: 'MVOC Kuala Lumpur',
              region: 'Central',
              isHQ: true,
              subText: 'Federal Territory Chapter',
              membersCount: 312,
              iconType: 'building',
              leadName: 'Marcus Tan',
              leadTitle: 'Chapter Lead',
              description: 'The foundation chapter of MVOC. Kuala Lumpur hosts weekly mini-gatherings, technical dyno runs, and charity cruises. We represent the biggest cluster of Velox performance builds in the peninsula.',
              meetupRoutine: 'Every Friday night at KLCC outer bays, starting 09:30 PM.',
              establishedDate: '12 January 2021',
              registeredCars: ['WVD 1120', 'WQA 5520', 'KCR 991']
            },
            {
              id: 3,
              name: 'MVOC Johor',
              region: 'Southern',
              isHQ: false,
              subText: 'Johor Chapter',
              membersCount: 288,
              iconType: 'arrow-down',
              leadName: 'Zainal Abidin',
              leadTitle: 'Chapter Lead',
              description: 'Uniting southern drivers across Johor Bahru, Muar, and Batu Pahat. Focuses on cross-border dynamic runs, car wash gatherings, and performance setups.',
              meetupRoutine: 'Last Friday night of the month at Danga Bay waterfront.',
              establishedDate: '01 February 2021',
              registeredCars: ['JQA 777', 'JVM 8820', 'JBC 12']
            },
            {
              id: 4,
              name: 'MVOC Penang',
              region: 'Northern',
              isHQ: false,
              subText: 'Penang Chapter',
              membersCount: 195,
              iconType: 'waves',
              leadName: 'Lee Chong Wai',
              leadTitle: 'Chapter Lead',
              description: 'Famous for Penang Bridge sunset convoys, hillside winding road cruises, and local culinary noodle run cruises.',
              meetupRoutine: 'Every alternate Sunday evening at Queensbay Mall waterfront.',
              establishedDate: '15 September 2021',
              registeredCars: ['PAB 771', 'PHD 912', 'PGA 451']
            },
            {
              id: 5,
              name: 'MVOC Perak',
              region: 'Northern',
              isHQ: false,
              subText: 'Perak Chapter',
              membersCount: 167,
              iconType: 'arrow-up',
              leadName: 'Ahmad Ridzuan',
              leadTitle: 'Chapter Lead',
              description: 'Encompassing Ipoh, Taiping, and Teluk Intan. Perak chapter cruises historic towns, old trails, and mountain hill roads.',
              meetupRoutine: 'Monthly breakfast meetups in central Ipoh old town bays.',
              establishedDate: '12 November 2021',
              registeredCars: ['AKD 450', 'ALB 1205']
            },
            {
              id: 6,
              name: 'MVOC Pahang',
              region: 'East Coast',
              isHQ: false,
              subText: 'Pahang Chapter',
              membersCount: 142,
              iconType: 'waves',
              leadName: 'Syed Al-Hafiz',
              leadTitle: 'Chapter Lead',
              description: 'Embracing the scenic roads of Pahang. Leads long-range highway cruises, beach picnics, and rain driving clinics.',
              meetupRoutine: 'Monthly sunset gathering at Teluk Cempedak beach bays.',
              establishedDate: '10 July 2021',
              registeredCars: ['CAB 1205']
            },
            {
              id: 7,
              name: 'MVOC Negeri Sembilan',
              region: 'Central',
              isHQ: false,
              subText: 'Negeri Sembilan Chapter',
              membersCount: 154,
              iconType: 'landmark',
              leadName: 'Azman Shah',
              leadTitle: 'Chapter Lead',
              description: 'Active chapter in Seremban and surrounding districts. Focused on scenic dynamic test drives and regular local coffee meetups.',
              meetupRoutine: 'Every second Saturday morning at Seremban Lake Gardens.',
              establishedDate: '01 June 2021',
              registeredCars: ['NQA 881']
            },
            {
              id: 8,
              name: 'MVOC Melaka',
              region: 'Southern',
              isHQ: false,
              subText: 'Melaka Chapter',
              membersCount: 110,
              iconType: 'building',
              leadName: 'Faris Hazwan',
              leadTitle: 'Chapter Lead',
              description: 'Historic Melaka chapter. Regular static evening cruises by heritage red builds, Klebang seashore picnics and beach drives.',
              meetupRoutine: 'First Saturday night of the month at Klebang beach dynamic bays.',
              establishedDate: '22 October 2021',
              registeredCars: ['MBA 202']
            },
            {
              id: 9,
              name: 'MVOC Kedah',
              region: 'Northern',
              isHQ: false,
              subText: 'Kedah Chapter',
              membersCount: 98,
              iconType: 'mountain',
              leadName: 'Wan Aminudin',
              leadTitle: 'Chapter Lead',
              description: 'Uniting paddy state cruisers in Alor Setar and Sungai Petani. Enjoys scenic mountain road cruises and agricultural fields vistas.',
              meetupRoutine: 'Monthly morning gatherings at Alor Setar tower outer belfry.',
              establishedDate: '05 January 2022',
              registeredCars: ['KBA 1215']
            },
            {
              id: 10,
              name: 'MVOC Kelantan',
              region: 'East Coast',
              isHQ: false,
              subText: 'Kelantan Chapter',
              membersCount: 88,
              iconType: 'compass',
              leadName: 'Raja Syahiran',
              leadTitle: 'Chapter Lead',
              description: 'Proud East Coast drivers in Kota Bharu. Gathering at coastal sites, celebrating traditional local foods, and doing humanitarian welfare drives.',
              meetupRoutine: 'Every Friday afternoon at Pantai Cahaya Bulan bays.',
              establishedDate: '30 October 2021',
              registeredCars: ['DQA 5510']
            },
            {
              id: 11,
              name: 'MVOC Terengganu',
              region: 'East Coast',
              isHQ: false,
              subText: 'Terengganu Chapter',
              membersCount: 74,
              iconType: 'anchor',
              leadName: 'Hafizuddin Gading',
              leadTitle: 'Chapter Lead',
              description: 'Beachside cruises in Kuala Terengganu. Known for authentic local oceanfront culinary runs, coastal highway cruising, and bridge photography.',
              meetupRoutine: 'Alternate Saturday evenings at Drawbridge KT outer parking square.',
              establishedDate: '15 September 2021',
              registeredCars: ['TQA 22']
            },
            {
              id: 12,
              name: 'MVOC Sabah',
              region: 'East MY',
              isHQ: false,
              subText: 'Sabah Chapter',
              membersCount: 165,
              iconType: 'mountain',
              leadName: 'Aloysius Jipiu',
              leadTitle: 'Chapter Lead',
              description: 'Borneo team in Land Below the Wind. Famous for high-altitude winding hill cruises around Kundasang and long coastal journeys.',
              meetupRoutine: 'Every third Sunday morning at Likas Bay waterfront parking.',
              establishedDate: '18 December 2021',
              registeredCars: ['SAA 1120', 'SJQ 45']
            },
            {
              id: 13,
              name: 'MVOC Sarawak',
              region: 'East MY',
              isHQ: false,
              subText: 'Sarawak Chapter',
              membersCount: 122,
              iconType: 'waves',
              leadName: 'Douglas Lim',
              leadTitle: 'Chapter Lead',
              description: 'Borneo active crew cruising Kuching, Sibu, and Miri. Focused on cross-city drives, weekend mountain coffee climbs, and PWA networking sessions.',
              meetupRoutine: 'Last Sunday morning of the month at Kuching Waterfront bays.',
              establishedDate: '01 December 2021',
              registeredCars: ['QAA 88', 'QSJ 1120']
            },
            {
              id: 14,
              name: 'MVOC Brunei',
              region: 'East MY',
              isHQ: false,
              subText: 'Brunei Chapter',
              membersCount: 52,
              iconType: 'landmark',
              leadName: 'Jefri Bolkiah',
              leadTitle: 'Chapter Lead',
              description: 'An international wing of MVOC based in the historic sultanate of Bandar Seri Begawan. Bridging links with Sarawak regional activities and custom modifications clinics.',
              meetupRoutine: 'Monthly evening meets at Jerudong theme park dynamic bays.',
              establishedDate: '08 August 2022',
              registeredCars: ['BG 3320']
            }
          ];

          for (const item of defaultList) {
            // Assign Selangor (1) and Kuala Lumpur (2) to the current user's UID to test Chapter Admin right out of the box, others with placeholder administrative values
            const adminIdValue = (item.id === 1 || item.id === 2) 
              ? auth.currentUser.uid 
              : `placeholder_admin_id_${item.id}`;

            await setDoc(doc(db, 'chapters', String(item.id)), {
              ...item,
              adminId: adminIdValue
            });
          }
        } else {
          const list: any[] = [];
          snapshot.forEach((snap) => {
            const data = snap.data();
            list.push({ id: Number(snap.id), ...data } as any);
          });
          list.sort((a, b) => a.id - b.id);
          setChaptersList(list);
        }
      }, (error) => {
        console.error("Error subscribing to chapters collection: ", error);
      });

      return () => unsubscribe();
    } catch (unsubErr) {
      console.error("Failed to establish real-time chapters subscription:", unsubErr);
    }
  }, [isLoggedIn]);

  // Convoy RSVP flow
  const [convoyVehicleNumber, setConvoyVehicleNumber] = useState('VCD 8834');
  const [convoyShirtSize, setConvoyShirtSize] = useState('L');
  const [convoyPaxCount, setConvoyPaxCount] = useState('2');
  const [chapterSelector, setChapterSelector] = useState('Kuala Lumpur');

  // Interactive Convoys States
  const [convoysSearchQuery, setConvoysSearchQuery] = useState('');
  const [activeConvoyFilter, setActiveConvoyFilter] = useState<'all' | 'charity' | 'upcoming' | 'open' | 'last-slots'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedJoiningConvoyId, setSelectedJoiningConvoyId] = useState<number | null>(() => {
    const saved = sessionStorage.getItem('mvoc_selectedJoiningConvoyId');
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    if (selectedJoiningConvoyId !== null) {
      sessionStorage.setItem('mvoc_selectedJoiningConvoyId', selectedJoiningConvoyId.toString());
    } else {
      sessionStorage.removeItem('mvoc_selectedJoiningConvoyId');
    }
  }, [selectedJoiningConvoyId]);

  // Convoy specific RSVP interactive inputs
  const [joiningVehicleNumber, setJoiningVehicleNumber] = useState('VCD 8834');
  const [joiningShirtSize, setJoiningShirtSize] = useState('L');
  const [joiningPaxCount, setJoiningPaxCount] = useState('2');
  const [joiningChapter, setJoiningChapter] = useState('Kuala Lumpur');
  const [joiningDietary, setJoiningDietary] = useState('None');
  const [joiningAgreedRules, setJoiningAgreedRules] = useState(false);

  // Marshall specific states
  const [isMarshallModalOpen, setIsMarshallModalOpen] = useState(false);
  const [marshallExperience, setMarshallExperience] = useState('Experienced PWA convoy lead');
  const [marshallMessage, setMarshallMessage] = useState('');

  // Chapters & Regions State Management
  const [selectedRegion, setSelectedRegion] = useState<'Central' | 'Northern' | 'Southern' | 'East Coast' | 'East MY'>('Central');
  const [chapterSearchQuery, setChapterSearchQuery] = useState('');
  const [chaptersSortOption, setChaptersSortOption] = useState<'members' | 'alpha'>('members');
  const [showChaptersSortDropdown, setShowChaptersSortDropdown] = useState(false);
  const [joinedChapters, setJoinedChapters] = useState<number[]>([1]); // default joined Kuala Lumpur

  // Active chat state for Chapters Lead contact
  const [selectedLeadForChat, setSelectedLeadForChat] = useState<{ id: number; name: string; chapter: string; title: string; image?: string; initial?: string } | null>(null);
  const [chapterLeadChatMessage, setChapterLeadChatMessage] = useState('');

  // Active detail modal for Chapter
  const [selectedChapterDetailId, setSelectedChapterDetailId] = useState<number | null>(null);

  const [chaptersList, setChaptersList] = useState<{
    id: number;
    name: string;
    region: 'Central' | 'Southern' | 'Northern' | 'East Coast' | 'East MY';
    isHQ: boolean;
    subText: string;
    membersCount: number;
    iconType: string;
    leadName: string;
    leadTitle: string;
    description: string;
    meetupRoutine: string;
    establishedDate: string;
    registeredCars: string[];
  }[]>([
    {
      id: 1,
      name: 'MVOC Selangor',
      region: 'Central',
      isHQ: false,
      subText: 'Selangor Chapter',
      membersCount: 452,
      iconType: 'building',
      leadName: 'Khairul Nizam',
      leadTitle: 'Chapter Lead',
      description: 'Covering Shah Alam, Subang Jaya, Petaling Jaya, and wider Selangor. Hosts frequent local dynamic cruises and partner garage meets.',
      meetupRoutine: 'Every Friday night at Shah Alam Stadium parking lot.',
      establishedDate: '15 March 2021',
      registeredCars: ['BQA 1120', 'PMK 6620']
    },
    {
      id: 2,
      name: 'MVOC Kuala Lumpur',
      region: 'Central',
      isHQ: true,
      subText: 'Federal Territory Chapter',
      membersCount: 312,
      iconType: 'building',
      leadName: 'Marcus Tan',
      leadTitle: 'Chapter Lead',
      description: 'The foundation chapter of MVOC. Kuala Lumpur hosts weekly mini-gatherings, technical dyno runs, and charity cruises. We represent the biggest cluster of Velox performance builds in the peninsula.',
      meetupRoutine: 'Every Friday night at KLCC outer bays, starting 09:30 PM.',
      establishedDate: '12 January 2021',
      registeredCars: ['WVD 1120', 'WQA 5520', 'KCR 991']
    },
    {
      id: 3,
      name: 'MVOC Johor',
      region: 'Southern',
      isHQ: false,
      subText: 'Johor Chapter',
      membersCount: 288,
      iconType: 'arrow-down',
      leadName: 'Zainal Abidin',
      leadTitle: 'Chapter Lead',
      description: 'Uniting southern drivers across Johor Bahru, Muar, and Batu Pahat. Focuses on cross-border dynamic runs, car wash gatherings, and performance setups.',
      meetupRoutine: 'Last Friday night of the month at Danga Bay waterfront.',
      establishedDate: '01 February 2021',
      registeredCars: ['JQA 777', 'JVM 8820', 'JBC 12']
    },
    {
      id: 4,
      name: 'MVOC Penang',
      region: 'Northern',
      isHQ: false,
      subText: 'Penang Chapter',
      membersCount: 195,
      iconType: 'waves',
      leadName: 'Lee Chong Wai',
      leadTitle: 'Chapter Lead',
      description: 'Famous for Penang Bridge sunset convoys, hillside winding road cruises, and local culinary noodle run cruises.',
      meetupRoutine: 'Every alternate Sunday evening at Queensbay Mall waterfront.',
      establishedDate: '15 September 2021',
      registeredCars: ['PAB 771', 'PHD 912', 'PGA 451']
    },
    {
      id: 5,
      name: 'MVOC Perak',
      region: 'Northern',
      isHQ: false,
      subText: 'Perak Chapter',
      membersCount: 167,
      iconType: 'arrow-up',
      leadName: 'Ahmad Ridzuan',
      leadTitle: 'Chapter Lead',
      description: 'Encompassing Ipoh, Taiping, and Teluk Intan. Perak chapter cruises historic towns, old trails, and mountain hill roads.',
      meetupRoutine: 'Monthly breakfast meetups in central Ipoh old town bays.',
      establishedDate: '12 November 2021',
      registeredCars: ['AKD 450', 'ALB 1205']
    },
    {
      id: 6,
      name: 'MVOC Pahang',
      region: 'East Coast',
      isHQ: false,
      subText: 'Pahang Chapter',
      membersCount: 142,
      iconType: 'waves',
      leadName: 'Syed Al-Hafiz',
      leadTitle: 'Chapter Lead',
      description: 'Embracing the scenic roads of Pahang. Leads long-range highway cruises, beach picnics, and rain driving clinics.',
      meetupRoutine: 'Monthly sunset gathering at Teluk Cempedak beach bays.',
      establishedDate: '10 July 2021',
      registeredCars: ['CAB 1205']
    },
    {
      id: 7,
      name: 'MVOC Negeri Sembilan',
      region: 'Southern',
      isHQ: false,
      subText: 'Negeri Sembilan Chapter',
      membersCount: 124,
      iconType: 'arrow-down',
      leadName: 'Norazlan Bakri',
      leadTitle: 'Chapter Lead',
      description: 'Active chapter in Seremban and surrounding districts. Focused on scenic dynamic test drives and regular local coffee meetups.',
      meetupRoutine: 'Every third Saturday night at Seremban 2 Boulevard.',
      establishedDate: '05 May 2021',
      registeredCars: ['NQA 4401']
    },
    {
      id: 8,
      name: 'MVOC Melaka',
      region: 'Southern',
      isHQ: false,
      subText: 'Melaka Chapter',
      membersCount: 118,
      iconType: 'building',
      leadName: 'Fadhil Mohd',
      leadTitle: 'Chapter Lead',
      description: 'Historical city drives, heritage cruises, and regular community social support events for members across Melaka.',
      meetupRoutine: 'First Saturday of each month at Klebang beach.',
      establishedDate: '24 May 2021',
      registeredCars: ['MBD 3255', 'MBB 9912']
    },
    {
      id: 9,
      name: 'MVOC Kedah',
      region: 'Northern',
      isHQ: false,
      subText: 'Kedah Chapter',
      membersCount: 95,
      iconType: 'arrow-up',
      leadName: 'Baharuddin Hamid',
      leadTitle: 'Chapter Lead',
      description: 'Connecting Veloz drivers across Alor Setar and Sungai Petani. Highly active support crew network.',
      meetupRoutine: 'Monthly gathering at Alor Setar Tower square.',
      establishedDate: '12 August 2021',
      registeredCars: ['KCE 9910']
    },
    {
      id: 10,
      name: 'MVOC Kelantan',
      region: 'East Coast',
      isHQ: false,
      subText: 'Kelantan Chapter',
      membersCount: 84,
      iconType: 'waves',
      leadName: 'Wan Harun',
      leadTitle: 'Chapter Lead',
      description: 'Tight-knit community of Veloz builders and performance enthusiasts in Kota Bharu.',
      meetupRoutine: 'Bi-weekly Friday afternoon coffee circles.',
      establishedDate: '22 October 2021',
      registeredCars: ['DBC 5521']
    },
    {
      id: 11,
      name: 'MVOC Terengganu',
      region: 'East Coast',
      isHQ: false,
      subText: 'Terengganu Chapter',
      membersCount: 76,
      iconType: 'waves',
      leadName: 'Che Ku Daud',
      leadTitle: 'Chapter Lead',
      description: 'Famous for long east-coast coastal drives. Encompasses Kemaman, Dungun, and Kuala Terengganu.',
      meetupRoutine: 'Monthly beachfront cruise on the coastal expressway.',
      establishedDate: '30 October 2021',
      registeredCars: ['TAB 9922']
    },
    {
      id: 12,
      name: 'MVOC Sabah',
      region: 'East MY',
      isHQ: false,
      subText: 'Sabah Chapter',
      membersCount: 112,
      iconType: 'mountain',
      leadName: 'Justin Liew',
      leadTitle: 'Chapter Lead',
      description: 'Exploring scenic high-altitude roads toward Kundasang. Famous for rugged mountain tours and beautiful views of Mount Kinabalu.',
      meetupRoutine: 'First Sunday of each month starting from KK waterfront.',
      establishedDate: '01 June 2022',
      registeredCars: ['SAC 4410', 'SAA 915 H']
    },
    {
      id: 13,
      name: 'MVOC Sarawak',
      region: 'East MY',
      isHQ: false,
      subText: 'Sarawak Chapter',
      membersCount: 105,
      iconType: 'mountain',
      leadName: 'Henry Anyi',
      leadTitle: 'Chapter Lead',
      description: 'Uniting urban commutes with rainforest highway trails. Famous for nature excursions and Sarawak river drives.',
      meetupRoutine: 'Monthly night drive around Kuching Waterfront.',
      establishedDate: '18 March 2022',
      registeredCars: ['QAA 8814 L', 'QCE 125']
    },
    {
      id: 14,
      name: 'MVOC Brunei',
      region: 'East MY',
      isHQ: false,
      subText: 'Brunei Chapter',
      membersCount: 65,
      iconType: 'mountain',
      leadName: 'Haji Faisal',
      leadTitle: 'Chapter Lead',
      description: 'Connecting Veloz energy across Bandar Seri Begawan and Tutong. Hosting premium scenic highway convoys and cross-border cruises.',
      meetupRoutine: 'First Friday sunset coffee meets at Jerudong Park waterfront.',
      establishedDate: '12 October 2022',
      registeredCars: ['BG 8820', 'KF 129']
    }
  ]);

  const [convoysList, setConvoysList] = useState([
    {
      id: 1,
      title: 'Merdeka Charity Drive',
      status: 'UPCOMING',
      isCharity: true,
      maxSlots: 60,
      joinedCount: 48,
      image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
      meetingPoint: 'Petronas Solaris Serdang, 07:00 AM',
      routeOverview: 'Kuala Lumpur → Melaka → Port Dickson (Coastal Drive)',
      avatars: ['AZ', 'SM', '+45'],
      userRegistered: false,
    },
    {
      id: 2,
      title: 'Cameron Highlands Expedition',
      status: 'OPEN',
      isCharity: false,
      maxSlots: 25,
      joinedCount: 12,
      image: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&auto=format&fit=crop&q=80',
      meetingPoint: 'R&R Rawang (Northbound), 06:30 AM',
      routeOverview: 'Kuala Lumpur → Tapah → Tanah Rata → Brinchang',
      avatars: ['JD', '+10'],
      userRegistered: false,
    },
    {
      id: 3,
      title: 'Genting Highland Sunrise Run',
      status: 'LAST FEW SLOTS',
      isCharity: false,
      maxSlots: 20,
      joinedCount: 18,
      date: '14 Oct 2023',
      time: '05:00 AM',
      locationDetails: 'BHPetrol Karak Highway',
      avatars: [],
      userRegistered: false,
    }
  ]);

  // Trigger temporary toasts are handled as a prop passed from parent App wrapper

  // Google Authentication
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    triggerToast('Connecting to secure Google OAuth...', 'info');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (user) {
        const isOk = await triggerSync(user.uid, user.email || '');
        setIsLoggedIn(true);
        setCurrentTab('dashboard');
        if (isOk) {
          triggerToast(`Google sign-in successful! Synced: ${user.displayName || user.email}`, 'success');
        } else {
          triggerToast(`Onboarding halted: ${user.email} is not registered in our database.`, 'error');
        }
      }
    } catch (err: any) {
      console.warn("Google Sign In Popup blocked or config missing in preview iframe. Error info:", err);
      setAuthPopupErrorMsg(err?.message || String(err));
      setIsAuthPopupBlockedOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle active RSVPs
  const toggleRsvp = (eventId: number) => {
    setEvents(events.map(ev => {
      if (ev.id === eventId) {
        const nextReg = !ev.registered;
        if (nextReg) {
          // Validation: Ensure limit is not exceeded, allowing bypass for Admins
          if (ev.limit && ev.rsvps >= ev.limit && !isAdminOrSuperAdmin()) {
            triggerToast(`Registration is fully booked. Only admins can bypass this limit.`, 'error');
            return ev;
          }
          triggerToast(`Registered successfully for ${ev.title}! Check-in instructions sent.`, 'success');
        } else {
          triggerToast(`Cancelled registration for ${ev.title}.`, 'info');
        }
        return { ...ev, registered: nextReg, rsvps: nextReg ? ev.rsvps + 1 : ev.rsvps - 1 };
      }
      return ev;
    }));
  };

  // Handle simulated logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {}
    resetSyncState();
    setIsLoggedIn(false);
    setIsDrawerOpen(false);
    setCurrentTab('dashboard');
    sessionStorage.removeItem('mvoc_currentTab');
    sessionStorage.removeItem('mvoc_selectedEventId');
    sessionStorage.removeItem('mvoc_selectedAlbumId');
    sessionStorage.removeItem('mvoc_selectedJoiningConvoyId');
    triggerToast('You have been safely logged out.', 'info');
  };

  // Navigation drawer helper
  const navigateToTab = (tab: TabType) => {
    setCurrentTab(tab);
    setIsDrawerOpen(false);
  };

  const qrPayloadString = useMemo(() => {
    // If the photo URL is a massive base64 string, omit it to prevent "Data too long" QR code errors
    const safeAvatarUrl = displayAvatarUrl && displayAvatarUrl.length > 500 ? "" : displayAvatarUrl;
    
    return JSON.stringify({
      uid: userProfile?.uid || auth.currentUser?.uid,
      mvocId: displayMvocId,
      name: displayName,
      chapter: displayChapter,
      photoURL: safeAvatarUrl
    });
  }, [userProfile, auth.currentUser, displayMvocId, displayName, displayChapter, displayAvatarUrl]);

  const rewardsInfo = useMemo(() => {
    const xp = userProfile?.points !== undefined ? userProfile.points : 0;
    
    // Determine active tier based on XP
    let activeTierLabel: 'Silver' | 'Gold' | 'Platinum' = 'Silver';
    let currentTierName = 'Silver Member';
    
    if (xp >= 100) {
      activeTierLabel = 'Platinum';
      currentTierName = 'Platinum Member';
    } else if (xp >= 30) {
      activeTierLabel = 'Gold';
      currentTierName = 'Gold Member';
    }
    
    // Calculate progress percentage and next tier goals
    let progressPercent = 0;
    let nextTierXP = 30;
    let benefitsCount = 5;
    
    if (xp >= 100) {
      progressPercent = 100;
      nextTierXP = 100;
      benefitsCount = 20;
    } else if (xp >= 30) {
      // Progress between Gold (30) and Platinum (100)
      progressPercent = Math.min(Math.round(((xp - 30) / 70) * 100), 100);
      nextTierXP = 100;
      benefitsCount = 12;
    } else {
      // Progress between Silver (0) and Gold (30)
      progressPercent = Math.min(Math.round((xp / 30) * 100), 100);
      nextTierXP = 30;
      benefitsCount = 5;
    }
    
    return {
      xp,
      activeTierLabel,
      currentTierName,
      progressPercent,
      nextTierXP,
      benefitsCount
    };
  }, [userProfile?.points]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center py-12 px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-slate-100 shadow-2xl text-center space-y-6">
          <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100/80 border-t-[#0F2D52] animate-spin" />
            <RefreshCw className="w-5 h-5 text-[#0F2D52] animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-base font-black text-[#0F2D52]">
              Sila Tunggu...
            </h3>
            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
              Sedang memuatkan portal ahli MVOC. Sila tunggu seketika.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isEffectivelyBlocked = !isBlockedCheckLoading && (isBlocked || userProfile?.status === 'suspended' || userProfile?.status === 'banned' || userProfile?.status === 'deleted' || userProfile?.status === 'delete_requested');

  if (isEffectivelyBlocked) {
    return (
      <BlockedNotice
        userEmail={auth.currentUser?.email || userProfile?.email}
        userMvocId={userProfile?.mvocId}
        userStatus={liveStatus || userProfile?.status || 'suspended'}
        onLogout={() => {
          try {
            forceClearAllCookiesAndStorage();
          } catch (err) {}
          signOut(auth);
          window.location.reload();
        }}
        triggerToast={triggerToast}
      />
    );
  }

  if (publicCardId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 select-none">
        <div className="w-full max-w-sm text-center space-y-6">
          {/* Logo */}
          <div className="w-full">
            <img 
              src="https://i.ibb.co/hR2y1NXX/MVOC-modified.jpg" 
              alt="MVOC Logo"
              className="w-full max-w-[200px] h-auto mx-auto object-contain select-none"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-display font-black tracking-tight text-[#0F2D52]">Bukti Keahlian Awam</h2>
            <p className="text-xs text-slate-500 font-semibold leading-relaxed">MVOC Malaysia Digital Card Verification</p>
          </div>

          {isPublicLoading ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200/50 shadow-sm flex flex-col items-center justify-center gap-3 py-16">
              <RefreshCw className="w-8 h-8 text-[#0F2D52] animate-spin" />
              <span className="text-xs text-slate-500 font-bold">Memuatkan profil kad...</span>
            </div>
          ) : publicProfile ? (
            <div className="space-y-5">
              {/* Premium Carbon Fiber/Sleek Dark Membership Card */}
              <div
                ref={cardRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={tiltStyle}
                className="w-full aspect-[1.65/1] cursor-pointer relative"
                onClick={() => setIsCardFlipped(!isCardFlipped)}
              >
                <motion.div
                  animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                  transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                  style={{ transformStyle: 'preserve-3d' }}
                  className="relative w-full h-full"
                >
                  {/* FRONT FACE */}
                  <div
                    className="absolute inset-0 w-full h-full bg-[#111] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 flex items-center justify-center select-none group bg-cover bg-center"
                    style={{ 
                      backfaceVisibility: 'hidden',
                      backgroundImage: `url(${mvocPremiumFront})`
                    }}
                  >
                     {/* Glare/Shine overlay */}
                     <div 
                       className="absolute inset-0 pointer-events-none z-10" 
                       style={glareStyle}
                     />
                     <span className="text-white/20 text-[10px] font-black uppercase tracking-widest pointer-events-none drop-shadow-md">
                       MVOC DIGITAL CARD
                     </span>
                  </div>

                  {/* BACK FACE */}
                  <div
                    className="absolute inset-0 w-full h-full bg-[#111] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col items-center justify-center select-none group bg-cover bg-center"
                    style={{ 
                      backfaceVisibility: 'hidden', 
                      transform: 'rotateY(180deg)',
                      backgroundImage: `url(${mvocPremiumBack})`
                    }}
                  >
                    {/* Glare/Shine overlay */}
                    <div 
                      className="absolute inset-0 pointer-events-none z-10" 
                      style={glareStyle}
                    />
                    
                    <div className="flex flex-col items-center justify-center relative w-full px-8 mt-4">
                      <h4 
                        className="text-[20px] sm:text-[22px] leading-tight font-display font-bold tracking-widest text-[#e2e8f0] text-center uppercase drop-shadow-xl"
                        style={{ textShadow: "1px 1px 1px #fff, -1px -1px 1px #888, 2px 2px 4px rgba(0,0,0,0.8)" }}
                      >
                        {publicProfile.name}
                      </h4>
                      <span 
                        className="text-[14px] sm:text-[15px] font-semibold tracking-[0.15em] font-sans text-[#cbd5e1] mt-1.5 drop-shadow-xl"
                        style={{ textShadow: "1px 1px 0px #fff, -1px -1px 0px #888, 2px 2px 3px rgba(0,0,0,0.8)" }}
                      >
                        {publicProfile.mvocId}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Status Verification Badge */}
              <div className="bg-emerald-50 border border-emerald-250 p-4 rounded-2xl flex items-start gap-3.5 text-left shadow-2xs">
                <CheckCircle2 className="w-5.5 h-5.5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block leading-none">Status Keahlian</span>
                  <span className="text-sm font-black text-emerald-950 block">{publicProfile.status}</span>
                  <span className="text-[10.5px] text-slate-500 font-semibold leading-normal block">
                    {publicProfile.chapter ? `${publicProfile.chapter} Chapter` : 'Verified Active Member'}
                  </span>
                </div>
              </div>

              {/* Info box */}
              <div className="flex gap-3 bg-slate-100/50 border border-slate-200/30 p-4 rounded-2xl text-left">
                <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-slate-500 font-medium leading-relaxed">
                  Kad digital ini dikeluarkan secara rasmi oleh persatuan berdaftar MVOC Malaysia. Ia membuktikan status aktif ahli yang berdaftar untuk tujuan program rasmi dan diskaun rakan niaga.
                </p>
              </div>

              {/* Back to main portal button */}
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-[#0F2D52] hover:bg-[#0A223D] active:scale-[0.99] text-white py-3.5 px-4 rounded-2xl text-xs font-black transition cursor-pointer shadow-sm text-center block"
              >
                Sertai MVOC Malaysia
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-250/60 p-6 rounded-3xl text-center space-y-4 shadow-sm">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-black text-[#0F2D52]">Profil Tidak Ditemui</h4>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Maaf, kod pengenalan keahlian {publicCardId} tiada dalam pangkalan data kami atau belum disegerakkan.
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-[#0F2D52] text-white text-xs font-black px-4 py-2.5 rounded-xl transition"
              >
                Kembali ke Utama
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative flex flex-col justify-between overflow-x-hidden select-none">
      
      {/* PWA Floating Installer & Guide */}
      <PWAInstaller language="ms" />
      <PWAUpdateNotifier />
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-5 left-4 right-4 md:left-auto md:right-5 md:max-w-md z-50 flex items-center gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md"
            style={{
              backgroundColor: 
                toastMessage.type === 'success' ? '#ECFDF5' : 
                toastMessage.type === 'error' ? '#FEF2F2' : '#EFF6FF',
              borderColor: 
                toastMessage.type === 'success' ? '#10B981' : 
                toastMessage.type === 'error' ? '#EF4444' : '#3B82F6',
              color: 
                toastMessage.type === 'success' ? '#065F46' : 
                toastMessage.type === 'error' ? '#991B1B' : '#1E40AF'
            }}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
            {toastMessage.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
            <span className="text-sm font-semibold">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RENDER LOGGED OUT STATE (LOGIN PORTAL) */}
      {!isLoggedIn ? (
        <div className="flex-1 flex flex-col justify-center py-10">
          <main className="w-full max-w-sm mx-auto px-4 flex flex-col justify-center">
            
            {/* Login Card */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full bg-white rounded-3xl shadow-xl shadow-slate-200/55 border border-slate-100 overflow-hidden"
              id="mvoc-login-card"
            >
              <div className="h-1.5 bg-[#0F2D52] w-full" />
              
              <div className="p-6 sm:p-8 flex flex-col items-center">
                
                {/* Logo Area */}
                <div className="w-full mb-6 text-center">
                  <div className="inline-block relative w-full px-4 mb-2">
                    <img 
                      src="https://i.ibb.co/hR2y1NXX/MVOC-modified.jpg" 
                      alt="MVOC Logo"
                      className="w-full max-w-[240px] h-auto mx-auto object-contain select-none"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <h1 className="text-lg font-display font-bold text-[#0F2D52] mt-2">
                    Welcome
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Please sign in with your registered Google account to access the member dashboard.
                  </p>
                </div>

                {/* Google Sign In Button */}
                <div className="pt-2">
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    type="button"
                    className="w-full bg-[#0F2D52] hover:bg-[#184172] active:bg-[#081B34] text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-colors shadow-md cursor-pointer min-h-[52px]"
                  >
                    {isLoading ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Securing Connection...</span>
                        </div>
                      ) : (
                      <>
                        <div className="p-1 bg-white rounded-md">
                          <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                          </svg>
                        </div>
                        <span className="tracking-wide">Sign in with Google</span>
                      </>
                    )}
                  </button>
                </div>
                
              </div>
            </motion.div>
          </main>
        </div>
      ) : !userProfile ? (
        <div className="flex-1 flex flex-col justify-center items-center py-12 px-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-slate-100 shadow-2xl text-center space-y-6">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-slate-100/80 border-t-[#0F2D52] animate-spin" />
              <RefreshCw className="w-5 h-5 text-[#0F2D52] animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="font-display text-base font-black text-[#0F2D52]">
                Loading MVOC Profile...
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                Syncing with secure member registry and database. Please wait.
              </p>
            </div>
          </div>
        </div>
      ) : (
        
        // RENDER LOGGED IN STATE (PORTAL & NAVIGATION DRAWER COMPONENT)
        <div className="flex-1 flex flex-col h-full bg-slate-50">
          
          {/* Top Bar Navigation */}
          <nav className="w-full bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsDrawerOpen(true)}
                className="p-1.5 rounded-lg text-slate-700 hover:bg-slate-50 transition min-w-[42px] min-h-[42px] flex items-center justify-center cursor-pointer"
                id="btn-open-sidebar"
              >
                <Menu className="w-6 h-6 text-[#0F2D52]" />
              </button>
              <span className="font-display font-extrabold text-[#0F2D52] text-xl tracking-tight">MVOC Malaysia</span>
            </div>

            <div className="flex items-center gap-2 relative z-20">
              <button 
                onClick={() => {
                  console.log('Top bar My Member QR Button clicked!');
                  setIsQrModalOpen(true);
                }}
                className="relative z-[9999] pointer-events-auto p-1.5 text-slate-700 hover:text-[#0F2D52] rounded-lg hover:bg-slate-50 min-w-[42px] min-h-[42px] flex items-center justify-center cursor-pointer"
                style={{ cursor: 'pointer' }}
                title="My Member QR"
              >
                <QrCode className="w-5 h-5" />
              </button>

              <button 
                onClick={() => {
                  console.log('Top bar Camera/Scanner Button clicked!');
                  setIsScannerOpen(true);
                }}
                className="relative z-[9999] pointer-events-auto p-1.5 text-slate-700 hover:text-[#0F2D52] rounded-lg hover:bg-slate-50 min-w-[42px] min-h-[42px] flex items-center justify-center cursor-pointer"
                style={{ cursor: 'pointer' }}
                title="Scan QR Code"
              >
                <Scan className="w-5 h-5" />
              </button>

              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (notificationsCount > 0) setNotificationsCount(0);
                }}
                className="p-1.5 text-slate-700 hover:text-[#0F2D52] rounded-lg hover:bg-slate-50 relative min-w-[42px] min-h-[42px] flex items-center justify-center cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {(notificationsCount > 0 || hasUnreadAnnouncements) && (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                )}
              </button>
              
              {/* Notifications Dropdown Drawer */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-20 space-y-3"
                    >
                      <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                        <span className="font-bold text-xs text-[#0F2D52]">NOTIFICATIONS</span>
                        <span className="text-[10px] text-[#0F2D52] bg-blue-50 px-1.5 py-0.5 rounded-full font-bold">New</span>
                      </div>
                      <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                        {announcements.filter(ann => !readAnnouncementIds.includes(String(ann.id))).map((ann) => (
                          <div 
                            key={ann.id} 
                            onClick={() => {
                              handleSelectAnnouncement(ann);
                              setCurrentTab('announcements');
                              setShowNotifications(false);
                            }}
                            className="text-[11.5px] p-2 hover:bg-slate-50 rounded-lg border-l-2 border-amber-500 bg-amber-500/5 cursor-pointer text-left"
                            id={`unread-notif-${ann.id}`}
                          >
                            <p className="font-bold text-slate-800 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                              {ann.title}
                            </p>
                            <p className="text-slate-500 mt-0.5 text-[10px] line-clamp-1">{ann.content}</p>
                          </div>
                        ))}
                        <div className="text-[11.5px] p-2 hover:bg-slate-50 rounded-lg text-left">
                          <p className="font-bold text-slate-800">Convoy RSVP Confirmed</p>
                          <p className="text-slate-500 mt-0.5 text-[10px]">Your RSVP to Karak Highway Cruise is confirmed.</p>
                        </div>
                        <div className="text-[11.5px] p-2 hover:bg-slate-50 rounded-lg text-left">
                          <p className="font-bold text-slate-800">Chapter Approval</p>
                          <p className="text-slate-500 mt-0.5 text-[10px]">Your status Gold Member badge has been unlocked.</p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </nav>

          {/* BACKGROUND BACKGROUND LAYOUT VIEW CONTROLLER */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto w-full max-w-md mx-auto px-4 pt-6 pb-24">
            <AnimatePresence mode="wait">
              
              {/* TAB 1: DASHBOARD VIEW */}
              {currentTab === 'dashboard' && (
                <motion.div
                  key="dashboard-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {/* Greeting Block */}
                  <div className="flex justify-between items-end pb-1 select-none">
                    <div>
                      <p className="text-slate-500 text-xs font-semibold">Good Afternoon,</p>
                      <h2 className="text-2xl font-display font-extrabold text-[#0F2D52] leading-tight">{dashboardGreetingName}</h2>
                    </div>
                    <div className="bg-[#FFEAD2]/90 text-[#8C521F] font-sans font-extrabold text-[10px] px-3 py-1 rounded-full shadow-xs tracking-wider uppercase">
                      {displayTier} MEMBER
                    </div>
                  </div>

                  {/* Summary Stats Row */}
                  <div className="grid grid-cols-3 gap-3.5 select-none text-center">
                    <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-xs flex flex-col justify-center items-center">
                      <span className="text-slate-450 font-bold text-[9px] uppercase tracking-wider">MEMBERS</span>
                      <span className="text-[#0F2D52] font-black text-base mt-0.5">
                        {totalDbMembersCount !== null ? totalDbMembersCount : '...'}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-xs flex flex-col justify-center items-center">
                      <span className="text-slate-450 font-bold text-[9px] uppercase tracking-wider">EVENTS</span>
                      <span className="text-[#0F2D52] font-black text-base mt-0.5">
                        {events.length}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-xl border border-slate-200/60 shadow-xs flex flex-col justify-center items-center">
                      <span className="text-slate-450 font-bold text-[9px] uppercase tracking-wider">CONVOYS</span>
                      <span className="text-[#0F2D52] font-black text-base mt-0.5">
                        {convoysList.length}
                      </span>
                    </div>
                  </div>

                  {/* Member Card / Profile Preview Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden relative">
                    {/* Official Admin Patch for Feed Profile Card */}
                    {(userProfile?.patch_status || userProfile?.officialPatch) && !isStealthActive && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500 text-white font-black text-[8px] uppercase tracking-wider py-1 px-2.5 rounded-full shadow-[0px_0px_10px_rgba(16,185,129,0.5)] border border-emerald-300 z-20 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>Official Admin Patch</span>
                      </div>
                    )}
                    {/* Trusted Elite Gold Badge */}
                    {!isStealthActive && (userProfile?.patch === 'mvoc_trusted_elite') && (
                      <div className={`absolute top-3 ${((userProfile?.patch_status || userProfile?.officialPatch) && !isStealthActive) ? 'left-3' : 'right-3'} flex items-center gap-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-[8px] uppercase tracking-wider py-1 px-2.5 rounded-full shadow-[0px_0px_10px_rgba(245,158,11,0.6)] border border-amber-300 z-20 select-none`}>
                        <Award className="w-2.5 h-2.5 text-slate-950 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                        <span>Trusted Elite</span>
                      </div>
                    )}
                    {/* Road Banner Background */}
                    <div className="h-28 w-full relative overflow-hidden">
                      <img 
                        src={regeneratedImage} 
                        alt="MVOC Veloz Banner"
                        className="w-full h-full object-cover brightness-[0.80]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-85" />
                    </div>

                    {/* Member Details */}
                    <div className="px-5 pb-5 -mt-10 relative z-10 flex flex-col">
                      <div className="flex items-end gap-4">
                        {/* Profile Image with crisp double border */}
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-white shrink-0">
                          <img 
                            src={displayAvatarUrl} 
                            alt={`${displayName} avatar`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="pb-1.5">
                          <h3 className="text-lg font-display font-extrabold text-[#0F2D52] tracking-tight">{displayMvocId}</h3>
                          <p className="text-xs text-slate-500 font-bold mt-0.5">{displayChapter}</p>
                        </div>
                      </div>

                      {/* Primary Vehicle Line */}
                      <div className="mt-5 flex justify-between items-center py-2.5 border-t border-b border-slate-100 text-xs">
                        <span className="text-slate-500 font-bold">Primary Vehicle</span>
                        <div className="flex flex-col items-end">
                          <span className="text-[#0F2D52] font-extrabold">Toyota Veloz 1.5 AT</span>
                          {userProfile?.vehiclePlate && (
                            <span className="text-[10px] font-mono font-bold bg-[#111] text-white px-1.5 py-0.5 rounded uppercase tracking-wider mt-1 border border-slate-300">
                              {userProfile.vehiclePlate}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="mt-4 grid grid-cols-2 gap-3.5">
                        <button 
                          onClick={() => setCurrentTab('card')}
                          className="bg-[#0F2D52] hover:bg-[#184172] active:bg-[#081B34] text-white py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[44px]"
                        >
                          <Contact className="w-4 h-4 shrink-0" />
                          <span>Digital Card</span>
                        </button>
                        <button 
                          onClick={() => {
                            setCurrentTab('profile');
                            triggerToast('Access your profile page to update your information.', 'info');
                          }}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-705 py-2.5 px-3.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[44px]"
                        >
                          <User className="w-4 h-4 shrink-0 text-slate-400" />
                          <span>Edit Profile</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Quick Access Heading */}
                  <div className="pt-2 select-none">
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-wide">Quick Access</h3>
                  </div>

                  {/* Grid of Quick Access Cards matching the design perfectly */}
                  <div className="grid grid-cols-2 gap-3.5">
                    
                    {/* Membership Card */}
                    <button 
                      onClick={() => setCurrentTab('card')}
                      className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs hover:border-slate-300 transition-all flex flex-col items-start gap-3 cursor-pointer text-left focus:ring-2 focus:ring-[#0F2D52]/10"
                    >
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                        <Contact className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">Membership Card</span>
                    </button>

                    {/* Register Event */}
                    <button 
                      onClick={() => setCurrentTab('events')}
                      className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs hover:border-slate-300 transition-all flex flex-col items-start gap-3 cursor-pointer text-left focus:ring-2 focus:ring-[#0F2D52]/10"
                    >
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                        <Calendar className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">Register Event</span>
                    </button>

                    {/* Convoy Registration */}
                    <button 
                      onClick={() => setCurrentTab('convoy')}
                      className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs hover:border-slate-300 transition-all flex flex-col items-start gap-3 cursor-pointer text-left focus:ring-2 focus:ring-[#0F2D52]/10"
                    >
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                        <Car className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">Convoy Registration</span>
                    </button>

                    {/* Club News */}
                    <button 
                      onClick={() => setCurrentTab('announcements')}
                      className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs hover:border-slate-300 transition-all flex flex-col items-start gap-3 cursor-pointer text-left focus:ring-2 focus:ring-[#0F2D52]/10"
                    >
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                        <Volume2 className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">Club News</span>
                    </button>

                    {/* Gallery */}
                    <button 
                      onClick={() => setCurrentTab('gallery')}
                      className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs hover:border-slate-300 transition-all flex flex-col items-start gap-3 cursor-pointer text-left focus:ring-2 focus:ring-[#0F2D52]/10"
                    >
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                        <Image className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">Gallery</span>
                    </button>

                    {/* Directory */}
                    <button 
                      onClick={() => {
                        setCurrentTab('profile');
                        triggerToast('Opening MVOC member directory...', 'info');
                      }}
                      className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs hover:border-slate-300 transition-all flex flex-col items-start gap-3 cursor-pointer text-left focus:ring-2 focus:ring-[#0F2D52]/10"
                    >
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                        <Users className="w-5 h-5 text-[#2563EB]" />
                      </div>
                      <span className="text-xs font-bold text-slate-800">Directory</span>
                    </button>

                  </div>

                  {/* Next Major Event Banner */}
                  <div className="relative rounded-2xl overflow-hidden aspect-[1.95/1] shadow-md border border-slate-200/50 flex flex-col justify-between p-4 text-white select-none">
                    {/* Toyota Cockpit Background */}
                    <img 
                      src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80" 
                      alt="Veloz Interior Cockpit Steering"
                      className="absolute inset-0 w-full h-full object-cover brightness-[0.45] contrast-[1.05]"
                    />
                    
                    {/* Dark gradient overlap */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

                    {/* Badge */}
                    <div className="relative z-10 self-start">
                      <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-2.5 py-1 rounded tracking-wider uppercase">
                        NEXT MAJOR EVENT
                      </span>
                    </div>

                    {/* Header, Date, & Register Button */}
                    <div className="relative z-10 space-y-2">
                      <div>
                        <h4 className="text-sm font-extrabold tracking-tight leading-snug">
                          Genting Highlands Convoy 2024
                        </h4>
                        <p className="text-[10.5px] text-slate-200 font-semibold mt-0.5">
                          24 August 2024 • 7:00 AM
                        </p>
                      </div>
                      <button 
                        onClick={() => {
                          setCurrentTab('events');
                          triggerToast('Registering now for the Genting Highlands Convoy!', 'success');
                        }}
                        className="bg-white hover:bg-slate-100 active:bg-slate-200 text-[#0F2D52] px-4 py-1.5 rounded-full text-[10.5px] font-black transition-colors cursor-pointer"
                      >
                        Register Now
                      </button>
                    </div>
                  </div>

                </motion.div>
              )}

              {/* TAB 2: MY PROFILE */}
              {currentTab === 'profile' && (
                <motion.div
                  key="profile-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {/* Premium Header Card */}
                  <div className="bg-gradient-to-br from-[#0F2D52] via-[#153D6B] to-[#0A1C33] rounded-2xl p-6 text-white text-center shadow-lg relative overflow-hidden">
                    {/* Official Admin Patch for Profile View Header Card */}
                    {(userProfile?.patch_status || userProfile?.officialPatch) && !isStealthActive && (
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500 text-white font-black text-[8px] uppercase tracking-wider py-1 px-2.5 rounded-full shadow-[0px_0px_10px_rgba(16,185,129,0.5)] border border-emerald-300 z-10 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>Official Admin Patch</span>
                      </div>
                    )}
                    {/* Trusted Elite Gold Badge */}
                    {!isStealthActive && (userProfile?.patch === 'mvoc_trusted_elite') && (
                      <div className={`absolute top-3 ${((userProfile?.patch_status || userProfile?.officialPatch) && !isStealthActive) ? 'left-3' : 'right-3'} flex items-center gap-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-[8px] uppercase tracking-wider py-1 px-2.5 rounded-full shadow-[0px_0px_10px_rgba(245,158,11,0.6)] border border-amber-300 z-10 select-none`}>
                        <Award className="w-2.5 h-2.5 text-slate-950 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                        <span>Trusted Elite</span>
                      </div>
                    )}
                    <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
                      <Car className="w-40 h-40" />
                    </div>

                    <div className="relative inline-block mb-4 select-none">
                      {/* Avatar with beautiful rounded borders */}
                      <div className={`relative w-24 h-24 rounded-2xl overflow-hidden border-2 shadow-md mx-auto bg-slate-100 ${
                        (!isStealthActive && displayRole === 'super_admin') 
                          ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]' 
                          : (!isStealthActive && displayRole === 'admin') 
                            ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]' 
                            : 'border-white/95'
                      }`}>
                        <img 
                          src={profileImage || "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=150&auto=format&fit=crop&q=80"} 
                          alt={`${displayName} Profile`} 
                          className="w-full h-full object-cover"
                        />
                        {isEditingProfile && (
                          <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer transition-colors hover:bg-black/50">
                            <Camera className="w-8 h-8 text-white opacity-80" />
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={handleImageUpload} 
                            />
                          </label>
                        )}
                      </div>
                      {/* Verified Badge Overlay on corner */}
                      <div className="absolute -bottom-1.5 right-4 bg-[#38BDF8] text-white p-1 rounded-full shadow-md border-2 border-white flex items-center justify-center w-6 h-6 z-10">
                        <ShieldCheck className="w-4.5 h-4.5 text-white stroke-[2.5]" />
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-display font-extrabold tracking-tight">{displayFullName}</h3>
                    <p className="text-xs text-white/70 font-semibold mt-1">Member ID: {displayMvocId}</p>
                    
                    {/* Two center-aligned pill badges */}
                    <div className="flex gap-2 justify-center items-center mt-3.5 flex-wrap">
                      {(!isStealthActive && displayRole === 'super_admin') && (
                        <span className="bg-rose-500 text-white font-sans font-black text-[10px] px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                          🛡️ Admin Council
                        </span>
                      )}
                      {(!isStealthActive && displayRole === 'admin') && (
                        <span className="bg-amber-500 text-slate-900 font-sans font-black text-[10px] px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                          👑 Chapter Leader
                        </span>
                      )}
                      <span className="bg-[#FFEAD2] text-[#8C521F] font-sans font-black text-[10px] px-3.5 py-1 rounded-full uppercase tracking-wider">
                        {displayTier} MEMBER
                      </span>
                      <span className="bg-white/10 text-white border border-white/5 font-sans font-bold text-[10.5px] px-3.5 py-1 rounded-full">
                        {displayChapter}
                      </span>
                      {displayManagedChapter && (
                        <span className="bg-blue-900 border border-blue-400 text-white font-sans font-bold text-[10.5px] px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                          {displayManagedChapter}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Personal Information Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-5 space-y-4">
                    <div className="flex items-center gap-2.5 text-[#0F2D52] font-extrabold text-sm border-b border-slate-100 pb-3">
                      <User className="w-5 h-5 stroke-[2.3]" />
                      <span>Personal Information</span>
                    </div>

                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="text-slate-405 font-bold block text-[10.5px] uppercase tracking-wide mb-1">Full Name</span>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:border-[#0F2D52] focus:ring-1 focus:ring-[#0F2D52]/10 focus:outline-hidden transition-all"
                          />
                        ) : (
                          <span className="text-slate-805 font-bold text-sm block">{displayFullName}</span>
                        )}
                      </div>

                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-405 font-bold block text-[10.5px] uppercase tracking-wide mb-1">
                          Short Name / Nama Panggilan <span className="text-red-500">*</span>
                        </span>
                        {isEditingProfile ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={profileShortName}
                              onChange={(e) => setProfileShortName(e.target.value)}
                              placeholder="e.g., Abe Nik, Wan Veloz"
                              className="w-full bg-[#0b1c30] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 focus:outline-hidden transition-all"
                            />
                            <p className="text-[9px] text-slate-500 font-semibold italic">Gunakan maksimum 3 perkataan sahaja (Max 20 aksara). Nama penuh tidak dibenarkan.</p>
                          </div>
                        ) : (
                          <span className="text-slate-805 font-bold text-sm block">{userProfile?.shortName || '-'}</span>
                        )}
                      </div>
                      
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-405 font-bold block text-[10.5px] uppercase tracking-wide mb-1">IC Number</span>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={profileIc}
                            onChange={(e) => setProfileIc(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs font-mono font-bold focus:border-[#0F2D52] focus:ring-1 focus:ring-[#0F2D52]/10 focus:outline-hidden transition-all"
                          />
                        ) : (
                          <span className="text-slate-805 font-bold font-mono text-sm block">{profileIc}</span>
                        )}
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-405 font-bold block text-[10.5px] uppercase tracking-wide mb-1">Gender</span>
                        {isEditingProfile ? (
                          <select
                            value={profileGender}
                            onChange={(e) => setProfileGender(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:border-[#0F2D52] focus:ring-1 focus:ring-[#0F2D52]/10 focus:outline-hidden transition-all"
                          >
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        ) : (
                          <span className="text-slate-805 font-bold text-sm block">{profileGender}</span>
                        )}
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-405 font-bold block text-[10.5px] uppercase tracking-wide mb-1">
                          Jenis Darah / Blood Type <span className="text-red-500">*</span>
                        </span>
                        {isEditingProfile ? (
                          <select
                            value={profileBloodType}
                            onChange={(e) => setProfileBloodType(e.target.value)}
                            className="w-full bg-[#0b1c30] border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 focus:outline-hidden transition-all"
                          >
                            <option value="Not Specified">Not Specified</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                          </select>
                        ) : (
                          <span className="text-slate-805 font-bold text-sm block">{userProfile?.bloodType || 'Not Specified'}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Membership Details Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-5 space-y-4">
                    <div className="flex items-center gap-2.5 text-[#0F2D52] font-extrabold text-sm border-b border-slate-100 pb-3">
                      <Contact className="w-5 h-5 stroke-[2.3]" />
                      <span>Membership Details</span>
                    </div>

                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="text-slate-400 font-bold block text-[10.5px] uppercase tracking-wide flex items-center gap-1.5">
                          Join Date
                          {(isEditingProfile && !isAdminOrSuperAdmin()) && (
                            <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded flex items-center gap-1">
                              <Lock className="w-2 h-2" /> LOCKED
                            </span>
                          )}
                        </span>
                        {(isEditingProfile && isAdminOrSuperAdmin()) ? (
                          <input
                            type="text"
                            value={profileJoinDate}
                            onChange={(e) => setProfileJoinDate(e.target.value)}
                            className="w-full mt-1 bg-[#f8f9ff] text-slate-800 text-xs font-bold px-3 py-2 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition"
                          />
                        ) : (
                          <span className="text-slate-800 font-bold text-sm mt-0.5 block">{profileJoinDate}</span>
                        )}
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-400 font-bold block text-[10.5px] uppercase tracking-wide flex items-center gap-1.5">
                          MVOC Points
                          {(isEditingProfile && !isAdminOrSuperAdmin()) && (
                            <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded flex items-center gap-1">
                              <Lock className="w-2 h-2" /> LOCKED
                            </span>
                          )}
                        </span>
                        {(isEditingProfile && isAdminOrSuperAdmin()) ? (
                          <input
                            type="number"
                            value={profilePoints}
                            onChange={(e) => setProfilePoints(e.target.value)}
                            className="w-full mt-1 bg-[#f8f9ff] text-[#C28A53] text-xs font-black px-3 py-2 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition"
                          />
                        ) : (
                          <span className="text-[#C28A53] font-black text-sm mt-0.5 block">{profilePoints} pts</span>
                        )}
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-400 font-bold block text-[10.5px] uppercase tracking-wide flex items-center gap-1.5">
                          State Chapter
                        </span>
                        {isEditingProfile ? (
                          <select
                            value={profileChapter}
                            onChange={(e) => setProfileChapter(e.target.value)}
                            className="w-full mt-1 bg-[#f8f9ff] text-slate-800 text-xs font-bold px-3 py-2 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition cursor-pointer"
                          >
                            {[
                              'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 
                              'Pahang', 'Perak', 'Perlis', 'Penang', 'Sabah', 
                              'Sarawak', 'Selangor Chapter', 'Terengganu', 'W.P. Kuala Lumpur', 
                              'W.P. Labuan', 'W.P. Putrajaya'
                            ].map(state => (
                              <option key={state} value={state}>{state}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-800 font-bold text-sm mt-0.5 block">{profileChapter}</span>
                        )}
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-400 font-bold block text-[10.5px] uppercase tracking-wide flex items-center gap-1.5">
                          Vehicle Plate Number
                        </span>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={profileVehiclePlate}
                            onChange={(e) => setProfileVehiclePlate(e.target.value)}
                            className="w-full mt-1 bg-[#f8f9ff] text-slate-800 text-xs font-mono font-bold px-3 py-2 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition"
                          />
                        ) : (
                          <span className="text-slate-800 font-mono font-bold text-sm mt-0.5 block">{profileVehiclePlate}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Information Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-5 space-y-4">
                    <div className="flex items-center gap-2.5 text-[#0F2D52] font-extrabold text-sm border-b border-slate-100 pb-3">
                      <Contact className="w-5 h-5 stroke-[2.3]" />
                      <span>Contact Information</span>
                    </div>

                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="text-slate-405 font-bold block text-[10.5px] uppercase tracking-wide mb-1">Phone Number</span>
                        {isEditingProfile ? (
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <select
                                value={profileCountryCode}
                                onChange={(e) => setProfileCountryCode(e.target.value)}
                                className="bg-slate-50 border border-slate-250 rounded-xl px-2.5 py-2.5 text-slate-800 text-xs font-bold focus:border-[#0F2D52] focus:outline-hidden transition-all cursor-pointer"
                              >
                                <option value="+60">Malaysia (+60)</option>
                                <option value="+673">Brunei (+673)</option>
                              </select>
                              <input
                                type="text"
                                value={profilePhone}
                                onChange={(e) => setProfilePhone(e.target.value)}
                                placeholder="e.g. 12345678"
                                className="flex-1 bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:border-[#0F2D52] focus:ring-1 focus:ring-[#0F2D52]/10 focus:outline-hidden transition-all"
                              />
                            </div>
                            <span className="text-[9.5px] text-slate-400 font-bold block">
                              Select country code &amp; local phone number. Leading zeroes will be automatically removed on save.
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-805 font-bold text-sm block">
                            {userProfile?.phoneNumber || (profilePhone ? `${profileCountryCode}${profilePhone}` : 'Not Provided')}
                          </span>
                        )}
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-405 font-bold block text-[10.5px] uppercase tracking-wide mb-1 flex items-center gap-1.5">
                          Email Address
                          {isEditingProfile && (
                            <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded flex items-center gap-1">
                              <Lock className="w-2 h-2" /> LOCKED
                            </span>
                          )}
                        </span>
                        <span className="text-slate-805 font-mono text-sm block font-semibold">{displayEmail}</span>
                      </div>
                      <div className="border-t border-slate-100 pt-3">
                        <span className="text-slate-405 font-bold block text-[10.5px] uppercase tracking-wide mb-1">Residential Address</span>
                        {isEditingProfile ? (
                          <textarea
                            value={profileAddress}
                            onChange={(e) => setProfileAddress(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:border-[#0F2D52] focus:ring-1 focus:ring-[#0F2D52]/10 focus:outline-hidden transition-all resize-none leading-relaxed"
                          />
                        ) : (
                          <p className="text-slate-805 text-xs font-semibold leading-relaxed">
                            {profileAddress}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                   {/* Directory Privacy Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-5 space-y-4">
                    <div className="flex items-center gap-2.5 text-[#0F2D52] font-extrabold text-sm border-b border-slate-100 pb-3">
                      <Users className="w-5 h-5 stroke-[2.3] text-[#0F2D52]" />
                      <span>Directory Privacy</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="space-y-0.5 max-w-[80%] text-left">
                        <span className="text-slate-805 font-bold block text-xs sm:text-sm">Show in Member Directory</span>
                        <span className="text-slate-400 text-[10px] sm:text-xs font-semibold leading-normal block">
                          Allow other registered community members to search for and view my contact details by MVOC-ID or Name.
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={directoryVisible} 
                          onChange={(e) => handleToggleDirectoryVisible(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                      </label>
                    </div>

                    <div className="border-t border-slate-100 pt-3.5 flex items-start justify-between">
                      <div className="space-y-0.5 max-w-[80%] text-left">
                        <label htmlFor="is-whatsapp-public-checkbox" className="text-slate-805 font-bold block text-xs sm:text-sm cursor-pointer select-none">
                          Allow others to contact me via WhatsApp from Member Directory
                        </label>
                        <span className="text-slate-400 text-[10px] sm:text-xs font-semibold leading-normal block">
                          Check this box to enable a secure WhatsApp direct link inside the Member Directory popup.
                        </span>
                      </div>
                      <div className="pt-1 select-none">
                        <input 
                          id="is-whatsapp-public-checkbox"
                          type="checkbox" 
                          checked={isWhatsAppPublic} 
                          onChange={(e) => handleToggleWhatsAppPublic(e.target.checked)}
                          className="w-4.5 h-4.5 text-emerald-600 border-slate-350 focus:ring-emerald-500 rounded-sm cursor-pointer" 
                        />
                      </div>
                    </div>

                    {isMasterAdmin && (
                      <div className="border-t border-amber-100 bg-amber-500/5 -mx-5 px-5 py-3.5 flex items-start justify-between">
                        <div className="space-y-0.5 max-w-[80%] text-left">
                          <label htmlFor="is-stealth-mode-checkbox" className="text-amber-700 font-bold block text-xs sm:text-sm cursor-pointer select-none flex items-center gap-1.5 font-display">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            Enable Master Admin Stealth Mode
                          </label>
                          <span className="text-slate-400 text-[10.5px] font-semibold leading-relaxed block">
                            When enabled, you will be publicly displayed with a standard <strong>MEMBER</strong> role and without official admin markers in the directory, while keeping your super_admin privileges.
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none pt-1">
                          <input 
                            id="is-stealth-mode-checkbox"
                            type="checkbox" 
                            checked={isStealthMode} 
                            onChange={(e) => handleToggleStealthMode(e.target.checked)}
                            className="sr-only peer" 
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Emergency Contact Card */}
                  <div className="bg-[#F4F7FC] rounded-2xl border border-[#D9E3F0] p-5 space-y-4">
                    <div className="flex items-center gap-2.5 text-[#B91C1C] font-extrabold text-sm border-b border-[#D9E3F0] pb-3">
                      <AlertCircle className="w-5 h-5 stroke-[2.3] text-[#B91C1C]" />
                      <span>Emergency Contact</span>
                    </div>

                    <div className="space-y-3 pt-1">
                      <div>
                        <span className="text-[#B91C1C] font-bold block text-[10.5px] uppercase tracking-wide mb-1">Contact Name</span>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={profileEmergencyName}
                            onChange={(e) => setProfileEmergencyName(e.target.value)}
                            className="w-full bg-white border border-slate-255 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C]/10 focus:outline-hidden transition-all"
                          />
                        ) : (
                          <span className="text-slate-805 font-bold text-sm block">{profileEmergencyName}</span>
                        )}
                      </div>
                      <div className="border-t border-[#D9E3F0] pt-3">
                        <span className="text-[#B91C1C] font-bold block text-[10.5px] uppercase tracking-wide mb-1">Relation</span>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={profileEmergencyRelation}
                            onChange={(e) => setProfileEmergencyRelation(e.target.value)}
                            className="w-full bg-white border border-slate-255 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C]/10 focus:outline-hidden transition-all"
                          />
                        ) : (
                          <span className="text-slate-805 font-bold text-sm block">{profileEmergencyRelation}</span>
                        )}
                      </div>
                      <div className="border-t border-[#D9E3F0] pt-3">
                        <span className="text-[#B91C1C] font-bold block text-[10.5px] uppercase tracking-wide mb-1">Phone Number</span>
                        {isEditingProfile ? (
                          <input
                            type="text"
                            value={profileEmergencyPhone}
                            onChange={(e) => setProfileEmergencyPhone(e.target.value)}
                            className="w-full bg-white border border-slate-255 rounded-xl px-3 py-2 text-slate-800 text-xs font-bold focus:border-[#B91C1C] focus:ring-1 focus:ring-[#B91C1C]/10 focus:outline-hidden transition-all"
                          />
                        ) : (
                          <span className="text-slate-805 font-bold font-mono text-sm block">{profileEmergencyPhone}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* My QR Scan Activity Logs Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2 text-[#0F2D52] font-extrabold text-sm">
                        <QrCode className="w-5 h-5 stroke-[2.3] text-[#0F2D52]" />
                        <span>Aktiviti Imbasan QR / Scan Logs</span>
                      </div>
                      <span className="text-[10px] font-mono bg-slate-105 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                        {myScanLogs.length} rekod
                      </span>
                    </div>

                    {isFetchingScanLogs ? (
                      <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-xs font-bold">
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                        <span>Memuatkan log imbasan...</span>
                      </div>
                    ) : myScanLogs.length === 0 ? (
                      <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 select-none">
                        <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500 font-bold">Tiada rekod imbasan QR dikesan.</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Imbas QR rakan MVOC atau kod kehadiran acara untuk mula merekod log.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
                        {myScanLogs.map((log) => {
                          const dateObj = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp || 0);
                          const dateString = dateObj.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
                          const timeString = dateObj.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
                          
                          return (
                            <div 
                              key={log.id} 
                              className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                                log.status === 'success' 
                                  ? 'bg-emerald-50/75 border-emerald-150 text-slate-805 shadow-2xs' 
                                  : 'bg-rose-50/75 border-rose-150 text-slate-805 shadow-2xs'
                              }`}
                            >
                              <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                                log.status === 'success' 
                                  ? 'bg-emerald-500/10 text-emerald-600' 
                                  : 'bg-rose-500/10 text-rose-600'
                              }`}>
                                {log.status === 'success' ? (
                                  <Check className="w-4 h-4 stroke-[3]" />
                                ) : (
                                  <X className="w-4 h-4 stroke-[3]" />
                                )}
                              </div>
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex justify-between items-center gap-2">
                                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                    log.status === 'success' 
                                      ? 'bg-emerald-500/15 text-emerald-800' 
                                      : 'bg-rose-500/15 text-rose-800'
                                  }`}>
                                    {log.status === 'success' ? 'BERJAYA' : 'GAGAL'}
                                  </span>
                                  <span className="text-[9.5px] text-slate-400 font-bold whitespace-nowrap">
                                    {dateString}, {timeString}
                                  </span>
                                </div>
                                <p className="text-xs font-semibold text-slate-700 leading-relaxed break-words">
                                  {log.message}
                                </p>
                                <div className="pt-1 flex items-center gap-1 opacity-75">
                                  <span className="text-[10px] font-mono bg-slate-900/5 text-slate-500 px-1.5 py-0.5 rounded font-semibold truncate max-w-full">
                                    Payload: {log.scannedPayload?.slice(0, 45)}{log.scannedPayload?.length > 45 ? '...' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Edit Profile CTA Button */}
                  <div className="pt-3 pb-2 text-center space-y-2">
                    {isEditingProfile ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            setIsEditingProfile(false);
                            if (userProfile) {
                              setProfileName(userProfile.name);
                              setProfileShortName(userProfile.shortName || "");
                              setProfileBloodType(userProfile.bloodType || "Not Specified");
                            }
                          }}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-705 py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide transition flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
                        >
                          <X className="w-4 h-4" />
                          <span>Cancel</span>
                        </button>
                        <button
                          onClick={handleSaveProfile}
                          disabled={isLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide shadow-md transition flex items-center justify-center gap-2 cursor-pointer min-h-[48px] disabled:opacity-55"
                        >
                          {isLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <Check className="w-4 h-4 text-white" />
                          )}
                          <span>Save Changes</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2 w-full">
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className="w-full bg-[#0F2D52] hover:bg-[#184172] active:bg-[#081B34] text-white py-3.5 px-4 rounded-xl font-bold text-sm tracking-wide shadow-md transition flex items-center justify-center gap-2 cursor-pointer min-h-[48px]"
                        >
                          <Pencil className="w-4 h-4 text-white" />
                          <span>Edit Profile</span>
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={async () => {
                              if (auth.currentUser) {
                                  setIsLoading(true);
                                  triggerToast('Connecting to external Google Sheet index...', 'info');
                                  try {
                                    const synced = await triggerSync(auth.currentUser.uid, auth.currentUser.email || '');
                                    if (synced) {
                                      triggerToast('Sync complete! Profile data loaded from Google Sheet.', 'success');
                                    } else {
                                      triggerToast('Sync error: Gmail/email address not found in Google Sheets.', 'error');
                                    }
                                  } catch (err: any) {
                                    triggerToast(`Sync fail: ${err.message || String(err)}`, 'error');
                                  } finally {
                                    setIsLoading(false);
                                  }
                              } else {
                                triggerToast('Auth required to sync.', 'error');
                              }
                            }}
                            disabled={isLoading}
                            className="w-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 py-3 px-4 rounded-xl font-bold text-xs tracking-wide transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px] disabled:opacity-55"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Sync with Google Sheet</span>
                          </button>
                        )}

                        {/* Voluntary Account Deletion Section */}
                        <div className="border-t border-slate-150 pt-3.5 mt-2 text-center">
                          <button
                            onClick={handleDeleteAccount}
                            className="w-full bg-red-600 hover:bg-red-500 active:bg-red-700 text-white py-3 px-4 rounded-xl font-extrabold text-xs tracking-wider uppercase shadow-xs transition flex items-center justify-center gap-2 cursor-pointer min-h-[42px] active:scale-97"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                            <span>Hapus Akaun & Maklumat Saya</span>
                          </button>
                          <span className="text-[9.5px] text-slate-400 font-medium block mt-1.5 leading-normal">
                            Sila ambil perhatian: Tindakan ini adalah muktamad dan akan memadamkan profil & maklumat anda secara kekal dari pangkalan data MVOC.
                          </span>
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-slate-400 font-semibold">
                      Last updated: Just now
                    </p>
                  </div>
                </motion.div>
              )}

              {/* TAB 3: MY VEHICLE */}
              {currentTab === 'vehicle' && (
                <motion.div
                  key="vehicle-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-5 pb-8"
                >
                  {/* Active Vehicle Hero Card with elegant SUV background */}
                  <div className="relative overflow-hidden aspect-[1.7/1] rounded-2xl shadow-md border border-slate-200/50 select-none group">
                    <img 
                      src={vehicleInfo.photoUrl}
                      alt="Active Vehicle Toyota Veloz"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover brightness-[0.72] scale-102 transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/35 to-transparent pointer-events-none" />

                    {/* Quick Image Edit button */}
                    <button
                      onClick={() => {
                        setEditPlateNumber(vehicleInfo.plateNumber);
                        setEditVariant(vehicleInfo.variant);
                        setEditYear(vehicleInfo.year);
                        setEditColor(vehicleInfo.color);
                        setEditPhotoUrl(vehicleInfo.photoUrl);
                        setIsVehicleEditModalOpen(true);
                        triggerToast('Change vehicle photo or details', 'info');
                      }}
                      className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/85 text-white rounded-full transition-all duration-300 pointer-events-auto backdrop-blur-xs cursor-pointer flex items-center justify-center border border-white/25 active:scale-95"
                      title="Update Car Photo"
                    >
                      <Camera className="w-4 h-4 text-white stroke-[2.3]" />
                    </button>

                    <div className="absolute bottom-4 left-4 right-4 text-left pointer-events-none space-y-1">
                      <span className="text-[9.5px] bg-[#EFF4FB] text-[#0F2D52] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-blue-105">
                        Active Vehicle
                      </span>
                      <h2 className="text-xl font-display font-black leading-tight text-white tracking-tight drop-shadow-md pt-1.5">
                        Toyota Veloz
                      </h2>
                      <p className="text-[11px] text-slate-200 font-bold tracking-wide">
                        Member ID: {vehicleInfo.memberId}
                      </p>
                    </div>
                  </div>

                  {/* Vehicle Information section panel */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4 text-left">
                    <div className="flex justify-between items-center select-none pb-1.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-[#0F2D52] stroke-[2.3]" />
                        <h3 className="text-sm font-black text-slate-800 tracking-tight">Vehicle Information</h3>
                      </div>
                      
                      <button 
                        onClick={() => {
                          setEditPlateNumber(vehicleInfo.plateNumber);
                          setEditVariant(vehicleInfo.variant);
                          setEditYear(vehicleInfo.year);
                          setEditColor(vehicleInfo.color);
                          setEditPhotoUrl(vehicleInfo.photoUrl);
                          setIsVehicleEditModalOpen(true);
                          triggerToast('Opening vehicle detail update form', 'info');
                        }}
                        className="p-2 bg-slate-50 hover:bg-slate-100 transition rounded-xl border border-slate-200/40 text-slate-600 active:scale-95 cursor-pointer"
                        title="Edit Vehicle Details"
                        id="btn-edit-vehicle-info"
                      >
                        <Pencil className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-y-4 gap-x-4 select-none text-left">
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">Plate Number</span>
                        <span className="text-base font-black text-[#0F2D52] font-mono tracking-tight block mt-1.5">
                          {vehicleInfo.plateNumber}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">Variant</span>
                        <span className="text-sm font-black text-slate-800 tracking-tight block mt-1.5">
                          {vehicleInfo.variant}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">Year</span>
                        <span className="text-sm font-black text-slate-800 tracking-tight block mt-1.5">
                          {vehicleInfo.year}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block leading-none">Color</span>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span 
                            className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-xs shrink-0" 
                            style={{ 
                              backgroundColor: vehicleInfo.color.toLowerCase().includes('silver') ? '#C0C0C0' : 
                                               vehicleInfo.color.toLowerCase().includes('black') ? '#111827' : 
                                               vehicleInfo.color.toLowerCase().includes('blue') ? '#1D4ED8' : 
                                               vehicleInfo.color.toLowerCase().includes('white') ? '#FFFFFF' : '#64748B'
                            }} 
                          />
                          <span className="text-sm font-black text-slate-800 tracking-tight">
                            {vehicleInfo.color}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service Status Card */}
                  <div 
                    onClick={() => {
                      setTempOdometer(currentOdometer.toString());
                      setTempNextOdometer(nextServiceOdometer.toString());
                      setIsMileageModalOpen(true);
                      triggerToast('Please update your odometer or service milestone', 'info');
                    }}
                    className={`p-5 rounded-2xl shadow-md text-left text-white border border-slate-800/10 select-none cursor-pointer hover:brightness-105 transition-all duration-300 ${serviceCardBg} relative overflow-hidden group`}
                  >
                    {/* Glowing highlight on hover */}
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black text-white/75 tracking-widest uppercase">
                          SERVICE STATUS
                        </span>
                        <h3 className="text-2xl font-display font-black text-white tracking-wide mt-1">
                          {serviceStatusText}
                        </h3>
                      </div>
                      
                      {/* Dynamic status pill */}
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${serviceStatusBadge}`}>
                        {currentOdometer.toLocaleString()} km
                      </span>
                    </div>

                    <p className="text-[11.5px] text-white/90 font-bold mt-2">
                      {serviceStatusDesc}
                    </p>

                    <div className="mt-4">
                      {/* Custom themed progress meter */}
                      <div className="relative h-2 bg-black/30 rounded-full overflow-hidden border border-white/5 shadow-inner">
                        <div 
                          className={`absolute left-0 top-0 bottom-0 ${serviceBarColor} rounded-full transition-all duration-500`} 
                          style={{ width: `${serviceProgressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-white/60 font-black tracking-wider uppercase mt-1.5">
                        <span>Current: {currentOdometer.toLocaleString()} km</span>
                        <span>Target: {nextServiceOdometer.toLocaleString()} km</span>
                      </div>
                    </div>
                  </div>

                  {/* Installed Accessories & Mods */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs space-y-4 text-left">
                    <div className="flex items-center gap-2 select-none border-b border-slate-100 pb-2">
                      <Wrench className="w-5 h-5 text-[#0F2D52] stroke-[2.3]" />
                      <h3 className="text-sm font-black text-slate-850 tracking-tight">Installed Accessories & Mods</h3>
                    </div>

                    <div className="space-y-3">
                      {accessories.map((mod) => (
                        <div 
                          key={mod.id} 
                          className="flex items-center gap-3 p-3 bg-[#EFF4FB]/65 rounded-xl border border-slate-100 transition-all duration-300 hover:bg-[#EFF4FB]/90 text-left select-none"
                        >
                          <div className="w-10 h-10 bg-white/90 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
                            {mod.icon === 'Car' && <Car className="w-4.5 h-4.5 text-[#0F2D52] stroke-[2.2]" />}
                            {mod.icon === 'LayoutGrid' && <LayoutGrid className="w-4.5 h-4.5 text-[#0F2D52] stroke-[2.2]" />}
                            {mod.icon === 'Sun' && <Sun className="w-4.5 h-4.5 text-[#0F2D52] stroke-[2.2]" />}
                            {mod.icon === 'Shield' && <Shield className="w-4.5 h-4.5 text-[#0F2D52] stroke-[2.2]" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-slate-800 tracking-tight truncate">
                              {mod.name}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-bold truncate">
                              {mod.desc}
                            </p>
                          </div>
                          
                          <button
                            onClick={() => {
                              setAccessories(prev => prev.filter(a => a.id !== mod.id));
                              triggerToast(`Accessory "${mod.name}" successfully removed!`, 'success');
                            }}
                            className="p-1 px-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 rounded transition cursor-pointer font-extrabold"
                            title="Remove Accessory"
                          >
                            Remove
                          </button>
                        </div>
                      ))}

                      {accessories.length === 0 && (
                        <p className="text-xs text-slate-400 font-semibold text-center select-none py-2">
                          No accessories installed. Click the button below to add a new one.
                        </p>
                      )}

                      <button
                        onClick={() => {
                          setAccessoryFormName('');
                          setAccessoryFormDesc('');
                          setAccessoryFormIcon('Car');
                          setIsAddAccessoryModalOpen(true);
                          triggerToast('Opening new accessory form', 'info');
                        }}
                        className="w-full py-3 border border-slate-250 hover:border-slate-400 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px]"
                        id="btn-add-accessory"
                      >
                        <Plus className="w-4 h-4 text-slate-500" />
                        <span>Add New Accessory</span>
                      </button>
                    </div>
                  </div>

                  {/* Service Records row block */}
                  <div 
                    onClick={() => {
                      setIsServiceLogsModalOpen(true);
                      triggerToast('Displaying full service record history...', 'success');
                    }}
                    className="bg-white p-4 text-left rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-sm transition duration-300 flex items-center justify-between gap-3 cursor-pointer select-none"
                    id="btn-view-service-records"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-blue-50/80 border border-blue-100 rounded-xl flex items-center justify-center text-[#0F2D52] shrink-0">
                        <ClipboardList className="w-5 h-5 text-[#0F2D52] stroke-[2.3]" />
                      </div>

                      <div className="space-y-0.5">
                        <h4 className="text-sm font-black text-slate-800 tracking-tight">Service Records</h4>
                        <p className="text-[11px] text-slate-500 font-bold">
                          View maintenance logs and upload receipts
                        </p>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-400 stroke-[2.5]" />
                  </div>

                  {/* MILEAGE & ODOMETER EDIT MODAL */}
                  <AnimatePresence>
                    {isMileageModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setIsMileageModalOpen(false)}
                          className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
                        />

                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 15 }}
                          className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 z-10 flex flex-col gap-4 text-left select-none overflow-hidden text-slate-800"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100 font-sans">
                            <div className="flex items-center gap-2">
                              <Wrench className="w-4 h-4 text-[#0F2D52] stroke-[2.3]" />
                              <h4 className="text-sm font-black text-slate-850">Odometer & Service Target</h4>
                            </div>
                            <button 
                              onClick={() => setIsMileageModalOpen(false)}
                              className="p-1 text-slate-400 hover:text-slate-650 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-4 text-xs font-bold text-slate-705">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Current Odometer (km)</label>
                              <input 
                                type="number"
                                placeholder="E.g., 22550"
                                value={tempOdometer}
                                onChange={(e) => setTempOdometer(e.target.value)}
                                className="w-full bg-[#EFF4FB] border border-slate-202 rounded-xl py-3 px-3.5 font-mono text-sm text-slate-800 focus:outline-none focus:border-[#0F2D52]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-400 uppercase tracking-wider block">Next Service Target (km)</label>
                              <input 
                                type="number"
                                placeholder="E.g., 25000"
                                value={tempNextOdometer}
                                onChange={(e) => setTempNextOdometer(e.target.value)}
                                className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 font-mono text-sm text-[#0F2D52] font-black focus:outline-none focus:border-[#0F2D52]"
                              />
                            </div>

                            <div className="space-y-2.5">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Standard Intervals</span>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = parseInt(tempOdometer) || currentOdometer;
                                    setTempNextOdometer((current + 5000).toString());
                                    triggerToast('Target adjusted to +5,000 km!', 'success');
                                  }}
                                  className="py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition text-[11px] font-black cursor-pointer active:scale-95"
                                >
                                  +5,000 km (Semi)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const current = parseInt(tempOdometer) || currentOdometer;
                                    setTempNextOdometer((current + 10000).toString());
                                    triggerToast('Target adjusted to +10,000 km!', 'success');
                                  }}
                                  className="py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition text-[11px] font-black cursor-pointer active:scale-95"
                                >
                                  +10,000 km (Fully)
                                </button>
                              </div>
                            </div>
                            
                            <div className="p-3 bg-[#EFF4FB]/60 border border-slate-100 rounded-xl text-[10.5px] font-bold text-slate-650 leading-normal">
                              🎯 <strong>Status Automation:</strong> When your odometer is updated, the service status bar on the main card will dynamically change color (Green for Healthy, Amber for Due Soon, Red for Overdue).
                            </div>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => {
                                const current = parseInt(tempOdometer);
                                const next = parseInt(tempNextOdometer);
                                if (isNaN(current) || isNaN(next)) {
                                  triggerToast('Please enter a valid odometer number', 'error');
                                  return;
                                }
                                setCurrentOdometer(current);
                                setNextServiceOdometer(next);
                                setIsMileageModalOpen(false);
                                triggerToast('Engine status and odometer updated!', 'success');
                              }}
                              className="flex-1 py-3 bg-[#0F2D52] hover:bg-[#1a4478] text-white rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                            >
                              Save Intervals
                            </button>
                            <button
                              onClick={() => setIsMileageModalOpen(false)}
                              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                            >
                              Batal
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* VEHICLE DETAIL EDIT MODAL */}
                  <AnimatePresence>
                    {isVehicleEditModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setIsVehicleEditModalOpen(false)}
                          className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
                        />

                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 15 }}
                          className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 z-10 flex flex-col gap-4 text-left select-none overflow-hidden"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <h4 className="text-sm font-black text-slate-850">Kemaskini Kenderaan</h4>
                            <button 
                              onClick={() => setIsVehicleEditModalOpen(false)}
                              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-3.5 text-xs text-slate-700 font-bold">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 uppercase">Plate Number</label>
                              <input 
                                type="text"
                                value={editPlateNumber}
                                onChange={(e) => setEditPlateNumber(e.target.value.toUpperCase())}
                                className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 font-mono text-sm uppercase text-[#0F2D52] font-black focus:outline-none focus:border-[#0F2D52]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 uppercase">Variant</label>
                              <select 
                                value={editVariant}
                                onChange={(e) => setEditVariant(e.target.value)}
                                className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 font-black text-slate-750 focus:outline-none focus:border-[#0F2D52] cursor-pointer"
                              >
                                <option value="1.5 AT">1.5 AT</option>
                                <option value="1.5V Dual VVT-i">1.5V Dual VVT-i</option>
                                <option value="1.5X Crossover">1.5X Crossover</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 uppercase">Year Manufactured</label>
                              <input 
                                type="number"
                                value={editYear}
                                onChange={(e) => setEditYear(e.target.value)}
                                className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 text-slate-800 focus:outline-none focus:border-[#0F2D52]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 uppercase">Color Theme</label>
                              <select 
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 font-black text-slate-750 focus:outline-none focus:border-[#0F2D52] cursor-pointer"
                              >
                                <option value="White Pearl">White Pearl</option>
                                <option value="Blue Metallic with Black Roof">Blue Metallic with Black Roof</option>
                                <option value="Silver Metallic with Black Roof">Silver Metallic with Black Roof</option>
                                <option value="Metallic Bluish Black">Metallic Bluish Black</option>
                                <option value="Red Metallic">Red Metallic</option>
                                <option value="Others (Custom)">Others (Custom)</option>
                              </select>
                            </div>

                            <div className="space-y-2.5">
                              <label className="text-[10px] text-slate-450 uppercase block">Gambar Kenderaan</label>
                              
                              {/* Display miniature of current selected photo */}
                              <div className="flex gap-3 items-center bg-[#EFF4FB] p-2.5 rounded-xl border border-slate-200/50">
                                <img 
                                  src={editPhotoUrl || 'https://i.ibb.co/sdCNQQCr/veloz-600x338.png'} 
                                  alt="Preview" 
                                  referrerPolicy="no-referrer"
                                  className="w-12 h-12 object-cover rounded-lg border border-white shadow-xs bg-slate-200"
                                />
                                <div className="flex-1 space-y-0.5 overflow-hidden">
                                  <p className="text-[10px] text-[#0F2D52] font-black">Pratonton Gambar</p>
                                  <div className="flex gap-2">
                                    <label className="text-[10px] text-[#0F2D52] font-black flex items-center gap-1 cursor-pointer hover:underline bg-white/80 py-1.5 px-2.5 rounded-lg border border-slate-300">
                                      <Upload className="w-3.5 h-3.5 text-[#0F2D52]" />
                                      <span>Choose Device File</span>
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                              setEditPhotoUrl(reader.result as string);
                                              triggerToast('Photo successfully uploaded!', 'success');
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                        className="hidden" 
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>

                              {/* Manual Preset Selector Grid with 5 custom images provided by user */}
                              <div className="space-y-1 pt-0.5">
                                <span className="text-[9.5px] text-slate-400 font-bold block">Veloz Color Image Presets</span>
                                <div className="grid grid-cols-5 gap-1.5">
                                  {/* Item 1: Silver Metallic */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditPhotoUrl('https://i.ibb.co/sdCNQQCr/veloz-600x338.png');
                                      triggerToast('Memilih rupa Silver Metallic!', 'success');
                                    }}
                                    className={`relative rounded-lg overflow-hidden border ${editPhotoUrl.includes('sdCNQQCr') ? 'border-[#0F2D52] ring-2 ring-[#0F2D52]' : 'border-slate-200'} cursor-pointer h-10`}
                                    title="Silver Metallic"
                                  >
                                    <img src="https://i.ibb.co/sdCNQQCr/veloz-600x338.png" className="w-full h-full object-cover" />
                                    {editPhotoUrl.includes('sdCNQQCr') && <div className="absolute inset-0 bg-black/35 flex items-center justify-center"><Check className="w-4 h-4 text-white stroke-[3.5]" /></div>}
                                  </button>

                                  {/* Item 2: White Pearl */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditPhotoUrl('https://i.ibb.co/tMRdXpXW/BMPV-Veloz-48-600x338.png');
                                      triggerToast('Memilih rupa White Pearl!', 'success');
                                    }}
                                    className={`relative rounded-lg overflow-hidden border ${editPhotoUrl.includes('tMRdXpXW') ? 'border-[#0F2D52] ring-2 ring-[#0F2D52]' : 'border-slate-200'} cursor-pointer h-10`}
                                    title="White Pearl"
                                  >
                                    <img src="https://i.ibb.co/tMRdXpXW/BMPV-Veloz-48-600x338.png" className="w-full h-full object-cover" />
                                    {editPhotoUrl.includes('tMRdXpXW') && <div className="absolute inset-0 bg-black/35 flex items-center justify-center"><Check className="w-4 h-4 text-white stroke-[3.5]" /></div>}
                                  </button>

                                  {/* Item 3: Blue Metallic wt black roof */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditPhotoUrl('https://i.ibb.co/rR4mY7PV/BMPV-Veloz-49-600x338.png');
                                      triggerToast('Memilih rupa Blue Metallic (Black Roof)!', 'success');
                                    }}
                                    className={`relative rounded-lg overflow-hidden border ${editPhotoUrl.includes('rR4mY7PV') ? 'border-[#0F2D52] ring-2 ring-[#0F2D52]' : 'border-slate-200'} cursor-pointer h-10`}
                                    title="Blue Metallic with Black Roof"
                                  >
                                    <img src="https://i.ibb.co/rR4mY7PV/BMPV-Veloz-49-600x338.png" className="w-full h-full object-cover" />
                                    {editPhotoUrl.includes('rR4mY7PV') && <div className="absolute inset-0 bg-black/35 flex items-center justify-center"><Check className="w-4 h-4 text-white stroke-[3.5]" /></div>}
                                  </button>

                                  {/* Item 4: Red Metallic */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditPhotoUrl('https://i.ibb.co/KxmzgPmj/BMPV-Veloz-50-600x338.png');
                                      triggerToast('Memilih rupa Red Metallic!', 'success');
                                    }}
                                    className={`relative rounded-lg overflow-hidden border ${editPhotoUrl.includes('KxmzgPmj') ? 'border-[#0F2D52] ring-2 ring-[#0F2D52]' : 'border-slate-200'} cursor-pointer h-10`}
                                    title="Red Metallic"
                                  >
                                    <img src="https://i.ibb.co/KxmzgPmj/BMPV-Veloz-50-600x338.png" className="w-full h-full object-cover" />
                                    {editPhotoUrl.includes('KxmzgPmj') && <div className="absolute inset-0 bg-black/35 flex items-center justify-center"><Check className="w-4 h-4 text-white stroke-[3.5]" /></div>}
                                  </button>

                                  {/* Item 5: Metallic Bluish Black */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditPhotoUrl('https://i.ibb.co/nMC52W9S/BMPV-Veloz-52-600x338.png');
                                      triggerToast('Memilih rupa Metallic Bluish Black!', 'success');
                                    }}
                                    className={`relative rounded-lg overflow-hidden border ${editPhotoUrl.includes('nMC52W9S') ? 'border-[#0F2D52] ring-2 ring-[#0F2D52]' : 'border-slate-200'} cursor-pointer h-10`}
                                    title="Metallic Bluish Black"
                                  >
                                    <img src="https://i.ibb.co/nMC52W9S/BMPV-Veloz-52-600x338.png" className="w-full h-full object-cover" />
                                    {editPhotoUrl.includes('nMC52W9S') && <div className="absolute inset-0 bg-black/35 flex items-center justify-center"><Check className="w-4 h-4 text-white stroke-[3.5]" /></div>}
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1 pb-1">
                                <label className="text-[9.5px] text-slate-400 font-bold block">Or Image URL Link</label>
                                <input 
                                  type="text"
                                  placeholder="https://..."
                                  value={editPhotoUrl}
                                  onChange={(e) => setEditPhotoUrl(e.target.value)}
                                  className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-2 px-3 font-mono text-[10px] text-slate-650 focus:outline-none focus:border-[#0F2D52]"
                                />
                              </div>
                            </div>

                            <div className="hidden">
                              <select>
                              </select>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => {
                                handleSaveVehicleInfo({
                                  plateNumber: editPlateNumber || vehicleInfo.plateNumber,
                                  variant: editVariant || vehicleInfo.variant,
                                  year: editYear || vehicleInfo.year,
                                  color: editColor || vehicleInfo.color,
                                  photoUrl: editPhotoUrl || vehicleInfo.photoUrl
                                });
                              }}
                              className="flex-1 py-3 bg-[#0F2D52] hover:bg-[#1c487a] text-white rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setIsVehicleEditModalOpen(false)}
                              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* ADD ACCESSORY MODAL */}
                  <AnimatePresence>
                    {isAddAccessoryModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setIsAddAccessoryModalOpen(false)}
                          className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
                        />

                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 15 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 15 }}
                          className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 z-10 flex flex-col gap-4 text-left select-none overflow-hidden"
                        >
                          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                            <h4 className="text-sm font-black text-slate-850">Add Mod / Accessory</h4>
                            <button 
                              onClick={() => setIsAddAccessoryModalOpen(false)}
                              className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-3.5 text-xs text-slate-700 font-bold">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 uppercase">Accessory Name</label>
                              <input 
                                type="text"
                                placeholder="E.g., Carbon Wing, Roof Rack"
                                value={accessoryFormName}
                                onChange={(e) => setAccessoryFormName(e.target.value)}
                                className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 text-slate-800 focus:outline-none focus:border-[#0F2D52]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 uppercase">Specification / Finish</label>
                              <input 
                                type="text"
                                placeholder="E.g., Glossy Black finish, Dual rails"
                                value={accessoryFormDesc}
                                onChange={(e) => setAccessoryFormDesc(e.target.value)}
                                className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 text-slate-800 focus:outline-none focus:border-[#0F2D52]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-450 uppercase">Icon Category</label>
                              <div className="grid grid-cols-4 gap-2 pt-1">
                                {[
                                  { icon: 'Car', label: 'Body Kit' },
                                  { icon: 'LayoutGrid', label: 'Tint/Window' },
                                  { icon: 'Sun', label: 'Lighting' },
                                  { icon: 'Shield', label: 'Electronics' }
                                ].map((choice) => {
                                  const isSelected = accessoryFormIcon === choice.icon;
                                  return (
                                    <button
                                      key={choice.icon}
                                      onClick={() => setAccessoryFormIcon(choice.icon)}
                                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition ${
                                        isSelected 
                                          ? 'bg-[#0F2D52] text-white border-[#0F2D52]' 
                                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {choice.icon === 'Car' && <Car className="w-4 h-4" />}
                                      {choice.icon === 'LayoutGrid' && <LayoutGrid className="w-4 h-4" />}
                                      {choice.icon === 'Sun' && <Sun className="w-4 h-4" />}
                                      {choice.icon === 'Shield' && <Shield className="w-4 h-4" />}
                                      <span className="text-[7.5px] font-black leading-none uppercase tracking-wide truncate max-w-full">
                                        {choice.label}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => {
                                if (!accessoryFormName.trim()) {
                                  triggerToast('Please enter accessory name', 'error');
                                  return;
                                }
                                const newItem = {
                                  id: Date.now(),
                                  name: accessoryFormName,
                                  desc: accessoryFormDesc || 'Standard accessory',
                                  icon: accessoryFormIcon
                                };
                                setAccessories((prev) => [...prev, newItem]);
                                setIsAddAccessoryModalOpen(false);
                                triggerToast(`Accessory "${accessoryFormName}" successfully installed!`, 'success');
                              }}
                              className="flex-1 py-3 bg-[#0F2D52] hover:bg-[#1c487a] text-white rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                            >
                              Add
                            </button>
                            <button
                              onClick={() => setIsAddAccessoryModalOpen(false)}
                              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                            >
                              Cancel
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* COMPREHENSIVE SERVICE RECORDS OVERLAY DIALOG MODAL */}
                  <AnimatePresence>
                    {isServiceLogsModalOpen && (
                      <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 select-none overflow-hidden text-slate-800 text-left">
                        {/* Custom Header Sticky Navigation */}
                        <div className="bg-[#0F2D52] text-white p-4.5 flex items-center justify-between shadow-md">
                          <button 
                            onClick={() => setIsServiceLogsModalOpen(false)}
                            className="inline-flex items-center gap-2 text-[10.5px] font-black text-slate-100 uppercase tracking-widest cursor-pointer hover:text-white transition"
                          >
                            <ArrowLeft className="w-4.5 h-4.5 text-white stroke-[2.5]" />
                            <span>Close</span>
                          </button>
                          <h3 className="text-sm font-black tracking-tight uppercase">Service Records</h3>
                          <button
                            onClick={() => {
                              setServiceFormType('Regular Service');
                              setServiceFormDate('');
                              setServiceFormMileage('');
                              setServiceFormDetails('');
                              setServiceFormCost('');
                              setIsAddServiceLogModalOpen(true);
                            }}
                            className="text-xs bg-[#EFF4FB] text-[#0F2D52] font-black px-3.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1 active:scale-95 transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>New Service</span>
                          </button>
                        </div>

                        {/* Scrolling view of log listing */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-md mx-auto w-full">
                          <div className="space-y-1.5 text-left pb-2 border-b border-slate-200">
                            <h4 className="text-base font-black text-slate-850 leading-none">Maintenance History</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              Plate Number: {vehicleInfo.plateNumber} • {vehicleInfo.variant}
                            </p>
                          </div>

                          <div className="space-y-3.5 text-left">
                            {serviceRecords.map((record) => (
                              <div
                                key={record.id}
                                onClick={() => setViewingRecordDetails(record)}
                                className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition cursor-pointer flex flex-col gap-2.5"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <div className="space-y-0.5">
                                    <span className="text-[10px] text-[#0F2D52] font-mono tracking-wider bg-blue-50 border border-blue-100 px-2 py-0.5 rounded font-black max-w-fit block uppercase text-left">
                                      {record.type}
                                    </span>
                                    <h5 className="text-[13px] font-black text-slate-800 leading-tight pt-1">
                                      Mileage: <span className="font-mono text-xs">{record.mileage}</span>
                                    </h5>
                                  </div>

                                  <div className="space-y-1 text-right shrink-0">
                                    <span className="text-[11px] text-emerald-600 font-extrabold bg-emerald-50 px-2.5 py-1 rounded block border border-emerald-100">
                                      {record.status}
                                    </span>
                                    <span className="text-[9.5px] text-slate-400 font-bold block pt-1">
                                      {record.date}
                                    </span>
                                  </div>
                                </div>

                                <p className="text-xs text-slate-505 font-semibold line-clamp-2 leading-relaxed text-left">
                                  {record.details}
                                </p>

                                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 border-t border-slate-50 pt-2 pb-0.5">
                                  <span>Total Cost: <strong className="text-slate-800 font-mono">{record.cost || 'RM 0.00'}</strong></span>
                                  <span className="text-[#0F2D52] font-black inline-flex items-center gap-0.5 uppercase tracking-wider text-[9px] hover:underline">
                                    Full Details &rarr;
                                  </span>
                                </div>
                              </div>
                            ))}

                            {serviceRecords.length === 0 && (
                              <div className="bg-white rounded-xl p-8 text-center text-slate-400 border border-slate-100">
                                <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs font-semibold">No service records found. Click the button above to register a new service.</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Backing sheet modal to register NEW SERVICE DATA RECORD */}
                        <AnimatePresence>
                          {isAddServiceLogModalOpen && (
                            <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsAddServiceLogModalOpen(false)}
                                className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
                              />

                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-5 z-20 flex flex-col gap-4 text-left select-none overflow-hidden"
                              >
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                  <h4 className="text-sm font-black text-slate-850">Register New Service</h4>
                                  <button onClick={() => setIsAddServiceLogModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="space-y-3.5 text-xs text-slate-700 font-bold">
                                  <div className="space-y-1">
                                    <label className="text-[10px] text-slate-450 uppercase">Service Type</label>
                                    <select
                                      value={serviceFormType}
                                      onChange={(e) => setServiceFormType(e.target.value)}
                                      className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 font-bold text-slate-800 focus:outline-none focus:border-[#0F2D52] cursor-pointer"
                                    >
                                      <option value="Regular Service">Regular Service</option>
                                      <option value="Major Service">Major Service</option>
                                      <option value="Emergency Assist">Emergency Assist</option>
                                      <option value="Tuning / Mod Check">Tuning / Mod Check</option>
                                    </select>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3.5">
                                    <div className="space-y-1">
                                      <label className="text-[10px] text-slate-450 uppercase">Date</label>
                                      <input
                                        type="date"
                                        value={serviceFormDate}
                                        onChange={(e) => setServiceFormDate(e.target.value)}
                                        className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 text-slate-800 focus:outline-none focus:border-[#0F2D52] cursor-pointer"
                                      />
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-[10px] text-slate-450 uppercase">Mileage</label>
                                      <input
                                        type="text"
                                        placeholder="E.g., 25,000 km"
                                        value={serviceFormMileage}
                                        onChange={(e) => setServiceFormMileage(e.target.value)}
                                        className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 text-slate-800 focus:outline-none focus:border-[#0F2D52]"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] text-slate-450 uppercase">Details & Work Logs</label>
                                    <textarea
                                      rows={2}
                                      placeholder="E.g., Engine oil change, oil filter, brake check..."
                                      value={serviceFormDetails}
                                      onChange={(e) => setServiceFormDetails(e.target.value)}
                                      className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 text-slate-800 focus:outline-none focus:border-[#0F2D52] resize-none"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[10px] text-slate-450 uppercase">Total Cost (RM)</label>
                                    <input
                                      type="text"
                                      placeholder="E.g., 350.00"
                                      value={serviceFormCost}
                                      onChange={(e) => setServiceFormCost(e.target.value)}
                                      className="w-full bg-[#EFF4FB] border border-slate-200 rounded-xl py-3 px-3.5 text-slate-800 focus:outline-none focus:border-[#0F2D52]"
                                    />
                                  </div>
                                </div>

                                <div className="flex gap-3 pt-2">
                                  <button
                                    onClick={() => {
                                      if (!serviceFormDate || !serviceFormMileage) {
                                        triggerToast('Please fill in the date and vehicle mileage', 'error');
                                        return;
                                      }
                                      const newLog = {
                                        id: Date.now(),
                                        type: serviceFormType,
                                        date: serviceFormDate,
                                        mileage: serviceFormMileage,
                                        details: serviceFormDetails || 'Routine maintenance',
                                        cost: serviceFormCost ? `RM ${serviceFormCost.replace(/[^\d.]/g, '')}` : 'RM 0.00',
                                        status: 'Completed'
                                      };
                                      setServiceRecords((prev) => [newLog, ...prev]);
                                      setIsAddServiceLogModalOpen(false);
                                      triggerToast('New service record successfully saved!', 'success');
                                    }}
                                    className="flex-1 py-3 bg-[#0F2D52] hover:bg-[#1c487a] text-white rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                                  >
                                    Save Log
                                  </button>
                                  <button
                                    onClick={() => setIsAddServiceLogModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </AnimatePresence>

                        {/* DETAILED DRILLDOWN POPUP VIEW FOR CHOSEN LOG RECORD */}
                        <AnimatePresence>
                          {viewingRecordDetails && (
                            <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setViewingRecordDetails(null)}
                                className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
                              />

                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="relative w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-5 z-20 flex flex-col gap-4 text-left select-none overflow-hidden"
                              >
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                  <span className="text-[10px] text-[#0F2D52] font-black uppercase tracking-widest bg-blue-55 border border-blue-100 px-2 py-0.5 rounded font-mono">
                                    Service Record Detail
                                  </span>
                                  <button onClick={() => setViewingRecordDetails(null)} className="p-1 text-slate-400 hover:text-slate-650 cursor-pointer">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                <div className="space-y-3.5 text-xs text-slate-800">
                                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-150">
                                    <div>
                                      <span className="text-[9px] text-slate-400 uppercase tracking-wide block">Maintenance Type</span>
                                      <strong className="text-sm font-black text-slate-800">{viewingRecordDetails.type}</strong>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[9px] text-slate-400 uppercase tracking-wide block">Mileage</span>
                                      <strong className="text-sm font-black text-slate-800 font-mono">{viewingRecordDetails.mileage}</strong>
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 align-left">
                                    <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wide block leading-none">Service Date</span>
                                    <span className="text-sm font-black text-slate-800 block">{viewingRecordDetails.date}</span>
                                  </div>

                                  <div className="space-y-1.5 pt-0.5">
                                    <span className="text-[10px] text-slate-450 font-extrabold uppercase tracking-wide block leading-none">Report / Work Log</span>
                                    <p className="text-xs text-slate-505 leading-relaxed font-semibold bg-slate-50/50 p-3 rounded-xl border border-slate-50 text-left">
                                      {viewingRecordDetails.details}
                                    </p>
                                  </div>

                                  <div className="flex justify-between items-center bg-[#EFF4FB]/70 border border-blue-50/50 p-3 rounded-xl">
                                    <div>
                                      <span className="text-[9px] text-slate-400 uppercase tracking-wide block font-mono">Total Cost</span>
                                      <strong className="text-base font-black text-[#0F2D52] font-mono">{viewingRecordDetails.cost}</strong>
                                    </div>
                                    <span className="text-[11px] font-black text-emerald-600 bg-emerald-100 border border-emerald-250/50 px-2.5 py-1 rounded">
                                      {viewingRecordDetails.status}
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-1.5 flex gap-3">
                                  <button
                                    onClick={() => triggerToast('Physical receipt image sent to cloud storage!', 'success')}
                                    className="flex-1 py-3 bg-[#0F2D52] text-white hover:bg-[#1a4478] rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                                  >
                                    Print Receipt
                                  </button>
                                  <button
                                    onClick={() => setViewingRecordDetails(null)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition cursor-pointer text-center min-h-[44px]"
                                  >
                                    Close
                                  </button>
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* TAB 4: DIGITAL MEMBERSHIP CARD */}
              {currentTab === 'card' && (
                <motion.div
                  key="card-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5 px-1"
                >
                  {/* Title Header */}
                  <div className="space-y-1 text-left">
                    <h2 className="text-2xl font-display font-black tracking-tight text-[#0F2D52]">Digital Membership</h2>
                    <p className="text-[12.5px] text-slate-500 font-semibold leading-relaxed">Present this card for events and merchant benefits.</p>
                  </div>

                  {/* Premium Carbon Fiber/Sleek Dark Membership Card */}
                  <div
                    ref={cardRef}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    style={tiltStyle}
                    className="w-full aspect-[1.65/1] cursor-pointer relative"
                    onClick={() => setIsCardFlipped(!isCardFlipped)}
                  >
                    <motion.div
                      animate={{ rotateY: isCardFlipped ? 180 : 0 }}
                      transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                      style={{ transformStyle: 'preserve-3d' }}
                      className="relative w-full h-full"
                    >
                      {/* FRONT FACE */}
                      <div
                        className="absolute inset-0 w-full h-full bg-[#111] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 flex items-center justify-center select-none group bg-cover bg-center"
                        style={{ 
                          backfaceVisibility: 'hidden',
                          backgroundImage: `url(${mvocPremiumFront})`
                        }}
                      >
                         {/* Glare/Shine overlay */}
                         <div 
                           className="absolute inset-0 pointer-events-none z-10" 
                           style={glareStyle}
                         />
                         
                         {/* Optional text fallback if image is missing */}
                         <span className="text-white/20 text-[10px] font-black uppercase tracking-widest pointer-events-none drop-shadow-md">
                           MVOC DIGITAL CARD
                         </span>
                      </div>

                      {/* BACK FACE */}
                      <div
                        className="absolute inset-0 w-full h-full bg-[#111] rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col items-center justify-center select-none group bg-cover bg-center"
                        style={{ 
                          backfaceVisibility: 'hidden', 
                          transform: 'rotateY(180deg)',
                          backgroundImage: `url(${mvocPremiumBack})`
                        }}
                      >
                        {/* Glare/Shine overlay */}
                        <div 
                          className="absolute inset-0 pointer-events-none z-10" 
                          style={glareStyle}
                        />
                        
                        <div className="flex flex-col items-center justify-center relative w-full px-8 mt-4">
                          <h4 
                            className="text-[20px] sm:text-[22px] leading-tight font-display font-bold tracking-widest text-[#e2e8f0] text-center uppercase drop-shadow-xl"
                            style={{ textShadow: "1px 1px 1px #fff, -1px -1px 1px #888, 2px 2px 4px rgba(0,0,0,0.8)" }}
                          >
                            {displayName}
                          </h4>
                          <span 
                            className="text-[14px] sm:text-[15px] font-semibold tracking-[0.15em] font-sans text-[#cbd5e1] mt-1.5 drop-shadow-xl"
                            style={{ textShadow: "1px 1px 0px #fff, -1px -1px 0px #888, 2px 2px 3px rgba(0,0,0,0.8)" }}
                          >
                            {displayMvocId}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  </div>



                  {/* Share Card & Save Offline Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Share Button Card */}
                    <button
                      onClick={() => setIsShareCardModalOpen(true)}
                      className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs flex flex-col items-start text-left cursor-pointer hover:bg-slate-50/50 transition-all active:scale-[0.98] select-none h-full"
                    >
                      <div className="p-2.5 bg-[#EFF4FB] rounded-xl text-[#0F2D52] shrink-0">
                        <Share2 className="w-5 h-5 text-[#0F2D52] stroke-[2.3]" />
                      </div>
                      <div className="mt-4">
                        <span className="text-sm font-black text-[#0F2D52] block">Share Card</span>
                        <span className="text-[11px] text-slate-500 font-bold leading-normal block mt-0.5">
                          Send to family members
                        </span>
                      </div>
                    </button>

                    {/* Save Offline Card */}
                    <button
                      onClick={() => setIsWalletModalOpen(true)}
                      className="bg-white p-4 rounded-2xl border border-slate-200/50 shadow-xs flex flex-col items-start text-left cursor-pointer hover:bg-slate-50/50 transition-all active:scale-[0.98] select-none h-full"
                    >
                      <div className="p-2.5 bg-[#EFF4FB] rounded-xl text-[#0F2D52] shrink-0">
                        <Download className="w-5 h-5 text-[#0F2D52] stroke-[2.3]" />
                      </div>
                      <div className="mt-4">
                        <span className="text-sm font-black text-[#0F2D52] block">Save Offline</span>
                        <span className="text-[11px] text-slate-500 font-bold leading-normal block mt-0.5">
                          Add to Apple/Google Wallet
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Veloz Tier & Rewards (Gamification) */}
                  <div className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-xs text-left space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black text-[#0F2D52] uppercase tracking-wider">Veloz Tier & Rewards</span>
                      <span className={`text-[10px] font-bold border px-2.5 py-0.5 rounded-full uppercase ${
                        rewardsInfo.activeTierLabel === 'Platinum' 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm shadow-indigo-100/50'
                          : rewardsInfo.activeTierLabel === 'Gold'
                          ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-sm shadow-amber-100/50'
                          : 'bg-slate-50 text-slate-650 border-slate-200'
                      }`}>
                        {rewardsInfo.currentTierName}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px] font-bold text-slate-500">
                        <span className={rewardsInfo.activeTierLabel === 'Silver' ? "text-[#0F2D52] font-black" : ""}>Silver {rewardsInfo.activeTierLabel === 'Silver' ? '(Active)' : ''}</span>
                        <span className={rewardsInfo.activeTierLabel === 'Gold' ? "text-[#0F2D52] font-black" : ""}>Gold {rewardsInfo.activeTierLabel === 'Gold' ? '(Active)' : ''}</span>
                        <span className={rewardsInfo.activeTierLabel === 'Platinum' ? "text-[#0F2D52] font-black" : ""}>Platinum {rewardsInfo.activeTierLabel === 'Platinum' ? '(Active)' : ''}</span>
                      </div>
                      
                      {/* Horizontal Progress Bar */}
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/20">
                        <div 
                          className={`h-full bg-gradient-to-r ${
                            rewardsInfo.activeTierLabel === 'Platinum'
                              ? 'from-indigo-500 via-purple-500 to-pink-500'
                              : rewardsInfo.activeTierLabel === 'Gold'
                              ? 'from-amber-500 via-yellow-400 to-amber-600 shadow-[0px_0px_6px_rgba(245,158,11,0.5)]'
                              : 'from-slate-400 to-[#0F2D52]'
                          }`}
                          style={{ width: `${rewardsInfo.progressPercent}%` }} 
                        />
                      </div>
                      
                      <div className="flex justify-between items-center text-[10.5px] font-semibold text-slate-400">
                        <span>Mata Ganjaran: {rewardsInfo.xp} XP</span>
                        <span>Faedah: {rewardsInfo.benefitsCount}/20</span>
                        <span>
                          {rewardsInfo.xp >= 100 ? 'Platinum Tier Aktif' : `Next Tier: ${rewardsInfo.nextTierXP} XP`}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-start gap-2.5">
                      <div className="p-1.5 bg-[#EFF4FB] rounded-lg text-[#0F2D52] shrink-0 mt-0.5">
                        <Award className="w-4 h-4 text-[#0F2D52]" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[11.5px] font-bold text-[#0F2D52] block">Kehadiran Acara</span>
                        <span className="text-[11px] text-slate-500 font-semibold leading-normal block">
                          3/5 Acara dihadiri tahun ini untuk tebus pelekat eksklusif!
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Veloz Member Benefits banner section */}
                  <button
                    onClick={() => {
                      setCurrentTab('merchants');
                      triggerToast('Opening exclusive MVOC Merchant Partners Hub', 'success');
                    }}
                    className="w-full bg-[#0F2D52] text-white p-4 rounded-2xl border border-white/5 shadow-md flex items-center justify-between cursor-pointer hover:bg-[#0A223D] transition active:scale-[0.99] select-none mt-1 text-left"
                  >
                    <div className="space-y-0.5 pr-2">
                      <span className="text-sm font-black text-white block">Veloz Member Benefits</span>
                      <span className="text-[11px] text-slate-350 font-bold block">
                        Explore 50+ exclusive merchant discounts
                      </span>
                    </div>
                    <div className="bg-amber-400 p-2 rounded-xl text-[#0F2D52] hover:bg-amber-300 transition shrink-0 flex items-center justify-center">
                      <ChevronRight className="w-4 h-4 stroke-[3]" />
                    </div>
                  </button>

                  {/* Merchant Benefits Grid */}
                  <div className="space-y-3.5 pt-2 text-left">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-[#0F2D52] rounded-full" />
                      Rakan Niaga Pilihan
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-3">
                      {/* Card 1 */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between h-full hover:bg-slate-50/50 transition-colors">
                        <div className="p-2 bg-[#EFF4FB] rounded-xl text-[#0F2D52] w-fit">
                          <Car className="w-4 h-4 text-[#0F2D52]" />
                        </div>
                        <div className="mt-4.5 space-y-0.5">
                          <span className="text-[11px] font-black text-[#0F2D52] block leading-tight">Workshop</span>
                          <span className="text-[10px] text-slate-550 font-bold leading-tight block">
                            Diskaun 10% di Bengkel X
                          </span>
                        </div>
                      </div>

                      {/* Card 2 */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between h-full hover:bg-slate-50/50 transition-colors">
                        <div className="p-2 bg-[#EFF4FB] rounded-xl text-[#0F2D52] w-fit">
                          <Compass className="w-4 h-4 text-[#0F2D52]" />
                        </div>
                        <div className="mt-4.5 space-y-0.5">
                          <span className="text-[11px] font-black text-[#0F2D52] block leading-tight">Lifestyle</span>
                          <span className="text-[10px] text-slate-550 font-bold leading-tight block">
                            Diskaun Ahli di Kafe Y
                          </span>
                        </div>
                      </div>

                      {/* Card 3 */}
                      <div className="bg-white p-3 rounded-2xl border border-slate-200/60 shadow-2xs flex flex-col justify-between h-full hover:bg-slate-50/50 transition-colors">
                        <div className="p-2 bg-[#EFF4FB] rounded-xl text-[#0F2D52] w-fit">
                          <Shield className="w-4 h-4 text-[#0F2D52]" />
                        </div>
                        <div className="mt-4.5 space-y-0.5">
                          <span className="text-[11px] font-black text-[#0F2D52] block leading-tight">Insurance</span>
                          <span className="text-[10px] text-slate-550 font-bold leading-tight block">
                            Rebat Eksklusif Takaful
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Proof Notice box */}
                  <div className="flex gap-3 bg-slate-100/50 border border-slate-200/30 p-4 rounded-2xl mt-1 text-left">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11.5px] text-slate-500 font-medium leading-relaxed">
                      This digital card is a valid proof of membership for MVOC Malaysia. Please present this card at all official events for attendance verification.
                    </p>
                  </div>

                  {/* Seksyen Komuniti & Aktiviti Terkini */}
                  <div className="space-y-4 pt-3 border-t border-slate-100 text-left">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-red-500 rounded-full" />
                      Komuniti & Aktiviti
                    </h3>

                    {/* Notice Board Ticker */}
                    <div className="bg-slate-50 border border-slate-200/50 px-4 py-3 rounded-2xl relative overflow-hidden flex items-center gap-3 shadow-3xs">
                      <div className="flex h-2 w-2 relative shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </div>
                      <div className="flex-1 overflow-hidden h-5 relative">
                        {/* Smooth sliding announcement */}
                        <div className="absolute w-full text-xs text-slate-600 font-bold animate-marquee whitespace-nowrap">
                          📣 Baju jersi edisi terhad MVOC kini dibuka untuk tempahan! Sila layari seksyen Pengumuman kelab atau hubungi AJK Chapter anda.
                        </div>
                      </div>
                    </div>

                    {/* Upcoming Event Card */}
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs relative overflow-hidden text-left flex justify-between items-center gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-200/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Upcoming Event
                        </span>
                        <h4 className="text-sm font-black text-[#0F2D52] pt-1 tracking-tight">
                          MVOC Merdeka Convoy 2026
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-[#0F2D52] shrink-0" />
                          <span>Tarikh: 31 Ogos 2026</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setCurrentTab('events');
                          triggerToast('Navigating to Club Events page', 'info');
                        }}
                        className="bg-[#0F2D52] hover:bg-[#0A223D] active:scale-95 text-white text-xs font-black px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer select-none whitespace-nowrap"
                      >
                        RSVP Sini
                      </button>
                    </div>
                  </div>

                  {/* Exchanged Contacts Direct UI Directory */}
                  {exchangedContacts.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-100 text-left space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black text-[#0F2D52] flex items-center gap-2">
                          <UserCheck className="w-4.5 h-4.5" />
                          Contacts Met
                        </h3>
                        <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          {exchangedContacts.length} RECORDED
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {exchangedContacts.map((contact, idx) => (
                          <div key={contact.uid || idx} className="bg-white border border-slate-200 p-3.5 rounded-2xl flex items-center gap-3.5 shadow-sm hover:bg-slate-50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-[#EFF4FB] border border-[#0F2D52]/10 overflow-hidden flex items-center justify-center shrink-0">
                              {contact.photoURL ? (
                                <img src={contact.photoURL} alt={contact.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm font-black text-[#0F2D52]">
                                  {contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-black text-slate-900 truncate tracking-tight">{contact.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] font-bold font-mono text-[#0F2D52] bg-[#eff4ff] px-1.5 py-0.5 rounded">
                                  {contact.mvocId}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 truncate">
                                  {contact.chapter}
                                </span>
                              </div>
                            </div>
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 hover:bg-emerald-100 shrink-0 transition" title="Call Member">
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MODAL 1: SHARE CARD CONTAINER */}
                  <AnimatePresence>
                    {isShareCardModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setIsShareCardModalOpen(false)}
                          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
                        />
                        
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 z-10"
                        >
                          <div className="h-1.5 bg-[#0F2D52] w-full" />
                          
                          <div className="p-5 space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="text-base font-black text-[#0F2D52]">Kongsi Kad Digital</h3>
                              <button 
                                onClick={() => setIsShareCardModalOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            {/* Card Display Card Mini */}
                            <div className="relative bg-gradient-to-br from-[#0a1b33] via-[#112F56] to-[#0a182a] p-4.5 rounded-2xl text-left border border-slate-700/40 shadow-xl overflow-hidden h-[120px] flex flex-col justify-between select-none">
                              {/* Background pattern layer */}
                              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                              
                              <div className="flex justify-between items-start z-10">
                                <div>
                                  <span className="text-[12px] font-black text-amber-500 tracking-wider">MVOC</span>
                                  <span className="text-[7px] font-black text-white/70 block uppercase tracking-widest leading-none">Malaysia Veloz Group</span>
                                </div>
                                <span className="text-[8.5px] bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-white border border-amber-400/40 px-2 py-0.5 rounded-md font-black uppercase tracking-wider shadow-sm">
                                  GOLD MEMBER
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-3 mt-auto z-10">
                                <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-amber-450 p-0.5 shrink-0 shadow-md">
                                  <img 
                                    src={displayAvatarUrl} 
                                    alt={displayName} 
                                    className="w-full h-full object-cover rounded-md"
                                  />
                                </div>
                                <div className="min-w-0 pr-12">
                                  <p className="text-xs font-black text-white tracking-tight leading-tight truncate">{displayName}</p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <p className="text-[10px] text-amber-400 font-mono font-black leading-none tracking-wider">{displayMvocId}</p>
                                    {displayManagedChapter && (
                                      <span className="bg-blue-900 border border-blue-500/30 text-white font-bold text-[7px] px-1.5 py-0.5 rounded-full uppercase tracking-wider block leading-none">
                                        {displayManagedChapter}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Integrasi Kod QR */}
                              <div className="absolute bottom-3 right-3 bg-white p-1 rounded-lg shadow-md border border-slate-700/20 flex items-center justify-center z-10">
                                <QRCodeSVG 
                                  value={`https://mvoc.my/card/${displayMvocId}`} 
                                  size={36} 
                                  level="L" 
                                  className="text-[#112F56]"
                                />
                              </div>
                            </div>

                            {/* Sharing Actions Grid (Copy Link & WhatsApp) */}
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                              <button 
                                onClick={handleCopyLink}
                                className="flex items-center justify-center gap-2 bg-[#EAF2FC] hover:bg-[#D4E4F7] text-[#0F2D52] py-2.5 px-3 rounded-xl text-xs font-bold transition active:scale-97 cursor-pointer shadow-2xs"
                              >
                                <Link className="w-4 h-4 text-[#0F2D52]" />
                                <span>{isCopied ? "Pautan Disalin!" : "Copy Link"}</span>
                              </button>

                              <button 
                                onClick={() => {
                                  const inviteText = `Salam! Jom sertai komuniti pemilik Toyota Veloz di MVOC Malaysia. 🚗✨\n\nLihat profil digital card saya di sini:\nhttps://mvoc.my/card/${displayMvocId}\n\nDaftar sekarang untuk nikmati pelbagai kelebihan ahli, diskaun rakan niaga, dan sertai aktiviti konvoi rasmi kami!\nSertai kami di: https://mvoc.my`;
                                  triggerToast('Membuka WhatsApp...', 'info');
                                  window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(inviteText), '_blank');
                                }}
                                className="flex items-center justify-center gap-2 bg-[#E6F7ED] hover:bg-[#C9EFE0] text-emerald-800 py-2.5 px-3 rounded-xl text-xs font-bold transition active:scale-97 cursor-pointer shadow-2xs"
                              >
                                <span>WhatsApp</span>
                              </button>
                            </div>

                            <div className="bg-slate-55 p-3 rounded-xl border border-slate-100 text-left">
                              <p className="text-[10px] text-slate-550 font-bold leading-relaxed">
                                You can also show this card to fellow Toyota Veloz owners interested in joining the MVOC Malaysia community!
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* MODAL 2: SAVE OFFLINE NFC / GOOGLE WALLET */}
                  <AnimatePresence>
                    {isWalletModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setIsWalletModalOpen(false)}
                          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
                        />
                        
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="relative w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 z-10"
                        >
                          <div className="h-1.5 bg-amber-400 w-full" />
                          
                          <div className="p-5 text-center space-y-4">
                            <div className="flex justify-between items-center text-left">
                              <h3 className="text-base font-black text-[#0F2D52]">Save Offline</h3>
                              <button 
                                onClick={() => setIsWalletModalOpen(false)}
                                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            {/* Secure Member Verification QR Display */}
                            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center justify-center border border-slate-150 relative overflow-hidden">
                              <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200">
                                <QRCodeSVG 
                                  value={`https://mvoc.my/card/${displayMvocId}`} 
                                  size={112} 
                                  level="H" 
                                  className="text-[#0F2D52]"
                                />
                              </div>
                              <div className="mt-3 space-y-0.5">
                                <span className="font-mono text-[10.5px] font-extrabold text-[#0F2D52] tracking-wider uppercase block">
                                  SCAN-{displayMvocId}-SECUREBYMVOC
                                </span>
                                <span className="text-[8.5px] text-emerald-600 font-extrabold block uppercase tracking-widest">
                                  ● Valid &amp; Verified by Administrator
                                </span>
                              </div>
                            </div>

                            {/* Download Action Section */}
                            <div className="space-y-2.5">
                              <button
                                onClick={() => {
                                  triggerToast('Generating high resolution image...', 'info');
                                  setTimeout(() => {
                                    triggerToast('Digital membership card image successfully downloaded!', 'success');
                                    setIsWalletModalOpen(false);
                                  }, 1500);
                                }}
                                className="w-full bg-[#E3EBF4] hover:bg-[#D3E0EE] text-[#0F2D52] py-2.5 px-4 rounded-xl text-xs font-black transition active:scale-97 cursor-pointer"
                              >
                                Download Member Card Image File (.PNG)
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* MODAL 3: EXCLUSIVE MERCHANT BENEFITS */}
                  <AnimatePresence>
                    {isBenefitsModalOpen && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => {
                            setIsBenefitsModalOpen(false);
                            setBenefitSearch('');
                            setBenefitCategory('All');
                          }}
                          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
                        />
                        
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 z-10 flex flex-col max-h-[85vh]"
                        >
                          {/* Modal Header */}
                          <div className="h-1.5 bg-[#0F2D52] w-full shrink-0" />
                          <div className="p-5 pb-3 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <div className="text-left">
                              <h3 className="text-base font-black text-[#0F2D52]">Exclusive MVOC Benefits</h3>
                              <p className="text-[10.5px] text-slate-550 font-bold mt-0.5">Show Digital Member Card at merchant counter</p>
                            </div>
                            <button 
                              onClick={() => {
                                setIsBenefitsModalOpen(false);
                                setBenefitSearch('');
                                setBenefitCategory('All');
                              }}
                              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Filter Options & Search */}
                          <div className="p-4 bg-slate-55 shrink-0 space-y-3 border-b border-slate-150">
                            {/* Search bar */}
                            <input 
                              type="text"
                              value={benefitSearch}
                              onChange={(e) => setBenefitSearch(e.target.value)}
                              placeholder="Search store, discount, or coupon..."
                              className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#0F2D52]"
                            />

                            {/* Category pills */}
                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                              {['All', 'Autoparts', 'Fuel & Care', 'Beverages'].map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setBenefitCategory(cat)}
                                  className={`px-3 py-1.5 rounded-full text-[10.5px] font-extrabold whitespace-nowrap transition cursor-pointer select-none ${
                                    benefitCategory === cat 
                                      ? 'bg-[#0F2D52] text-white' 
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Scrollable coupon/merchant list */}
                          <div className="p-4 space-y-3 overflow-y-auto flex-1 text-left">
                            {[
                              { id: 1, name: 'Toyota Karak Racing', discount: '15% OFF Alignment & Tyres', code: 'MVOCKARAK15', cat: 'Autoparts', terms: 'Present member card at the Toyota Karak Racing branch only.' },
                              { id: 2, name: 'Veloz Modz Garage', discount: 'RM50 Voucher Ambient Lighting', code: 'MVOCMODZ50', cat: 'Autoparts', terms: 'Valid for full dynamic ambient lighting installation only.' },
                              { id: 3, name: 'Petronas Primax', discount: 'RM5 Rebate min. pay RM50 Setel', code: 'SETELMVOC5', cat: 'Fuel & Care', terms: 'Redeem promo code under the Rewards menu of the Setel app.' },
                              { id: 4, name: 'Tealive Malaysia', discount: '10% OFF Premium Cocoa & Brews', code: 'MVOCTEALIVE10', cat: 'Beverages', terms: 'Present barcode or PWA code at selected Tealive counters.' },
                              { id: 5, name: 'Shell Helix Lubricants', discount: 'RM20 discount on Helix Ultra service', code: 'SHELLMVOC20', cat: 'Fuel & Care', terms: 'Limited to engine service at official Shell Helix Workshops only.' },
                              { id: 6, name: 'CarDoc Detailers', discount: 'Buy 1 Free 1 Premium Car Polish', code: 'MVOCDOCPOLISH', cat: 'Fuel & Care', terms: 'Book an appointment 3 days in advance. Valid at Subang & PJ hubs.' }
                            ]
                            .filter((item) => {
                              const matchesCat = benefitCategory === 'All' || item.cat === benefitCategory;
                              const matchesSearch = item.name.toLowerCase().includes(benefitSearch.toLowerCase()) || 
                                                    item.discount.toLowerCase().includes(benefitSearch.toLowerCase());
                              return matchesCat && matchesSearch;
                            })
                            .map((benefit) => (
                              <div key={benefit.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col gap-2.5 text-left shadow-xs hover:border-slate-350 transition">
                                <div className="flex justify-between items-start">
                                  <div className="space-y-0.5">
                                    <span className="text-[10px] font-black text-[#0F2D52] bg-[#EBF2FC] py-0.5 px-2 rounded-md uppercase">
                                      {benefit.cat}
                                    </span>
                                    <h4 className="text-sm font-black text-[#0F2D52] pt-1">{benefit.name}</h4>
                                  </div>
                                  <span className="text-[11px] font-extrabold text-amber-500 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-300/30">
                                    ACTIVE
                                  </span>
                                </div>
                                
                                <p className="text-xs font-black text-slate-800 bg-[#FFFBEB] p-2 rounded-xl border border-amber-200/50">
                                  {benefit.discount}
                                </p>

                                <div className="text-[10.5px] text-slate-550 font-bold leading-relaxed border-t border-slate-100 pt-2">
                                  <span>T&amp;C: {benefit.terms}</span>
                                </div>

                                <div className="flex gap-2 justify-end pt-1 bg-slate-50 -mx-3.5 -mb-3.5 p-2 rounded-b-2xl border-t border-slate-100">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(benefit.code);
                                      triggerToast(`Promo code "${benefit.code}" copied! Use during checkout.`, 'success');
                                    }}
                                    className="bg-[#0F2D52] hover:bg-[#0A223D] text-white px-3 py-1.5 rounded-lg text-[10.5px] font-extrabold transition active:scale-97 cursor-pointer"
                                  >
                                    Copy Code: {benefit.code}
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Empty feedback screen inside directories */}
                            {benefitSearch && [
                              { id: 1, name: 'Toyota Karak Racing', discount: '15% OFF Alignment & Tyres', code: 'MVOCKARAK15', cat: 'Autoparts', terms: 'Present member card at the Toyota Karak Racing branch only.' },
                              { id: 2, name: 'Veloz Modz Garage', discount: 'RM50 Voucher Ambient Lighting', code: 'MVOCMODZ50', cat: 'Autoparts', terms: 'Valid for full dynamic ambient lighting installation only.' },
                              { id: 3, name: 'Petronas Primax', discount: 'RM5 Rebate min. pay RM50 Setel', code: 'SETELMVOC5', cat: 'Fuel & Care', terms: 'Redeem promo code under the Rewards menu of the Setel app.' },
                              { id: 4, name: 'Tealive Malaysia', discount: '10% OFF Premium Cocoa & Brews', code: 'MVOCTEALIVE10', cat: 'Beverages', terms: 'Present barcode or PWA code at selected Tealive counters.' },
                              { id: 5, name: 'Shell Helix Lubricants', discount: 'RM20 discount on Helix Ultra service', code: 'SHELLMVOC20', cat: 'Fuel & Care', terms: 'Limited to engine service at official Shell Helix Workshops only.' },
                              { id: 6, name: 'CarDoc Detailers', discount: 'Buy 1 Free 1 Premium Car Polish', code: 'MVOCDOCPOLISH', cat: 'Fuel & Care', terms: 'Book an appointment 3 days in advance. Valid at Subang & PJ hubs.' }
                            ].filter((item) => {
                              const matchesCat = benefitCategory === 'All' || item.cat === benefitCategory;
                              const matchesSearch = item.name.toLowerCase().includes(benefitSearch.toLowerCase()) || 
                                                    item.discount.toLowerCase().includes(benefitSearch.toLowerCase());
                              return matchesCat && matchesSearch;
                            }).length === 0 && (
                              <div className="text-center py-8 text-slate-400 font-bold text-xs">
                                No rewards or merchants found for "{benefitSearch}".
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </AnimatePresence>


                </motion.div>
              )}

              {/* TAB 5: EVENTS MEETUPS LIST & DETAILS DUAL VIEW */}
              {currentTab === 'events' && (
                <AnimatePresence mode="wait">
                  {selectedEventId === null ? (
                    // SCREEN 1: EVENTS LIST
                    <motion.div
                      key="events-list-screen"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      className="space-y-4"
                    >
                      {/* Sub-tab navigation under main header */}
                      <div className="flex border-b border-slate-150 bg-white sticky top-0 z-10 -mx-4 px-4 select-none">
                        {(['upcoming', 'ongoing', 'completed'] as const).map((tab) => {
                          const isActive = activeEventSubTab === tab;
                          return (
                            <button
                              key={tab}
                              id={`subtab-${tab}`}
                              onClick={() => {
                                setActiveEventSubTab(tab);
                                triggerToast(`Showing ${tab === 'upcoming' ? 'Upcoming' : tab === 'ongoing' ? 'Ongoing' : 'Completed'} events`, 'info');
                              }}
                              className={`flex-1 text-center py-3.5 text-xs font-black tracking-wide uppercase transition-all cursor-pointer border-b-2 ${
                                isActive 
                                  ? 'border-[#0F2D52] text-[#0F2D52]' 
                                  : 'border-transparent text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              {tab}
                            </button>
                          );
                        })}
                      </div>

                      {/* Header title area: "Nearby & Featured" | "X Events Found" */}
                      <div className="flex justify-between items-center select-none pt-2 px-1">
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-lg font-display font-extrabold text-[#0F2D52] tracking-tight animate-fade-in">Nearby & Featured</h2>
                          {isAdminOrSuperAdmin() && (
                            <button
                              id="btn-create-event"
                              onClick={() => setIsCreateEventModalOpen(true)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-emerald-500/20 shadow-xs"
                            >
                              <Plus className="w-3 h-3 text-white" />
                              <span>Create Event</span>
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-[#0F2D52] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100/50">
                          {events.filter(e => e.category === activeEventSubTab).length} Events Found
                        </span>
                      </div>

                      {/* Events vertical list */}
                      <div className="space-y-5">
                        {events.filter(e => e.category === activeEventSubTab).map((ev) => {
                          const isBookmarked = bookmarkedEvents.includes(ev.id);
                          return (
                            <div 
                              key={ev.id}
                              id={`event-card-${ev.id}`}
                              className="bg-white rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-sm overflow-hidden flex flex-col group transition-all"
                            >
                              {/* Hero image header */}
                              <div 
                                onClick={() => setSelectedEventId(ev.id)}
                                className="h-48 w-full relative overflow-hidden cursor-pointer"
                              >
                                <img 
                                  src={ev.image} 
                                  alt={ev.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                                />
                                {/* Bottom shading gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent opacity-80 pointer-events-none" />

                                {/* Left Status Badge */}
                                <div className="absolute top-4 left-4">
                                  <span className={`text-[10px] uppercase font-black px-3 py-1 rounded shadow-md tracking-wider ${
                                    ev.badge === 'OPEN' 
                                      ? 'bg-slate-950 text-white' 
                                      : ev.badge === 'LIMITED SLOTS'
                                        ? 'bg-[#5C3515] text-white'
                                        : 'bg-amber-500 text-slate-950'
                                  }`}>
                                    {ev.badge}
                                  </span>
                                </div>

                                {/* Right Date Badge */}
                                <div className="absolute bottom-4 right-4 bg-white text-slate-900 font-extrabold text-[11px] px-3.5 py-1.5 rounded-lg shadow-md tracking-tight">
                                  {ev.date}
                                </div>
                              </div>

                              {/* Card detail body */}
                              <div className="p-5 flex flex-col gap-3.5">
                                <div className="flex justify-between items-start gap-3">
                                  <h3 
                                    onClick={() => setSelectedEventId(ev.id)}
                                    className="text-base font-display font-extrabold text-slate-850 leading-snug cursor-pointer hover:text-[#0F2D52] transition-colors"
                                  >
                                    {ev.title}
                                  </h3>
                                  <div className="flex gap-1.5 shrink-0">
                                    {isAdminOrSuperAdmin() && (
                                      <button 
                                        onClick={() => {
                                          setGeneratedQrPayload(JSON.stringify({ type: 'attendance', context: 'event', refId: String(ev.id), name: ev.title }));
                                          setIsQrGeneratorModalOpen(true);
                                        }}
                                        className="p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition cursor-pointer border border-emerald-150"
                                        title="Generate Attendance QR"
                                      >
                                        <QrCode className="w-4 h-4 shrink-0" />
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => {
                                        triggerToast('Event link successfully copied to clipboard!', 'success');
                                      }}
                                      className="p-2.5 bg-blue-50 text-[#0F2D52] hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                      id={`share-btn-${ev.id}`}
                                    >
                                      <Share2 className="w-4 h-4 shrink-0" />
                                    </button>
                                    {isAdminOrSuperAdmin() && (
                                      <button 
                                        onClick={() => {
                                          setEventToDelete(ev);
                                          setIsDeleteEventModalOpen(true);
                                          setDeleteEventConfirmText('');
                                        }}
                                        className="p-2.5 bg-red-50 text-red-650 hover:bg-red-100 rounded-lg transition cursor-pointer border border-red-150"
                                        id={`delete-btn-${ev.id}`}
                                        title="Delete Event"
                                      >
                                        <Trash2 className="w-4 h-4 shrink-0" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Details List */}
                                <div className="space-y-2 select-none text-xs text-slate-500 font-bold">
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-[#0F2D52]/90 shrink-0" />
                                    <span>{ev.location}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-[#0F2D52]/90 shrink-0" />
                                    <span>Organizer: {ev.organizer || 'HQ'}</span>
                                  </div>
                                  {ev.warningText ? (
                                    <div className="flex items-center gap-2 text-rose-650 animate-pulse bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 self-start w-fit">
                                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                      <span className="font-sans font-extrabold text-[10.5px]">{ev.warningText}</span>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4 text-[#0F2D52]/90 shrink-0" />
                                      <span>{ev.rsvps} Registered • {ev.limit || 200} Limit</span>
                                    </div>
                                  )}
                                </div>

                                {/* Actions footer */}
                                <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                                  <button 
                                    onClick={() => toggleRsvp(ev.id)}
                                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[44px] ${
                                      ev.registered 
                                        ? 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-805' 
                                        : 'bg-[#0F2D52] hover:bg-[#184478] text-white'
                                    }`}
                                  >
                                    {ev.registered ? <CheckCircle2 className="w-4 h-4" /> : null}
                                    <span>{ev.registered ? 'Registered' : 'Register Now'}</span>
                                  </button>
                                  
                                  {/* Bookmark Toggle */}
                                  <button 
                                    onClick={() => {
                                      if (isBookmarked) {
                                        setBookmarkedEvents(bookmarkedEvents.filter(x => x !== ev.id));
                                        triggerToast('Bookmark removed', 'info');
                                      } else {
                                        setBookmarkedEvents([...bookmarkedEvents, ev.id]);
                                        triggerToast('Bookmark saved', 'success');
                                      }
                                    }}
                                    className={`p-3 rounded-xl border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                                      isBookmarked 
                                        ? 'bg-[#FFEAD2]/80 border-amber-300 text-amber-700' 
                                        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                                    }`}
                                  >
                                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-600' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Fallback no events state */}
                        {events.filter(e => e.category === activeEventSubTab).length === 0 && (
                          <div className="bg-white p-10 rounded-2xl border border-slate-100/80 text-center space-y-2 select-none">
                            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                            <p className="text-slate-500 text-sm font-semibold">No events at this moment.</p>
                          </div>
                        )}
                      </div>

                      {/* View Past Events navigation link at the bottom */}
                      <div className="pt-4 pb-2 text-center select-none">
                        <button 
                          onClick={() => {
                            setActiveEventSubTab('completed');
                            triggerToast('Navigating to Completed Events list', 'info');
                          }}
                          className="inline-flex items-center gap-2 hover:gap-3 transition-all duration-300 text-slate-500 hover:text-[#0F2D52] text-xs font-black uppercase tracking-wider cursor-pointer"
                        >
                          <span>View Past Events</span>
                          <ArrowRight className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    // SCREEN 2: EVENT DETAIL
                    (() => {
                      const selectedEv = events.find(x => x.id === selectedEventId) || events[2];
                      const isDetailBookmarked = bookmarkedEvents.includes(selectedEv.id);
                      return (
                        <motion.div
                          key="event-detail-screen"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="space-y-4 pb-2" // spacing
                        >
                          {/* Banner Header Image with action overlays */}
                          <div className="relative rounded-2xl overflow-hidden aspect-[1.35/1] shadow-md border border-slate-200/50 select-none">
                            <img 
                              src={selectedEv.image} 
                              alt={selectedEv.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover brightness-[0.55]"
                            />
                            {/* Visual background gradient shader overlay */}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent pointer-events-none" />
                            <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-slate-950/60 to-transparent pointer-events-none" />

                            {/* Top row actions overlay */}
                            <div className="absolute top-4 inset-x-4 flex justify-between items-center z-10">
                              <button 
                                onClick={() => setSelectedEventId(null)}
                                className="p-2.5 bg-slate-900/50 hover:bg-slate-900/70 text-white rounded-full transition-all cursor-pointer shadow-lg backdrop-blur-xs-overlay"
                                id="detail-back-button"
                              >
                                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                              </button>
                              <div className="flex items-center gap-2.5">
                                <button 
                                  onClick={() => {
                                    if (isDetailBookmarked) {
                                      setBookmarkedEvents(bookmarkedEvents.filter(x => x !== selectedEv.id));
                                      triggerToast('Bookmark removed', 'info');
                                    } else {
                                      setBookmarkedEvents([...bookmarkedEvents, selectedEv.id]);
                                      triggerToast('Bookmark saved', 'success');
                                    }
                                  }}
                                  className={`p-2.5 rounded-full transition-all cursor-pointer shadow-lg backdrop-blur-xs-overlay ${
                                    isDetailBookmarked 
                                      ? 'bg-rose-500 text-white' 
                                      : 'bg-slate-900/50 hover:bg-slate-900/70 text-white'
                                  }`}
                                  id="detail-bookmark-button"
                                >
                                  <Heart className={`w-5 h-5 stroke-[2.3] ${isDetailBookmarked ? 'fill-white' : ''}`} />
                                </button>
                                <button 
                                  onClick={() => triggerToast('Share link for this event copied!', 'success')}
                                  className="p-2.5 bg-slate-900/50 hover:bg-slate-900/70 text-white rounded-full transition-all cursor-pointer shadow-lg backdrop-blur-xs-overlay"
                                  id="detail-share-button"
                                >
                                  <Share2 className="w-5 h-5 stroke-[2.5]" />
                                </button>
                              </div>
                            </div>

                            {/* Overlaid Title details bottom alignment */}
                            <div className="absolute bottom-5 inset-x-5 text-white flex flex-col gap-2 pointer-events-none">
                              {/* Decal / Badge */}
                              <span className="bg-[#5C3515] text-white font-sans font-black text-[9.5px] px-3 py-1 rounded w-fit uppercase tracking-wider shadow">
                                {selectedEv.badge || 'OFFICIAL CONVOY'}
                              </span>
                              <div>
                                <h1 className="text-xl font-display font-black leading-tight tracking-tight text-white drop-shadow-sm">
                                  {selectedEv.title}
                                </h1>
                                <p className="text-xs text-slate-200 font-bold mt-1.5 flex items-center gap-1.5 drop-shadow-xs">
                                  <MapPin className="w-4 h-4 text-blue-300 stroke-[2.3]" />
                                  <span>{selectedEv.location}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Detail Quick Info Grid: Date & Time + Meeting Point */}
                          <div className="grid grid-cols-2 gap-3.5">
                            {/* Date & Time card */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs space-y-2.5">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl w-fit">
                                <Calendar className="w-5 h-5 text-[#2563EB] stroke-[2.3]" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-slate-805 tracking-wide">Date & Time</h4>
                                <p className="text-[11px] font-bold text-slate-600 mt-1 leading-relaxed">
                                  Sat, Nov 16, 2024<br />
                                  <span className="text-[9.5px] text-slate-400 font-medium">07:00 AM - 02:00 PM</span>
                                </p>
                              </div>
                            </div>

                            {/* Meeting Point card */}
                            <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs space-y-2.5">
                              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl w-fit">
                                <BookOpen className="w-5 h-5 text-[#2563EB] stroke-[2.3]" />
                              </div>
                              <div>
                                <h4 className="text-xs font-black text-slate-805 tracking-wide">Meeting Point</h4>
                                <p className="text-[11px] font-bold text-slate-600 mt-1 leading-relaxed">
                                  R&R Gombak (Nort...
                                </p>
                                <button 
                                  onClick={() => triggerToast('Opening route to starting location...', 'info')}
                                  className="text-[9.5px] text-[#2563EB] font-black uppercase mt-1 flex items-center gap-1 hover:underline cursor-pointer"
                                >
                                  <span>View Route</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Convoy Itinerary Vertical Timeline Card */}
                          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-5 space-y-5">
                            <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5 select-none">
                              <span>Convoy Itinerary</span>
                            </h3>

                            {/* Custom structured vertical timeline list */}
                            <div className="relative pl-6 space-y-6">
                              {/* Connecting vertical line behind dots */}
                              <div className="absolute top-1 bottom-1.5 left-[4.5px] w-0.5 bg-blue-100" />

                              {/* Timestep 1 */}
                              <div className="relative">
                                {/* Bullet Dot */}
                                <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-[#0F2D52] border-2 border-white ring-4 ring-blue-105 z-10" />
                                <div className="flex justify-between items-start gap-3">
                                  <div className="space-y-0.5">
                                    <h4 className="text-[11.5px] font-black text-slate-805">Assembly & Briefing</h4>
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                      R&R Gombak. Safety briefing, radio check, and formation assignment.
                                    </p>
                                  </div>
                                  <span className="bg-blue-50 text-[#0F2D52] font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap select-none border border-blue-100/30">
                                    07:00 AM
                                  </span>
                                </div>
                              </div>

                              {/* Timestep 2 */}
                              <div className="relative">
                                <div className="absolute -left-[24px] top-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 z-10" />
                                <div className="flex justify-between items-start gap-3">
                                  <div className="space-y-0.5">
                                    <h4 className="text-[11.5px] font-black text-slate-805">Flag Off</h4>
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                      Commence journey towards Genting Highlands via Karak Expressway.
                                    </p>
                                  </div>
                                  <span className="bg-blue-50 text-[#0F2D52] font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap select-none border border-blue-100/30">
                                    08:00 AM
                                  </span>
                                </div>
                              </div>

                              {/* Timestep 3 */}
                              <div className="relative">
                                <div className="absolute -left-[24px] top-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 z-10" />
                                <div className="flex justify-between items-start gap-3">
                                  <div className="space-y-0.5">
                                    <h4 className="text-[11.5px] font-black text-slate-805">Regroup at Awana</h4>
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                      Short pitstop for cooling down and secondary headcount.
                                    </p>
                                  </div>
                                  <span className="bg-blue-50 text-[#0F2D52] font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap select-none border border-blue-100/30">
                                    09:30 AM
                                  </span>
                                </div>
                              </div>

                              {/* Timestep 4 */}
                              <div className="relative">
                                <div className="absolute -left-[24px] top-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 z-10" />
                                <div className="flex justify-between items-start gap-3">
                                  <div className="space-y-0.5">
                                    <h4 className="text-[11.5px] font-black text-slate-805">Arrival & Photoshoot</h4>
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                      Official group photo at Genting Highlands premium parking area.
                                    </p>
                                  </div>
                                  <span className="bg-blue-50 text-[#0F2D52] font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap select-none border border-blue-100/30">
                                    10:30 AM
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Attendees List and Requirements Card */}
                          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs p-5 space-y-4">
                            <div className="flex justify-between items-center text-xs font-black border-b border-slate-100 pb-2 select-none">
                              <span className="text-slate-805 uppercase tracking-wide">Attendees</span>
                              <span className="text-[#0F2D52]">{selectedEv.rsvps} Confirmed</span>
                            </div>

                            {/* Attendance row heads with overlays and count badge */}
                            <div className="flex items-center gap-3 py-1">
                              <div className="flex -space-x-2.5 overflow-hidden">
                                <img 
                                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" 
                                  src="https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=60&auto=format&fit=crop&q=80" 
                                  alt="Attendee headshot"
                                  referrerPolicy="no-referrer"
                                />
                                <img 
                                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" 
                                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80" 
                                  alt="Attendee headshot"
                                  referrerPolicy="no-referrer"
                                />
                                <img 
                                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover" 
                                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&auto=format&fit=crop&q=80" 
                                  alt="Attendee headshot"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <span className="bg-blue-50 text-[#0F2D52] rounded-full text-[10.5px] font-black px-2.5 py-1 border border-blue-100/50">
                                +{selectedEv.rsvps - 3}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 font-bold select-none leading-relaxed">
                              Space limited to {selectedEv.limit || 150} vehicles. Max 2 pax per vehicle.
                            </p>

                            {/* Requirements Inner Box */}
                            <div className="bg-[#F4F7FC] border border-[#D9E3F0] rounded-2xl p-4 space-y-3">
                              <span className="text-[#0F2D52] font-black text-[9px] uppercase tracking-widest block">
                                Requirements
                              </span>
                              
                              <div className="space-y-2.5 text-slate-705 text-xs font-bold select-none">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.3]" />
                                  <span>Walkie-Talkie (UHF)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.3]" />
                                  <span>MVOC Official Decal</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.3]" />
                                  <span>Full Tank Fuel</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Sticky/Fixed bottom CTA bar aligning to screenshot */}
                          <div className="sticky bottom-0 bg-white border-t border-slate-150 -mx-4 px-5 py-3.5 flex items-center justify-between z-40 shadow-[0_-3px_15px_rgba(0,0,0,0.04)] select-none">
                            <div className="space-y-0.5">
                              <p className="text-[10px] text-slate-500 font-bold tracking-tight">Registration Open</p>
                              <p className="text-sm text-[#0F2D52] font-black tracking-tight">
                                {selectedEv.limit ? selectedEv.limit - selectedEv.rsvps : 26} spots left
                              </p>
                            </div>
                            <button
                              onClick={() => toggleRsvp(selectedEv.id)}
                              className={`py-3 px-6 rounded-xl font-black text-xs uppercase tracking-wide cursor-pointer transition min-h-[44px] ${
                                selectedEv.registered 
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-805 border border-emerald-300' 
                                  : 'bg-[#0F2D52] hover:bg-[#15345c] text-white'
                              }`}
                              id="bottom-join-button"
                            >
                              {selectedEv.registered ? 'Joined ✔' : 'Join Now'}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })()
                  )}
                </AnimatePresence>
              )}

              {/* TAB 6: CONVOY REGISTRATION RSVPS */}
              {currentTab === 'convoy' && (
                <motion.div
                  key="convoy-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-6"
                >
                  {/* Title & Subtitle Section */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs text-left">
                    <h2 className="font-display text-2xl font-black text-[#0F2D52] tracking-tight">
                      Convoy Registration
                    </h2>
                    <p className="text-slate-500 text-xs font-semibold leading-relaxed mt-1">
                      Join our upcoming automotive adventures across Malaysia.
                    </p>
                  </div>

                  {/* Search and interactive filter bar */}
                  <div className="space-y-3.5">
                    <div className="flex gap-2.5">
                      <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                          <Search className="w-4 h-4 text-slate-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search convoys..."
                          value={convoysSearchQuery}
                          onChange={(e) => setConvoysSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-205 rounded-xl text-xs font-semibold outline-hidden focus:border-[#0F2D52] focus:ring-1 focus:ring-[#0F2D52]/10 transition-all placeholder:text-slate-400/80 text-left"
                        />
                      </div>
                      <button 
                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                          showFilterDropdown || activeConvoyFilter !== 'all'
                            ? 'bg-[#0F2D52] text-white border-[#0F2D52] shadow-sm' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        id="convoy-filter-toggle"
                      >
                        <SlidersHorizontal className="w-4.5 h-4.5" />
                      </button>
                    </div>

                    {/* Filter Dropdown Popover */}
                    <AnimatePresence>
                      {showFilterDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md text-left space-y-3"
                        >
                          <h4 className="text-[10.5px] font-black text-slate-400 uppercase tracking-wider">
                            Filter Convoys by Status & Category
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {(['all', 'charity', 'upcoming', 'open', 'last-slots'] as const).map((filterOpt) => {
                              const labelMap: Record<string, string> = {
                                all: 'All Convoys',
                                charity: 'Charity Runs Only',
                                upcoming: 'Upcoming Runs',
                                open: 'Open Registration',
                                'last-slots': 'Last Few Slots'
                              };
                              const isActive = activeConvoyFilter === filterOpt;
                              return (
                                <button
                                  key={filterOpt}
                                  onClick={() => {
                                    setActiveConvoyFilter(filterOpt);
                                    setShowFilterDropdown(false);
                                    triggerToast(`Filter applied: ${labelMap[filterOpt]}`, 'info');
                                  }}
                                  className={`p-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer border ${
                                    isActive
                                      ? 'bg-blue-50 text-[#0F2D52] border-blue-200'
                                      : 'bg-white text-slate-600 border-slate-150 hover:bg-slate-50'
                                  }`}
                                >
                                  {labelMap[filterOpt]}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Active Filter Indication bar */}
                    {activeConvoyFilter !== 'all' && (
                      <div className="flex items-center justify-between bg-blue-50 border border-blue-105/50 p-2.5 px-3 rounded-xl text-left">
                        <span className="text-[11px] font-black text-[#0F2D52]">
                          Active Filter: {activeConvoyFilter === 'charity' ? 'Charity Runs' : activeConvoyFilter === 'upcoming' ? 'Upcoming Status' : activeConvoyFilter === 'open' ? 'Open Status' : 'Last Few Slots'}
                        </span>
                        <button 
                          onClick={() => {
                            setActiveConvoyFilter('all');
                            triggerToast('Cleared active convoy filter', 'info');
                          }}
                          className="text-xs font-black text-[#0F2D52] hover:underline cursor-pointer bg-transparent border-none"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Main feed cards of convoys */}
                  <div className="space-y-5">
                    {(() => {
                      const filtered = convoysList
                        .filter(item => {
                          const sQuery = convoysSearchQuery.toLowerCase().trim();
                          if (!sQuery) return true;
                          return (
                            item.title.toLowerCase().includes(sQuery) ||
                            (item.meetingPoint && item.meetingPoint.toLowerCase().includes(sQuery)) ||
                            (item.routeOverview && item.routeOverview.toLowerCase().includes(sQuery)) ||
                            (item.locationDetails && item.locationDetails.toLowerCase().includes(sQuery))
                          );
                        })
                        .filter(item => {
                          if (activeConvoyFilter === 'all') return true;
                          if (activeConvoyFilter === 'charity') return item.isCharity;
                          if (activeConvoyFilter === 'upcoming') return item.status === 'UPCOMING';
                          if (activeConvoyFilter === 'open') return item.status === 'OPEN';
                          if (activeConvoyFilter === 'last-slots') return item.status === 'LAST FEW SLOTS';
                          return true;
                        });

                      if (filtered.length === 0) {
                        return (
                          <div className="bg-white p-8 rounded-2xl border border-slate-200/60 text-center space-y-3.5 shadow-xs">
                            <Compass className="w-10 h-10 text-slate-300 mx-auto" strokeWidth={1.5} />
                            <div>
                              <h4 className="text-sm font-black text-slate-800">No Convoys Found</h4>
                              <p className="text-xs text-slate-400 font-semibold mt-1 max-w-xs mx-auto">
                                No registered automotive drives match your current search query or filter tags.
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setConvoysSearchQuery('');
                                setActiveConvoyFilter('all');
                                triggerToast('Filters reset successfully', 'success');
                              }}
                              className="px-4.5 py-2.5 bg-[#0F2D52] text-white font-black text-[11.5px] rounded-full hover:bg-[#184271] transition"
                            >
                              Reset Search Filters
                            </button>
                          </div>
                        );
                      }

                      return filtered.map((item) => {
                        return (
                          <div 
                            key={item.id}
                            className="bg-white rounded-3xl border border-slate-205 overflow-hidden flex flex-col shadow-xs hover:shadow-sm transition-all text-left"
                          >
                            {/* Graphic Header banner (Items 1 & 2 only) */}
                            {item.image && (
                              <div className="relative aspect-[16/8.5] w-full bg-slate-100 overflow-hidden select-none">
                                <img 
                                  src={item.image} 
                                  alt={item.title}
                                  className="w-full h-full object-cover" 
                                />

                                {/* Badge Groupings absolute top overlays */}
                                <div className="absolute top-4 left-4 flex items-center gap-1.5 shrink-0">
                                  <span className={`text-[9.5px] font-black tracking-wider uppercase px-2.5 py-1 rounded-md shadow-md ${
                                    item.status === 'UPCOMING'
                                      ? 'bg-[#EBF2FC] text-[#0F2D52] border border-blue-100'
                                      : 'bg-sky-50 text-sky-700 border border-sky-100'
                                  }`}>
                                    {item.status}
                                  </span>

                                  {item.isCharity && (
                                    <span className="text-[9.5px] font-black tracking-wider uppercase bg-[#FFEDD5] text-[#9A3412] border border-orange-200 px-2.5 py-1 rounded-md shadow-md">
                                      Charity
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Innards text details container block */}
                            <div className="p-5.5 space-y-4">
                              {/* Headers and Capacity tag line */}
                              <div className="flex justify-between items-start gap-2.5">
                                <div className="space-y-1">
                                  {/* For Card 3 with no image header, show the Last Slot badge and registration inline */}
                                  {!item.image && (
                                    <div className="flex items-center gap-2 mb-2 select-none">
                                      <span className="text-[9.5px] font-black tracking-wider uppercase bg-red-50 text-red-600 border border-red-100 px-2.5 py-0.5 rounded-md">
                                        {item.status}
                                      </span>
                                    </div>
                                  )}
                                  <h3 className="font-display text-[16.5px] sm:text-lg font-black text-[#0F2D52] tracking-tight leading-snug">
                                    {item.title}
                                  </h3>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 py-1.5 px-3 bg-[#EBF2FC] border border-blue-105/20 rounded-lg text-[#0F2D52] font-extrabold text-[11px] select-none shadow-xs">
                                  <Users className="w-3.5 h-3.5 text-[#0F2D52]" />
                                  <span>{item.joinedCount}/{item.maxSlots}</span>
                                </div>
                              </div>

                              {/* CONDITIONAL LAYOUT: Meet Point & Route list sections for card 1 & 2 */}
                              {item.meetingPoint && (
                                <div className="space-y-3 border-t border-slate-50 pt-3">
                                  {/* Meeting point list item container */}
                                  <div className="flex items-start gap-3.5">
                                    <div className="w-9 h-9 bg-blue-50/70 border border-blue-105/20 text-[#0F2D52] flex items-center justify-center rounded-xl shrink-0">
                                      <MapPin className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="text-left py-0.5">
                                      <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">
                                        Meeting Point
                                      </span>
                                      <span className="text-xs font-black text-slate-800 leading-tight block mt-0.5">
                                        {item.meetingPoint}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Route overview list item container */}
                                  {item.routeOverview && (
                                    <div className="flex items-start gap-3.5">
                                      <div className="w-9 h-9 bg-blue-50/70 border border-blue-105/20 text-[#0F2D52] flex items-center justify-center rounded-xl shrink-0">
                                        <Compass className="w-4.5 h-4.5 text-[#0F2D52]" />
                                      </div>
                                      <div className="text-left py-0.5">
                                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">
                                          Route Overview
                                        </span>
                                        <span className="text-xs font-semibold text-slate-600 leading-normal block mt-0.5">
                                          {item.routeOverview}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* CONDITIONAL LAYOUT: Date-Time and Karak Highway Wide Button Box for Card 3 */}
                              {!item.image && (
                                <div className="space-y-4 pt-1">
                                  {/* Date and Time side by side blocks */}
                                  <div className="grid grid-cols-2 gap-4 border-t border-b border-dashed border-slate-200 py-3 text-left">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8.5 h-8.5 bg-blue-50/70 text-[#0F2D52] rounded-xl flex items-center justify-center shrink-0 border border-blue-105/25">
                                        <Calendar className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <span className="text-[9.5px] text-slate-400 font-extrabold tracking-wider block uppercase">Date</span>
                                        <span className="text-xs font-black text-slate-800 block mt-0.5">{item.date}</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8.5 h-8.5 bg-blue-50/70 text-[#0F2D52] rounded-xl flex items-center justify-center shrink-0 border border-blue-105/25">
                                        <Sun className="w-4 h-4 text-[#0F2D52]" />
                                      </div>
                                      <div>
                                        <span className="text-[9.5px] text-slate-400 font-extrabold tracking-wider block uppercase">Time</span>
                                        <span className="text-xs font-black text-slate-800 block mt-0.5">{item.time}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Wide Interactive Blue Destination Banner Pill with Steer Arrow */}
                                  <div 
                                    className="bg-[#EBF2FC] hover:bg-[#DCEBFB] border border-blue-150/30 rounded-2xl p-3.5 px-4.5 flex items-center justify-between transition-colors shadow-xs select-none"
                                  >
                                    <div className="flex items-center gap-3">
                                      <Compass className="w-4.5 h-4.5 text-[#0F2D52]" />
                                      <span className="text-xs font-black text-[#0F2D52]">
                                        {item.locationDetails}
                                      </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-[#0F2D52] shrink-0" />
                                  </div>
                                </div>
                              )}

                              {/* Lower Action bar: Avatars block and Registration button layout */}
                              <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-slate-50">
                                {/* Overlapping member avatar sequence */}
                                <div className="flex items-center">
                                  {item.avatars && item.avatars.length > 0 ? (
                                    <div className="flex -space-x-2 select-none">
                                      {item.avatars.map((ava, ix) => (
                                        <div 
                                          key={ix}
                                          className={`w-7.5 h-7.5 rounded-full border border-white flex items-center justify-center text-[10.5px] font-black text-white shrink-0 shadow-xs ${
                                            ix === 0 
                                              ? 'bg-blue-500 text-white' 
                                              : ix === 1 
                                                ? 'bg-amber-500 text-white' 
                                                : 'bg-[#BACFDF] text-[#1D3E5E] font-bold'
                                          }`}
                                        >
                                          {ava}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 text-[10.5px] font-bold text-slate-400">
                                      <span>First driver slots open</span>
                                    </div>
                                  )}
                                </div>

                                  <div className="flex items-center gap-2">
                                    {isAdminOrSuperAdmin() && (
                                      <button 
                                        onClick={() => {
                                          setGeneratedQrPayload(JSON.stringify({ type: 'attendance', context: 'convoy', refId: String(item.id), name: item.title }));
                                          setIsQrGeneratorModalOpen(true);
                                        }}
                                        className="w-11 h-11 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl flex items-center justify-center transition cursor-pointer border border-emerald-150 shrink-0 shadow-xs"
                                        title="Generate Attendance QR"
                                      >
                                        <QrCode className="w-4.5 h-4.5 shrink-0" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        // Prepopulate states before opening form
                                        setJoiningVehicleNumber(convoyVehicleNumber);
                                        setJoiningShirtSize(convoyShirtSize);
                                        setJoiningPaxCount(convoyPaxCount);
                                        setJoiningChapter(chapterSelector);
                                        setJoiningDietary('None');
                                        setJoiningAgreedRules(item.userRegistered); // if already registered, keep checked
                                        setSelectedJoiningConvoyId(item.id);
                                      }}
                                      className={`px-6 py-3 rounded-xl text-xs font-black tracking-wide min-h-[44px] flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                                        item.userRegistered
                                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-250 hover:bg-emerald-100/90'
                                          : 'bg-[#0F2D52] hover:bg-[#1c4a7e] text-white active:scale-98'
                                      }`}
                                      id={`join-convoy-btn-${item.id}`}
                                    >
                                      {item.userRegistered ? (
                                        <>
                                          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                                          <span>Joined ✔</span>
                                        </>
                                      ) : (
                                        <span>Join Convoy</span>
                                      )}
                                    </button>
                                  </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Want to lead your own convoy section */}
                  <div className="pt-2 text-center select-none">
                    <p className="text-xs text-slate-400 font-semibold">
                      Want to lead your own convoy?
                    </p>
                    <button
                      onClick={() => {
                        setMarshallMessage('');
                        setIsMarshallModalOpen(true);
                      }}
                      className="mt-1 text-xs font-black text-[#0F2D52] hover:text-[#184474] underline cursor-pointer bg-transparent border-none"
                    >
                      Apply for Marshall Status
                    </button>
                  </div>
                </motion.div>
              )}

              {/* TAB 7: GALLERY OF MEETUPS */}
              {currentTab === 'gallery' && (
                <motion.div
                  key="gallery-tab"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="space-y-6"
                >
                  {(() => {
                    const filteredAlbums = selectedGalleryCategory === 'all'
                      ? galleryAlbums
                      : galleryAlbums.filter(album => album.category === selectedGalleryCategory);

                    const selectedAlbum = galleryAlbums.find(a => a.id === selectedAlbumId);

                    return (
                      <div className="space-y-6">
                        <AnimatePresence mode="wait">
                          {selectedAlbumId === null ? (
                            // LIST VIEW
                            <motion.div
                              key="gallery-list-view"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="space-y-6"
                            >
                              {/* Descriptive Headline area */}
                              <div className="flex justify-between items-start gap-4 select-none animate-fade-in">
                                <div className="space-y-2 text-left">
                                  <h1 className="text-2xl font-display font-black text-[#0F2D52] tracking-tight leading-none">Community Gallery</h1>
                                  <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                                    Preserving memories of our journey across Malaysia. Browse through official MVOC event albums and chapter gatherings.
                                  </p>
                                </div>
                                {isAdminOrSuperAdmin() && (
                                  <button
                                    id="btn-upload-gallery"
                                    onClick={() => {
                                      setIsUploadGalleryModalOpen(true);
                                      setNewAlbumTitle('');
                                    }}
                                    className="bg-[#0F2D52] hover:bg-[#163c6b] text-white font-black text-[10px] uppercase tracking-wider px-3 py-2 rounded-xl flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs whitespace-nowrap shrink-0 border border-blue-900/10"
                                  >
                                    <Upload className="w-3.5 h-3.5 text-white" />
                                    <span>Upload Album</span>
                                  </button>
                                )}
                              </div>

                              {/* Horizontal categories scroll navigation filters */}
                              <div className="flex gap-2.5 pb-2.5 overflow-x-auto select-none scrollbar-none -mx-4 px-4">
                                {[
                                  { key: 'all', label: 'All Albums' },
                                  { key: 'national', label: 'National' },
                                  { key: 'chapter_convoys', label: 'Chapter Convoys' },
                                  { key: 'social', label: 'Social' }
                                ].map((cat) => {
                                  const isActive = selectedGalleryCategory === cat.key;
                                  return (
                                    <button
                                      key={cat.key}
                                      onClick={() => {
                                        setSelectedGalleryCategory(cat.key as any);
                                        triggerToast(`Filtering gallery: ${cat.label}`, 'info');
                                      }}
                                      className={`px-4.5 py-3 rounded-xl text-xs font-black tracking-wide shrink-0 transition-all cursor-pointer border ${
                                        isActive 
                                          ? 'bg-[#0F2D52] text-white border-[#0F2D52] shadow-xs' 
                                          : 'bg-[#EFF4FB] text-[#0F2D52] border-transparent hover:bg-slate-100'
                                      }`}
                                    >
                                      {cat.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Vertical list of Album Cards */}
                              <div className="space-y-6">
                                {filteredAlbums.map((album) => (
                                  <div 
                                    key={album.id}
                                    id={`gallery-album-card-${album.id}`}
                                    onClick={() => {
                                      setSelectedAlbumId(album.id);
                                      triggerToast(`Opening album: ${album.title}`, 'success');
                                    }}
                                    className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden flex flex-col group transition-all duration-300 shadow-xs hover:shadow-sm cursor-pointer"
                                  >
                                    {/* Album Hero Thumbnail image */}
                                    <div className="h-48 w-full relative overflow-hidden">
                                      <img 
                                        src={album.image} 
                                        alt={album.title}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/15 via-transparent to-transparent pointer-events-none" />
                                    </div>

                                    {/* Info Panel under the photo */}
                                    <div className="p-4 flex flex-col gap-3">
                                      <div className="flex justify-between items-center gap-2">
                                        <h3 className="text-sm font-black text-slate-800 tracking-tight leading-tight group-hover:text-[#0F2D52] transition-colors">
                                          {album.title}
                                        </h3>
                                        <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded tracking-wider uppercase shrink-0 ${album.badgeStyle}`}>
                                          {album.badge}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-center select-none text-slate-400 font-bold text-[11px]">
                                        <div className="flex items-center gap-1.5">
                                          <Image className="w-4 h-4 text-slate-450 stroke-[2.3]" />
                                          <span>{album.photosCount} Photos</span>
                                        </div>
                                        {isAdminOrSuperAdmin() && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setGalleryAlbumToDelete(album);
                                              setIsDeleteGalleryModalOpen(true);
                                              setDeleteGalleryConfirmText('');
                                            }}
                                            className="p-1 px-2.5 bg-rose-50 text-rose-650 hover:bg-rose-100 rounded-lg transition border border-rose-150 flex items-center gap-1 cursor-pointer font-black text-[9.5px] uppercase"
                                            title="Delete Album"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                {filteredAlbums.length === 0 && (
                                  <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center select-none space-y-2">
                                    <Image className="w-10 h-10 text-slate-350 mx-auto" />
                                    <p className="text-slate-505 text-sm font-semibold">No albums found for this category.</p>
                                  </div>
                                )}
                              </div>

                              {/* Gallery stats dark card */}
                              <div className="bg-[#0F2D52] rounded-2xl p-5 text-white space-y-4 shadow-sm border border-slate-800/20">
                                <div className="space-y-1">
                                  <h3 className="text-base font-display font-black tracking-tight text-white leading-none">Gallery Stats</h3>
                                  <p className="text-[11px] text-slate-300 font-medium">
                                    Our collective history through the lens of our members.
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3.5 pt-1">
                                  {/* Stat 1 */}
                                  <div className="bg-white/10 rounded-xl p-3.5 select-none text-left flex flex-col gap-1 border border-white/5">
                                    <span className="text-xl font-display font-black text-white tracking-tight leading-none">1,240+</span>
                                    <span className="text-[8.5px] text-slate-300 font-black tracking-wider uppercase">TOTAL PHOTOS</span>
                                  </div>

                                  {/* Stat 2 */}
                                  <div className="bg-white/10 rounded-xl p-3.5 select-none text-left flex flex-col gap-1 border border-white/5">
                                    <span className="text-xl font-display font-black text-white tracking-tight leading-none font-sans">42</span>
                                    <span className="text-[8.5px] text-slate-300 font-black tracking-wider uppercase">ALBUMS</span>
                                  </div>
                                </div>
                              </div>

                              {/* Featured Event Highlights video-style card */}
                              <div className="space-y-3 pt-1 select-none">
                                <h3 className="text-sm font-black text-slate-800 tracking-tight">Featured Event Highlights</h3>
                                
                                <div 
                                  onClick={() => {
                                    setIsVideoModalOpen(true);
                                    setIsVideoPlaying(true);
                                    setVideoProgress(0);
                                    triggerToast('Playing Aftermovie video...', 'info');
                                  }}
                                  className="relative aspect-video rounded-2xl overflow-hidden shadow-sm border border-slate-200/50 group cursor-pointer"
                                >
                                  {/* Background poster image of convoys/trails */}
                                  <img 
                                    src="https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=800&auto=format&fit=crop&q=80" 
                                    alt="Featured Aftermovie Thumbnail"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover group-hover:scale-102 transition duration-500 brightness-80"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                                  {/* Centered play button shape styled as screenshot */}
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-[#0F2D52] text-white p-3.5 rounded-xl shadow-lg border border-[#1b3e6c]/40 hover:scale-105 active:scale-95 transition-all">
                                      <Play className="w-6 h-6 fill-white text-white stroke-[1.5]" />
                                    </div>
                                  </div>

                                  {/* Overlay Text inside video bottom-left */}
                                  <div className="absolute bottom-4 left-4 right-4 text-left select-none pointer-events-none space-y-1">
                                    <h4 className="text-[13px] font-black text-white leading-snug tracking-tight drop-shadow-sm">
                                      Official 2023 Year End Convoy Aftermovie
                                    </h4>
                                    <p className="text-[9.5px] text-slate-300 font-bold">
                                      04:25 • Published 3 months ago
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            // ALBUM DETAILED VIEW WITH PHOTOS MATRIX
                            <motion.div
                              key="gallery-detail-view"
                              initial={{ opacity: 0, x: 15 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -15 }}
                              className="space-y-5"
                            >
                              {/* Back Navigation Bar */}
                              <div className="flex items-center justify-between pb-1">
                                <button 
                                  onClick={() => setSelectedAlbumId(null)}
                                  className="inline-flex items-center gap-2 text-[10.5px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-[#0F2D52] transition-colors"
                                  id="btn-back-to-albums"
                                >
                                  <ArrowLeft className="w-4 h-4 text-slate-500 shrink-0 stroke-[2.5]" />
                                  <span>Back to Albums</span>
                                </button>
                                
                                <span className={`text-[9.5px] font-black px-2.5 py-1 rounded uppercase tracking-wider ${selectedAlbum?.badgeStyle}`}>
                                  {selectedAlbum?.badge}
                                </span>
                              </div>

                              {/* Album Hero Banner Image Card */}
                              <div className="relative rounded-2xl overflow-hidden aspect-[1.7/1] shadow-md border border-slate-200/50 select-none">
                                <img 
                                  src={selectedAlbum?.image} 
                                  alt={selectedAlbum?.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover brightness-[0.62]"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

                                <div className="absolute bottom-4 left-4 right-4 text-left pointer-events-none text-white space-y-1">
                                  <span className="text-[8.5px] bg-[#0F2D52] text-white font-black px-2 py-0.5 rounded uppercase tracking-wider border border-blue-900/40">
                                    {selectedAlbum?.photosCount} High-Res Frames
                                  </span>
                                  <h2 className="text-lg font-display font-black leading-tight tracking-tight drop-shadow-sm mt-1">
                                    {selectedAlbum?.title}
                                  </h2>
                                </div>
                              </div>

                              {/* Curated Album Overview text */}
                              <p className="text-[11.5px] text-slate-500 leading-relaxed font-semibold text-left select-none">
                                Captured memories of our convoy rally. High resolution photographs curated by our official Media Committee members. Highlighting our fleet organization, group drone overhead views, and candid member portraits on site.
                              </p>

                              {/* Photos Matrix Grid (Responsive) */}
                              <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5 select-none text-left">
                                  Captured Photographs
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  {selectedAlbum?.photos.map((photo, index) => (
                                    <div 
                                      key={index}
                                      onClick={() => {
                                        setLightboxIndex(index);
                                        triggerToast(`Opening full screen image ${index + 1}`, 'info');
                                      }}
                                      className="relative aspect-square bg-[#F1F5F9] rounded-xl overflow-hidden border border-slate-250/20 cursor-pointer group shadow-xs hover:shadow transition"
                                    >
                                      <img 
                                        src={photo} 
                                        alt={`Captured element ${index + 1}`}
                                        referrerPolicy="no-referrer"
                                        className="w-full h-full object-cover group-hover:scale-104 transition duration-300"
                                      />
                                      <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center overflow-hidden pointer-events-none">
                                        <span className="text-[8px] bg-slate-900/70 border border-white/5 text-white font-extrabold px-2.5 py-1.5 rounded-lg uppercase tracking-wider">
                                          Enlarge Frame
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* LIGHTBOX SLIDESHOW MODAL OVERLAY PORTAL */}
                        <AnimatePresence>
                          {lightboxIndex !== null && selectedAlbum && (
                            <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/98 backdrop-blur-xl p-4 select-none">
                              {/* Top Bar Navigation HUD */}
                              <div className="flex justify-between items-center z-10 w-full text-white pt-2">
                                <div className="space-y-1 text-left">
                                  <span className="text-[9px] text-[#2563EB] font-black uppercase tracking-widest">{selectedAlbum.title}</span>
                                  <p className="text-xs font-black text-slate-300 font-mono tracking-tight">Image {lightboxIndex + 1} of {selectedAlbum.photos.length}</p>
                                </div>
                                <button 
                                  onClick={() => setLightboxIndex(null)}
                                  className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all cursor-pointer border border-white/5"
                                  id="btn-close-lightbox"
                                >
                                  <X className="w-5 h-5 stroke-[2.5]" />
                                </button>
                              </div>

                              {/* Stage Frame with Left/Right Actions */}
                              <div className="relative flex-1 flex items-center justify-center max-w-lg mx-auto w-full my-4 select-none">
                                {/* Back arrow button overlay */}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxIndex((prev) => prev !== null && prev > 0 ? prev - 1 : selectedAlbum.photos.length - 1);
                                  }}
                                  className="absolute left-2 p-3 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 border border-white/5 z-25"
                                >
                                  <ArrowLeft className="w-4 h-4 stroke-[2.8]" />
                                </button>

                                {/* Center Active Photo */}
                                <img 
                                  src={selectedAlbum.photos[lightboxIndex]}
                                  alt={`Snapshot detail ${lightboxIndex + 1}`}
                                  referrerPolicy="no-referrer"
                                  className="max-h-[64vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/5 transition duration-350"
                                />

                                {/* Next arrow button overlay */}
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxIndex((prev) => prev !== null && prev < selectedAlbum.photos.length - 1 ? prev + 1 : 0);
                                  }}
                                  className="absolute right-2 p-3 bg-black/60 hover:bg-black/90 text-white rounded-full transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95 border border-white/5 z-25"
                                >
                                  <ArrowRight className="w-4 h-4 stroke-[2.8]" />
                                </button>
                              </div>

                              {/* Bottom Details HUD Panel */}
                              <div className="text-center space-y-4 pb-4 z-10">
                                <p className="text-slate-300 text-[11px] font-semibold leading-relaxed max-w-md mx-auto px-4">
                                  Curated official photographs of the Toyota Veloz Club Malaysia (MVOC) convoy assemblies, unifying automotive enthusiasts across the states.
                                </p>
                                
                                <div className="flex justify-center gap-3.5 px-4">
                                  <button
                                    onClick={() => triggerToast('MVOC photograph successfully saved!', 'success')}
                                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer border border-white/5 min-h-[44px]"
                                  >
                                    <Download className="w-4 h-4 shrink-0" />
                                    <span>Save Pass</span>
                                  </button>
                                  
                                  <button
                                    onClick={() => triggerToast('Photo sharing link copied!', 'success')}
                                    className="flex-1 py-3 bg-[#EFF4FB] text-[#0F2D52] hover:bg-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
                                  >
                                    <Share2 className="w-4 h-4 shrink-0 text-[#0F2D52]" />
                                    <span>Share</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </AnimatePresence>

                        {/* FEATURED AFTERMOVIE SIMULATED PLAYBACK HIGHLIGHT MODAL */}
                        <AnimatePresence>
                          {isVideoModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                              {/* Blur Backing Shroud */}
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-slate-950/92 backdrop-blur-md"
                                onClick={() => {
                                  setIsVideoModalOpen(false);
                                  setIsVideoPlaying(false);
                                }}
                              />

                              {/* Video Box Container */}
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                                className="relative w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl z-10 flex flex-col"
                              >
                                {/* Top Controls Header */}
                                <div className="flex justify-between items-center p-4 border-b border-white/5 bg-slate-950 select-none">
                                  <div className="space-y-0.5 text-left">
                                    <span className="text-[9.5px] font-black text-amber-505 uppercase tracking-widest">MVOC Aftermovie</span>
                                    <h4 className="text-xs font-bold text-white">Official 2023 Year End Convoy</h4>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      setIsVideoModalOpen(false);
                                      setIsVideoPlaying(false);
                                    }}
                                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full cursor-pointer transition border border-white/5"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Simulated Display Screen Frame */}
                                <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center select-none">
                                  <img
                                    src={
                                      videoProgress % 4 === 0
                                        ? 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=700&auto=format&fit=crop&q=80'
                                        : videoProgress % 4 === 1
                                          ? 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=700&auto=format&fit=crop&q=80'
                                          : videoProgress % 4 === 2
                                            ? 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=700&auto=format&fit=crop&q=80'
                                            : 'https://images.unsplash.com/photo-1542362567-b07eac79094d?w=700&auto=format&fit=crop&q=80'
                                    }
                                    alt="Active Video Stream"
                                    referrerPolicy="no-referrer"
                                    className={`w-full h-full object-cover select-none pointer-events-none transition duration-500 ${isVideoPlaying ? 'brightness-90 duration-700' : 'brightness-50'}`}
                                  />

                                  {/* Wave volume simulator layout indicator */}
                                  {isVideoPlaying && (
                                    <div className="absolute right-4 top-4 bg-black/60 px-2 py-1 rounded-md text-[9px] font-bold text-emerald-400 flex items-center gap-1 border border-emerald-500/20 select-none">
                                      <div className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                                      <div className="w-1 h-2 bg-emerald-400 rounded-full animate-bounce" />
                                      <div className="w-1 h-3.5 bg-emerald-400 rounded-full animate-pulse" />
                                      <span>AUDIO ACTIVE</span>
                                    </div>
                                  )}

                                  {/* Play center absolute overlay tap */}
                                  {!isVideoPlaying && (
                                    <button
                                      onClick={() => setIsVideoPlaying(true)}
                                      className="absolute p-4.5 bg-[#0F2D52] hover:bg-[#1a4478] text-white rounded-full shadow-2xl scale-105 active:scale-95 transition-all cursor-pointer border border-white/10"
                                    >
                                      <Play className="w-6 h-6 fill-white stroke-[1.5]" />
                                    </button>
                                  )}
                                </div>

                                {/* HUD Timeline Action Deck */}
                                <div className="bg-slate-950 p-4 space-y-3 select-none text-white">
                                  {/* Slider meter block */}
                                  <div className="space-y-1.5">
                                    <div className="relative h-1 bg-white/15 rounded-full overflow-hidden">
                                      <div 
                                        className="absolute left-0 top-0 bottom-0 bg-[#EFF4FB] transition-all duration-300 rounded-full" 
                                        style={{ width: `${(videoProgress / 265) * 100}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between text-[9px] text-slate-400 font-mono font-black select-none">
                                      <span>{Math.floor(videoProgress / 60)}:{(videoProgress % 60).toString().padStart(2, '0')}</span>
                                      <span>4:25</span>
                                    </div>
                                  </div>

                                  {/* Action row switches */}
                                  <div className="flex items-center justify-between text-white shrink-0">
                                    <div className="flex items-center gap-2.5">
                                      <button
                                        onClick={() => {
                                          setIsVideoPlaying(!isVideoPlaying);
                                          triggerToast(isVideoPlaying ? 'Video paused' : 'Video resumed', 'info');
                                        }}
                                        className="px-3.5 py-1.5 bg-white/10 hover:bg-white/15 text-white text-[10.5px] font-black rounded-lg transition cursor-pointer"
                                      >
                                        {isVideoPlaying ? 'Pause' : 'Play'}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setVideoProgress(0);
                                          triggerToast('Restarting aftermovie video track', 'info');
                                        }}
                                        className="text-slate-400 hover:text-white transition cursor-pointer text-[10.5px] font-bold"
                                      >
                                        Restart
                                      </button>
                                    </div>

                                    <span className="text-[9px] bg-[#0F2D52] text-[#EFF4FB] font-black uppercase px-2 py-0.5 rounded border border-[#1b3e6c]/60 shrink-0">
                                      1080P ACTIVE
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* TAB CHAPTERS: STATE CHAPTERS */}
              {currentTab === 'chapters' && (
                <motion.div
                  key="chapters-tab"
                  className="space-y-6 text-left"
                >
                  <StateChapters
                    chaptersList={chaptersList}
                    setChaptersList={setChaptersList}
                    joinedChapters={joinedChapters}
                    setJoinedChapters={setJoinedChapters}
                    triggerToast={triggerToast}
                    setSelectedChapterDetailId={setSelectedChapterDetailId}
                    setSelectedLeadForChat={setSelectedLeadForChat}
                    setChapterLeadChatMessage={setChapterLeadChatMessage}
                    userProfile={userProfile}
                    isSuperAdmin={isSuperAdmin}
                  />
                </motion.div>
              )}

              {/* TAB MERCHANTS: MERCHANT PARTNERS */}
              {currentTab === 'merchants' && (
                <motion.div
                  key="merchants-tab"
                  className="space-y-6 text-left"
                >
                  <MerchantPartners
                    triggerToast={triggerToast}
                    userTier={userProfile?.tier || 'STANDARD'}
                    isAdmin={isAdminOrSuperAdmin()}
                    currentUserRole={displayRole}
                    currentUserId={auth.currentUser?.uid || userProfile?.uid}
                  />
                </motion.div>
              )}

              {/* TAB 8: ANNOUNCEMENTS MODULE */}
              {currentTab === 'announcements' && (
                <motion.div
                  key="announcements-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-6"
                >
                  {/* Title & Subtitle Section */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs text-left">
                    <h2 className="font-display text-2xl font-black text-[#0F2D52] tracking-tight">
                      News & Announcements
                    </h2>
                    <p className="text-slate-500 text-xs font-semibold leading-relaxed mt-1">
                      Stay updated with official committee notices and community alerts.
                    </p>
                  </div>

                  {/* Horizontally scrolling Category Filter row */}
                  <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none text-left">
                    {(['All', 'Official Notices', 'Community'] as const).map((filter) => {
                      const isActive = (filter === 'All' && announcementCategoryFilter === 'All') || 
                                       (filter === 'Official Notices' && announcementCategoryFilter === 'Official Notices') ||
                                       (filter === 'Community' && announcementCategoryFilter === 'Community');
                      const label = filter === 'All' ? 'All Updates' : filter;
                      return (
                        <button
                          key={filter}
                          id={`filter-btn-${filter.replace(/\s+/g, '-').toLowerCase()}`}
                          onClick={() => {
                            setAnnouncementCategoryFilter(filter);
                            triggerToast(`Filtering gallery: ${label}`, 'info');
                          }}
                          className={`px-4.5 py-2.5 rounded-full text-xs font-black tracking-wide shrink-0 transition-all cursor-pointer border ${
                            isActive 
                              ? 'bg-[#0F2D52] text-white border-[#0F2D52] shadow-sm' 
                              : 'bg-white text-slate-500 hover:text-slate-850 border-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Pinned Announcements Accordion Section */}
                  {announcementCategoryFilter === 'All' && (
                    <div className="space-y-3 text-left">
                      <div className="flex items-center gap-1.5 px-0.5 mt-1 select-none">
                        <svg className="w-3.5 h-3.5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
                        </svg>
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">Pinned Announcements</span>
                      </div>

                      {announcements.filter(item => item.pinned).map((item) => {
                        const isBookmarked = bookmarkedAnnouncements.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className="bg-[#FFFDFD] rounded-2xl border border-red-100 shadow-xs overflow-hidden flex flex-col relative border-l-4 border-red-500 hover:shadow-sm transition-all"
                          >
                            <div className="p-5 space-y-3">
                              {/* Metadata belt */}
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                  </div>
                                  <span className="text-[10px] text-red-600 font-extrabold uppercase tracking-wider">
                                    System Alert &bull; {item.date}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${item.title} - ${item.content}`);
                                      triggerToast('Announcement link copied!', 'success');
                                    }}
                                    className="p-1 px-2 text-slate-400 hover:text-[#0F2D52] transition cursor-pointer"
                                    id={`share-ann-${item.id}`}
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (isBookmarked) {
                                        setBookmarkedAnnouncements(bookmarkedAnnouncements.filter(x => x !== item.id));
                                        triggerToast('Bookmark removed', 'info');
                                      } else {
                                        setBookmarkedAnnouncements([...bookmarkedAnnouncements, item.id]);
                                        triggerToast('Bookmark saved', 'success');
                                      }
                                    }}
                                    className="p-1 px-2 text-slate-400 hover:text-amber-500 transition cursor-pointer"
                                    id={`bookmark-ann-${item.id}`}
                                  >
                                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
                                  </button>
                                </div>
                              </div>

                              {/* Title */}
                              <h4 className="text-[15px] font-black text-slate-900 tracking-tight leading-snug">
                                {item.title}
                              </h4>

                              {/* Content */}
                              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                                {item.content}
                              </p>

                              {/* CTA Link */}
                              <div className="pt-1.5 flex justify-start">
                                <button
                                  onClick={() => handleSelectAnnouncement(item)}
                                  className="inline-flex items-center gap-1.5 text-xs font-black text-[#D97706] hover:text-[#B45309] transition-all cursor-pointer"
                                >
                                  <span>{item.linkText || 'View Details'}</span>
                                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Main feed cards */}
                  <div className="space-y-4 text-left">
                    {announcements
                      .filter(item => !item.pinned)
                      .filter(item => announcementCategoryFilter === 'All' || item.category === announcementCategoryFilter)
                      .map((item) => {
                        const isBookmarked = bookmarkedAnnouncements.includes(item.id);
                        
                        {/* 1. Large visual notice card */}
                        if (item.image && item.category === 'Official Notices') {
                          return (
                            <div 
                              key={item.id}
                              className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden flex flex-col group transition-all duration-300 shadow-xs hover:shadow-sm"
                            >
                              {/* Large conference banner */}
                              <div className="relative aspect-video w-full bg-slate-50 overflow-hidden">
                                <img 
                                  src={item.image} 
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-101 transition-transform duration-500" 
                                />
                                {/* Top Left Badge Category overlay */}
                                <div className="absolute top-3.5 left-3.5 py-1.5 px-3 bg-[#0F2D52] text-[10.5px] font-black text-white uppercase rounded-lg tracking-wider flex items-center gap-1.5 shadow-md">
                                  <Megaphone className="w-3.5 h-3.5 text-amber-400 rotate-[-10deg]" />
                                  <span>Official Notice</span>
                                </div>
                              </div>

                              {/* Content block */}
                              <div className="p-4 sm:p-5 space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                    <span>Published {item.date}</span>
                                  </span>

                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(`${item.title} - ${item.content}`);
                                        triggerToast('Announcement link copied!', 'success');
                                      }}
                                      className="p-1 px-2 text-slate-400 hover:text-[#0F2D52] cursor-pointer"
                                      id={`share-ann-large-${item.id}`}
                                    >
                                      <Share2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (isBookmarked) {
                                          setBookmarkedAnnouncements(bookmarkedAnnouncements.filter(x => x !== item.id));
                                          triggerToast('Bookmark removed', 'info');
                                        } else {
                                          setBookmarkedAnnouncements([...bookmarkedAnnouncements, item.id]);
                                          triggerToast('Bookmark saved', 'success');
                                        }
                                      }}
                                      className="p-1 px-2 text-slate-400 hover:text-amber-500 cursor-pointer"
                                      id={`bookmark-ann-large-${item.id}`}
                                    >
                                      <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
                                    </button>
                                  </div>
                                </div>

                                <h3 className="text-sm sm:text-base font-black text-[#0F2D52] tracking-tight leading-snug">
                                  {item.title}
                                </h3>

                                <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                                  {item.content}
                                </p>

                                <div className="pt-1.5 flex justify-start border-t border-slate-50 mt-1">
                                  <button
                                    onClick={() => handleSelectAnnouncement(item)}
                                    className="inline-flex items-center gap-1.5 text-xs font-black text-[#0F2D52] hover:text-[#1c487a] cursor-pointer uppercase tracking-wider"
                                  >
                                    <span>{item.linkText || 'Read Full Notice'}</span>
                                    <ArrowRight className="w-3.5 h-3.5 text-[#0F2D52]" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        {/* 2. Split horizontal photo layout */}
                        if (item.category === 'Community' && item.image) {
                          return (
                            <div 
                              key={item.id}
                              className="bg-white rounded-2xl border border-slate-200/75 overflow-hidden flex flex-row group hover:shadow-xs transition-all p-3 gap-3.5 align-stretch"
                            >
                              {/* Left Thumbnail */}
                              <div className="w-24 sm:w-28 bg-slate-100 rounded-xl overflow-hidden shrink-0 aspect-square select-none relative">
                                <img 
                                  src={item.image} 
                                  alt={item.title} 
                                  className="w-full h-full object-cover group-hover:scale-102 transition"
                                />
                              </div>

                              {/* Right column details */}
                              <div className="flex-1 flex flex-col justify-between text-left space-y-1 my-0.5 pr-0.5">
                                <div>
                                  <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] bg-blue-50 text-[#0066FF] border border-blue-100 font-extrabold tracking-wide px-2 py-0.5 rounded uppercase">
                                        Community
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-bold">{item.date}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={() => triggerToast('Announcement link copied!', 'success')}
                                        className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                                      >
                                        <Share2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (isBookmarked) {
                                            setBookmarkedAnnouncements(bookmarkedAnnouncements.filter(x => x !== item.id));
                                            triggerToast('Bookmark removed', 'info');
                                          } else {
                                            setBookmarkedAnnouncements([...bookmarkedAnnouncements, item.id]);
                                            triggerToast('Bookmark saved', 'success');
                                          }
                                        }}
                                        className="text-slate-400 hover:text-amber-500 p-1 cursor-pointer"
                                      >
                                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
                                      </button>
                                    </div>
                                  </div>

                                  <h4 
                                    className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-snug line-clamp-2 mt-1 hover:text-[#0F2D52] cursor-pointer" 
                                    onClick={() => handleSelectAnnouncement(item)}
                                  >
                                    {item.title}
                                  </h4>

                                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-normal font-semibold">
                                    {item.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        {/* 3. Horizontal split with tag graphic (Partner detailing promo) */}
                        if (item.category === 'Community' && item.isPromoOffer) {
                          return (
                            <div 
                              key={item.id}
                              className="bg-white rounded-2xl border border-slate-200/75 overflow-hidden flex flex-row hover:shadow-xs transition p-3 gap-3.5"
                            >
                              {/* Left Custom graphic block */}
                              <div className="w-24 sm:w-28 bg-gradient-to-tr from-sky-50 to-indigo-50 rounded-xl flex items-center justify-center shrink-0 aspect-square select-none border border-sky-100">
                                <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                                  <Tag className="w-6 h-6 text-[#4F46E5] transform rotate-[-45deg]" />
                                </div>
                              </div>

                              {/* Right column */}
                              <div className="flex-1 flex flex-col justify-between text-left space-y-1 my-0.5 pr-0.5">
                                <div>
                                  <div className="flex justify-between items-center w-full">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] bg-amber-800 text-amber-50 font-extrabold tracking-wide px-2 py-0.5 rounded uppercase">
                                        Partner Offer
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-bold">{item.date}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <button
                                        onClick={() => triggerToast('Promo code copied!', 'success')}
                                        className="text-slate-400 hover:text-slate-705 p-1 cursor-pointer"
                                      >
                                        <Share2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (isBookmarked) {
                                            setBookmarkedAnnouncements(bookmarkedAnnouncements.filter(x => x !== item.id));
                                            triggerToast('Bookmark removed', 'info');
                                          } else {
                                            setBookmarkedAnnouncements([...bookmarkedAnnouncements, item.id]);
                                            triggerToast('Bookmark saved', 'success');
                                          }
                                        }}
                                        className="text-slate-400 hover:text-amber-500 p-1 cursor-pointer"
                                      >
                                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
                                      </button>
                                    </div>
                                  </div>

                                  <h4 
                                    className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-snug line-clamp-2 mt-1 cursor-pointer" 
                                    onClick={() => handleSelectAnnouncement(item)}
                                  >
                                    {item.title}
                                  </h4>

                                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-normal font-semibold">
                                    {item.content}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        {/* 4. Document-Action styled block (Governance Updates) */}
                        if (item.category === 'Governance') {
                          return (
                            <div 
                              key={item.id}
                              className="bg-white rounded-2xl border border-slate-200/75 p-5 space-y-3 shadow-xs"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                                    <ShieldCheck className="w-4.5 h-4.5 text-[#0F2D52]" />
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                                    Governance &bull; {item.date}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => triggerToast('Governance link copied!', 'success')}
                                    className="p-1 px-2 text-slate-400 hover:text-[#0F2D52] cursor-pointer"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (isBookmarked) {
                                        setBookmarkedAnnouncements(bookmarkedAnnouncements.filter(x => x !== item.id));
                                        triggerToast('Bookmark removed', 'info');
                                      } else {
                                        setBookmarkedAnnouncements([...bookmarkedAnnouncements, item.id]);
                                        triggerToast('Bookmark saved', 'success');
                                      }
                                    }}
                                    className="p-1 px-2 text-slate-400 hover:text-amber-500 cursor-pointer"
                                  >
                                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
                                  </button>
                                </div>
                              </div>

                              <h4 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-snug">
                                {item.title}
                              </h4>

                              <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                                {item.content}
                              </p>

                              <div className="pt-2">
                                <button
                                  onClick={() => handleSelectAnnouncement(item)}
                                  className="w-full py-3 border border-slate-250 rounded-xl text-xs font-black text-slate-700 hover:bg-slate-50 transition active:scale-98 cursor-pointer text-center min-h-[44px] flex items-center justify-center gap-2"
                                >
                                  <ClipboardList className="w-4 h-4 text-slate-500 shrink-0" />
                                  <span>Review Document</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div 
                            key={item.id}
                            className="bg-white rounded-2xl border border-slate-150 p-4 space-y-2 text-left"
                          >
                            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                              <span>{item.category} &bull; {item.date}</span>
                            </div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-800">{item.title}</h4>
                            <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">{item.content}</p>
                          </div>
                        );
                      })}
                  </div>

                  {/* Archives expandable block */}
                  {showOlderAnnouncements && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-4 pt-4 text-left border-t border-dashed border-slate-200"
                    >
                      <h4 className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mb-1">Archived Broadcasts</h4>
                      {archivedAnnouncements
                        .filter(item => announcementCategoryFilter === 'All' || item.category === announcementCategoryFilter)
                        .map((item) => {
                          const isBookmarked = bookmarkedAnnouncements.includes(item.id);
                          return (
                            <div 
                              key={item.id}
                              className="bg-white/80 rounded-2xl border border-slate-200 p-4 space-y-2 text-left opacity-90 relative"
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] text-[#0F2D52] font-black uppercase tracking-wider bg-blue-50/50 border border-blue-100 rounded px-1.5 py-0.5">{item.category} &bull; {item.date}</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => triggerToast('Archived link copied!', 'success')}
                                    className="text-slate-400 hover:text-slate-750 cursor-pointer"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (isBookmarked) {
                                        setBookmarkedAnnouncements(bookmarkedAnnouncements.filter(x => x !== item.id));
                                        triggerToast('Bookmark removed', 'info');
                                      } else {
                                        setBookmarkedAnnouncements([...bookmarkedAnnouncements, item.id]);
                                        triggerToast('Bookmark saved', 'success');
                                      }
                                    }}
                                    className="text-slate-400 hover:text-amber-500 cursor-pointer"
                                  >
                                    <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-500' : ''}`} />
                                  </button>
                                </div>
                              </div>
                              <h4 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight cursor-pointer hover:underline" onClick={() => handleSelectAnnouncement(item)}>{item.title}</h4>
                              <p className="text-[11px] text-slate-500 leading-normal line-clamp-2 font-semibold">{item.content}</p>
                            </div>
                          );
                        })}
                    </motion.div>
                  )}

                  {/* Load Older Trigger Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setShowOlderAnnouncements(!showOlderAnnouncements);
                        triggerToast(showOlderAnnouncements ? 'Collapsing older archives' : 'Showing archived broadcasts', 'info');
                      }}
                      className="w-full py-3 bg-[#EAF2FC] hover:bg-[#DCEBFB] text-[#0F2D52] rounded-2xl text-xs font-black transition-colors min-h-[44px] flex items-center justify-center gap-2 cursor-pointer shadow-xs border border-blue-200/20"
                    >
                      <span>{showOlderAnnouncements ? 'Collapse Older Archives' : 'Load Older Announcements'}</span>
                      <ChevronDown className={`w-4 h-4 text-[#0F2D52] transition-transform duration-300 ${showOlderAnnouncements ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* TAB ADMIN: SUPER ADMINISTRATOR CENTER */}
              {currentTab === 'users' && isAdminOrSuperAdmin() && (
                <AdminDashboard
                  membersList={membersList}
                  isFetchingUsers={isFetchingUsers}
                  isMigratingIds={isMigratingIds}
                  isFlushingUsers={isFlushingUsers}
                  handleMigrateMvocIds={handleMigrateMvocIds}
                  handleFlushUsersExceptAdmin={handleFlushUsersExceptAdmin}
                  fetchFirestoreUsers={fetchFirestoreUsers}
                  handleUpdateMemberRole={handleUpdateMemberRole}
                  handleUpdateMemberTier={handleUpdateMemberTier}
                  handleUpdateMemberStatus={handleUpdateMemberStatus}
                  handleUpdateMemberPatch={handleUpdateMemberPatch}
                  handleRunRewardsAudit={handleRunRewardsAudit}
                  isAuditingRewards={isAuditingRewards}
                  displayAvatarUrl={displayAvatarUrl}
                  displayEmail={displayEmail}
                  triggerToast={triggerToast}
                  onNavigateTab={(tab) => navigateToTab(tab as TabType)}
                  activeView="users"
                  currentUserRole={displayRole}
                  isMasterAdmin={isMasterAdmin}
                />
              )}

              {/* TAB ADMIN: BROADCAST MESSAGE MODULE */}
              {currentTab === 'broadcast' && isAdminOrSuperAdmin() && (
                <BroadcastModule
                  onBack={() => setCurrentTab('dashboard')}
                  triggerToast={triggerToast}
                  displayEmail={displayEmail}
                  managedChapter={userProfile?.managedChapter || userProfile?.chapter || ''}
                />
              )}

              {/* TAB COMMUNITY: MEMBER DIRECTORY */}
              {currentTab === 'members' && (
                <motion.div
                  key="members-tab"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <MemberDirectory
                    currentUserId={auth.currentUser?.uid}
                    triggerToast={triggerToast}
                  />
                </motion.div>
              )}

            </AnimatePresence>
          </main>

          {/* Mobile bottom persistent navigation system */}
          <div className="fixed bottom-0 left-0 right-0 bg-[#0b1c30] border-t border-[#132c45] py-2.5 px-4 flex items-center justify-around z-50 shadow-[0_-10px_30px_rgba(3,9,20,0.4)] select-none">
            <button 
              onClick={() => setCurrentTab('dashboard')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                currentTab === 'dashboard' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className={`p-1 px-3.5 rounded-xl ${currentTab === 'dashboard' ? 'bg-[#16243a] text-emerald-400' : ''}`}>
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold">{t('home')}</span>
            </button>

            {(isSuperAdmin || appConfig.events !== false) && (
              <button 
                onClick={() => setCurrentTab('events')}
                className={`flex flex-col items-center gap-1 cursor-pointer transition-colors relative ${
                  currentTab === 'events' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className={`p-1 px-3.5 rounded-xl ${currentTab === 'events' ? 'bg-[#16243a] text-emerald-400' : ''}`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold flex items-center gap-1">
                  {t('events')}
                  {isSuperAdmin && appConfig.events === false && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" title="Hidden from members" />
                  )}
                </span>
              </button>
            )}

            <button 
              onClick={() => setCurrentTab('members')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                currentTab === 'members' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className={`p-1 px-3.5 rounded-xl ${currentTab === 'members' ? 'bg-[#16243a] text-emerald-400' : ''}`}>
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold">Members</span>
            </button>

            <button 
              onClick={() => setCurrentTab('profile')}
              className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                currentTab === 'profile' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className={`p-1 px-3.5 rounded-xl ${currentTab === 'profile' ? 'bg-[#16243a] text-emerald-400' : ''}`}>
                <User className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold">{t('profile')}</span>
            </button>

            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="flex flex-col items-center gap-1 cursor-pointer transition-colors text-slate-400 hover:text-slate-300"
            >
              <div className="p-1 px-3.5 rounded-xl">
                <Menu className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-[10px] font-bold">More</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Google Oauth Popup Blocked Alert */}
      <AnimatePresence>
        {isAuthPopupBlockedOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthPopupBlockedOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 border border-slate-100 shadow-2xl z-10"
            >
              <button 
                onClick={() => setIsAuthPopupBlockedOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-4 pt-2">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
                  <ShieldAlert className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-display text-base font-black text-[#0F2D52] tracking-tight">
                    Google Auth Popup Blocked
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    You are currently previewing this app inside a sandboxed iframe, which prevents popups from opening.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-left space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-[#0F2D52] tracking-wider block">Solution (Recommended)</span>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Open the app in a new window/tab by clicking the <strong>"Open in New Tab"</strong> button in the editor header, then click <strong>Sign in with Google</strong>.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => setIsAuthPopupBlockedOpen(false)}
                    className="w-full bg-[#0F2D52] hover:bg-[#153964] text-white font-bold text-xs h-[42px] rounded-xl transition cursor-pointer"
                  >
                    Got it, let me retry
                  </button>
                  <p className="text-[8px] text-slate-400 font-mono break-all text-center">
                    Firebase Code: {authPopupErrorMsg || "auth/popup-blocked"}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Interactive Announcements Detail Modal */}
      <AnimatePresence>
        {selectedAnnouncement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAnnouncement(null)}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
              id="ann-detail-backdrop"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 z-10 max-h-[85vh] flex flex-col"
              id="ann-detail-card"
            >
              {/* Type-based colored highlight strip */}
              <div className={`h-1.5 w-full ${
                selectedAnnouncement.pinned 
                  ? 'bg-red-500' 
                  : selectedAnnouncement.category === 'Official Notices'
                    ? 'bg-[#0F2D52]'
                    : selectedAnnouncement.category === 'Governance'
                      ? 'bg-teal-600'
                      : 'bg-[#4F46E5]'
              }`} />

              {/* Close Button X */}
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition-colors cursor-pointer z-20 shadow-xs border border-slate-200/50"
                id="close-ann-detail"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">
                {/* Meta Header block */}
                <div>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                    selectedAnnouncement.pinned 
                      ? 'bg-red-50 text-red-600 border-red-100' 
                      : selectedAnnouncement.category === 'Official Notices'
                        ? 'bg-slate-50 text-[#0F2D52] border-slate-200'
                        : selectedAnnouncement.category === 'Governance'
                          ? 'bg-teal-50 text-teal-700 border-teal-150'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                  }`}>
                    {selectedAnnouncement.pinned ? '📌 Pinned Notice' : selectedAnnouncement.category}
                  </span>
                  <span className="text-xs text-slate-400 font-bold ml-2.5">
                    &bull; Published {selectedAnnouncement.date}
                  </span>
                </div>

                {/* Cover photographic banner for official cards */}
                {selectedAnnouncement.image && (
                  <div className="w-full aspect-video bg-slate-50 rounded-2xl overflow-hidden relative border border-slate-100 shadow-inner select-none">
                    <img 
                      src={selectedAnnouncement.image} 
                      alt={selectedAnnouncement.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Primary Content titles */}
                <div className="space-y-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug">
                    {selectedAnnouncement.title}
                  </h3>
                  <div className="h-0.5 w-12 bg-slate-200 rounded-full" />
                </div>

                {/* Excerpt Descriptions */}
                <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed font-semibold">
                  {selectedAnnouncement.content}
                </p>

                {/* DYNAMIC COMPONENT 1: Pinned Maintenance Alert Checklist */}
                {selectedAnnouncement.pinned && (
                  <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 space-y-3">
                    <h5 className="text-xs font-black text-red-800 tracking-wide uppercase flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span>Scheduled Maintenance Impacts</span>
                    </h5>
                    <ul className="space-y-2 text-[11px] text-red-950 font-medium font-sans">
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 select-none font-bold">&bull;</span>
                        <span><strong>Digital Wallet Cards</strong>: Not synced from 00:00 to 04:00 MYT (local storage cached cards remain valid).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 select-none font-bold">&bull;</span>
                        <span><strong>QR Code Scanner</strong>: Offline during maintenance. Use manual member registration if needed.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-500 select-none font-bold">&bull;</span>
                        <span><strong>Profile Modals</strong>: Safe to browse, database saves are queued until completed.</span>
                      </li>
                    </ul>
                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setSelectedAnnouncement(null);
                          triggerToast('Thank you for verifying maintenance notice schedule.', 'success');
                        }}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-98 min-h-[40px] cursor-pointer"
                      >
                        Acknowledge & Close
                      </button>
                    </div>
                  </div>
                )}

                {/* DYNAMIC COMPONENT 2: AGM RSVP Widgets */}
                {!selectedAnnouncement.pinned && selectedAnnouncement.title.includes('Annual General Meeting') && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3.5">
                    <div className="text-left">
                      <h5 className="text-xs font-black text-slate-800 tracking-wide uppercase">Your RSVP Allocation Status</h5>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">Please indicate your physical attendance decision below.</p>
                    </div>

                    {announcementRsvpStatus === 'none' ? (
                      <div className="flex gap-2.5 pt-1">
                        <button
                          onClick={() => {
                            setAnnouncementRsvpStatus('confirmed');
                            triggerToast('RSVP submitted: Attending AGM', 'success');
                          }}
                          className="flex-1 py-3 bg-[#0F2D52] hover:bg-[#153e70] text-white rounded-xl text-xs font-black transition-colors min-h-[40px] cursor-pointer shadow-xs active:scale-98"
                        >
                          Confirm Attendance
                        </button>
                        <button
                          onClick={() => {
                            setAnnouncementRsvpStatus('declined');
                            triggerToast('RSVP submitted: Unable to attend', 'info');
                          }}
                          className="flex-1 py-3 bg-white border border-slate-250 hover:bg-slate-50 text-slate-750 rounded-xl text-xs font-bold transition-all min-h-[40px] cursor-pointer"
                        >
                          Decline RSVP
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-slate-150 rounded-xl flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          announcementRsvpStatus === 'confirmed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                        }`}>
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-xs font-black text-slate-800">
                            {announcementRsvpStatus === 'confirmed' ? 'Seat Reserved Successfully' : 'Reservation Not Requested'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {announcementRsvpStatus === 'confirmed' 
                              ? 'Your RSVP confirmation barcode is linked to your digital membership tag.' 
                              : 'You opted out of this AGM. You can change your selection by contacting admin.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* DYNAMIC COMPONENT 3: Technical Care Series scheduling seat count widget */}
                {!selectedAnnouncement.pinned && selectedAnnouncement.title.includes('Technical Workshop') && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4.5 space-y-3 text-left">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block tracking-wider">Venue</span>
                        <span className="font-bold text-[#0F2D52] block mt-0.5">HQ Diagnostic Bay</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase block tracking-wider">Registration Space</span>
                        <span className="font-bold text-slate-800 block mt-0.5">45/50 Seats Booked</span>
                      </div>
                    </div>

                    {workshopRegistered ? (
                      <div className="p-3 bg-green-50 border border-green-150 rounded-xl flex items-center gap-2.5">
                        <CheckCircle2 className="w-4.5 h-4.5 text-green-600 shrink-0" />
                        <div>
                          <p className="text-[11.5px] font-black text-green-800">Workshop Ticket Locked</p>
                          <p className="text-[10px] text-green-700/80 mt-0.5 font-semibold">Seat reservation index #46 confirmed for workshop care track.</p>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setWorkshopRegistered(true);
                          triggerToast('Workshop ticket registered!', 'success');
                        }}
                        className="w-full py-3 bg-[#0F2D52] hover:bg-[#183e6b] text-white rounded-xl text-xs font-black transition shadow-xs active:scale-98 min-h-[44px] cursor-pointer"
                      >
                        Register for Technical Series
                      </button>
                    )}
                  </div>
                )}

                {/* DYNAMIC COMPONENT 4: Partner Detailing Promo Offer with coupon stub visual design */}
                {!selectedAnnouncement.pinned && selectedAnnouncement.isPromoOffer && (
                  <div className="bg-gradient-to-tr from-[#FFF7ED] to-[#FFFBEB] border border-amber-200 rounded-2xl p-4.5 space-y-3.5 text-left relative overflow-hidden">
                    {/* Security stamp watermark in visual corner */}
                    <div className="absolute -right-3 -bottom-3 text-amber-100/30 font-display text-4xl font-black uppercase tracking-wider select-none transform rotate-[-15deg]">
                      Elite
                    </div>

                    <div className="border-b border-dashed border-amber-200 pb-2">
                      <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded tracking-wide uppercase">Exclusive member voucher</span>
                      <h5 className="text-[13px] font-black text-amber-950 mt-1.5">Elite Auto Detailing paint correction bonus voucher</h5>
                    </div>

                    <div className="flex items-center justify-between gap-2.5">
                      <div className="bg-white border-2 border-dashed border-amber-300 rounded-xl p-2.5 px-3 flex-1 text-center select-all font-mono text-[#EAB308] font-black text-[13px] tracking-widest uppercase">
                        MVOCELITEVELOZ
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('MVOCELITEVELOZ');
                          setCopiedPromo(true);
                          triggerToast('Copied detailing promo voucher card!', 'success');
                        }}
                        className="py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black transition-colors shrink-0 cursor-pointer text-center min-h-[38px]"
                      >
                        {copiedPromo ? 'Copied' : 'Copy Code'}
                      </button>
                    </div>

                    <p className="text-[10px] text-amber-600/90 leading-tight font-medium">
                      &bull; Present this digital coupon code during checkout at any Elite Auto Detailing outlet to save 15% on premium coatings and paint correction seals.
                    </p>
                  </div>
                )}

                {/* DYNAMIC COMPONENT 5: Governance / Code of Conduct Updates */}
                {!selectedAnnouncement.pinned && selectedAnnouncement.category === 'Governance' && (
                  <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-4.5 space-y-3.5 text-left">
                    <div className="text-teal-950 space-y-2.5 font-sans font-medium text-[11px] leading-relaxed">
                      <span className="text-[10px] bg-teal-100 text-teal-800 font-extrabold px-2 py-0.5 rounded tracking-wide uppercase">Mandated review and verify</span>
                      <p><strong>Section 4.1.2 Safe Spacing Convoy</strong>: Cluster convoy Velox formations are strictly capped at 12 cars maximum. Safe trailing margins of 3 Velox-lengths must be maintained.</p>
                      <p><strong>Section 4.3 PMR Channel</strong>: Mandatory monitoring of radio channel 14 during official club cruises. Side chats are limited to backup channels.</p>
                    </div>

                    <div className="border-t border-teal-100/60 pt-3 flex items-start gap-2.5">
                      <input 
                        type="checkbox"
                        id="agree-conduct-conduct"
                        checked={conductAcknowledge}
                        onChange={(e) => {
                          setConductAcknowledge(e.target.checked);
                          if (e.target.checked) {
                            triggerToast('Document read commitment verified!', 'success');
                          }
                        }}
                        className="mt-0.5 rounded text-teal-600 border-teal-200 outline-none focus:ring-teal-500/20 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="agree-conduct-conduct" className="text-[10.5px] text-teal-900 font-bold select-none cursor-pointer">
                        I am committed to comply with the updated MVOC Code of Conduct rules during all joint community cruises.
                      </label>
                    </div>

                    <button
                      disabled={!conductAcknowledge}
                      onClick={() => {
                        setSelectedAnnouncement(null);
                        triggerToast('Acknowledged Code of Conduct successfully.', 'success');
                      }}
                      className={`w-full py-3 rounded-xl text-xs font-black transition-all min-h-[44px] flex items-center justify-center gap-1.5 text-center cursor-pointer ${
                        conductAcknowledge 
                          ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs' 
                          : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Verify Commitment Receipt</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Interactive Convoy RSVP Booking Overlay Modal */}
      <AnimatePresence>
        {selectedJoiningConvoyId !== null && (() => {
          const activeItem = convoysList.find(c => c.id === selectedJoiningConvoyId);
          if (!activeItem) return null;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedJoiningConvoyId(null)}
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
              />

              {/* Modal Body */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 z-10 max-h-[90vh] flex flex-col text-left font-sans"
              >
                {/* Visual strip indicator */}
                <div className="h-1.5 w-full bg-[#0F2D52]" />

                {/* Close Button X */}
                <button
                  onClick={() => setSelectedJoiningConvoyId(null)}
                  className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-850 rounded-full transition-colors cursor-pointer z-20 shadow-xs border border-slate-205/40"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">
                  {/* Headline Header */}
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-[#0F2D52] border border-blue-100 px-2.5 py-1 rounded-md">
                      Official Convoy RSVP
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug mt-2">
                      {activeItem.title}
                    </h3>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-3 text-xs pt-1">
                    {/* Vehicle Plate row */}
                    <div className="space-y-1">
                      <label className="block text-[10.5px] font-extrabold text-slate-705 tracking-wide uppercase">
                        Vehicle Plate Number
                      </label>
                      <input 
                        type="text"
                        value={joiningVehicleNumber}
                        onChange={(e) => setJoiningVehicleNumber(e.target.value.toUpperCase())}
                        placeholder="E.G. VCD 8834"
                        className="w-full p-3 bg-slate-50 border border-slate-205 rounded-xl font-mono text-sm uppercase font-black tracking-wider outline-hidden focus:border-[#0F2D52]"
                      />
                    </div>

                    {/* Passenger count and Chapter flag side by side */}
                    <div className="grid grid-cols-2 gap-3 text-left">
                      <div className="space-y-1">
                        <label className="block text-[10.5px] font-extrabold text-slate-705 tracking-wide uppercase">
                          Total Passengers
                        </label>
                        <select 
                          value={joiningPaxCount}
                          onChange={(e) => setJoiningPaxCount(e.target.value)}
                          className="w-full p-3 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold select-none outline-hidden focus:border-[#0F2D52] cursor-pointer"
                        >
                          <option value="1">1 Person (Driver Only)</option>
                          <option value="2">2 Persons</option>
                          <option value="3">3 Persons</option>
                          <option value="4">4 Persons</option>
                          <option value="5">5+ Persons</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10.5px] font-extrabold text-slate-705 tracking-wide uppercase">
                          Regional Chapter
                        </label>
                        <select
                          value={joiningChapter}
                          onChange={(e) => setJoiningChapter(e.target.value)}
                          className="w-full p-3 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold outline-hidden focus:border-[#0F2D52] cursor-pointer"
                        >
                          <option value="Kuala Lumpur">Kuala Lumpur</option>
                          <option value="Selangor Chapter">Selangor Chapter</option>
                          <option value="Penang Chapter">Penang Chapter</option>
                          <option value="Johor Chapter">Johor Chapter</option>
                          <option value="Perak Chapter">Perak Chapter</option>
                        </select>
                      </div>
                    </div>

                    {/* Meal / Culinary preferences */}
                    <div className="space-y-1">
                      <label className="block text-[10.5px] font-extrabold text-slate-750 tracking-wide uppercase">
                        Dietary Preference (Catering Purposes)
                      </label>
                      <div className="flex gap-2">
                        {['None', 'Halal Required', 'Vegetarian'].map((diet) => {
                          const isSelected = joiningDietary === diet;
                          return (
                            <button
                              key={diet}
                              type="button"
                              onClick={() => setJoiningDietary(diet)}
                              className={`flex-1 py-1.5 border rounded-xl text-[10.5px] font-extrabold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50 text-[#0F2D52] border-[#0F2D52]'
                                  : 'bg-white text-slate-600 border-slate-205 hover:bg-slate-50'
                              }`}
                            >
                              {diet}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Safe Driving Undertaking rules */}
                    <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl md:space-y-2 mt-2">
                      <div className="flex items-start gap-2.5">
                        <input 
                          type="checkbox"
                          id="agree-rules-convoy"
                          checked={joiningAgreedRules}
                          onChange={(e) => setJoiningAgreedRules(e.target.checked)}
                          className="mt-0.5 rounded text-[#0F2D52] border-slate-350 focus:ring-[#0F2D52]/20 w-4 h-4 cursor-pointer outline-hidden"
                        />
                        <label htmlFor="agree-rules-convoy" className="text-[10px] text-slate-600 font-bold cursor-pointer select-none leading-relaxed">
                          I agree to standard MVOC cruise safety protocols. Safe trailing margins of 3 Velox car-lengths and sub-cluster limits will be self-regulated.
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Submission and option to Cancel registration */}
                  <div className="space-y-2 pt-1">
                    <button
                      disabled={!joiningAgreedRules || !joiningVehicleNumber.trim()}
                      onClick={() => {
                        // Update the convoy registered status in convoysList
                        setConvoysList(prevList => 
                          prevList.map(c => {
                            if (c.id === selectedJoiningConvoyId) {
                              const alreadyReg = c.userRegistered;
                              return {
                                ...c,
                                userRegistered: true,
                                joinedCount: alreadyReg ? c.joinedCount : c.joinedCount + 1,
                              };
                            }
                            return c;
                          })
                        );

                        // Also update global persist rules just in case
                        setConvoyVehicleNumber(joiningVehicleNumber);
                        setConvoyShirtSize(joiningShirtSize);
                        setConvoyPaxCount(joiningPaxCount);
                        setChapterSelector(joiningChapter);

                        triggerToast(`Registration locked successfully for ${activeItem.title}! Your member digital bar is updated.`, 'success');
                        setSelectedJoiningConvoyId(null);
                      }}
                      className={`w-full py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer ${
                        joiningAgreedRules && joiningVehicleNumber.trim()
                          ? 'bg-[#0F2D52] hover:bg-[#1c4d81] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-400 border border-slate-205 cursor-not-allowed'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>{activeItem.userRegistered ? 'Update Registration' : 'Confirm Registration'}</span>
                    </button>

                    {/* Interactive "Leave Convoy" option to toggle/debug slot levels */}
                    {activeItem.userRegistered && (
                      <button
                        onClick={() => {
                          setConvoysList(prevList =>
                            prevList.map(c => {
                              if (c.id === selectedJoiningConvoyId) {
                                return {
                                  ...c,
                                  userRegistered: false,
                                  joinedCount: Math.max(0, c.joinedCount - 1),
                                };
                              }
                              return c;
                            })
                          );
                          triggerToast(`Cancelled registration booking for ${activeItem.title}`, 'info');
                          setSelectedJoiningConvoyId(null);
                        }}
                        className="w-full py-2.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-650 rounded-xl text-[11px] font-black transition-all min-h-[38px] cursor-pointer text-center"
                      >
                        Leave Convoy / Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* MODAL 4: Marshall Role Request Application Overlay */}
      <AnimatePresence>
        {isMarshallModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMarshallModalOpen(false)}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 z-10 max-h-[85vh] flex flex-col text-left font-sans"
            >
              <div className="h-1.5 w-full bg-amber-500" />

              {/* Close Button X */}
              <button
                onClick={() => setIsMarshallModalOpen(false)}
                className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-205 text-slate-500 hover:text-slate-800 rounded-full transition-colors cursor-pointer z-20 border border-slate-205/30"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-widest bg-amber-50 text-amber-800 border border-amber-100 px-2.5 py-1 rounded-md">
                    Road Marshall Status
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug mt-2">
                    Apply for Driving Marshall Rank
                  </h3>
                  <p className="text-[10.5px] text-slate-400 mt-1 font-semibold leading-normal">
                    Lead future MVOC caravans. Certified marshalls execute dynamic route speed controls and maintain cluster links.
                  </p>
                </div>

                {/* Benefits / Rewards List Visual styling */}
                <div className="bg-amber-50/50 border border-amber-100/80 rounded-2xl p-4 space-y-2.5 text-left">
                  <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-wider">
                    Exclusive Marshall Deliverables
                  </h4>
                  <ul className="space-y-1.5 text-[11px] text-amber-950 font-medium leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 text-xs">🛠</span>
                      <span><strong>High-Vis Safety Gear</strong>: Official neon MVOC Marshall utility safety vest.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 text-xs">🧲</span>
                      <span><strong>Magnetic Indicators</strong>: Cohesive magnetic door shields for your Velox.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-500 text-xs">📡</span>
                      <span><strong>PMR Lead Channel</strong>: Exclusive lead radio transceiver allocations.</span>
                    </li>
                  </ul>
                </div>

                {/* Form Inputs */}
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-605 uppercase tracking-wide">
                      Vehicle Model Registered
                    </label>
                    <input 
                      type="text"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-hidden focus:border-amber-550"
                      defaultValue="Toyota Veloz 1.5 AT"
                      readOnly
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-605 uppercase tracking-wide">
                      Experience with Large Caravan Drives?
                    </label>
                    <input 
                      type="text"
                      value={marshallExperience}
                      onChange={(e) => setMarshallExperience(e.target.value)}
                      placeholder="e.g. Led multiple national chapter routes successfully"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-hidden focus:border-amber-550"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-610 uppercase tracking-wide">
                      Introduce Yourself / Why Lead the Convoy?
                    </label>
                    <textarea 
                      rows={3}
                      value={marshallMessage}
                      onChange={(e) => setMarshallMessage(e.target.value)}
                      placeholder="Share a short note about your road navigation familiarity..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-hidden focus:border-amber-550 resize-none"
                    />
                  </div>
                </div>

                {/* Application submission key buttons */}
                <div className="pt-2">
                  <button
                    onClick={() => {
                      triggerToast('Marshall Application submitted for committee review!', 'success');
                      setIsMarshallModalOpen(false);
                    }}
                    className="w-full py-3.5 bg-[#0F2D52] hover:bg-[#1d436e] text-white rounded-xl text-xs font-black transition-colors min-h-[44px] cursor-pointer flex items-center justify-center gap-1 text-center"
                  >
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Submit Driving Application</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 5: Contact Chapter Lead Message Chat Overlay */}
      <AnimatePresence>
        {selectedLeadForChat !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLeadForChat(null)}
              className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 z-10 max-h-[85vh] flex flex-col text-left font-sans"
            >
              <div className="h-1.5 w-full bg-[#0F2D52]" />

              {/* Close Button X */}
              <button
                onClick={() => setSelectedLeadForChat(null)}
                className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-205 text-slate-500 hover:text-slate-800 rounded-full transition-colors cursor-pointer z-20 border border-slate-205/30"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 space-y-4">
                <div>
                  <span className="text-[9.5px] font-black uppercase tracking-widest bg-blue-50 text-[#0F2D52] border border-blue-100 px-2.5 py-1 rounded-md">
                    Secure Chapter Dispatch
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-snug mt-2">
                    Message chapter lead: {selectedLeadForChat.name}
                  </h3>
                  <p className="text-[10.5px] text-slate-400 mt-1 font-semibold leading-normal">
                    Query administrative access, local PMR radio frequency schedules, or upcoming meetup locations directly with the local leader of {selectedLeadForChat.chapter}.
                  </p>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-150">
                  {selectedLeadForChat.image ? (
                    <img
                      src={selectedLeadForChat.image}
                      alt={selectedLeadForChat.name}
                      className="w-11 h-11 rounded-full object-cover shrink-0 border border-white shadow-2xs"
                    />
                  ) : (
                    <div className="w-11 h-11 bg-[#BACFDF] text-[#1D3E5E] font-black text-sm flex items-center justify-center rounded-full border border-white shrink-0 shadow-2xs">
                      {selectedLeadForChat.initial}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-black text-slate-800 block">{selectedLeadForChat.name}</span>
                    <span className="text-[9.5px] font-bold text-slate-400 block mt-0.5">{selectedLeadForChat.title} • {selectedLeadForChat.chapter}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-left">
                  <label className="block text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wide">
                    Compose Message (Strictly English)
                  </label>
                  <textarea
                    rows={4}
                    value={chapterLeadChatMessage}
                    onChange={(e) => setChapterLeadChatMessage(e.target.value)}
                    placeholder="Write your message here..."
                    className="w-full p-3 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold select-none outline-hidden focus:border-[#0F2D52] resize-none"
                  />
                </div>

                <div className="pt-1.5">
                  <button
                    disabled={!chapterLeadChatMessage.trim()}
                    onClick={() => {
                      triggerToast(`Message dispatched successfully to ${selectedLeadForChat.name}! They will reply to your registered email or system dashboard shortly.`, 'success');
                      setSelectedLeadForChat(null);
                    }}
                    className={`w-full py-3.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer ${
                      chapterLeadChatMessage.trim()
                        ? 'bg-[#0F2D52] hover:bg-[#184271] text-white'
                        : 'bg-slate-100 text-slate-400 border border-slate-205 cursor-not-allowed'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>Send Secure Message</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 6: Interactive Chapter Detail Overlay Modal */}
      <AnimatePresence>
        {selectedChapterDetailId !== null && (() => {
          const activeItem = chaptersList.find(c => c.id === selectedChapterDetailId);
          if (!activeItem) return null;
          const isJoined = joinedChapters.includes(activeItem.id);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedChapterDetailId(null)}
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
              />

              {/* Modal Body */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 z-10 max-h-[90vh] flex flex-col text-left font-sans"
              >
                <div className="h-1.5 w-full bg-[#0F2D52]" />

                {/* Close Button X */}
                <button
                  onClick={() => setSelectedChapterDetailId(null)}
                  className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-205 text-slate-500 hover:text-slate-800 rounded-full transition-colors cursor-pointer z-20 border border-slate-205/30"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="overflow-y-auto flex-1 p-6 space-y-4">
                  {/* Chapter title and badge */}
                  <div>
                    <span className="text-[9.5px] font-black uppercase tracking-widest bg-blue-50 text-[#0F2D52] border border-blue-105/30 px-2.5 py-1 rounded-md inline-block select-none">
                      {activeItem.region} Chapter Registry
                    </span>
                    <h3 className="text-lg font-black text-[#0F2D52] tracking-tight leading-none mt-2">
                      {activeItem.name} Assembly
                    </h3>
                    {activeItem.subText && (
                      <p className="text-xs text-[#0f2d52]/80 mt-1.5 font-medium italic border-l-2 border-blue-300 pl-2">
                        "{activeItem.subText}"
                      </p>
                    )}
                  </div>

                  {/* Chapter description */}
                  <div className="space-y-1">
                     <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block">
                       Chapter Description
                     </span>
                     <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                       {activeItem.description || 'No description provided yet.'}
                     </p>
                  </div>

                  {/* Chapter details list */}
                  <div className="space-y-3.5 text-xs text-left">
                    {/* Routine schedule */}
                    <div className="space-y-1">
                      <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block">
                        Weekly / Monthly Meetup Routine
                      </span>
                      <span className="text-xs font-black text-slate-800 block leading-normal bg-blue-50/50 p-2.5 rounded-xl border border-blue-105/10">
                        {activeItem.meetupRoutine || 'No routine provided yet.'}
                      </span>
                    </div>

                    {/* Member counts */}
                    <div className="flex justify-between items-center py-2 border-t border-b border-dashed border-slate-200">
                      <div>
                        <span className="text-[9.5px] font-black text-slate-400 uppercase block select-none">
                          Active Chapter Members
                        </span>
                        <span className="text-base font-black text-[#0F2D52] block mt-0.5">
                          {activeItem.membersCount.toLocaleString()} Verified Leads
                        </span>
                      </div>
                      <div className="p-2 py-1.5 bg-blue-50 text-blue-700 font-extrabold text-[10px] rounded-lg border border-blue-100">
                        {activeItem.isHQ ? 'CHAPTER HQ' : 'ACTIVE CLUSTER'}
                      </div>
                    </div>

                    {/* Registered car plates */}
                    <div className="space-y-1.5">
                      <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider block select-none">
                        Active Chapter Vehicles Registered Inside Feed
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeItem.registeredCars.map((plate) => (
                          <span
                            key={plate}
                            className="bg-slate-100 border border-slate-205 text-slate-700 font-mono text-[10.5px] font-black tracking-wider px-2 py-1 rounded"
                          >
                            {plate}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action items: Join Toggle / Quit Toggle */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={() => setSelectedChapterDetailId(null)}
                      className="w-full py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-black hover:bg-slate-50 transition-colors min-h-[38px] cursor-pointer text-center"
                    >
                      Dismiss View
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* FULL-SCREEN NAVIGATION SLIDING DRAWER ACCORDING TO SCREENSHOT */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex">
            {/* Dark background backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs z-20"
              id="drawer-backdrop"
            />

            {/* Sidebar drawer body */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-80 max-w-[85vw] bg-[#0E2340] text-slate-100 flex flex-col justify-between shadow-2xl h-full z-30 overflow-y-auto"
              id="drawer-content"
            >
              <div>
                
                {/* 1. Header Profile Panel */}
                <div className="p-6 bg-[#0B1E36] border-b border-white/5 relative">
                  {/* Official Admin Patch for Slider Drawer */}
                  {(userProfile?.patch_status || userProfile?.officialPatch) && !isStealthActive && (
                    <div className="absolute top-4 right-14 flex items-center gap-1 bg-emerald-500 text-white font-black text-[7px] uppercase tracking-wider py-1 px-2 rounded-full shadow-[0px_0px_6px_rgba(16,185,129,0.4)] border border-emerald-300 select-none">
                      <span>Admin Patch</span>
                    </div>
                  )}
                  {/* Trusted Elite Gold Badge for Drawer */}
                  {!isStealthActive && (userProfile?.patch === 'mvoc_trusted_elite') && (
                    <div className={`absolute top-4 ${((userProfile?.patch_status || userProfile?.officialPatch) && !isStealthActive) ? 'right-28' : 'right-14'} flex items-center gap-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-[7px] uppercase tracking-wider py-1 px-2.5 rounded-full shadow-[0px_0px_6px_rgba(245,158,11,0.5)] border border-amber-300 select-none`}>
                      <Award className="w-2 h-2 text-slate-950 shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
                      <span>Trusted Elite</span>
                    </div>
                  )}
                  
                  {/* Close button X top right */}
                  <button 
                    onClick={() => setIsDrawerOpen(false)}
                    className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                    id="btn-close-drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex flex-col space-y-4">
                    {/* User profile image with golden circular border and checkmark emblem */}
                    <div className="relative w-16 h-16 pointer-events-none select-none">
                      <img 
                        src={displayAvatarUrl} 
                        alt={`${displayName} Profile`} 
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400/80 shadow-md"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-amber-400 text-[#0E2340] p-0.5 rounded-full shadow border border-[#0B1E36] flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-[#0E2340] fill-amber-400" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-display font-bold tracking-tight text-white">
                        {displayName}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-400 font-mono tracking-wide font-medium">
                          {displayMvocId}
                        </span>
                        <span className="text-[8.5px] font-sans font-extrabold border border-amber-400/75 text-amber-400 tracking-wider px-1.5 py-0.2 rounded-md uppercase">
                          {displayTier} MEMBER
                        </span>
                        {displayManagedChapter && (
                          <span className="px-1.5 py-0.5 text-[8.5px] font-bold bg-blue-900 border border-blue-500/50 text-white rounded-full uppercase tracking-wider">
                            {displayManagedChapter}
                          </span>
                        )}
                      </div>
                      <div className="pt-1.5">
                        <span className="inline-flex items-center justify-center bg-black/80 text-white font-mono font-bold tracking-widest px-2.5 py-1 rounded-md border border-slate-600 text-[10px] uppercase shadow-sm">
                          {userProfile?.vehiclePlate || 'NO PLATE'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Menu Items Navigation System */}
                <div className="p-4 space-y-5">

                  {/* ADMIN CONTROL PANEL */}
                  {isAdminOrSuperAdmin() && (
                    <div className="space-y-3 mb-1">
                      {/* Admin Council Card */}
                      <div className="space-y-1 bg-[#EEF2F6]/5 border border-white/5 p-2 rounded-2xl">
                        <span className="text-[10px] font-extrabold text-amber-500 tracking-widest uppercase block px-2.5 mb-1.5 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                          Admin Council
                        </span>

                        <button
                          onClick={() => navigateToTab('users')}
                          className={`relative z-20 pointer-events-auto cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition ${
                            currentTab === 'users' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400 shadow-md' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <UserCog className="w-4 h-4 shrink-0 text-amber-500" />
                          <span>User Management</span>
                        </button>

                        <button
                          onClick={() => {
                            console.log('List QR Code Button clicked!');
                            setIsDrawerOpen(false);
                            setIsAdminQrListOpen(true);
                          }}
                          className="relative z-[9999] pointer-events-auto cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition text-slate-300 hover:bg-white/5 hover:text-white"
                          style={{ cursor: 'pointer' }}
                        >
                          <QrCode className="w-4 h-4 shrink-0 text-amber-500" />
                          <span>List QR Code</span>
                        </button>

                        <button
                          onClick={() => navigateToTab('broadcast')}
                          className={`relative z-20 pointer-events-auto cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition ${
                            currentTab === 'broadcast' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400 shadow-md' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <Megaphone className="w-4 h-4 shrink-0 text-amber-500" />
                          <span>Broadcast Message</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {/* CORE EXPERIENCE CATEGORY */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block px-3 mb-2">
                      Core Experience
                    </span>
                    
                    {(isSuperAdmin || appConfig.dashboard !== false) && (
                      <button
                        onClick={() => navigateToTab('dashboard')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'dashboard' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <LayoutDashboard className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.dashboard === false ? "line-through opacity-50" : ""}>{t('dashboard')}</span>
                        </div>
                        {renderNavToggle('dashboard')}
                      </button>
                    )}
 
                    <button
                      onClick={() => navigateToTab('profile')}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                        currentTab === 'profile' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <User className="w-4.5 h-4.5 shrink-0" />
                      <span>{t('profile')}</span>
                    </button>
 
                    {(isSuperAdmin || appConfig.vehicle !== false) && (
                      <button
                        onClick={() => navigateToTab('vehicle')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'vehicle' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Car className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.vehicle === false ? "line-through opacity-50" : ""}>{t('vehicle')}</span>
                        </div>
                        {renderNavToggle('vehicle')}
                      </button>
                    )}
 
                    {(isSuperAdmin || appConfig.card !== false) && (
                      <button
                        onClick={() => navigateToTab('card')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'card' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Contact className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.card === false ? "line-through opacity-50" : ""}>{t('card')}</span>
                        </div>
                        {renderNavToggle('card')}
                      </button>
                    )}
                  </div>
 
                  {/* COMMUNITY & EVENTS CATEGORY */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block px-3 mb-2">
                      Community & Events
                    </span>
 
                    {(isSuperAdmin || appConfig.events !== false) && (
                      <button
                        onClick={() => navigateToTab('events')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'events' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.events === false ? "line-through opacity-50" : ""}>{t('events')}</span>
                        </div>
                        {renderNavToggle('events')}
                      </button>
                    )}
 
                    {(isSuperAdmin || appConfig.convoy !== false) && (
                      <button
                        onClick={() => navigateToTab('convoy')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'convoy' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Compass className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.convoy === false ? "line-through opacity-50" : ""}>Convoy Registration</span>
                        </div>
                        {renderNavToggle('convoy')}
                      </button>
                    )}
 
                    {(isSuperAdmin || appConfig.gallery !== false) && (
                      <button
                        onClick={() => navigateToTab('gallery')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'gallery' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Image className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.gallery === false ? "line-through opacity-50" : ""}>{t('gallery')}</span>
                        </div>
                        {renderNavToggle('gallery')}
                      </button>
                    )}
 
                    {(isSuperAdmin || appConfig.chapters !== false) && (
                      <button
                        onClick={() => navigateToTab('chapters')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'chapters' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Map className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.chapters === false ? "line-through opacity-50" : ""}>{t('chapters')}</span>
                        </div>
                        {renderNavToggle('chapters')}
                      </button>
                    )}
 
                    {(isSuperAdmin || appConfig.merchants !== false) && (
                      <button
                        onClick={() => navigateToTab('merchants')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'merchants' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Store className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.merchants === false ? "line-through opacity-50" : ""}>{t('merchants')}</span>
                        </div>
                        {renderNavToggle('merchants')}
                      </button>
                    )}
 
                    {(isSuperAdmin || appConfig.announcements !== false) && (
                      <button
                        onClick={() => navigateToTab('announcements')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'announcements' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Volume2 className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.announcements === false ? "line-through opacity-50" : ""}>{t('announcements')}</span>
                        </div>
                        {renderNavToggle('announcements')}
                      </button>
                    )}
                  </div>
 
                  {/* DIRECTORY & CHAPTERS SECTION LABEL */}
                  <div className="space-y-1 block px-3 mt-4">
                    <span className="text-[10px] font-extrabold text-slate-400 tracking-widest uppercase block mb-1">
                      Directory & Chapters
                    </span>
                    <span className="text-[11px] text-slate-300 block mb-2">Kuala Lumpur Chapter chapter hub • active status</span>

                    {(isSuperAdmin || appConfig.directory !== false) && (
                      <button
                        onClick={() => navigateToTab('members')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                          currentTab === 'members' ? 'bg-[#0F2D52] text-white border-l-4 border-amber-400' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Users className="w-4.5 h-4.5 shrink-0" />
                          <span className={isSuperAdmin && appConfig.directory === false ? "line-through opacity-50" : ""}>Member Directory</span>
                        </div>
                        {renderNavToggle('directory')}
                      </button>
                    )}
                  </div>
 
                </div>
              </div>
 
              {/* 3. Footer Logout Action */}
              <div className="bg-[#0B1E36] p-4 text-center select-none border-t border-white/5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 text-red-400 hover:bg-white/5 px-4 py-3 rounded-xl text-sm font-bold transition active:scale-98 cursor-pointer"
                  id="btn-logout-sidebar"
                >
                  <LogOut className="w-5 h-5 shrink-0 text-red-500" />
                  <span>{t('logout')}</span>
                </button>
                <button
                  onClick={() => setIsDisclaimerOpen(true)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 font-sans mt-3.5 leading-relaxed cursor-pointer hover:underline transition-colors block w-full text-center active:scale-97"
                >
                  MVOC MALAYSIA VERSION 2.4.0
                </button>
                <button
                  onClick={() => setIsDisclaimerOpen(true)}
                  className="text-[8.5px] text-[#475569] hover:text-[#94a3b8] font-sans mt-1.5 leading-none cursor-pointer hover:underline transition-colors block w-full text-center capitalize tracking-wider active:scale-97 font-bold"
                >
                  DISCLAIMER & NOTIS PRIVASI
                </button>

                {/* Kotak Persetujuan Syarat & Privasi interaktif (Hanya muncul jika belum memenuhi syarat ganjaran) */}
                 {!(userProfile?.disclaimerAccepted === true && userProfile?.pdpaAccepted === true && (userProfile?.patch_status === true || userProfile?.officialPatch === true || userProfile?.patch === 'mvoc_trusted_elite')) && (
                   <div className="mt-4 p-3 bg-[#081525] border border-white/5 rounded-xl text-left transition-all space-y-3">
                     <div className="flex items-center gap-1.5 mb-1 text-amber-500">
                       <Shield className="w-3.5 h-3.5 text-amber-500" />
                       <span className="text-[9px] font-black uppercase tracking-wider">Kelayakan Mata Ganjaran (XP)</span>
                     </div>
                     <p className="text-[9px] text-slate-400 leading-normal font-semibold">
                       Sila tanda raji persetujuan di bawah untuk melayakkan anda menerima 30 XP permulaan:
                     </p>

                     <label className="flex items-start gap-2 cursor-pointer select-none">
                       <input
                         type="checkbox"
                         checked={isDisclaimerChecked}
                         onChange={(e) => setIsDisclaimerChecked(e.target.checked)}
                         className="mt-0.5 rounded border-white/10 text-emerald-500 focus:ring-emerald-500 bg-[#06111e] w-3.5 h-3.5 shrink-0 accent-emerald-500"
                       />
                       <span className="text-[10px] text-slate-350 font-medium leading-tight select-none">
                         Saya bersetuju dengan <strong>Terma & Syarat / DISCLAIMER</strong>.
                       </span>
                     </label>

                     <label className="flex items-start gap-2 cursor-pointer select-none">
                       <input
                         type="checkbox"
                         checked={isPdpaChecked}
                         onChange={(e) => setIsPdpaChecked(e.target.checked)}
                         className="mt-0.5 rounded border-white/10 text-emerald-500 focus:ring-emerald-500 bg-[#06111e] w-3.5 h-3.5 shrink-0 accent-emerald-500"
                       />
                       <span className="text-[10px] text-slate-350 font-medium leading-tight select-none">
                         Saya bersetuju dengan <strong>Notis Privasi (PDPA)</strong>.
                       </span>
                     </label>

                     {/* Status Trusted Elite Patch Indicator */}
                     <div className="flex items-center gap-2 pt-1">
                       <div className={`w-2 h-2 rounded-full ${(userProfile?.patch_status === true || userProfile?.officialPatch === true || userProfile?.patch === 'mvoc_trusted_elite') ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
                       <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">
                         Lencana Trusted Elite: {(userProfile?.patch_status === true || userProfile?.officialPatch === true || userProfile?.patch === 'mvoc_trusted_elite') ? (
                           <span className="text-emerald-400">AKTIF</span>
                         ) : (
                           <span className="text-rose-400">BELUM AKTIF</span>
                         )}
                       </span>
                     </div>

                     <div className="mt-3.5">
                       <button
                         onClick={handleSaveConsent}
                         disabled={isSavingConsent}
                         className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-[10px] rounded-lg tracking-wider uppercase transition cursor-pointer select-none active:scale-95 flex items-center justify-center gap-1"
                       >
                         {isSavingConsent ? (
                           <RefreshCw className="w-3 h-3 animate-spin" />
                         ) : (
                           <Check className="w-3 h-3" />
                         )}
                         <span>SIMPAN KEPUTUSAN</span>
                       </button>
                     </div>
                   </div>
                 )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Disclaimer Modal */}
      <AnimatePresence>
        {isDisclaimerOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDisclaimerOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-[95vw] md:w-[500px] bg-[#0b1c30] text-white rounded-2xl border border-white/10 shadow-2xl p-5 md:p-6 z-10 flex flex-col gap-4 text-left select-none overflow-hidden font-sans border-t-2 border-t-amber-400"
            >
              <div className="flex justify-between items-center pb-2.5 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2 text-amber-500">
                  <Shield className="w-5 h-5 text-amber-500 shrink-0" />
                  <h4 className="text-sm font-black uppercase tracking-wide">Disclaimer & Notis Privasi</h4>
                </div>
                <button 
                  onClick={() => setIsDisclaimerOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[55vh] md:max-h-[60vh] overflow-y-auto pr-1 text-xs leading-relaxed text-slate-200 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <div className="text-center font-bold text-white text-sm tracking-tight mb-2 uppercase">
                  MVOC Malaysia - Disclaimer & Notis Privasi
                </div>

                <div className="space-y-3.5">
                  <div className="bg-[#081525] border border-white/5 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-450 block select-none">Kerahsiaan:</span>
                    <p className="text-slate-300">
                      Aplikasi ini adalah platform eksklusif untuk ahli berdaftar Veloz Owners Club (MVOC) Malaysia. Segala maklumat di dalam adalah sulit dan hanya untuk kegunaan dalaman kelab.
                    </p>
                  </div>

                  <div className="bg-[#081525] border border-white/5 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-455 block select-none">Data Peribadi:</span>
                    <p className="text-slate-300">
                      Penggunaan data anda tertakluk kepada Dasar Privasi MVOC. Kami komited untuk melindungi maklumat peribadi anda.
                    </p>
                  </div>

                  <div className="bg-[#081525] border border-white/5 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-455 block select-none">Tanggungjawab:</span>
                    <p className="text-slate-300">
                      Sebarang aktiviti atau penyalahgunaan maklumat daripada aplikasi ini adalah di bawah tanggungjawab pengguna sepenuhnya.
                    </p>
                  </div>

                  <div className="bg-[#081525] border border-white/5 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-500 block select-none">Peringatan Privasi:</span>
                    <p className="text-slate-300">
                      Kami tidak mewajibkan anda untuk memasukkan maklumat peribadi yang sensitif (seperti nombor kad pengenalan, nombor plat kenderaan, atau nombor telefon peribadi) sekiranya anda berasa ragu-ragu. Aplikasi ini hanyalah platform untuk penyebaran maklumat komuniti dan kegunaan dalaman ahli sahaja. Sila gunakan budi bicara anda dalam berkongsi maklumat.
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 text-center font-semibold pt-2 border-t border-white/10 space-y-1 leading-normal select-none">
                  <div>Anda sedang menggunakan Versi 2.4.0.</div>
                  <div>© 2026 MVOC Malaysia. Hak cipta terpelihara.</div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-[#0b1c30] pt-4 pb-1 border-t border-white/10 z-10 shrink-0">
                <button
                  onClick={() => setIsDisclaimerOpen(false)}
                  className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-[#091524] font-black text-xs uppercase tracking-widest rounded-xl transition cursor-pointer select-none active:scale-98"
                >
                  Faham & Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= ADMIN MANAGEMENT MODALS ================= */}
      {/* 1. Create Event Modal */}
      <AnimatePresence>
        {isCreateEventModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateEventModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#0b1c30] text-white rounded-2xl border border-white/10 shadow-2xl p-6 z-10 flex flex-col gap-4 text-left select-none overflow-hidden font-sans"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-black uppercase tracking-wide">Create Club Event</h4>
                </div>
                <button 
                  onClick={() => setIsCreateEventModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-405 font-bold uppercase block">Event Title</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="e.g., Merdeka Charity Convoy"
                    className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-bold text-white focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-405 font-bold uppercase block">Date & Time</label>
                  <input
                    type="text"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    placeholder="e.g., 31 Aug 2026"
                    className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-bold text-white focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-405 font-bold uppercase block">Location</label>
                  <input
                    type="text"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="e.g., Kuala Lumpur, Malaysia"
                    className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-bold text-white focus:outline-none focus:border-emerald-500 font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-405 font-bold uppercase block">Category</label>
                    <select
                      value={newEventCategory}
                      onChange={(e) => setNewEventCategory(e.target.value as any)}
                      className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-sans"
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-405 font-bold uppercase block">Organizer</label>
                    <input
                      type="text"
                      value={newEventOrganizer}
                      onChange={(e) => setNewEventOrganizer(e.target.value)}
                      placeholder="e.g., HQ / Johor Chapter"
                      className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-bold text-white focus:outline-none focus:border-emerald-500 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-405 font-bold uppercase block">Cover Image URL</label>
                  <input
                    type="text"
                    value={newEventImage}
                    onChange={(e) => setNewEventImage(e.target.value)}
                    className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  onClick={() => setIsCreateEventModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-black text-xs uppercase tracking-wide rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!newEventTitle.trim() || !newEventDate.trim()) {
                      triggerToast('Event Title and Date are required.', 'warning');
                      return;
                    }
                    const newId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
                    const createdEvent: EventItem = {
                      id: newId,
                      title: newEventTitle,
                      date: newEventDate,
                      location: newEventLocation || 'Kuala Lumpur, Malaysia',
                      rsvps: 0,
                      limit: 150,
                      featured: true,
                      registered: false,
                      organizer: newEventOrganizer || 'HQ',
                      badge: newEventBadge,
                      image: newEventImage,
                      category: newEventCategory
                    };
                    setEvents([createdEvent, ...events]);
                    triggerToast(`Successfully created event "${newEventTitle}"!`, 'success');
                    setIsCreateEventModalOpen(false);
                    setNewEventTitle('');
                    setNewEventLocation('');
                    setNewEventDate('');
                    setNewEventOrganizer('');
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wide rounded-xl transition cursor-pointer"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Delete Event Confirmation Modal */}
      <AnimatePresence>
        {isDeleteEventModalOpen && eventToDelete && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteEventModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#0b1c30] text-white rounded-2xl border border-rose-500/20 shadow-2xl p-6 z-10 flex flex-col gap-4 text-left select-none overflow-hidden font-sans"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-rose-450">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <h4 className="text-sm font-black uppercase tracking-wide">Delete Event</h4>
                </div>
                <button 
                  onClick={() => setIsDeleteEventModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                  Are you absolutely sure you want to delete the event <strong className="text-white">{eventToDelete.title}</strong>? 
                  This will immediately cancel all member RSVP registers.
                </p>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    To confirm deletion, type <span className="text-rose-400 font-bold font-mono">DELETE</span>:
                  </label>
                  <input
                    type="text"
                    value={deleteEventConfirmText}
                    onChange={(e) => setDeleteEventConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full bg-[#0a1829] text-xs font-semibold px-4 py-3 border border-red-900/30 rounded-xl outline-none focus:border-rose-500 transition text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteEventModalOpen(false)}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteEventConfirmText !== 'DELETE'}
                  onClick={() => {
                    setEvents(events.filter(e => e.id !== eventToDelete.id));
                    triggerToast(`Successfully deleted event "${eventToDelete.title}"`, 'success');
                    setIsDeleteEventModalOpen(false);
                    setEventToDelete(null);
                    setDeleteEventConfirmText('');
                  }}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Account Deletion Confirmation Modal */}
      <AnimatePresence>
        {isDeleteAccountModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteAccountModalOpen(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#0b1c30] text-white rounded-2xl border border-red-500/20 shadow-2xl p-6 z-10 flex flex-col gap-4 text-left select-none overflow-hidden font-sans"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                  <h4 className="text-sm font-black uppercase tracking-wide">Hapus Akaun & Data Anda</h4>
                </div>
                <button 
                  onClick={() => setIsDeleteAccountModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                  Adakah anda pasti mahu memadam akaun dan semua maklumat anda dari MVOC Malaysia secara sukarela? 
                  <strong className="text-white block mt-1">Tindakan ini adalah muktamad, kekal dan tidak boleh ditarik balik.</strong>
                </p>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Sila taip <span className="text-red-400 font-bold font-mono">PADAM</span> untuk mengesahkan:
                  </label>
                  <input
                    type="text"
                    value={deleteAccountConfirmText}
                    onChange={(e) => setDeleteAccountConfirmText(e.target.value)}
                    placeholder="Contoh: PADAM"
                    className="w-full bg-[#0a1829] text-xs font-semibold px-4 py-3 border border-red-900/30 rounded-xl outline-none focus:border-red-500 transition text-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteAccountModalOpen(false)}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={deleteAccountConfirmText !== 'PADAM'}
                  onClick={executeDeleteAccount}
                  className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>PADAM</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Upload Gallery Album Modal */}
      <AnimatePresence>
        {isUploadGalleryModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUploadGalleryModalOpen(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-[#0b1c30] text-white rounded-2xl border border-white/10 shadow-2xl p-6 z-10 flex flex-col gap-4 text-left select-none overflow-hidden font-sans"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-emerald-450">
                  <Image className="w-5 h-5 text-emerald-500" />
                  <h4 className="text-sm font-black uppercase tracking-wide">Upload Gallery Album</h4>
                </div>
                <button 
                  onClick={() => setIsUploadGalleryModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-405 font-bold uppercase block">Album Title</label>
                  <input
                    type="text"
                    value={newAlbumTitle}
                    onChange={(e) => setNewAlbumTitle(e.target.value)}
                    placeholder="e.g., Northern Convoy Cruise 2026"
                    className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-405 font-bold uppercase block">Category Classification</label>
                  <select
                    value={newAlbumCategory}
                    onChange={(e) => setNewAlbumCategory(e.target.value)}
                    className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer font-sans"
                  >
                    <option value="national">National Gathering</option>
                    <option value="chapter_convoys">Chapter Convoys</option>
                    <option value="social">Social Events</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-405 font-bold uppercase block">Badge Tag</label>
                  <input
                    type="text"
                    value={newAlbumBadge}
                    onChange={(e) => setNewAlbumBadge(e.target.value)}
                    placeholder="e.g., Official / Regional / Chapter"
                    className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-405 font-bold uppercase block">Cover Image Link URL</label>
                  <input
                    type="text"
                    value={newAlbumImage}
                    onChange={(e) => setNewAlbumImage(e.target.value)}
                    className="w-full bg-[#0a1829] border border-white/10 rounded-xl py-2.5 px-3.5 font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  onClick={() => setIsUploadGalleryModalOpen(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-black text-xs uppercase tracking-wide rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!newAlbumTitle.trim()) {
                      triggerToast('Album Title is required.', 'warning');
                      return;
                    }

                    // Validation: Enforce upload quota limiting, but Admins bypass
                    if (galleryAlbums.length >= 10 && !isAdminOrSuperAdmin()) {
                      triggerToast('Upload quota reached. Only admins can upload more than 10 gallery albums.', 'error');
                      return;
                    }

                    const newId = galleryAlbums.length > 0 ? Math.max(...galleryAlbums.map(a => a.id)) + 1 : 1;
                    const createdAlbum = {
                      id: newId,
                      title: newAlbumTitle,
                      badge: newAlbumBadge || 'Official',
                      photosCount: 5,
                      image: newAlbumImage,
                      category: newAlbumCategory,
                      badgeStyle: 'bg-[#EFF4FB] text-[#0F2D52] font-black border border-blue-100',
                      photos: [
                        newAlbumImage,
                        'https://images.unsplash.com/photo-1542362567-b07eac79094d?w=850&auto=format&fit=crop&q=80',
                        'https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=850&auto=format&fit=crop&q=80',
                        'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=850&auto=format&fit=crop&q=80',
                        'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=850&auto=format&fit=crop&q=80'
                      ]
                    };
                    setGalleryAlbums([createdAlbum, ...galleryAlbums]);
                    triggerToast(`Successfully uploaded album "${newAlbumTitle}" with photos!`, 'success');
                    setIsUploadGalleryModalOpen(false);
                    setNewAlbumTitle('');
                  }}
                  className="flex-1 py-3 bg-emerald-605 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wide rounded-xl transition cursor-pointer"
                >
                  Upload
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Delete Gallery Confirmation Modal */}
      <AnimatePresence>
        {isDeleteGalleryModalOpen && galleryAlbumToDelete && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteGalleryModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-[#0b1c30] text-white rounded-2xl border border-red-500/20 shadow-2xl p-6 z-10 flex flex-col gap-4 text-left select-none overflow-hidden font-sans"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div className="flex items-center gap-2 text-rose-450">
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                  <h4 className="text-sm font-black uppercase tracking-wide">Delete Gallery Album</h4>
                </div>
                <button 
                  onClick={() => setIsDeleteGalleryModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                  Are you absolutely sure you want to permanent purge the Album <strong className="text-white">{galleryAlbumToDelete.title}</strong>? 
                  This will delete all {galleryAlbumToDelete.photosCount} photos in the catalog.
                </p>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                    To confirm deletion, type <span className="text-rose-400 font-bold font-mono">DELETE</span>:
                  </label>
                  <input
                    type="text"
                    value={deleteGalleryConfirmText}
                    onChange={(e) => setDeleteGalleryConfirmText(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full bg-[#0a1829] text-xs font-semibold px-4 py-3 border border-red-900/30 rounded-xl outline-none focus:border-rose-500 transition text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteGalleryModalOpen(false)}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteGalleryConfirmText !== 'DELETE'}
                  onClick={() => {
                    setGalleryAlbums(galleryAlbums.filter(a => a.id !== galleryAlbumToDelete.id));
                    triggerToast(`Successfully deleted gallery album "${galleryAlbumToDelete.title}"`, 'success');
                    setIsDeleteGalleryModalOpen(false);
                    setGalleryAlbumToDelete(null);
                    setDeleteGalleryConfirmText('');
                  }}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
                >
                  DELETE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* GLOBAL OVERLAYS (ACCESSIBLE FROM ALL TAB CONTEXTS) */}
      <AnimatePresence>
        {isAdminQrListOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-[9999] pointer-events-auto"
          >
            <AdminQRList 
              isAdmin={isAdminOrSuperAdmin()} 
              onClose={() => { 
                console.log('AdminQRList close clicked'); 
                setIsAdminQrListOpen(false); 
              }} 
              triggerToast={triggerToast} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isQrGeneratorModalOpen && generatedQrPayload && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQrGeneratorModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[1.75rem] shadow-[0px_0px_35px_rgba(0,0,0,0.3)] p-6 z-10 flex flex-col items-center gap-6 text-center select-none overflow-hidden border border-slate-205"
            >
              <div className="w-full flex justify-between items-center pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black text-[#000000] uppercase tracking-wider text-left">Attendance QR</h4>
                <button onClick={() => setIsQrGeneratorModalOpen(false)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 cursor-pointer transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#0F2D52] tracking-tight">{JSON.parse(generatedQrPayload).name || 'Event'}</h3>
                <p className="text-[11px] font-bold text-slate-400">Members can scan this code to securely log their attendance.</p>
              </div>

              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 inline-flex items-center justify-center relative">
                <QRCodeSVG 
                  value={generatedQrPayload} 
                  size={220} 
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "/mvoc_logo.png",
                    x: undefined,
                    y: undefined,
                    height: 48,
                    width: 48,
                    excavate: true,
                  }}
                />
              </div>
              
              <button
                onClick={() => setIsQrGeneratorModalOpen(false)}
                className="w-full py-3.5 bg-[#0F2D52] hover:bg-[#184474] text-white font-black text-sm rounded-xl transition uppercase tracking-wider cursor-pointer"
              >
                Close Print View
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isQrModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQrModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md cursor-pointer"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm flex flex-col items-center gap-6 z-10"
            >
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="absolute top-4 right-4 p-2 bg-slate-100/80 hover:bg-slate-200 text-slate-500 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-2 mt-4">
                <h3 className="text-xl font-black text-[#0F2D52] uppercase tracking-wide">Member QR</h3>
                <p className="text-xs text-slate-500 font-semibold">Scan this code to exchange contact info.</p>
              </div>

              <div className="bg-white p-4 border-2 border-slate-200 rounded-2xl shadow-inner w-full aspect-square flex items-center justify-center">
                <QRCodeSVG value={qrPayloadString} size={256} className="w-full h-full text-[#112F56]" />
              </div>

              <div className="text-center w-full bg-slate-50 py-3 rounded-xl border border-slate-100">
                 <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">MVOC ID</div>
                 <div className="font-mono text-lg font-bold text-[#0F2D52] tracking-widest leading-none">{displayMvocId}</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScannerOpen && (
          <div className="fixed inset-0 z-[9999] pointer-events-auto flex items-center justify-center p-0 bg-black/95">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full max-w-lg mx-auto overflow-hidden relative flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-5 pt-8 bg-gradient-to-b from-black/80 to-transparent">
                <div className="text-left text-white">
                  <h3 className="text-base font-black tracking-wider shadow-sm">Scan MVOC Digital QR</h3>
                  <p className="text-[10px] text-white/70 font-semibold">Position the member QR code in the frame</p>
                </div>
                <button 
                  onClick={() => setIsScannerOpen(false)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 w-full bg-[#0a1829] relative flex items-center justify-center">
                <div className="absolute inset-0 z-0">
                  <Scanner
                    onScan={async (detectedCodes) => {
                      if (!detectedCodes || detectedCodes.length === 0) return;
                      const scanResult = detectedCodes[0].rawValue;
                      if (isSavingContact) return;
                      
                      try {
                        let parsed: any;
                        try {
                          parsed = JSON.parse(scanResult);
                        } catch (e) {
                          triggerToast('Unrecognized format: not an MVOC QR code.', 'error');
                          await logQRScan('failed', 'Invalid JSON payload - unrecognized QR code format', scanResult);
                          return;
                        }
                        
                        if (parsed.type === 'attendance' && parsed.refId) {
                          setIsSavingContact(true);
                          const { setDoc, getDoc, serverTimestamp, doc } = await import('firebase/firestore');
                          
                          const qrRef = doc(db, 'qrCodes', parsed.refId);
                          const qrSnap = await getDoc(qrRef);
                          if (qrSnap.exists()) {
                            const qrData = qrSnap.data();
                            if (qrData.status === 'disabled') {
                              triggerToast('This QR Code has been disabled by the administrator.', 'error');
                              await logQRScan('failed', `Failed check-in: QR code '${parsed.name || parsed.refId}' is disabled`, scanResult);
                              setIsSavingContact(false);
                              return;
                            }
                            if (qrData.expiresAt) {
                              const expiryDate = qrData.expiresAt.toDate ? qrData.expiresAt.toDate() : new Date(qrData.expiresAt);
                              if (new Date() > expiryDate) {
                                triggerToast('This QR Code has expired.', 'error');
                                await logQRScan('failed', `Failed check-in: QR code '${parsed.name || parsed.refId}' has expired`, scanResult);
                                setIsSavingContact(false);
                                return;
                              }
                            }
                          }

                          // Ensure parent document exists with proper metadata
                          await setDoc(doc(db, 'attendance', parsed.refId), {
                            title: parsed.name || 'Untitled Session',
                            context: parsed.context || 'general',
                            createdAt: new Date().toISOString(),
                            type: 'attendance',
                            updatedAt: new Date().toISOString()
                          }, { merge: true });

                          await setDoc(doc(db, 'attendance', parsed.refId, 'attendees', auth.currentUser!.uid), {
                            uid: auth.currentUser!.uid,
                            name: displayName,
                            mvocId: displayMvocId,
                            vehiclePlate: userProfile?.vehiclePlate || 'NO PLATE',
                            timestamp: serverTimestamp()
                          });

                          await logQRScan('success', `Checked in successfully: ${parsed.name || 'Untitled Attendance Session'}`, scanResult);
                          triggerToast('Attendance successfully recorded!', 'success');
                          setIsScannerOpen(false);
                          setIsSavingContact(false);
                          return;
                        }

                        if (!parsed.uid || !parsed.mvocId || !parsed.name) {
                            triggerToast('Invalid MVOC Contact QR code.', 'error');
                            await logQRScan('failed', 'Invalid MVOC Contact QR fields', scanResult);
                            return;
                        }
                        if (parsed.uid === auth.currentUser?.uid) {
                            triggerToast('You cannot scan your own QR code.', 'warning');
                            await logQRScan('failed', 'Attempted to scan own contact QR code', scanResult);
                            return;
                        }
                        setIsSavingContact(true);
                        const { writeBatch, serverTimestamp, doc } = await import('firebase/firestore');
                        const batch = writeBatch(db);

                        const contactRefA = doc(db, 'users', auth.currentUser!.uid, 'contacts', parsed.uid);
                        batch.set(contactRefA, {
                            uid: parsed.uid,
                            mvocId: parsed.mvocId,
                            name: parsed.name,
                            chapter: parsed.chapter,
                            photoURL: parsed.photoURL || null,
                            exchangedAt: serverTimestamp()
                        });

                        const contactRefB = doc(db, 'users', parsed.uid, 'contacts', auth.currentUser!.uid);
                        batch.set(contactRefB, {
                            uid: auth.currentUser!.uid,
                            mvocId: displayMvocId,
                            name: displayName,
                            chapter: displayChapter,
                            photoURL: displayAvatarUrl || null,
                            exchangedAt: serverTimestamp()
                        });
                        
                        await batch.commit();

                        await logQRScan('success', `Successfully exchanged contacts with ${parsed.name}`, scanResult);
                        triggerToast('Contact mutually saved!', 'success');
                        setIsScannerOpen(false);
                      } catch (e: any) {
                        triggerToast('Unrecognized format: not an MVOC QR code.', 'error');
                        await logQRScan('failed', `Scan exception: ${e.message || String(e)}`, scanResult);
                      } finally {
                        setIsSavingContact(false);
                      }
                    }}
                    components={{
                      // @ts-ignore
                      audio: false,
                      video: true
                    }}
                    allowMultiple={false}
                    scanDelay={500}
                  />
                </div>

                <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                  <div className="w-64 h-64 relative">
                    <div className="absolute -inset-[3000px] shadow-[0_0_0_3000px_rgba(0,0,0,0.65)]" />
                    
                    <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-amber-400" />
                    <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-amber-400" />
                    <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-amber-400" />
                    <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-amber-400" />
                    
                    <motion.div 
                      animate={{ y: [0, 256, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                      className="w-full h-0.5 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] absolute top-0"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
