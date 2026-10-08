import React, { useState } from 'react';
import { ShieldCheck, Lock, User, AlertCircle, ArrowLeft, Eye, EyeOff, Shield, Mail, CheckCircle2 } from 'lucide-react';
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

  // Forgot password state
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSendingReset, setIsSendingReset] = useState(false);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('deactivated') === '1') {
        setError('Your account has been deactivated. Please contact an administrator.');
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your username or registered email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.login(cleanId, password, 'admin');
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'PASSWORD OR EMAIL INCORRECT');
      }
    } catch (err: any) {
      setError('PASSWORD OR EMAIL INCORRECT');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setResetError('Please enter a valid staff email address.');
      return;
    }

    setIsSendingReset(true);
    try {
      const res = await authService.sendStaffPasswordResetEmail(cleanEmail);
      if (res.success) {
        setResetSuccess('Password reset link sent! Check your inbox to set a new password.');
        setResetEmail('');
      } else {
        setResetError(res.error || 'Failed to send password reset email. Please verify your email.');
      }
    } catch (err: any) {
      setResetError(err.message || 'An error occurred while sending the reset email.');
    } finally {
      setIsSendingReset(false);
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
          <span>Back to GamblePause Home</span>
        </button>

        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
          Authorized Staff Only
        </span>
      </div>

      {/* Main Card */}
      <div className="max-w-md mx-auto w-full my-auto">
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-md">
          {/* Brand Header */}
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
              <span className="text-xs font-bold text-gray-700">
                Staff & Counsellor Portal
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Authorized clinical and administrative access only.
            </p>
          </div>

          {!isResetMode ? (
            /* Standard Login Form */
            <>
              {error && (
                <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Email or Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Enter registered email or username"
                      autoComplete="username"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true);
                        setError(null);
                      }}
                      className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter account password"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
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
                  {isLoading ? 'Verifying Credentials...' : 'Sign In to Portal'}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                <p className="text-[11px] text-gray-500 font-medium">
                  Authorized staff only. All authentication attempts are verified through Firebase Authentication and security monitored.
                </p>
              </div>
            </>
          ) : (
            /* Forgot Password / Reset Password Form */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h2 className="text-sm font-bold text-gray-900">Reset Staff Password</h2>
                <p className="text-xs text-gray-500">
                  Enter your registered staff email address to receive a secure Firebase password reset link.
                </p>
              </div>

              {resetError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="font-semibold">{resetSuccess}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Registered Staff Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="e.g. staff@gamblepause.org"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingReset}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                >
                  {isSendingReset ? 'Sending Reset Email...' : 'Send Reset Link'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setResetError(null);
                    setResetSuccess(null);
                  }}
                  className="w-full py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </form>
            </div>
          )}
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
