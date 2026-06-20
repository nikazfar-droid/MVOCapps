import React from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, LogOut, MessageSquare, Trash2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface BlockedNoticeProps {
  userEmail?: string;
  userMvocId?: string;
  userStatus?: string;
  onLogout: () => void;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function BlockedNotice({
  userEmail,
  userMvocId,
  userStatus = 'suspended',
  onLogout,
  triggerToast
}: BlockedNoticeProps) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      onLogout();
      triggerToast('Signed out of account successfully.', 'info');
    } catch (error) {
      console.error('Error signing out:', error);
      triggerToast('Failed to log out.', 'error');
    }
  };

  const isDeleted = userStatus === 'deleted' || userStatus === 'delete_requested';

  return (
    <div className="min-h-screen bg-[#050D1A] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background radial soft lights */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-red-950/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-10 left-1/4 w-[350px] h-[350px] bg-[#0b1c30]/40 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md bg-[#0B1C30]/90 border border-red-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-xl animate-fade-in"
        id="blocked-notice-card"
      >
        {/* Accent Glow Top Border */}
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${isDeleted ? 'from-amber-600 via-red-500 to-amber-600' : 'from-red-600 via-rose-500 to-red-600'} rounded-t-3xl`} />

        {/* Warning Icon Container */}
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 bg-red-950/30 border ${isDeleted ? 'border-amber-500/30 text-amber-500' : 'border-red-500/30 text-rose-500'} rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(239,68,68,0.15)]`}>
            {isDeleted ? <Trash2 className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
          </div>

          {/* Badge */}
          <div className={`mb-4 inline-flex items-center gap-1.5 ${isDeleted ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-red-500/10 border border-red-500/20'} px-3 py-1 rounded-full`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDeleted ? 'bg-amber-500' : 'bg-red-500'} animate-pulse`} />
            <span className={`text-[10px] font-black tracking-widest ${isDeleted ? 'text-amber-400' : 'text-[#FF4D4D]'} uppercase font-mono`}>
              {userStatus === 'delete_requested' ? 'Proses Pemadaman Akaun' : isDeleted ? 'Akaun Dipadam / Keluar Ahli' : 'Account Suspended'}
            </span>
          </div>

          {/* Content */}
          <h2 className="text-xl font-display font-black text-white tracking-tight mb-3">
            {isDeleted ? 'Anda Bukan Lagi Ahli MVOC' : 'Access Restricted'}
          </h2>
          
          <p className="text-[#A5BFCF] text-sm font-medium leading-relaxed mb-6">
            {userStatus === 'delete_requested'
              ? 'Permintaan pemadaman akaun anda sedang diproses. Segala keistimewaan keahlian dalam portal dan digital pass telah ditamatkan secara rasmi.'
              : isDeleted 
              ? 'Akaun MVOC-ID anda telah dipadam daripada pangkalan data secara rasmi atas permintaan anda atau tindakan pentadbiran. Segala keistimewaan keahlian telah ditamatkan.'
              : 'Your account has been suspended. Please contact the MVOC Administration for further assistance.'
            }
          </p>

          {/* Info panel */}
          {(userEmail || userMvocId) && (
            <div className="w-full bg-[#16243A]/60 border border-white/5 p-4 rounded-2xl mb-8 text-left space-y-2">
              <span className="text-[10px] font-bold text-slate-500 font-mono uppercase tracking-widest block">
                MEMBER DETAILS
              </span>
              <div className="space-y-1 text-xs">
                {userMvocId && (
                  <p className="text-slate-300 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">MVOC ID:</span>
                    <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded leading-none">
                      {userMvocId}
                    </span>
                  </p>
                )}
                {userEmail && (
                  <p className="text-slate-300 flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Email:</span>
                    <span className="font-mono text-slate-300 select-all">
                      {userEmail}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-3">
            {/* Primary Action: Go to Admin WA */}
            <a
              href="https://chat.whatsapp.com/LTTYV6D0TvvEZRaujA8sjL"
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center justify-center gap-2.5 ${isDeleted ? 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black' : 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-extrabold'} text-xs h-[48px] rounded-xl transition-all shadow-lg font-mono uppercase tracking-widest cursor-pointer`}
            >
              <MessageSquare className="w-4 h-4" />
              Hubungi Admin MVOC
            </a>

            {/* Logout Action */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-[#16243A] hover:bg-[#20334E] active:bg-[#0D1826] text-slate-300 hover:text-white font-bold text-xs h-[46px] rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer font-mono uppercase tracking-widest"
              id="blocked-btn-logout"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              Keluar & Tutup Sesi
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
