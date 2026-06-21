import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Users, 
  Phone, 
  MapPin, 
  Award, 
  X, 
  ExternalLink, 
  ShieldCheck, 
  EyeOff,
  MessageSquare,
  ChevronRight
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { isValidWhatsAppNumber } from '../lib/phoneUtils';

interface SimpleMember {
  uid: string;
  name: string;
  mvocId: string;
  chapter: string;
  tier: 'GOLD' | 'STANDARD';
  status: string;
  phoneNumber: string;
  isWhatsAppPublic?: boolean;
  officialPatch?: boolean;
  role?: string;
  managedChapter?: string;
  photoURL?: string;
  bloodType?: string;
  vehiclePlate?: string;
}

interface MemberDirectoryProps {
  currentUserId?: string;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function MemberDirectory({ currentUserId, triggerToast }: MemberDirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [allMembers, setAllMembers] = useState<SimpleMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<SimpleMember | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'leaders'>('all');

  const [selectedChapter, setSelectedChapter] = useState('all');

  // Dynamically extract unique chapters present in the verified members list
  const uniqueChapters = Array.from(
    new Set(allMembers.map((mbr) => mbr.chapter).filter(Boolean))
  ).sort();

  // Fetch clean directory data (Only returning non-sensitive fields)
  useEffect(() => {
    setIsLoading(true);
    
    const unsubscribe = onSnapshot(collection(db, 'users'), (querySnapshot) => {
      const cleanList: SimpleMember[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        // Privacy Filter Guardrail: If directoryVisible is set to false, do not show
        const isVisible = data.settings?.privacy?.directoryVisible !== false;
        if (!isVisible) return;

        // Status Filter Guardrail: Don't show inactive/suspended/banned
        if (data.status && data.status !== 'active') return;

        // Stealth Privacy Check for Master Admin profile (mvocId === 'MVOC-0001' or nikazfar@gmail.com)
        const isStealthModeOn = data.isStealthMode === true;
        const isMasterAdminUser = data.mvocId === 'MVOC-0001' || (data.email || '').toLowerCase() === 'nikazfar@gmail.com';
        const displayedRole = (isStealthModeOn && isMasterAdminUser) ? 'member' : (data.role || 'member');
        const displayedPatch = (isStealthModeOn && isMasterAdminUser) ? false : (data.officialPatch === true || data.patch_status === true);

        // Only collect public, non-sensitive parameters
        cleanList.push({
          uid: docSnap.id,
          name: data.name || data.fullName || 'Anonymous Member',
          mvocId: data.mvocId || 'Pending ID',
          chapter: data.chapter || 'Kuala Lumpur Chapter',
          tier: data.tier === 'GOLD' ? 'GOLD' : 'STANDARD',
          status: data.status || 'active',
          phoneNumber: data.phoneNumber || data.phone || '',
          isWhatsAppPublic: data.isWhatsAppPublic === true,
          officialPatch: displayedPatch,
          role: displayedRole,
          managedChapter: data.managedChapter,
          photoURL: data.photoURL,
          bloodType: data.bloodType
        });
      });

      // Sort by admin status first, then alphabetically by name
      cleanList.sort((a, b) => {
        const isAAdmin = a.role === 'admin' || a.role === 'super_admin';
        const isBAdmin = b.role === 'admin' || b.role === 'super_admin';
        
        if (isAAdmin && !isBAdmin) return -1;
        if (!isAAdmin && isBAdmin) return 1;
        
        return a.name.localeCompare(b.name);
      });
      setAllMembers(cleanList);
      
      setSelectedMember(prev => {
        if (!prev) return null;
        return cleanList.find(m => m.uid === prev.uid) || null;
      });
      
      setIsLoading(false);
    }, (err: any) => {
      console.error("Directory sync error:", err);
      triggerToast("Failed to sync directory. Access restricted.", "error");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [triggerToast]);

  // Filters client side based on case-insensitive matches, selected tab, and chapter dropdown selection
  const filteredMembers = allMembers.filter((mbr) => {
    // 1. Tab filter
    if (activeTab === 'leaders') {
      const isLeader = mbr.role === 'admin' || mbr.role === 'super_admin';
      if (!isLeader) return false;
    }

    // 2. Chapter dropdown filter
    if (selectedChapter !== 'all') {
      if (mbr.chapter !== selectedChapter) return false;
    }

    // 3. Search query filter
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      mbr.name.toLowerCase().includes(query) ||
      mbr.mvocId.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6" id="member-directory-container">
      {/* Decorative Title Banner */}
      <div className="bg-gradient-to-br from-[#0F2D52] via-[#0A1C33] to-[#030914] rounded-2xl p-6 text-white text-center shadow-lg relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
          <Users className="w-40 h-40" />
        </div>
        <h3 className="text-xl font-display font-extrabold tracking-tight flex items-center justify-center gap-2">
          <Users className="w-6 h-6 text-emerald-400 stroke-[2.3]" />
          <span>Member Directory</span>
        </h3>
        <p className="text-xs text-slate-300 font-semibold mt-1">
          Search registered Toyota Veloz Owners by MVOC-ID or Name
        </p>
      </div>

      {/* Persistent Search Bar */}
      <div className="relative bg-[#0b1c30] p-4 rounded-xl border border-[#16243a] shadow-xs">
        <label className="text-xs font-bold text-slate-300 block mb-1.5">Search Members</label>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Type MVOC-ID (e.g. MVOC-0001) or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#16243a] border border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-white text-xs font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/10 focus:outline-hidden transition-all placeholder:text-slate-500"
            id="directory-search-input"
          />
        </div>
      </div>

      {/* Filters (Tabs + Chapter Dropdown) */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Filter Tabs */}
        <div className="flex-1 flex bg-[#0b1c30] p-1 rounded-xl border border-[#16243a]/80 shadow-xs" id="directory-tabs">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#0F2D52] text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            All ({allMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('leaders')}
            className={`flex-1 py-2 text-center text-xs font-black rounded-lg transition-all cursor-pointer ${
              activeTab === 'leaders'
                ? 'bg-[#0F2D52] text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Leader ({allMembers.filter(m => m.role === 'admin' || m.role === 'super_admin').length})
          </button>
        </div>

        {/* Chapter Dropdown Filter */}
        <div className="sm:w-64">
          <select
            value={selectedChapter}
            onChange={(e) => setSelectedChapter(e.target.value)}
            className="w-full bg-[#0b1c30] border border-[#16243a]/80 text-slate-205 text-xs font-black rounded-xl px-3.5 py-2.5 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/10 focus:outline-hidden cursor-pointer appearance-none relative"
            id="directory-chapter-filter"
            style={{
              backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2394a3b8' stroke-width='2.3' stroke-linecap='round' stroke-linejoin='round'><polyline points='4 6 8 10 12 6'></polyline></svg>")`,
              backgroundPosition: "right 14px center",
              backgroundRepeat: "no-repeat",
              paddingRight: "38px"
            }}
          >
            <option value="all">All Chapters</option>
            {uniqueChapters.map((ch) => (
              <option key={ch} value={ch} className="bg-[#0b1c30]">
                {ch}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid or Loading Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3 bg-[#0b1c30] rounded-2xl border border-[#16243a]">
          <div className="w-8 h-8 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
          <p className="text-xs text-slate-400 font-bold">Retrieving verified member directory records...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-2 bg-[#0b1c30] rounded-2xl border border-[#16243a] text-center px-4">
          <EyeOff className="w-10 h-10 text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-300">No Verified Members Found</p>
          <p className="text-xs text-slate-500 max-w-md">No entries matched the selected filter or "{searchQuery}".</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {filteredMembers.map((member) => (
              <motion.div
                key={member.uid}
                layoutId={`member-row-${member.uid}`}
                onClick={() => setSelectedMember(member)}
                className="bg-[#0b1c30] hover:bg-[#122842] border border-slate-800/80 hover:border-emerald-500/20 rounded-xl p-2.5 flex items-center justify-between gap-3 group transition-all duration-200 cursor-pointer shadow-xs active:scale-99"
                id={`member-item-${member.uid}`}
              >
                {/* Single line display: Avatar, Name, and MVOC-ID */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 ${
                    member.role === 'super_admin' ? 'border-rose-500/60 shadow-[0_0_6px_rgba(244,63,94,0.3)]' :
                    member.role === 'admin' ? 'border-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.3)]' :
                    'border-slate-750'
                  }`}>
                    <img 
                      src={member.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80"} 
                      alt={member.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Name and MVOC-ID in a single line, optimized to avoid wrapping/clutter */}
                  <div className="flex items-center gap-2 min-w-0 pr-1 select-none">
                    <span className="text-slate-100 font-extrabold text-xs sm:text-sm truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs">
                      {member.name}
                    </span>
                    
                    {/* Compact Leader/Admin tag */}
                    {member.role === 'super_admin' && (
                      <span className="shrink-0 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[7px] font-black uppercase tracking-wider px-1 py-0.2 rounded leading-none select-none">
                        Admin
                      </span>
                    )}
                    {member.role === 'admin' && (
                      <span className="shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[7px] font-black uppercase tracking-wider px-1 py-0.2 rounded leading-none select-none">
                        Leader
                      </span>
                    )}

                    <span className="text-slate-500 text-xs hidden xs:inline opacity-75">•</span>
                    
                    {/* MVOC ID */}
                    <span className="text-emerald-400 font-mono text-xs font-black shrink-0 tracking-tight">
                      {member.mvocId}
                    </span>
                  </div>
                </div>

                {/* Right side: Chevron link/indicators */}
                <div className="flex items-center gap-2 shrink-0">
                  {member.tier === 'GOLD' && (
                    <span className="text-[7.5px] font-black bg-[#FFEAD2] text-[#8C521F] px-1.5 py-0.5 rounded-full uppercase scale-90">
                      GOLD
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Public Profile Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMember(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal content in Command Center Aesthetic */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b1c30] border-2 border-[#16243a] rounded-2xl max-w-sm w-full p-6 text-white shadow-2xl relative overflow-hidden z-10"
              id="directory-member-modal"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/5 cursor-pointer"
                id="close-directory-modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-4">
                {/* Simulated high-quality avatar */}
                <div className="relative inline-block mt-2">
                  <div className={`w-20 h-20 rounded-2xl overflow-hidden border-2 shadow-md mx-auto ${
                    selectedMember.role === 'super_admin' ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]' :
                    selectedMember.role === 'admin' ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]' :
                    'border-emerald-500'
                  }`}>
                    <img 
                      src={selectedMember.photoURL || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80"} 
                      alt={selectedMember.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {selectedMember.role !== 'member' && (
                    <div className={`absolute -bottom-1 right-2 text-white p-0.5 rounded-full shadow-md border border-[#0b1c30] flex items-center justify-center w-5 h-5 ${
                      selectedMember.role === 'super_admin' ? 'bg-rose-500' :
                      selectedMember.role === 'admin' ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#030914] stroke-[2.5]" />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <h3 className="text-base font-display font-extrabold tracking-tight">{selectedMember.name}</h3>
                    {selectedMember.role === 'super_admin' && (
                      <span className="inline-flex items-center bg-rose-500 text-white font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md select-none font-sans shadow-md">
                        🛡️ Admin Council
                      </span>
                    )}
                    {selectedMember.role === 'admin' && (
                      <span className="inline-flex items-center bg-amber-500 text-slate-900 font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md select-none font-sans shadow-md">
                        👑 Chapter Leader
                      </span>
                    )}
                    {selectedMember.officialPatch && (
                      <span className="inline-flex items-center bg-emerald-500 text-[#030914] font-black text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md select-none font-sans">
                        ★ OFFICIAL PATCH
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5 font-mono">MVOC Member ID: {selectedMember.mvocId}</p>
                  {selectedMember.mvocId && selectedMember.mvocId.toUpperCase() === 'MVOC-0001' && (
                    <div className="mt-2 flex justify-center">
                      <a 
                        href="https://linktr.ee/mvoc" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1.5 text-xs text-[#00E676] hover:text-[#00C853] hover:bg-[#00E676]/20 font-bold transition-all bg-[#00E676]/10 px-3 py-1.5 rounded-xl border border-[#00E676]/20"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Linktree</span>
                      </a>
                    </div>
                  )}
                  {selectedMember.managedChapter && (
                    <div className="mt-2.5 flex justify-center">
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-[#0f2d52] text-white rounded-full border border-blue-500/30 uppercase tracking-widest shadow-xs">
                        {selectedMember.managedChapter}
                      </span>
                    </div>
                  )}
                </div>

                {/* Details layout */}
                <div className="space-y-2.5 bg-[#16243a]/70 rounded-xl p-4 text-left border border-slate-700/50">
                  {/* EMERGENCY INFO */}
                  <div className="flex justify-between items-center text-xs bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg mb-3 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                    <span className="text-rose-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      Blood Type
                    </span>
                    <span className="font-extrabold text-white bg-rose-600 px-3 py-1 rounded-md shadow-md text-[13px] tracking-wider uppercase">
                      {selectedMember.bloodType || 'Not Specified'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold">State Chapter</span>
                    <span className="font-extrabold text-slate-100 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      {selectedMember.chapter}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2.5">
                    <span className="text-slate-400 font-bold">Vehicle Registration</span>
                    <span className="bg-black text-white font-mono font-bold tracking-widest px-3 py-1 rounded-md border-2 border-slate-700 text-sm shadow-md mt-1 uppercase inline-block">
                      {selectedMember.vehiclePlate || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2.5">
                    <span className="text-slate-400 font-bold">Membership Tier</span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                      selectedMember.tier === 'GOLD' 
                        ? 'bg-[#FFEAD2] text-[#8C521F]' 
                        : 'bg-slate-800 text-slate-300'
                    }`}>
                      {selectedMember.tier} BENEFIT
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2.5">
                    <span className="text-slate-400 font-bold">Community Role</span>
                    <span className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full uppercase ${
                      selectedMember.role === 'super_admin' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : selectedMember.role === 'admin' 
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {selectedMember.role === 'super_admin' ? '⚡ Super Admin' : selectedMember.role === 'admin' ? '👮 Officer' : '👤 Member'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2.5">
                    <span className="text-slate-400 font-bold">Account Status</span>
                    <span className="font-black text-emerald-400 text-[10px] uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active / Verified
                    </span>
                  </div>
                </div>

                {/* Secure Call & Whatsapp Links */}
                {selectedMember.phoneNumber ? (
                  <div className={`grid ${selectedMember.isWhatsAppPublic ? 'grid-cols-2' : 'grid-cols-1'} gap-3 pt-2`}>
                    <a
                      href={`tel:${selectedMember.phoneNumber}`}
                      className="inline-flex items-center justify-center gap-2 bg-[#16243a]/90 hover:bg-[#20344f] border border-slate-600/50 py-3 px-4 rounded-xl text-xs font-black text-white active:scale-98 transition text-center cursor-pointer min-h-[44px]"
                      id="member-call-anchor"
                    >
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span>Call Member</span>
                    </a>
                    {selectedMember.isWhatsAppPublic && (
                      <button
                        onClick={() => {
                          if (isValidWhatsAppNumber(selectedMember.phoneNumber)) {
                            // User request: The button should trigger window.open('https://wa.me/' + user.phoneNumber)
                            window.open('https://wa.me/' + selectedMember.phoneNumber, '_blank');
                          } else {
                            triggerToast("This member has an invalid WhatsApp number format.", "error");
                          }
                        }}
                        className={`inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 py-3 px-4 rounded-xl text-xs font-black text-white active:scale-98 transition text-center cursor-pointer min-h-[44px] ${
                          !isValidWhatsAppNumber(selectedMember.phoneNumber) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        id="member-whatsapp-button"
                      >
                        <MessageSquare className="w-4 h-4 text-white" />
                        <span>WhatsApp</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 font-bold italic pt-2 text-center select-none">
                    No public contact number shared by this member.
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
