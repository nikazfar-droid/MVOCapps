import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Wrench, 
  Sparkles, 
  Settings2, 
  Fuel, 
  Tag, 
  Gift, 
  Star, 
  MapPin, 
  Phone, 
  Copy, 
  Check, 
  X, 
  ChevronRight, 
  ArrowRight,
  ExternalLink,
  Award,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDoc, updateDoc, runTransaction, increment, collectionGroup, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import { compressImageToWebP } from '../lib/imageUtils';

export interface MerchantItem {
  id: any;
  name: string;
  category: 'Service & Repair' | 'Premium Detailing' | 'Accessories & Mods' | 'Fuel & Care' | string;
  rating: number;
  image: string;
  discount: string;
  discountType: 'gold' | 'standard' | 'featured' | string;
  promotionalText: string;
  promoCode: string;
  description: string;
  address: string;
  mapLink?: string;
  phone: string;
  website: string;
  workingHours: string;
  terms: string[];
  createdBy?: string;
  isDeletedFromStaticList?: boolean;
  status?: 'active' | 'pending';
  registered_by_admin_id?: string;
  registered_by_admin_name?: string;
}

interface MerchantPartnersProps {
  triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  userTier?: 'GOLD' | 'STANDARD';
  isAdmin?: boolean;
  currentUserRole?: string;
  currentUserId?: string;
  appConfig?: Record<string, boolean>;
}

const MERCHANT_DATA: MerchantItem[] = [
  {
    id: 1,
    name: 'Veloz Auto Care',
    category: 'Service & Repair',
    rating: 4.8,
    image: 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png',
    discount: '10% Off Standard Service Menu',
    discountType: 'standard',
    promotionalText: 'Get 10% discount on standard service packages including oil changes, filter replacement, and multi-point vehicle checks.',
    promoCode: 'MVOCVELOZ10',
    description: 'A certified modern automotive hub specializing in comprehensive vehicle maintenance, diagnostics, and performance servicing for all modern passenger cars. Equipped with modern OBD diagnostics tools tailored for modern vehicles.',
    address: 'Lot 12, Jalan Perindustrian USJ 1/3, Taman Perindustrian USJ 1, 47600 Subang Jaya, Selangor',
    phone: '+60 3-8024 9922',
    website: 'https://mvoc-velozautocare.com',
    workingHours: 'Mon - Sat: 9:00 AM - 6:00 PM (Closed on Sundays)',
    terms: [
      'Applicable upon presenting your active digital MVOC membership card.',
      'Discount is only applicable to labour charges and mineral/semi-synthetic service packages.',
      'Cannot be combined with other active monthly workshop promotions.'
    ]
  },
  {
    id: 2,
    name: 'Shine Master KL',
    category: 'Premium Detailing',
    rating: 4.9,
    image: 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png',
    discount: '15% Off Coating (Gold Members)',
    discountType: 'gold',
    promotionalText: 'Exclusive 15% discount on ultra-hard ceramic coatings and paint protection film (PPF) packages for prestigious Gold Tier members.',
    promoCode: 'SHINEGOLD15',
    description: 'Kuala Lumpur’s leading enthusiast-grade detailing studio. Using only premium multi-layer quartz elements to preserve and amplify your vehicle’s clear coat depth, shine, and hydrophobic protection properties.',
    address: 'Block E-G-05, Boulevard Business Park, Jalan Kuching, 51200 Kuala Lumpur',
    phone: '+60 12-385 4911',
    website: 'https://shinemasterkl.com',
    workingHours: 'Daily: 10:00 AM - 8:00 PM',
    terms: [
      'Specifically tailored for Gold Tier MVOC members with valid digital cards.',
      'Prior booking is strictly required at least 3 days in advance.',
      'Applicable to full-body detailing premium ceramic coatings and PPF applications.'
    ]
  },
  {
    id: 3,
    name: 'Aero Dynamics Kit',
    category: 'Accessories & Mods',
    rating: 4.7,
    image: 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png',
    discount: 'Free Installation on Bodykits',
    discountType: 'featured',
    promotionalText: 'Purchase any aerodynamic splitters, spoilers, side skirts, or custom performance mod kits and get professional fitting absolutely free.',
    promoCode: 'AEROFREEFIT',
    description: 'Your premier aesthetic upgrade destination. Specializing in high-fidelity custom fiber and durable injection-molded ABS plastic body kits, custom splitters, spoilers, and performance stance adjustments.',
    address: 'No. 45, Jalan Sunway 2/43, Bandar Sunway, 46150 Petaling Jaya, Selangor',
    phone: '+60 3-5611 8831',
    website: 'https://aerodynamicskit.my',
    workingHours: 'Mon - Sat: 10:00 AM - 7:00 PM (Closed on Sundays)',
    terms: [
      'Offer valid on full bodykit set purchases only.',
      'Not applicable for individual lip spoilers or cosmetic carbon fiber trims.',
      'Fitting must be done on-site at Bandar Sunway HQ location.'
    ]
  },
  {
    id: 4,
    name: 'Formula Performance Tuning',
    category: 'Service & Repair',
    rating: 4.6,
    image: 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png',
    discount: 'Free Exhaust Diagnostics & Tuning Review',
    discountType: 'standard',
    promotionalText: 'Get complementary engine diagnostics check, exhaust air-flow evaluation, and custom tuning consultation from race engineers.',
    promoCode: 'FORMULATUNING',
    description: 'High-performance tuning, professional engine mapping, state-of-the-art dynamometer testing, and custom exhaust fabrication for car owners seeking improved performance, fuel mapping accuracy, and throttle response curves.',
    address: 'Lot 104, Jalan Industri Semenyih 3, Kawasan Perindustrian Semenyih, 43500 Semenyih, Selangor',
    phone: '+60 17-688 8421',
    website: 'https://formulaperformance.my',
    workingHours: 'Tue - Sun: 11:00 AM - 8:00 PM',
    terms: [
      'Open to all registered vehicles with active MVOC membership.',
      'Dyno sessions are charged separately at a discounted rate of RM150/session.',
      'Dyno slots must be scheduled beforehand to secure dedicated engineer allocation.'
    ]
  },
  {
    id: 5,
    name: 'CarSpa Detailing Penang',
    category: 'Premium Detailing',
    rating: 4.8,
    image: 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png',
    discount: '10% Off Ceramic Coating Packages',
    discountType: 'standard',
    promotionalText: 'Treat your car to supreme polish and paint corrections and save 10% flat across all durable hard compound ceramic coatings.',
    promoCode: 'PENANGSPACAR',
    description: 'Penang island’s highly trusted wash and detailing salon. Specializing in extensive deep interior leather treatments, paint correction, steam sterilization, and premium durable windshield rain guard coatings.',
    address: 'No. 2-A, Jalan Kelawai, Georgetown, 10250 Penang',
    phone: '+60 4-227 0013',
    website: 'https://carspapenang.my',
    workingHours: 'Daily: 9:30 AM - 7:30 PM',
    terms: [
      'Applicable atorgetown outlet.',
      'Must purchase at least a Silver tier coating series to activate 10% discount.',
      'Interior detailing packages can be compounded with this offer.'
    ]
  },
  {
    id: 6,
    name: 'Apex Fuel & Tyres',
    category: 'Fuel & Care',
    rating: 4.5,
    image: 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png',
    discount: 'RM30 Voucher on Premium Tyres (Set of 4)',
    discountType: 'standard',
    promotionalText: 'Purchase a set of 4 premium high-performance tyres (Michelin, Continental, or Bridgestone) and get instant RM30 flat discount along with free alignment.',
    promoCode: 'APEXTYRES30',
    description: 'Expert tyre alignment, computerized electronic balancing, nitrogen inflation rigs, suspension bushings inspection, and certified battery replacements. Trusted suppliers of high-grip performance radials.',
    address: 'Ground Floor, No. 129, Jalan Puteri 5/1, Bandar Puteri Puchong, 47100 Puchong, Selangor',
    phone: '+60 3-8061 2488',
    website: 'https://apexautoandtyre.com',
    workingHours: 'Mon - Sat: 9:00 AM - 7:00 PM',
    terms: [
      'Applicable on standard sizing tyres only (15-inch wheel profiles and above).',
      'Free high-precision alignment and 3D wheel balancing are bundled automatically.',
      'Cannot be used in conjunction with ongoing brand-specific distributor campaigns.'
    ]
  }
];

