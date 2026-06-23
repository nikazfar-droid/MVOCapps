import React, { useState } from 'react';
import { 
  Megaphone, 
  Users, 
  Award, 
  ShieldCheck, 
  Eye, 
  Send, 
  X, 
  AlertTriangle, 
  ArrowLeft,
  Info,
  ImagePlus
} from 'lucide-react';
import { db, auth, storage } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';

interface BroadcastModuleProps {
  onBack: () => void;
  triggerToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  displayEmail?: string;
  managedChapter?: string | string[];
}

type AudienceType = 'All Users' | 'Gold Members' | 'Admins' | 'Chapter Members';

export default function BroadcastModule({ onBack, triggerToast, displayEmail, managedChapter }: BroadcastModuleProps) {
  const managedChaptersList = Array.isArray(managedChapter)
    ? managedChapter
    : (managedChapter ? [managedChapter] : []);

  const [audience, setAudience] = useState<AudienceType>('All Users');
  const [selectedTargetChapter, setSelectedTargetChapter] = useState<string>(
    managedChaptersList[0] || 'None'
  );
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const characterLimit = 1000;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 3 * 1024 * 1024) {
        triggerToast('Image size exceeds 3MB limit.', 'error');
        return;
      }
      if (!file.type.startsWith('image/')) {
        triggerToast('Please upload a valid image file.', 'error');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    if (text.length <= characterLimit) {
      setBody(text);
    }
  };

  const parseMarkdown = (markdown: string) => {
    if (!markdown) return null;
    
    // Split by lines and do basic HTML conversions for headers, list items and paragraphs
    return markdown.split('\n').map((line, idx) => {
      // Bold text **bold**
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Italic text *italic*
      processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
      // Code tags `code`
      processed = processed.replace(/`(.*?)`/g, '<code class="bg-[#1E293B] text-amber-400 px-1.5 py-0.5 rounded font-mono text-xs">$1</code>');

      if (line.startsWith('# ')) {
        return (
          <h1 key={idx} className="text-lg font-black text-white mt-3 mb-2 border-b border-white/10 pb-1" dangerouslySetInnerHTML={{ __html: processed.substring(2) }} />
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h2 key={idx} className="text-base font-bold text-[#E2E8F0] mt-2 mb-1" dangerouslySetInnerHTML={{ __html: processed.substring(3) }} />
        );
      }
      if (line.startsWith('- ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-slate-300 font-medium py-0.5" dangerouslySetInnerHTML={{ __html: processed.substring(2) }} />
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }
      
      return (
        <p key={idx} className="text-slate-300 font-semibold mb-1" dangerouslySetInnerHTML={{ __html: processed }} />
      );
    });
  };

  const handleSendBroadcast = async () => {
    if (!subject.trim()) {
      triggerToast('Please provide a broadcast subject line.', 'warning');
      return;
    }
    if (!body.trim()) {
      triggerToast('Please fill out the broadcast message body.', 'warning');
      return;
    }
    if (confirmText.toUpperCase() !== 'CONFIRM') {
      triggerToast('Please type explicit "CONFIRM" string to bypass safety locks.', 'error');
      return;
    }

    setIsSending(true);
    try {
      let finalImageUrl: string | undefined = undefined;

      if (selectedImage) {
        triggerToast('Uploading and compressing image...', 'info');
        const timestamp = Date.now();
        const id = Math.random().toString(36).substring(2, 9);
        const fileName = `${id}-${timestamp}.jpg`;
        
        const rawStorageRef = ref(storage, `gallery_raw/announcements/${fileName}`);
        await uploadBytes(rawStorageRef, selectedImage);

        const webpFileName = `${id}-${timestamp}.webp`;
        const bucketPath = `gallery_processed/announcements/${webpFileName}`;
        finalImageUrl = `https://firebasestorage.googleapis.com/v0/b/${rawStorageRef.bucket}/o/${encodeURIComponent(bucketPath)}?alt=media`;
      }
      
      const announcementsRef = collection(db, 'announcements');
      await addDoc(announcementsRef, {
        subject: subject.trim(),
        message: body.trim(),
        sender: displayEmail || 'Super Admin Council',
        timestamp: serverTimestamp(),
        audience: audience,
        targetChapter: audience === 'Chapter Members' 
          ? (selectedTargetChapter === 'All My Chapters' ? managedChaptersList : selectedTargetChapter)
          : null,
        authorId: auth.currentUser?.uid || '',
        authorName: auth.currentUser?.displayName || displayEmail || 'Admin',
        isHidden: false,
        ...(finalImageUrl && { image: finalImageUrl })
      });

      triggerToast('Message successfully published to Announcements', 'success');
      setShowConfirmModal(false);
      setConfirmText('');
      setSubject('');
      setBody('');
      clearImage();
    } catch (err: any) {
      triggerToast(`Fidelity dispatch failed: ${err.message || err}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 text-[#0b1c30] font-sans pb-16 animate-fade-in">
      
      {/* Contextual Header with Core Experience Style */}
      <section className="p-6 bg-[#0f2d52] rounded-2xl text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button 
              onClick={onBack}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition cursor-pointer flex items-center pr-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span className="text-[10px] uppercase font-black tracking-wider">Back</span>
            </button>
            <span className="px-2 py-0.5 text-[9px] tracking-wider uppercase font-black bg-[#001b3b]/60 text-[#adc8f5] border border-[#adc8f5]/20 rounded-md">
              Secure Broadcast Gate
            </span>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SUPER ADMIN EXCLUSIVE</span>
            </div>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase flex items-center gap-2 mt-2">
            <Megaphone className="w-6 h-6 text-amber-400 shrink-0" />
            Segment Broadcast Dispatch
          </h2>
          <p className="text-xs text-[#d3e4fe] max-w-xl leading-relaxed font-semibold">
            Draft and dispatch high-priority push, email, and bulletin bulletins to community layers with audited cryptographic logs.
          </p>
        </div>
      </section>

      {/* Recipient Audience Selection */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-3.5">
        <div>
          <span className="text-[10px] text-[#475569] font-extrabold uppercase tracking-widest block">Recipient Segmentation</span>
          <h4 className="text-xs font-semibold text-slate-500 mt-0.5">Select target segment tier to target the dispatch ruleset</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Target: All Users */}
          <button 
            type="button"
            onClick={() => setAudience('All Users')}
            className={`p-4 rounded-xl border flex items-center gap-3.5 text-left transition-all duration-200 cursor-pointer ${
              audience === 'All Users' 
                ? 'bg-[#0f2d52]/5 border-[#0f2d52] shadow-sm'
                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              audience === 'All Users' ? 'bg-[#0f2d52] text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black block text-slate-800">All Users</span>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">Entire Community ({audience === 'All Users' ? 'Active' : 'Segment'})</span>
            </div>
          </button>

          {/* Target: Gold Members */}
          <button 
            type="button"
            onClick={() => setAudience('Gold Members')}
            className={`p-4 rounded-xl border flex items-center gap-3.5 text-left transition-all duration-200 cursor-pointer ${
              audience === 'Gold Members' 
                ? 'bg-[#0f2d52]/5 border-[#0f2d52] shadow-sm'
                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              audience === 'Gold Members' ? 'bg-[#0f2d52] text-amber-400' : 'bg-slate-200 text-slate-600'
            }`}>
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black block text-slate-800">Gold Members</span>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">Premium Tier Only</span>
            </div>
          </button>

          {/* Target: Admins */}
          <button 
            type="button"
            onClick={() => setAudience('Admins')}
            className={`p-4 rounded-xl border flex items-center gap-3.5 text-left transition-all duration-200 cursor-pointer ${
              audience === 'Admins' 
                ? 'bg-[#0f2d52]/5 border-[#0f2d52] shadow-sm'
                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              audience === 'Admins' ? 'bg-[#0f2d52] text-emerald-400' : 'bg-slate-200 text-slate-600'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-black block text-slate-800">Admins Only</span>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5">Club Committee & Staff</span>
            </div>
          </button>

          {/* Target: Chapter Members */}
          <button 
            type="button"
            onClick={() => setAudience('Chapter Members')}
            className={`p-4 rounded-xl border flex items-center gap-3.5 text-left transition-all duration-200 cursor-pointer ${
              audience === 'Chapter Members' 
                ? 'bg-[#0f2d52]/5 border-[#0f2d52] shadow-sm'
                : 'bg-slate-50/50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              audience === 'Chapter Members' ? 'bg-[#0f2d52] text-indigo-400' : 'bg-slate-200 text-slate-600'
            }`}>
              <Info className="w-5 h-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black block text-slate-800">Chapter Specific</span>
              {managedChaptersList.length <= 1 ? (
                <span className="text-[10px] text-slate-500 font-bold block mt-0.5 line-clamp-1">
                  {selectedTargetChapter || 'All Chapters'}
                </span>
              ) : (
                <select
                  value={selectedTargetChapter}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedTargetChapter(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-[#EFF4FB] border border-[#cbd5e1]/40 rounded-lg py-1 px-2 text-[10px] font-bold text-slate-700 mt-1 focus:outline-hidden"
                >
                  {managedChaptersList.map(ch => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                  <option value="All My Chapters">All My Chapters</option>
                </select>
              )}
            </div>
          </button>
        </div>
      </section>

      {/* Message Editor Panel */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs space-y-4">
        <div>
          <span className="text-[10px] text-[#475569] font-extrabold uppercase tracking-widest block font-sans">Message Editor</span>
          <h4 className="text-xs font-semibold text-slate-500 mt-0.5">Compose core notice payload. Basic markdown headers and lists are supported.</h4>
        </div>

        <div className="space-y-3 font-bold text-xs">
          {/* Subject Field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wide block ml-1">
              Broadcast Subject
            </label>
            <input 
              type="text"
              placeholder="e.g., Upcoming National Rally Convoy Protocols"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#EFF4FB] border border-[#cbd5e1]/40 rounded-xl py-3 px-3.5 text-sm font-semibold text-slate-850 focus:outline-none focus:border-[#0f2d52] transition-colors"
            />
          </div>

          {/* Message Body Field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wide block">
                Message Body
              </label>
              <div className="text-[10px] text-slate-400 font-mono font-medium">
                {body.length} / {characterLimit} Chars
              </div>
            </div>
            <textarea
              rows={8}
              placeholder="Type your message details here. You can use Markdown formatting like # Headers or - Lists."
              value={body}
              onChange={handleBodyChange}
              className="w-full bg-[#EFF4FB] border border-[#cbd5e1]/40 rounded-xl py-3 px-3.5 text-sm font-semibold text-slate-850 focus:outline-none focus:border-[#0f2d52] resize-none transition-colors"
            />
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider ml-1 mt-0.5">
              Markdown Tips: # Heading 1  •  ## Heading 2  •  **Bold**  •  - List Item
            </p>
          </div>

          {/* Image Upload Field */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 mt-2">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wide block ml-1">
              Attach Visual Cover (Optional)
            </label>
            {!imagePreview ? (
              <label className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#cbd5e1] rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-400 transition-all bg-[#EFF4FB]">
                <ImagePlus className="w-6 h-6 text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-500">Click to upload photo (Max 3MB)</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            ) : (
              <div className="relative w-full h-40 sm:h-48 rounded-xl overflow-hidden border border-slate-200 group">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={clearImage}
                  className="absolute top-2 right-2 bg-slate-900/50 hover:bg-red-500 text-white rounded-full p-1.5 backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Informative Badge */}
        <div className="p-3.5 bg-blue-50/50 border border-blue-100 text-blue-800 text-xs rounded-xl flex gap-3">
          <Info className="w-5 h-5 shrink-0 text-blue-500 mt-0.5" />
          <div className="font-semibold text-[11px] text-slate-650 leading-relaxed">
            <p className="font-black text-slate-800 mb-0.5 leading-none uppercase text-[10px] tracking-wider">Instant Broadcast Delivery</p>
            This message will be instantly displayed in real-time alert tickers, mobile announcement catalogs, and email registers across verified subscriber accounts.
          </div>
        </div>

        {/* Actions Row */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {/* Preview button */}
          <button
            type="button"
            onClick={() => {
              if (!subject.trim() && !body.trim()) {
                triggerToast('Please fill out some content to review first.', 'info');
                return;
              }
              setShowPreview(true);
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-250 text-slate-700 hover:bg-slate-50 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            Preview Layout
          </button>

          {/* Send Broadcast */}
          <button
            type="button"
            onClick={() => {
              if (!subject.trim()) {
                triggerToast('Please provide a broadcast subject line.', 'warning');
                return;
              }
              if (!body.trim()) {
                triggerToast('Please fill out the broadcast message body.', 'warning');
                return;
              }
              setShowConfirmModal(true);
            }}
            className="w-full sm:flex-1 bg-gradient-to-r from-[#0f2d52] to-[#123966] text-white hover:from-[#112F54] hover:to-[#17467c] px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition cursor-pointer shadow-md shadow-[#0f2d52]/15 hover:shadow-lg active:scale-95"
          >
            <Send className="w-4 h-4 text-amber-400 shrink-0" />
            Send Broadcast Message
          </button>
        </div>
      </section>

      {/* Modal: Message Preview */}
      {showPreview && (
        <div className="fixed inset-0 bg-[#000000]/80 flex items-center justify-center z-50 p-4 transition-opacity animate-fade-in">
          <div 
            className="w-full max-w-lg bg-[#0b1c30] border border-[#1e2e42] rounded-2xl p-6 text-white shadow-2xl flex flex-col max-h-[85vh] relative text-left"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[8.5px] font-black tracking-wider uppercase bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25 rounded">
                  Fidelity Preview
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Target: {audience}
                </span>
              </div>
              <button 
                onClick={() => setShowPreview(false)} 
                className="p-1 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Live Mobile Viewport Notification */}
            <div className="flex-1 overflow-y-auto py-5 space-y-4">
              <div className="bg-[#102339] border border-white/5 rounded-xl p-4 shadow-inner space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-[#0b1c30]">
                      <Megaphone className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest block leading-none">Official Broadcast</span>
                      <span className="text-[9px] text-slate-400 font-medium block mt-1">Sender: Council Executive</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 tracking-wide font-mono">Just Now</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <h4 className="text-sm font-black text-white leading-snug">
                    {subject || <span className="italic text-slate-500">No Subject Specified</span>}
                  </h4>
                  <div className="text-xs text-slate-300 leading-relaxed space-y-1 mt-2 max-h-[300px] overflow-y-auto pr-1">
                    {body ? parseMarkdown(body) : <span className="italic text-slate-500">Draft your broadcast message body inside the editor...</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="pt-3 border-t border-white/5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer text-center min-h-[44px]"
              >
                Return to Editor
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPreview(false);
                  setShowConfirmModal(true);
                }}
                className="flex-1 py-3 bg-[#10b981] hover:bg-emerald-600 text-[#0b1c30] rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer text-center min-h-[44px]"
              >
                Advance to dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Broadcast Safety Confirmation Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-[#000000]/80 flex items-center justify-center z-50 p-4 transition-opacity animate-fade-in">
          <div 
            className="w-full max-w-md bg-[#0b1c30] border border-rose-900/30 rounded-2xl p-6 text-white shadow-2xl flex flex-col relative text-left select-none"
          >
            {/* Header warning */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-white/5">
              <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-rose-400 uppercase tracking-wide leading-none">Mass Broadcast Confirmation</h4>
                <span className="text-[10px] text-slate-400 font-bold block mt-1 uppercase tracking-wider">Irreversible community notification lock</span>
              </div>
            </div>

            {/* Warning details */}
            <div className="py-4 space-y-3.5 text-xs">
              <p className="text-slate-300 font-semibold leading-relaxed">
                You are about to broadcast this packet to the <strong className="text-white bg-[#1a2d42] px-2 py-0.5 rounded border border-white/5 font-bold uppercase">{audience}</strong> segment. 
                This action fires active webhook protocols, pushes notifications, and updates live member feed catalogs.
              </p>

              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl space-y-1.5 font-semibold text-[11px] leading-relaxed">
                <p className="font-extrabold text-white text-xs leading-none uppercase tracking-wide">Dynamic Safe Locks Armed</p>
                To override security guards, type intermediate confirmation phrase <strong className="text-white uppercase font-mono bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-500/30">CONFIRM</strong> in the box below.
              </div>

              {/* Secure phrase input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block">Type CONFIRM to proceed</label>
                <input
                  type="text"
                  placeholder="Type CONFIRM here..."
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full bg-[#162537] border border-white/10 rounded-xl py-3 px-3.5 text-sm font-mono font-bold text-[#E2E8F0] focus:ring-1 focus:ring-rose-500 focus:outline-none focus:border-rose-500 placeholder-slate-500 uppercase tracking-wider"
                  autoFocus
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmText('');
                }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer text-center min-h-[44px]"
              >
                Abrupt Abort
              </button>
              <button
                type="button"
                disabled={isSending || confirmText.toUpperCase() !== 'CONFIRM'}
                onClick={handleSendBroadcast}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider transition rounded-xl min-h-[44px] flex items-center justify-center gap-1.5 ${
                  confirmText.toUpperCase() === 'CONFIRM' && !isSending
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/10 cursor-pointer'
                    : 'bg-[#182638] text-slate-500 border border-white/2 cursor-not-allowed'
                }`}
              >
                {isSending ? (
                  <span>Dispatching...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Fire Broadcast</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
