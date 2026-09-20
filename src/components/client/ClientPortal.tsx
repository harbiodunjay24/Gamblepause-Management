import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Lock,
  Clock,
  ArrowRight,
  LogOut,
  ShieldCheck,
  PhoneCall,
  Sparkles,
  User,
  Shield,
} from 'lucide-react';
import { Client, WorkflowStage, FormDefinition } from '../../types';
import { dataService } from '../../services/dataService';
import { AuthUser } from '../../services/authService';

interface ClientPortalProps {
  user: AuthUser;
  onStartAssessment: (formId: string) => void;
  onLogout: () => void;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  user,
  onStartAssessment,
  onLogout,
}) => {
  const [client, setClient] = useState<Client | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowStage[]>([]);
  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only fetch the authenticated client's record!
    if (user.clientId) {
      const c = dataService.getClientById(user.clientId);
      setClient(c || null);
    }
    setWorkflows(dataService.getWorkflows());
    setForms(dataService.getForms());
    setIsLoading(false);
  }, [user.clientId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-gray-200 p-8 rounded-3xl max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-gray-950">Client Record Not Found</h2>
          <p className="text-sm text-gray-500">
            We could not find an active client profile associated with your login credentials.
          </p>
          <button
            onClick={onLogout}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors cursor-pointer shadow-xs"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const submissions = dataService.getSubmissionsByClientId(client.id);
  const completedFormIds = new Set(submissions.map((s) => s.formId));

  // Determine current active/ready assessment form
  const activeFormId = client.nextAssessmentId || 'form-recovery-1';
  const activeForm = forms.find((f) => f.id === activeFormId);

  // Check whether next assessment is currently due
  const isAssessmentDue =
    client.status !== 'Completed' &&
    client.status !== 'Closed' &&
    activeFormId &&
    (!client.nextAssessmentDueDate || new Date(client.nextAssessmentDueDate).getTime() <= new Date().getTime());

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between font-sans">
      {/* Client Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-20 px-4 py-3 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              GP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-gray-950 tracking-tight">
                  GAMBLE<span className="text-red-600">PAUSE</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                  Client Portal
                </span>
              </div>
              <div className="text-[11px] text-gray-500 font-mono">Client ID: {client.id}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-gray-900">
                {client.preferredName || client.firstName} {client.lastName}
              </div>
              <div className="text-[10px] text-red-600 font-bold">Active Participant</div>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Client Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Welcome Greeting Banner */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-gray-200 shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-red-600" />
              <span>Personalized Recovery Space</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-gray-950 tracking-tight">
              Hello, {client.preferredName || client.firstName} 👋
            </h1>
            <p className="text-sm sm:text-base text-gray-600 max-w-xl font-normal leading-relaxed">
              Welcome to your GamblePause Journey. Track your step-by-step progress, access your scheduled clinical assessments, and stay connected with your counsellor.
            </p>

            {/* Next Assessment Action Callout */}
            {client.status === 'Completed' ? (
              <div className="pt-4 flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>You have successfully completed all stages in your GamblePause recovery pipeline!</span>
              </div>
            ) : isAssessmentDue ? (
              <div className="pt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-red-50/70 p-4 rounded-2xl border border-red-200">
                <button
                  onClick={() => onStartAssessment(activeFormId)}
                  className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-600/20 flex items-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <span>Continue Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div className="text-xs text-red-900 font-medium">
                  Current check-in: <strong className="text-gray-950 font-bold">{activeForm?.name || client.nextAssessmentName}</strong> is ready.
                </div>
              </div>
            ) : (
              <div className="pt-4 flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <Clock className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  Next check-in (<strong>{client.nextAssessmentName}</strong>) is scheduled for{' '}
                  <strong className="text-gray-950">
                    {client.nextAssessmentDueDate
                      ? new Date(client.nextAssessmentDueDate).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'Upcoming'}
                  </strong>
                  . We will notify you when it opens.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* The Recovery Roadmap / Journey Sequence */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-black text-gray-950 tracking-tight">Your GamblePause Journey</h2>
            <p className="text-xs text-gray-500 font-medium">
              Each stage provides structured self-reflection and therapeutic milestones.
            </p>
          </div>

          <div className="space-y-3">
            {/* 1. Registration */}
            <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-950">Registration & Biodata</div>
                  <div className="text-xs text-gray-500">
                    Completed on{' '}
                    {new Date(client.registrationDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Completed
              </span>
            </div>

            {/* Assessment Stages */}
            {workflows.map((stage, idx) => {
              const formDef = forms.find((f) => f.id === stage.formId);
              const isCompleted = formDef ? completedFormIds.has(formDef.id) : false;
              const isCurrent = client.nextAssessmentId === stage.formId || client.currentStageId === stage.id;
              const isLocked = !isCompleted && !isCurrent;

              return (
                <div
                  key={stage.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-red-50/40 border-red-300 shadow-xs'
                      : isCompleted
                      ? 'bg-white border-gray-200'
                      : 'bg-gray-50/70 border-gray-200 opacity-70'
                  } flex items-center justify-between`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isCurrent
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : isCurrent ? (
                        <span>{idx + 1}</span>
                      ) : (
                        <Lock className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className={`text-sm font-bold ${isCurrent ? 'text-gray-950' : 'text-gray-800'}`}>
                        {stage.stageName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {isCompleted
                          ? 'Responses securely recorded'
                          : isCurrent
                          ? isAssessmentDue
                            ? 'Ready for completion'
                            : `Scheduled for ${
                                client.nextAssessmentDueDate
                                  ? new Date(client.nextAssessmentDueDate).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'short',
                                    })
                                  : 'Upcoming'
                              }`
                          : `Unlocks after ${stage.delayDaysFromPrevious} days interval`}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isCompleted ? (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        ✓ Completed
                      </span>
                    ) : isCurrent && isAssessmentDue ? (
                      <button
                        onClick={() => onStartAssessment(stage.formId)}
                        className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                      >
                        Start Now
                      </button>
                    ) : isCurrent ? (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Scheduled</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Assigned Counsellor Support Card */}
        <section className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Assigned Clinical Counsellor</div>
              <div className="text-sm font-black text-gray-950">
                {client.assignedCounsellorName || 'Assigned GamblePause Clinical Team'}
              </div>
              <div className="text-xs text-gray-500">
                Your counsellor reviews your assessment reflections confidentially.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="tel:0800426253"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold border border-red-200 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Helpline: 0800-GAMBLE-PAUSE</span>
            </a>
          </div>
        </section>
      </main>

      {/* Official Footer with GamblePause Digital Team signature */}
      <footer className="border-t border-gray-200 bg-white px-4 py-4 text-xs text-gray-500 text-center shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-gray-600">
            <Shield className="w-4 h-4 text-red-600" />
            <span>Confidential clinical record for {client.firstName} {client.lastName}. NDPR Protected.</span>
          </div>
          <div className="text-gray-500 font-semibold">
            Developed & Maintained by <span className="text-red-600 font-bold">GamblePause Digital Team</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
