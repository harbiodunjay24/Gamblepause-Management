import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Clock, HeartHandshake, ShieldCheck, ArrowLeft, Lock, Shield } from 'lucide-react';
import { Client, FormDefinition } from '../../types';
import { dataService } from '../../services/dataService';
import { ClientAssessment } from '../client/ClientAssessment';

interface TokenAssessmentRunnerProps {
  token: string;
  onExit: () => void;
}

export const TokenAssessmentRunner: React.FC<TokenAssessmentRunnerProps> = ({ token, onExit }) => {
  const [resolution, setResolution] = useState<{
    valid: boolean;
    client?: Client;
    form?: FormDefinition;
    isCompleted?: boolean;
    isExpired?: boolean;
    error?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [completionResult, setCompletionResult] = useState<{
    formName: string;
    nextStageName?: string;
    delayDays?: number;
  } | null>(null);

  useEffect(() => {
    setIsLoading(true);
    const res = dataService.resolveSecureToken(token);
    setResolution(res);
    setIsLoading(false);
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!resolution || !resolution.valid || !resolution.client) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between px-4 py-12 font-sans">
        <div className="max-w-md mx-auto w-full my-auto bg-white border border-gray-200 rounded-3xl p-8 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-gray-950">Invalid or Expired Assessment Link</h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            This assessment link has expired or could not be found. Please contact GamblePause support or request a new link from your assigned counsellor.
          </p>
          <button
            onClick={onExit}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
          >
            Go to GamblePause Home
          </button>
        </div>

        <footer className="text-center text-xs text-gray-500 font-medium">
          Maintained by <span className="text-red-600 font-bold">GamblePause Digital Team</span>
        </footer>
      </div>
    );
  }

  // Already Completed Scenario (Test 9)
  if (resolution.isCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between px-4 py-12 font-sans">
        <div className="max-w-md mx-auto w-full my-auto bg-white border border-gray-200 rounded-3xl p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Already Completed
            </span>
            <h1 className="text-2xl font-black text-gray-950 tracking-tight pt-1">
              Assessment Already Completed
            </h1>
            <p className="text-xs text-gray-600 leading-relaxed">
              Hello <strong>{resolution.client.preferredName || resolution.client.firstName}</strong>, your responses for{' '}
              <strong className="text-gray-900 font-bold">{resolution.form?.name || 'this assessment'}</strong> have already been securely recorded and your counsellor has been notified.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-left text-xs space-y-1.5 text-gray-700">
            <div className="font-bold text-gray-900">Next Stage Status:</div>
            <div>
              {resolution.client.status === 'Completed'
                ? 'All clinical check-ins in your recovery pipeline have been completed.'
                : `Next assessment (${resolution.client.nextAssessmentName}) is scheduled for ${
                    resolution.client.nextAssessmentDueDate
                      ? new Date(resolution.client.nextAssessmentDueDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Upcoming'
                  }.`}
            </div>
          </div>

          <button
            onClick={onExit}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Return to GamblePause Home
          </button>
        </div>

        <footer className="text-center text-xs text-gray-500 font-medium">
          Maintained by <span className="text-red-600 font-bold">GamblePause Digital Team</span>
        </footer>
      </div>
    );
  }

  // Assessment Completed Screen (Fresh submission)
  if (completionResult) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between px-4 py-12 font-sans">
        <div className="max-w-md mx-auto w-full my-auto bg-white border border-gray-200 rounded-3xl p-8 text-center space-y-5 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Successfully Submitted
            </span>
            <h1 className="text-2xl font-black text-gray-950 tracking-tight pt-1">
              Assessment Received
            </h1>
            <p className="text-xs text-gray-600 leading-relaxed">
              Thank you, <strong>{resolution.client.preferredName || resolution.client.firstName}</strong>. Your check-in responses have been safely saved and encrypted.
            </p>
          </div>

          {completionResult.nextStageName && (
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-left text-xs space-y-1 text-gray-700">
              <div className="font-bold text-gray-900">Next Step in your Journey:</div>
              <div>
                Your next milestone (<strong>{completionResult.nextStageName}</strong>) will be unlocked in{' '}
                {completionResult.delayDays || 7} days. We will notify you by email and SMS.
              </div>
            </div>
          )}

          <button
            onClick={onExit}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            Finish & Return Home
          </button>
        </div>

        <footer className="text-center text-xs text-gray-500 font-medium">
          Maintained by <span className="text-red-600 font-bold">GamblePause Digital Team</span>
        </footer>
      </div>
    );
  }

  // Active Assessment Form
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <ClientAssessment
        client={resolution.client}
        formId={resolution.form?.id}
        onCompleted={(res) => {
          setCompletionResult(res);
        }}
        onExit={onExit}
      />
    </div>
  );
};
