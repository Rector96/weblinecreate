import React from 'react';

/** Minimal branded loading screen: shaking RC monogram and a softly blinking wordmark. */
export const PageLoader: React.FC = () => (
  <div className="rockcraft-page-loader fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center overflow-hidden select-none" role="status" aria-label="ROCKCRAFT loading" aria-live="polite">
    <div className="rockcraft-loader-brand flex flex-col items-center gap-3">
      <img src="/rockcraft-logo.png" alt="" className="rockcraft-loader-logo" />
      <span className="rockcraft-loader-wordmark">ROCKCRAFT</span>
    </div>
  </div>
);
