import React, { useState } from 'react';
import {
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  HeartHandshake,
  Sparkles,
  Lock,
  PhoneCall,
  Calendar,
} from 'lucide-react';
import { Client, FormDefinition, QuestionDefinition } from '../../types';
import { dataService } from '../../services/dataService';
import { GpaRecovery1Form } from '../forms/GpaRecovery1Form';
import { GpaAssessment2Form } from '../forms/GpaAssessment2Form';
import { GpaAssessment3Form } from '../forms/GpaAssessment3Form';
import { GpaAssessment4Form } from '../forms/GpaAssessment4Form';
import { GpaAssessment5Form } from '../forms/GpaAssessment5Form';
import { GpaFeedbackForm } from '../forms/GpaFeedbackForm';

interface ClientAssessmentProps {
  client: Client;
  formId?: string;
  onCompleted: (submissionResult: {
    formName: string;
    nextStageName?: string;
    delayDays?: number;
    score?: number;
    riskLevel?: string;
  }) => void;
  onExit?: () => void;
}

export const ClientAssessment: React.FC<ClientAssessmentProps> = ({
  client,
  formId,
  onCompleted,
  onExit,
}) => {
  // Determine which form is due
  const targetFormId = formId || client.nextAssessmentId || 'form-recovery-1';
  const form: FormDefinition | undefined =
    dataService.getFormById(targetFormId) || dataService.getForms()[0];

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  if (!form) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">No Assessment Due Right Now</h2>
        <p className="text-sm text-gray-600 mt-2">
          Your record is currently up to date. You will receive an automated SMS and email when your next check-in is scheduled.
        </p>
      </div>
    );
  }

  // SCENARIO 8: Client tries to reuse a completed assessment link.
  // Check if this specific assessment was already completed by this client
  const existingSubmissions = dataService.getSubmissionsByClientId(client.id);
  const priorSubmission = existingSubmissions.find(
    (s) => s.formId === form.id || s.formName === form.name
  );

  const isAlreadyCompleted =
    Boolean(priorSubmission) &&
    client.nextAssessmentId !== form.id &&
    client.currentStageId !== form.id;

  if (isAlreadyCompleted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-md text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              Already Completed
            </span>
            <h1 className="text-2xl font-extrabold text-gray-950 mt-3">
              Assessment Received
            </h1>
            <p className="text-sm text-gray-600 mt-2">
              Hello <strong className="text-gray-900">{client.preferredName || client.firstName}</strong>, you have already completed <strong className="text-gray-900">{form.name}</strong> on{' '}
              {new Date(priorSubmission!.submittedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-left space-y-2 text-xs text-gray-700">
            <div className="flex items-center gap-2 font-bold text-gray-900">
              <Calendar className="w-4 h-4 text-red-600" />
              <span>Next Check-in Status:</span>
            </div>
            {client.status === 'Completed' ? (
              <p className="text-emerald-700 font-medium">
                Congratulations! You have completed all scheduled clinical assessments in your GamblePause recovery pipeline.
              </p>
            ) : client.nextAssessmentDueDate ? (
              <p>
                Your next scheduled assessment (<strong>{client.nextAssessmentName}</strong>) is due on{' '}
                <strong>
                  {new Date(client.nextAssessmentDueDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
                . You will receive an automated notification when it opens.
              </p>
            ) : (
              <p>Your counsellor is currently reviewing your responses.</p>
            )}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="tel:+234800426253"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <PhoneCall className="w-4 h-4 text-red-600" />
              <span>GamblePause Helpline</span>
            </a>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Window
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle submit from custom dedicated forms
  const handleDedicatedFormSubmit = (payload: {
    answers: { questionId: string; answer: any; score?: number }[];
    section5Score?: number;
    gpdsScore?: number;
    totalScore?: number;
  }) => {
    setIsSubmitting(true);
    try {
      const res = dataService.submitAssessment({
        clientId: client.id,
        formId: form.id,
        answers: payload.answers,
        section5Score: payload.section5Score,
        gpdsScore: payload.gpdsScore,
        totalScore: payload.totalScore,
      });

      onCompleted({
        formName: form.name,
        nextStageName: res.nextStageName,
        delayDays: res.delayDays,
        score: res.submission.totalScore,
        riskLevel: res.submission.scoreRiskLevel,
      });
    } catch (err: any) {
      console.error('Error submitting form:', err);
      setValidationError(err.message || 'There was an error saving your assessment.');
      setIsSubmitting(false);
    }
  };

  // 1. GPA Assessment Recovery 1
  if (form.code === 'gpa_recovery_1' || form.id === 'form-recovery-1' || form.id === 'form-initial') {
    return (
      <div className="px-4 py-6 sm:py-10">
        <GpaRecovery1Form
          client={client}
          onSubmit={handleDedicatedFormSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  // 2. GPA Assessment 2.0 — Dealing With Family Members
  if (form.code === 'gpa_assessment_2' || form.id === 'form-assessment-2') {
    return (
      <div className="px-4 py-6 sm:py-10">
        <GpaAssessment2Form
          client={client}
          onSubmit={handleDedicatedFormSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  // 3. GPA Assessment 3.0 — Developing Alternative Thoughts
  if (form.code === 'gpa_assessment_3' || form.id === 'form-assessment-3') {
    return (
      <div className="px-4 py-6 sm:py-10">
        <GpaAssessment3Form
          client={client}
          onSubmit={handleDedicatedFormSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  // 4. GPA Assessment 4.0 — Recognizing and Dealing With Triggers
  if (form.code === 'gpa_assessment_4' || form.id === 'form-assessment-4') {
    return (
      <div className="px-4 py-6 sm:py-10">
        <GpaAssessment4Form
          client={client}
          onSubmit={handleDedicatedFormSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  // 5. GPA Assessment 5.0 — Avoiding Avoidance
  if (form.code === 'gpa_assessment_5' || form.id === 'form-assessment-5') {
    return (
      <div className="px-4 py-6 sm:py-10">
        <GpaAssessment5Form
          client={client}
          onSubmit={handleDedicatedFormSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  // 6. GPA Feedback Form
  if (form.code === 'gpa_feedback' || form.id === 'form-feedback') {
    return (
      <div className="px-4 py-6 sm:py-10">
        <GpaFeedbackForm
          client={client}
          onSubmit={handleDedicatedFormSubmit}
          isSubmitting={isSubmitting}
        />
      </div>
    );
  }

  // Fallback wizard for general question-based forms created by Super Admin
  const questions = form.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const progressPercent = questions.length > 0 ? Math.round(((currentQuestionIndex + 1) / questions.length) * 100) : 100;

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setValidationError(null);
  };

  const handleNext = () => {
    if (!currentQuestion) return;

    if (currentQuestion.required) {
      const val = answers[currentQuestion.id];
      const isEmpty =
        val === undefined ||
        val === null ||
        (typeof val === 'string' && val.trim() === '') ||
        (Array.isArray(val) && val.length === 0);

      if (isEmpty) {
        setValidationError('Please provide an answer before continuing.');
        return;
      }
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
      setValidationError(null);
    }
  };

  const handleSubmit = () => {
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q.required) {
        const val = answers[q.id];
        const isEmpty =
          val === undefined ||
          val === null ||
          (typeof val === 'string' && val.trim() === '') ||
          (Array.isArray(val) && val.length === 0);
        if (isEmpty) {
          setCurrentQuestionIndex(i);
          setValidationError(`Please answer question ${i + 1} to complete your assessment.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const formattedAnswers = questions.map((q) => {
        const rawAns = answers[q.id];
        let score: number | undefined = undefined;

        if (q.options && typeof rawAns === 'string') {
          const opt = q.options.find((o) => o.value === rawAns);
          if (opt && typeof opt.score === 'number') {
            score = opt.score;
          }
        } else if (q.type === 'rating_scale' && typeof rawAns === 'number') {
          score = rawAns >= 8 ? 3 : rawAns >= 5 ? 2 : rawAns >= 3 ? 1 : 0;
        }

        return {
          questionId: q.id,
          answer: rawAns !== undefined ? rawAns : '',
          score,
        };
      });

      const res = dataService.submitAssessment({
        clientId: client.id,
        formId: form.id,
        answers: formattedAnswers,
      });

      onCompleted({
        formName: form.name,
        nextStageName: res.nextStageName,
        delayDays: res.delayDays,
        score: res.submission.totalScore,
        riskLevel: res.submission.scoreRiskLevel,
      });
    } catch (err: any) {
      console.error('Failed to submit assessment:', err);
      setValidationError(err.message || 'There was an error submitting your responses. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!hasStarted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-inner">
            <HeartHandshake className="w-7 h-7 text-red-600" />
          </div>

          <span className="inline-block text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 px-3 py-1 rounded-full mb-3 border border-red-100">
            {form.name}
          </span>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
            Your Next Assessment is Ready
          </h1>

          <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed max-w-md mx-auto">
            Hello <span className="font-semibold text-gray-900">{client.preferredName || client.firstName}</span>.
            Please take 2 to 3 quiet minutes to reflect and answer these questions truthfully.
            There are no right or wrong answers.
          </p>

          <div className="my-6 p-4 rounded-xl bg-gray-50 border border-gray-100 text-left text-xs text-gray-600 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{questions.length} simple, straightforward questions</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Answers are strictly confidential to your counsellor</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Mobile-optimized for your convenience</span>
            </div>
          </div>

          <button
            id="start-assessment-btn"
            onClick={() => {
              setHasStarted(true);
              window.scrollTo({ top: 100, behavior: 'smooth' });
            }}
            className="w-full py-4 px-6 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-base shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Start Assessment</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-gray-200 shadow-sm mb-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold text-gray-900 truncate">{form.name}</span>
          <span className="text-xs font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-100 shrink-0">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>

        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-600 transition-all duration-300 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        {validationError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{validationError}</span>
          </div>
        )}

        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-950 leading-snug">
            {currentQuestion?.text}
          </h2>
          {currentQuestion?.subtext && (
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 leading-relaxed">
              {currentQuestion.subtext}
            </p>
          )}
        </div>

        <div className="pt-2">
          {currentQuestion?.type === 'radio' && currentQuestion.options && (
            <div className="space-y-2.5">
              {currentQuestion.options.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => handleAnswerChange(currentQuestion.id, opt.value)}
                  className={`w-full p-4 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer flex items-center justify-between ${
                    answers[currentQuestion.id] === opt.value
                      ? 'border-red-600 bg-red-50/60 text-red-950 font-bold ring-2 ring-red-600'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <span>{opt.label}</span>
                  {answers[currentQuestion.id] === opt.value && (
                    <CheckCircle2 className="w-5 h-5 text-red-600 shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}

          {currentQuestion?.type === 'short_text' && (
            <input
              type="text"
              value={answers[currentQuestion.id] || ''}
              placeholder={currentQuestion.placeholder || 'Type your answer here...'}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          )}

          {currentQuestion?.type === 'long_text' && (
            <textarea
              rows={4}
              value={answers[currentQuestion.id] || ''}
              placeholder={currentQuestion.placeholder || 'Type your thoughts here...'}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none leading-relaxed"
            />
          )}
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentQuestionIndex === 0}
            className={`px-4 py-3 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-1.5 transition-all ${
              currentQuestionIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="flex-1 sm:flex-initial px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-sm font-bold shadow-md shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Submitting...</span>
            ) : currentQuestionIndex === questions.length - 1 ? (
              <>
                <span>Complete Assessment</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
