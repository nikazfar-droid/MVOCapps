import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface QREventScannerProps {
  onClose: () => void;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function QREventScanner({ onClose, triggerToast }: QREventScannerProps) {
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleScan = (result: any) => {
    if (result && result.length > 0 && result[0].rawValue) {
      const value = result[0].rawValue;
      if (scannedData === value) return; // Prevent duplicate immediate scans
      
      setScannedData(value);
      
      let memberIdentifier = 'Member';
      let isValidPayload = false;

      try {
        const parsed = JSON.parse(value);
        if (parsed.mvocId || parsed.name) {
          isValidPayload = true;
          memberIdentifier = parsed.name ? `${parsed.name} (${parsed.mvocId})` : parsed.mvocId;
        }
      } catch (e) {
        // Fallback for simple string QRs
        if (value.includes('MVOC')) {
          isValidPayload = true;
          memberIdentifier = value;
        }
      }

      // Simulate verifying and logging the attendance
      if (isValidPayload) {
        setScanStatus('success');
        triggerToast(`Successfully logged attendance for ${memberIdentifier}`, 'success');
      } else {
        setScanStatus('error');
        triggerToast('Invalid MVOC QR Code', 'error');
      }
      
      // Reset after 3 seconds
      setTimeout(() => {
        setScannedData(null);
        setScanStatus('idle');
      }, 3000);
    }
  };

  const handleError = (error: any) => {
    console.error('QR Scanner Error:', error);
    if (error?.name === 'NotAllowedError' || error?.message?.includes('Permission denied')) {
      triggerToast('Camera access denied. Please enable camera permissions in your browser settings.', 'error');
      setScanStatus('error');
    } else if (error?.name === 'NotFoundError') {
      triggerToast('No back camera found on this device.', 'error');
      setScanStatus('error');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0b1c30]/90 backdrop-blur-sm"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl flex flex-col h-full max-h-[85vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 relative shrink-0 rounded-t-[24px]">
          <div>
            <h3 className="text-sm font-black text-[#0F2D52] tracking-tight uppercase">
              Event QR Scanner
            </h3>
            <p className="text-[10px] font-bold text-slate-500">
              Align member's digital card to scan
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-[#0f2d52] hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center justify-center bg-black aspect-square relative relative">
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
          
          {/* Overlay Status */}
          {scanStatus !== 'idle' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
              {scanStatus === 'success' ? (
                <div className="flex flex-col items-center p-6 bg-emerald-500 text-white rounded-2xl">
                  <CheckCircle className="w-16 h-16 mb-2" />
                  <span className="font-black">VERIFIED</span>
                </div>
              ) : (
                <div className="flex flex-col items-center p-6 bg-rose-500 text-white rounded-2xl">
                  <AlertTriangle className="w-16 h-16 mb-2" />
                  <span className="font-black">INVALID</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-50 text-center rounded-b-[24px]">
           <p className="text-xs text-slate-500 font-medium">
             Camera is active. Scanner will log attendance automatically.
           </p>
        </div>
      </div>
    </div>
  );
}
