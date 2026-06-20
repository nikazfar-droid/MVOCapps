import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share, X, PlusSquare, Sparkles, Smartphone, ArrowBigUpDash } from 'lucide-react';

interface PWAInstallerProps {
  language?: 'ms' | 'en';
}

export default function PWAInstaller({ language = 'ms' }: PWAInstallerProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstaller, setShowInstaller] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Menterjemahkan teks
  const t = (key: string) => {
    const translations: Record<string, { ms: string; en: string }> = {
      title: {
        ms: "Pasang Aplikasi MVOC Malaysia",
        en: "Install MVOC Malaysia App"
      },
      subtitle: {
        ms: "Akses Pass Keahlian Digital & Community Portal terus dari skrin utama peranti anda secara offline & lebih pantas!",
        en: "Access your Digital Membership Pass & Community Portal directly from your home screen offline & faster!"
      },
      installBtn: {
        ms: "Pasang Sekarang",
        en: "Install Now"
      },
      howToInstall: {
        ms: "Cara Pemasangan",
        en: "How to Install"
      },
      dismissBtn: {
        ms: "Nanti Saja",
        en: "Maybe Later"
      },
      iosTitle: {
        ms: "Pemasangan PWA untuk iOS/Safari",
        en: "PWA Installation for iOS/Safari"
      },
      iosStep1: {
        ms: "Ketik pada ikon 'Kongsi' (Share) di bar menu Safari anda (biasanya di bahagian bawah skrin).",
        en: "Tap the 'Share' button in the Safari menu bar (usually at the bottom of the screen)."
      },
      iosStep2: {
        ms: "Skrol ke bawah dan pilih 'Tambah ke Skrin Utama' (Add to Home Screen).",
        en: "Scroll down and select 'Add to Home Screen'."
      },
      iosStep3: {
        ms: "Ketik pada 'Tambah' (Add) di penjuru atas kanan untuk selesaikan pemasangan.",
        en: "Tap 'Add' in the top right corner to complete the installation."
      },
      iosClose: {
        ms: "Faham, Tutup",
        en: "Understood, Close"
      }
    };
    return translations[key]?.[language] || translations[key]?.['ms'] || '';
  };

  useEffect(() => {
    // 1. Kenal pasti jika peranti sudah dalam mod standalone (aplikasi telah dipasang)
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const standalone = checkStandalone();

    // 2. Kenal pasti jika peranti adalah iOS (iPhone / iPad)
    const uAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(uAgent);
    setIsIOS(isIOSDevice);

    // 3. Jika sudah standalone, jangan teruskan pembukaan installer popup
    if (standalone) return;

    // Semak sekiranya pengguna telah dismiss/tutup rujukan sebelum ini dalam sesi ini
    const dismissed = localStorage.getItem('mvoc_pwa_installer_dismissed');
    
    // 4. Untuk Android/Chromium: Listen to beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Paparkan banner jika belum dipasang dan belum di-dismiss secara kekal
      if (!dismissed) {
        // Berikan delay sedikit untuk kemunculan pertama yang lebih berkelas tinggi
        setTimeout(() => {
          setShowInstaller(true);
        }, 3000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Untuk iOS: Tunjukkan prompt panduan jika belum di-dismiss
    if (isIOSDevice && !dismissed) {
      setTimeout(() => {
        setShowInstaller(true);
      }, 3500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isIOS]);

  const handleInstallClick = async () => {
    if (isIOS) {
      // Papar panduan khas untuk iOS
      setShowGuideModal(true);
      return;
    }

    if (!deferredPrompt) {
      // Jika butang ditekan di peranti lain, tunjukkan panduan install juga
      setShowGuideModal(true);
      return;
    }

    // Android/Chromium Install prompt
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA Installer] Pilihan pengguna: ${outcome}`);
    
    // Berjaya atau tidak, kita kosongkan deferredPrompt
    setDeferredPrompt(null);
    setShowInstaller(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('mvoc_pwa_installer_dismissed', 'true');
    setShowInstaller(false);
  };

  // Jangan render apa-apa jika sudah dipasang (standalone) atau browser tidak bersesuaian
  if (isStandalone) return null;

  return (
    <>
      <AnimatePresence>
        {showInstaller && (
          <motion.div
            id="pwa-floating-installer"
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[420px] bg-[#0E1A2D] border border-blue-500/30 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999] overflow-hidden"
          >
            {/* Background Glow Effect */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-3">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  <span className="text-[10px] font-bold tracking-wider text-blue-400 uppercase font-mono">Mobile App PWA</span>
                </div>
                <button
                  id="pwa-close-btn"
                  onClick={handleDismiss}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/20">
                  <Download className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-white text-base font-black tracking-tight">{t('title')}</h3>
                  <p className="text-slate-300 text-xs mt-1.5 leading-relaxed font-medium">
                    {t('subtitle')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-5">
                <button
                  id="pwa-dismiss-action"
                  onClick={handleDismiss}
                  className="px-4 py-2.5 rounded-xl border border-slate-700/60 text-slate-300 text-xs font-bold hover:bg-white/5 transition-all text-center"
                >
                  {t('dismissBtn')}
                </button>
                <button
                  id="pwa-install-action"
                  onClick={handleInstallClick}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  {t('installBtn')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Installation Guide Modal */}
      <AnimatePresence>
        {showGuideModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
            <motion.div
              id="pwa-ios-guide-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#0A1220] border border-blue-500/20 w-full max-w-sm rounded-3xl p-6 relative overflow-hidden"
            >
              {/* Floating Upward Indicative Icon */}
              <div className="absolute top-3 right-3 animate-bounce hidden xs:block">
                <ArrowBigUpDash className="w-6 h-6 text-blue-400" />
              </div>

              <h3 className="text-white text-lg font-black tracking-tight flex items-center gap-2 mb-4">
                <Smartphone className="w-5 h-5 text-blue-400" />
                {t('iosTitle')}
              </h3>

              <div className="space-y-4 my-2">
                {/* Step 1 */}
                <div className="flex gap-3 items-start bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-black flex items-center justify-center shrink-0">
                    1
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed font-semibold">
                    {t('iosStep1')}{' '}
                    <span className="inline-block p-1 bg-white/10 rounded ml-1 text-white">
                      <Share className="w-3.5 h-3.5 inline" />
                    </span>
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3 items-start bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-black flex items-center justify-center shrink-0">
                    2
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed font-semibold">
                    {t('iosStep2')}{' '}
                    <span className="inline-block px-1.5 py-0.5 bg-white/10 rounded text-white text-[10px] uppercase font-bold font-mono">
                      + Add to Home Screen
                    </span>
                  </p>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3 items-start bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-black flex items-center justify-center shrink-0">
                    3
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed font-semibold">
                    {t('iosStep3')}
                  </p>
                </div>
              </div>

              <button
                id="pwa-ios-guide-close"
                onClick={() => {
                  setShowGuideModal(false);
                  localStorage.setItem('mvoc_pwa_installer_dismissed', 'true');
                  setShowInstaller(false);
                }}
                className="w-full mt-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm transition-all text-center shadow-lg shadow-blue-600/20"
              >
                {t('iosClose')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
