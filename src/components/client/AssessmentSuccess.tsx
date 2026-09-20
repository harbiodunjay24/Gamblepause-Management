import React from 'react';
import { CheckCircle2, Calendar, Phone, HeartHandshake, ArrowRight, Lock, BellRing } from 'lucide-react';
import { Client } from '../../types';

interface AssessmentSuccessProps {
  client: Client;
  formName: string;
  nextStageName?: string;
  delayDays?: number;
  onDone: () => void;
}

export const AssessmentSuccess: React.FC<AssessmentSuccessProps> = ({
  client,
  formName,
  nextStageName,
  delayDays,
  onDone,
}) => {
  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-16 text-center">
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        {/* Animated Check Icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-inner">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
            Assessment Complete
          </span>

          <h1 className="text-2xl font-extrabold text-gray-950 mt-3 tracking-tight">
            Thank You, {client.preferredName || client.firstName}!
          </h1>

          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Your responses for <span className="font-semibold text-gray-900">{formName}</span> have been safely and
            securely received. Your counsellor has been updated.
          </p>
        </div>

        {/* Next step reassurance */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 text-left space-y-3">
          <div className="flex items-center gap-2.5 text-xs font-bold text-gray-900">
            <Calendar className="w-4 h-4 text-red-600 shrink-0" />
            <span>What happens next?</span>
          </div>

          {nextStageName ? (
            <p className="text-xs text-gray-600 leading-relaxed">
              Your next check-in—<strong className="text-gray-900">{nextStageName}</strong>—is scheduled in{' '}
              <strong className="text-red-600 font-bold">{delayDays || 7} days</strong>. You will receive an automated
              reminder via email (<span className="text-gray-800 font-medium">{client.email}</span>) and SMS when your
              secure link is ready.
            </p>
          ) : (
            <p className="text-xs text-gray-600 leading-relaxed">
              You have completed all scheduled assessments in your GamblePause pathway! Our counsellors will remain in
              touch for ongoing community support.
            </p>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium pt-1 border-t border-gray-200/60">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Zero personal information is ever shared externally.</span>
          </div>
        </div>

        {/* Immediate Support Hotline Card */}
        <div className="p-4 rounded-xl border border-red-100 bg-red-50/50 text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-red-950 mb-1">
            <Phone className="w-4 h-4 text-red-600 shrink-0" />
            <span>Need to talk to a counsellor right now?</span>
          </div>
          <p className="text-xs text-gray-600 mb-2.5">
            If you are experiencing sudden urges, anxiety, or need a listening ear, our confidential helpline is open:
          </p>
          <a
            href="tel:0800426253"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-lg transition-all"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Call 0800-GAMBLE-PAUSE</span>
          </a>
        </div>

        <button
          type="button"
          onClick={onDone}
          className="w-full py-3.5 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs transition-all cursor-pointer"
        >
          Close & Return to Home
        </button>
      </div>
    </div>
  );
};
