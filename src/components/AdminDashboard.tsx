import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Search, 
  ArrowRight, 
  X, 
  Info, 
  AlertTriangle,
  UserCog,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck as ShieldCheckIcon,
  Ban,
  UserCheck,
  Map,
  Check,
  QrCode,
  BarChart3,
  Users,
  ExternalLink,
  Trophy,
  Gift,
  Award,
  Store
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, updateDoc, deleteDoc, writeBatch, collection, getDocs, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SyncedUserProfile, formatMvocId, forceSyncAllUsers, calculateEffectiveXP } from '../lib/fetchAndSyncData';
import ChapterAnalytics from './ChapterAnalytics';
import QREventScanner from './QREventScanner';


const MASTER_ADMIN_ID = 'MVOC-0001';
const MASTER_EMAIL = 'nikazfar@gmail.com';

interface AdminDashboardProps {
  membersList: SyncedUserProfile[];
  chaptersList?: any[];
  isFetchingUsers: boolean;
  isMigratingIds: boolean;
  isFlushingUsers: boolean;
  handleMigrateMvocIds: () => Promise<void>;
  handleFlushUsersExceptAdmin: () => Promise<void>;
  fetchFirestoreUsers: () => Promise<void>;
  handleUpdateMemberRole: (targetUser: SyncedUserProfile, newRole: 'super_admin' | 'admin' | 'member') => Promise<void>;
  handleUpdateMemberTier: (targetUser: SyncedUserProfile, newTier: 'GOLD' | 'STANDARD') => Promise<void>;
  handleUpdateMemberStatus?: (targetUser: SyncedUserProfile, newStatus: 'active' | 'suspended' | 'banned') => Promise<void>;
  handleUpdateMemberPatch?: (targetUser: SyncedUserProfile, officialPatch: boolean) => Promise<void>;
  handleRunRewardsAudit?: () => Promise<void>;
  isAuditingRewards?: boolean;
  displayAvatarUrl: string;
  displayEmail: string;
  triggerToast: (msg: string, type: 'info' | 'success' | 'error') => void;
  onNavigateTab?: (tabName: string) => void;
  activeView?: 'members' | 'users';
  currentUserRole?: string;
  isMasterAdmin?: boolean;
  eventsList?: any[];
  appConfig?: any;
  onToggleModule?: any;
}

