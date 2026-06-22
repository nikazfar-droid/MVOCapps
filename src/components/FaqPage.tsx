import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Shield, Star, Gift, HeadphonesIcon, Search } from 'lucide-react';

const faqsData = [
  {
    category: "Sistem Poin & Tahap (Tier)",
    icon: <Star className="w-5 h-5 text-amber-500" />,
    items: [
      {
        q: "Bagaimana cara mengumpul mata (XP) dengan efektif?",
        a: "Anda boleh mengumpul XP melalui penglibatan aktif dalam komuniti:\n• Hadir Event: 10 XP\n• Event Utama (Major): 50 XP\n• Sukarelawan: 100 XP\n• Referral Ahli Baru: 30 XP"
      },
      {
        q: "Adakah mata saya akan luput?",
        a: "Kami menggunakan sistem Point Decay. Jika tiada sebarang aktiviti (hadir acara/interaksi) direkodkan dalam tempoh 90 hari, 10% daripada jumlah mata anda akan diselaraskan (dikurangkan) setiap bulan sehingga anda kembali aktif. Ini adalah untuk memastikan tahap keahlian tinggi hanya dipegang oleh ahli yang aktif menyumbang kepada komuniti."
      },
      {
        q: "Mengapa syarat naik tahap kelihatan lebih sukar?",
        a: "Kami ingin menjadikan status Silver, Gold, dan Platinum sebagai tanda penghargaan eksklusif. Dengan menambah kriteria seperti penyertaan dalam Major Events, kami memastikan ahli di peringkat tinggi adalah mereka yang benar-benar menjadi tulang belakang MVOC."
      }
    ]
  },
  {
    category: "Ganjaran & Manfaat",
    icon: <Gift className="w-5 h-5 text-purple-500" />,
    items: [
      {
        q: "Apa kelebihan menjadi ahli peringkat Gold/Platinum?",
        a: "Ahli peringkat tinggi menikmati akses keutamaan (priority access) bagi acara-acara besar, jemputan eksklusif, serta diskaun tambahan daripada rakan niaga terpilih kami."
      },
      {
        q: "Bagaimana saya boleh dapatkan ganjaran?",
        a: "Apabila anda mencapai tahap yang ditetapkan, ganjaran akan dikemas kini secara automatik di bahagian profil anda. Anda hanya perlu menunjukkan kad digital MVOC anda di kedai atau bengkel rakan niaga yang terlibat untuk menebus manfaat tersebut."
      }
    ]
  },
  {
    category: "Sokongan Teknikal",
    icon: <HeadphonesIcon className="w-5 h-5 text-blue-500" />,
    items: [
      {
        q: "Mata saya tidak dikemaskini selepas menghadiri acara. Apa perlu dibuat?",
        a: "Pastikan anda telah mengimbas kod QR kehadiran di lokasi acara. Jika masih tidak dikemaskini dalam masa 24 jam, sila hubungi AJK chapter anda dengan menyertakan bukti kehadiran."
      },
      {
        q: "Saya mahu mencadangkan peniaga untuk bekerjasama dengan MVOC. Ke mana saya boleh hubungi?",
        a: "Kami sangat mengalu-alukan cadangan daripada ahli. Sila emelkan butiran perniagaan ke admin@mvoc.my atau terus berhubung dengan bahagian keahlian melalui aplikasi."
      }
    ]
  }
];

export default function FaqPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openIndex, setOpenIndex] = useState<string | null>("cat0-item0");

  const toggleFaq = (indexId: string) => {
    if (openIndex === indexId) {
      setOpenIndex(null);
    } else {
      setOpenIndex(indexId);
    }
  };

  // Filter FAQs based on search query
  const filteredFaqs = faqsData.map(category => {
    const filteredItems = category.items.filter(item => 
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...category, items: filteredItems };
  }).filter(category => category.items.length > 0);

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-slate-800 font-sans pb-12 flex flex-col items-center">
      {/* Header */}
      <div className="w-full bg-[#0F2D52] text-white pt-10 pb-8 px-6 shadow-md rounded-b-[32px] sticky top-0 z-50">
        <div className="w-full max-w-3xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors p-2 -ml-2 rounded-full hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold text-sm">Kembali</span>
          </a>
          <Shield className="w-6 h-6 text-amber-500 opacity-90" />
        </div>
        <div className="w-full max-w-3xl mx-auto mt-6">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Soalan Lazim (FAQ)</h1>
          <h2 className="text-lg font-bold text-amber-400 mt-1">Veloz Tier & Rewards</h2>
          <p className="text-xs sm:text-sm font-medium text-blue-200 mt-3 max-w-lg leading-relaxed">
            Selamat datang ke halaman bantuan MVOC. Halaman ini bertujuan memberi penjelasan mengenai sistem keahlian baharu kami yang direka khas untuk menghargai komitmen ahli-ahli MVOC.
          </p>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-3xl px-4 mt-8 space-y-8">
        
        {/* Search Bar */}
        <div className="relative w-full shadow-sm rounded-xl">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Cari soalan atau jawapan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-shadow"
          />
        </div>

        {/* FAQ Categories */}
        {filteredFaqs.length > 0 ? (
          filteredFaqs.map((category, catIndex) => (
            <div key={catIndex} className="space-y-4">
              <div className="flex items-center gap-2.5 px-2">
                <div className="p-1.5 bg-white shadow-sm rounded-lg border border-slate-200">
                  {category.icon}
                </div>
                <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">{category.category}</h2>
              </div>
              
              <div className="space-y-2.5">
                {category.items.map((item, itemIndex) => {
                  const indexId = `cat${catIndex}-item${itemIndex}`;
                  const isOpen = openIndex === indexId;
                  
                  return (
                    <div 
                      key={itemIndex} 
                      className={`bg-white border rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-blue-400 shadow-md shadow-blue-100/50' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
                    >
                      <button 
                        onClick={() => toggleFaq(indexId)}
                        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <h3 className={`font-bold text-[13px] leading-snug ${isOpen ? 'text-blue-700' : 'text-slate-800'}`}>
                          {item.q}
                        </h3>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                        )}
                      </button>
                      
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 animate-in slide-in-from-top-2 duration-200">
                          <div className="w-full h-px bg-slate-100 mb-4" />
                          <div className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                            {item.a}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">Tiada Jawapan Dijumpai</h3>
            <p className="text-xs text-slate-500 mt-1">Sila cuba kata kunci carian yang lain.</p>
          </div>
        )}
        
        {/* Navigation Button at Bottom */}
        <div className="pt-6 pb-4 w-full flex justify-center">
          <a 
            href="/"
            className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-slate-200 transition-transform active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Profil
          </a>
        </div>
      </div>
    </div>
  );
}
