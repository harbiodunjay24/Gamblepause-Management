import React from 'react';
import { Shield, Phone, Sparkles, Lock, LogOut, ArrowRight, HeartHandshake } from 'lucide-react';
import { AuthUser } from '../../services/authService';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface HeaderProps {
  isAuthenticated?: boolean;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onNavigateHome?: () => void;
  onGoToIntake?: () => void;
  onClientLogin?: () => void;
  isAdminView?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isAuthenticated,
  currentUser,
  onLogout,
  onNavigateHome,
  onGoToIntake,
  onClientLogin,
  isAdminView,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200">
      {/* Top micro-bar for national crisis helpline */}
      <div className="bg-[#111827] text-white py-1.5 px-4 text-xs font-medium">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-gray-300">GamblePause Free Helpline (Nigeria):</span>
            <a
              href="tel:0800426253"
              className="text-white hover:text-red-300 font-bold tracking-wide flex items-center gap-1 bg-red-600 px-2 py-0.5 rounded text-[11px]"
            >
              <Phone className="w-3 h-3" />
              0800-GAMBLE-PAUSE (Toll-Free)
            </a>
          </div>

          <div className="flex items-center gap-4 text-gray-400 text-xs">
            <span className="hidden sm:inline-flex items-center gap-1 text-gray-300">
              <Lock className="w-3 h-3 text-red-400" />
              100% Confidential & Non-Judgmental Support
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-xs text-gray-400">Lagos • Abuja • Port Harcourt • Nationwide</span>
          </div>
        </div>
      </div>

      {/* Main navigation bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        {/* Brand identity */}
        <div
          onClick={onNavigateHome}
          className="flex items-center gap-3 cursor-pointer group"
          id="brand-logo-button"
        >
          <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-red-600/20 group-hover:bg-red-700 transition-colors">
            GP
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black tracking-tight text-gray-950 text-base sm:text-lg">
                GAMBLE<span className="text-red-600">PAUSE</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                Africa
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium leading-none">
              Client Management & Assessment System
            </p>
          </div>
        </div>

        {/* Right side navigation / view switchers */}
        <div className="flex items-center gap-2 sm:gap-3">
          <PWAInstallButton compact />
          {isAdminView && isAuthenticated && currentUser ? (
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5"
                id="staff-profile-chip"
              >
                <div className="w-6 h-6 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="text-left leading-tight">
                  <p className="text-xs font-bold text-gray-900">{currentUser.name}</p>
                  <p className="text-[10px] text-red-600 font-semibold">{currentUser.role}</p>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-red-700 bg-white hover:bg-red-50 border border-gray-300 hover:border-red-300 px-3 py-1.5 rounded-lg shadow-sm transition-all"
                  title="Sign out of administrative console"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onGoToIntake && (
                <button
                  onClick={onGoToIntake}
                  className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  <span>Intake Form</span>
                </button>
              )}
              {onClientLogin && (
                <button
                  onClick={onClientLogin}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Lock className="w-3 h-3 text-gray-500" />
                  <span>Client Login</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

