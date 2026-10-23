import React, { useEffect, useState } from 'react';
import { Sparkles, Shield, CheckCircle2 } from 'lucide-react';

interface PageLoaderProps {
  message?: string;
  subMessage?: string;
  onFinish?: () => void;
  minDurationMs?: number;
}

const LOADING_PHASES = [
  'Initializing ROCKCRAF Examination Engine...',
  'Synchronizing WAEC & JAMB Subject Standards...',
  'Verifying Nigerian Curriculum Schemes...',
  'Preparing Secure Teacher Workspace...'
];

export const PageLoader: React.FC<PageLoaderProps> = ({
  message,
  subMessage,
  onFinish,
  minDurationMs = 800,
}) => {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Progress interval
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return 95;
        const inc = Math.floor(Math.random() * 14) + 8;
        return Math.min(prev + inc, 95);
      });
    }, 180);

    // Text phase cycle
    const phaseInterval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % LOADING_PHASES.length);
    }, 900);

    // Minimum display timer
    const finishTimer = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          onFinish?.();
        }, 300);
      }, 200);
    }, minDurationMs);

    return () => {
      clearInterval(progressInterval);
      clearInterval(phaseInterval);
      clearTimeout(finishTimer);
    };
  }, [minDurationMs, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f0f4f9] px-6 transition-opacity duration-300 ease-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="Loading ROCKCRAF"
    >
      {/* Background radial gradient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm w-full">
        {/* Pulsing 3D Logo Emblem */}
        <div className="relative mb-6">
          {/* Subtle glowing halo ring */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-blue-600/30 to-indigo-500/20 blur-md animate-pulse" />
          
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/25 border border-white/20 transform transition-transform hover:scale-105">
            <span className="font-black text-2xl tracking-tighter select-none">RC</span>
          </div>

          {/* Micro status orb */}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#f0f4f9] flex items-center justify-center shadow-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          </div>
        </div>

        {/* Brand Name Typography */}
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5">
          <span>ROCKCRAF</span>
        </h1>
        
        <p className="text-[11px] font-semibold tracking-wider uppercase text-blue-700/80 mt-1">
          WAEC · NECO · JAMB Paper Engine
        </p>

        {/* Smooth Loading Indicator & Progress Bar */}
        <div className="w-full mt-7 space-y-2.5">
          <div className="h-1.5 w-full bg-blue-100/80 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 rounded-full transition-all duration-300 ease-out shadow-xs"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 px-0.5">
            <span className="animate-pulse truncate max-w-[240px]">
              {message || LOADING_PHASES[phaseIndex]}
            </span>
            <span className="font-mono font-bold text-blue-700 tabular-nums">
              {progress}%
            </span>
          </div>
        </div>

        {/* Sub-caption guarantee */}
        <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
          <Shield className="w-3.5 h-3.5 text-blue-600" />
          <span>{subMessage || 'Single-Page A4 Standard Layout · Times New Roman'}</span>
        </div>
      </div>
    </div>
  );
};
