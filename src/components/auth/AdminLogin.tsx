import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, Shield } from 'lucide-react';
import { authService, AuthUser } from '../../services/authService';

interface AdminLoginProps {
  onLoginSuccess: (user: AuthUser) => void;
  onBackToHome: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, onBackToHome }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Please enter your username or registered email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.login(identifier, password, 'admin');
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for fast-switching during authorized testing without revealing passwords on screen
  const selectQuickAccount = (loginId: string) => {
    setIdentifier(loginId);
    setPassword('Gamblepause');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between px-4 py-8 font-sans">
      {/* Top Bar */}
      <div className="max-w-md mx-auto w-full flex items-center justify-between">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-red-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to GamblePause Home</span>
        </button>

        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
          Staff Console
        </span>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md mx-auto w-full my-auto">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-md">
          {/* Brand Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center mx-auto shadow-sm font-black text-xl">
              GP
            </div>
            <h1 className="text-2xl font-black text-gray-950 tracking-tight">
              GAMBLE<span className="text-red-600">PAUSE</span>
            </h1>
            <p className="text-xs font-bold text-gray-700">
              Staff & Counsellor Management Portal
            </p>
            <p className="text-xs text-gray-500">
              Authorized clinical access for GamblePause counsellors and super users.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Username or Staff Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. Abiodun.Ayodeji or counsellor username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter account password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 transition-all duration-200 disabled:opacity-50 mt-2 cursor-pointer"
            >
              {isLoading ? 'Verifying Account...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Quick Staff Selection Buttons for Verification */}
          <div className="mt-6 pt-5 border-t border-gray-100 space-y-2">
            <div className="text-[11px] uppercase tracking-wider font-bold text-gray-500 text-center flex items-center justify-center gap-1">
              <KeyRound className="w-3 h-3 text-red-600" />
              <span>Select Staff Account</span>
            </div>

            <div className="text-[10px] font-bold text-gray-500 uppercase mt-2">Super Users</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectQuickAccount('Abiodun.Ayodeji')}
                className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100/70 border border-red-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-xs text-red-700">Abiodun Ayodeji</div>
                <div className="text-[10px] text-gray-500">Super User</div>
              </button>
              <button
                type="button"
                onClick={() => selectQuickAccount('Ladipo.Abiose')}
                className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100/70 border border-red-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-xs text-red-700">Ladipo Abiose</div>
                <div className="text-[10px] text-gray-500">Super User</div>
              </button>
            </div>

            <div className="text-[10px] font-bold text-gray-500 uppercase pt-1">Clinical Counsellors</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => selectQuickAccount('benjamin@gamblepause.org')}
                className="px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-[11px] text-gray-900 truncate">Benjamin</div>
                <div className="text-[9px] text-gray-500">Counsellor</div>
              </button>
              <button
                type="button"
                onClick={() => selectQuickAccount('micheal.akinniku@gamblepause.org')}
                className="px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-[11px] text-gray-900 truncate">Micheal A.</div>
                <div className="text-[9px] text-gray-500">Counsellor</div>
              </button>
              <button
                type="button"
                onClick={() => selectQuickAccount('celia.badmus@gamblepause.org')}
                className="px-2 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-left transition-colors cursor-pointer"
              >
                <div className="font-bold text-[11px] text-gray-900 truncate">Celia B.</div>
                <div className="text-[9px] text-gray-500">Counsellor</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Official Footer with GamblePause Digital Team signature */}
      <footer className="text-center text-xs text-gray-500 py-4 font-medium">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Shield className="w-3.5 h-3.5 text-red-600" />
          <span>Protected by GamblePause Role-Based Access Control</span>
        </div>
        <div>
          Maintained by <span className="text-red-600 font-bold">GamblePause Digital Team</span>
        </div>
      </footer>
    </div>
  );
};
