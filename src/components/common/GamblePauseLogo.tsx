import React from 'react';

interface GamblePauseLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const GamblePauseLogo: React.FC<GamblePauseLogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = true,
}) => {
  // Dimensions for the icon
  const iconDimensions = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-14 h-14 rounded-2xl',
    xl: 'w-16 h-16 rounded-2xl',
  }[size];

  const textSize = {
    sm: 'text-sm',
    md: 'text-base sm:text-lg',
    lg: 'text-xl sm:text-2xl',
    xl: 'text-2xl sm:text-3xl',
  }[size];

  const africaTagSize = {
    sm: 'text-[9px] px-1 py-0.2',
    md: 'text-[10px] px-1.5 py-0.5',
    lg: 'text-xs px-2 py-0.5',
    xl: 'text-xs px-2 py-0.5',
  }[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Official GamblePause Logo Mark SVG Asset */}
      <div
        className={`${iconDimensions} shrink-0 shadow-md shadow-red-600/20 overflow-hidden flex items-center justify-center bg-gradient-to-br from-red-500 to-red-700`}
      >
        <svg
          viewBox="0 0 512 512"
          className="w-full h-full p-1"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <filter id="gpShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.25" />
            </filter>
          </defs>
          <g filter="url(#gpShadow)">
            {/* Pause Bars representing the "Pause" in GamblePause */}
            <rect x="156" y="146" width="70" height="220" rx="35" fill="#FFFFFF" />
            <rect x="286" y="146" width="70" height="220" rx="35" fill="#FFFFFF" />
            {/* Heart / Leaf Protection Accent */}
            <circle cx="256" cy="116" r="28" fill="#FEE2E2" />
          </g>
        </svg>
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <span className={`font-black tracking-tight text-gray-950 ${textSize}`}>
            GAMBLE<span className="text-red-600">PAUSE</span>
          </span>
          <span
            className={`font-bold uppercase tracking-wider bg-red-50 text-red-700 rounded border border-red-200 ${africaTagSize}`}
          >
            Africa
          </span>
        </div>
        {showSubtitle && (
          <p className="text-[11px] text-gray-500 font-medium leading-none mt-0.5">
            Client Management & Assessment System
          </p>
        )}
      </div>
    </div>
  );
};
