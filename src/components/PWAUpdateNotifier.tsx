import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Rocket, X } from 'lucide-react';

export default function PWAUpdateNotifier() {
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Jalankan listener untuk event kemaskini PWA
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<ServiceWorkerRegistration>;
      console.log('[PWA Update Notifier] Kemaskini ditemui!', customEvent.detail);
      setSwRegistration(customEvent.detail || null);
      setShowNotification(true);
    };

    window.addEventListener('pwa-update-available', handleUpdate);

    // Untuk ujian/pembangunan (kita juga membenarkan simulasi manual jika diperlukan melalui global window)
    (window as any).__simulatePwaUpdate = () => {
      console.log('[PWA Update Info] Simulasi kemaskini sedang dicetuskan...');
      window.dispatchEvent(new CustomEvent('pwa-update-available', { detail: null }));
    };

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdate);
    };
  }, []);

  const handleRestartNow = () => {
    try {
      console.log('[PWA Update Notifier] Memulakan penyucian cache dan storan lama...');
      
      // Bersihkan cache dan storan lama yang berkaitan dengan versi terdahulu
      // Kami mengekalkan setting bahasa 'mvoc_language' dan status dismissal 'mvoc_pwa_installer_dismissed' untuk keselesaan pengguna
      const preservedKeys = ['mvoc_language', 'mvoc_pwa_installer_dismissed'];
      
      // Bersihkan Session Storage
      sessionStorage.clear();

      // Bersihkan Local Storage secara terpilih
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !preservedKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Sekiranya ada service worker baru yang menunggu
      if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      console.log('[PWA Update Notifier] Pembersihan selesai. Mengeluarkan arahan muat semula...');
    } catch (err) {
      console.error('[PWA Update Notifier] Ralat ketika membersihkan cache versi lama:', err);
    } finally {
      // Paksa penyegaran penuh (hard refresh)
      window.location.reload();
    }
  };

  const handleClose = () => {
    setShowNotification(false);
  };

  return (
    <AnimatePresence>
      {showNotification && (
        <div 
          id="pwa-update-backdrop"
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            id="pwa-update-card"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-md bg-[#0F2D52] border border-emerald-500/30 rounded-3xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
          >
            {/* Background glowing emerald orb */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <button
              id="pwa-update-close"
              onClick={handleClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white mb-5 shadow-lg shadow-emerald-500/20">
                <Rocket className="w-8 h-8 animate-pulse text-white" />
              </div>

              <h2 className="text-white text-xl font-black tracking-tight mb-2">
                Kemaskini Tersedia!
              </h2>

              <p className="text-slate-300 text-sm leading-relaxed px-2 mb-6 font-medium">
                Aplikasi telah dikemaskini ke versi terkini di latar belakang. Sila mulakan semula aplikasi untuk memuatkan ciri-ciri baharu.
              </p>

              <div className="w-full flex flex-col gap-2.5">
                <button
                  id="pwa-update-restart-btn"
                  onClick={handleRestartNow}
                  className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-sm transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-400/30 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                  Mulakan Semula Sekarang
                </button>

                <button
                  id="pwa-update-delay-btn"
                  onClick={handleClose}
                  className="w-full py-3 px-4 rounded-xl border border-slate-700/60 focus:bg-white/5 text-slate-300 font-bold text-sm hover:bg-white/5 hover:text-white transition-all text-center"
                >
                  Nanti Sahaja
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
