import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error inside MVOC Portal:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = async () => {
    try {
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (e) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050D1A] flex items-center justify-center p-4 relative overflow-hidden font-sans text-white">
          {/* Background radial soft lights */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-blue-950/20 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute -bottom-10 left-1/4 w-[350px] h-[350px] bg-[#0b1c30]/40 rounded-full blur-[120px] pointer-events-none" />

          <div className="w-full max-w-md bg-[#0B1C30]/90 border border-blue-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-xl">
            {/* Accent Glow Top Border */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 rounded-t-3xl" />

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-950/30 border border-blue-500/30 text-blue-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(37,99,235,0.15)] animate-pulse">
                <ShieldAlert className="w-8 h-8" />
              </div>

              <div className="mb-4 inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                <span className="text-[10px] font-black tracking-widest text-[#4D94FF] uppercase font-mono">
                  Sistem Pemulihan Portal
                </span>
              </div>

              <h2 className="text-xl font-display font-black text-white tracking-tight mb-3">
                Ralat Sistem Dikesan
              </h2>
              
              <p className="text-[#A5BFCF] text-xs font-medium leading-relaxed mb-6">
                Satu gangguan teknikal yang tidak dijangka telah berlaku. Sila cuba muat semula portal atau log keluar untuk menetapkan semula sesi anda.
              </p>

              {this.state.error && (
                <div className="w-full bg-[#16243A]/60 border border-white/5 p-4 rounded-2xl mb-8 text-left space-y-2">
                  <span className="text-[9px] font-bold text-slate-500 font-mono uppercase tracking-widest block">
                    ERROR LOG
                  </span>
                  <div className="max-h-24 overflow-y-auto">
                    <p className="font-mono text-[10px] text-red-400 break-words leading-relaxed">
                      {this.state.error.name}: {this.state.error.message}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="w-full space-y-3">
                <button
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs h-[48px] rounded-xl transition-all shadow-lg font-mono uppercase tracking-widest cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Muat Semula Portal
                </button>

                <button
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center gap-2 bg-[#16243A] hover:bg-[#20334E] active:bg-[#0D1826] text-slate-300 hover:text-white font-bold text-xs h-[46px] rounded-xl border border-white/5 hover:border-white/10 transition-all cursor-pointer font-mono uppercase tracking-widest"
                >
                  <LogOut className="w-4 h-4 text-red-500" />
                  Log Keluar & Set Semula Sesi
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
