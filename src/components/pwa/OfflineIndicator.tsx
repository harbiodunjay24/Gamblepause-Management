import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (showReconnected) {
    return (
      <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xl animate-in slide-in-from-bottom-2 duration-300">
        <Wifi className="w-4 h-4 text-emerald-100 shrink-0" />
        <span>Back Online — Synchronization active.</span>
      </div>
    );
  }

  if (isOnline) return null;

  return (
    <aside aria-label="Offline Status" className="fixed bottom-4 left-4 z-50 max-w-sm flex items-center gap-3 rounded-2xl bg-amber-600 px-4 py-2.5 text-xs font-medium text-white shadow-2xl animate-in slide-in-from-bottom-2 duration-300 border border-amber-500/50">
      <div className="relative flex items-center justify-center">
        <span className="absolute h-3 w-3 rounded-full bg-white opacity-75 animate-ping" />
        <WifiOff className="relative w-4 h-4 text-white shrink-0" />
      </div>
      <div className="leading-tight">
        <p className="font-bold text-white">Low / Offline Connectivity</p>
        <p className="text-[11px] text-amber-100">
          Counsellor tools &amp; forms are cached and fully accessible.
        </p>
      </div>
    </aside>
  );
};
