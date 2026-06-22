import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { 
  Search, 
  User,
  Mail,
  ArrowRight,
  Waves, 
  Building2, 
  Mountain, 
  Check, 
  X,
  MessageSquare,
  Building,
  Shield,
  Landmark,
  Compass,
  Home,
  Car,
  Anchor,
  MapPin,
  ChevronUp,
  Map,
  Clock,
  Trash2,
  AlertTriangle,
  Edit,
  QrCode
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { QRCodeSVG } from 'qrcode.react';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  runTransaction,
  query,
  where,
  getDocs,
  increment
} from 'firebase/firestore';

interface ChapterItem {
  id: number;
  name: string;
  region: 'Central' | 'Northern' | 'Southern' | 'East Coast' | 'East MY';
  subText: string;
  membersCount: number;
  iconType: string;
  leadName: string;
  leadTitle: string;
  leadImage?: string;
  leadInitial?: string;
  description: string;
  establishedDate: string;
  registeredCars: string[];
  adminId?: string;
  meetupRoutine?: string;
  activeMemberPlate?: string;
}

interface StateChaptersProps {
  chaptersList: ChapterItem[];
  setChaptersList: Dispatch<SetStateAction<any[]>>;
  joinedChapters: number[];
  setJoinedChapters: Dispatch<SetStateAction<number[]>>;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setSelectedChapterDetailId: (id: number | null) => void;
  setSelectedLeadForChat: (lead: any) => void;
  setChapterLeadChatMessage: (msg: string) => void;
  setChapterLeadChatMessage: (msg: string) => void;
  userProfile: any;
  isSuperAdmin: boolean;
  membersList?: any[];
}

