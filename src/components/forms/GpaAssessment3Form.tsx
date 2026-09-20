import React, { useState } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  Lock,
  Send,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { Client } from '../../types';

interface ThoughtRow {
  id: string;
  automaticThought: string;
  alternativeThought: string;
  newBehavior: string;
  outcome: string;
}

interface GpaAssessment3FormProps {
  client: Client;
  onSubmit: (data: {
    answers: { questionId: string; answer: any; score?: number }[];
  }) => void;
  isSubmitting: boolean;
}

export const GpaAssessment3Form: React.FC<GpaAssessment3FormProps> = ({
  client,
  onSubmit,
  isSubmitting,
}) => {
  const [rows, setRows] = useState<ThoughtRow[]>([
    {
      id: 'row-1',
      automaticThought: '',
      alternativeThought: '',
      newBehavior: '',
      outcome: '',
    },
    {
      id: 'row-2',
      automaticThought: '',
      alternativeThought: '',
      newBehavior: '',
      outcome: '',
    },
  ]);

  const [providerName, setProviderName] = useState(
    client.assignedCounsellorName || 'GamblePause Initiative Africa'
  );
  const [providerDate, setProviderDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [confidentialityConfirmed, setConfidentialityConfirmed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        automaticThought: '',
        alternativeThought: '',
        newBehavior: '',
        outcome: '',
      },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRowChange = (id: string, field: keyof ThoughtRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that at least the first row has thoughts
    const firstRow = rows[0];
    if (!firstRow.automaticThought.trim() || !firstRow.alternativeThought.trim()) {
      setValidationError('Please complete at least one full row in the Alternative Thoughts exercise.');
      return;
    }

    if (!confidentialityConfirmed) {
      setValidationError('Please confirm the confidentiality acknowledgment before submitting.');
      return;
    }

    setValidationError(null);

    const answers = [
      { questionId: 'assessment3_cognitive_rows', questionText: 'Alternative Thoughts Exercise Rows', answer: rows },
      { questionId: 'assessment3_provider_name', questionText: 'Provider Name', answer: providerName },
      { questionId: 'assessment3_provider_date', questionText: 'Provider Date', answer: providerDate },
      { questionId: 'assessment3_confidentiality_confirmed', questionText: 'Confidentiality Acknowledged', answer: true },
    ];

    onSubmit({ answers });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 text-red-600 mb-2">
          <Brain className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            Assessment Stage 3.0
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950">
          GPA Assessment 3.0 — Developing Alternative Thoughts
        </h1>
        <p className="mt-2 text-xs text-gray-500">
          Client: <span className="font-semibold text-gray-800">{client.fullName || client.firstName}</span> ({client.id}) • Cognitive Restructuring Matrix
        </p>
      </div>

      {/* Educational Introduction */}
      <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 rounded-2xl p-6 sm:p-8 border border-red-100 shadow-sm text-gray-800 space-y-3">
        <div className="flex items-center gap-2 text-red-800 font-bold text-base">
          <Lightbulb className="w-5 h-5 text-red-600 shrink-0" />
          <span>Understanding Automatic Thoughts</span>
        </div>
        <p className="text-sm leading-relaxed text-gray-700">
          When the urge to gamble strikes, your brain often produces quick, distorted "Automatic Thoughts" such as <em>"I can win this back,"</em> <em>"Just one spin won't hurt,"</em> or <em>"I deserve a break."</em>
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">
          Through cognitive restructuring, you practice catching these automatic thoughts, challenging them with truth, choosing a new grounding behavior, and observing the positive outcome.
        </p>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Exercise / Repeatable Table */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Cognitive Restructuring Exercise Table
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Fill in your personal automatic thoughts and draft empowering alternatives. Placeholders serve as examples.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddRow}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Row</span>
          </button>
        </div>

        <div className="space-y-6">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-4 relative"
            >
              <div className="flex items-center justify-between border-b border-gray-200/80 pb-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                  Exercise Row #{index + 1}
                </span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveRow(row.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1"
                    title="Remove row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    1. Automatic Thoughts *
                  </label>
                  <textarea
                    rows={2}
                    required={index === 0}
                    placeholder="e.g., 'If I just stake ₦10,000 on this game, I can pay off my immediate debt...'"
                    value={row.automaticThought}
                    onChange={(e) => handleRowChange(row.id, 'automaticThought', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    2. Alternative Thoughts *
                  </label>
                  <textarea
                    rows={2}
                    required={index === 0}
                    placeholder="e.g., 'Chasing losses only digs a deeper hole. Gambling has never solved a debt...'"
                    value={row.alternativeThought}
                    onChange={(e) => handleRowChange(row.id, 'alternativeThought', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    3. New Behavior
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g., 'Turn off data, take a walk, text my recovery sponsor or counsellor...'"
                    value={row.newBehavior}
                    onChange={(e) => handleRowChange(row.id, 'newBehavior', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-800 mb-1">
                    4. Outcome
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g., 'Urge passed after 15 minutes. Saved money, avoided regret, slept with peace...'"
                    value={row.outcome}
                    onChange={(e) => handleRowChange(row.id, 'outcome', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONFIDENTIALITY ACKNOWLEDGMENT */}
      <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
          <Lock className="w-5 h-5 text-red-600" />
          <span>CONFIDENTIALITY ACKNOWLEDGMENT</span>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          GamblePause Initiative Africa maintains strict client privacy. Your cognitive entries are confidential and intended for therapeutic guidance with your assigned counsellor.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Provider Name</label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={providerDate}
              onChange={(e) => setProviderDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-lg border border-gray-300 text-xs bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
          </div>
        </div>

        <label className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-gray-200 cursor-pointer">
          <input
            type="checkbox"
            required
            checked={confidentialityConfirmed}
            onChange={(e) => setConfidentialityConfirmed(e.target.checked)}
            className="mt-0.5 rounded text-red-600 focus:ring-red-500"
          />
          <span className="text-xs text-gray-700 font-medium leading-relaxed">
            I confirm that I have reviewed these cognitive exercises, answered truthfully, and understand the confidentiality terms.
          </span>
        </label>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Saving Assessment 3.0...</span>
          ) : (
            <>
              <span>Submit Assessment 3.0</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
