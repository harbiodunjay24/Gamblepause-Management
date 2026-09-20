import React, { useState } from 'react';
import { Lock, User, AlertCircle, ArrowLeft, Eye, EyeOff, Shield, HeartHandshake } from 'lucide-react';
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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim()) {
      setError('Please enter your email or GamblePause Client ID (e.g., GP-0001).');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.login(identifier, password, 'client');
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Unable to sign in. Please verify your email and password.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoClient = () => {
    setIdentifier('GP-0001');
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
          <span>Back to Home</span>
        </button>

        <button
          onClick={onGoToIntake}
          className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
        >
          Need to register? Start Intake
        </button>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md mx-auto w-full my-auto">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-md">
          {/* Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center mx-auto shadow-sm font-black text-xl">
              GP
            </div>
            <h1 className="text-2xl font-black text-gray-950 tracking-tight">
              GAMBLE<span className="text-red-600">PAUSE</span>
            </h1>
            <p className="text-xs font-bold text-gray-800">
              Client Recovery Portal Login
            </p>
            <p className="text-xs text-gray-500">
              Sign in to view your milestones and complete your confidential assessments.
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
                Registered Email or Client ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. GP-0001 or registered email"
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
                  placeholder="Enter your account password"
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
              {isLoading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Demo Client autofill for test verification */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={fillDemoClient}
              className="text-xs text-gray-500 hover:text-red-600 font-medium underline cursor-pointer"
            >
              Autofill Sample Client (GP-0001)
            </button>
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
