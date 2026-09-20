import React, { useState } from 'react';
import {
  Compass,
  CheckSquare,
  Star,
  Send,
  AlertTriangle,
  Smile,
  Shield,
} from 'lucide-react';
import { Client } from '../../types';

interface GpaAssessment5FormProps {
  client: Client;
  onSubmit: (data: {
    answers: { questionId: string; answer: any; score?: number }[];
  }) => void;
  isSubmitting: boolean;
}

export const GpaAssessment5Form: React.FC<GpaAssessment5FormProps> = ({
  client,
  onSubmit,
  isSubmitting,
}) => {
  // Exercise 5.1
  const [whatAvoiding, setWhatAvoiding] = useState('');
  const [outcomeOfAvoiding, setOutcomeOfAvoiding] = useState('');
  const [avoidanceTriggers, setAvoidanceTriggers] = useState<string[]>([]);
  const [avoidanceOther, setAvoidanceOther] = useState('');

  // Exercise 5.2: 9 Coping strategies (1-5 ratings)
  const [copingRatings, setCopingRatings] = useState<Record<number, number>>({
    0: 3,
    1: 3,
    2: 3,
    3: 3,
    4: 3,
    5: 3,
    6: 3,
    7: 3,
    8: 3,
  });

  // Exercise 5.3: Developing New Activities
  const [pastActivities, setPastActivities] = useState('');
  const [newActivities, setNewActivities] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);

  const AVOIDANCE_OPTIONS = [
    'Boredom / Lack of stimulation',
    'Loneliness / Emptiness',
    'Financial anxiety / Debts pressure',
    'Marital friction or domestic arguments',
    'Work stress or unemployment frustration',
    'Depression / Persistent sadness',
    'Escapism from difficult memories',
    'Anger / Resentment',
    'Social isolation',
  ];

  const COPING_STRATEGIES = [
    'Talking to a friend, family member or therapist',
    'Writing, keeping a journal or diary',
    'Learning to relax through meditation, yoga or breathing',
    'Getting regular exercise (football, jogging, gym)',
    'Attending Gamblers Anonymous or recovery peer meetings',
    'Planning activities, setting weekly goals',
    'Learning anger management and emotional regulation',
    'Getting more time for healthy self-care and rest',
    'Taking prescribed medications / psychiatric evaluation where needed',
  ];

  const handleToggleAvoidance = (opt: string) => {
    setAvoidanceTriggers((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const handleSetRating = (index: number, rating: number) => {
    setCopingRatings((prev) => ({ ...prev, [index]: rating }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!whatAvoiding.trim()) {
      setValidationError('Please explain what you were avoiding by gambling in Exercise 5.1.');
      return;
    }

    if (avoidanceTriggers.length === 0) {
      setValidationError('Please select at least one applicable emotional state in Exercise 5.1.');
      return;
    }

    if (!pastActivities.trim() || !newActivities.trim()) {
      setValidationError('Please complete both past and new activities in Exercise 5.3.');
      return;
    }

    setValidationError(null);

    const answers = [
      { questionId: 'ex5_1_what_avoiding', questionText: 'What were you avoiding by gambling?', answer: whatAvoiding },
      { questionId: 'ex5_1_outcome_of_avoiding', questionText: 'How well did gambling work as avoidance and what was the outcome?', answer: outcomeOfAvoiding },
      {
        questionId: 'ex5_1_avoidance_triggers',
        questionText: 'Selected avoidance emotional states / triggers',
        answer: avoidanceOther ? [...avoidanceTriggers, `Other: ${avoidanceOther}`] : avoidanceTriggers,
      },
      ...COPING_STRATEGIES.map((strategy, idx) => ({
        questionId: `ex5_2_coping_${idx + 1}`,
        questionText: `Coping Strategy: ${strategy}`,
        answer: copingRatings[idx] || 3,
        score: copingRatings[idx] || 3,
      })),
      { questionId: 'ex5_3_past_activities', questionText: 'Healthy activities enjoyed in the past before gambling', answer: pastActivities },
      { questionId: 'ex5_3_new_activities', questionText: 'New activities you would like to explore', answer: newActivities },
    ];

    onSubmit({ answers });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 text-red-600 mb-2">
          <Compass className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            Assessment Stage 5.0
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950">
          GPA Assessment 5.0 — Avoiding Avoidance
        </h1>
        <p className="mt-2 text-xs text-gray-500">
          Client: <span className="font-semibold text-gray-800">{client.fullName || client.firstName}</span> ({client.id}) • Building Healthy Coping Alternatives
        </p>
      </div>

      {/* Educational Text */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 sm:p-8 border border-red-100 shadow-sm text-gray-800 space-y-3">
        <div className="flex items-center gap-2 text-red-800 font-bold text-base">
          <Shield className="w-5 h-5 text-red-600 shrink-0" />
          <span>Understanding Emotional Avoidance</span>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          Gambling is frequently used as a temporary emotional numbing agent to escape loneliness, depression, relationship conflict, or painful memories. While avoidance offers temporary escape, it worsens the underlying issue. Confronting reality and cultivating constructive coping strategies breaks the avoidance trap.
        </p>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* EXERCISE 5.1 — AVOIDING AVOIDANCE */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900">
            EXERCISE 5.1 — AVOIDING AVOIDANCE
          </h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            What were you avoiding by gambling, and how well did this work for you? *
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g., 'I was avoiding thinking about my lack of savings and tension with my partner. It felt like relief for 1 hour, but the debt made everything 10 times worse...'"
            value={whatAvoiding}
            onChange={(e) => setWhatAvoiding(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            Outcome of avoiding:
          </label>
          <textarea
            rows={2}
            placeholder="e.g., 'Debts multiplied, panic attacks increased, lost trust of loved ones...'"
            value={outcomeOfAvoiding}
            onChange={(e) => setOutcomeOfAvoiding(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-2">
            "From the list below, please check all the ones that apply to you." *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVOIDANCE_OPTIONS.map((opt) => (
              <label
                key={opt}
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  avoidanceTriggers.includes(opt)
                    ? 'border-red-500 bg-red-50 text-red-900 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={avoidanceTriggers.includes(opt)}
                  onChange={() => handleToggleAvoidance(opt)}
                  className="mt-0.5 rounded text-red-600 focus:ring-red-500"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            placeholder="Other avoidance reason (specify if any)"
            value={avoidanceOther}
            onChange={(e) => setAvoidanceOther(e.target.value)}
            className="mt-2 w-full px-3.5 py-2 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>
      </div>

      {/* EXERCISE 5.2 — DEVELOPING WAYS TO COPE */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900">
            EXERCISE 5.2 — DEVELOPING WAYS TO COPE
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Rate each strategy from 1 (Least interest/helpful) to 5 (Highly effective/committed to practice).
          </p>
        </div>

        <div className="space-y-3 divide-y divide-gray-100">
          {COPING_STRATEGIES.map((strategy, idx) => (
            <div key={idx} className="pt-3 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs sm:text-sm font-medium text-gray-800">
                <span className="font-bold text-gray-900 mr-2">{idx + 1}.</span>
                {strategy}
              </span>

              <div className="flex items-center gap-1 shrink-0">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSetRating(idx, num)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                      copingRatings[idx] === num
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

      {/* EXERCISE 5.3 — DEVELOPING NEW ACTIVITIES */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900">
            EXERCISE 5.3 — DEVELOPING NEW ACTIVITIES
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Reconnecting with meaningful hobbies and building new positive habits.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            Past activities I enjoyed before gambling consumed my time: *
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g., Playing guitar, swimming, mentoring youth, graphic design, reading biographies..."
            value={pastActivities}
            onChange={(e) => setPastActivities(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            New activities I can do now to build a fulfilling, gambling-free life: *
          </label>
          <textarea
            rows={3}
            required
            placeholder="e.g., Joining a local running club, learning digital marketing, spending Saturday mornings with family..."
            value={newActivities}
            onChange={(e) => setNewActivities(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
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
            <span>Saving Assessment 5.0...</span>
          ) : (
            <>
              <span>Submit Assessment 5.0</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
