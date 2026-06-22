import React, { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { X, CheckCircle, AlertTriangle, MapPin, Compass, ShieldAlert, Award, RefreshCw, Smartphone } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

interface EventItem {
  id: string | number;
  title: string;
  location: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  date?: string;
  gmapsLink?: string;
}

interface QREventScannerProps {
  events?: EventItem[];
  onClose: () => void;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Haversine formula to calculate distance in meters between two GPS coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Admin test location constant (Nik Azfar's location for testing)
const ADMIN_TEST_LAT = 2.9563433985136855;
const ADMIN_TEST_LON = 101.53324153779846;

export default function QREventScanner({ events = [], onClose, triggerToast }: QREventScannerProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | number>('');
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [successMemberName, setSuccessMemberName] = useState<string>('');
  
  // Geofencing GPS state
  const [adminCoords, setAdminCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'checking' | 'active' | 'denied' | 'error' | 'mock'>('checking');
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string>('');
  const [bypassGeofence, setBypassGeofence] = useState<boolean>(true); // Default to true to allow easier testing, with visible warning
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [usingMockGps, setUsingMockGps] = useState<boolean>(false);
  
  // Manual GPS override fields for testing
  const [mockLatInput, setMockLatInput] = useState<string>(String(ADMIN_TEST_LAT));
  const [mockLonInput, setMockLonInput] = useState<string>(String(ADMIN_TEST_LON));
  const [showMockGpsPanel, setShowMockGpsPanel] = useState<boolean>(false);

  // Filter events: display Ongoing and Upcoming events as primary candidates for attendance scanning
  const activeEvents = events.filter(e => e.category !== 'completed');
  const currentEvent = events.find(e => String(e.id) === String(selectedEventId));

  // Initialize selected event
  useEffect(() => {
    if (activeEvents.length > 0 && !selectedEventId) {
      setSelectedEventId(activeEvents[0].id);
    } else if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id);
    }
  }, [events, activeEvents, selectedEventId]);

  // Track Geolocation — fall back to mock GPS if denied
  useEffect(() => {
    if (!navigator.geolocation) {
      // No GPS support — use mock coordinates automatically
      setGpsStatus('mock');
      setUsingMockGps(true);
      setAdminCoords({ latitude: ADMIN_TEST_LAT, longitude: ADMIN_TEST_LON });
      setGpsErrorMsg('GPS tidak disokong. Menggunakan koordinat ujian admin.');
      return;
    }

    setGpsStatus('checking');
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setAdminCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setGpsStatus('active');
        setUsingMockGps(false);
        setGpsErrorMsg('');
      },
      (error) => {
        console.warn('GPS geolocation watch error:', error);
        // Fall back to mock GPS coordinates automatically
        setGpsStatus('mock');
        setUsingMockGps(true);
        setAdminCoords({ latitude: ADMIN_TEST_LAT, longitude: ADMIN_TEST_LON });
        setGpsErrorMsg(
          error.code === error.PERMISSION_DENIED
            ? 'GPS disekat — menggunakan koordinat ujian admin (2.9563°N, 101.5332°E).'
            : `Ralat GPS — menggunakan koordinat ujian: ${error.message}`
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Apply manual mock GPS coords
  const applyMockCoords = () => {
    const lat = parseFloat(mockLatInput);
    const lon = parseFloat(mockLonInput);
    if (isNaN(lat) || isNaN(lon)) {
      triggerToast('Koordinat tidak sah. Masukkan nombor yang betul.', 'error');
      return;
    }
    setAdminCoords({ latitude: lat, longitude: lon });
    setGpsStatus('mock');
    setUsingMockGps(true);
    setGpsErrorMsg(`Menggunakan koordinat ujian: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    triggerToast(`Koordinat ujian ditetapkan: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'success');
  };

  // Recalculate distance when admin position or selected event changes
  useEffect(() => {
    if (adminCoords && currentEvent?.latitude && currentEvent?.longitude) {
      const dist = calculateDistance(
        adminCoords.latitude,
        adminCoords.longitude,
        currentEvent.latitude,
        currentEvent.longitude
      );
      setCalculatedDistance(dist);
    } else {
      setCalculatedDistance(null);
    }
  }, [adminCoords, currentEvent]);

  // Log scan attempts helper
  const logScanAttempt = async (status: 'success' | 'failed', message: string, scannedPayload: string) => {
    try {
      await addDoc(collection(db, 'scanLogs'), {
        uid: auth.currentUser?.uid || 'anonymous',
        userName: auth.currentUser?.displayName || 'Admin',
        userEmail: auth.currentUser?.email || '',
        status,
        message,
        scannedPayload,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error('Failed to log scan attempt:', e);
    }
  };

  const handleScan = async (result: any) => {
    if (result && result.length > 0 && result[0].rawValue) {
      const value = result[0].rawValue;
      if (scannedData === value || scanStatus !== 'idle') return; // Prevent duplicate scanning while processing
      
      setScannedData(value);
      setVerificationError(null);

      // Verify event is selected
      if (!selectedEventId || !currentEvent) {
        setScanStatus('error');
        setVerificationError('Ralat: Sila pilih acara terlebih dahulu.');
        triggerToast('Sila pilih acara terlebih dahulu.', 'error');
        resetScannerWithDelay();
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(value);
      } catch (e) {
        setScanStatus('error');
        setVerificationError('Ralat: Kod QR bukan format ahli MVOC.');
        triggerToast('Format Kod QR tidak sah', 'error');
        await logScanAttempt('failed', `Scan gagal: Kod QR bukan JSON sah`, value);
        resetScannerWithDelay();
        return;
      }

      // Check fields
      if (!parsed.uid || !parsed.mvocId || !parsed.name) {
        setScanStatus('error');
        setVerificationError('Ralat: Maklumat keahlian Kod QR tidak lengkap.');
        triggerToast('Format ahli tidak sah', 'error');
        await logScanAttempt('failed', `Scan gagal: Medan profil tidak lengkap`, value);
        resetScannerWithDelay();
        return;
      }

      // 1. Anti-Screenshot / Dynamic timestamp verification
      const now = Date.now();
      if (!parsed.ts) {
        setScanStatus('error');
        setVerificationError('Ralat: Tangkapan skrin (screenshot) dikesan. Kod QR ahli mestilah dijana secara langsung.');
        triggerToast('Gagal: Kod QR statik dikesan.', 'error');
        await logScanAttempt('failed', `Mencegah screenshot: Tiada timestamp untuk ${parsed.name}`, value);
        resetScannerWithDelay();
        return;
      }

      const timeDiffSeconds = Math.abs(now - parsed.ts) / 1000;
      if (timeDiffSeconds > 90) { // 90 seconds window
        setScanStatus('error');
        setVerificationError(`Ralat: Kod QR telah luput (${Math.round(timeDiffSeconds)} saat lalu). Sila minta ahli paparkan kod QR yang baru.`);
        triggerToast('Gagal: Kod QR telah tamat tempoh.', 'error');
        await logScanAttempt('failed', `Mencegah screenshot: Kod QR luput (${Math.round(timeDiffSeconds)}s) untuk ${parsed.name}`, value);
        resetScannerWithDelay();
        return;
      }

      // 2. Geofencing GPS Verification
      if (!bypassGeofence) {
        if (!currentEvent.latitude || !currentEvent.longitude) {
          setScanStatus('error');
          setVerificationError('Ralat: Acara ini tidak mempunyai koordinat lokasi yang ditetapkan.');
          triggerToast('Lokasi acara tiada koordinat GPS', 'error');
          resetScannerWithDelay();
          return;
        }

        if (gpsStatus !== 'active' || !adminCoords) {
          setScanStatus('error');
          setVerificationError('Ralat: GPS Admin tidak aktif. Aktifkan GPS untuk melakukan pengesahan geofencing.');
          triggerToast('Gagal: GPS Admin tidak dikesan.', 'error');
          resetScannerWithDelay();
          return;
        }

        const distance = calculateDistance(
          adminCoords.latitude,
          adminCoords.longitude,
          currentEvent.latitude,
          currentEvent.longitude
        );

        if (distance > 200) { // Outside 200m limit
          setScanStatus('error');
          setVerificationError(`Ralat Geofencing: Ahli/Admin berada di luar kawasan acara. Jarak dikesan: ${(distance / 1000).toFixed(2)} km. Had dibenarkan: 200 meter.`);
          triggerToast('Gagal: Di luar sempadan geofencing.', 'error');
          await logScanAttempt(
            'failed',
            `Geofencing gagal: ${parsed.name} di luar sempadan (${Math.round(distance)}m) untuk ${currentEvent.title}`,
            value
          );
          resetScannerWithDelay();
          return;
        }
      }

      // 3. Duplicate Attendance Check
      try {
        const attendeeRef = doc(db, 'attendance', String(currentEvent.id), 'attendees', parsed.uid);
        const attendeeSnap = await getDoc(attendeeRef);
        
        if (attendeeSnap.exists()) {
          setScanStatus('error');
          setVerificationError('Ralat: Ahli ini telah pun disahkan hadir untuk acara ini.');
          triggerToast('Ahli sudah mendaftar kehadiran.', 'warning');
          await logScanAttempt('failed', `Mencegah pertindihan: ${parsed.name} telah berdaftar untuk ${currentEvent.title}`, value);
          resetScannerWithDelay();
          return;
        }

        // 4. Save to Firestore & Award Points (+30 XP)
        const eventIdStr = String(currentEvent.id);
        
        // Ensure root attendance doc exists
        await setDoc(doc(db, 'attendance', eventIdStr), {
          title: currentEvent.title,
          context: 'event',
          type: 'attendance',
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Save attendee record
        await setDoc(attendeeRef, {
          uid: parsed.uid,
          name: parsed.name,
          mvocId: parsed.mvocId,
          chapter: parsed.chapter || '',
          scannedBy: auth.currentUser?.uid || 'unknown',
          scannedByName: auth.currentUser?.displayName || 'Admin',
          timestamp: serverTimestamp(),
          gpsLocation: adminCoords ? { lat: adminCoords.latitude, lon: adminCoords.longitude } : null,
          distanceMeters: calculatedDistance || 0,
          bypassedGeofence: bypassGeofence
        });

        // Award +30 points to member's user profile
        const userProfileRef = doc(db, 'users', parsed.uid);
        await updateDoc(userProfileRef, {
          points: increment(30)
        });

        setSuccessMemberName(parsed.name);
        setScanStatus('success');
        triggerToast(`Kehadiran ${parsed.name} berjaya direkodkan! (+30 XP)`, 'success');
        await logScanAttempt(
          'success',
          `Pendaftaran hadir berjaya: ${parsed.name} (${parsed.mvocId}) untuk ${currentEvent.title}`,
          value
        );
      } catch (err: any) {
        console.error('Firebase save attendance error:', err);
        setScanStatus('error');
        setVerificationError(`Ralat Sistem: Gagal merekodkan kehadiran ke pangkalan data. ${err.message || String(err)}`);
        triggerToast('Ralat pangkalan data.', 'error');
        resetScannerWithDelay();
        return;
      }

      resetScannerWithDelay();
    }
  };

  const resetScannerWithDelay = () => {
    setTimeout(() => {
      setScannedData(null);
      setScanStatus('idle');
      setVerificationError(null);
    }, 4000);
  };

  const handleError = (error: any) => {
    console.error('QR Scanner Error:', error);
    if (error?.name === 'NotAllowedError' || error?.message?.includes('Permission denied')) {
      triggerToast('Akses kamera disekat. Sila benarkan akses kamera.', 'error');
      setScanStatus('error');
      setVerificationError('Akses kamera disekat oleh pelayar.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#071322]/95 backdrop-blur-md"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative w-full max-w-md bg-[#0d1f35]/95 border border-[#1e3d64] rounded-[24px] shadow-2xl flex flex-col h-full max-h-[90vh] overflow-hidden text-slate-100">
        
        {/* Header section */}
        <div className="p-4 border-b border-[#1e3d64] flex items-center justify-between bg-[#0b1b2d] shrink-0">
          <div>
            <h3 className="text-xs font-black text-amber-500 tracking-wider uppercase">
              Aliran Kedatangan Terbalik (Inverted Flow)
            </h3>
            <h2 className="text-sm font-extrabold text-white mt-0.5">
              Imbas Kad QR Ahli
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1b324d] text-slate-350 hover:bg-rose-600 hover:text-white transition duration-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Scanner Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* 1. Selector Acara */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block">
              Pilih Acara Sukan/Konvoi
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                setScannedData(null);
                setScanStatus('idle');
              }}
              className="w-full bg-[#0a1829] border border-[#1e3d64] rounded-xl py-3 px-3 text-xs font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer font-sans"
            >
              {events.length === 0 ? (
                <option value="">Tiada Acara Dijumpai</option>
              ) : (
                <>
                  <optgroup label="Sedang Berlangsung / Akan Datang">
                    {activeEvents.map(e => (
                      <option key={e.id} value={e.id}>{e.title} ({e.location})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Selesai (Completed)">
                    {events.filter(e => e.category === 'completed').map(e => (
                      <option key={e.id} value={e.id}>{e.title} ({e.location})</option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
            {currentEvent && (
              <>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold bg-[#0b1624] px-3 py-2 rounded-lg border border-[#14293f]">
                  <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Koordinat Acara: {currentEvent.latitude || 'Tiada'}, {currentEvent.longitude || 'Tiada'}</span>
                </div>
                {currentEvent.gmapsLink && (
                  <a
                    href={currentEvent.gmapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[10px] text-blue-400 font-bold bg-blue-950/20 px-3 py-2 rounded-lg border border-blue-900/30 hover:bg-blue-950/40 transition cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">🗺️ Lihat di Google Maps ↗</span>
                  </a>
                )}
              </>
            )}
          </div>

          {/* 2. Geofencing GPS Panel */}
          <div className="bg-[#0b1726] border border-[#182f4b] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Status GPS Geofencing</span>
              <div className="flex items-center gap-1.5">
                {gpsStatus === 'checking' && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1 font-bold">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Mengesan...
                  </span>
                )}
                {gpsStatus === 'active' && (
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1 font-bold">
                    <Compass className="w-2.5 h-2.5 animate-pulse text-emerald-400" /> GPS Sebenar ✓
                  </span>
                )}
                {gpsStatus === 'mock' && (
                  <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 flex items-center gap-1 font-bold">
                    <MapPin className="w-2.5 h-2.5 text-blue-400" /> Mod Ujian
                  </span>
                )}
                {(gpsStatus === 'denied' || gpsStatus === 'error') && (
                  <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1 font-bold">
                    <ShieldAlert className="w-2.5 h-2.5 text-rose-500" /> GPS Disekat
                  </span>
                )}
              </div>
            </div>

            {gpsErrorMsg && (
              <div className={`text-[10px] font-semibold p-2 rounded border ${usingMockGps ? 'text-blue-400 bg-blue-500/5 border-blue-500/10' : 'text-amber-400 bg-amber-500/5 border-amber-500/10'}`}>
                {gpsErrorMsg}
              </div>
            )}

            {adminCoords && (
              <div className={`text-[10px] font-mono grid grid-cols-2 gap-2 p-2 rounded border ${usingMockGps ? 'text-blue-300 bg-blue-950/30 border-blue-900/40' : 'text-slate-350 bg-[#07101c] border-[#11243a]'}`}>
                <div>{usingMockGps ? '🧪' : '📡'} Lat: {adminCoords.latitude.toFixed(6)}</div>
                <div>Lon: {adminCoords.longitude.toFixed(6)}</div>
              </div>
            )}

            {/* Direct Distance Display */}
            {currentEvent?.latitude && currentEvent?.longitude && (
              <div className="flex items-center justify-between border-t border-[#182f4b] pt-2.5">
                <span className="text-[10px] text-slate-400 font-bold">Jarak Ke Lokasi Acara:</span>
                <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                  {calculatedDistance !== null ? (
                    calculatedDistance > 1000 ? (
                      <span className={`${bypassGeofence ? 'text-slate-400' : 'text-rose-400'}`}>
                        {(calculatedDistance / 1000).toFixed(2)} km
                      </span>
                    ) : (
                      <span className={`${calculatedDistance <= 200 ? 'text-emerald-400' : (bypassGeofence ? 'text-slate-400' : 'text-rose-400')}`}>
                        {Math.round(calculatedDistance)} meter
                      </span>
                    )
                  ) : (
                    <span className="text-slate-500">Kiraan Gagal</span>
                  )}
                  {calculatedDistance !== null && (
                    calculatedDistance <= 200 ? (
                      <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-emerald-500/20">Lulus ✓</span>
                    ) : (
                      <span className="bg-rose-500/10 text-rose-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-rose-500/20">Di Luar Sempadan</span>
                    )
                  )}
                </span>
              </div>
            )}

            {/* Manual GPS Override for Testing */}
            <div className="border-t border-[#182f4b] pt-3 space-y-2">
              <button
                onClick={() => setShowMockGpsPanel(!showMockGpsPanel)}
                className="w-full flex items-center justify-between text-[9px] font-extrabold text-blue-400 uppercase tracking-wide cursor-pointer hover:text-blue-300 transition"
              >
                <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Tetapkan Koordinat Ujian Admin</span>
                <span>{showMockGpsPanel ? '▲ Tutup' : '▼ Buka'}</span>
              </button>
              {showMockGpsPanel && (
                <div className="bg-blue-950/20 border border-blue-900/40 rounded-lg p-2.5 space-y-2">
                  <p className="text-[9px] text-blue-400 font-semibold">Masukkan koordinat GPS admin untuk ujian (tanpa perlu GPS peranti).</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] text-slate-500 font-bold uppercase block mb-1">Latitude</label>
                      <input
                        type="text"
                        value={mockLatInput}
                        onChange={(e) => setMockLatInput(e.target.value)}
                        className="w-full bg-[#071018] border border-blue-900/50 rounded-lg py-1.5 px-2 font-mono text-[10px] text-blue-200 focus:outline-none focus:border-blue-500"
                        placeholder="2.9563..."
                      />
                    </div>
                    <div>
                      <label className="text-[8px] text-slate-500 font-bold uppercase block mb-1">Longitude</label>
                      <input
                        type="text"
                        value={mockLonInput}
                        onChange={(e) => setMockLonInput(e.target.value)}
                        className="w-full bg-[#071018] border border-blue-900/50 rounded-lg py-1.5 px-2 font-mono text-[10px] text-blue-200 focus:outline-none focus:border-blue-500"
                        placeholder="101.5332..."
                      />
                    </div>
                  </div>
                  <button
                    onClick={applyMockCoords}
                    className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest rounded-lg transition cursor-pointer"
                  >
                    Gunakan Koordinat Ini
                  </button>
                  <button
                    onClick={() => {
                      setMockLatInput(String(ADMIN_TEST_LAT));
                      setMockLonInput(String(ADMIN_TEST_LON));
                      setAdminCoords({ latitude: ADMIN_TEST_LAT, longitude: ADMIN_TEST_LON });
                      setGpsStatus('mock');
                      setUsingMockGps(true);
                      setGpsErrorMsg(`Koordinat ujian admin dipulihkan.`);
                      triggerToast('Koordinat admin asal dipulihkan.', 'info');
                    }}
                    className="w-full py-1.5 bg-[#0a1829] hover:bg-[#0d2040] text-blue-400 font-bold text-[9px] uppercase tracking-wide rounded-lg transition cursor-pointer border border-blue-900/30"
                  >
                    Pulih Lalai (2.9563°N, 101.5332°E)
                  </button>
                </div>
              )}
            </div>

            {/* Override Switch for local testing */}
            <label className="flex items-center gap-2.5 cursor-pointer bg-[#0e1e31] hover:bg-[#12263d] p-2.5 rounded-lg border border-[#193250] transition select-none">
              <input 
                type="checkbox" 
                checked={bypassGeofence} 
                onChange={(e) => setBypassGeofence(e.target.checked)} 
                className="w-4 h-4 text-amber-500 bg-slate-900 rounded border-slate-700 focus:ring-0 cursor-pointer"
              />
              <div className="text-left">
                <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wide block">
                  Pintas Geofencing (Untuk Ujian)
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  Benarkan imbasan walaupun di luar radius 200m
                </span>
              </div>
            </label>
          </div>

          {/* 3. The Camera Scan window */}
          <div className="aspect-square bg-black rounded-2xl overflow-hidden relative border border-[#1e3d64] shadow-inner">
            <Scanner 
              constraints={{ facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }}
              onScan={handleScan}
              onError={handleError}
              components={{
                audio: false,
                // @ts-ignore
                tracker: true
              }}
            />
            
            {/* Hologram Scanner Laser Line Effect */}
            {scanStatus === 'idle' && (
              <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                <div className="w-56 h-56 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-amber-400" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-amber-400" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-amber-400" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-amber-400" />
                  
                  <div className="w-full h-0.5 bg-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.8)] absolute top-0 animate-[scanLaser_3s_infinite_linear]" />
                </div>
              </div>
            )}

            {/* Verification Status Modal Overlays */}
            {scanStatus !== 'idle' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-[#081525]/90 backdrop-blur-md animate-in fade-in duration-300">
                {scanStatus === 'success' ? (
                  <div className="flex flex-col items-center text-center space-y-3.5 bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl max-w-[280px]">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/35">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-450 uppercase tracking-widest">KEHADIRAN SAH</h4>
                      <p className="text-sm font-extrabold text-white mt-1 leading-snug">{successMemberName}</p>
                      <p className="text-[10px] text-emerald-400 font-bold mt-2 bg-emerald-500/10 py-1 px-2.5 rounded-full inline-flex items-center gap-1.5 border border-emerald-500/20">
                        <Award className="w-3.5 h-3.5" /> Ganjaran +30 XP Diberikan
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center space-y-3.5 bg-rose-500/10 border border-rose-500/30 p-6 rounded-2xl max-w-[280px]">
                    <div className="w-14 h-14 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/35">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-rose-450 uppercase tracking-widest">IMBASAN DITOLAK</h4>
                      <p className="text-[10px] font-semibold text-rose-300 mt-2 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 leading-relaxed text-left">
                        {verificationError || 'Kod QR ahli tidak sah atau telah luput.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-[#0b1b2d] border-t border-[#1e3d64] text-center shrink-0">
          <p className="text-[10px] text-slate-400 font-bold flex items-center justify-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-amber-500" />
            <span>Kamera aktif. Pastikan ahli menggunakan kod QR dinamik terkini.</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes scanLaser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
