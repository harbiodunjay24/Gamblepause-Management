import React from 'react';
import { ShieldCheck, ArrowRight, Lock, PhoneCall, FileText, Shield } from 'lucide-react';

interface PublicHomeProps {
  onStartIntake: () => void;
  onClientLogin: () => void;
  onStaffLogin: () => void;
}

export const PublicHome: React.FC<PublicHomeProps> = ({
  onStartIntake,
  onClientLogin,
  onStaffLogin,
}) => {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-between selection:bg-red-600 selection:text-white font-sans">
      {/* Top Helpline Banner */}
      <div className="bg-red-600 px-4 py-2.5 text-xs sm:text-sm text-center text-white shadow-xs font-medium">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-2">
          <PhoneCall className="w-4 h-4 text-white shrink-0 animate-pulse" />
          <span>Need immediate confidential support? Call our 24/7 Helpline:</span>
          <strong className="text-white font-mono font-black tracking-wider bg-red-700/80 px-2 py-0.5 rounded">
            0800-GAMBLE-PAUSE
          </strong>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 sm:py-20 flex flex-col items-center justify-center">
        {/* Brand Header */}
        <div className="text-center space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
            <span>GamblePause Client Management & Assessment System</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-2xl shadow-md">
              GP
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-gray-950 tracking-tight">
              GAMBLE<span className="text-red-600">PAUSE</span>
            </h1>
          </div>

          <p className="text-xl sm:text-2xl text-gray-900 font-bold">
            Begin your assessment by completing the registration form.
          </p>

          <p className="text-sm text-gray-600 leading-relaxed max-w-xl mx-auto font-normal">
            GamblePause provides compassionate, confidential, and evidence-based clinical assessment and counselling support for individuals and families impacted by gambling harm across Africa.
          </p>
        </div>

        {/* Action Callouts */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
          {/* Primary Action: Start Intake Form */}
          <button
            onClick={onStartIntake}
            className="group relative flex flex-col items-start p-6 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 text-left border border-red-500 cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white">
                <FileText className="w-5 h-5" />
              </div>
              <ArrowRight className="w-5 h-5 opacity-85 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
            <span className="text-lg font-black tracking-tight">Start Intake Form</span>
            <span className="text-xs text-white/90 mt-1 font-medium">
              New client? Register in less than 3 minutes to begin your confidential recovery assessment.
            </span>
          </button>

          {/* Secondary Action: Client Login */}
          <button
            onClick={onClientLogin}
            className="group flex flex-col items-start p-6 rounded-2xl bg-white hover:bg-gray-50 text-gray-900 font-medium border border-gray-200 hover:border-red-300 shadow-sm transition-all duration-200 text-left cursor-pointer"
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 border border-red-100">
                <Lock className="w-5 h-5" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
            </div>
            <span className="text-lg font-bold text-gray-950">Client Login</span>
            <span className="text-xs text-gray-500 mt-1">
              Already registered? Sign in to view your recovery roadmap and pending check-ins.
            </span>
          </button>
        </div>

        {/* Confidentiality & Security Assurance */}
        <div className="mt-10 w-full max-w-xl p-5 rounded-2xl bg-gray-50 border border-gray-200 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-bold text-gray-900">100% Confidential & Secure</div>
            <p className="text-gray-600 leading-relaxed">
              Your responses are strictly protected under clinical privacy standards and NDPR guidelines. We will never share your personal data with third parties or gambling operators.
            </p>
          </div>
        </div>
      </main>

      {/* Public Footer with GamblePause Digital Team signature and Staff Access */}
      <footer className="border-t border-gray-200 bg-white px-4 py-5 text-xs text-gray-500">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-medium text-gray-600">
            <Shield className="w-4 h-4 text-red-600" />
            <span>&copy; {new Date().getFullYear()} GamblePause Initiative Africa. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-gray-500">
              Maintained by <strong className="text-red-600 font-bold">GamblePause Digital Team</strong>
            </span>
            <button
              onClick={onStaffLogin}
              className="text-gray-600 hover:text-red-600 font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Staff Login</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
