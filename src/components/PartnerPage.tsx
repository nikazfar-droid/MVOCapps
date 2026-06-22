import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft, CheckCircle2, Download, TrendingUp, Users, Star, MessageCircle, HelpCircle, Calendar, Target, ShieldCheck } from 'lucide-react';

const packages = [
  {
    tier: 'Pakej Rakan (Standard)',
    price: 'Hubungi Kami',
    color: 'border-blue-200 bg-blue-50/30 shadow-blue-100/50',
    headerBg: 'bg-gradient-to-r from-blue-500 to-blue-600',
    icon: <Users className="w-6 h-6 text-white" />,
    features: [
      'Penyenaraian jenama dalam direktori aplikasi.',
      'Akses kepada pangkalan data ahli untuk tawaran promosi.',
      'Akses pasaran pemilik Veloz secara langsung.'
    ]
  },
  {
    tier: 'Pakej Eksklusif (Featured Merchant)',
    price: 'Hubungi Kami',
    color: 'border-amber-200 bg-amber-50/30 shadow-amber-100/50 scale-100 md:scale-105 z-10',
    headerBg: 'bg-gradient-to-r from-amber-400 to-amber-500',
    icon: <Star className="w-6 h-6 text-white fill-white" />,
    badge: 'Paling Popular',
    features: [
      'Kedudukan utama di bahagian Dashboard.',
      'Notifikasi Push eksklusif kepada ahli setiap suku tahun.',
      'Lencana "Verified Partner" pada profil perniagaan anda.',
      'Pendedahan maksima semasa acara rasmi kelab.'
    ]
  }
];

const faqs = [
  {
    q: 'Adakah saya perlu sediakan diskaun?',
    a: 'Ya, tawaran eksklusif kepada ahli MVOC adalah nilai teras kami untuk memberikan manfaat kepada komuniti.'
  },
  {
    q: 'Bagaimana ahli menuntut tawaran?',
    a: 'Ahli hanya perlu menunjukkan aplikasi MVOC di premis anda atau menggunakan kod promosi digital.'
  },
  {
    q: 'Berapa lama tempoh kerjasama?',
    a: 'Kerjasama biasanya bermula dalam tempoh kontrak 12 bulan dengan semakan prestasi berkala.'
  }
];

