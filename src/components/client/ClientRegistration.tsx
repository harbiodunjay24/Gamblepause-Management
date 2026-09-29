import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  User,
  MapPin,
  Phone,
  Mail,
  UserPlus,
  LogIn,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import { NIGERIAN_STATES } from '../../data/demoData';
import { dataService } from '../../services/dataService';
import { authService, AuthUser } from '../../services/authService';
import { auth } from '../../lib/firebase';
import { Client } from '../../types';

interface ClientRegistrationProps {
  onRegistrationComplete: (client: Client, startImmediateAssessment: boolean) => void;
  onClientLogin?: () => void;
}

export const ClientRegistration: React.FC<ClientRegistrationProps> = ({
  onRegistrationComplete,
  onClientLogin,
}) => {
  // Authentication status
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [existingClientRecord, setExistingClientRecord] = useState<Client | null>(null);
  const [isCheckingExistingClient, setIsCheckingExistingClient] = useState(false);

  // Firebase Auth Form State (New Intake Account Registration)
  const [authFullName, setAuthFullName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Drive Biodata Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    preferredName: '',
    age: '',
    gender: 'Male' as 'Male' | 'Female' | 'Prefer not to say' | 'Other',
    phone: '',
    email: '',
    state: 'Lagos',
    location: '',
    occupation: '',
    maritalStatus: 'Single' as 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Separated',
    howHeard: 'Social Media (Twitter/X / Instagram / TikTok)',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    consentGiven: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const populateFromFullNameAndEmail = (fullName: string, email: string) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const fName = parts[0] || '';
    const lName = parts.slice(1).join(' ') || '';
    setFormData((prev) => ({
      ...prev,
      firstName: prev.firstName || fName,
      lastName: prev.lastName || lName,
      email: email ? email.trim().toLowerCase() : prev.email,
    }));
  };

  // Sync auth state and pre-populate biodata
  useEffect(() => {
    const unsub = authService.subscribe((user) => {
      setCurrentUser(user);
      if (user) {
        const userDisplayName = user.name || auth.currentUser?.displayName || '';
        const userEmail = auth.currentUser?.email || user.email || '';
        populateFromFullNameAndEmail(userDisplayName, userEmail);
      }
    });

    if (currentUser) {
      const userDisplayName = currentUser.name || auth.currentUser?.displayName || '';
      const userEmail = auth.currentUser?.email || currentUser.email || '';
      populateFromFullNameAndEmail(userDisplayName, userEmail);
    } else if (auth.currentUser) {
      const fbUser = auth.currentUser;
      const userDisplayName = fbUser.displayName || '';
      const userEmail = fbUser.email || '';
      if (userDisplayName || userEmail) {
        populateFromFullNameAndEmail(userDisplayName, userEmail);
      }
    }

    return () => unsub();
  }, [currentUser]);

  // Check if authenticated user already has an active client record
  useEffect(() => {
    let isMounted = true;
    async function checkExistingClient() {
      const authUid = auth.currentUser?.uid || currentUser?.id;
      if (authUid) {
        setIsCheckingExistingClient(true);
        try {
          const client = await dataService.getClientByAuthUid(authUid);
          if (isMounted && client) {
            setExistingClientRecord(client);
          }
        } catch (e) {
          console.warn('[ClientRegistration] checkExistingClient error:', e);
        } finally {
          if (isMounted) {
            setIsCheckingExistingClient(false);
          }
        }
      } else {
        setExistingClientRecord(null);
        setIsCheckingExistingClient(false);
      }
    }
    checkExistingClient();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Handle Firebase Register for New Intake
  const handleAuthRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const trimmedFullName = authFullName.trim();
    if (!trimmedFullName) {
      setAuthError('Please enter your full name.');
      return;
    }

    const cleanEmail = authEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setAuthError('PASSWORD OR EMAIL INCORRECT');
      return;
    }
    if (!authPassword || authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }
    if (authPassword !== authConfirmPassword) {
      setAuthError('Passwords do not match. Please re-enter.');
      return;
    }

    // Split Full Name into First Name and Last Name for automatic population
    const nameParts = trimmedFullName.split(/\s+/).filter(Boolean);
    const fName = nameParts[0] || '';
    const lName = nameParts.slice(1).join(' ') || '';

    setIsAuthLoading(true);
    try {
      const res = await authService.firebaseRegister(cleanEmail, authPassword, trimmedFullName, 'Client');
      if (res.success && res.user) {
        // Immediately set user and pre-populate biodata form
        setCurrentUser(res.user);
        setFormData((prev) => ({
          ...prev,
          firstName: fName,
          lastName: lName,
          email: cleanEmail,
        }));
        setAuthSuccess('Account created successfully! Continuing to your intake form...');
      } else {
        // As explicitly required: IF A USER IS WITH THOSE CREDENTIALS ALREADY EXISTS DISPLAY ' USER ALREADY EXISTS ,SIGN IN
        if (res.error?.includes('ALREADY EXISTS') || res.error?.includes('email-already-in-use')) {
          setAuthError(' USER ALREADY EXISTS ,SIGN IN');
        } else {
          setAuthError(res.error || 'Registration failed. Please try again.');
        }
      }
    } catch (err: any) {
      if (err.message?.includes('already-in-use') || err.code === 'auth/email-already-in-use') {
        setAuthError(' USER ALREADY EXISTS ,SIGN IN');
      } else {
        setAuthError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'Please enter your first name.';
    if (!formData.lastName.trim()) newErrors.lastName = 'Please enter your last name.';
    const ageRaw = formData.age.trim();
    if (!ageRaw) {
      newErrors.age = 'Please enter your age.';
    } else {
      const parsedAge = Number(ageRaw);
      if (isNaN(parsedAge) || parsedAge < 1) {
        newErrors.age = 'Please enter a valid age.';
      } else if (parsedAge > 100) {
        newErrors.age = 'Please enter an age between 1 and 100.';
      }
    }
    const effectiveEmail = (auth.currentUser?.email || currentUser?.email || formData.email).trim().toLowerCase();
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required for follow-up reminders.';
    }
    if (!effectiveEmail || !effectiveEmail.includes('@')) {
      newErrors.email = 'Valid authenticated email address required.';
    }
    if (!formData.state) newErrors.state = 'Please select your state.';
    if (!formData.location.trim()) newErrors.location = 'Please provide your city area or LGA.';
    if (!formData.occupation.trim()) newErrors.occupation = 'Please enter your current occupation or study.';
    if (!formData.consentGiven) {
      newErrors.consentGiven = 'Your consent is required to participate in GamblePause.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent, startImmediate: boolean) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Authenticated Firebase user MUST exist before creating a client document
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setErrors({
        form: 'Your authentication session has expired. Please sign in again using the account switcher above.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const authenticatedUid = fbUser.uid;
    const authenticatedEmail = (fbUser.email || '').trim().toLowerCase();

    if (!authenticatedEmail) {
      setErrors({
        form: 'Your authenticated account does not have a valid email address. Please switch account and re-authenticate.',
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      const newClient = await dataService.registerClient({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        preferredName: formData.preferredName.trim() || undefined,
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: authenticatedEmail, // Authenticated Firebase email is the single source of truth
        state: formData.state,
        location: formData.location.trim(),
        occupation: formData.occupation.trim(),
        maritalStatus: formData.maritalStatus,
        howHeard: formData.howHeard,
        emergencyContact: formData.emergencyName
          ? {
              name: formData.emergencyName.trim(),
              relationship: formData.emergencyRelationship.trim() || 'Trusted Contact',
              phone: formData.emergencyPhone.trim(),
            }
          : undefined,
        consentGiven: formData.consentGiven,
        authUid: authenticatedUid, // Authenticated Firebase UID is the single source of truth
      });

      onRegistrationComplete(newClient, startImmediate);
    } catch (err: any) {
      console.error('Registration failed:', err);
      const isPermissionDenied =
        err?.code === 'permission-denied' ||
        err?.message?.includes('permission-denied') ||
        err?.message?.includes('Missing or insufficient permissions');

      if (isPermissionDenied) {
        setErrors({
          form: 'Firestore Authorization Error (permission-denied): Security rules rejected client creation for your authenticated account. Please ensure you are signed in with a valid account.',
        });
      } else {
        setErrors({ form: err?.message || 'An error occurred during registration. Please try again.' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 font-sans">
      {/* Intro hero card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm mb-6 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3.5 py-1 rounded-full text-xs font-bold mb-4 border border-red-100">
          <HeartHandshake className="w-4 h-4 text-red-600" />
          <span>GamblePause Harm Reduction Drive</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-gray-950 tracking-tight">
          Client Assessment & Recovery Drive
        </h1>

        <p className="mt-2.5 text-gray-600 text-sm sm:text-base leading-relaxed">
          Welcome to the GamblePause Assessment Drive. We provide confidential, evidence-based
          support to help you or your family navigate recovery from gambling harms.
        </p>

        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-red-600" />
            <span>Strictly Confidential & Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
            <span>Takes ~3 minutes to complete</span>
          </div>
        </div>
      </div>

      {/* GATE: If user is not authenticated, show Firebase Account Registration Flow */}
      {!currentUser ? (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-md mb-6">
          <div className="text-center space-y-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-red-600 text-white flex items-center justify-center mx-auto shadow-sm font-black text-lg">
              GP
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-950">
              Create Your Account
            </h2>
            <p className="text-xs text-gray-600 max-w-md mx-auto">
              Register your account to begin your confidential assessment and access your recovery portal.
            </p>
          </div>

          {/* Error Message */}
          {authError && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-black text-sm uppercase tracking-wide">{authError}</span>
              </div>
              {authError.includes('USER ALREADY EXISTS') && (
                <button
                  type="button"
                  onClick={() => {
                    if (onClientLogin) {
                      onClientLogin();
                    } else {
                      window.location.href = '/client/login';
                    }
                  }}
                  className="mt-1 self-start inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Go to Client Login</span>
                </button>
              )}
            </div>
          )}

          {/* Success Message */}
          {authSuccess && (
            <div className="mb-5 p-3.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span className="font-bold">{authSuccess}</span>
            </div>
          )}

          {/* Account Registration Form */}
          <form onSubmit={handleAuthRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={authFullName}
                  onChange={(e) => setAuthFullName(e.target.value)}
                  placeholder="e.g. Abiodun Ayodeji"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Create Password (min 6 characters)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showAuthPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowAuthPassword(!showAuthPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showAuthPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showAuthPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={authConfirmPassword}
                  onChange={(e) => setAuthConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthLoading}
              className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 transition-all disabled:opacity-50 cursor-pointer mt-2"
            >
              {isAuthLoading ? 'Creating Firebase Account...' : 'Register & Begin Assessment'}
            </button>
          </form>

          {/* Existing client option */}
          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-600">
              Already registered?{' '}
              <button
                type="button"
                onClick={() => {
                  if (onClientLogin) {
                    onClientLogin();
                  } else {
                    window.location.href = '/client/login';
                  }
                }}
                className="font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
              >
                Sign In to Client Portal
              </button>
            </p>
          </div>
        </div>
      ) : (
        /* Authenticated Status Banner */
        <div className="space-y-4 mb-6">
          <div className="bg-red-50/60 border border-red-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold text-xs">
                {(currentUser.name || auth.currentUser?.displayName || 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-black text-gray-950 flex items-center gap-1.5">
                  <span>Authenticated with Firebase</span>
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                <p className="text-xs text-gray-600">
                  Signed in as <strong className="text-gray-900 font-semibold">{auth.currentUser?.email || currentUser.email}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                authService.logout();
                setCurrentUser(null);
                setExistingClientRecord(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-red-600 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch Account</span>
            </button>
          </div>
        </div>
      )}

      {existingClientRecord ? (
        /* EXISTING CLIENT VIEW: Never show biodata form again */
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Existing Client Record Active
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-gray-950 mt-1">
                  Welcome Back, {existingClientRecord.preferredName || existingClientRecord.firstName}
                </h2>
              </div>
            </div>

            <div className="sm:text-right">
              <div className="text-[11px] text-gray-500 font-mono">Client ID</div>
              <div className="text-sm font-black text-gray-900">{existingClientRecord.id}</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-3">
            <p className="text-gray-600 text-sm leading-relaxed">
              You are already registered with GamblePause! Your clinical profile is active in Firestore and your existing biodata is safely preserved. You do not need to re-enter your biodata.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Registered Email</span>
                <span className="font-semibold text-gray-900">{existingClientRecord.email}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Current Stage</span>
                <span className="font-semibold text-gray-900">{existingClientRecord.currentStageName || existingClientRecord.currentStageId}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Phone</span>
                <span className="font-semibold text-gray-900">{existingClientRecord.phone}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Assigned Counsellor</span>
                <span className="font-semibold text-gray-900">{existingClientRecord.assignedCounsellorName || 'GamblePause Clinical Team'}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (onClientLogin) {
                  onClientLogin();
                } else {
                  window.location.href = '/client';
                }
              }}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <span>Go to Client Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                authService.logout();
                setCurrentUser(null);
                setExistingClientRecord(null);
              }}
              className="w-full sm:w-auto px-5 py-3.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Sign In with Different Account
            </button>
          </div>
        </div>
      ) : isCheckingExistingClient ? (
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-xs text-gray-500 font-medium">Checking your client profile...</p>
        </div>
      ) : (
        /* Main Biodata Form: Available ONLY for Brand-New Authenticated Clients */
        <form
          onSubmit={(e) => handleSubmit(e, true)}
          className={`bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6 transition-opacity ${
            !currentUser ? 'opacity-40 pointer-events-none' : 'opacity-100'
          }`}
          id="client-biodata-form"
        >
        <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <User className="w-5 h-5 text-red-600" />
              <span>Assessment Drive Details</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Please verify your personal biodata for your clinical recovery record.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
            Step 2
          </span>
        </div>

        {errors.form && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              id="biodata-firstname"
              placeholder="e.g. Oluwaseun"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.firstName ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
            />
            {errors.firstName && <p className="text-[11px] text-red-600 mt-1">{errors.firstName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              id="biodata-lastname"
              placeholder="e.g. Adeleke"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.lastName ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
            />
            {errors.lastName && <p className="text-[11px] text-red-600 mt-1">{errors.lastName}</p>}
          </div>
        </div>

        {/* Preferred Name & Age */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Preferred Name / Nickname <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              id="biodata-preferredname"
              placeholder="What should we call you? (e.g. Seun)"
              value={formData.preferredName}
              onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Age <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={100}
              id="biodata-age"
              placeholder="Enter age (1-100)"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 bg-white placeholder-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.age ? 'border-red-500 bg-red-50/30' : 'border-gray-300 focus:border-red-500'
              }`}
            />
            {errors.age && <p className="text-[11px] text-red-600 mt-1">{errors.age}</p>}
          </div>
        </div>

        {/* Gender Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-2">
            Gender <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(['Male', 'Female', 'Prefer not to say', 'Other'] as const).map((genderOption) => (
              <label
                key={genderOption}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                  formData.gender === genderOption
                    ? 'border-red-600 bg-red-50 text-red-700 shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  checked={formData.gender === genderOption}
                  onChange={() => setFormData({ ...formData, gender: genderOption })}
                  className="accent-red-600 w-3.5 h-3.5"
                />
                <span>{genderOption}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Contact Info: Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Phone / WhatsApp Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-gray-500 font-medium">
                🇳🇬 +234
              </span>
              <input
                type="tel"
                required
                id="biodata-phone"
                placeholder="803 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full pl-20 pr-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  errors.phone ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
                }`}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Used for timely assessment reminders via SMS/WhatsApp.</p>
            {errors.phone && <p className="text-[11px] text-red-600 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-800">
                Email Address
              </label>
              {(auth.currentUser?.email || currentUser?.email) && (
                <span className="text-[10px] text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-600" />
                  <span>Linked to Firebase</span>
                </span>
              )}
            </div>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="email"
                required
                readOnly
                disabled
                id="biodata-email"
                placeholder="you@example.com"
                value={auth.currentUser?.email || currentUser?.email || formData.email}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm transition-all border-gray-200 bg-gray-100 text-gray-700 cursor-not-allowed select-none"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Confidential assessment links and clinical updates are sent here.</p>
            {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
          </div>
        </div>

        {/* Nigerian State & LGA / Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              State (Nigeria) <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.state}
              id="biodata-state"
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {NIGERIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              City / LGA / Neighborhood <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              id="biodata-location"
              placeholder="e.g. Ikeja, Yaba, Garki, Bodija"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.location ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
            />
            {errors.location && <p className="text-[11px] text-red-600 mt-1">{errors.location}</p>}
          </div>
        </div>

        {/* Occupation & Marital Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Occupation / Student Status <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              id="biodata-occupation"
              placeholder="e.g. Trader, Civil Servant, Student, Developer"
              value={formData.occupation}
              onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.occupation ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
            />
            {errors.occupation && <p className="text-[11px] text-red-600 mt-1">{errors.occupation}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Marital Status <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.maritalStatus}
              id="biodata-marital"
              onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Separated">Separated</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
            </select>
          </div>
        </div>

        {/* How did you hear about GamblePause */}
        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1.5">
            How did you hear about GamblePause? <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.howHeard}
            id="biodata-howheard"
            onChange={(e) => setFormData({ ...formData, howHeard: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="Social Media (Twitter/X / Instagram / TikTok)">Social Media (Twitter/X / Instagram / TikTok)</option>
            <option value="Friend or Family member">Friend or Family member</option>
            <option value="Community Outreach / Campus Seminar">Community Outreach / Campus Seminar</option>
            <option value="Radio or Podcast Broadcast">Radio or Podcast Broadcast</option>
            <option value="WhatsApp Group or Telegram">WhatsApp Group or Telegram</option>
            <option value="Online Search / News Article">Online Search / News Article</option>
            <option value="Referral from Health Facility / Counsellor">Referral from Health Facility / Counsellor</option>
          </select>
        </div>

        {/* Emergency / Trusted Contact (Optional) */}
        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900">Alternative / Trusted Contact</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider bg-gray-200/70 px-2 py-0.5 rounded">
              Optional
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            A trusted family member, close friend, or mentor we can reach in emergency situations.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                placeholder="Contact Name"
                value={formData.emergencyName}
                onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Relationship (e.g. Spouse, Brother)"
                value={formData.emergencyRelationship}
                onChange={(e) => setFormData({ ...formData, emergencyRelationship: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.emergencyPhone}
                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Privacy & Consent Language */}
        <div className="p-4 rounded-2xl border border-red-100 bg-red-50/40 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="biodata-consent"
              checked={formData.consentGiven}
              onChange={(e) => setFormData({ ...formData, consentGiven: e.target.checked })}
              className="mt-1 accent-red-600 w-4 h-4 rounded cursor-pointer shrink-0"
            />
            <label htmlFor="biodata-consent" className="text-xs text-gray-700 leading-relaxed cursor-pointer">
              <strong className="text-gray-950 font-bold">Consent to Participate:</strong> I willingly register for the
              GamblePause harm-reduction programme. I understand my personal data and assessment answers are strictly
              confidential, protected under Nigerian Data Protection Regulations (NDPR), and accessible only by authorized
              GamblePause counsellors to guide my recovery.
            </label>
          </div>
          {errors.consentGiven && <p className="text-[11px] text-red-600 ml-7">{errors.consentGiven}</p>}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={isSubmitting || !currentUser}
            id="register-submit-start-btn"
            className="flex-1 py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm shadow-md shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Registering Record...</span>
            ) : (
              <>
                <span>Submit & Start Initial Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400">
          Already registered? Your counsellor or automated SMS will provide your direct secure link.
        </p>
      </form>
      )}
    </div>
  );
};