const AvatarStack: React.FC<{ admins: string[]; totalMembers: number }> = ({ admins, totalMembers }) => {
  const visibleAdmins = admins.slice(0, 2);
  const remainingCount = totalMembers - visibleAdmins.length;
  
  const bgColors = [
    'bg-emerald-200 text-emerald-800', 
    'bg-blue-200 text-blue-800'
  ];

  return (
    <div className="flex items-center -space-x-4 shrink-0">
      {visibleAdmins.map((admin, index) => (
        <div 
          key={index} 
          className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black border-2 border-slate-50 relative z-${20 - index * 10} ${bgColors[index % bgColors.length]} uppercase select-none`}
          title={admin}
        >
          {admin.charAt(0)}
        </div>
      ))}
      
      {remainingCount > 0 && (
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-slate-50 bg-slate-200 text-slate-700 relative z-0 select-none"
          title={`${remainingCount} ahli lain`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

export default function StateChapters({
  chaptersList,
  setChaptersList,
  joinedChapters,
  setJoinedChapters,
  triggerToast,
  setSelectedChapterDetailId,
  setSelectedLeadForChat,
  setChapterLeadChatMessage,
  userProfile,
  isSuperAdmin,
  membersList = []
}: StateChaptersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'browse' | 'manage'>('browse');
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});

  // Managed Chapter Admin details
  const [selectedChapterIdToManage, setSelectedChapterIdToManage] = useState<string>('');
  
  // States for inline editing of chapters
  const [editingChapterId, setEditingChapterId] = useState<number | null>(null);
  const [editedFields, setEditedFields] = useState({
    name: '',
    subText: '',
    meetupRoutine: '',
    activeMemberPlate: ''
  });
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Real-time live member counts from 'users' collection
  const [usersList, setUsersList] = useState<any[]>([]);

  // Synchronize users in real-time to compute precise actual member counts per chapter
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      setUsersList(uList);
    }, (error) => {
      console.error("Error reading live users for chapter count: ", error);
    });
    return () => unsub();
  }, []);

  // Listen to open-edit-chapter event from App.tsx
  useEffect(() => {
    const handleOpenEdit = (e: any) => {
      if (e.detail?.chapterId) {
        const item = chaptersList.find(c => c.id === e.detail.chapterId);
        if (item) {
          setEditingChapterId(item.id);
          setEditedFields({
            name: item.name || '',
            subText: item.subText || '',
            meetupRoutine: item.meetupRoutine || '',
            activeMemberPlate: item.activeMemberPlate || ''
          });
        }
      }
    };
    window.addEventListener('open-edit-chapter', handleOpenEdit);
    return () => window.removeEventListener('open-edit-chapter', handleOpenEdit);
  }, [chaptersList]);

  const getActualMemberCount = (chapterItem: ChapterItem): number => {
    if (!usersList || usersList.length === 0) {
      return chapterItem.membersCount || 0;
    }

    const nameLower = (chapterItem.name || '').trim().toLowerCase();
    
    return usersList.filter((u: any) => {
      const userChapter = (u.chapter || '').trim().toLowerCase();
      const isPrimary = userChapter === nameLower ||
                        (nameLower.includes(userChapter) && userChapter.length > 4) ||
                        (userChapter.includes(nameLower) && nameLower.length > 4);

      const hasJoined = Array.isArray(u.joinedChapters) && u.joinedChapters.includes(chapterItem.id);

      return isPrimary || hasJoined;
    }).length;
  };

  const startEditingChapter = (item: ChapterItem) => {
    setEditingChapterId(item.id);
    setEditedFields({
      name: item.name || '',
      subText: item.subText || '',
      meetupRoutine: item.meetupRoutine || '',
      activeMemberPlate: item.activeMemberPlate || ''
    });
  };

  const handleSaveInlineEdit = async (chapterItem: ChapterItem) => {
    if (!editedFields.name.trim()) {
      triggerToast('Chapter Name is required.', 'warning');
      return;
    }
    
    setIsSavingInline(true);
    try {
      const docRef = doc(db, 'chapters', String(chapterItem.id));
      
      const updates = {
        name: editedFields.name.trim(),
        subText: editedFields.subText.trim(),
        meetupRoutine: editedFields.meetupRoutine.trim(),
        activeMemberPlate: editedFields.activeMemberPlate.trim()
      };

      await updateDoc(docRef, updates);

      setChaptersList((prev: any[]) => prev.map(c => 
        c.id === chapterItem.id 
          ? { ...c, ...updates } 
          : c
      ));

      triggerToast('Chapter updated successfully!', 'success');
      setEditingChapterId(null);
    } catch (err: any) {
      console.error(err);
      triggerToast(`Failed to update chapter: ${err.message || String(err)}`, 'error');
    } finally {
      setIsSavingInline(false);
    }
  };

  // Real-time live zone hubs info
  const [zoneHubs, setZoneHubs] = useState<Record<string, any>>({});
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [editedZoneFields, setEditedZoneFields] = useState({
    ttInfo: '',
    announcement: ''
  });
  const [isSavingZone, setIsSavingZone] = useState(false);

  // Synchronize zone hubs in real-time
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'zoneHubs'), (snapshot) => {
      const hubsObj: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        hubsObj[doc.id] = doc.data();
      });
      setZoneHubs(hubsObj);
    }, (error) => {
      console.error("Error reading zoneHubs: ", error);
    });
    return () => unsub();
  }, []);

  const startEditingZone = (zoneName: string) => {
    const hub = zoneHubs[zoneName] || {};
    setEditingZoneId(zoneName);
    setEditedZoneFields({
      ttInfo: hub.ttInfo || '',
      announcement: hub.announcement || ''
    });
  };

  const handleSaveZoneEdit = async (zoneName: string) => {
    setIsSavingZone(true);
    try {
      const docRef = doc(db, 'zoneHubs', zoneName);
      const updates = {
        ttInfo: editedZoneFields.ttInfo.trim(),
        announcement: editedZoneFields.announcement.trim(),
        lastUpdatedBy: auth.currentUser?.email || 'Admin',
        lastUpdatedAt: new Date().toISOString()
      };
      await setDoc(docRef, updates, { merge: true });
      triggerToast(`${zoneName} Hub updated successfully!`, 'success');
      setEditingZoneId(null);
    } catch (err: any) {
      console.error(err);
      triggerToast(`Failed to update ${zoneName} Hub: ${err.message || String(err)}`, 'error');
    } finally {
      setIsSavingZone(false);
    }
  };

  // Secure Admin QR Code modal states & handlers
  const [secureQrModalOpen, setSecureQrModalOpen] = useState(false);
  const [secureQrInfo, setSecureQrInfo] = useState<{
    id: string | number;
    title: string;
    subTitle: string;
    payload: string;
    type: 'chapter' | 'hub';
  } | null>(null);

  const checkAdminPermission = (chapterItem?: ChapterItem, zoneName?: string): boolean => {
    if (!auth.currentUser) return false;
    if (isSuperAdmin || userProfile?.role === 'admin') return true;
    
    if (chapterItem && chapterItem.adminId === auth.currentUser.uid) {
      return true;
    }
    
    if (zoneName && isChapterAdminInZone(zoneName)) {
      return true;
    }
    
    return false;
  };

  const handleOpenChapterQr = (item: ChapterItem) => {
    if (!checkAdminPermission(item)) {
      triggerToast("Access denied: You are not authorized to view this QR Code.", "error");
      return;
    }
    
    setSecureQrInfo({
      id: item.id,
      title: item.name,
      subTitle: item.subText || `Chapter ${item.id}`,
      payload: JSON.stringify({
        source: 'mvoc-app',
        type: 'chapter',
        id: item.id,
        name: item.name,
        leader: item.leadName,
        routine: item.meetupRoutine || ''
      }),
      type: 'chapter'
    });
    setSecureQrModalOpen(true);
  };

  const handleOpenZoneHubQr = (zoneName: string, zoneHubData: any) => {
    if (!checkAdminPermission(undefined, zoneName)) {
      triggerToast("Access denied: You are not authorized to view this QR Code.", "error");
      return;
    }
    
    setSecureQrInfo({
      id: zoneName,
      title: `${zoneName} HUB`,
      subTitle: "Regional Coordination Center",
      payload: JSON.stringify({
        source: 'mvoc-app',
        type: 'zone-hub',
        zone: zoneName,
        ttInfo: zoneHubData.ttInfo || '',
        announcement: zoneHubData.announcement || ''
      }),
      type: 'hub'
    });
    setSecureQrModalOpen(true);
  };

  const handleDownloadSecureQr = () => {
    if (!secureQrInfo) return;
    
    // Authorization check
    const itemObj = secureQrInfo.type === 'chapter' ? chaptersList.find(c => c.id === secureQrInfo.id) : undefined;
    const isAuthorized = secureQrInfo.type === 'chapter' 
      ? (itemObj ? checkAdminPermission(itemObj) : (isSuperAdmin || userProfile?.role === 'admin'))
      : checkAdminPermission(undefined, String(secureQrInfo.id));

    if (!isAuthorized) {
      triggerToast("Access denied: Unauthorized action.", "error");
      return;
    }

    const svgElement = document.getElementById("secure-qr-code-svg-element");
    if (!svgElement) {
      triggerToast("QR Code element not found.", "error");
      return;
    }

    try {
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      
      const downloadLink = document.createElement("a");
      downloadLink.href = svgUrl;
      const safeTitle = secureQrInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadLink.download = `${safeTitle}-qr.svg`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(svgUrl);
      
      triggerToast("Secure QR Code downloaded as SVG successfully!", "success");
    } catch (err: any) {
      console.error(err);
      triggerToast(`Failed to download QR code: ${err.message || String(err)}`, "error");
    }
  };

  const handlePrintSecureQr = () => {
    if (!secureQrInfo) return;

    // Authorization check
    const itemObj = secureQrInfo.type === 'chapter' ? chaptersList.find(c => c.id === secureQrInfo.id) : undefined;
    const isAuthorized = secureQrInfo.type === 'chapter' 
      ? (itemObj ? checkAdminPermission(itemObj) : (isSuperAdmin || userProfile?.role === 'admin'))
      : checkAdminPermission(undefined, String(secureQrInfo.id));

    if (!isAuthorized) {
      triggerToast("Access denied: Unauthorized action.", "error");
      return;
    }

    const svgElement = document.getElementById("secure-qr-code-svg-element");
    if (!svgElement) {
      triggerToast("QR Code element not found.", "error");
      return;
    }

    try {
      const styleEl = document.createElement("style");
      styleEl.innerHTML = `
        @media print {
          body > * {
            visibility: hidden !important;
          }
          #secure-printable-qr-modal-content, #secure-printable-qr-modal-content * {
            visibility: visible !important;
          }
          #secure-printable-qr-modal-content {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 100% !important;
            max-width: 450px !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            z-index: 9999999 !important;
            color: black !important;
          }
          .no-print-area {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(styleEl);
      
      window.print();
      
      setTimeout(() => {
        document.head.removeChild(styleEl);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      triggerToast(`Failed to print QR code: ${err.message || String(err)}`, "error");
    }
  };
  
  // Local QR Modal state for Chapter Assembly
  const [isQrGeneratorModalOpen, setIsQrGeneratorModalOpen] = useState(false);
  const [generatedQrPayload, setGeneratedQrPayload] = useState('');
  const [activeMembersList, setActiveMembersList] = useState<any[]>([]);

  // Guardrail Modal for Member Deletion/Removal
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // States for Edit Chapter Info Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMotto, setEditMotto] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editContact, setEditContact] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  const [availableLeaders, setAvailableLeaders] = useState<any[]>([]);
  const [isFetchingLeaders, setIsFetchingLeaders] = useState(false);
  const [editChapterLeader, setEditChapterLeader] = useState<string>(''); // UID of selected leader

  const selectedManagedChapterNode = chaptersList.find(c => String(c.id) === selectedChapterIdToManage);

  const handleOpenEditModal = async () => {
    if (selectedManagedChapterNode) {
      setEditMotto(selectedManagedChapterNode.subText || '');
      setEditDescription(selectedManagedChapterNode.description || '');
      setEditContact(selectedManagedChapterNode.meetupRoutine || '');
      setEditChapterLeader(selectedManagedChapterNode.adminId || '');
      setIsEditModalOpen(true);

      if (isSuperAdmin) {
        setIsFetchingLeaders(true);
        try {
          const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin']));
          const snapshot = await getDocs(q);
          const list = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id }));
          setAvailableLeaders(list);
        } catch (e) {
          console.error("Failed to fetch leaders", e);
          triggerToast("Failed to fetch available leaders.", 'error');
        } finally {
          setIsFetchingLeaders(false);
        }
      }
    }
  };

  const handleSaveChapterInfo = async () => {
    if (!selectedManagedChapterNode) return;
    try {
      setIsSavingEdit(true);
      const docRef = doc(db, 'chapters', String(selectedManagedChapterNode.id));
      
      const updates: any = {
        subText: editMotto,
        description: editDescription,
        meetupRoutine: editContact
      };

      if (isSuperAdmin && editChapterLeader !== selectedManagedChapterNode.adminId) {
        const selectedLeaderObj = availableLeaders.find(l => l.uid === editChapterLeader);
        updates.adminId = editChapterLeader || '';
        updates.leadName = selectedLeaderObj ? selectedLeaderObj.name : '';
        
        // update user document
        if (editChapterLeader) {
            const { arrayUnion } = await import('firebase/firestore');
            const userRef = doc(db, 'users', editChapterLeader);
            await updateDoc(userRef, { managedChapter: arrayUnion(selectedManagedChapterNode.name) });
        }
        
        // Optionally, clear the previous leader's managedChapter
        if (selectedManagedChapterNode.adminId) {
            const { arrayRemove } = await import('firebase/firestore');
            const prevUserRef = doc(db, 'users', selectedManagedChapterNode.adminId);
            await updateDoc(prevUserRef, { managedChapter: arrayRemove(selectedManagedChapterNode.name) }).catch(() => {});
        }
      }

      await updateDoc(docRef, updates);
      
      // Sync local state
      setChaptersList(prev => prev.map(c => 
        String(c.id) === String(selectedManagedChapterNode.id) 
          ? { ...c, ...updates } 
          : c
      ));

      triggerToast('Chapter information successfully updated in Firestore!', 'success');
      setIsEditModalOpen(false);
    } catch (err: any) {
      triggerToast(`Failed to update chapter: ${err.message || String(err)}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Evaluate if current user is an admin of any chapter
  const managedChapters = chaptersList.filter(c => c.adminId === auth.currentUser?.uid);
  const isChapterAdmin = managedChapters.length > 0;
  const canManageChapter = isSuperAdmin || isChapterAdmin;

  // Set default chapter to manage
  useEffect(() => {
    if (canManageChapter && !selectedChapterIdToManage) {
      if (isChapterAdmin && managedChapters[0]) {
        setSelectedChapterIdToManage(String(managedChapters[0].id));
      } else if (isSuperAdmin && chaptersList[0]) {
        setSelectedChapterIdToManage(String(chaptersList[0].id));
      }
    }
  }, [canManageChapter, chaptersList, isChapterAdmin, isSuperAdmin, selectedChapterIdToManage]);

  // Subscribe to Active Members for Chapter Admin's selected chapter
  useEffect(() => {
    if (!selectedChapterIdToManage) return;

    const membersRef = collection(db, 'chapters', selectedChapterIdToManage, 'members');
    const unsub = onSnapshot(membersRef, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ docId: docSnap.id, ...docSnap.data() });
      });
      setActiveMembersList(list);
    }, (error) => {
      console.error("Error reading members subcollection:", error);
    });

    return () => unsub();
  }, [selectedChapterIdToManage]);

  const getZoneForChapter = (chapter: any): string => {
    const name = ((chapter?.name || '') + ' ' + (chapter?.subText || '')).toLowerCase();
    if (name.includes('sabah') || name.includes('sarawak') || name.includes('brunei') || name.includes('labuan')) {
      return 'Zone Borneo';
    }
    // Check KL/Putrajaya/Selangor first, ensuring 'wp'/'w.p.' doesn't mistakenly match other W.P. locations like Labuan if Labuan wasn't caught
    if (name.includes('selangor') || name.includes('kuala lumpur') || name.includes('klang') || name.includes('putrajaya') || (name.includes('wp') && !name.includes('labuan')) || (name.includes('w.p.') && !name.includes('labuan'))) {
      return 'Zone Klang Valley';
    }
    if (name.includes('kelantan') || name.includes('terengganu') || name.includes('pahang')) {
      return 'Zone Pantai Timur';
    }
    if (name.includes('johor') || name.includes('melaka') || name.includes('malacca') || name.includes('sembilan')) {
      return 'Zone Selatan';
    }
    if (name.includes('penang') || name.includes('perak') || name.includes('kedah') || name.includes('perlis')) {
      return 'Zone Utara';
    }
    return 'Zone Klang Valley';
  };

  const isChapterAdminInZone = (zoneName: string): boolean => {
    if (!auth.currentUser) return false;
    return chaptersList.some(c => getZoneForChapter(c) === zoneName && c.adminId === auth.currentUser?.uid);
  };

  // Filter items based on active search queries
  const filteredChapters = chaptersList.filter((item) => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.leadName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Handle joining a chapter
  const handleJoinRequestClick = async (item: ChapterItem) => {
    if (!auth.currentUser) {
      triggerToast('Please sign in to register with a chapter.', 'warning');
      return;
    }

    const { doc, runTransaction, arrayRemove, arrayUnion } = await import('firebase/firestore');
    const isMember = joinedChapters.includes(item.id);

    if (isMember) {
      // Leave chapter logic
      try {
        await runTransaction(db, async (transaction) => {
          const userDocRef = doc(db, 'users', auth.currentUser!.uid);
          const memberDocRef = doc(db, 'chapters', String(item.id), 'members', auth.currentUser!.uid);

          transaction.update(userDocRef, {
            joinedChapters: arrayRemove(item.id),
            chapterLeaveCount: increment(1)
          });
          transaction.delete(memberDocRef);
        });

        // Decrement membersCount in chapters document
        const targetChapRef = doc(db, 'chapters', String(item.id));
        await updateDoc(targetChapRef, {
          membersCount: Math.max(0, (item.membersCount || 1) - 1)
        });

        setJoinedChapters(prev => prev.filter(c => c !== item.id));
        triggerToast(`You have successfully exited "${item.name}".`, 'info');
      } catch (err: any) {
        console.error(err);
        triggerToast("Failed to leave chapter assembly.", 'error');
      }
      return;
    }

    // Join logic
    if (joinedChapters.length >= 3) {
      triggerToast('You can only join a maximum of 3 state chapters concurrently.', 'warning');
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userDocRef = doc(db, 'users', auth.currentUser!.uid);
        const chapterMemberRef = doc(db, 'chapters', String(item.id), 'members', auth.currentUser!.uid);

        // Fetch user data within transaction (safe assumption the user profile exists)
        const userSnap = await transaction.get(userDocRef);
        let currentData: any = {};
        if (userSnap.exists()) {
           currentData = userSnap.data();
        }

        // Add member to subcollection
        transaction.set(chapterMemberRef, {
          uid: auth.currentUser!.uid,
          name: currentData.name || auth.currentUser!.displayName || 'MVOC Member',
          email: currentData.email || auth.currentUser!.email || '',
          mvocId: currentData.mvocId || 'Pending ID',
          vehiclePlate: currentData.vehiclePlate || 'Pending',
          joinedAt: new Date().toISOString()
        });

        // Update user profile locally and remotely
        transaction.update(userDocRef, {
          joinedChapters: arrayUnion(item.id),
          updatedAt: new Date().toISOString()
        });
      });

      // Increment membersCount in chapters document
      const targetChapRef = doc(db, 'chapters', String(item.id));
      await updateDoc(targetChapRef, {
        membersCount: (item.membersCount || 0) + 1
      });

      setJoinedChapters(prev => [...prev, item.id]);
      triggerToast(`Successfully joined the chapter "${item.name}"!`, 'success');
    } catch (err: any) {
      console.error("Join failed: ", err);
      triggerToast(`Join failed: ${err.message}`, 'error');
    }
  };

  const handleActiveVehicleClick = async (member: any) => {
    if (!selectedChapterIdToManage) return;
    const targetChapRef = doc(db, 'chapters', selectedChapterIdToManage);
    try {
      if (member && member.vehiclePlate) {
        const { arrayUnion } = await import('firebase/firestore');
        await updateDoc(targetChapRef, {
          registeredCars: arrayUnion(member.vehiclePlate)
        });
        
        // Update local state to reflect UI change instantly
        setChaptersList(prev => prev.map(c => 
          String(c.id) === selectedChapterIdToManage 
            ? { ...c, registeredCars: [...new Set([...(c.registeredCars || []), member.vehiclePlate])] } 
            : c
        ));
      } else {
        await updateDoc(targetChapRef, {
          vehicleCount: increment(1)
        });
      }
      triggerToast('Active vehicle count increased via member update!', 'success');
    } catch (err) {
      console.error('Failed to increase vehicle count:', err);
      triggerToast('Failed to increase vehicle count.', 'error');
    }
  };

  // Remove Member Confirm Trigger
  const handleRemoveMemberClick = (member: any) => {
    setMemberToRemove(member);
    setDeleteConfirmText('');
  };

  // Execute Member Removal (Using Transaction)
  const executeRemoveMember = async () => {
    if (!memberToRemove) return;
    const uid = memberToRemove.uid;
    const cName = chaptersList.find(c => String(c.id) === selectedChapterIdToManage)?.name || '';

    const userDocRef = doc(db, 'users', uid);
    const chapterMemberRef = doc(db, 'chapters', selectedChapterIdToManage, 'members', uid);

    try {
      await runTransaction(db, async (transaction) => {
        // Read user doc first (Transaction rule)
        const userDoc = await transaction.get(userDocRef);
        if (userDoc.exists()) {
          const { arrayRemove } = await import('firebase/firestore');
          // 1. Update user profile back to independent/none
          transaction.update(userDocRef, {
            joinedChapters: arrayRemove(Number(selectedChapterIdToManage))
          });
        }

        // 2. Delete member document from chapter
        transaction.delete(chapterMemberRef);
      });

      // Decrement chapter counter
      const targetChapRef = doc(db, 'chapters', selectedChapterIdToManage);
      const chapObj = chaptersList.find(c => String(c.id) === selectedChapterIdToManage);
      if (chapObj) {
        await updateDoc(targetChapRef, {
          membersCount: Math.max(0, (chapObj.membersCount || 1) - 1)
        });
      }

      triggerToast(`Successfully removed ${memberToRemove.name} from "${cName}".`, 'success');
      setMemberToRemove(null);
    } catch (err: any) {
      console.error(err);
      triggerToast(`Failed to remove member: ${err.message}`, 'error');
    }
  };

  const renderChapterIcon = (name: string) => {
    const stateLower = name.toLowerCase();
    let flagUrl = '';
    let altText = '';

    if (stateLower.includes('selangor')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/0/0c/Flag_of_Selangor.svg';
      altText = 'Selangor';
    } else if (stateLower.includes('kuala lumpur') || stateLower.includes('persekutuan') || stateLower.includes('klang')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/64/Flag_of_Kuala_Lumpur%2C_Malaysia.svg';
      altText = 'Kuala Lumpur';
    } else if (stateLower.includes('johor')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Flag_of_Johor.svg';
      altText = 'Johor';
    } else if (stateLower.includes('penang')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/d/d4/Flag_of_Penang_%28Malaysia%29.svg';
      altText = 'Penang';
    } else if (stateLower.includes('perak')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/8/87/Flag_of_Perak.svg';
      altText = 'Perak';
    } else if (stateLower.includes('pahang')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Flag_of_Pahang.svg';
      altText = 'Pahang';
    } else if (stateLower.includes('sembilan')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/d/db/Flag_of_Negeri_Sembilan.svg';
      altText = 'Negeri Sembilan';
    } else if (stateLower.includes('melaka')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/0/09/Flag_of_Malacca.svg';
      altText = 'Melaka';
    } else if (stateLower.includes('kedah')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/c/cc/Flag_of_Kedah.svg';
      altText = 'Kedah';
    } else if (stateLower.includes('kelantan')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/61/Flag_of_Kelantan.svg';
      altText = 'Kelantan';
    } else if (stateLower.includes('terengganu')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/6b/Flag_of_Terengganu.svg';
      altText = 'Terengganu';
    } else if (stateLower.includes('sabah')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Flag_of_Sabah.svg';
      altText = 'Sabah';
    } else if (stateLower.includes('sarawak')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/7/7e/Flag_of_Sarawak.svg';
      altText = 'Sarawak';
    } else if (stateLower.includes('perlis')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Flag_of_Perlis.svg';
      altText = 'Perlis';
    } else if (stateLower.includes('brunei') || stateLower.includes('brunie')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Flag_of_Brunei.svg';
      altText = 'Brunei';
    } else if (stateLower.includes('putrajaya')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/9/9f/Flag_of_Putrajaya.svg';
      altText = 'Putrajaya';
    } else if (stateLower.includes('labuan')) {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/69/Flag_of_Labuan.svg';
      altText = 'Labuan';
    } else {
      flagUrl = 'https://upload.wikimedia.org/wikipedia/commons/6/66/Flag_of_Malaysia.svg';
      altText = 'Malaysia';
    }

    return (
      <img 
        src={flagUrl} 
        alt={altText} 
        className="w-12 h-8 object-cover rounded shadow-xs border border-slate-205" 
        referrerPolicy="no-referrer"
      />
    );
  };

  return (
    <div className="space-y-5 text-left font-sans select-none pb-8" id="state-chapters-component">
      
      {/* Title & Subtitle */}
      <div className="pt-1">
        <h2 className="font-display text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Landmark className="w-6 h-6 text-emerald-400" />
          <span>Regional Chapters</span>
        </h2>
        <p className="text-slate-400 text-xs font-semibold leading-relaxed mt-1">
          Uniting Veloz owners across the Malaysian States & Federal Territories.
        </p>
      </div>

      {/* Chapter Subtab Controls for Command Center Role Toggling */}
      {canManageChapter && (
        <div className="flex border-b border-[#16243a] pb-0.5 select-none gap-6 mt-1.5" id="chapters-subtab-navigation">
          <button
            onClick={() => setActiveSubTab('browse')}
            className={`pb-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 px-1 focus:outline-none cursor-pointer ${
              activeSubTab === 'browse'
                ? 'border-emerald-500 text-emerald-400 font-extrabold'
                : 'border-transparent text-slate-400 hover:text-slate-350'
            }`}
          >
            Browse Chapters
          </button>
          <button
            onClick={() => setActiveSubTab('manage')}
            className={`pb-2.5 font-bold text-xs uppercase tracking-wider transition-all border-b-2 px-1 focus:outline-none cursor-pointer ${
              activeSubTab === 'manage'
                ? 'border-emerald-500 text-emerald-400 font-extrabold flex items-center gap-1.5'
                : 'border-transparent text-slate-400 hover:text-slate-350 flex items-center gap-1.5'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Manage Chapter</span>
          </button>
        </div>
      )}

      {activeSubTab === 'browse' ? (
        <>
          {/* Search bar & Filter */}
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-4.5 h-4.5 text-slate-405" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chapters by state or leader name..."
              className="w-full bg-[#0b1c30] border border-[#16243a] focus:border-emerald-405 rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-white shadow-3xs outline-hidden transition placeholder:text-slate-500 min-h-[48px]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Geographical Zones (Collapsible / Accordion Grid) */}
          <div className="space-y-4 pt-1" id="chapters-zones-layout">
            {(() => {
              const zonesList = [
                'Zone Klang Valley',
                'Zone Utara',
                'Zone Borneo',
                'Zone Pantai Timur',
                'Zone Selatan'
              ];

              const groupedChapters: Record<string, typeof chaptersList> = {
                'Zone Klang Valley': [],
                'Zone Utara': [],
                'Zone Borneo': [],
                'Zone Pantai Timur': [],
                'Zone Selatan': []
              };

              filteredChapters.forEach((item) => {
                const zone = getZoneForChapter(item);
                if (groupedChapters[zone]) {
                  groupedChapters[zone].push(item);
                } else {
                  groupedChapters['Zone Klang Valley'].push(item);
                }
              });

              if (filteredChapters.length === 0) {
                return (
                  <div className="bg-[#0b1c30] p-12 rounded-2xl border border-[#16243a] text-center text-slate-400 text-xs font-bold shadow-xs">
                    No active state chapters matched your query filters.
                  </div>
                );
              }

              return zonesList.map((zone) => {
                const chaptersInZone = groupedChapters[zone];
                // If there is an active search query, and this zone has no matching chapters, hide the zone header entirely for a clean UI
                if (searchQuery && chaptersInZone.length === 0) return null;

                const isExpanded = expandedZones[zone] === true;

                return (
                  <div key={zone} className="space-y-3" id={`zone-section-${zone.replace(/\s+/g, '-').toLowerCase()}`}>
                    {/* Zone Accordion Header */}
                    <button
                      onClick={() => {
                        setExpandedZones(prev => ({
                          ...prev,
                          [zone]: !isExpanded
                        }));
                      }}
                      className="w-full flex items-center justify-between bg-[#0b1c30] hover:bg-[#122842] border border-[#16243a] p-4 rounded-xl transition-all duration-200 cursor-pointer shadow-xs active:scale-99 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="font-display font-black text-white text-sm sm:text-base tracking-tight">{zone}</span>
                        <span className="bg-[#122842] border border-[#1d334f] text-slate-300 text-[10px] font-black px-2.5 py-0.5 rounded-full select-none">
                          {chaptersInZone.length} {chaptersInZone.length === 1 ? 'Chapter' : 'Chapters'}
                        </span>
                      </div>
                      <ChevronUp 
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-250 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {/* Zone Chapters list */}
                    {isExpanded && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 animate-fade-in">
                        
                        {/* 🌟 ZONE HUB CARD - Full width col-span-1 md:col-span-2 */}
                        {(() => {
                          const zoneHubData = zoneHubs[zone] || {};
                          const isEditingThisZone = editingZoneId === zone;
                          const canManageThisZone = isSuperAdmin || isChapterAdminInZone(zone);

                          return (
                            <div 
                              className="col-span-1 md:col-span-2 relative overflow-hidden bg-gradient-to-br from-[#0c1f35] to-[#04101e] rounded-2xl border-2 border-[#162a4a] hover:border-[#10b981]/30 transition-all duration-300 p-6 text-left shadow-md"
                              id={`zone-hub-${zone.replace(/\s+/g, '-').toLowerCase()}`}
                            >
                              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-bl-full pointer-events-none" />
                              
                              {isEditingThisZone ? (
                                /* ZONE HUB - EDIT MODE */
                                <div className="space-y-4">
                                  <div className="flex justify-between items-center pb-2 border-b border-[#1c3352]">
                                    <span className="text-[11px] font-black uppercase text-emerald-400 tracking-wider">
                                      Edit {zone} Hub & Coordination Details
                                    </span>
                                    <span className="text-[9px] bg-[#16273d] text-slate-350 px-2 rounded font-black select-none uppercase">
                                      Zone Coordinator Panel
                                    </span>
                                  </div>

                                  <div className="space-y-3">
                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 select-none">
                                        Zone TT / Meetup Schedule & Info
                                      </label>
                                      <textarea
                                        value={editedZoneFields.ttInfo}
                                        onChange={(e) => setEditedZoneFields({ ...editedZoneFields, ttInfo: e.target.value })}
                                        className="w-full bg-[#071322] border border-[#1d3554] focus:border-emerald-400 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all min-h-[70px] resize-y"
                                        placeholder="E.g. Weekly teh tarik (TT) on Friday nights, 9:30 PM at Restoran Ali Maju."
                                      />
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 select-none">
                                        Zone-wide Announcement / Notice
                                      </label>
                                      <textarea
                                        value={editedZoneFields.announcement}
                                        onChange={(e) => setEditedZoneFields({ ...editedZoneFields, announcement: e.target.value })}
                                        className="w-full bg-[#071322] border border-[#1d3554] focus:border-emerald-400 rounded-xl px-3 py-2.5 text-xs text-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-400 transition-all min-h-[70px] resize-y"
                                        placeholder="E.g. Preparing for national meetup next month. Get your plates ordered and RSVP!"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex gap-3 pt-2">
                                    <button
                                      onClick={() => handleSaveZoneEdit(zone)}
                                      disabled={isSavingZone}
                                      className="flex-1 max-w-[140px] bg-emerald-600 hover:bg-emerald-500 text-white font-black h-[40px] rounded-xl flex items-center justify-center gap-1.5 text-xs cursor-pointer transition active:scale-97 disabled:opacity-50 select-none shadow-sm"
                                    >
                                      <Check className="w-4 h-4" />
                                      <span>{isSavingZone ? 'Saving...' : 'Save Hub'}</span>
                                    </button>
                                    <button
                                      onClick={() => setEditingZoneId(null)}
                                      disabled={isSavingZone}
                                      className="flex-1 max-w-[140px] bg-[#12243d] hover:bg-[#1a3152] border border-[#223d61] text-slate-200 font-bold h-[40px] rounded-xl flex items-center justify-center gap-1.5 text-xs cursor-pointer transition active:scale-97 select-none"
                                    >
                                      <X className="w-4 h-4" />
                                      <span>Cancel</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* ZONE HUB - PREVIEW/VIEW MODE */
                                <div className="flex flex-col md:flex-row justify-between gap-5">
                                  <div className="flex-1 space-y-3.5">
                                    {/* Header Row */}
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="font-display font-black text-xs text-emerald-400 uppercase tracking-widest leading-none">
                                          {zone} Hub Coordination Center
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                        {canManageThisZone && (
                                          <button
                                            onClick={() => startEditingZone(zone)}
                                            className="h-[30px] px-3 bg-[#112339] hover:bg-[#193252] border border-[#1b3454] text-emerald-400 font-extrabold text-[10px] rounded-lg tracking-normal flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-3xs hover:border-emerald-500/50"
                                            aria-label="Edit Zone Hub Info"
                                          >
                                            <Edit className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>Edit Hub Info</span>
                                          </button>
                                        )}
                                        {checkAdminPermission(undefined, zone) && (
                                          <button
                                            onClick={() => handleOpenZoneHubQr(zone, zoneHubData)}
                                            className="h-[30px] w-[30px] bg-[#113a2d] hover:bg-[#195441] border border-[#236852] text-emerald-300 hover:text-emerald-200 rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer shadow-3xs hover:border-emerald-400/50"
                                            title="View Secure Zone QR Code"
                                            aria-label="View Secure Zone QR Code"
                                          >
                                            <QrCode className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {/* Main Title description */}
                                    <div className="space-y-1">
                                      <h4 className="font-display text-lg font-black text-white tracking-tight leading-none">
                                        Zone Coordination & Gathering Details
                                      </h4>
                                      <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider select-none leading-none">
                                        Collective zone announcements, routines, & TT meetups
                                      </p>
                                    </div>

                                    {/* Details Blocks: TT Info & Announcement */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                                      {/* Block 1: TT Info */}
                                      <div className="bg-[#081525] border border-[#162a4a] p-3.5 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 text-emerald-300">
                                          <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                                          <span className="text-[10px] font-black uppercase tracking-wider">Zone TT Routine</span>
                                        </div>
                                        <p className="text-[11.5px] text-slate-300 font-medium leading-relaxed">
                                          {zoneHubData.ttInfo || "No zone-wide Teh Tarik (TT) location scheduled yet. Tap Edit Hub Info to set details."}
                                        </p>
                                      </div>

                                      {/* Block 2: Special Announcements */}
                                      <div className="bg-[#081525] border border-[#162a4a] p-3.5 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 text-amber-300">
                                          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                          <span className="text-[10px] font-black uppercase tracking-wider">Zone Announcement</span>
                                        </div>
                                        <p className="text-[11.5px] text-slate-300 font-medium leading-relaxed">
                                          {zoneHubData.announcement || "No current zone announcements. Ready to roll out the national parade!"}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    {/* Metadata */}
                                    {zoneHubData.lastUpdatedAt && (
                                      <div className="text-[9.5px] text-slate-500 font-semibold select-none">
                                        Last Updated: {new Date(zoneHubData.lastUpdatedAt).toLocaleString()} by {zoneHubData.lastUpdatedBy || 'Hub Coordinator'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Standard Zone Chapters list starts below */}
                        {chaptersInZone.length === 0 ? (
                          <div className="col-span-1 md:col-span-2">
                            <p className="text-xs text-slate-500 font-bold italic pl-4">No registered chapters in this zone yet.</p>
                          </div>
                        ) : (
                          chaptersInZone.map((item) => {
                            const isUserMember = joinedChapters.includes(item.id);
                            const actualMemberCount = getActualMemberCount(item);
                            const progressPercent = Math.min(100, (actualMemberCount / 500) * 100);
                            const canEdit = isSuperAdmin || (auth.currentUser && item.adminId === auth.currentUser.uid);

                            return (
                              <div
                                key={item.id}
                                className="relative overflow-hidden bg-white rounded-2xl border border-slate-205 p-5 shadow-xs flex flex-col justify-between min-h-[250px] transition hover:border-[#adc8f5]"
                                id={`chapter-card-${item.id}`}
                              >
                                  {/* STANDARD VIEW */}
                                  <>
                                    <div>
                                      {/* Top Row: Flag & Pill & Edit trigger button */}
                                      <div className="flex justify-between items-center gap-4">
                                        <div className="shrink-0 animate-pulse-subtle">
                                          {renderChapterIcon(item.name)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {canEdit && (
                                            <button
                                              onClick={() => startEditingChapter(item)}
                                              className="h-[28px] px-2.5 bg-slate-50 hover:bg-slate-150 border border-slate-200 text-slate-605 font-extrabold text-[10px] rounded-lg tracking-normal flex items-center gap-1 transition active:scale-95 cursor-pointer hover:border-slate-350 shadow-3xs"
                                              aria-label="Edit Chapter Info"
                                            >
                                              <Edit className="w-3 h-3 text-slate-550 shrink-0" />
                                              <span>Edit</span>
                                            </button>
                                          )}
                                          {checkAdminPermission(item) && (
                                            <button
                                              onClick={() => handleOpenChapterQr(item)}
                                              className="h-[28px] w-[28px] bg-slate-550/5 hover:bg-[#0f2d52]/10 text-[#0f2d52] rounded-lg flex items-center justify-center transition active:scale-95 cursor-pointer hover:border-slate-350 shadow-3xs border border-slate-200"
                                              title="View Secure Chapter QR Code"
                                              aria-label="View Secure Chapter QR Code"
                                            >
                                              <QrCode className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                          <div className="px-3 py-1.5 bg-[#0F2D52]/5 text-[#0F2D52] font-black text-[10px] rounded-full tracking-wider uppercase shrink-0 border border-[#0F2D52]/10 select-none">
                                            {actualMemberCount.toLocaleString()} Members
                                          </div>
                                        </div>
                                      </div>

                                      {/* Body Info Block (Slightly larger, rich content spacing) */}
                                      <div className="space-y-2 mt-4 text-left">
                                        <h3 className="font-display text-base font-black text-[#0F2D52] tracking-tight leading-none flex items-center gap-1.5 flex-wrap">
                                          {item.name}
                                          {isUserMember && (
                                            <span className="text-[8.5px] bg-emerald-50 border border-emerald-250 text-emerald-750 px-2 py-0.5 rounded font-black tracking-normal uppercase select-none shadow-3xs">
                                              My Chapter
                                            </span>
                                          )}
                                        </h3>

                                        {item.subText && (
                                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest line-clamp-1 leading-none select-none">
                                            "{item.subText}"
                                          </p>
                                        )}

                                        <p className="text-[11.5px] text-slate-600 font-medium leading-relaxed line-clamp-3 select-none">
                                          {item.description}
                                        </p>

                                        {/* Leader info section */}
                                        <div className="flex items-center gap-2.5 mt-2.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                                          {(() => {
                                            // Determine admins for this chapter
                                            const chapterAdmins = membersList.filter(user => 
                                              user.managedChapter && 
                                              Array.isArray(user.managedChapter) &&
                                              user.managedChapter.some((state: string) => {
                                                const cleanState = state.toLowerCase().replace('w.p.', '').trim();
                                                return (item.name && item.name.toLowerCase().includes(cleanState)) || 
                                                       (item.subText && item.subText.toLowerCase().includes(cleanState));
                                              })
                                            );
                                            
                                            // If we found admins dynamically, use them
                                            if (chapterAdmins.length > 0) {
                                              const adminNames = chapterAdmins.map(a => a.shortName || a.name || a.email);
                                              return (
                                                <>
                                                  <AvatarStack admins={adminNames} totalMembers={adminNames.length} />
                                                  <div className="text-[11px] min-w-0 flex-1">
                                                    <p className="text-slate-850 font-extrabold leading-none truncate select-none">
                                                      {adminNames.length === 1 ? adminNames[0] : `${adminNames.length} Leaders`}
                                                    </p>
                                                    <p className="text-slate-500 font-semibold text-[9.5px] mt-0.5 truncate select-none">Chapter Lead</p>
                                                  </div>
                                                </>
                                              );
                                            }

                                            // Fallback to legacy single admin string
                                            const finalLeadName = item.leadName || 'Belum Ditetapkan';
                                            return (
                                              <>
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black flex items-center justify-center border border-emerald-200/50 select-none uppercase shrink-0">
                                                  {item.leadInitial || finalLeadName.charAt(0)}
                                                </div>
                                                <div className="text-[11px] min-w-0 flex-1">
                                                  <p className="text-slate-850 font-extrabold leading-none truncate select-none">{finalLeadName}</p>
                                                  <p className="text-slate-500 font-semibold text-[9.5px] mt-0.5 truncate select-none">{item.leadTitle || 'Chapter Leader'}</p>
                                                </div>
                                              </>
                                            );
                                          })()}
                                        </div>

                                        {/* Meetup Routine */}
                                        {item.meetupRoutine && (
                                          <div className="flex items-center gap-1.5 pt-1 text-slate-550 text-[10.5px] select-none font-semibold">
                                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate">Meetups: {item.meetupRoutine}</span>
                                          </div>
                                        )}

                                        {/* Active Member Plate Number */}
                                        {item.activeMemberPlate && (
                                          <div className="flex items-center gap-1.5 pt-1 text-slate-550 text-[10.5px] select-none font-semibold">
                                            <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate">Active Plate: {item.activeMemberPlate}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Dynamic Action Buttons with Touch Targets min-height of 44px */}
                                    <div className="flex gap-2.5 pt-4 select-none mt-5">
                                      <button
                                        onClick={() => setSelectedChapterDetailId(item.id)}
                                        className="flex-1 bg-white hover:bg-slate-50 text-slate-800 hover:text-black flex items-center justify-center gap-1.5 font-bold h-[44px] min-h-[44px] rounded-xl cursor-pointer text-xs transition active:scale-98 border border-slate-205"
                                      >
                                        <span>View Info</span>
                                        <ArrowRight className="w-4 h-4 text-slate-500" />
                                      </button>

                                      <button
                                        onClick={() => handleJoinRequestClick(item)}
                                        className={`flex-1 flex items-center justify-center gap-1.5 font-bold h-[44px] min-h-[44px] rounded-xl border cursor-pointer text-xs transition active:scale-98 ${
                                          isUserMember
                                            ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 hover:text-rose-850'
                                            : 'bg-[#000000] border-transparent text-[#FFFFFF] hover:bg-slate-850'
                                        }`}
                                      >
                                        {isUserMember ? (
                                          <>
                                            <Check className="w-3.5 h-3.5 shrink-0" />
                                            <span>Leave Chapter</span>
                                          </>
                                        ) : (
                                          <span>Join Chapter</span>
                                        )}
                                      </button>
                                    </div>

                                    {/* Bottom Progress bar relative to 500 members benchmark */}
                                    <div className="absolute bottom-0 left-0 h-[3px] bg-slate-100 w-full overflow-hidden rounded-b-2xl">
                                      <div 
                                        className="h-full bg-emerald-500 transition-all duration-350" 
                                        style={{ width: `${progressPercent}%` }}
                                      />
                                    </div>
                                  </>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </>
      ) : (
        /* MANAGE CHAPTER SUBTAB - PREMIUM COMMAND CENTER LOOK */
        <div className="space-y-6" id="manage-chapter-container">
          
          {/* Header config block with high-contrast Edit Info button */}
          <div className="bg-gradient-to-br from-[#0c1f38] via-[#0b1c30] to-[#040c17] rounded-xl p-5 border border-slate-800 text-white relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h4 className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Chapter Control Console</span>
              </h4>
              <p className="text-[11px] text-slate-300 font-bold mt-1 max-w-xl">
                Active Chapter: <span className="text-white font-extrabold">{selectedManagedChapterNode?.name || 'Loading'}</span> • Region: {selectedManagedChapterNode?.region}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 relative z-10 shrink-0 select-none">
              {(isSuperAdmin || (userProfile?.role === 'admin' && selectedManagedChapterNode?.adminId === auth.currentUser?.uid)) && (
                <>
                  <button
                    onClick={() => {
                      setGeneratedQrPayload(JSON.stringify({ type: 'attendance', context: 'chapter', refId: selectedChapterIdToManage, name: selectedManagedChapterNode?.name }));
                      setIsQrGeneratorModalOpen(true);
                    }}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 text-xs font-black px-4.5 py-2 rounded-xl flex items-center gap-1.5 transition active:scale-97 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Assembly QR</span>
                  </button>

                  <button
                    onClick={handleOpenEditModal}
                    className="bg-[#FFFFFF] hover:bg-slate-200 text-[#000000] text-xs font-black px-4.5 py-2 rounded-xl flex items-center gap-1.5 transition active:scale-97 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5 text-black" />
                    <span>Edit Info</span>
                  </button>
                </>
              )}

              {/* Dropdown for SuperAdmins */}
              {isSuperAdmin && (
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Switch Chapter:</label>
                  <select
                    value={selectedChapterIdToManage}
                    onChange={(e) => setSelectedChapterIdToManage(e.target.value)}
                    className="bg-[#16243a] text-white text-xs font-black px-3.5 py-2 border border-emerald-500/30 rounded-xl outline-none focus:border-emerald-500 cursor-pointer min-h-[38px]"
                  >
                    {chaptersList.map(c => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Core high density workspaces */}
          <div className="grid grid-cols-1 gap-6">
            
            {/* 1. Active Registry Members */}
            <div className="bg-[#0b1c30] border border-slate-800/90 rounded-xl p-5 space-y-4">
              <div className="border-b border-white/5 pb-2.5 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <span>Verified Active Members ({activeMembersList.length})</span>
                </h4>
              </div>

              {activeMembersList.length === 0 ? (
                <p className="text-xs text-slate-500 font-bold py-6 text-center">
                  This chapter has no verified static registry members in Firestore.
                </p>
              ) : (
                /* High Density compact table for Active Members list */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 select-none border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] text-slate-400 font-black uppercase tracking-wider">
                        <th className="py-2.5 px-2">Driver Name</th>
                        <th className="py-2.5 px-2">MVOC-ID</th>
                        <th className="py-2.5 px-2">Registered Email</th>
                        <th className="py-2.5 px-2 text-right">Registry Operations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMembersList.map((mbr) => (
                        <tr key={mbr.docId} className="border-b border-white/5 hover:bg-[#10243d]/60 transition-colors cursor-pointer" onClick={() => handleActiveVehicleClick(mbr)}>
                          <td className="py-3 px-2 font-bold text-white hover:text-emerald-300 transition-colors" title="Click to increment chapter vehicle count">{mbr.name}</td>
                          <td className="py-3 px-2 font-mono font-bold text-emerald-400">{mbr.mvocId}</td>
                          <td className="py-3 px-2 font-mono text-[11px] text-slate-400">{mbr.email}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-end">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveMemberClick(mbr); }}
                                className="bg-transparent hover:bg-rose-950/20 text-rose-400 hover:text-rose-500 p-2 rounded-lg cursor-pointer transition focus:outline-none flex items-center gap-1 border border-transparent hover:border-rose-900/40 text-[10px] uppercase font-bold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Purge</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* GUARDRALL SECURITY DELETION MODAL */}
      {memberToRemove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            onClick={() => setMemberToRemove(null)}
            className="absolute inset-0 bg-black/80 backdrop-blur-xs cursor-pointer"
          />
          
          <div className="relative w-full max-w-sm bg-[#0b1c30] text-white rounded-2xl border border-rose-500/20 shadow-2xl p-6 z-10 flex flex-col gap-4 text-left select-none overflow-hidden font-sans">
            <div className="flex justify-between items-center pb-2 border-b border-white/10">
              <div className="flex items-center gap-2 text-rose-500">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="text-sm font-black uppercase tracking-wide">Registry SecOps Guardrail</h4>
              </div>
              <button 
                onClick={() => setMemberToRemove(null)}
                className="p-1 text-slate-450 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                You are about to remove <strong className="text-white">{memberToRemove.name}</strong> from your official chapter registry. 
                This will reset their profile chapter association back to independent.
              </p>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  To proceed, type <span className="text-rose-400 font-mono font-extrabold">DELETE</span> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="w-full bg-[#16243a] text-xs font-semibold px-4 py-3 border border-red-900/30 rounded-xl outline-none focus:border-red-500 transition text-white font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="w-1/2 py-2.5 bg-[#16243a] hover:bg-[#1e2f49] text-slate-300 font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmText !== 'DELETE'}
                onClick={executeRemoveMember}
                className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAPTER QR ATTENDANCE GENERATOR MODAL */}
      {isQrGeneratorModalOpen && generatedQrPayload && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsQrGeneratorModalOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[1.75rem] shadow-[0px_0px_35px_rgba(0,0,0,0.3)] p-6 z-10 flex flex-col items-center gap-6 text-center select-none overflow-hidden border border-slate-205">
            <div className="w-full flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="text-xs font-black text-[#000000] uppercase tracking-wider text-left">Chapter Assembly QR</h4>
              <button onClick={() => setIsQrGeneratorModalOpen(false)} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 cursor-pointer transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-[#0F2D52] tracking-tight">{JSON.parse(generatedQrPayload).name || 'Chapter'}</h3>
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
          </div>
        </div>
      )}

      {/* SECURE ADMIN QR CODE MODAL */}
      {secureQrModalOpen && secureQrInfo && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-fade-in" onClick={() => setSecureQrModalOpen(false)} />
          <div 
            id="secure-printable-qr-modal-content"
            className="relative w-full max-w-sm bg-white rounded-[2rem] shadow-[0px_0px_50px_rgba(0,0,0,0.35)] p-6 z-10 flex flex-col items-center gap-5 text-center select-none overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
          >
            {/* Modal header */}
            <div className="w-full flex justify-between items-center pb-2.5 border-b border-slate-100 no-print-area">
              <div className="flex items-center gap-1.5 text-emerald-600">
                <Shield className="w-4 h-4 text-emerald-600 animate-pulse" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Secure Admin QR Resource</h4>
              </div>
              <button 
                onClick={() => setSecureQrModalOpen(false)} 
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 cursor-pointer transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QR Metadata block */}
            <div className="space-y-1">
              <span className="text-[9px] bg-slate-900 text-slate-200 px-3 py-1 rounded-full font-black tracking-widest select-none uppercase">
                {secureQrInfo.type === 'hub' ? 'Zone Coordinator Hub' : 'Chapter Resource'}
              </span>
              <h3 className="text-xl font-black text-[#0F2D52] tracking-tight pt-1.5">{secureQrInfo.title}</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 select-none">{secureQrInfo.subTitle}</p>
            </div>

            {/* Centered QR SVG */}
            <div className="bg-white p-5 rounded-[1.75rem] shadow-sm border border-slate-100 inline-flex items-center justify-center relative">
              <QRCodeSVG 
                id="secure-qr-code-svg-element"
                value={secureQrInfo.payload} 
                size={220} 
                level="Q"
                includeMargin={false}
                imageSettings={{
                  src: "/mvoc_logo.png",
                  x: undefined,
                  y: undefined,
                  height: 44,
                  width: 44,
                  excavate: true,
                }}
              />
            </div>

            {/* Action Buttons inside popup */}
            <div className="w-full flex flex-col gap-2.5 no-print-area mt-1">
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadSecureQr}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] rounded-xl transition uppercase tracking-wider cursor-pointer shadow-xs active:scale-97 select-none flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handlePrintSecureQr}
                  className="flex-1 py-3 bg-[#0F2D52] hover:bg-[#184474] text-white font-black text-[11px] rounded-xl transition uppercase tracking-wider cursor-pointer shadow-xs active:scale-97 select-none flex items-center justify-center gap-1"
                >
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Print QR</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 text-slate-400 font-extrabold text-[8px] uppercase tracking-widest select-none flex items-center justify-center gap-1">
                <Shield className="w-3 h-3 text-slate-400" />
                <span>Authorized MVOC Admin Access Only</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CHAPTER INFO MODAL */}
      {isEditModalOpen && selectedManagedChapterNode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            onClick={() => setIsEditModalOpen(false)}
            className="absolute inset-0 bg-black/75 backdrop-blur-xs cursor-pointer"
          />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden p-6 z-10 space-y-5 text-left text-black border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-805">
                <Edit className="w-5 h-5 text-emerald-600" />
                <h4 className="text-sm font-black uppercase tracking-wide">Edit Chapter Information</h4>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 font-bold -mt-3">
              Update information for <strong className="text-slate-850 font-black">{selectedManagedChapterNode.name}</strong>. These settings reflect immediately across the PWA.
            </p>

            <div className="space-y-4">
              {/* Motto / Subtext */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-650">
                  Chapter Motto / Subtext:
                </label>
                <input
                  type="text"
                  value={editMotto}
                  onChange={(e) => setEditMotto(e.target.value)}
                  placeholder="e.g. Selangor Chapter, The Heart of Peninsular Cruises"
                  className="w-full bg-slate-50 text-xs font-semibold px-4.5 py-3 border border-slate-205 rounded-xl outline-none focus:bg-white focus:border-slate-800 transition text-[#000000]"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-650">
                  Chapter Description:
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Describe your chapter, regional focus, partner garages, or local cruises"
                  className="w-full bg-slate-50 text-xs font-semibold px-4.5 py-3 border border-slate-205 rounded-xl outline-none focus:bg-white focus:border-slate-800 transition text-[#000000] resize-none"
                />
              </div>

              {/* Meetup Routine & Contacts */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-655">
                  Meetup Routine &amp; Contact Info:
                </label>
                <input
                  type="text"
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                  placeholder="e.g. Every Friday night at Stadium Shah Alam, starting 09:30 PM."
                  className="w-full bg-slate-50 text-xs font-semibold px-4.5 py-3 border border-slate-205 rounded-xl outline-none focus:bg-white focus:border-slate-800 transition text-[#000000]"
                />
              </div>

              {/* Leader Selection (Super Admin Only) */}
              {isSuperAdmin && (
                <div className="space-y-1.5 pt-3 border-t border-slate-100">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-655 flex items-center justify-between">
                    <span>Assign Chapter Leader</span>
                    {isFetchingLeaders && <span className="text-emerald-500 animate-pulse text-[9px] normal-case">Fetching...</span>}
                  </label>
                  <select
                    value={editChapterLeader}
                    disabled={isFetchingLeaders}
                    onChange={(e) => setEditChapterLeader(e.target.value)}
                    className="w-full bg-[#f8f9ff] text-xs font-bold px-4.5 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer disabled:opacity-50"
                  >
                    <option value="">-- No Leader Assigned --</option>
                    {availableLeaders.map(l => (
                      <option key={l.uid} value={l.uid}>
                        {l.name} ({l.mvocId})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500 font-medium">Only Officers and Super Admins are shown in this list. Assigning a leader will grant them management access to this chapter.</p>
                </div>
              )}
            </div>

            {/* Modal actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-705 font-bold text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveChapterInfo}
                className="w-1/2 py-2.5 bg-[#000000] hover:bg-slate-850 disabled:opacity-40 text-white font-extrabold text-xs rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
              >
                {isSavingEdit ? 'Saving Info...' : 'Save Info'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CHAPTER INFO MODAL (REPLACING INLINE EDIT) */}
      {editingChapterId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div 
            onClick={() => setEditingChapterId(null)}
            className="absolute inset-0 bg-[#001835]/80 backdrop-blur-sm cursor-pointer transition-opacity"
          />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 z-10 space-y-6 text-left text-black border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3 text-slate-800">
                <div className="p-2.5 bg-emerald-50 rounded-xl">
                  <Edit className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h4 className="text-lg md:text-xl font-black uppercase tracking-wide text-[#0f2d52]">Edit Chapter Info</h4>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">Update details for {chaptersList.find(c => c.id === editingChapterId)?.name || 'Chapter'}</p>
                </div>
              </div>
              <button 
                onClick={() => setEditingChapterId(null)}
                className="p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto pr-2 pb-2 flex-1 min-h-0 space-y-5 custom-scrollbar">
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1 select-none">
                  Chapter Name
                </label>
                <input
                  type="text"
                  value={editedFields.name}
                  onChange={(e) => setEditedFields({ ...editedFields, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl px-4 py-3.5 text-sm text-slate-850 font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                  placeholder="E.g. Selangor Chapter"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1 select-none">
                  Motto / Sub-headline
                </label>
                <input
                  type="text"
                  value={editedFields.subText}
                  onChange={(e) => setEditedFields({ ...editedFields, subText: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl px-4 py-3.5 text-sm text-slate-850 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                  placeholder="E.g. United and Driven"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1 select-none">
                  Meetup Routine
                </label>
                <input
                  type="text"
                  value={editedFields.meetupRoutine}
                  onChange={(e) => setEditedFields({ ...editedFields, meetupRoutine: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl px-4 py-3.5 text-sm text-slate-850 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                  placeholder="E.g. Monthly meetup on Sunday mornings"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1 select-none">
                  Active Member Plate Number
                </label>
                <input
                  type="text"
                  value={editedFields.activeMemberPlate}
                  onChange={(e) => setEditedFields({ ...editedFields, activeMemberPlate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl px-4 py-3.5 text-sm text-slate-850 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-sm"
                  placeholder="E.g. VCD 8834"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-5 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setEditingChapterId(null)}
                disabled={isSavingInline}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold h-[52px] rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer transition active:scale-95 select-none"
              >
                <X className="w-5 h-5 shrink-0" />
                <span>Cancel</span>
              </button>
              <button
                onClick={() => {
                  const chapterItem = chaptersList.find(c => c.id === editingChapterId);
                  if (chapterItem) handleSaveInlineEdit(chapterItem);
                }}
                disabled={isSavingInline}
                className="flex-[2] bg-[#0f2d52] hover:bg-[#001835] text-white font-extrabold h-[52px] rounded-xl flex items-center justify-center gap-2 text-sm cursor-pointer transition active:scale-95 shadow-md disabled:opacity-50 select-none"
              >
                <Check className="w-5 h-5 shrink-0" />
                <span>{isSavingInline ? 'Saving Changes...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