export default function AdminDashboard({
  membersList,
  chaptersList = [],
  isFetchingUsers,
  isMigratingIds,
  isFlushingUsers,
  handleMigrateMvocIds,
  handleFlushUsersExceptAdmin,
  fetchFirestoreUsers,
  handleUpdateMemberRole,
  handleUpdateMemberTier,
  handleUpdateMemberStatus,
  handleUpdateMemberPatch,
  handleRunRewardsAudit,
  isAuditingRewards = false,
  displayEmail,
  triggerToast,
  currentUserRole = 'member',
  isMasterAdmin = false,
  eventsList = []
}: AdminDashboardProps) {

  const isCurrentUserMasterAdmin = isMasterAdmin || currentUserRole === 'super_admin' || displayEmail.toLowerCase() === MASTER_EMAIL;

  // Helper method for authorization
  const isAdminOrSuperAdmin = () => {
    return currentUserRole === 'super_admin' || currentUserRole === 'admin' || displayEmail.toLowerCase() === MASTER_EMAIL;
  };

  // Search and Filter states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'super_admin' | 'admin' | 'member'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  
  // State to track role updates for immediate re-fetching
  const [lastRoleUpdate, setLastRoleUpdate] = useState<{ uid: string; role: string } | null>(null);

  React.useEffect(() => {
    if (lastRoleUpdate) {
      fetchFirestoreUsers().catch(console.error);
      setLastRoleUpdate(null);
    }
  }, [lastRoleUpdate, fetchFirestoreUsers]);

  // Guardrail confirmation modals states
  const [pendingUpdate, setPendingUpdate] = useState<{
    user: SyncedUserProfile;
    type: 'role' | 'status' | 'tier' | 'chapter';
    value: string;
  } | null>(null);
  const [isProcessingUpdate, setIsProcessingUpdate] = useState(false);

  // Safe delete guardrail states
  const [pendingDeleteUser, setPendingDeleteUser] = useState<SyncedUserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isProcessingDelete, setIsProcessingDelete] = useState(false);

  // Manual onboarding form modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [manageUserModalState, setManageUserModalState] = useState<{
    isOpen: boolean;
    user: SyncedUserProfile | null;
    status: 'active' | 'suspended' | 'banned' | 'pending' | 'deleted' | 'delete_requested';
    role: 'super_admin' | 'admin' | 'member';
    managedChapters: string[];
    name: string;
    shortName: string;
    mvocId: string;
    phoneNumber: string;
    vehiclePlate: string;
    bloodType: string;
    gender: string;
    joinDate: string;
    points: string;
    chapter: string;
  }>({
    isOpen: false,
    user: null,
    status: 'active',
    role: 'member',
    managedChapters: [],
    name: '',
    shortName: '',
    mvocId: '',
    phoneNumber: '',
    vehiclePlate: '',
    bloodType: 'Not Specified',
    gender: '',
    joinDate: '',
    points: '',
    chapter: 'Selangor Chapter'
  });
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMvocDigits, setNewMvocDigits] = useState('');
  const [newChapter, setNewChapter] = useState('Selangor Chapter');
  const [newTier, setNewTier] = useState<'GOLD' | 'STANDARD'>('STANDARD');
  const [newRole, setNewRole] = useState<'super_admin' | 'admin' | 'member'>('member');
  const [membersCurrentPage, setMembersCurrentPage] = useState(1);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'directory' | 'analytics' | 'leaderboard' | 'rewards' | 'scouts'>('directory');
  const [adminLeaderboard, setAdminLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [redemptionsList, setRedemptionsList] = useState<any[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [isRedeemConfirmOpen, setIsRedeemConfirmOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<{ id: number; name: string; cost: number } | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [merchantsList, setMerchantsList] = useState<any[]>([]);
  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [isApprovingMerchant, setIsApprovingMerchant] = useState<string | null>(null);

  const currentAdminUser = membersList.find(u => u.email.toLowerCase() === displayEmail.toLowerCase());

  const fetchAdminLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const eventsSnap = await getDocs(collection(db, 'events'));
      const convoysSnap = await getDocs(collection(db, 'convoys'));
      
      const eventCounts: Record<string, number> = {};
      const convoyCounts: Record<string, number> = {};
      
      eventsSnap.forEach(d => {
        const data = d.data();
        const creator = data.createdBy || data.creatorId;
        if (creator) {
          eventCounts[creator] = (eventCounts[creator] || 0) + 1;
        }
      });
      
      convoysSnap.forEach(d => {
        const data = d.data();
        const creator = data.createdBy || data.creatorId;
        if (creator) {
          convoyCounts[creator] = (convoyCounts[creator] || 0) + 1;
        }
      });
      
      const admins = membersList.filter(u => u.role === 'admin' || u.role === 'super_admin');
      const leaderboardData = admins.map(adm => {
        const evCount = eventCounts[adm.uid] || 0;
        const cvCount = convoyCounts[adm.uid] || 0;
        return {
          ...adm,
          eventsCreated: evCount,
          convoysCreated: cvCount,
          totalOrganized: evCount + cvCount
        };
      });
      
      leaderboardData.sort((a, b) => b.totalOrganized - a.totalOrganized);
      setAdminLeaderboard(leaderboardData);
    } catch (err) {
      console.error("Error loading admin leaderboard:", err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const fetchRedemptions = async () => {
    if (!currentAdminUser) return;
    setLoadingRedemptions(true);
    try {
      const redSnap = await getDocs(collection(db, 'redemptions'));
      const list: any[] = [];
      redSnap.forEach(d => {
        const data = d.data();
        if (data.userId === currentAdminUser.uid) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRedemptionsList(list);
    } catch (err) {
      console.error("Error loading redemptions:", err);
    } finally {
      setLoadingRedemptions(false);
    }
  };

  const fetchMerchants = async () => {
    setLoadingMerchants(true);
    try {
      const snap = await getDocs(collection(db, 'merchants'));
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0;
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0;
        return bTime - aTime;
      });
      setMerchantsList(list);
    } catch (err) {
      console.error("Error loading merchants:", err);
    } finally {
      setLoadingMerchants(false);
    }
  };

  const handleApproveMerchant = async (merchantId: string, registeredByAdminId: string) => {
    setIsApprovingMerchant(merchantId);
    try {
      await updateDoc(doc(db, 'merchants', merchantId), { status: 'active' });

      if (registeredByAdminId && registeredByAdminId !== 'system') {
        const userRef = doc(db, 'users', registeredByAdminId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentPoints = userSnap.data().points || 0;
          const nextPoints = currentPoints + 500;
          await updateDoc(userRef, { points: nextPoints });
          triggerToast(`Merchant verified! 500 XP awarded to ${userSnap.data().name || 'recruiter'}.`, 'success');
        } else {
          triggerToast('Merchant verified, but recruiter user ID not found in database.', 'warning');
        }
      } else {
        triggerToast('Merchant verified successfully.', 'success');
      }
      
      await fetchMerchants();
      await fetchFirestoreUsers();
    } catch (err: any) {
      triggerToast(`Failed to approve merchant: ${err.message || String(err)}`, 'error');
    } finally {
      setIsApprovingMerchant(null);
    }
  };

  useEffect(() => {
    if (activeAdminTab === 'leaderboard') {
      fetchAdminLeaderboard();
    } else if (activeAdminTab === 'rewards') {
      fetchRedemptions();
    } else if (activeAdminTab === 'scouts') {
      fetchMerchants();
    }
  }, [activeAdminTab, membersList]);

  const handleConfirmRedemption = async () => {
    if (!currentAdminUser || !selectedReward) return;
    setIsRedeeming(true);
    try {
      const userRef = doc(db, 'users', currentAdminUser.uid);
      const nextPoints = (currentAdminUser.points || 0) - selectedReward.cost;
      
      // Update points in users collection
      await updateDoc(userRef, { points: nextPoints });
      
      // Log to redemptions collection
      await addDoc(collection(db, 'redemptions'), {
        userId: currentAdminUser.uid,
        userName: currentAdminUser.name,
        userEmail: currentAdminUser.email,
        mvocId: currentAdminUser.mvocId,
        rewardId: selectedReward.id,
        rewardName: selectedReward.name,
        xpDeducted: selectedReward.cost,
        timestamp: new Date().toISOString(),
        status: 'pending'
      });
      
      triggerToast(`Berjaya menebus "${selectedReward.name}"! (-${selectedReward.cost} XP)`, 'success');
      
      setIsRedeemConfirmOpen(false);
      setSelectedReward(null);
      
      // Refresh the directory list of users to sync locally
      await fetchFirestoreUsers();
      await fetchRedemptions();
    } catch (err: any) {
      triggerToast(`Gagal menebus ganjaran: ${err.message || String(err)}`, 'error');
    } finally {
      setIsRedeeming(false);
    }
  };




  const handleForceSync = async () => {
    setIsSyncingAll(true);
    try {
      const count = await forceSyncAllUsers(db);
      triggerToast(`Successfully synced ${count} users!`, 'success');
      await fetchFirestoreUsers();
    } catch (err: any) {
      triggerToast(`Sync failed: ${err.message}`, 'error');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Chapters list for easy selectors
  const CHAPTER_NAMES = [
    'Selangor Chapter',
    'Kuala Lumpur Chapter',
    'Johor Chapter',
    'Penang Chapter',
    'Perak Chapter',
    'East Coast Chapter (Kelantan/Terengganu/Pahang)',
    'East Malaysia Chapter (Sabah/Sarawak)'
  ];

  // Helper dynamic chapter updater to let admin change users' chapter on-the-fly
  const handleUpdateChapter = async (targetUser: SyncedUserProfile, nextChapter: string) => {
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { chapter: nextChapter });
      triggerToast(`Successfully reassigned ${targetUser.name} to ${nextChapter}!`, 'success');
      await fetchFirestoreUsers();
    } catch (e: any) {
      triggerToast(`Failed to update chapter assignment: ${e.message || String(e)}`, 'error');
    }
  };

  // Handler to toggle patch status for Super Admins
  const handleTogglePatchStatus = async (user: SyncedUserProfile) => {
    try {
      const nextPatch = !user.officialPatch;
      if (handleUpdateMemberPatch) {
        await handleUpdateMemberPatch(user, nextPatch);
      } else {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          officialPatch: nextPatch,
          patch_status: nextPatch
        });
        triggerToast(`Successfully ${nextPatch ? 'assigned' : 'removed'} Official Admin Patch for ${user.name}!`, 'success');
        await fetchFirestoreUsers();
      }
    } catch (err: any) {
      if (err.message?.includes('Permission Denied') || err.message?.includes('permission-denied') || err.code === 'permission-denied') {
        console.error("Permission Denied: Super Admin lacked authorization in firestore.rules to modify the patch field:", err);
      } else {
        console.error("Error occurred during patch update:", err);
      }
      triggerToast(`Failed to update patch status: ${err.message || String(err)}`, 'error');
    }
  };

  // Handler to suspend/unsuspend user status using updateDoc
  const handleSuspend = async (targetUser: SyncedUserProfile, newStatus: 'active' | 'suspended' | 'banned') => {
    try {
      if (handleUpdateMemberStatus) {
        await handleUpdateMemberStatus(targetUser, newStatus);
      } else {
        const userRef = doc(db, 'users', targetUser.uid);
        await updateDoc(userRef, { status: newStatus });
        triggerToast(`Successfully set ${targetUser.name}'s status to ${newStatus.toUpperCase()}!`, 'success');
        await fetchFirestoreUsers();
      }
    } catch (err: any) {
      if (err.message?.includes('Permission Denied') || err.message?.includes('permission-denied') || err.code === 'permission-denied') {
        console.error("Permission Denied: Admin/Super Admin lacked authorization in firestore.rules to modify the status field:", err);
      } else {
        console.error("Error occurred during status update:", err);
      }
      triggerToast(`Failed to update status: ${err.message || String(err)}`, 'error');
      throw err;
    }
  };

  // User tab filtering logic
  // Reset pagination when search or filters change
  useEffect(() => {
    setMembersCurrentPage(1);
  }, [userSearchQuery, roleFilter, statusFilter]);

  const filteredUsers = membersList.filter(u => {
    // 1. Filter by role attribute
    if (roleFilter !== 'all') {
      if (u.role !== roleFilter) return false;
    }

    // 2. Filter by status attribute (suspended / banned counts as suspended)
    if (statusFilter !== 'all') {
      const isSuspended = u.status === 'suspended' || u.status === 'banned';
      if (statusFilter === 'active' && isSuspended) return false;
      if (statusFilter === 'suspended' && !isSuspended) return false;
    }

    // 3. Filter by search query
    const search = userSearchQuery.toLowerCase().trim();
    if (!search) return true;
    return (
      (u.name || '').toLowerCase().includes(search) ||
      (u.email || '').toLowerCase().includes(search) ||
      (u.mvocId || '').toLowerCase().includes(search) ||
      (u.chapter || '').toLowerCase().includes(search)
    );
  });

  const adminList = filteredUsers.filter(u => u.role === 'super_admin' || u.role === 'admin');
  const memberList = filteredUsers.filter(u => u.role === 'member' || (!['super_admin', 'admin'].includes(u.role)));
  
  const currentAdminChapters: string[] = useMemo(() => {
    if (!currentAdminUser) return [];
    if (Array.isArray(currentAdminUser.managedChapter)) {
      return currentAdminUser.managedChapter;
    }
    if (currentAdminUser.managedChapter) {
      return [currentAdminUser.managedChapter];
    }
    return currentAdminUser.chapter ? [currentAdminUser.chapter] : [];
  }, [currentAdminUser]);

  const merchantScoutsLeaderboard = useMemo(() => {
    const scoutCounts: Record<string, number> = {};
    merchantsList.forEach(m => {
      if (m.status === 'active' && m.registered_by_admin_id) {
        scoutCounts[m.registered_by_admin_id] = (scoutCounts[m.registered_by_admin_id] || 0) + 1;
      }
    });

    const admins = membersList.filter(u => u.role === 'admin' || u.role === 'super_admin');
    const leaderboard = admins.map(adm => {
      const count = scoutCounts[adm.uid] || 0;
      return {
        ...adm,
        merchantsScouted: count
      };
    });

    leaderboard.sort((a, b) => b.merchantsScouted - a.merchantsScouted);
    return leaderboard;
  }, [merchantsList, membersList]);
  
  const pendingMembersList = membersList.filter(u => 
    u.status === 'pending' && 
    (currentUserRole === 'super_admin' || displayEmail.toLowerCase() === MASTER_EMAIL || currentAdminChapters.includes(u.chapter))
  );

  // Handle adding new member explicitly to Firestore and local state
  const handleAddNewMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newMvocDigits.trim()) {
      triggerToast('Please complete all required fields.', 'error');
      return;
    }

    try {
      setIsAddingMember(true);
      
      const formattedId = formatMvocId(newMvocDigits);
      const randomId = 'mvoc_gen_' + Math.random().toString(36).substring(2, 11);
      
      const newMemberProfile: SyncedUserProfile = {
        uid: randomId,
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        mvocId: formattedId,
        chapter: newChapter,
        tier: newTier,
        role: newRole,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const userRef = doc(db, 'users', randomId);
      await setDoc(userRef, newMemberProfile);

      triggerToast(`Successfully registered ${newName} as ${formattedId}!`, 'success');
      
      // Reset state and close modal
      setNewName('');
      setNewEmail('');
      setNewMvocDigits('');
      setNewChapter('Selangor Chapter');
      setNewTier('STANDARD');
      setNewRole('member');
      setIsAddModalOpen(false);

      // Reload live directory
      await fetchFirestoreUsers();
    } catch (err: any) {
      triggerToast(`Failed to add user: ${err.message || String(err)}`, 'error');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleSaveUserManagement = async () => {
    if (!manageUserModalState.user) return;
    const targetUser = manageUserModalState.user;
    
    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', targetUser.uid);
      const adminRef = doc(db, 'Admin', targetUser.uid);

      const updates: any = {
        status: manageUserModalState.status,
      };

      let pendingRoleUpgrade = false;

      if (!isCurrentUserMasterAdmin && manageUserModalState.role !== targetUser.role && (manageUserModalState.role === 'admin' || manageUserModalState.role === 'super_admin')) {
        pendingRoleUpgrade = true;
        updates.roleRequest = {
          role: manageUserModalState.role,
          requestedBy: displayEmail,
          requestedAt: new Date().toISOString()
        };
      } else {
        updates.role = manageUserModalState.role;
        updates.roleRequest = null;
      }

      if (currentUserRole === 'super_admin' || displayEmail.toLowerCase() === MASTER_EMAIL) {
        if (manageUserModalState.name) updates.name = manageUserModalState.name;
        if (manageUserModalState.shortName !== undefined) updates.shortName = manageUserModalState.shortName;
        if (manageUserModalState.mvocId) updates.mvocId = formatMvocId(manageUserModalState.mvocId);
        if (manageUserModalState.phoneNumber !== undefined) updates.phoneNumber = manageUserModalState.phoneNumber;
        if (manageUserModalState.vehiclePlate !== undefined) updates.vehiclePlate = manageUserModalState.vehiclePlate;
        if (manageUserModalState.bloodType) updates.bloodType = manageUserModalState.bloodType;
        if (manageUserModalState.gender !== undefined) updates.gender = manageUserModalState.gender;
        if (manageUserModalState.joinDate !== undefined) updates.joinDate = manageUserModalState.joinDate;
        if (manageUserModalState.points !== undefined) updates.points = parseInt(manageUserModalState.points, 10) || 0;
        if (manageUserModalState.chapter !== undefined) updates.chapter = manageUserModalState.chapter;
      }

      const oldChapters: string[] = Array.isArray(targetUser.managedChapter)
        ? targetUser.managedChapter
        : (targetUser.managedChapter ? [targetUser.managedChapter] : []);

      if (manageUserModalState.role === 'admin') {
        updates.managedChapter = manageUserModalState.managedChapters;
      } else {
        updates.managedChapter = null; // Remove managed_chapter if demoted
      }

      // Update user doc in batch
      batch.update(userRef, updates);

      // Automated Database Sorting logic
      if (!pendingRoleUpgrade) {
        if (manageUserModalState.role === 'admin' || manageUserModalState.role === 'super_admin') {
          batch.set(adminRef, {
            email: targetUser.email,
            name: updates.name || targetUser.name,
            mvocId: updates.mvocId || targetUser.mvocId,
            role: manageUserModalState.role,
            managedChapter: updates.managedChapter || null,
            accessLevel: 'Full Access'
          }, { merge: true });
        } else {
          // Only delete if they are not the Master Admin
          if (targetUser.mvocId !== MASTER_ADMIN_ID && targetUser.email.toLowerCase() !== MASTER_EMAIL) {
            batch.delete(adminRef);
          }
        }
      }

      // Chapter sync logic
      if (chaptersList && chaptersList.length > 0) {
        const newChapters = manageUserModalState.role === 'admin' ? manageUserModalState.managedChapters : [];

        // Helper to find chapter safely by checking both name and subText
        const findChapterByName = (chapName: string) => {
          return chaptersList.find(c => {
            const search = chapName.toLowerCase().replace('w.p.', '').trim();
            return (c.name && c.name.toLowerCase().includes(search)) || 
                   (c.subText && c.subText.toLowerCase().includes(search));
          });
        };

        // 1. Clear adminId for chapters that were managed but are no longer managed
        const removedChapters = oldChapters.filter(ch => !newChapters.includes(ch));
        for (const chapName of removedChapters) {
          const chObj = findChapterByName(chapName);
          if (chObj) {
            const chapRef = doc(db, 'chapters', String(chObj.id));
            batch.update(chapRef, { adminId: '', leadName: '' });
          }
        }

        // 2. Set adminId and leadName for ALL currently managed chapters (to force sync any missing data)
        for (const chapName of newChapters) {
          const chObj = findChapterByName(chapName);
          if (chObj) {
            const chapRef = doc(db, 'chapters', String(chObj.id));
            batch.update(chapRef, { adminId: targetUser.uid, leadName: updates.name || targetUser.name });
          }
        }
      }

      await batch.commit();

      if (pendingRoleUpgrade) {
        triggerToast('Permohonan menaik taraf dihantar kepada Master Admin untuk kelulusan.', 'info');
      } else if (manageUserModalState.role === 'admin' || manageUserModalState.role === 'super_admin') {
        triggerToast('User promoted! Database organized automatically.', 'success');
      } else {
        triggerToast(`Successfully updated user ${targetUser.name}!`, 'success');
      }

      setManageUserModalState(prev => ({ ...prev, isOpen: false }));
      await fetchFirestoreUsers();
    } catch (e: any) {
      triggerToast(`Failed to update user: ${e.message || String(e)}`, 'error');
    }
  };

  const renderUserTable = (
    usersList: SyncedUserProfile[], 
    emptyMessage: string, 
    tableTitle: string, 
    emoji: string,
    pagination?: { current: number; set: (p: number) => void; limit: number }
  ) => {
    const totalPages = pagination ? Math.max(1, Math.ceil(usersList.length / pagination.limit)) : 1;
    const displayList = pagination 
      ? usersList.slice((pagination.current - 1) * pagination.limit, pagination.current * pagination.limit)
      : usersList;

    return (
      <div className="mb-8">
        <h3 className="flex items-center gap-2 text-[#0f2d52] font-display font-extrabold text-lg mb-3">
          <span className="text-xl">{emoji}</span>
          {tableTitle} 
          <span className="ml-1 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{usersList.length}</span>
        </h3>
        <div className={`w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white ${emoji === '👑' ? 'ring-1 ring-amber-200/50' : ''}`}>
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-[#f8f9ff] border-b border-slate-200 text-slate-500 h-[38px] select-none">
                <th className="py-1 px-3 text-[10px] font-extrabold uppercase tracking-widest w-[16%]">Name</th>
                <th className="py-1 px-3 text-[10px] font-extrabold uppercase tracking-widest w-[18%]">Nickname</th>
                <th className="py-1 px-3 text-[10px] font-extrabold uppercase tracking-widest w-[14%]">MVOC ID</th>
                <th className="py-1 px-3 text-[10px] font-extrabold uppercase tracking-widest w-[16%]">Role</th>
                <th className="py-1 px-3 text-[10px] font-extrabold uppercase tracking-widest w-[10%]">Status</th>
                <th className="py-1 px-3 text-[10px] font-extrabold uppercase tracking-widest w-[16%]">Official Patch</th>
                <th className="py-1 px-3 text-[10px] font-extrabold uppercase tracking-widest text-right w-[10%]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center bg-slate-50/50">
                    <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">{emptyMessage}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Try altering your search or filters.</p>
                  </td>
                </tr>
              ) : (
                displayList.map((u, idx) => {
                  const isSelf = u.email.toLowerCase() === displayEmail.toLowerCase();
                  const isSuspended = u.status === 'suspended' || u.status === 'banned';
                  const isRowMasterAdmin = u.mvocId === MASTER_ADMIN_ID || u.email.toLowerCase() === MASTER_EMAIL;
                  return (
                    <tr 
                      key={u.uid || idx} 
                      className={`hover:bg-[#f8f9ff]/50 transition-colors h-[42px] ${isSelf ? 'bg-indigo-50/15' : ''}`}
                    >
                      {/* Column 1: Name */}
                      <td className="py-1 px-3 truncate">
                        <div className="flex items-center gap-1.5 max-w-full">
                          <button 
                            type="button"
                            onClick={() => {
                              if (currentUserRole === 'super_admin' || displayEmail.toLowerCase() === MASTER_EMAIL || currentUserRole === 'admin') {
                                setManageUserModalState({
                                  isOpen: true,
                                  user: u,
                                  status: u.status || 'active',
                                  role: u.role || 'member',
                                  managedChapters: Array.isArray(u.managedChapter) 
                                    ? u.managedChapter 
                                    : (u.managedChapter ? [u.managedChapter] : []),
                                  name: u.name || '',
                                  shortName: u.shortName || '',
                                  mvocId: u.mvocId || '',
                                  phoneNumber: u.phoneNumber || '',
                                  vehiclePlate: u.vehiclePlate || '',
                                  bloodType: u.bloodType || 'Not Specified',
                                  gender: (u as any).gender || '',
                                  joinDate: u.joinDate || '12 January 2021',
                                  points: u.points?.toString() || '30',
                                  chapter: u.chapter || 'Zone Klang Valley'
                                });
                              }
                            }}
                            className="font-extrabold text-slate-900 text-xs tracking-tight truncate hover:text-indigo-600 transition-colors text-left cursor-pointer focus:outline-none focus:underline"
                          >
                            {u.name}
                          </button>
                          {isSelf && (
                            <span className="shrink-0 px-1 py-0.5 bg-indigo-50 bg-opacity-80 border border-indigo-200 text-[8px] font-extrabold text-indigo-750 uppercase rounded tracking-wide">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 2: Nickname */}
                      <td className="py-1 px-3 truncate">
                        <span className="text-[11px] text-slate-500 font-extrabold tracking-wide truncate block">
                          {u.shortName || '-'}
                        </span>
                      </td>

                      {/* Column 3: MVOC ID */}
                      <td className="py-1 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded text-[10px] font-bold font-mono tracking-wide uppercase">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {formatMvocId(u.mvocId)}
                        </span>
                      </td>

                      {/* Column 4: Role */}
                      <td className="py-1 px-3">
                        <div className="flex items-center gap-2">
                          {!isRowMasterAdmin ? (
                            <>
                              <div className="flex flex-col">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const roles: ('member' | 'admin' | 'super_admin')[] = ['member', 'admin', 'super_admin'];
                                    const currentIdx = roles.indexOf(u.role || 'member');
                                    const nextRole = roles[(currentIdx + 1) % roles.length];
                                    setPendingUpdate({
                                      user: u,
                                      type: 'role',
                                      value: nextRole
                                    });
                                  }}
                                  disabled={(isSelf && u.role === 'super_admin') || (!isCurrentUserMasterAdmin && (u.role === 'super_admin' || u.role === 'admin'))}
                                  className="text-[10px] font-bold uppercase text-slate-700 tracking-wider text-left hover:text-[#0f2d52] hover:bg-slate-100 p-1 -ml-1 rounded transition disabled:opacity-80 disabled:pointer-events-none"
                                  title="Tukar status/jawatan (Click to change role)"
                                >
                                  {u.role === 'super_admin' ? '⚡ SUPER ADMIN' : u.role === 'admin' ? '👮 OFFICER' : '👤 MEMBER'}
                                </button>
                                {u.roleRequest && (
                                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0 w-fit">
                                    PENDING {u.roleRequest.role === 'super_admin' ? 'SUPER ADMIN' : 'OFFICER'}
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                disabled={isSelf || (!isCurrentUserMasterAdmin && (u.role === 'super_admin' || u.role === 'admin'))}
                                onClick={() => {
                                  setPendingDeleteUser(u);
                                  setDeleteConfirmText('');
                                }}
                                className="p-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none shrink-0"
                                title={`Delete user account for ${u.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-black text-amber-600 px-2.5 py-1 bg-amber-50 rounded-md border border-amber-200 uppercase tracking-wider">
                              👑 MASTER ADMIN
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Status */}
                      <td className="py-1 px-3 mt-1 inline-block">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black uppercase tracking-wider select-none ${
                            isSuspended ? 'text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100' : 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100'
                          }`}>
                            {isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </div>
                      </td>

                      {/* Column 5.5: Official Patch */}
                      <td className="py-1 px-3">
                        {!isRowMasterAdmin ? (
                          (currentUserRole === 'super_admin' || displayEmail.toLowerCase() === MASTER_EMAIL) ? (
                            <div className="flex items-center gap-1.5 select-none text-left">
                              <input
                                type="checkbox"
                                checked={u.officialPatch === true}
                                onChange={() => handleTogglePatchStatus(u)}
                                className="w-4 h-4 rounded border-slate-350 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                id={`patch-checkbox-${u.uid}`}
                              />
                              <span className={`text-[8.5px] font-black uppercase tracking-wider select-none ${
                                u.officialPatch ? 'text-emerald-605' : 'text-slate-400'
                              }`}>
                                {u.officialPatch ? 'OFFICIAL PATCH' : 'NO PATCH'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-widest select-none">
                              -
                            </span>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5 select-none text-left">
                            <span className="inline-flex items-center bg-emerald-500 text-[#030914] font-black text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-md select-none font-sans">
                              ★ OFFICIAL PATCH
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Column 6: Actions */}
                      <td className="py-1 px-3 text-right">
                        {!isRowMasterAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const roles: ('member' | 'admin' | 'super_admin')[] = ['member', 'admin', 'super_admin'];
                                const currentIdx = roles.indexOf(u.role || 'member');
                                const nextRole = roles[(currentIdx + 1) % roles.length];
                                setPendingUpdate({
                                  user: u,
                                  type: 'role',
                                  value: nextRole
                                });
                              }}
                              disabled={(isSelf && u.role === 'super_admin') || (!isCurrentUserMasterAdmin && (u.role === 'super_admin' || u.role === 'admin'))}
                              title={`Change authorization level role from ${u.role || 'member'}`}
                              className="p-1 text-slate-400 hover:text-[#0f2d52] hover:bg-slate-100 rounded transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                            >
                              <UserCog className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const nextStatus = isSuspended ? 'active' : 'suspended';
                                setPendingUpdate({
                                  user: u,
                                  type: 'status',
                                  value: nextStatus
                                });
                              }}
                              disabled={isSelf}
                              title={isSuspended ? "Unban user" : "Ban user"}
                              className={`p-1 rounded transition cursor-pointer disabled:opacity-30 disabled:pointer-events-none ${
                                isSuspended 
                                  ? 'text-[#f43f5e] hover:bg-rose-50' 
                                  : 'text-slate-400 hover:text-red-650 hover:bg-rose-950/10'
                              }`}
                            >
                              {isSuspended ? (
                                <UserCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Ban className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[9px] text-amber-600 font-extrabold select-none uppercase tracking-widest block pr-2">
                            SECURED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500">
              Showing {(pagination.current - 1) * pagination.limit + 1} to {Math.min(pagination.current * pagination.limit, usersList.length)} of {usersList.length} members
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => pagination.set(Math.max(1, pagination.current - 1))}
                disabled={pagination.current === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="text-[11px] font-extrabold text-[#0f2d52] min-w-[3rem] text-center">
                {pagination.current} / {totalPages}
              </span>
              <button
                onClick={() => pagination.set(Math.min(totalPages, pagination.current + 1))}
                disabled={pagination.current === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 text-[#0b1c30] font-sans pb-16">
      
      {/* Contextual Header section */}
      <section className="p-6 bg-[#0f2d52] rounded-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9px] tracking-wider uppercase font-black bg-[#001b3b]/60 text-[#adc8f5] border border-[#adc8f5]/20 rounded-md">
              Super Admin Control
            </span>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SYNCHRONIZED WITH FIRESTORE</span>
            </div>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase">
            User Access Management Center
          </h2>
          <p className="text-xs md:text-sm text-[#d3e4fe] max-w-3xl leading-relaxed font-semibold">
            Administer credential hierarchies, toggle access block status registers, assign membership tiers, and audit active operator roles securely in real-time.
          </p>
        </div>

        {isAdminOrSuperAdmin() && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-white text-[#0f2d52] hover:bg-[#eff4ff] hover:text-[#001835] px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition active:scale-95 shrink-0 flex items-center gap-1.5 cursor-pointer border border-[#c4c6cf]/20"
          >
            <Plus className="w-4 h-4 text-[#0f2d52]" />
            Manual Onboarding
          </button>
        )}
      </section>



      {/* Sub-tab Navigation Bar */}
      <div className="flex flex-wrap bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 shadow-sm max-w-3xl gap-1">
        <button
          onClick={() => setActiveAdminTab('directory')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-black rounded-xl transition-all cursor-pointer min-w-[120px] ${
            activeAdminTab === 'directory'
              ? 'bg-[#0f2d52] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('analytics')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-black rounded-xl transition-all cursor-pointer min-w-[120px] ${
            activeAdminTab === 'analytics'
              ? 'bg-[#0f2d52] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Chapter Analytics</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('leaderboard')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-black rounded-xl transition-all cursor-pointer min-w-[120px] ${
            activeAdminTab === 'leaderboard'
              ? 'bg-[#0f2d52] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Admin Leaderboard</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('rewards')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-black rounded-xl transition-all cursor-pointer min-w-[120px] ${
            activeAdminTab === 'rewards'
              ? 'bg-[#0f2d52] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Admin Rewards</span>
        </button>
        <button
          onClick={() => setActiveAdminTab('scouts')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-black rounded-xl transition-all cursor-pointer min-w-[120px] ${
            activeAdminTab === 'scouts'
              ? 'bg-[#0f2d52] text-white shadow-md'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Merchant Scouts</span>
        </button>
      </div>

      {activeAdminTab === 'analytics' && (
        <ChapterAnalytics 
          members={membersList} 
          chapter={currentAdminChapters} 
        />
      )}

      {activeAdminTab === 'leaderboard' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Card */}
          <div className="bg-[#0f2d52] p-6 rounded-3xl text-white shadow-md relative overflow-hidden border border-white/10">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-amber-400 rounded-full mix-blend-multiply filter blur-[60px] opacity-25"></div>
            <div className="relative z-10 space-y-1">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest">Prestasi & Pengaruh Pentadbir</h3>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Admin Leaderboard</h2>
              <p className="text-xs md:text-sm text-slate-200 font-semibold max-w-2xl leading-normal">
                Senarai ranking admin mengikut jumlah acara (Events & Convoys) rasmi yang telah dianjurkan di bawah sistem MVOC.
              </p>
            </div>
          </div>

          {/* Top 3 Trophies Grid */}
          {!loadingLeaderboard && adminLeaderboard.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Rank 2 (Second Place) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm text-center flex flex-col justify-between items-center relative order-2 md:order-1">
                <div className="absolute top-3 left-3 bg-slate-100 text-slate-700 w-6 h-6 rounded-full font-black text-xs flex items-center justify-center border border-slate-200">2</div>
                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-slate-300 shadow-md mb-3">
                  <img src={adminLeaderboard[1].photoURL || "https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png"} alt={adminLeaderboard[1].name} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Silver Organizer</h4>
                  <h3 className="font-black text-sm text-[#0b1c30] mt-0.5">{adminLeaderboard[1].name}</h3>
                  <span className="text-[10px] text-slate-400 font-bold font-mono tracking-tight block mt-0.5">{adminLeaderboard[1].mvocId}</span>
                </div>
                <div className="mt-4 bg-slate-105 border border-slate-200 text-slate-750 px-4 py-2 rounded-2xl flex items-center gap-1.5 shadow-inner">
                  <Trophy className="w-4 h-4 text-slate-400" />
                  <span className="font-black text-base font-mono">{adminLeaderboard[1].totalOrganized}</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Organized</span>
                </div>
              </div>

              {/* Rank 1 (Winner) */}
              <div className="bg-gradient-to-b from-amber-50 to-white border-2 border-amber-300 rounded-3xl p-6 shadow-md text-center flex flex-col justify-between items-center relative order-1 md:order-2 scale-105">
                <div className="absolute -top-4 bg-amber-400 text-[#0f2d52] w-8 h-8 rounded-full font-black text-sm flex items-center justify-center border-2 border-white shadow-md animate-bounce">1</div>
                <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-amber-400 shadow-md mb-3 mt-2">
                  <img src={adminLeaderboard[0].photoURL || "https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png"} alt={adminLeaderboard[0].name} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                </div>
                <div>
                  <h4 className="font-black text-xs text-amber-700 uppercase tracking-widest flex items-center gap-1 justify-center">
                    <Trophy className="w-3.5 h-3.5 fill-amber-500 text-amber-600" /> Gold Organizer
                  </h4>
                  <h3 className="font-black text-base text-[#0b1c30] mt-0.5">{adminLeaderboard[0].name}</h3>
                  <span className="text-[10px] text-amber-600 font-bold font-mono tracking-tight block mt-0.5">{adminLeaderboard[0].mvocId}</span>
                </div>
                <div className="mt-4 bg-amber-400 text-[#0f2d52] px-6 py-2 rounded-2xl flex items-center gap-1.5 shadow-md">
                  <Trophy className="w-4.5 h-4.5 fill-[#0f2d52] text-[#0f2d52]" />
                  <span className="font-black text-lg font-mono">{adminLeaderboard[0].totalOrganized}</span>
                  <span className="text-[9px] font-black uppercase">Organized</span>
                </div>
              </div>

              {/* Rank 3 (Third Place) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm text-center flex flex-col justify-between items-center relative order-3 md:order-3">
                <div className="absolute top-3 left-3 bg-[#fdf6f0] text-[#8c521f] w-6 h-6 rounded-full font-black text-xs flex items-center justify-center border border-orange-200">3</div>
                <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-orange-200 shadow-md mb-3">
                  <img src={adminLeaderboard[2].photoURL || "https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png"} alt={adminLeaderboard[2].name} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs text-orange-700 uppercase tracking-wider">Bronze Organizer</h4>
                  <h3 className="font-black text-sm text-[#0b1c30] mt-0.5">{adminLeaderboard[2].name}</h3>
                  <span className="text-[10px] text-slate-400 font-bold font-mono tracking-tight block mt-0.5">{adminLeaderboard[2].mvocId}</span>
                </div>
                <div className="mt-4 bg-orange-50 border border-orange-100 text-orange-800 px-4 py-2 rounded-2xl flex items-center gap-1.5 shadow-inner">
                  <Trophy className="w-4 h-4 text-orange-400 animate-pulse" />
                  <span className="font-black text-base font-mono">{adminLeaderboard[2].totalOrganized}</span>
                  <span className="text-[9px] font-bold text-orange-700 uppercase">Organized</span>
                </div>
              </div>
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-6">
            <h3 className="text-[#0f2d52] font-black text-base uppercase tracking-tight flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              Administrative Rankings Board
            </h3>
            
            {loadingLeaderboard ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-8 h-8 rounded-full border-4 border-slate-100 border-t-amber-500 animate-spin" />
                <p className="text-xs text-slate-400 font-bold">Mengira statistik anjuran pentadbir...</p>
              </div>
            ) : adminLeaderboard.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200/50">
                <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Tiada Rekod Dijumpai</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-[#f8f9ff] border-b border-slate-200 text-slate-500 h-[38px] select-none text-[10px] font-extrabold uppercase tracking-widest">
                      <th className="py-1 px-4 text-center w-[8%]">Rank</th>
                      <th className="py-1 px-3 w-[30%]">Administrator</th>
                      <th className="py-1 px-3 w-[20%]">Chapter</th>
                      <th className="py-1 px-3 text-center w-[12%]">Events</th>
                      <th className="py-1 px-3 text-center w-[12%]">Convoys</th>
                      <th className="py-1 px-4 text-right w-[18%]">Total Organized</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                    {adminLeaderboard.map((adm, idx) => {
                      const points = adm.points || 0;
                      const adminBadge = points >= 600 ? 'Gold' : points >= 200 ? 'Silver' : 'Bronze';
                      return (
                        <tr key={adm.uid} className={`hover:bg-[#f8f9ff]/50 transition-colors h-[46px] ${idx < 3 ? 'bg-[#fbfcfe]/30' : ''}`}>
                          <td className="py-1 px-4 text-center">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black font-mono ${
                              idx === 0 ? 'bg-amber-400 text-[#0f2d52] border border-amber-300' :
                              idx === 1 ? 'bg-slate-200 text-slate-800 border border-slate-300' :
                              idx === 2 ? 'bg-[#fdf6f0] text-orange-850 border border-orange-200' :
                              'text-slate-505'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="py-1 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-200 shrink-0">
                                <img src={adm.photoURL || "https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png"} alt={adm.name} className="w-full h-full object-cover" referrerpolicy="no-referrer" />
                              </div>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[#0b1c30] text-xs font-black truncate max-w-[150px]">{adm.name}</span>
                                  <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded leading-none select-none border ${
                                    adminBadge === 'Gold' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    adminBadge === 'Silver' ? 'bg-slate-550 text-slate-700 border-slate-300' :
                                    'bg-orange-50 text-orange-800 border-orange-200'
                                  }`}>
                                    {adminBadge} Badge
                                  </span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono font-bold tracking-tight block">{adm.mvocId}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-1 px-3 text-slate-500 font-medium">
                            {adm.chapter || 'National'}
                          </td>
                          <td className="py-1 px-3 text-center font-mono text-slate-650">
                            {adm.eventsCreated}
                          </td>
                          <td className="py-1 px-3 text-center font-mono text-slate-650">
                            {adm.convoysCreated}
                          </td>
                          <td className="py-1 px-4 text-right pr-6">
                            <span className="inline-flex items-center justify-center px-3 py-1 bg-[#eff4ff] border border-blue-150 rounded-xl font-black font-mono text-sm text-[#0f2d52] shadow-sm">
                              {adm.totalOrganized}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeAdminTab === 'rewards' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Panel */}
          <div className="bg-[#0f2d52] p-6 rounded-3xl text-white shadow-md relative overflow-hidden border border-white/10">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-emerald-400 rounded-full mix-blend-multiply filter blur-[60px] opacity-25"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Admin Excellence Rewards</h3>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Ganjaran Pentadbir</h2>
                <p className="text-xs md:text-sm text-slate-200 font-semibold max-w-2xl leading-normal">
                  Tebus mata ganjaran XP (Points) yang anda perolehi daripada penganjuran acara dan konvoi rasmi dengan barangan eksklusif MVOC.
                </p>
              </div>
              {currentAdminUser && (
                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex flex-col items-center justify-center shrink-0 min-w-[140px] text-center shadow-lg">
                  <span className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">MATA AKTIF ANDA</span>
                  <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight mt-1">
                    {currentAdminUser.points || 0}
                  </span>
                  <span className="text-[9px] text-slate-350 font-bold uppercase mt-1">XP Points</span>
                </div>
              )}
            </div>
          </div>

          {/* Rewards Grid */}
          <div className="space-y-4">
            <h3 className="text-[#0f2d52] font-black text-base uppercase tracking-tight flex items-center gap-2">
              <Gift className="w-5 h-5 text-emerald-500" />
              Redeemable Items (Kedai Ganjaran Admin)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { id: 1, name: 'Official MVOC Admin Polo Shirt', desc: 'Kemeja polo berkolar dry-fit eksklusif dengan sulaman logo MVOC Admin.', cost: 250, badge: 'Premium Wear' },
                { id: 2, name: 'Gold Windshield Sticker', desc: 'Stiker cermin pantulan metallic emas eksklusif Toyota Veloz Owners Club.', cost: 120, badge: 'Decal' },
                { id: 3, name: 'VIP Parking Pass at Next Mega Event', desc: 'Pas letak kenderaan keutamaan (VIP) di barisan hadapan semasa acara Mega kelab.', cost: 180, badge: 'Privilege' },
                { id: 4, name: 'Custom Admin Name Badge', desc: 'Lencana nama akrilik dengan pin magnetik terukir nama kustom anda.', cost: 80, badge: 'Accessory' },
                { id: 5, name: 'Petrol E-Voucher RM50', desc: 'E-voucher Petronas/Shell bernilai RM50 yang boleh digunakan terus di aplikasi rasmi.', cost: 500, badge: 'Voucher' }
              ].map(item => {
                const points = currentAdminUser?.points || 0;
                const canRedeem = points >= item.cost;
                return (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4 relative overflow-hidden group">
                    <div className="space-y-2">
                      <span className="inline-block bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-black uppercase px-2 py-0.5 rounded-full select-none">{item.badge}</span>
                      <h4 className="font-black text-sm text-[#0b1c30] group-hover:text-indigo-650 transition-colors">{item.name}</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400 font-bold uppercase">KOS PENEBUSAN</span>
                        <span className="font-black text-sm text-[#0f2d52] font-mono">{item.cost} XP</span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedReward(item);
                          setIsRedeemConfirmOpen(true);
                        }}
                        disabled={!canRedeem}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                          canRedeem
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer hover:scale-105 active:scale-95'
                            : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        }`}
                      >
                        {canRedeem ? 'Tebus' : 'XP Tidak Cukup'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Redemption History */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-6">
            <h3 className="text-[#0f2d52] font-black text-base uppercase tracking-tight flex items-center gap-2 mb-4">
              <RefreshCw className="w-4.5 h-4.5 text-indigo-500" />
              Personal Redemption History (Sejarah Penebusan)
            </h3>

            {loadingRedemptions ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="w-6 h-6 rounded-full border-4 border-slate-150 border-t-indigo-500 animate-spin" />
                <p className="text-xs text-slate-400 font-bold">Memuat turun sejarah penebusan...</p>
              </div>
            ) : redemptionsList.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200/50">
                <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Tiada Sejarah Penebusan</p>
                <p className="text-[10px] text-slate-500 mt-1">Anda belum menebus sebarang ganjaran setakat ini.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9ff] border-b border-slate-200 text-slate-500 h-[38px] select-none text-[10px] font-extrabold uppercase tracking-widest">
                      <th className="py-1 px-4 w-[40%]">Ganjaran (Item Name)</th>
                      <th className="py-1 px-3 text-center w-[15%]">XP Tebus</th>
                      <th className="py-1 px-3 w-[25%]">Tarikh Tebus (Date)</th>
                      <th className="py-1 px-4 text-right w-[20%]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                    {redemptionsList.map(red => (
                      <tr key={red.id} className="hover:bg-slate-50/50 transition-colors h-[40px]">
                        <td className="py-1 px-4 text-[#0b1c30]">{red.rewardName}</td>
                        <td className="py-1 px-3 text-center font-mono text-[#0f2d52]">{red.xpDeducted} XP</td>
                        <td className="py-1 px-3 text-slate-500 font-medium">
                          {new Date(red.timestamp).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-1 px-4 text-right pr-6">
                          <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            red.status === 'fulfilled'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-amber-50 text-amber-700 border border-amber-250 animate-pulse'
                          }`}>
                            {red.status === 'fulfilled' ? 'Selesai / Fulfilled' : 'Menunggu / Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeAdminTab === 'scouts' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Panel */}
          <div className="bg-[#0f2d52] p-6 rounded-3xl text-white shadow-md relative overflow-hidden border border-white/10">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-amber-400 rounded-full mix-blend-multiply filter blur-[60px] opacity-25"></div>
            <div className="relative z-10 space-y-1 text-left">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest">Penganalisaan & Pengesahan Rakan Niaga</h3>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight">Merchant Scouts</h2>
              <p className="text-xs md:text-sm text-slate-200 font-semibold max-w-2xl leading-normal">
                Urus dan sahkan rakan strategik (Merchant Partners) yang didaftarkan oleh admin serta lihat prestasi perekrutan.
              </p>
            </div>
          </div>

          {/* Top Merchant Scouts Leaderboard */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
            <h3 className="text-[#0f2d52] font-black text-base uppercase tracking-tight flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-amber-500" />
              Top Merchant Scouts Leaderboard
            </h3>
            
            {merchantScoutsLeaderboard.length === 0 ? (
              <div className="text-center py-6 text-slate-400 font-bold text-xs">Tiada data admin tersedia.</div>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9ff] border-b border-slate-200 text-slate-500 h-[38px] select-none text-[10px] font-extrabold uppercase tracking-widest">
                      <th className="py-1 px-4 w-[10%] text-center font-black">Kedudukan</th>
                      <th className="py-1 px-4 w-[40%] font-black">Nama Admin</th>
                      <th className="py-1 px-3 w-[25%] font-black">MVOC ID</th>
                      <th className="py-1 px-4 text-right w-[25%] pr-6 font-black">Jumlah Merchant Scouted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                    {merchantScoutsLeaderboard.map((adm, index) => {
                      const isTop3 = index < 3;
                      const trophyColors = ["text-amber-500 fill-amber-500", "text-slate-400 fill-slate-300", "text-orange-500 fill-orange-400"];
                      return (
                        <tr key={adm.uid} className="hover:bg-slate-50/50 transition-colors h-[44px]">
                          <td className="py-1 px-4 text-center">
                            {isTop3 ? (
                              <div className="flex items-center justify-center">
                                <Trophy className={`w-4 h-4 ${trophyColors[index]}`} />
                              </div>
                            ) : (
                              index + 1
                            )}
                          </td>
                          <td className="py-1 px-4 flex items-center gap-2.5 h-[44px]">
                            <img src={adm.photoURL || "https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png"} alt={adm.name} className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                            <span className="text-[#0b1c30]">{adm.name}</span>
                          </td>
                          <td className="py-1 px-3 text-slate-500 font-mono font-bold">{adm.mvocId || 'N/A'}</td>
                          <td className="py-1 px-4 text-right pr-8 font-mono text-[#0f2d52] font-black text-sm">
                            {adm.merchantsScouted}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Scouted Merchants List & Verification */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
            <h3 className="text-[#0f2d52] font-black text-base uppercase tracking-tight flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-indigo-500" />
              Scouted Merchants & Verification Requests
            </h3>
            
            {loadingMerchants ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <div className="w-6 h-6 rounded-full border-4 border-slate-150 border-t-[#0f2d52] animate-spin" />
                <p className="text-xs text-slate-400 font-bold">Memuat turun data Merchant...</p>
              </div>
            ) : merchantsList.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-slate-200/50">
                <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Tiada Merchant Terdaftar</p>
                <p className="text-[10px] text-slate-500 mt-1">Belum ada sebarang Merchant didaftarkan melalui database.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-[#f8f9ff] border-b border-slate-200 text-slate-500 h-[38px] select-none text-[10px] font-extrabold uppercase tracking-widest">
                      <th className="py-1 px-4 w-[30%] font-black">Nama Rakan Niaga (Merchant)</th>
                      <th className="py-1 px-3 w-[20%] font-black">Kategori</th>
                      <th className="py-1 px-3 w-[25%] font-black">Didaftarkan Oleh (Scout)</th>
                      <th className="py-1 px-3 w-[12%] text-center font-black">Status</th>
                      <th className="py-1 px-4 text-right w-[13%] font-black">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800">
                    {merchantsList.map(m => {
                      const isPending = m.status === 'pending';
                      const isApproving = isApprovingMerchant === m.id;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors h-[48px]">
                          <td className="py-1 px-4 text-left">
                            <div className="flex flex-col">
                              <span className="text-[#0b1c30]">{m.name}</span>
                              <span className="text-[9px] text-slate-400 font-medium font-mono">{m.id}</span>
                            </div>
                          </td>
                          <td className="py-1 px-3 text-slate-650 font-medium uppercase text-[10px] text-left">{m.category}</td>
                          <td className="py-1 px-3 text-left">
                            <div className="flex flex-col">
                              <span className="text-slate-700 font-bold">{m.registered_by_admin_name || 'System / Default'}</span>
                              {m.registered_by_admin_id && m.registered_by_admin_id !== 'system' && (
                                <span className="text-[9px] text-slate-400 font-mono font-medium">{m.registered_by_admin_id}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-1 px-3 text-center">
                            <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                              isPending
                                ? 'bg-amber-50 text-amber-700 border border-amber-250 animate-pulse'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {isPending ? 'Pending' : 'Active'}
                            </span>
                          </td>
                          <td className="py-1 px-4 text-right pr-6">
                            {isPending ? (
                              currentUserRole === 'super_admin' ? (
                                <button
                                  onClick={() => handleApproveMerchant(m.id, m.registered_by_admin_id)}
                                  disabled={isApproving}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition active:scale-95 shadow-3xs cursor-pointer disabled:opacity-50"
                                >
                                  {isApproving ? 'Approving...' : 'Verify & +500 XP'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic font-semibold">Super Admin Only</span>
                              )
                            ) : (
                              <div className="flex items-center justify-end gap-1 text-emerald-600">
                                <Check className="w-4 h-4" />
                                <span className="text-[10px] uppercase font-black tracking-wider">Verified</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeAdminTab === 'directory' && (
        <>

          {/* STATISTICS PANELS */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between group hover:border-[#adc8f5]/65 transition-all">
          <div>
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest block font-sans">User Registry</span>
            <h4 className="text-xs font-black text-[#0b1c30] uppercase tracking-normal mt-0.5 font-sans">Total Registered Accounts</h4>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-black text-[#0f2d52] tracking-tighter font-mono">
              {membersList.length}
            </span>
            <span className="text-[10px] text-emerald-600 font-bold uppercase py-0.5 px-1.5 bg-emerald-50 border border-emerald-100 rounded-md font-sans">
              Verified Profiles
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between group hover:border-[#adc8f5]/65 transition-all">
          <div>
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest block font-sans">Operator Count</span>
            <h4 className="text-xs font-black text-[#0b1c30] uppercase tracking-normal mt-0.5 font-sans">Active Officers & Admins</h4>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-black text-indigo-600 tracking-tighter font-mono">
              {membersList.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
            </span>
            <span className="text-[10px] text-indigo-600 font-bold uppercase py-0.5 px-1.5 bg-indigo-50 border border-indigo-100 rounded-md font-sans">
              Council Authorities
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-xs flex flex-col justify-between group hover:border-[#adc8f5]/65 transition-all">
          <div>
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest block font-sans">Suspended Records</span>
            <h4 className="text-xs font-black text-[#0b1c30] uppercase tracking-normal mt-0.5 font-sans">Restricted Access Locks</h4>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl font-black text-red-650 tracking-tighter font-mono">
              {membersList.filter(u => u.status === 'suspended' || u.status === 'banned').length}
            </span>
            <span className="text-[10px] text-red-600 font-bold uppercase py-0.5 px-1.5 bg-red-50 border border-red-100 rounded-md font-sans">
              Suspended Accounts
            </span>
          </div>
        </div>
      </section>

      {/* Pending Members Queue */}
      {isAdminOrSuperAdmin() && pendingMembersList.length > 0 && (
        <section className="bg-amber-50/50 border border-amber-200 rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 pb-4 border-b border-amber-200/50">
            <div className="space-y-0.5">
              <h3 className="text-[#8c521f] font-black text-lg uppercase tracking-tight flex items-center gap-2 font-sans">
                <UserCheck className="w-5.5 h-5.5 text-amber-500" />
                Pending Members Queue
              </h3>
              <p className="text-xs font-medium text-amber-700">
                Review and approve new member registrations for <strong>{currentAdminChapters.join(', ') || 'All Chapters'}</strong>.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[150px] custom-scrollbar">
            <table className="w-full min-w-[700px] text-left border-collapse font-sans relative">
              <thead>
                <tr className="bg-amber-100/50 text-[10px] font-black tracking-widest text-[#8c521f] uppercase border-b border-amber-200/50">
                  <th className="py-2 px-3 font-extrabold w-10 text-center">#</th>
                  <th className="py-2 px-3 font-extrabold w-48">Identifier</th>
                  <th className="py-2 px-3 font-extrabold w-32 hidden md:table-cell">Chapter</th>
                  <th className="py-2 px-3 font-extrabold w-32 hidden sm:table-cell">Vehicle Details</th>
                  <th className="py-2 px-3 font-extrabold w-64 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs text-amber-900 border-b border-amber-100/50 bg-white/50">
                <AnimatePresence>
                  {pendingMembersList.map((u, idx) => (
                    <motion.tr 
                      key={u.uid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: idx * 0.05 }}
                      className="border-b border-amber-100/30 hover:bg-white/80 transition-colors last:border-0"
                    >
                      <td className="py-2.5 px-3 text-center text-[10px] font-black text-amber-400">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3 space-y-0.5">
                        <div className="flex items-center gap-1.5 font-bold">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-amber-600 font-mono tracking-wide">
                          {u.email}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 hidden md:table-cell">
                        <span className="bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold tracking-tight uppercase shadow-sm">
                          {u.chapter || 'Unknown Chapter'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 hidden sm:table-cell">
                         <span className="font-mono text-[11px] font-bold tracking-widest text-amber-800">
                            {u.vehiclePlate || 'PENDING'}
                         </span>
                      </td>
                      <td className="py-1 px-3">
                         <div className="flex justify-end items-center gap-1.5">
                            <button
                              onClick={() => handleSuspend(u, 'active')}
                              className="bg-emerald-50 text-emerald-700 hover:bg-emerald-500 hover:text-white border border-emerald-200 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase shadow-sm transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleSuspend(u, 'banned')}
                              className="bg-rose-50 text-rose-700 hover:bg-rose-500 hover:text-white border border-rose-200 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase shadow-sm transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleSuspend(u, 'suspended')}
                              className="bg-slate-50 text-slate-700 hover:bg-slate-600 hover:text-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase shadow-sm transition-colors"
                            >
                              Suspend
                            </button>
                         </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* User registry control layout */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-4 md:p-6 space-y-4">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 pb-4 border-b border-gray-100">
          <div className="space-y-0.5">
            <h3 className="text-[#001835] font-black text-lg uppercase tracking-tight flex items-center gap-2 font-sans">
              <ShieldCheck className="w-5.5 h-5.5 text-[#0f2d52]" />
              User Access Management Directory
            </h3>
            <p className="text-xs font-medium text-gray-500">
              Grant authority levels, upgrade membership tiers, and toggle active block statuses.
            </p>
          </div>

          {/* Core admin utility buttons relocated here naturally */}
          <div className="flex flex-wrap items-center gap-1.5 w-full xl:w-auto">
            {/* Buttons removed as requested */}
          </div>
        </div>

        {/* Search bar and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between pb-2">
          {/* Search Input */}
          <div className="relative flex-grow max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder="Search user profiles by name, email, or badge id..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full bg-[#f8f9ff] text-xs font-semibold pl-9 pr-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] placeholder:text-slate-400 shadow-sm"
            />
          </div>

          {/* Filter Groups */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
            {/* Role filter chips */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Role:</span>
              <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                {(['all', 'super_admin', 'admin', 'member'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition cursor-pointer select-none uppercase ${
                      roleFilter === r
                        ? 'bg-[#0f2d52] text-white'
                        : 'text-slate-550 hover:bg-slate-100 hover:text-[#0b1c30]'
                    }`}
                  >
                    {r === 'all' ? 'All' : r === 'super_admin' ? 'Super' : r === 'admin' ? 'Officer' : 'Member'}
                  </button>
                ))}
              </div>
            </div>

            {/* Status filter chips */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Status:</span>
              <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-0.5">
                {(['all', 'active', 'suspended'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition cursor-pointer select-none uppercase ${
                      statusFilter === s
                        ? 'bg-[#0f2d52] text-white'
                        : 'text-slate-550 hover:bg-slate-100 hover:text-[#0b1c30]'
                    }`}
                  >
                    {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Suspended'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table 1: Administrative Council & State Admins */}
        {renderUserTable(adminList, 'No administrative members found.', 'Administrative Council & State Admins', '👑')}

        <div className="w-full h-px bg-slate-200/50 my-2"></div>

        {/* Table 2: Community Members (Paginated) */}
        {renderUserTable(memberList, 'No community members found.', 'Community Members', '🚗', {
          current: membersCurrentPage,
          set: setMembersCurrentPage,
          limit: 10
        })}

        {/* Policy Notice banner */}
        <div className="bg-[#eff4ff] border border-[#adc8f5] rounded-xl p-4 flex items-start gap-3">
          <Info className="w-4.5 h-4.5 text-[#2d486d] mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <span className="text-xs font-black text-[#001835] uppercase tracking-wider block">Unified Access Synchronization Guidelines</span>
            <p className="text-[11px] leading-relaxed text-[#2d486d] font-bold">
              All status block switches and role modifications execute live writes into the Firestore database collection with instant cascading propagation. Modified users are blocked from vehicle keys, chapter events, and local benefits instantaneously.
            </p>
          </div>
        </div>
      </section>
        </>
      )}

      {/* SAFELY GUARDRAIL CONFIRMATION MODAL */}
      <AnimatePresence>
        {pendingUpdate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-6 text-left"
            >
              <div className="flex items-center gap-3 text-amber-600 mb-4 animate-bounce">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <div>
                  <h4 className="text-sm font-black text-[#001835] uppercase tracking-wider">Confirm Administrative Action</h4>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">ACCIDENTAL ERROR GUARDRAIL</p>
                </div>
              </div>

              <div className="space-y-3 py-2">
                <p className="text-xs leading-relaxed text-slate-700 font-semibold">
                  {pendingUpdate.type === 'role' && (
                    <>
                      Are you absolutely sure you want to change key administrative privileges for <strong>{pendingUpdate.user.name}</strong>?
                      <br className="mb-2" />
                      This will change their organizational role from <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-extrabold text-[10px] uppercase">{pendingUpdate.user.role || 'member'}</span> to <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-extrabold text-[10px] uppercase">{pendingUpdate.value}</span>.
                    </>
                  )}
                  {pendingUpdate.type === 'status' && (
                    <>
                      Are you absolutely sure you want to modify access suspension parameters for <strong>{pendingUpdate.user.name}</strong>?
                      <br className="mb-2" />
                      This action will change their active directory account status to <span className={pendingUpdate.value === 'suspended' ? "bg-red-50 text-red-750 border border-red-200 px-1.5 py-0.5 rounded font-bold text-[10px] uppercase animate-pulse" : "bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold text-[10px] uppercase"}>{pendingUpdate.value.toUpperCase()}</span>.
                    </>
                  )}
                  {pendingUpdate.type === 'tier' && (
                    <>
                      Are you absolutely sure you want to modify membership tier level access for <strong>{pendingUpdate.user.name}</strong>?
                      <br className="mb-2" />
                      This will swap their active membership package register to <span className="bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-bold text-[10px] uppercase">{pendingUpdate.value.toUpperCase()}</span>.
                    </>
                  )}
                </p>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#663d16] leading-normal font-bold">
                    This action updates the document in real-time in the Firestore 'users' collection and propagates downstream instantly.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-150 mt-5">
                <button
                  type="button"
                  onClick={() => setPendingUpdate(null)}
                  className="w-1/2 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 font-bold text-xs h-11 rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessingUpdate}
                  onClick={async () => {
                    try {
                      setIsProcessingUpdate(true);
                      const targetUser = pendingUpdate.user;
                      const isTargetMasterAdmin = targetUser.mvocId === MASTER_ADMIN_ID || targetUser.email.toLowerCase() === MASTER_EMAIL;
                      
                      if (isTargetMasterAdmin) {
                        triggerToast('Security Error: The Master Admin profile is immutable and cannot be modified.', 'error');
                        setIsProcessingUpdate(false);
                        setPendingUpdate(null);
                        return;
                      }

                      if (pendingUpdate.type === 'role') {
                        const isTargetAdmin = targetUser.role === 'super_admin' || targetUser.role === 'admin';
                        if (isTargetAdmin && !isCurrentUserMasterAdmin) {
                          triggerToast('Security Error: Only the Master Admin can change roles of other Admins/Super Admins.', 'error');
                          setIsProcessingUpdate(false);
                          setPendingUpdate(null);
                          return;
                        }
                        await handleUpdateMemberRole(targetUser, pendingUpdate.value as 'super_admin' | 'admin' | 'member');
                        setLastRoleUpdate({ uid: targetUser.uid, role: pendingUpdate.value });
                      } else if (pendingUpdate.type === 'status') {
                        await handleSuspend(targetUser, pendingUpdate.value as 'active' | 'suspended' | 'banned');
                      } else if (pendingUpdate.type === 'tier') {
                        await handleUpdateMemberTier(targetUser, pendingUpdate.value as 'GOLD' | 'STANDARD');
                      }
                    } catch (err: any) {
                      triggerToast(`Failed update: ${err.message || String(err)}`, 'error');
                    } finally {
                      setIsProcessingUpdate(false);
                      setPendingUpdate(null);
                    }
                  }}
                  className="w-1/2 py-2.5 bg-[#001835] hover:bg-[#0f2d52] disabled:opacity-50 text-white font-black text-xs h-11 rounded-xl transition flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm cursor-pointer text-center"
                >
                  {isProcessingUpdate ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Confirm Modify"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SAFE DELETE GUARDRAIL CONFIRMATION MODAL */}
      <AnimatePresence>
        {pendingDeleteUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-md bg-[#0b1c30] border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-6 text-left text-white"
            >
              <div className="flex items-center gap-3 text-rose-500 mb-4 animate-pulse">
                <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">CRITICAL DELETE GUARDRAIL</h4>
                  <p className="text-[10px] text-red-500 uppercase font-black tracking-widest">DESTRUCTIVE ADMINISTRATIVE ACTION</p>
                </div>
              </div>

              <div className="space-y-4 py-2">
                <div className="p-3 bg-red-950/20 border border-red-900/35 rounded-xl space-y-2">
                  <p className="text-xs leading-relaxed text-slate-300 font-medium">
                    You are planning to permanently remove <strong>{pendingDeleteUser.name}</strong> ({pendingDeleteUser.email}) from the active roster.
                  </p>
                  <p className="text-[11px] leading-relaxed text-rose-400 font-bold">
                    WARNING: This operation is permanent, irreversible, and instantly revokes all local benefits, convoy bookings, state chapter memberships, and app access dashboards.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    To confirm deletion, type <span className="text-rose-400 font-bold font-mono">DELETE</span> below:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE to enable confirm button"
                    className="w-full bg-[#0a1829] text-xs font-semibold px-4.5 py-3 border border-red-900/30 rounded-xl outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/50 transition text-white placeholder:text-slate-600 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setPendingDeleteUser(null);
                    setDeleteConfirmText('');
                  }}
                  className="w-1/2 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-extrabold text-xs h-11 rounded-xl transition uppercase tracking-wider cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmText !== 'DELETE' || isProcessingDelete}
                  onClick={async () => {
                    if (deleteConfirmText !== 'DELETE') return;
                    try {
                      setIsProcessingDelete(true);
                      
                      const isTargetMasterAdmin = pendingDeleteUser.mvocId === MASTER_ADMIN_ID || pendingDeleteUser.email.toLowerCase() === MASTER_EMAIL;
                      if (isTargetMasterAdmin) {
                        triggerToast('Security Error: The Master Admin profile is immutable and cannot be deleted.', 'error');
                        setIsProcessingDelete(false);
                        setPendingDeleteUser(null);
                        setDeleteConfirmText('');
                        return;
                      }

                      // Delete user profile from Firestore collection
                      await deleteDoc(doc(db, 'users', pendingDeleteUser.uid));
                      
                      /* 
                        PLACEHOLDER TO ADD THE ADMIN SDK FUNCTION TO REMOVE THE USER FROM FIREBASE AUTHENTICATION:
                        If setting up an admin backend or firebase cloud function (e.g., httpsCall or admin.auth().deleteUser(uid)),
                        call that API route here to also prune the official credentials sign-in record.
                        Example:
                        // await fetch('/api/delete-auth-user', {
                        //   method: 'POST',
                        //   headers: { 'Content-Type': 'application/json' },
                        //   body: JSON.stringify({ uid: pendingDeleteUser.uid })
                        // });
                        firebaseAuthAdmin.deleteUser(pendingDeleteUser.uid);
                      */

                      triggerToast(`Successfully deleted ${pendingDeleteUser.name} from directory.`, 'success');
                      
                      // Refresh table view immediately
                      await fetchFirestoreUsers();
                    } catch (err: any) {
                      triggerToast(`Failed to delete user: ${err.message || String(err)}`, 'error');
                    } finally {
                      setIsProcessingDelete(false);
                      setPendingDeleteUser(null);
                      setDeleteConfirmText('');
                    }
                  }}
                  className="w-1/2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-xs h-11 rounded-xl transition flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-md cursor-pointer text-center"
                >
                  {isProcessingDelete ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Confirm Delete"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* USER MANAGEMENT MODAL */}
      <AnimatePresence>
        {manageUserModalState.isOpen && manageUserModalState.user && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-[#0f2d52] shrink-0 rounded-t-2xl">
                <h3 className="font-sans font-black tracking-tight text-white flex items-center gap-2">
                  <UserCog className="w-5 h-5 text-amber-500" />
                  Manage User
                </h3>
                <button
                  onClick={() => setManageUserModalState(prev => ({ ...prev, isOpen: false }))}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto">
                {(currentUserRole === 'super_admin' || displayEmail.toLowerCase() === MASTER_EMAIL) ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Full Name */}
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Full Name</label>
                        <input
                          type="text"
                          value={manageUserModalState.name}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30]"
                        />
                      </div>
                      
                      {/* Short Name */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Short Name / Nickname</label>
                        <input
                          type="text"
                          value={manageUserModalState.shortName}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, shortName: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30]"
                        />
                      </div>

                      {/* MVOC ID */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">MVOC ID</label>
                        <input
                          type="text"
                          value={manageUserModalState.mvocId}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, mvocId: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30]"
                        />
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Phone Number</label>
                        <input
                          type="text"
                          value={manageUserModalState.phoneNumber}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, phoneNumber: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30]"
                        />
                      </div>

                      {/* Vehicle Plate */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Vehicle Plate</label>
                        <input
                          type="text"
                          value={manageUserModalState.vehiclePlate}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, vehiclePlate: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30]"
                        />
                      </div>

                      {/* Blood Type */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Blood Type</label>
                        <select
                          value={manageUserModalState.bloodType}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, bloodType: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer"
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
                      </div>

                      {/* Gender */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Gender</label>
                        <select
                          value={manageUserModalState.gender}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, gender: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer"
                        >
                          <option value="">Not Specified</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>

                      {/* Join Date */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Join Date</label>
                        <input
                          type="text"
                          value={manageUserModalState.joinDate}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, joinDate: e.target.value }))}
                          placeholder="e.g. 12 January 2021"
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30]"
                        />
                      </div>

                      {/* Points */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">MVOC Points</label>
                        <input
                          type="number"
                          value={manageUserModalState.points}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, points: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30]"
                        />
                      </div>

                      {/* State Chapter */}
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Member State Chapter</label>
                        <select
                          value={manageUserModalState.chapter}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, chapter: e.target.value }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer"
                        >
                          {[
                            'Zone Klang Valley', 'Zone Utara', 'Zone Borneo', 'Zone Pantai Timur', 'Zone Selatan'
                          ].map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                      </div>

                      {/* Account Status */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Account Status</label>
                        <select
                          value={manageUserModalState.status}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, status: e.target.value as any }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer"
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="banned">Banned</option>
                        </select>
                      </div>

                      {/* System Role */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">System Role</label>
                        <select
                          value={manageUserModalState.role}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, role: e.target.value as any }))}
                          className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer"
                        >
                          <option value="member">MEMBER</option>
                          <option value="admin">OFFICER / ADMIN</option>
                          <option value="super_admin">SUPER ADMIN</option>
                        </select>
                      </div>

                      {/* Managed State Chapters */}
                      {manageUserModalState.role === 'admin' && (
                        <div className="space-y-2 md:col-span-2 pt-2 border-t border-slate-100">
                          <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest flex items-center gap-1.5">
                            <Map className="w-3.5 h-3.5 text-blue-500" />
                            Managed State Chapters
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#f8f9ff] border border-[#c4c6cf]/55 rounded-xl p-3.5 max-h-48 overflow-y-auto">
                            {[
                              'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 
                              'Pahang', 'Perak', 'Perlis', 'Penang', 'Sabah', 
                              'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur', 
                              'W.P. Labuan', 'W.P. Putrajaya', 'Brunei'
                            ].map(state => {
                              const isChecked = manageUserModalState.managedChapters.includes(state);
                              return (
                                <label key={state} className="flex items-center gap-2 text-xs font-bold text-[#0b1c30] cursor-pointer hover:bg-slate-200/50 p-1.5 rounded transition">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setManageUserModalState(prev => {
                                        const chapters = checked
                                          ? [...prev.managedChapters, state]
                                          : prev.managedChapters.filter(ch => ch !== state);
                                        return { ...prev, managedChapters: chapters };
                                      });
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-350"
                                  />
                                  <span>{state}</span>
                                </label>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Select all state chapters this admin can manage as a leader.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <h4 className="text-sm font-extrabold text-slate-800">{manageUserModalState.user.name}</h4>
                      <p className="text-xs text-slate-500">{manageUserModalState.user.email}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Account Status</label>
                        <select
                          value={manageUserModalState.status}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, status: e.target.value as any }))}
                          disabled={manageUserModalState.user.role === 'admin' || manageUserModalState.user.role === 'super_admin'}
                          title={(manageUserModalState.user.role === 'admin' || manageUserModalState.user.role === 'super_admin') ? "You cannot modify the status of another Admin/Super Admin." : ""}
                          className={`w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] ${(manageUserModalState.user.role === 'admin' || manageUserModalState.user.role === 'super_admin') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="banned">Banned</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">System Role</label>
                        <select
                          value={manageUserModalState.role}
                          onChange={(e) => setManageUserModalState(prev => ({ ...prev, role: e.target.value as any }))}
                          disabled={manageUserModalState.user.role === 'admin' || manageUserModalState.user.role === 'super_admin'}
                          title={(manageUserModalState.user.role === 'admin' || manageUserModalState.user.role === 'super_admin') ? "You cannot modify the role of another Admin/Super Admin." : ""}
                          className={`w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] ${(manageUserModalState.user.role === 'admin' || manageUserModalState.user.role === 'super_admin') ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <option value="member">MEMBER</option>
                          <option value="admin">OFFICER / ADMIN</option>
                        </select>
                      </div>

                      {/* Managed State Chapters */}
                      {manageUserModalState.role === 'admin' && (
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                          <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest flex items-center gap-1.5">
                            <Map className="w-3.5 h-3.5 text-blue-500" />
                            Managed State Chapters
                          </label>
                          <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#f8f9ff] border border-[#c4c6cf]/55 rounded-xl p-3.5 max-h-48 overflow-y-auto ${(manageUserModalState.user.role === 'admin' || manageUserModalState.user.role === 'super_admin') ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {[
                              'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 
                              'Pahang', 'Perak', 'Perlis', 'Penang', 'Sabah', 
                              'Sarawak', 'Selangor', 'Terengganu', 'W.P. Kuala Lumpur', 
                              'W.P. Labuan', 'W.P. Putrajaya', 'Brunei'
                            ].map(state => {
                              const isChecked = manageUserModalState.managedChapters.includes(state);
                              const isDisabled = manageUserModalState.user.role === 'admin' || manageUserModalState.user.role === 'super_admin';
                              return (
                                <label key={state} className={`flex items-center gap-2 text-xs font-bold text-[#0b1c30] p-1.5 rounded transition ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-slate-200/50'}`}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isDisabled}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setManageUserModalState(prev => {
                                        const chapters = checked
                                          ? [...prev.managedChapters, state]
                                          : prev.managedChapters.filter(ch => ch !== state);
                                        return { ...prev, managedChapters: chapters };
                                      });
                                    }}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-350 disabled:opacity-50"
                                  />
                                  <span>{state}</span>
                                </label>
                              );
                            })}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Select all state chapters this admin can manage as a leader.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 rounded-b-2xl">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setManageUserModalState(prev => ({ ...prev, isOpen: false }))}
                    className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-3.5 rounded-xl font-bold text-sm tracking-wide transition flex items-center justify-center cursor-pointer select-none"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveUserManagement}
                    className="w-full bg-[#0f2d52] hover:bg-[#091a30] text-white py-3.5 rounded-xl font-bold text-sm tracking-wide shadow transition flex items-center justify-center gap-2 cursor-pointer select-none"
                  >
                    <Check className="w-4 h-4 text-emerald-400" />
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REUSABLE ADD NEW MEMBER SLIDE-OVER / MODAL CONTAINER */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="w-full max-w-lg bg-white border border-[#c4c6cf]/40 rounded-2xl overflow-hidden shadow-2xl relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#7b95c0]/5 rounded-full blur-2xl pointer-events-none" />
              
              {/* Modal Header */}
              <div className="bg-[#0f2d52] text-white p-6 border-b border-[#c4c6cf]/20 flex justify-between items-center">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon className="w-4 h-4 text-[#adc8f5]" />
                    <span className="text-[9px] tracking-widest uppercase font-black text-[#d3e4fe]">Operational Account Allocation</span>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight">Manual App Onboarding</h4>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Form */}
              <form onSubmit={handleAddNewMemberSubmit} className="p-6 space-y-4 text-left">
                
                {/* Full name input */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Full Registrant Name</label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Ahmad Syamil Bin Husin"
                    className="w-full bg-[#f8f9ff] text-xs font-semibold px-4.5 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] placeholder:text-gray-400"
                  />
                </div>

                {/* Email account */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Gmail / Registry Account Profile</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. syamil.mvoc@gmail.com"
                    className="w-full bg-[#f8f9ff] text-xs font-semibold px-4.5 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] placeholder:text-gray-400"
                  />
                </div>

                {/* Car Plate / MVOC digits */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Veloz License Registration Plate Digits (e.g. 5241)</label>
                  <input
                    type="text"
                    required
                    value={newMvocDigits}
                    onChange={(e) => setNewMvocDigits(e.target.value)}
                    placeholder="e.g. 5241 or VHY 9823"
                    className="w-full bg-[#f8f9ff] text-xs font-black px-4.5 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] placeholder:text-gray-400 font-mono text-[13px]"
                  />
                </div>

                {/* Regional delegation select */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Regional State Chapter Delegate</label>
                  <select
                    value={newChapter}
                    onChange={(e) => setNewChapter(e.target.value)}
                    className="w-full bg-[#f8f9ff] text-xs font-bold px-4.5 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer"
                  >
                    {CHAPTER_NAMES.map(ch => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                </div>

                {/* Level / Authority Grid select */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Membership Tier</label>
                    <select
                      value={newTier}
                      onChange={(e) => setNewTier(e.target.value as 'GOLD' | 'STANDARD')}
                      className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer"
                    >
                      <option value="STANDARD">🚗 STANDARD TIER</option>
                      <option value="GOLD">🏅 GOLD TIER</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-[#455f87] uppercase tracking-widest">Authority Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as 'super_admin' | 'admin' | 'member')}
                      className="w-full bg-[#f8f9ff] text-xs font-bold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] focus:ring-1 focus:ring-[#0f2d52] transition text-[#0b1c30] cursor-pointer"
                    >
                      <option value="member">👤 STANDARD MEMBER</option>
                      <option value="admin">👮 OFFICER COMMITTEE</option>
                      <option value="super_admin">⚡ SUPER ADMIN</option>
                    </select>
                  </div>
                </div>

                {/* Submissions Action footer */}
                <div className="flex gap-3 pt-4 border-t border-gray-150 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="w-1/2 bg-[#f8f9ff] hover:bg-slate-100 border border-[#c4c6cf] text-[#455f87] font-bold text-xs h-11 rounded-xl transition uppercase tracking-wider cursor-pointer"
                  >
                    Discard Draft
                  </button>
                  <button
                    type="submit"
                    disabled={isAddingMember}
                    className="w-1/2 bg-[#001835] hover:bg-[#0f2d52] disabled:opacity-50 text-white font-black text-xs h-11 rounded-xl transition flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm cursor-pointer"
                  >
                    {isAddingMember ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        Provision Account
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REDEMPTION CONFIRMATION MODAL */}
      <AnimatePresence>
        {isRedeemConfirmOpen && selectedReward && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-6 text-left"
            >
              <div className="flex items-center gap-3 text-emerald-600 mb-4 animate-bounce">
                <Gift className="w-8 h-8 text-emerald-500" />
                <div>
                  <h4 className="text-sm font-black text-[#001835] uppercase tracking-wider">Confirm Redemption</h4>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Admin Rewards Shop</p>
                </div>
              </div>

              <div className="space-y-3 py-2 text-xs font-semibold text-slate-700 leading-relaxed">
                <p>
                  Adakah anda pasti mahu menebus <strong>{selectedReward.name}</strong> dengan kos sebanyak <strong>{selectedReward.cost} XP</strong>?
                </p>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-650 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-emerald-800 leading-normal font-bold">
                    Mata ganjaran anda akan ditolak sebanyak {selectedReward.cost} XP secara langsung di dalam pangkalan data.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsRedeemConfirmOpen(false);
                    setSelectedReward(null);
                  }}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold text-xs h-11 rounded-xl transition uppercase tracking-wider cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRedemption}
                  disabled={isRedeeming}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs h-11 rounded-xl transition flex items-center justify-center gap-1.5 uppercase tracking-wider shadow-sm cursor-pointer"
                >
                  {isRedeeming ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    'Sahkan Tebus'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
