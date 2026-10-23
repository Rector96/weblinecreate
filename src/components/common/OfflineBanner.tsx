import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../lib/pwa';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs font-semibold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-md">
      <WifiOff className="w-3.5 h-3.5" />
      <span>Offline Mode active — exam drafts are safely saved to your local device.</span>
    </div>
  );
};
