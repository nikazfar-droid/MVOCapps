import React, { useState } from 'react';
import { 
  Users, UserCog, QrCode, Megaphone, Trash2, ExternalLink, 
  RefreshCw, AlertTriangle, X, ShieldCheck 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SyncedUserProfile, formatMvocId } from '../lib/fetchAndSyncData';
import QREventScanner from './QREventScanner';

interface SuperAdminDashboardProps {
  currentUserRole?: string;
  isMasterAdmin?: boolean;
  appConfig?: Record<string, boolean>;
  onToggleModule?: (module: string) => Promise<void>;
  navigateToTab: (tab: string) => void;
  membersList: SyncedUserProfile[];
  fetchFirestoreUsers: () => Promise<void>;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  handleRunRewardsAudit?: () => Promise<void>;
  isAuditingRewards?: boolean;
  eventsList?: any[];
}

export default function SuperAdminDashboard({
  currentUserRole = 'member',
  isMasterAdmin = false,
  appConfig,
  onToggleModule,
  navigateToTab,
  membersList,
  fetchFirestoreUsers,
  triggerToast,
  handleRunRewardsAudit,
  isAuditingRewards = false
}: SuperAdminDashboardProps) {

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isDeleteRequestsModalOpen, setIsDeleteRequestsModalOpen] = useState(false);
  const [processingDeleteUid, setProcessingDeleteUid] = useState<string | null>(null);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<SyncedUserProfile | null>(null);
  const [confirmRejectUser, setConfirmRejectUser] = useState<SyncedUserProfile | null>(null);

  const [isRoleRequestsModalOpen, setIsRoleRequestsModalOpen] = useState(false);
  const [processingRoleUid, setProcessingRoleUid] = useState<string | null>(null);

  const deleteRequests = membersList.filter(u => u.requestDelete === true || u.status === 'delete_requested');
  const roleRequests = membersList.filter(u => u.roleRequest != null);

  const isAdminOrSuperAdmin = () => {
    return currentUserRole === 'super_admin' || currentUserRole === 'admin' || isMasterAdmin;
  };

  const handleApproveRoleRequest = async (targetUser: SyncedUserProfile) => {
    if (!targetUser.roleRequest) return;
    try {
      setProcessingRoleUid(targetUser.uid);
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        role: targetUser.roleRequest.role,
        roleRequest: null
      });
      triggerToast(`Berjaya menaik taraf ${targetUser.name} kepada ${targetUser.roleRequest.role.toUpperCase()}!`, 'success');
      await fetchFirestoreUsers();
    } catch (err: any) {
      triggerToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setProcessingRoleUid(null);
    }
  };

  const handleRejectRoleRequest = async (targetUser: SyncedUserProfile) => {
    try {
      setProcessingRoleUid(targetUser.uid);
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, {
        roleRequest: null
      });
      triggerToast(`Permohonan naik taraf untuk ${targetUser.name} telah ditolak.`, 'info');
      await fetchFirestoreUsers();
    } catch (err: any) {
      triggerToast(`Gagal: ${err.message}`, 'error');
    } finally {
      setProcessingRoleUid(null);
    }
  };

  const handleApproveDeleteRequest = async (targetUser: SyncedUserProfile) => {
    setProcessingDeleteUid(targetUser.uid);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        status: 'deleted',
        requestDelete: false
      });
      try {
        await deleteDoc(doc(db, 'Admin', targetUser.uid));
      } catch (err) {}
      
      triggerToast(`Akaun ${targetUser.name} telah berjaya ditukar status kepada 'Deleted'.`, 'success');
      await fetchFirestoreUsers();
      setConfirmDeleteUser(null);
    } catch (err: any) {
      triggerToast(`Gagal mengemaskini status pemadaman: ${err.message || String(err)}`, 'error');
    } finally {
      setProcessingDeleteUid(null);
    }
  };

  const handleRejectDeleteRequest = async (targetUser: SyncedUserProfile) => {
    setProcessingDeleteUid(targetUser.uid);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        requestDelete: false,
        status: 'active'
      });
      triggerToast(`Permohonan pemadaman akaun ${targetUser.name} telah ditolak.`, 'success');
      await fetchFirestoreUsers();
      setConfirmRejectUser(null);
    } catch (err: any) {
      triggerToast(`Gagal menolak permohonan: ${err.message || String(err)}`, 'error');
    } finally {
      setProcessingDeleteUid(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      {/* HEADER */}
      <div className="bg-[#0b1c30] p-6 rounded-3xl text-white shadow-xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-48 h-48 bg-amber-400 rounded-full mix-blend-multiply filter blur-[60px] opacity-30"></div>
        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-blue-400 rounded-full mix-blend-multiply filter blur-[40px] opacity-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
              <ShieldCheck className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white drop-shadow-md flex items-center gap-2">
                Super Admin Panel
                {isMasterAdmin && <span className="bg-amber-400 text-[#0F2D52] text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">MASTER</span>}
              </h1>
              <p className="text-sm font-medium text-slate-300">Hab pengurusan pusat & operasi teknikal kelab</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SEGMENT A: ADMIN CONTROL PANEL (Daily Use) */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col h-full min-w-0">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100">
              <UserCog className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#0F2D52] uppercase tracking-wide">Admin Control Panel</h2>
              <p className="text-xs font-semibold text-slate-500">Kawalan harian pentadbir (Daily Use)</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3 flex-1">
            <button
              onClick={() => navigateToTab('users')}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-[#0F2D52] text-slate-700 hover:text-white rounded-2xl border border-slate-200 hover:border-[#0F2D52] transition group text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 group-hover:text-amber-400 transition" />
                <div>
                  <span className="font-bold text-sm block">User Management</span>
                  <span className="text-[11px] opacity-70">Urus profil, peranan dan kelulusan keahlian</span>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => navigateToTab('qr')}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-[#0F2D52] text-slate-700 hover:text-white rounded-2xl border border-slate-200 hover:border-[#0F2D52] transition group text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <QrCode className="w-5 h-5 group-hover:text-amber-400 transition" />
                <div>
                  <span className="font-bold text-sm block">List QR Code</span>
                  <span className="text-[11px] opacity-70">Senarai kod QR rasmi untuk konvoi/acara</span>
                </div>
              </div>
            </button>
            
            <button
              onClick={() => navigateToTab('broadcast')}
              className="flex items-center justify-between p-4 bg-slate-50 hover:bg-[#0F2D52] text-slate-700 hover:text-white rounded-2xl border border-slate-200 hover:border-[#0F2D52] transition group text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Megaphone className="w-5 h-5 group-hover:text-amber-400 transition" />
                <div>
                  <span className="font-bold text-sm block">Broadcast Message</span>
                  <span className="text-[11px] opacity-70">Hantar notifikasi pengumuman ke semua ahli</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* SEGMENT B: TECHNICAL TOOLS (Master Admin Only) */}
        {(isMasterAdmin || currentUserRole === 'super_admin') ? (
        <div className="bg-slate-50 rounded-3xl p-6 shadow-inner border border-slate-200 flex flex-col h-full min-w-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
            <ShieldCheck className="w-24 h-24" />
          </div>
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center border border-amber-200">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">Technical Tools</h2>
              <p className="text-xs font-semibold text-slate-500">Khas untuk Master Admin sahaja</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 flex-1 relative z-10">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="p-3.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-2xl border border-slate-200 hover:border-emerald-300 transition flex flex-col gap-2 items-start cursor-pointer shadow-sm"
            >
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <QrCode className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xs">Event Scanner</span>
            </button>

            <button
              onClick={() => setIsDeleteRequestsModalOpen(true)}
              className={`p-3.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-2xl border transition flex flex-col gap-2 items-start cursor-pointer shadow-sm relative overflow-hidden ${
                deleteRequests.length > 0 ? 'border-rose-300 animate-pulse' : 'border-slate-200 hover:border-rose-300'
              }`}
            >
              <div className={`p-2 rounded-lg ${deleteRequests.length > 0 ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-600'}`}>
                <Trash2 className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xs">Rekues Padam</span>
              {deleteRequests.length > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shadow-md animate-bounce">
                  {deleteRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsRoleRequestsModalOpen(true)}
              className="relative p-3.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-2xl border border-slate-200 hover:border-amber-300 transition flex flex-col gap-2 items-start cursor-pointer shadow-sm"
            >
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xs">Role Upgrades</span>
              {roleRequests.length > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center justify-center shadow-md animate-bounce">
                  {roleRequests.length}
                </span>
              )}
            </button>

            <a
              href="https://docs.google.com/spreadsheets/d/1ZrZaf26p60i_n7ocJVp_yAw4xadNrjXodChaUWTrnmY/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 rounded-2xl border border-slate-200 hover:border-amber-300 transition flex flex-col gap-2 items-start cursor-pointer shadow-sm decoration-none"
            >
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <ExternalLink className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-xs">Google Sheet</span>
            </a>

            {handleRunRewardsAudit && (
            <button
              onClick={handleRunRewardsAudit}
              disabled={isAuditingRewards}
              className="p-3.5 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-2xl border border-slate-200 hover:border-indigo-300 transition flex flex-col gap-2 items-start cursor-pointer shadow-sm disabled:opacity-50"
            >
              <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                <RefreshCw className={`w-4 h-4 ${isAuditingRewards ? 'animate-spin' : ''}`} />
              </div>
              <span className="font-extrabold text-xs">Audit Rewards</span>
            </button>
            )}
          </div>

          {/* Module Configuration Toggles */}
          {appConfig && onToggleModule && (
            <div className="mt-4 pt-4 border-t border-slate-200 relative z-10 flex flex-col gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Module Configurations</span>
              
              <button
                onClick={() => onToggleModule('sponsorship')}
                className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer shadow-sm ${
                  appConfig.sponsorship !== false
                    ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${appConfig.sponsorship !== false ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300'}`}></div>
                  <span className={`text-xs font-bold ${appConfig.sponsorship !== false ? 'text-indigo-800' : 'text-slate-600'}`}>Sponsorship Module</span>
                </div>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${appConfig.sponsorship !== false ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-600'}`}>
                  {appConfig.sponsorship !== false ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          )}

        </div>
        ) : (
          <div className="bg-slate-50 rounded-3xl p-6 shadow-inner border border-slate-200 flex flex-col items-center justify-center text-center h-full relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none transition group-hover:scale-110">
              <ShieldCheck className="w-32 h-32" />
            </div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-slate-200/50 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Tiada Akses Master</h3>
              <p className="text-xs text-slate-500 max-w-[220px] mt-2 mb-6 font-medium">Segmen Technical Tools ini dikhususkan untuk kumpulan MASTER ADMIN sahaja.</p>
              <button
                onClick={() => triggerToast('Permohonan dihantar kepada Master Admin. Sila tunggu kelulusan.', 'info')}
                className="px-5 py-2.5 bg-[#0F2D52] hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                MINTA AKSES
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EVENT SCANNER MODAL */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[10005]">
          <QREventScanner onClose={() => setIsScannerOpen(false)} triggerToast={triggerToast} />
        </div>
      )}

      {/* VOLUNTARY DELETE REQUESTS AUDITING MODAL */}
      <AnimatePresence>
        {isDeleteRequestsModalOpen && (
          <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-[95vw] md:w-[500px] bg-[#0b1c30] text-white rounded-2xl border border-red-500/20 shadow-2xl p-5 md:p-6 z-10 flex flex-col gap-4 text-left select-none overflow-hidden font-sans"
            >
              <div className="flex justify-between items-center pb-2.5 border-b border-white/10">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse shrink-0" />
                  <h4 className="text-sm font-black uppercase tracking-wide">Permohonan Hapus Akaun ({deleteRequests.length})</h4>
                </div>
                <button 
                  onClick={() => setIsDeleteRequestsModalOpen(false)}
                  className="p-1 px-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer hover:scale-105 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                Berikut adalah senarai ahli yang telah menghantar permohonan pemadaman akaun secara sukarela. Super Admin boleh meluluskan untuk memadam secara kekal atau menolak permohonan tersebut.
              </p>

              {/* Google Sheets Hotlink */}
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <span className="font-extrabold block text-white text-[10px] uppercase tracking-wider">Manual Delete (Google Sheet)</span>
                  <p className="text-[10px] leading-relaxed text-slate-300">
                    Sila padam maklumat berkaitan pengguna di dalam Google Sheet MVOC utama secara manual.
                  </p>
                </div>
                <a
                  href="https://docs.google.com/spreadsheets/d/1ZrZaf26p60i_n7ocJVp_yAw4xadNrjXodChaUWTrnmY/edit?usp=sharing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg uppercase tracking-wider transition shrink-0 flex items-center gap-1 hover:scale-105 active:scale-95 cursor-pointer decoration-none"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Buka Sheet</span>
                </a>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent relative">
                {deleteRequests.length === 0 ? (
                  <div className="text-center py-8 bg-[#091524] rounded-xl border border-white/5">
                    <p className="text-xs text-slate-400 font-extrabold uppercase tracking-wider">Tiada Permohonan Aktif</p>
                    <p className="text-[10px] text-slate-500 mt-1">Semua permohonan pemadaman telah diselesaikan.</p>
                  </div>
                ) : (
                  deleteRequests.map((reqUser) => (
                    <div 
                      key={reqUser.uid} 
                      className="p-3 bg-[#081525] border border-red-500/10 hover:border-red-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-wrap items-center gap-2">
                          <span className="font-extrabold text-xs text-white uppercase">{reqUser.name}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-950/40 text-red-400 border border-red-900/30 rounded font-mono">
                            {formatMvocId(reqUser.mvocId)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">{reqUser.email}</p>
                        <p className="text-[9px] text-slate-505">Kumpulan/Chapter: {reqUser.chapter || "Tiada Chapter"}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          disabled={processingDeleteUid !== null}
                          onClick={() => setConfirmRejectUser(reqUser)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-bold text-[10px] rounded-lg tracking-wider uppercase transition cursor-pointer select-none"
                        >
                          Tolak
                        </button>
                        <button
                          disabled={processingDeleteUid !== null}
                          onClick={() => setConfirmDeleteUser(reqUser)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-extrabold text-[10px] rounded-lg tracking-wider uppercase transition cursor-pointer select-none flex items-center gap-1 shadow-sm"
                        >
                          {processingDeleteUid === reqUser.uid ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          <span>PADAM</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-white/10 pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDeleteRequestsModalOpen(false)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer"
                >
                  Tutup
                </button>
              </div>

              {/* Native Sub-Confirmation overlays inside modal */}
              <AnimatePresence>
                {confirmDeleteUser && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 z-[10006] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md rounded-2xl"
                  >
                    <div className="text-center p-5 bg-[#0c1e33] border border-red-500/30 rounded-2xl max-w-sm w-full space-y-4">
                      <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 text-rose-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
                        <Trash2 className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase text-red-500 tracking-wider">Sahkan Padam Akaun</h4>
                        <p className="text-[11px] text-slate-300 leading-normal font-semibold">
                          Adakah anda pasti mahu meluluskan pemadaman akaun untuk <span className="text-white font-extrabold">{confirmDeleteUser.name}</span> ({formatMvocId(confirmDeleteUser.mvocId || '')})? Status akaun mereka akan ditukar kepada 'Deleted' di dalam sistem.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteUser(null)}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition uppercase tracking-wider cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={processingDeleteUid !== null}
                          onClick={() => handleApproveDeleteRequest(confirmDeleteUser)}
                          className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {processingDeleteUid === confirmDeleteUser.uid ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'PADAM SEKARANG'
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {confirmRejectUser && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 z-[10006] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md rounded-2xl"
                  >
                    <div className="text-center p-5 bg-[#0c1e33] border border-amber-500/30 rounded-2xl max-w-sm w-full space-y-4">
                      <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase text-amber-500 tracking-wider">Tolak Permohonan</h4>
                        <p className="text-[11px] text-slate-300 leading-normal font-semibold">
                          Anda sedang menolak permohonan padam untuk <span className="text-white font-extrabold">{confirmRejectUser.name}</span>. Akaun ini akan kembali aktif dan rekues padam akan dibatalkan. Teruskan?
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmRejectUser(null)}
                          className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition uppercase tracking-wider cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={processingDeleteUid !== null}
                          onClick={() => handleRejectDeleteRequest(confirmRejectUser)}
                          className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl transition uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {processingDeleteUid === confirmRejectUser.uid ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            'TOLAK PERMOHONAN'
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ROLE UPGRADE REQUESTS MODAL */}
      {isRoleRequestsModalOpen && (
        <div className="fixed inset-0 z-[10010] flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#0f2d52]">Role Upgrade Requests</h2>
                  <p className="text-xs font-medium text-slate-500">Approve or reject admin promotion requests.</p>
                </div>
              </div>
              <button
                onClick={() => setIsRoleRequestsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1">
              {roleRequests.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-600 mb-1">Tiada Permohonan</h3>
                  <p className="text-xs text-slate-400">Tiada sebarang permohonan kenaikan pangkat admin setakat ini.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {roleRequests.map((u) => (
                    <div key={u.uid} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-black text-slate-800">{u.name}</h3>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                              {u.mvocId}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mb-2">
                            Current Role: <span className="font-bold uppercase">{u.role}</span> | Chapter: <span className="font-bold">{u.chapter}</span>
                          </div>
                          <div className="bg-amber-50 text-amber-700 px-3 py-2 rounded-lg text-xs font-bold flex flex-col gap-1 w-fit">
                            <span>Requested Role: {u.roleRequest?.role?.toUpperCase()}</span>
                            <span className="text-[10px] font-medium opacity-80">
                              Requested By: {u.roleRequest?.requestedBy} on {u.roleRequest?.requestedAt ? new Date(u.roleRequest.requestedAt).toLocaleDateString() : 'Unknown Date'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleRejectRoleRequest(u)}
                            disabled={processingRoleUid === u.uid}
                            className="px-4 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                          >
                            Tolak
                          </button>
                          <button
                            onClick={() => handleApproveRoleRequest(u)}
                            disabled={processingRoleUid === u.uid}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                          >
                            {processingRoleUid === u.uid ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                            Luluskan
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white flex justify-end shrink-0">
              <button
                onClick={() => setIsRoleRequestsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
