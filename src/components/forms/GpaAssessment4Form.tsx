import React, { useState } from 'react';
import {
  Flame,
  CheckSquare,
  Send,
  AlertTriangle,
  HelpCircle,
  BookOpen,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';
import { Client } from '../../types';

interface GpaAssessment4FormProps {
  client: Client;
  onSubmit: (data: {
    answers: { questionId: string; answer: any; score?: number }[];
  }) => void;
  isSubmitting: boolean;
}

export const GpaAssessment4Form: React.FC<GpaAssessment4FormProps> = ({
  client,
  onSubmit,
  isSubmitting,
}) => {
  // Reflective questions
  const [recentSituation, setRecentSituation] = useState('');
  const [sawHeardExperienced, setSawHeardExperienced] = useState('');
  const [externalOrEmotional, setExternalOrEmotional] = useState<'External' | 'Emotional' | 'Both' | ''>('');
  const [howDealtWithIt, setHowDealtWithIt] = useState('');

  // Techniques 1 - 6
  const [technique1BodySigns, setTechnique1BodySigns] = useState('');
  const [technique2Substitution, setTechnique2Substitution] = useState('');
  const [technique3PlayingScript, setTechnique3PlayingScript] = useState('');
  const [technique4NegativeConditioning, setTechnique4NegativeConditioning] = useState('');
  const [technique5PostponeOneMinute, setTechnique5PostponeOneMinute] = useState('');
  const [technique6SupportPerson, setTechnique6SupportPerson] = useState('');

  // Technique 7: Limiting Access to Gambling
  const [technique7Strategies, setTechnique7Strategies] = useState<string[]>([]);
  const [technique7Other, setTechnique7Other] = useState('');

  // Technique 8: Limiting Access to Money
  const [technique8Strategies, setTechnique8Strategies] = useState<string[]>([]);
  const [technique8Other, setTechnique8Other] = useState('');

  // Homework #5
  const [homeworkReport, setHomeworkReport] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);

  const TECH7_OPTIONS = [
    'Self-exclusion from betting platforms',
    'Deleting betting apps from phone',
    'Installing gamblock / website blocker software',
    'Avoiding viewing centers and betting shops',
    'Switching off smartphone during vulnerable hours (late night / weekends)',
    'Muting sports odds discussions on social media',
  ];

  const TECH8_OPTIONS = [
    'Surrendering ATM card to trusted spouse or parent',
    'Lowering daily bank transfer limits on mobile app',
    'Paying essential bills and rent immediately upon receiving salary',
    'Closing auxiliary / secret betting bank accounts',
    'Carrying strictly minimal cash when going out',
    'Requiring two-person authorization for transactions',
  ];

  const handleToggleTech7 = (opt: string) => {
    setTechnique7Strategies((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const handleToggleTech8 = (opt: string) => {
    setTechnique8Strategies((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!recentSituation.trim()) {
      setValidationError('Please describe a recent situation that triggered an urge to gamble.');
      return;
    }

    if (!technique1BodySigns.trim() || !technique2Substitution.trim()) {
      setValidationError('Please complete Technique 1 and Technique 2 reflections.');
      return;
    }

    setValidationError(null);

    const answers = [
      { questionId: 'ex4_recent_situation', questionText: 'Recent situation that triggered an urge to gamble', answer: recentSituation },
      { questionId: 'ex4_saw_heard_experienced', questionText: 'What you saw, heard, or experienced', answer: sawHeardExperienced },
      { questionId: 'ex4_trigger_type_affinity', questionText: 'Trigger type (External vs Emotional)', answer: externalOrEmotional },
      { questionId: 'ex4_how_dealt_with_trigger', questionText: 'How you dealt with the trigger', answer: howDealtWithIt },

      { questionId: 'ex4_tech1_identification_signs', questionText: 'Technique 1: Body signs & triggers identification', answer: technique1BodySigns },
      { questionId: 'ex4_tech2_positive_substitution', questionText: 'Technique 2: Positive substitution activity', answer: technique2Substitution },
      { questionId: 'ex4_tech3_playing_script', questionText: 'Technique 3: Playing out the script', answer: technique3PlayingScript },
      { questionId: 'ex4_tech4_negative_conditioning', questionText: 'Technique 4: Immediate negative conditioning', answer: technique4NegativeConditioning },
      { questionId: 'ex4_tech5_postpone_gambling', questionText: 'Technique 5: Postpone gambling for one minute', answer: technique5PostponeOneMinute },
      { questionId: 'ex4_tech6_support_contact', questionText: 'Technique 6: Support person to contact', answer: technique6SupportPerson },

      {
        questionId: 'ex4_tech7_limit_gambling_access',
        questionText: 'Technique 7: Strategies for limiting access to gambling',
        answer: technique7Other ? [...technique7Strategies, `Other: ${technique7Other}`] : technique7Strategies,
      },
      {
        questionId: 'ex4_tech8_limit_money_access',
        questionText: 'Technique 8: Strategies for limiting access to money',
        answer: technique8Other ? [...technique8Strategies, `Other: ${technique8Other}`] : technique8Strategies,
      },

      { questionId: 'ex4_homework5_report', questionText: 'Homework #5 Reflection Report', answer: homeworkReport },
    ];

    onSubmit({ answers });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 text-red-600 mb-2">
          <Flame className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            Assessment Stage 4.0
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950">
          GPA Assessment 4.0 — Recognizing and Dealing With Triggers
        </h1>
        <p className="mt-2 text-xs text-gray-500">
          Client: <span className="font-semibold text-gray-800">{client.fullName || client.firstName}</span> ({client.id}) • Behavioural Urge Interruption Techniques
        </p>
      </div>

      {/* Explanation of Triggers */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 sm:p-8 border border-red-100 shadow-sm text-gray-800 space-y-3">
        <div className="flex items-center gap-2 text-red-800 font-bold text-base">
          <BookOpen className="w-5 h-5 text-red-600 shrink-0" />
          <span>What Are Triggers?</span>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          A trigger is any internal state (boredom, loneliness, salary celebration, financial anxiety, frustration) or external cue (hearing football match commentary, receiving a betting bonus SMS, passing a shop) that prompts an automatic urge to gamble. By systematically training your brain on targeted de-escalation techniques, you create space between the impulse and your action.
        </p>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* REFLECTIVE QUESTIONS */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900">
            Part 1: Reflective Questions
          </h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            Describe a recent situation that triggered an urge to gamble: *
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g., 'Last Saturday after arguing about money, I sat alone with my phone and felt a strong urge to open the betting app...'"
            value={recentSituation}
            onChange={(e) => setRecentSituation(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            Was it something you saw, heard, or experienced?
          </label>
          <input
            type="text"
            placeholder="e.g., Seeing friends win accumulator slips / Hearing odds on the radio"
            value={sawHeardExperienced}
            onChange={(e) => setSawHeardExperienced(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1">
              Which type of trigger affects you more?
            </label>
            <select
              value={externalOrEmotional}
              onChange={(e) => setExternalOrEmotional(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            >
              <option value="">Select trigger nature...</option>
              <option value="External">External (Apps, sounds, shops, adverts)</option>
              <option value="Emotional">Emotional (Anxiety, boredom, anger, loneliness)</option>
              <option value="Both">Both equally</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1">
              How have you dealt with it so far?
            </label>
            <input
              type="text"
              placeholder="e.g., Tried distracting myself, gave in, slept..."
              value={howDealtWithIt}
              onChange={(e) => setHowDealtWithIt(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* TECHNIQUES 1 TO 6 */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900">
            Part 2: De-escalation Techniques
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Reflect on how you can apply each evidence-based technique.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              TECHNIQUE 1 — IDENTIFICATION: How do you recognize a trigger when it happens? What signs do you notice in your body or mind? *
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g., Heart races, restlessness in chest, hyper-focus on betting apps, dry mouth..."
              value={technique1BodySigns}
              onChange={(e) => setTechnique1BodySigns(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              TECHNIQUE 2 — POSITIVE SUBSTITUTION: What positive activity can you do instead of gambling? *
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g., Play soccer with peers, 20 pushups, wash my car, read a chapter of a book, call my mother..."
              value={technique2Substitution}
              onChange={(e) => setTechnique2Substitution(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              TECHNIQUE 3 — PLAYING OUT THE SCRIPT: Describe what realistically happens when you give in to the urge.
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Even if I win ₦5k, I stake ₦10k on next game. By midnight, my account is drained, shame sets in, and bills remain unpaid..."
              value={technique3PlayingScript}
              onChange={(e) => setTechnique3PlayingScript(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              TECHNIQUE 4 — IMMEDIATE NEGATIVE CONDITIONING: What is the worst gambling experience you've had? How can you associate that memory with gambling urges?
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Losing my rent money in November 2025 and facing eviction. Whenever the urge strikes, I vividly bring up the terror of that day..."
              value={technique4NegativeConditioning}
              onChange={(e) => setTechnique4NegativeConditioning(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              TECHNIQUE 5 — POSTPONE GAMBLING: What can you do to delay gambling, even for one minute?
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Drink a tall glass of cold water, wash my face, set a 15-minute timer on my phone before touching any payment app..."
              value={technique5PostponeOneMinute}
              onChange={(e) => setTechnique5PostponeOneMinute(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-900 mb-1">
              TECHNIQUE 6 — SUPPORT: Who can you call or talk with when you experience an urge to gamble?
            </label>
            <input
              type="text"
              placeholder="e.g., My mentor Segun, my sister, or the GamblePause 0800 helpline..."
              value={technique6SupportPerson}
              onChange={(e) => setTechnique6SupportPerson(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* TECHNIQUE 7 & 8: ACCESS RESTRICTIONS */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-2">
            TECHNIQUE 7 — LIMITING ACCESS TO GAMBLING
          </h2>
          <p className="text-xs text-gray-600 mb-3">
            Check all strategies you have tried or are willing to try:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TECH7_OPTIONS.map((opt) => (
              <label
                key={opt}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  technique7Strategies.includes(opt)
                    ? 'border-red-500 bg-red-50 text-red-900 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={technique7Strategies.includes(opt)}
                  onChange={() => handleToggleTech7(opt)}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            placeholder="Other strategy for limiting access to gambling (specify)"
            value={technique7Other}
            onChange={(e) => setTechnique7Other(e.target.value)}
            className="mt-2 w-full px-3.5 py-2 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div className="pt-4 border-t border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-2">
            TECHNIQUE 8 — LIMITING ACCESS TO MONEY
          </h2>
          <p className="text-xs text-gray-600 mb-3">
            Check all money protection strategies you might consider:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TECH8_OPTIONS.map((opt) => (
              <label
                key={opt}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  technique8Strategies.includes(opt)
                    ? 'border-red-500 bg-red-50 text-red-900 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={technique8Strategies.includes(opt)}
                  onChange={() => handleToggleTech8(opt)}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            placeholder="Other financial restriction strategy (specify)"
            value={technique8Other}
            onChange={(e) => setTechnique8Other(e.target.value)}
            className="mt-2 w-full px-3.5 py-2 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>
      </div>

      {/* HOMEWORK #5 */}
      <div className="bg-amber-50/70 rounded-2xl p-6 sm:p-8 border border-amber-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
          <ShieldCheck className="w-5 h-5 text-red-600 shrink-0" />
          <span>HOMEWORK #5</span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-amber-200 text-xs sm:text-sm text-gray-800 space-y-1 font-medium">
          <p>• Try at least 3 of the techniques above this week.</p>
          <p>• Report what worked and what didn't.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            Weekly Practical Reflection / Homework Report:
          </label>
          <textarea
            rows={4}
            placeholder="Record your experience implementing these techniques: What felt easiest? When did you encounter resistance? How did you respond?"
            value={homeworkReport}
            onChange={(e) => setHomeworkReport(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
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
            <span>Saving Assessment 4.0...</span>
          ) : (
            <>
              <span>Submit Assessment 4.0</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
