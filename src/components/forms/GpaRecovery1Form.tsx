import React, { useState } from 'react';
import {
  Shield,
  HelpCircle,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Info,
  Send,
  HeartHandshake,
} from 'lucide-react';
import { SECTION_5_DIAGNOSTIC_QUESTIONS, SECTION_6_GPDS_QUESTIONS } from '../../data/gamblepauseMaterials';
import { Client } from '../../types';

interface GpaRecovery1FormProps {
  client: Client;
  onSubmit: (data: {
    answers: { questionId: string; answer: any; score?: number }[];
    section5Score: number;
    gpdsScore: number;
    totalScore: number;
  }) => void;
  isSubmitting: boolean;
}

export const GpaRecovery1Form: React.FC<GpaRecovery1FormProps> = ({
  client,
  onSubmit,
  isSubmitting,
}) => {
  // Section 1: Client Information / Gambling History
  const [fullName, setFullName] = useState(client.fullName || `${client.firstName} ${client.lastName}`.trim());
  const [age, setAge] = useState<number | string>(client.age || '');
  const [sex, setSex] = useState<'Male' | 'Female' | 'Other' | 'Prefer not to say'>(client.gender || 'Male');
  const [maritalStatus, setMaritalStatus] = useState(client.maritalStatus || 'Single');
  const [occupation, setOccupation] = useState(client.occupation || '');
  const [bettingPlatforms, setBettingPlatforms] = useState('');
  const [firstBetAge, setFirstBetAge] = useState<number | string>('');
  const [gamblingTypes, setGamblingTypes] = useState<string[]>([]);
  const [otherGamblingType, setOtherGamblingType] = useState('');
  const [spokenToAnyone, setSpokenToAnyone] = useState<'Yes' | 'No' | ''>('');
  const [relativeContact, setRelativeContact] = useState(client.emergencyContactPhone || '');
  const [pornDrugsAddiction, setPornDrugsAddiction] = useState<'Yes' | 'No' | 'Prefer not to say' | ''>('');
  const [selfExcludedAndRejoined, setSelfExcludedAndRejoined] = useState<'Yes' | 'No' | ''>('');
  const [lastGambledDate, setLastGambledDate] = useState('');
  const [lowestStaked, setLowestStaked] = useState('');
  const [highestStaked, setHighestStaked] = useState('');

  // Section 3: Exercise 1.0
  const [topPref1, setTopPref1] = useState('');
  const [topPref2, setTopPref2] = useState('');
  const [topPref3, setTopPref3] = useState('');
  const [advantages, setAdvantages] = useState('');
  const [disadvantages, setDisadvantages] = useState('');
  const [reasonsToStop, setReasonsToStop] = useState('');

  // Section 4: Budget / Exercise 1.1
  const [annualIncome, setAnnualIncome] = useState<number | ''>('');
  const [spentLastYear, setSpentLastYear] = useState<number | ''>('');

  // Section 5: Diagnostic Screen (19 Yes/No)
  const [sec5Answers, setSec5Answers] = useState<Record<number, 'Yes' | 'No'>>({});

  // Section 6: GPDS (10 Yes/No)
  const [sec6Answers, setSec6Answers] = useState<Record<number, 'Yes' | 'No'>>({});

  const [validationError, setValidationError] = useState<string | null>(null);

  // Automatic calculations for Section 4
  const numIncome = typeof annualIncome === 'number' && annualIncome > 0 ? annualIncome : 0;
  const twoPercentAnnual = numIncome * 0.02;
  const monthlyGamblingBudget = twoPercentAnnual / 12;

  // Calculate scores
  const section5Score = Object.values(sec5Answers).filter((ans) => ans === 'Yes').length;
  const gpdsScore = Object.values(sec6Answers).filter((ans) => ans === 'Yes').length;
  const totalCombinedScore = section5Score + gpdsScore;

  const handleGamblingTypeToggle = (type: string) => {
    setGamblingTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSec5Answer = (index: number, value: 'Yes' | 'No') => {
    setSec5Answers((prev) => ({ ...prev, [index]: value }));
  };

  const handleSec6Answer = (index: number, value: 'Yes' | 'No') => {
    setSec6Answers((prev) => ({ ...prev, [index]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate essential sections
    if (!fullName.trim()) {
      setValidationError('Please complete Section 1: Full Name.');
      window.scrollTo({ top: 100, behavior: 'smooth' });
      return;
    }

    const ageNum = typeof age === 'number' ? age : parseInt(String(age), 10);
    if (!age || isNaN(ageNum) || ageNum < 1) {
      setValidationError('Please enter a valid age.');
      window.scrollTo({ top: 100, behavior: 'smooth' });
      return;
    }
    if (ageNum > 100) {
      setValidationError('Please enter an age between 1 and 100.');
      window.scrollTo({ top: 100, behavior: 'smooth' });
      return;
    }

    if (Object.keys(sec5Answers).length < SECTION_5_DIAGNOSTIC_QUESTIONS.length) {
      setValidationError(
        `Please answer all 19 questions in Section 5 Diagnostic Screen. (${Object.keys(sec5Answers).length}/19 answered)`
      );
      const el = document.getElementById('sec-5-anchor');
      el?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (Object.keys(sec6Answers).length < SECTION_6_GPDS_QUESTIONS.length) {
      setValidationError(
        `Please answer all 10 questions in Section 6 (GPDS). (${Object.keys(sec6Answers).length}/10 answered)`
      );
      const el = document.getElementById('sec-6-anchor');
      el?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    setValidationError(null);

    // Compile answer payloads
    const answers = [
      { questionId: 'sec1_fullname', questionText: 'Full Name', answer: fullName },
      { questionId: 'sec1_age', questionText: 'Age', answer: age },
      { questionId: 'sec1_sex', questionText: 'Sex / Gender', answer: sex },
      { questionId: 'sec1_marital_status', questionText: 'Marital Status', answer: maritalStatus },
      { questionId: 'sec1_occupation', questionText: 'Occupation', answer: occupation },
      { questionId: 'sec1_betting_platform', questionText: 'What Online Betting Platform do you use?', answer: bettingPlatforms },
      { questionId: 'sec1_first_bet_age', questionText: 'Age when you placed your first Bet?', answer: firstBetAge },
      { questionId: 'sec1_gambling_types', questionText: 'Types of gambling engaged in', answer: otherGamblingType ? [...gamblingTypes, `Other: ${otherGamblingType}`] : gamblingTypes },
      { questionId: 'sec1_spoken_to_anyone', questionText: 'Have you spoken to anyone regarding this?', answer: spokenToAnyone },
      { questionId: 'sec1_relative_contact', questionText: 'Name and contact number of a relative you can confide in', answer: relativeContact },
      { questionId: 'sec1_porn_drugs', questionText: 'Do you have any other addiction? (Porn, Sex, Drugs, Alcohol)', answer: pornDrugsAddiction },
      { questionId: 'sec1_self_excluded_rejoined', questionText: 'Have you ever self-excluded on a betting platform and later rejoined?', answer: selfExcludedAndRejoined },
      { questionId: 'sec1_last_gambled', questionText: 'When was the last time you gambled?', answer: lastGambledDate },
      { questionId: 'sec1_lowest_staked', questionText: 'Lowest amount you have ever staked on a single bet (₦)', answer: lowestStaked },
      { questionId: 'sec1_highest_staked', questionText: 'Highest amount you have ever staked on a single bet (₦)', answer: highestStaked },

      { questionId: 'sec3_top_pref_1', questionText: 'Top Preference in Gambling (#1)', answer: topPref1 },
      { questionId: 'sec3_top_pref_2', questionText: 'Top Preference in Gambling (#2)', answer: topPref2 },
      { questionId: 'sec3_top_pref_3', questionText: 'Top Preference in Gambling (#3)', answer: topPref3 },
      { questionId: 'sec3_advantages', questionText: 'Perceived Advantages of Gambling', answer: advantages },
      { questionId: 'sec3_disadvantages', questionText: 'Perceived Disadvantages of Gambling', answer: disadvantages },
      { questionId: 'sec3_reasons_to_stop', questionText: 'Reasons to Stop or Reduce Gambling', answer: reasonsToStop },

      { questionId: 'sec4_annual_income', questionText: 'Gross Annual Income (₦)', answer: annualIncome },
      { questionId: 'sec4_calculated_2_percent', questionText: '2% of Annual Gross Income (₦)', answer: twoPercentAnnual.toFixed(2) },
      { questionId: 'sec4_calculated_monthly_budget', questionText: 'Estimated Monthly Gambling Budget (₦)', answer: monthlyGamblingBudget.toFixed(2) },
      { questionId: 'sec4_spent_last_year', questionText: 'Actual Amount Spent on Gambling in the Last Year (₦)', answer: spentLastYear },

      // Section 5 answers
      ...SECTION_5_DIAGNOSTIC_QUESTIONS.map((q, idx) => ({
        questionId: `sec5_q${idx + 1}`,
        questionText: q,
        answer: sec5Answers[idx] || 'No',
        score: sec5Answers[idx] === 'Yes' ? 1 : 0,
      })),

      // Section 6 answers
      ...SECTION_6_GPDS_QUESTIONS.map((q, idx) => ({
        questionId: `sec6_gpds_q${idx + 1}`,
        questionText: q,
        answer: sec6Answers[idx] || 'No',
        score: sec6Answers[idx] === 'Yes' ? 1 : 0,
      })),
    ];

    onSubmit({
      answers,
      section5Score,
      gpdsScore,
      totalScore: totalCombinedScore,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 text-red-600 mb-2">
          <FileText className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            Official Clinical Assessment
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950">
          GPA Assessment Recovery 1
        </h1>
        <p className="mt-2 text-sm text-gray-600 italic">
          "Please fill appropriately."
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Client: <span className="font-semibold text-gray-800">{client.fullName || client.firstName}</span> ({client.id}) • All submissions are treated in strictest professional confidentiality.
        </p>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 animate-pulse">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* SECTION 1: CLIENT INFORMATION / GAMBLING HISTORY */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-black flex items-center justify-center">1</span>
            SECTION 1 — CLIENT INFORMATION / GAMBLING HISTORY
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Age *</label>
            <input
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={100}
              placeholder="Enter age (1-100)"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Sex *</label>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Marital Status *</label>
            <select
              value={maritalStatus}
              onChange={(e) => setMaritalStatus(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white"
            >
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Divorced">Divorced</option>
              <option value="Separated">Separated</option>
              <option value="Widowed">Widowed</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">What do you do for a living?</label>
            <input
              type="text"
              placeholder="e.g., Trader, Student, Banker, Driver"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">What Online Betting Platform do you use?</label>
            <input
              type="text"
              placeholder="e.g., Bet9ja, SportyBet, 1xBet, BetKing, MSport"
              value={bettingPlatforms}
              onChange={(e) => setBettingPlatforms(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Age when you placed your first Bet?</label>
            <input
              type="number"
              placeholder="e.g., 18"
              value={firstBetAge}
              onChange={(e) => setFirstBetAge(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">When was the last time you gambled?</label>
            <input
              type="date"
              value={lastGambledDate}
              onChange={(e) => setLastGambledDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Gambling types multi-select */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-2">
            What sort of Gambling do you engage in? (Select all that apply)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {['Sports Betting', 'Virtual Sports Betting', 'Online Casino', 'Aviator', 'Lottery/Pools'].map((type) => (
              <label
                key={type}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  gamblingTypes.includes(type)
                    ? 'border-red-500 bg-red-50 text-red-900 font-medium'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={gamblingTypes.includes(type)}
                  onChange={() => handleGamblingTypeToggle(type)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span>{type}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            placeholder="Other gambling form (specify if any)"
            value={otherGamblingType}
            onChange={(e) => setOtherGamblingType(e.target.value)}
            className="mt-2 w-full px-3.5 py-2 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        {/* Specific clinical screening questions */}
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Have you spoken to anyone about your gambling issues?
            </label>
            <div className="flex gap-4">
              {['Yes', 'No'].map((val) => (
                <label key={val} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="spokenToAnyone"
                    value={val}
                    checked={spokenToAnyone === val}
                    onChange={() => setSpokenToAnyone(val as any)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>{val}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Contact of a Close Relative? (Phone / Relationship)
            </label>
            <input
              type="text"
              placeholder="e.g., 0803 123 4567 (Brother)"
              value={relativeContact}
              onChange={(e) => setRelativeContact(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Are you struggling with Porn and/or Drugs addiction?
            </label>
            <div className="flex gap-4">
              {['Yes', 'No', 'Prefer not to say'].map((val) => (
                <label key={val} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="pornDrugs"
                    value={val}
                    checked={pornDrugsAddiction === val}
                    onChange={() => setPornDrugsAddiction(val as any)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>{val}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Have you ever self-excluded yourself from a betting application and later used another number to sign up again just to play?
            </label>
            <div className="flex gap-4">
              {['Yes', 'No'].map((val) => (
                <label key={val} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="selfExcluded"
                    value={val}
                    checked={selfExcludedAndRejoined === val}
                    onChange={() => setSelfExcludedAndRejoined(val as any)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>{val}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Lowest amount staked on any game (including Aviator/virtual)
              </label>
              <input
                type="text"
                placeholder="e.g., ₦100"
                value={lowestStaked}
                onChange={(e) => setLowestStaked(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Highest amount staked on any game (including Aviator/virtual)
              </label>
              <input
                type="text"
                placeholder="e.g., ₦500,000"
                value={highestStaked}
                onChange={(e) => setHighestStaked(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: GOALS (Informational) */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-6 sm:p-8 border border-red-100 shadow-sm">
        <div className="flex items-center gap-2 text-red-700 font-bold text-sm mb-2">
          <Info className="w-5 h-5 text-red-600 shrink-0" />
          <span>SECTION 2 — GOALS</span>
        </div>
        <p className="text-xs text-gray-600 mb-3">
          This assessment is designed to support your personal journey:
        </p>
        <ul className="space-y-2 text-sm text-gray-800 font-medium">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
            <span>To learn more about your gambling patterns</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
            <span>To consider your gambling goals</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />
            <span>To outline a path for moving forward with treatment</span>
          </li>
        </ul>
      </div>

      {/* SECTION 3: EXERCISE 1.0 */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-black flex items-center justify-center">3</span>
            SECTION 3 — EXERCISE 1.0
          </h2>
          <p className="text-xs text-gray-500 mt-1 italic">
            "List your top three preferred forms of gambling and rank them in order of preference."
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              1. Most preferred form of gambling and age you began
            </label>
            <input
              type="text"
              placeholder="e.g., Football betting on SportyBet, started at age 19"
              value={topPref1}
              onChange={(e) => setTopPref1(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              2. Second most preferred form of gambling and age you began
            </label>
            <input
              type="text"
              placeholder="e.g., Aviator crash game, started at age 22"
              value={topPref2}
              onChange={(e) => setTopPref2(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              3. Third most preferred form of gambling and age you began
            </label>
            <input
              type="text"
              placeholder="e.g., Virtual sports / Casino spins, started at age 24"
              value={topPref3}
              onChange={(e) => setTopPref3(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              What do you like about these types of gambling? (Advantages)
            </label>
            <textarea
              rows={3}
              placeholder="e.g., Instant thrill, illusion of quick financial freedom, relief from boredom..."
              value={advantages}
              onChange={(e) => setAdvantages(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              What do you hate about gambling? (Disadvantages)
            </label>
            <textarea
              rows={3}
              placeholder="e.g., Constant loss of hard-earned money, anxiety, broken trust, debt pressure..."
              value={disadvantages}
              onChange={(e) => setDisadvantages(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Reasons you want to stop gambling?
            </label>
            <textarea
              rows={3}
              placeholder="e.g., To reclaim peace of mind, save for my future, rebuild my family's respect..."
              value={reasonsToStop}
              onChange={(e) => setReasonsToStop(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 4: GAMBLING BUDGET / EXERCISE 1.1 */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-black flex items-center justify-center">4</span>
            SECTION 4 — GAMBLING BUDGET / EXERCISE 1.1
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Financial harm reduction benchmarks. The system automatically computes and displays standard safety ratios.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              A. Your gross annual income (estimated in ₦) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-gray-500 text-sm font-bold">₦</span>
              <input
                type="number"
                min={0}
                placeholder="e.g., 2400000"
                value={annualIncome}
                onChange={(e) => setAnnualIncome(e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
            <span className="text-[11px] text-gray-500">Enter your total approximate earnings per year before tax.</span>
          </div>

          {/* Readonly Auto-Calculated B & C */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
            <div>
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1">
                <Calculator className="w-4 h-4 text-red-600" />
                <span>B. 2% of your annual gross income</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-gray-200 text-base font-bold text-gray-900">
                ₦{twoPercentAnnual.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-gray-500 italic mt-1 block">
                Automatically calculated: Annual income × 0.02
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-1">
                <Calculator className="w-4 h-4 text-red-600" />
                <span>C. Estimated gambling budget per month</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-gray-200 text-base font-bold text-gray-900">
                ₦{monthlyGamblingBudget.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[11px] text-gray-500 italic mt-1 block">
                Automatically calculated: Annual 2% budget ÷ 12
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              D. Actual amount of money spent on gambling last year (approximate in ₦)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-gray-500 text-sm font-bold">₦</span>
              <input
                type="number"
                min={0}
                placeholder="e.g., 850000"
                value={spentLastYear}
                onChange={(e) => setSpentLastYear(e.target.value ? parseFloat(e.target.value) : '')}
                className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
            {numIncome > 0 && typeof spentLastYear === 'number' && spentLastYear > twoPercentAnnual && (
              <p className="text-xs text-amber-700 mt-1 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Note: Your gambling expenditure exceeded the 2% safety benchmark by ₦{(spentLastYear - twoPercentAnnual).toLocaleString('en-NG')}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 5: DIAGNOSTIC SCREEN / EXERCISE 1.3 */}
      <div id="sec-5-anchor" className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-black flex items-center justify-center">5</span>
              SECTION 5 — DIAGNOSTIC SCREEN / EXERCISE 1.3
            </h2>
            <p className="text-xs text-gray-500 mt-1 italic">
              "Please check Yes or No to the questions below." (Count 1 point for each Yes response)
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-right">
            <span className="text-[10px] uppercase font-bold text-red-600 tracking-wider block">Calculated Score</span>
            <span className="text-base font-extrabold text-red-700">{section5Score} / 19</span>
          </div>
        </div>

        <div className="divide-y divide-gray-100 space-y-1">
          {SECTION_5_DIAGNOSTIC_QUESTIONS.map((question, idx) => (
            <div key={idx} className="pt-3 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-gray-800 leading-snug">
                <span className="font-semibold text-gray-900 mr-2">{idx + 1}.</span>
                {question}
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSec5Answer(idx, 'Yes')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sec5Answers[idx] === 'Yes'
                      ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleSec5Answer(idx, 'No')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sec5Answers[idx] === 'No'
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-1.5">
          <div className="font-semibold text-gray-800 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-red-600" />
            <span>Clinical Reference Scoring Criteria:</span>
          </div>
          <p>• <strong>0:</strong> No problem indicated</p>
          <p>• <strong>1–4:</strong> Mild to moderate problem</p>
          <p>• <strong>5–20:</strong> Significant problem</p>
          <p className="text-[11px] text-gray-500 italic pt-1 border-t border-gray-200">
            * Clearly labeled as an assessment-support feature and not a replacement for professional clinical judgment.
          </p>
        </div>
      </div>

      {/* SECTION 6: GAMBLEPAUSE DIAGNOSTIC SCREEN (GPDS) */}
      <div id="sec-6-anchor" className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-5">
        <div className="border-b border-gray-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-black flex items-center justify-center">6</span>
              SECTION 6 — GAMBLEPAUSE DIAGNOSTIC SCREEN (GPDS)
            </h2>
            <p className="text-xs text-gray-500 mt-1 italic">
              Exercise 1.3: 10 Core Clinical Indicators (Stored and evaluated independently)
            </p>
          </div>

          <div className="px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-right">
            <span className="text-[10px] uppercase font-bold text-orange-700 tracking-wider block">GPDS Score</span>
            <span className="text-base font-extrabold text-orange-800">{gpdsScore} / 10</span>
          </div>
        </div>

        <div className="divide-y divide-gray-100 space-y-1">
          {SECTION_6_GPDS_QUESTIONS.map((question, idx) => (
            <div key={idx} className="pt-3 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs sm:text-sm text-gray-800 leading-snug">
                <span className="font-semibold text-gray-900 mr-2">{idx + 1}.</span>
                {question}
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSec6Answer(idx, 'Yes')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sec6Answers[idx] === 'Yes'
                      ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleSec6Answer(idx, 'No')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    sec6Answers[idx] === 'No'
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur p-4 rounded-2xl border border-gray-300 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-gray-900 block">
            Combined Diagnostic Score: {totalCombinedScore} points
          </span>
          <span className="text-[11px] text-gray-500">
            Section 5: {section5Score}/19 • GPDS: {gpdsScore}/10
          </span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Saving Responses...</span>
          ) : (
            <>
              <span>Submit Initial Assessment</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
