import React, { useState } from 'react';
import {
  MessageSquareHeart,
  Star,
  Send,
  CheckCircle2,
  AlertTriangle,
  HeartHandshake,
  ThumbsUp,
} from 'lucide-react';
import { Client } from '../../types';

interface GpaFeedbackFormProps {
  client: Client;
  onSubmit: (data: {
    answers: { questionId: string; answer: any; score?: number }[];
  }) => void;
  isSubmitting: boolean;
}

export const GpaFeedbackForm: React.FC<GpaFeedbackFormProps> = ({
  client,
  onSubmit,
  isSubmitting,
}) => {
  const [email, setEmail] = useState(client.email || '');
  const [clientIdentifier, setClientIdentifier] = useState(`${client.fullName || client.firstName} (${client.id})`);
  const [dateOfContact, setDateOfContact] = useState(new Date().toISOString().split('T')[0]);
  const [supportMode, setSupportMode] = useState('Phone call');

  // Service Evaluation (1-5: 1=Poor, 5=Excellent)
  const [serviceRatings, setServiceRatings] = useState<Record<string, number>>({
    respect_empathy: 5,
    clarity_advice: 5,
    session_helpfulness: 5,
    privacy_confidentiality: 5,
    ease_of_access: 5,
  });

  // Impact of Support (1-5: 1=Strongly Disagree, 5=Strongly Agree)
  const [impactRatings, setImpactRatings] = useState<Record<string, number>>({
    understand_behaviour: 5,
    learned_coping: 5,
    stress_improved: 5,
    feel_hopeful: 5,
    recommend_gamblepause: 5,
  });

  // Open comments
  const [mostHelpful, setMostHelpful] = useState('');
  const [whatToImprove, setWhatToImprove] = useState('');
  const [consentFollowUp, setConsentFollowUp] = useState<'Yes' | 'No'>('Yes');

  const [validationError, setValidationError] = useState<string | null>(null);

  const SERVICE_QUESTIONS = [
    { id: 'respect_empathy', label: 'Respect and empathy shown by counsellor / psychologist' },
    { id: 'clarity_advice', label: 'Clarity of information and therapeutic advice given' },
    { id: 'session_helpfulness', label: 'Overall helpfulness of the assessment sessions' },
    { id: 'privacy_confidentiality', label: 'Privacy and confidentiality maintained throughout' },
    { id: 'ease_of_access', label: 'Ease of accessing support (response time and scheduled check-ins)' },
  ];

  const IMPACT_QUESTIONS = [
    { id: 'understand_behaviour', label: 'I better understand my gambling behaviour and triggers.' },
    { id: 'learned_coping', label: 'I have learned practical ways to cope with urges and protect my finances.' },
    { id: 'stress_improved', label: 'My stress, guilt, and emotional state have improved.' },
    { id: 'feel_hopeful', label: 'I feel significantly more hopeful about my long-term recovery.' },
    { id: 'recommend_gamblepause', label: 'I would recommend GamblePause Africa to anyone struggling with gambling.' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setValidationError('Please provide a contact email.');
      return;
    }

    setValidationError(null);

    const answers = [
      { questionId: 'feedback_email', questionText: 'Client Email', answer: email },
      { questionId: 'feedback_identifier', questionText: 'Client Identifier / ID', answer: clientIdentifier },
      { questionId: 'feedback_date_of_contact', questionText: 'Date of Contact', answer: dateOfContact },
      { questionId: 'feedback_support_mode', questionText: 'Mode of Support', answer: supportMode },

      // Service ratings
      ...SERVICE_QUESTIONS.map((q) => ({
        questionId: `feedback_service_${q.id}`,
        questionText: q.label,
        answer: serviceRatings[q.id] || 5,
        score: serviceRatings[q.id] || 5,
      })),

      // Impact ratings
      ...IMPACT_QUESTIONS.map((q) => ({
        questionId: `feedback_impact_${q.id}`,
        questionText: q.label,
        answer: impactRatings[q.id] || 5,
        score: impactRatings[q.id] || 5,
      })),

      { questionId: 'feedback_most_helpful', questionText: 'What was most helpful during your sessions with GamblePause?', answer: mostHelpful },
      { questionId: 'feedback_what_to_improve', questionText: 'What could we improve in our recovery support services?', answer: whatToImprove },
      { questionId: 'feedback_consent_followup', questionText: 'Consent to follow-up check-in from GamblePause team', answer: consentFollowUp },
    ];

    onSubmit({ answers });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 text-red-600 mb-2">
          <MessageSquareHeart className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            Final Milestone
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950">
          GPA Feedback Form
        </h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          "The purpose of this form is to assess clients' satisfaction, perceived improvement, and the quality of psychological support received from GamblePause Africa."
        </p>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Basic Contact Info */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
          Contact & Support Session Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Client ID or Name (Optional — leave anonymous if preferred)
            </label>
            <input
              type="text"
              value={clientIdentifier}
              onChange={(e) => setClientIdentifier(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Contact</label>
            <input
              type="date"
              value={dateOfContact}
              onChange={(e) => setDateOfContact(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Mode of Support Received</label>
            <select
              value={supportMode}
              onChange={(e) => setSupportMode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="Phone call">Phone call</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Video call">Video call</option>
              <option value="In-person">In-person</option>
              <option value="Chat / Messaging">Chat / Messaging</option>
            </select>
          </div>
        </div>
      </div>

      {/* SERVICE EVALUATION */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-base font-bold text-gray-900">
            Part 1: Service Evaluation
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Linear Scale: 1 = Poor, 2 = Fair, 3 = Satisfactory, 4 = Very Good, 5 = Excellent
          </p>
        </div>

        <div className="space-y-4 divide-y divide-gray-100">
          {SERVICE_QUESTIONS.map((q) => (
            <div key={q.id} className="pt-3 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs sm:text-sm font-medium text-gray-800">
                {q.label}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setServiceRatings((prev) => ({ ...prev, [q.id]: num }))}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                      serviceRatings[q.id] === num
                        ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* IMPACT OF SUPPORT */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-base font-bold text-gray-900">
            Part 2: Impact of Support on Your Life
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Linear Scale: 1 = Strongly Disagree, 2 = Disagree, 3 = Neutral, 4 = Agree, 5 = Strongly Agree
          </p>
        </div>

        <div className="space-y-4 divide-y divide-gray-100">
          {IMPACT_QUESTIONS.map((q) => (
            <div key={q.id} className="pt-3 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs sm:text-sm font-medium text-gray-800">
                {q.label}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setImpactRatings((prev) => ({ ...prev, [q.id]: num }))}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                      impactRatings[q.id] === num
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OPEN COMMENTS */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-base font-bold text-gray-900">
            Part 3: Open Feedback
          </h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            What did you find most helpful about the support received?
          </label>
          <textarea
            rows={3}
            placeholder="e.g., The non-judgmental attitude of the counsellor, understanding my triggers, practical financial containment plan..."
            value={mostHelpful}
            onChange={(e) => setMostHelpful(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            What can we improve to serve you better?
          </label>
          <textarea
            rows={3}
            placeholder="e.g., Shorter intervals between check-ins, local support meetups in my city, more WhatsApp audio notes..."
            value={whatToImprove}
            onChange={(e) => setWhatToImprove(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-2">
            May we contact you in the future for follow-up support or recovery research?
          </label>
          <div className="flex gap-4">
            {['Yes', 'No'].map((val) => (
              <label key={val} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="consentFollowUp"
                  value={val}
                  checked={consentFollowUp === val}
                  onChange={() => setConsentFollowUp(val as any)}
                  className="text-red-600 focus:ring-red-500"
                />
                <span>{val}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Submitting Feedback...</span>
          ) : (
            <>
              <span>Submit GPA Feedback</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
