import React, { useState } from 'react';
import { Download, Share2, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../lib/pwa';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  if (isInstallable) {
    return (
      <div className="mx-4 my-2 p-3 bg-purple-50 border border-purple-200/80 rounded-2xl flex items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-purple-950">Install ExamCraft Native App</h4>
            <p className="text-[11px] text-purple-700">Add to your home screen for rapid offline exam generation</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={install}
            className="px-3 py-1.5 rounded-xl bg-purple-700 text-white font-semibold text-xs hover:bg-purple-800 transition-colors shadow-xs"
          >
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1.5 text-purple-400 hover:text-purple-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (isIOS) {
    return (
      <>
        <div className="mx-4 my-2 p-3 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Install ExamCraft on iPhone</h4>
              <p className="text-[11px] text-slate-500">Run as a standalone app on your home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowIOSGuide(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              How to Install
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-left border border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Install on iPhone / iPad</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                1. Tap the <strong className="text-slate-900">Share button</strong> (box with arrow) in your Safari toolbar.<br />
                2. Scroll down and select <strong className="text-slate-900">Add to Home Screen</strong>.<br />
                3. Tap <strong className="text-slate-900">Add</strong> at the top right.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-purple-700 py-2.5 text-xs font-semibold text-white hover:bg-purple-800 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
