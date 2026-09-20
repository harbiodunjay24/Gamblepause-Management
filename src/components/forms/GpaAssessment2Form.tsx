import React, { useState } from 'react';
import {
  Users,
  Shield,
  FileText,
  AlertTriangle,
  Send,
  Heart,
  CheckSquare,
  Lock,
} from 'lucide-react';
import { Client } from '../../types';

interface GpaAssessment2FormProps {
  client: Client;
  onSubmit: (data: {
    answers: { questionId: string; answer: any; score?: number }[];
  }) => void;
  isSubmitting: boolean;
}

export const GpaAssessment2Form: React.FC<GpaAssessment2FormProps> = ({
  client,
  onSubmit,
  isSubmitting,
}) => {
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [currentProblemsDetail, setCurrentProblemsDetail] = useState('');
  const [addressingProblemsDetail, setAddressingProblemsDetail] = useState('');
  const [providerName, setProviderName] = useState(
    client.assignedCounsellorName || 'GamblePause Initiative Africa'
  );
  const [providerDate, setProviderDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [confidentialityConfirmed, setConfidentialityConfirmed] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const CONSEQUENCE_AREAS = [
    'Financial',
    'Personal',
    'Legal',
    'Work/School',
    'Friends',
    'Family',
    'Medical',
    'Emotional/Psychological',
  ];

  const handleToggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAreas.length === 0) {
      setValidationError('Please select at least one problem area in Exercise 2.1.');
      return;
    }

    if (!currentProblemsDetail.trim()) {
      setValidationError('Please explain the current problems you must deal with.');
      return;
    }

    if (!addressingProblemsDetail.trim()) {
      setValidationError('Please explain what you are going to do to address these problems.');
      return;
    }

    if (!confidentialityConfirmed) {
      setValidationError('Please confirm the confidentiality acknowledgment before submitting.');
      return;
    }

    setValidationError(null);

    const answers = [
      { questionId: 'ex2_1_selected_areas', questionText: 'Consequence Areas Selected', answer: selectedAreas },
      { questionId: 'ex2_1_current_problems', questionText: 'Current problems you must deal with', answer: currentProblemsDetail },
      { questionId: 'ex2_1_addressing_problems', questionText: 'What you are going to do to address these problems', answer: addressingProblemsDetail },
      { questionId: 'ex2_confidentiality_provider_name', questionText: 'Provider Name', answer: providerName },
      { questionId: 'ex2_confidentiality_provider_date', questionText: 'Provider Date', answer: providerDate },
      { questionId: 'ex2_confidentiality_confirmed', questionText: 'Confidentiality Acknowledged', answer: true },
    ];

    onSubmit({ answers });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 text-red-600 mb-2">
          <Users className="w-6 h-6" />
          <span className="text-xs font-bold uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-100">
            Assessment Stage 2.0
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950">
          GPA Assessment 2.0 — Dealing With Family Members
        </h1>
        <p className="mt-2 text-xs text-gray-500">
          Client: <span className="font-semibold text-gray-800">{client.fullName || client.firstName}</span> ({client.id}) • Counsellor: {client.assignedCounsellorName || 'Assigned Specialist'}
        </p>
      </div>

      {/* Educational Content */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl p-6 sm:p-8 border border-amber-200/80 shadow-sm text-gray-800 space-y-4">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-base">
          <Heart className="w-5 h-5 text-red-600" />
          <span>Family Engagement & Emotional Grounding</span>
        </div>

        <p className="text-sm leading-relaxed text-gray-700">
          "Be honest and tell your family about your gambling. Tell them where all the money went. Tell them about your treatment and what you are doing and learning. Sometimes family members are initially angry, but it is usually short-lived. If you are honest and continue making a sincere effort to stop gambling and manage your debts, your family will regain their respect for you. Strong expressions of anger and fear don't mean they don't want to help you; expect strong emotional reactions. Accept them and continue to address the financial issues.
        </p>

        <div className="p-4 rounded-xl bg-white/80 border border-amber-200 text-xs sm:text-sm font-semibold text-amber-950 space-y-2">
          <p>
            • Make sure your family knows that when you are developing a payment plan that the family's welfare will always come first.
          </p>
          <p>
            • Debt payments do not start until after household expenses are met.
          </p>
        </div>
      </div>

      {validationError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
          <span>{validationError}</span>
        </div>
      )}

      {/* EXERCISE 2.1 — CONSEQUENCES OF GAMBLING */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-black flex items-center justify-center">2.1</span>
            EXERCISE 2.1 — CONSEQUENCES OF GAMBLING
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Identify affected life domains and map out actionable steps forward.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-2">
            Select the problem areas currently affected by your gambling: (Select all that apply) *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CONSEQUENCE_AREAS.map((area) => (
              <button
                type="button"
                key={area}
                onClick={() => handleToggleArea(area)}
                className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedAreas.includes(area)
                    ? 'border-red-600 bg-red-50 text-red-900 shadow-sm ring-1 ring-red-600'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span>{area}</span>
                {selectedAreas.includes(area) && (
                  <CheckSquare className="w-4 h-4 text-red-600 shrink-0 ml-1" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            "From the above listed, what are current problems I must deal with?" *
          </label>
          <textarea
            rows={4}
            required
            placeholder="Describe the urgent pressures, bills, family expectations, or debt conversations you are facing..."
            value={currentProblemsDetail}
            onChange={(e) => setCurrentProblemsDetail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1">
            "From the above listed, what am I going to do to address these problems?" *
          </label>
          <textarea
            rows={4}
            required
            placeholder="Outline your honest plan (e.g., presenting a transparent budget to my spouse, surrendering access to online betting apps, securing household food/rent first)..."
            value={addressingProblemsDetail}
            onChange={(e) => setAddressingProblemsDetail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>
      </div>

      {/* CONFIDENTIALITY ACKNOWLEDGMENT */}
      <div className="bg-gray-50 rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
          <Lock className="w-5 h-5 text-red-600" />
          <span>CONFIDENTIALITY ACKNOWLEDGMENT</span>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed">
          GamblePause Initiative Africa provides confidential counselling and psychoeducation support. The details provided in this assessment will be reviewed exclusively by authorized clinical staff to support your recovery. Information is kept private in accordance with professional ethical standards.
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
            <label className="block text-xs font-semibold text-gray-700 mb-1">Provider Date</label>
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
            I confirm that I have reviewed the educational material, answered truthfully, and understand the confidentiality terms.
          </span>
        </label>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Saving Assessment 2.0...</span>
          ) : (
            <>
              <span>Submit Assessment 2.0</span>
              <Send className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
