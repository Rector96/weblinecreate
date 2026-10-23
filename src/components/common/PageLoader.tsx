import React from 'react';

/** One brand-only full-screen loader shared across the application. */
export const PageLoader: React.FC = () => (
  <div className="rockcraft-page-loader fixed inset-0 z-[100] flex min-h-[100dvh] w-full items-center justify-center overflow-hidden select-none" role="status" aria-label="ROCKCRAFT loading" aria-live="polite">
    <div className="rockcraft-loader-glow rockcraft-loader-glow-one" aria-hidden="true" />
    <div className="rockcraft-loader-glow rockcraft-loader-glow-two" aria-hidden="true" />
    <h1 className="rockcraft-loader-wordmark">ROCKCRAFT</h1>
  </div>
);