export default function PartnerPage() {
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const WHATSAPP_LINK = "https://wa.me/60183240032?text=Hai%20MVOC,%20saya%20berminat%20untuk%20menjadi%20Rakan%20Strategik%20dan%20mengetahui%20lebih%20lanjut%20mengenai%20Pakej%20Penajaan.";
  // We point this to a generic PDF file in the public folder. The user will need to replace this file later.
  const BROCHURE_LINK = "/Sponsorship_Proposal_MVOC.pdf";
  
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configRef = doc(db, 'settings', 'app_config');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          setIsEnabled(snap.data().sponsorship !== false);
        } else {
          setIsEnabled(true);
        }
      } catch (err) {
        // Fallback to enabled if cannot read (e.g., security rules)
        setIsEnabled(true);
      }
    };
    fetchConfig();
  }, []);

  if (isEnabled === false) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex flex-col items-center justify-center p-6 text-center">
        <Target className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-black text-[#0F2D52] uppercase">Modul Tajaan Ditutup Sementara</h1>
        <p className="text-slate-500 mt-2 max-w-md">Program rakan strategik sedang dikemaskini. Sila layari aplikasi kami dari masa ke semasa untuk maklumat terkini.</p>
        <a href="/" className="mt-6 px-6 py-2 bg-[#0F2D52] text-white font-bold rounded-xl text-sm">Kembali ke Laman Utama</a>
      </div>
    );
  }

  if (isEnabled === null) {
    return <div className="min-h-screen bg-[#F4F7FB] animate-pulse"></div>;
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 font-sans pb-16">
      {/* Hero Section */}
      <div className="bg-[#0F2D52] relative overflow-hidden rounded-b-[40px] shadow-2xl pt-10 pb-24 px-6 z-10">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://images.unsplash.com/photo-1555626906-fcf10d6851b4?w=1200&q=80')] bg-cover bg-center"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F2D52] via-[#0F2D52]/80 to-transparent"></div>
        
        <div className="w-full max-w-4xl mx-auto relative z-20">
          <a href="/" className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors p-2 -ml-2 rounded-full hover:bg-white/10 mb-6">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold text-sm">Kembali</span>
          </a>
          
          <div className="text-center space-y-6 mt-4">
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white drop-shadow-md leading-tight">
              Rakan Strategik MVOC Malaysia:<br/>
              <span className="text-amber-400">Bina Jenama Anda Bersama Komuniti Veloz Terbesar</span>
            </h1>
            <p className="text-sm md:text-base font-medium text-blue-100 max-w-2xl mx-auto leading-relaxed">
              Kami menghubungkan perniagaan anda secara terus kepada komuniti pemilik kenderaan Toyota Veloz yang paling aktif dan setia di Malaysia.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <a 
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-8 py-3.5 bg-green-500 hover:bg-green-600 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Hubungi Kami Untuk Kerjasama
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section (Angka yang Berbicara) */}
      <div className="max-w-4xl mx-auto px-4 -mt-12 relative z-20">
        <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div className="space-y-1 pt-2 md:pt-0">
            <Users className="w-8 h-8 text-blue-500 mx-auto mb-3" />
            <h3 className="text-3xl font-black text-[#0F2D52]">500+</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ahli Komuniti Aktif</p>
          </div>
          <div className="space-y-1 pt-6 md:pt-0">
            <Calendar className="w-8 h-8 text-amber-500 mx-auto mb-3" />
            <h3 className="text-3xl font-black text-[#0F2D52]">10+</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Acara Konvoi Tahunan</p>
          </div>
          <div className="space-y-1 pt-6 md:pt-0">
            <Star className="w-8 h-8 text-emerald-500 fill-emerald-500 mx-auto mb-3" />
            <h3 className="text-3xl font-black text-[#0F2D52]">4.8/5.0</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Purata Rating Servis</p>
          </div>
        </div>
      </div>

      {/* Why Partner With Us */}
      <div className="max-w-4xl mx-auto px-6 mt-16 space-y-10">
        <div className="text-center">
          <h2 className="text-2xl font-black text-[#0F2D52] uppercase tracking-tight">Mengapa Pilih MVOC Sebagai Rakan Strategik?</h2>
          <div className="w-16 h-1 bg-amber-400 mx-auto mt-4 rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <Target className="w-8 h-8 text-blue-500" />
            <h3 className="text-lg font-bold text-[#0F2D52]">Capaian Sasaran Tepat</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Produk atau perkhidmatan anda dipaparkan terus kepada ratusan pemilik Veloz yang berdaftar dan aktif menggunakan aplikasi kami.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <TrendingUp className="w-8 h-8 text-amber-500" />
            <h3 className="text-lg font-bold text-[#0F2D52]">Pendedahan Jenama Eksklusif</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Jadilah sebahagian daripada ekosistem Veloz Member Benefits dan menonjol sebagai pilihan utama komuniti.
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <ShieldCheck className="w-8 h-8 text-emerald-500" />
            <h3 className="text-lg font-bold text-[#0F2D52]">Kualiti Komuniti Tinggi</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ahli kami adalah golongan profesional dan peminat automotif yang mementingkan kualiti, servis, dan aksesori terbaik untuk kenderaan mereka.
            </p>
          </div>
        </div>
      </div>

      {/* Pricing / Packages */}
      <div className="max-w-5xl mx-auto px-4 mt-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black text-[#0F2D52] uppercase tracking-tight">Pilihan Kerjasama</h2>
          <p className="text-slate-500 text-sm mt-2">Pilih pakej yang bersesuaian dengan matlamat perniagaan anda.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto items-center">
          {packages.map((pkg, idx) => (
            <div 
              key={idx} 
              className={`relative flex flex-col bg-white rounded-3xl border shadow-lg overflow-hidden transition-transform duration-300 ${pkg.color}`}
            >
              {pkg.badge && (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest py-1.5 px-5 rounded-bl-xl shadow-sm z-20">
                  {pkg.badge}
                </div>
              )}
              
              {/* Package Header */}
              <div className={`${pkg.headerBg} p-8 text-center relative`}>
                <div className="absolute inset-0 bg-black/10"></div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10 border border-white/20 shadow-inner">
                  {pkg.icon}
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider relative z-10">{pkg.tier}</h3>
              </div>
              
              {/* Features */}
              <div className="p-8 flex-1 flex flex-col">
                <ul className="space-y-5 flex-1">
                  {pkg.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm font-semibold text-slate-700 leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-6 mt-20 space-y-8">
        <div className="text-center">
          <h2 className="text-2xl font-black text-[#0F2D52] uppercase tracking-tight">FAQ Ringkas</h2>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm">
              <div className="flex gap-3 items-start">
                <HelpCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-[#0F2D52] mb-2">{faq.q}</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA & Footer */}
      <div className="max-w-4xl mx-auto px-6 mt-20">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#1a427b] rounded-3xl p-8 md:p-12 text-center text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-400 rounded-full mix-blend-multiply filter blur-[80px] opacity-40"></div>
          
          <div className="relative z-10 space-y-6">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight">Bersedia untuk berkembang bersama kami?</h2>
            <p className="text-blue-100 font-medium">Mari bincangkan potensi kerjasama perniagaan yang saling menguntungkan.</p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <a 
                href={BROCHURE_LINK}
                download
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-8 py-3.5 bg-white text-[#0F2D52] hover:bg-slate-50 font-black text-sm uppercase tracking-widest rounded-xl shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Muat Turun Brosur Penajaan (PDF)
              </a>
              <a 
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-8 py-3.5 bg-green-500 hover:bg-green-600 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Hubungi Admin Melalui WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
