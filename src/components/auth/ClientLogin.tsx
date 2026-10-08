import React, { useState } from 'react';
import { Lock, User, AlertCircle, ArrowLeft, Eye, EyeOff, Shield, HeartHandshake, CheckCircle2, UserPlus, LogIn } from 'lucide-react';
import { authService, AuthUser } from '../../services/authService';

interface ClientLoginProps {
  onLoginSuccess: (user: AuthUser) => void;
  onBackToHome: () => void;
  onGoToIntake: () => void;
}

export const ClientLogin: React.FC<ClientLoginProps> = ({
  onLoginSuccess,
  onBackToHome,
  onGoToIntake,
}) => {
  // Sign in fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('PASSWORD OR EMAIL INCORRECT');
      return;
    }
    if (!password) {
      setError('PASSWORD OR EMAIL INCORRECT');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.login(cleanId, password, 'client');
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        // As explicitly required: IF EMAIL / PASSWORD ARE INCORRECT DISPLAY "PASSWORD OR EMAIL INCORRECT"
        setError(res.error || 'PASSWORD OR EMAIL INCORRECT');
      }
    } catch (err: any) {
      setError('PASSWORD OR EMAIL INCORRECT');
    } finally {
      setIsLoading(false);
    }
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
          <span>Back to Home</span>
        </button>

        <button
          onClick={onGoToIntake}
          className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
        >
          Assessment Drive & Intake
        </button>
      </div>

      {/* Main Login/Register Card */}
      <div className="max-w-md mx-auto w-full my-auto">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-md">
          {/* Header */}
          <div className="text-center space-y-2 mb-6 flex flex-col items-center">
            <img
              src="/icon.svg"
              alt="GamblePause Africa Logo"
              className="w-16 h-16 object-contain rounded-2xl shadow-md border border-red-100 mx-auto"
            />
            <div className="inline-flex items-center gap-1.5 pt-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                AFRICA
              </span>
              <span className="text-xs font-bold text-gray-800">
                Client Recovery & Assessment Portal
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Sign in with your registered email and password to access your recovery portal.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-black text-sm uppercase tracking-wide">{error}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Email Address or Client ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or GP-0001"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Account Password
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
              {isLoading ? 'Authenticating with Firebase...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* New Intake Link */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center space-y-2.5">
            <p className="text-xs text-gray-600">
              New participant?{' '}
              <button
                type="button"
                onClick={onGoToIntake}
                className="font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
              >
                Start New Intake / Assessment Drive
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Official Footer with GamblePause Digital Team signature */}
      <footer className="text-center text-xs text-gray-500 py-4 font-medium">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Shield className="w-3.5 h-3.5 text-red-600" />
          <span>All client submissions are confidential & NDPR protected</span>
        </div>
        <div>
          Maintained by <span className="text-red-600 font-bold">GamblePause Digital Team</span>
        </div>
      </footer>
    </div>
  );
};
