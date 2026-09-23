import React, { useState } from 'react';
import { Download, Share, X, CheckCircle2, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA on the home screen, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer ${
          compact ? 'px-3 py-1.5' : 'px-4 py-2'
        } ${className}`}
        title="Install GamblePause PWA for offline access"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Install App' : 'Install Offline App'}</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs shadow-xs transition-all cursor-pointer ${
            compact ? 'px-3 py-1.5' : 'px-4 py-2'
          } ${className}`}
          title="Install GamblePause to Home Screen"
        >
          <Smartphone className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-sm">
                    GP
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900">Install GamblePause</h3>
                    <p className="text-[11px] text-gray-500 font-medium">Add to iPhone / iPad Home Screen</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs text-gray-600 mb-5">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200/60">
                  <div className="w-6 h-6 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">Tap the Share Icon</p>
                    <p className="text-gray-500 text-[11px]">
                      At the bottom bar of Safari, tap <Share className="w-3.5 h-3.5 inline mx-1 text-blue-600" /> Share.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-200/60">
                  <div className="w-6 h-6 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">Add to Home Screen</p>
                    <p className="text-gray-500 text-[11px]">
                      Scroll down and tap <strong>Add to Home Screen</strong> (+ icon).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/60">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-emerald-800 text-[11px] font-medium leading-relaxed">
                    Once added, GamblePause assessment forms will open instantly even when connection is low or offline.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-gray-900 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition cursor-pointer"
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