export default function MerchantPartners({ triggerToast, userTier = 'GOLD', isAdmin = false, currentUserRole = 'member', currentUserId = '', appConfig }: MerchantPartnersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedMerchant, setSelectedMerchant] = useState<MerchantItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [dbMerchants, setDbMerchants] = useState<MerchantItem[]>([]);
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<MerchantItem | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDiscount, setFormDiscount] = useState('');
  const [formDiscountType, setFormDiscountType] = useState('standard');
  const [formPromoCode, setFormPromoCode] = useState('');
  const [formPromotionalText, setFormPromotionalText] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formWorkingHours, setFormWorkingHours] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMapLink, setFormMapLink] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImageUrl, setFormImageUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Rated Merchants Tracking state
  const [ratedMerchantIds, setRatedMerchantIds] = useState<Set<string>>(new Set());
  const [deletingMerchantItem, setDeletingMerchantItem] = useState<MerchantItem | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // Watch for rated merchants by the logged-in user
  useEffect(() => {
    if (!currentUserId) {
      setRatedMerchantIds(new Set());
      return;
    }
    try {
      const ratingsRef = collectionGroup(db, 'merchantRatings');
      const q = query(ratingsRef, where('userId', '==', currentUserId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ratedIds = new Set<string>();
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.merchantId) {
            ratedIds.add(String(data.merchantId));
          }
        });
        setRatedMerchantIds(ratedIds);
      }, (err) => {
        console.warn("Failed to load user rated merchants list:", err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("CollectionGroup query error for ratings:", e);
    }
  }, [currentUserId]);

  useEffect(() => {
    const merchantsRef = collection(db, 'merchants');
    const unsubscribe = onSnapshot(merchantsRef, (snapshot) => {
      const list: MerchantItem[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          name: data.name || '',
          category: data.category || 'Service & Repair',
          rating: data.rating || 5,
          image: data.image || 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png',
          discount: data.discount || '',
          discountType: data.discountType || 'standard',
          promotionalText: data.promotionalText || '',
          promoCode: data.promoCode || '',
          description: data.description || '',
          address: data.address || '',
          phone: data.phone || '',
          website: data.website || '',
          mapLink: data.mapLink || '',
          workingHours: data.workingHours || '',
          terms: data.terms || [],
          createdBy: data.createdBy || '',
          isDeletedFromStaticList: data.isDeletedFromStaticList || false,
          status: data.status || 'active',
          registered_by_admin_id: data.registered_by_admin_id || data.createdBy || 'system',
          registered_by_admin_name: data.registered_by_admin_name || (data.createdBy === 'system' ? 'System' : 'Jawatankuasa MVOC')
        });
      });
      setDbMerchants(list);
    }, (err) => {
      console.error("Failed to load merchants:", err);
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEditingMerchant(null);
    setFormName('');
    setFormCategory('Service & Repair');
    setFormDiscount('');
    setFormDiscountType('standard');
    setFormPromoCode('');
    setFormPromotionalText('');
    setFormDescription('');
    setFormWorkingHours('');
    setFormPhone('');
    setFormAddress('');
    setFormMapLink('');
    setFormWebsite('');
    setFormImageFile(null);
    setFormImageUrl('');
    setIsAddEditModalOpen(true);
  };

  const openEditModal = (m: MerchantItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMerchant(m);
    setFormName(m.name);
    setFormCategory(m.category);
    setFormDiscount(m.discount);
    setFormDiscountType(m.discountType);
    setFormPromoCode(m.promoCode);
    setFormPromotionalText(m.promotionalText);
    setFormDescription(m.description);
    setFormWorkingHours(m.workingHours);
    setFormPhone(m.phone);
    setFormAddress(m.address);
    setFormMapLink(m.mapLink || '');
    setFormWebsite(m.website);
    setFormImageFile(null);
    setFormImageUrl(m.image || '');
    setIsAddEditModalOpen(true);
  };

  const handleDeleteMerchant = (merchant: MerchantItem, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check static merchant
    if (String(merchant.id).length < 10) {
      if (currentUserRole !== 'super_admin') {
        triggerToast('Static default merchants cannot be deleted by standard Admins.', 'error');
        return;
      }
    }
    
    // Authorization Check for standard admins
    if (currentUserRole !== 'super_admin' && merchant.createdBy !== currentUserId) {
      triggerToast('Security Error: You are only authorized to delete merchants you created.', 'error');
      return;
    }

    setDeletingMerchantItem(merchant);
    setDeleteConfirmInput('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingMerchantItem) return;
    if (deleteConfirmInput !== 'DELETE') {
      triggerToast('Incorrect confirmation text. Please type "DELETE" to confirm.', 'error');
      return;
    }

    try {
      if (String(deletingMerchantItem.id).length < 10) {
        // For static merchants, we mark them as explicitly deleted in firestore
        await setDoc(doc(db, 'merchants', String(deletingMerchantItem.id)), { isDeletedFromStaticList: true }, { merge: true });
      } else {
        // For db merchants, we just delete the document
        await deleteDoc(doc(db, 'merchants', String(deletingMerchantItem.id)));
      }
      triggerToast('Merchant successfully deleted', 'success');
      if (selectedMerchant?.id === deletingMerchantItem.id) {
        setSelectedMerchant(null);
      }
      setDeletingMerchantItem(null);
      setDeleteConfirmInput('');
    } catch (err: any) {
      triggerToast(`Failed to delete merchant: ${err.message}`, 'error');
    }
  };

  const handleRateMerchant = async (merchant: MerchantItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) {
      triggerToast('Please log in to rate merchants.', 'warning');
      return;
    }

    const merchantIdStr = String(merchant.id);
    if (ratedMerchantIds.has(merchantIdStr)) {
      triggerToast('You have already rated this merchant', 'warning');
      return;
    }

    try {
      // 1. Redundant double-check against Firestore subcollection
      const docId = `${merchant.id}_${currentUserId}`;
      const ratingDocRef = doc(db, 'merchants', merchantIdStr, 'merchantRatings', docId);
      const ratingDocSnap = await getDoc(ratingDocRef);
      if (ratingDocSnap.exists()) {
        triggerToast('You have already rated this merchant', 'warning');
        setRatedMerchantIds(prev => new Set([...prev, merchantIdStr]));
        return;
      }

      triggerToast('Casting your rating vote...', 'info');

      // 2. runTransaction to safely execute update and record create
      await runTransaction(db, async (transaction) => {
        const merchantRef = doc(db, 'merchants', merchantIdStr);
        const merchantSnap = await transaction.get(merchantRef);

        if (!merchantSnap.exists()) {
          // Initialize static merchant in database if not present yet
          transaction.set(merchantRef, {
            name: merchant.name,
            category: merchant.category,
            rating: 1, // It's being rated for the first time, start from 1
            image: merchant.image,
            discount: merchant.discount,
            discountType: merchant.discountType,
            promotionalText: merchant.promotionalText || '',
            promoCode: merchant.promoCode || '',
            description: merchant.description || '',
            address: merchant.address || '',
            phone: merchant.phone || '',
            website: merchant.website || '',
            workingHours: merchant.workingHours || '',
            terms: merchant.terms || [],
            createdBy: 'system',
            createdAt: serverTimestamp()
          });
        } else {
          // a) Increment rating using transaction.update (the correct transactional equivalent of updateDoc)
          transaction.update(merchantRef, { rating: increment(1) });
        }

        // b) Create vote trace document in the merchantRatings sub-collection: Document ID: merchantId_uid
        const rRef = doc(db, 'merchants', merchantIdStr, 'merchantRatings', docId);
        transaction.set(rRef, {
          merchantId: merchantIdStr,
          userId: currentUserId,
          votedAt: serverTimestamp()
        });
      });

      // Update real-time state for instantaneous UI rendering
      setRatedMerchantIds(prev => {
        const next = new Set(prev);
        next.add(merchantIdStr);
        return next;
      });
      triggerToast('Rating successfully cast! Thank you.', 'success');
    } catch (err: any) {
      console.error("Failed to cast rating:", err);
      // Fallback update if the transaction was interrupted of some other error
      triggerToast(`Rating failed: ${err.message}`, 'error');
    }
  };

  const handleSaveMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDiscount.trim()) {
      triggerToast('Name and Discount fields are required.', 'warning');
      return;
    }

    try {
      setIsSaving(true);
      
      let finalImageUrl = formImageUrl || 'https://raw.githubusercontent.com/nikazfar-droid/MVOCapps/Developer/assets/images/cars/veloz-600x338.png';
      if (formImageFile) {
        triggerToast('Memampat imej (WebP)...', 'info');
        const compressedFile = await compressImageToWebP(formImageFile, 1024, 0.85); // Had saiz 1024px, 85% kualiti
        triggerToast('Memuat naik gambar WebP...', 'info');
        const fileRef = ref(storage, `merchants/${Date.now()}_${compressedFile.name}`);
        const snapshot = await uploadBytesResumable(fileRef, compressedFile);
        finalImageUrl = await getDownloadURL(snapshot.ref);
      }

      if (editingMerchant) {
        if (String(editingMerchant.id).length < 10) {
            if (currentUserRole !== 'super_admin') {
              triggerToast('Static default merchants cannot be edited by standard Admins.', 'error');
              setIsSaving(false);
              return;
            }
        }
        await setDoc(doc(db, 'merchants', String(editingMerchant.id)), {
          name: formName,
          category: formCategory,
          discount: formDiscount,
          discountType: formDiscountType,
          promoCode: formPromoCode,
          promotionalText: formPromotionalText,
          description: formDescription,
          workingHours: formWorkingHours,
          phone: formPhone,
          address: formAddress,
          mapLink: formMapLink,
          website: formWebsite,
          image: finalImageUrl,
          updatedAt: serverTimestamp()
        }, { merge: true });
        triggerToast('Merchant successfully updated', 'success');
      } else {
        let registeredName = 'Admin';
        if (currentUserId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', currentUserId));
            if (userSnap.exists()) {
              registeredName = userSnap.data().name || 'Admin';
            }
          } catch (e) {
            console.warn("Failed to fetch admin name:", e);
          }
        }
        
        const initialStatus = currentUserRole === 'super_admin' ? 'active' : 'pending';
        const id = 'm_gen_' + Math.random().toString(36).substring(2, 11);
        
        await setDoc(doc(db, 'merchants', id), {
          name: formName,
          category: formCategory,
          rating: 0,
          image: finalImageUrl,
          discount: formDiscount,
          discountType: formDiscountType,
          promoCode: formPromoCode,
          promotionalText: formPromotionalText,
          description: formDescription,
          workingHours: formWorkingHours,
          phone: formPhone,
          address: formAddress,
          mapLink: formMapLink,
          website: formWebsite,
          terms: [],
          createdBy: currentUserId || 'system',
          registered_by_admin_id: currentUserId || 'system',
          registered_by_admin_name: registeredName,
          status: initialStatus,
          createdAt: serverTimestamp()
        });

        if (currentUserId) {
          try {
            await updateDoc(doc(db, 'users', currentUserId), {
              last_event_created_date: new Date().toISOString()
            });
          } catch (err) {
            console.warn("Failed to update last_event_created_date for admin:", err);
          }
        }
        
        if (initialStatus === 'pending') {
          triggerToast('Merchant added! Pending verification by Super Admin.', 'success');
        } else {
          triggerToast('Merchant added and is now active.', 'success');
        }
      }
      setIsAddEditModalOpen(false);
    } catch (err: any) {
      triggerToast(`Failed to save merchant: ${err.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter Categories list matching short clean tab labels
  const categories = ['All', 'Detailing', 'Service', 'Accessories', 'Fuel'];

  // Identify explicitly deleted static merchants
  const deletedStaticIds = new Set(dbMerchants.filter(m => m.isDeletedFromStaticList).map(m => String(m.id)));
  
  // Exclude deleted static merchants and the tombstone records themselves
  const filteredDbMerchants = dbMerchants.filter(m => {
    if (m.isDeletedFromStaticList) return false;
    if (!isAdmin && m.status === 'pending') return false;
    return true;
  });
  const filteredStaticMerchants = MERCHANT_DATA.filter(m => !deletedStaticIds.has(String(m.id)));

  // Match items based on query and category selection
  const combinedMerchants = [...filteredStaticMerchants, ...filteredDbMerchants];
  const filteredMerchants = combinedMerchants.filter((m) => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.discount.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || (() => {
      const catLower = selectedCategory.toLowerCase();
      const mCatLower = m.category.toLowerCase();
      if (catLower === 'detailing') return mCatLower.includes('detailing');
      if (catLower === 'service') return mCatLower.includes('service') || mCatLower.includes('repair');
      if (catLower === 'accessories') return mCatLower.includes('accessories') || mCatLower.includes('mods');
      if (catLower === 'fuel') return mCatLower.includes('fuel') || mCatLower.includes('care');
      return mCatLower.includes(catLower);
    })();

    return matchesSearch && matchesCategory;
  });

  // Handle promo code copy
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      triggerToast('Promo code successfully copied to clipboard!', 'success');
      setTimeout(() => setCopiedCode(false), 2000);
    }).catch(() => {
      triggerToast('Failed to copy. Please copy manually.', 'error');
    });
  };

  // Render correct badge styling for discount boxes
  const getOfferBoxStyle = (type: string) => {
    switch (type) {
      case 'gold':
        return {
          bg: 'bg-amber-50/75 border border-amber-200/60',
          text: 'text-amber-900 font-bold',
          icon: <Award className="w-4.5 h-4.5 text-amber-600 shrink-0" />
        };
      case 'featured':
        return {
          bg: 'bg-green-50/75 border border-green-200/60',
          text: 'text-green-900 font-bold',
          icon: <Gift className="w-4.5 h-4.5 text-green-600 shrink-0" />
        };
      default:
        return {
          bg: 'bg-blue-50/75 border border-blue-200/60',
          text: 'text-[#0F2D52] font-semibold',
          icon: <Tag className="w-4.5 h-4.5 text-blue-600 shrink-0" />
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION WRITTEN IN PURE ENGLISH */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-3xs text-left space-y-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black text-[#0F2D52] tracking-tight">
            Merchant Partners
          </h2>
          <p className="text-slate-500 text-[12px] md:text-xs font-semibold leading-relaxed mt-1">
            Discover exclusive benefits and discounts at certified MVOC workshops and detailing centers across Malaysia.
          </p>
        </div>
        {isAdmin && (
           <button
             onClick={openAddModal}
             className="bg-[#0f2d52] hover:bg-[#001835] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm shadow-[#0f2d52]/20 shrink-0 flex items-center justify-center gap-2 transition"
           >
             <Plus className="w-4 h-4" />
             Add Merchant
           </button>
        )}
      </div>

      {/* SEARCH COMPONENT MATCHING THE DESIGN SYSTEM */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-4.5 w-4.5 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search partners, services..."
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-450 focus:outline-hidden focus:ring-2 focus:ring-[#0F2D52] focus:border-[#0F2D52] shadow-3xs transition-all"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 inset-y-0 flex items-center text-slate-400 hover:text-slate-650 min-h-[44px]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* HORIZONTAL CATEGORY FILTER CHIPS WITH A MINIMUM HEIGHT OF 44px */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none snap-x select-none text-left">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const displayLabel = cat === 'All' ? 'All Partners' : cat;

          return (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                triggerToast(`Filtering by: ${displayLabel}`, 'info');
              }}
              className={`px-4 shrink-0 h-[44px] rounded-xl text-[11px] md:text-xs font-bold tracking-tight border shadow-3xs snap-start transition cursor-pointer ${
                isActive
                  ? 'bg-[#0F2D52] text-white border-[#0F2D52]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>

      {/* LIST OF AVAILABLE SERVICE MERCHANTS IN 2-COLUMN GRID */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5">
        {filteredMerchants.length > 0 ? (
          filteredMerchants.map((merchant) => {
            const isGoldOffer = merchant.discountType === 'gold';
            const cardStyles = getOfferBoxStyle(merchant.discountType);

            return (
              <div 
                key={merchant.id}
                id={`merchant-card-${merchant.id}`}
                className="bg-white rounded-2xl overflow-hidden border border-slate-150 shadow-3xs hover:shadow-xs transition duration-300 text-left flex flex-col group relative"
              >
                {/* Image layout container with 4:3 aspect ratio & rating overlay */}
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100 shrink-0">
                  <img 
                    src={merchant.image} 
                    alt={merchant.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Rating Tag Overlaid top-right */}
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    {isAdmin && (
                      <>
                        <button
                          onClick={(e) => openEditModal(merchant, e)}
                          className="bg-white/95 backdrop-blur-xs w-6 h-6 rounded-full shadow-md border border-slate-100 flex items-center justify-center hover:bg-slate-100 transition"
                        >
                          <Pencil className="w-3 h-3 text-[#0f2d52]" />
                        </button>
                        {(currentUserRole === 'super_admin' || merchant.createdBy === currentUserId) && (
                          <button
                            onClick={(e) => handleDeleteMerchant(merchant, e)}
                            className="bg-white/95 backdrop-blur-xs w-6 h-6 rounded-full shadow-md border border-red-155 flex items-center justify-center hover:bg-red-50 transition"
                          >
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={(e) => handleRateMerchant(merchant, e)}
                      disabled={ratedMerchantIds.has(String(merchant.id))}
                      className={`backdrop-blur-xs px-1.5 py-0.5 rounded-lg shadow-md border flex items-center justify-center gap-1 h-6 select-none transition-all duration-200 active:scale-110 cursor-pointer ${
                        ratedMerchantIds.has(String(merchant.id))
                          ? 'bg-amber-500 border-amber-450 text-white shadow-[0_0_8px_rgba(245,158,11,0.5)] opacity-95 cursor-default'
                          : 'bg-white/95 border-slate-100 text-slate-800 hover:bg-amber-50/70 hover:border-amber-250 hover:text-amber-650 shadow-3xs'
                      }`}
                      title={ratedMerchantIds.has(String(merchant.id)) ? "You have already rated this Merchant" : "Click to rate"}
                    >
                      <Star className={`w-3 h-3 transition-all ${
                        ratedMerchantIds.has(String(merchant.id))
                          ? 'fill-white text-white scale-115'
                          : 'fill-amber-400 text-amber-400'
                      }`} />
                      <span className="text-[9px] font-black leading-none mt-0.5">
                        {merchant.rating % 1 === 0 ? merchant.rating : merchant.rating.toFixed(1)}
                      </span>
                    </button>
                  </div>

                  {/* Status and Promo Tags (Compact layout) */}
                  {merchant.status === 'pending' && (
                    <div className="absolute top-2 left-2 bg-amber-500 text-white border border-amber-400/30 px-1.5 py-0.5 rounded-md shadow-md z-10">
                      <span className="text-[7.5px] font-black tracking-wider uppercase leading-none">PENDING</span>
                    </div>
                  )}
                  {isGoldOffer && (
                    <div className={`absolute ${merchant.status === 'pending' ? 'top-8' : 'top-2'} left-2 bg-[#0F2D52] text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-md shadow-md flex items-center gap-0.5 z-10`}>
                      <Award className="w-2.5 h-2.5 text-amber-400 shrink-0 fill-amber-400" />
                      <span className="text-[7.5px] font-black tracking-wider uppercase leading-none">GOLD</span>
                    </div>
                  )}
                </div>

                {/* Content body container (Compact Grid Style) */}
                <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] font-sans font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-550 border border-slate-200/50 uppercase tracking-wider w-fit">
                        {merchant.category}
                      </span>
                      <h3 className="font-display text-xs md:text-sm font-black tracking-tight text-[#0F2D52] leading-tight line-clamp-1">
                        {merchant.name}
                      </h3>
                    </div>

                    {/* Visible Credit */}
                    <div className="text-[8.5px] text-slate-400 font-bold italic flex items-center gap-0.5">
                      <span>Oleh:</span>
                      <span className="text-[#0F2D52] not-italic font-extrabold truncate max-w-[80px]">
                        {merchant.registered_by_admin_name ? merchant.registered_by_admin_name.split(' ')[0] : 'Jawatankuasa'}
                      </span>
                    </div>

                    {/* Styled compact discount box */}
                    <div className={`p-2 rounded-xl flex items-center gap-1.5 ${cardStyles.bg}`}>
                      <div className="shrink-0">{cardStyles.icon}</div>
                      <span className={`text-[9px] tracking-tight leading-tight line-clamp-1 ${cardStyles.text}`}>
                        {merchant.discount}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Claim / View Info actions aligned properly */}
                  <div className="flex pt-1 mt-auto select-none">
                    {merchant.discountType === 'gold' ? (
                      <button
                        onClick={() => setSelectedMerchant(merchant)}
                        className="w-full bg-[#0F2D52] hover:bg-[#143964] text-white flex items-center justify-center gap-1 font-bold text-[10px] h-[34px] rounded-lg transition shadow-xs cursor-pointer"
                      >
                        <span>Claim</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedMerchant(merchant)}
                        className="w-full bg-white hover:bg-slate-50 text-[#0F2D52] border border-slate-205 flex items-center justify-center gap-1 font-bold text-[10px] h-[34px] rounded-lg transition shadow-3xs cursor-pointer"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-3xl p-10 border border-slate-200/80 text-center space-y-3">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No partner merchants found</p>
            <p className="text-xs text-slate-500 leading-normal max-w-xs mx-auto">
              We couldn't find any merchant accounts matching your query. Try searching for other terms or reset the filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
                triggerToast('Search criteria reset successfully!', 'info');
              }}
              className="mt-2 text-xs font-extrabold text-[#0F2D52] hover:underline"
            >
              Reset Search & Filter
            </button>
          </div>
        )}
      </div>

      {/* Jom Jadi Rakan Strategik Banner */}
      {appConfig?.sponsorship !== false && (
      <div className="mt-8 relative overflow-hidden rounded-[24px] shadow-lg shadow-blue-900/10 border border-[#0F2D52]/10 bg-gradient-to-br from-[#0F2D52] to-[#1a427b] text-white">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-40"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-blue-400 rounded-full mix-blend-multiply filter blur-[60px] opacity-30"></div>
        
        <div className="relative p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6 md:gap-8 text-center md:text-left z-10">
          <div className="w-16 h-16 shrink-0 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
            <Gift className="w-8 h-8 text-amber-400" />
          </div>
          
          <div className="flex-1 space-y-2">
            <h3 className="font-display text-2xl font-black tracking-tight text-white drop-shadow-sm">
              Jom Jadi Rakan Strategik MVOC
            </h3>
            <p className="text-blue-100 text-[13px] sm:text-sm font-medium leading-relaxed max-w-lg mx-auto md:mx-0">
              Perkasakan jenama perniagaan anda ke ribuan pemilik kenderaan Vios di seluruh Malaysia. Dapatkan capaian premium sebagai 'Featured Merchant'.
            </p>
          </div>
          
          <div className="shrink-0 w-full md:w-auto">
            <a 
              href="/partner" 
              className="inline-flex items-center justify-center w-full md:w-auto px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-[#0F2D52] font-black text-sm uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:shadow-[0_0_25px_rgba(251,191,36,0.5)] transition-all hover:-translate-y-0.5 active:scale-95"
            >
              Mohon Sekarang
              <ChevronRight className="w-4 h-4 ml-1 -mr-1" />
            </a>
          </div>
        </div>
      </div>
      )}

      {/* DETAIL MODAL WINDOW SCREEN - DETAILED WITH WORKBENCH INFRASTRUCTURE */}
      <AnimatePresence>
        {selectedMerchant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop cover overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMerchant(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              id="merchant-modal-backdrop"
            />

            {/* Modal Body container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden z-10 flex flex-col border border-slate-100 max-h-[90vh]"
              id="merchant-modal-body"
            >
              {/* Header block with cover picture and close button overlay */}
              <div className="relative h-48 shrink-0 bg-slate-100">
                <img 
                  src={selectedMerchant.image} 
                  alt={selectedMerchant.name} 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                
                {/* Close Button X Overlaid top-right */}
                <button
                  onClick={() => setSelectedMerchant(null)}
                  className="absolute top-4 right-4 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full border border-white/10 flex items-center justify-center text-white transition cursor-pointer"
                  id="merchant-close"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Overlaid Title and Info */}
                <div className="absolute bottom-4 left-5 right-5 text-left text-white space-y-1.5">
                  <span className="text-[9px] font-extrabold px-2 py-0.5 roundedbg-amber-400 text-slate-950 uppercase tracking-widest bg-amber-400">
                    {selectedMerchant.category}
                  </span>
                  <h3 className="font-display text-xl font-black tracking-tight drop-shadow-md">
                    {selectedMerchant.name}
                  </h3>
                </div>
              </div>

              {/* Scrollable details container */}
              <div className="p-5 space-y-5 overflow-y-auto min-h-0 text-left">
                {/* Highlight discount banner with copied trigger */}
                <div className="bg-slate-50/70 border border-slate-150 p-4 rounded-2xl space-y-3.5">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase block">EXCLUSIVE DISCOUNT</span>
                    <p className="text-base font-black text-[#0F2D52] tracking-tight">
                      {selectedMerchant.discount}
                    </p>
                  </div>
                  
                  {/* Promo Copy section */}
                  <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-extrabold text-slate-400 tracking-wider block">PROMO CODE</span>
                      <code className="text-xs font-mono font-bold tracking-wider text-slate-700 bg-slate-150 px-2.5 py-1 rounded-md">
                        {selectedMerchant.promoCode}
                      </code>
                    </div>

                    <button
                      onClick={() => handleCopyCode(selectedMerchant.promoCode)}
                      className="shrink-0 flex items-center gap-1.5 bg-[#0F2D52] hover:bg-[#153964] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-3xs cursor-pointer transition"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* About & Description detail */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-400 tracking-widest uppercase">ABOUT CHANNEL</h4>
                  <p className="text-slate-600 text-xs font-medium leading-relaxed">
                    {selectedMerchant.description}
                  </p>
                  <p className="text-[#0F2D52] bg-[#EBF2FC]/60 text-xs font-semibold rounded-xl p-3 border border-slate-100">
                    {selectedMerchant.promotionalText}
                  </p>
                </div>

                {/* Business Directory Info (Address, Phone, Operating Hours) */}
                <div className="space-y-3 pt-1 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-400 tracking-widest uppercase">LOCATION & HOURS</h4>
                  
                  <div className="space-y-2.5 text-xs text-slate-600 font-medium">
                    {/* Location Pin */}
                    <div className="flex gap-2.5">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="leading-snug">{selectedMerchant.address}</span>
                        {selectedMerchant.mapLink && (
                          <a href={selectedMerchant.mapLink} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-600 font-bold text-[11px] mt-1 flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" />
                            Open in Google Maps
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Mobile Phone */}
                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <a href={`tel:${selectedMerchant.phone.replace(/\s+/g, '')}`} className="text-[#0F2D52] font-semibold hover:underline">
                        {selectedMerchant.phone}
                      </a>
                    </div>

                    {/* Operating timings */}
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="leading-none">{selectedMerchant.workingHours}</span>
                    </div>

                    {/* Web link */}
                    <div className="flex items-center gap-2.5">
                      <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                      <a 
                        href={selectedMerchant.website} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[#0F2D52] font-semibold hover:underline flex items-center gap-1"
                      >
                        <span>Visit Website</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Rules Regulations Terms & Conditions */}
                <div className="space-y-2.5 pt-1 border-t border-slate-100">
                  <h4 className="text-xs font-extrabold text-slate-400 tracking-widest uppercase">TERMS & CONDITIONS</h4>
                  <ul className="list-disc list-outside pl-4 space-y-1.5 text-xs text-slate-500 font-medium leading-relaxed">
                    {selectedMerchant.terms.map((term, index) => (
                      <li key={index} className="pl-0.5">{term}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Bottom Close Button wrapper panel */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 select-none">
                <button
                  onClick={() => setSelectedMerchant(null)}
                  className="w-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs h-[44px] rounded-xl flex items-center justify-center cursor-pointer transition"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddEditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddEditModalOpen(false)}
              className="absolute inset-0 bg-[#0b1c30]/60 backdrop-blur-sm cursor-pointer"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden max-h-[85vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 relative shrink-0">
                <div>
                   <h3 className="text-sm font-black text-[#0F2D52] tracking-tight uppercase">
                     {editingMerchant ? 'Edit Merchant Partner' : 'Add New Merchant Partner'}
                   </h3>
                </div>
                <button
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-[#0f2d52] hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
                <form id="merchant-form" onSubmit={handleSaveMerchant} className="space-y-4 text-left">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Merchant Name</label>
                    <input required type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Category</label>
                    <select value={formCategory} onChange={e => setFormCategory(e.target.value)} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition cursor-pointer">
                      <option value="Service & Repair">Service & Repair</option>
                      <option value="Premium Detailing">Premium Detailing</option>
                      <option value="Accessories & Mods">Accessories & Mods</option>
                      <option value="Fuel & Care">Fuel & Care</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Discount Title</label>
                    <input required type="text" value={formDiscount} onChange={e => setFormDiscount(e.target.value)} placeholder="e.g. 10% Off Standard Service" className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Promo Code</label>
                      <input type="text" value={formPromoCode} onChange={e => setFormPromoCode(e.target.value)} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition uppercase" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Discount Type</label>
                      <select value={formDiscountType} onChange={e => setFormDiscountType(e.target.value)} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition cursor-pointer">
                        <option value="standard">Standard Promo</option>
                        <option value="gold">Gold Exclusive</option>
                        <option value="featured">Featured Special</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Promotional Rules</label>
                    <textarea value={formPromotionalText} onChange={e => setFormPromotionalText(e.target.value)} rows={2} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition custom-scrollbar min-h-[60px]" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Description</label>
                    <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} rows={3} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition custom-scrollbar min-h-[80px]" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Promotional Image</label>
                    <div className="flex flex-col gap-2">
                       {formImageUrl && (
                          <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                            <img src={formImageUrl} alt="merchant preview" className="w-full h-full object-cover" />
                          </div>
                       )}
                       <input 
                         type="file" 
                         accept="image/*"
                         onChange={(e) => {
                           if (e.target.files && e.target.files[0]) {
                             setFormImageFile(e.target.files[0]);
                             const reader = new FileReader();
                             reader.onloadend = () => setFormImageUrl(reader.result as string);
                             reader.readAsDataURL(e.target.files[0]);
                           }
                         }} 
                         className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-2.5 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition cursor-pointer file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-[#0f2d52] file:text-white hover:file:bg-[#001835]" 
                       />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Working Hours</label>
                    <input type="text" value={formWorkingHours} onChange={e => setFormWorkingHours(e.target.value)} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Phone</label>
                    <input type="text" value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Google Maps Link</label>
                    <input type="url" value={formMapLink} onChange={e => setFormMapLink(e.target.value)} placeholder="https://maps.app.goo.gl/..." className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Website</label>
                    <input type="text" value={formWebsite} onChange={e => setFormWebsite(e.target.value)} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Address</label>
                    <textarea value={formAddress} onChange={e => setFormAddress(e.target.value)} rows={2} className="w-full bg-[#f8f9ff] text-xs font-semibold px-4 py-3 border border-[#c4c6cf]/55 rounded-xl outline-none focus:border-[#0f2d52] transition custom-scrollbar min-h-[60px]" />
                  </div>

                </form>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 shrink-0">
                <button
                  type="submit"
                  form="merchant-form"
                  disabled={isSaving}
                  className="w-full bg-[#0f2d52] hover:bg-[#001835] text-white font-bold text-xs h-[44px] rounded-xl flex items-center justify-center cursor-pointer transition shadow-md shadow-[#0f2d52]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Partner Configuration'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DELETE DIALOG */}
      <AnimatePresence>
        {deletingMerchantItem && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setDeletingMerchantItem(null);
                setDeleteConfirmInput('');
              }}
              className="absolute inset-0 bg-[#0b1c30]/70 backdrop-blur-xs cursor-pointer"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-red-50 text-left"
            >
              <div className="p-5 border-b border-red-50 flex items-center justify-between bg-red-50/50">
                <div className="flex items-center gap-2 text-red-600">
                  <Trash2 className="w-5 h-5" />
                  <h3 className="font-display text-sm font-black tracking-tight uppercase">
                    Confirm Partner Deletion
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setDeletingMerchantItem(null);
                    setDeleteConfirmInput('');
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-600 hover:text-white transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  Are you absolutely sure you want to delete <strong className="text-slate-800">{deletingMerchantItem.name}</strong>? This action is permanent and cannot be undone.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">
                    Type "DELETE" to confirm
                  </label>
                  <input 
                    type="text" 
                    value={deleteConfirmInput} 
                    onChange={e => setDeleteConfirmInput(e.target.value)} 
                    placeholder="Type DELETE"
                    className="w-full bg-[#fcf8f8] text-xs font-bold px-4 py-3 border border-red-100 rounded-xl outline-none focus:border-red-500 transition-all text-red-600 placeholder-red-300"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 select-none">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingMerchantItem(null);
                    setDeleteConfirmInput('');
                  }}
                  className="w-1/2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs h-[40px] rounded-xl flex items-center justify-center cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteConfirmInput !== 'DELETE'}
                  className="w-1/2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs h-[40px] rounded-xl flex items-center justify-center cursor-pointer transition shadow-md shadow-red-250"
                >
                  Delete Partner
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
