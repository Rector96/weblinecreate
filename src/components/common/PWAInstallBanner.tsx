import React, { useState } from 'react';
import { Download, Share2, X, Smartphone, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../../lib/pwa';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isIOSBrowser, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('rockcraft-install-banner-dismissed') === '1'; }
    catch { return false; }
  });

  if (isInstalled || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem('rockcraft-install-banner-dismissed', '1'); } catch { /* private mode */ }
  };

  const handleInstall = async () => {
    const accepted = await install();
    if (accepted) dismiss();
    else if (!isInstallable) setShowGuide(true);
  };

  const guideTitle = isIOS ? 'Add ROCKCRAFT to your Home Screen' : 'Install ROCKCRAFT';
  const guideSteps = isIOS
    ? isIOSBrowser
      ? ['Tap the Share button in Safari.', 'Choose “Add to Home Screen”.', 'Tap “Add” to finish.']
      : ['Open this page in Safari.', 'Tap Share, then choose “Add to Home Screen”.', 'Tap “Add” to finish.']
    : ['Open your browser menu (⋮ or ⋯).', 'Choose “Install app” or “Add to Home screen”.', 'Confirm Install or Add. If you see an install icon in the address bar, you can use that too.'];

  return (
    <>
      <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-[70] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-blue-200 bg-white/95 p-3 text-left shadow-xl shadow-blue-950/10 backdrop-blur sm:inset-x-auto sm:bottom-5 sm:right-5 sm:mx-0 sm:w-[min(26rem,calc(100vw-2.5rem))]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-950">Install ROCKCRAFT</h4>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-600">Add it to your Home Screen for quick access like an app.</p>
        </div>
        <button type="button" onClick={handleInstall} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700">
          <Download className="h-3.5 w-3.5" />
          {isInstallable ? 'Install' : 'How to'}
        </button>
        <button type="button" onClick={dismiss} aria-label="Dismiss install suggestion" className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-900">
          <X className="h-4 w-4" />
        </button>
      </div>

      {showGuide && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rockcraft-install-title">
          <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              {isIOS ? <Share2 className="h-5 w-5" /> : <MoreVertical className="h-5 w-5" />}
            </div>
            <h3 id="rockcraft-install-title" className="text-base font-extrabold text-slate-950">{guideTitle}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">Follow these steps in your browser:</p>
            <ol className="mt-4 space-y-3">
              {guideSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-sm leading-5 text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setShowGuide(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Close</button>
              <button type="button" onClick={dismiss} className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Got it</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
