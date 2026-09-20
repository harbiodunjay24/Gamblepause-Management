import React, { useState } from 'react';
import { ShieldCheck, HeartHandshake, CheckCircle2, AlertCircle, ArrowRight, Lock, User, MapPin, Phone, Mail } from 'lucide-react';
import { NIGERIAN_STATES } from '../../data/demoData';
import { dataService } from '../../services/dataService';
import { Client } from '../../types';

interface ClientRegistrationProps {
  onRegistrationComplete: (client: Client, startImmediateAssessment: boolean) => void;
}

export const ClientRegistration: React.FC<ClientRegistrationProps> = ({ onRegistrationComplete }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    preferredName: '',
    age: '',
    gender: 'Male' as 'Male' | 'Female' | 'Prefer not to say' | 'Other',
    phone: '',
    email: '',
    state: 'Lagos',
    location: '',
    occupation: '',
    maritalStatus: 'Single' as 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Separated',
    howHeard: 'Social Media (Twitter/X / Instagram / TikTok)',
    emergencyName: '',
    emergencyRelationship: '',
    emergencyPhone: '',
    consentGiven: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'Please enter your first name.';
    if (!formData.lastName.trim()) newErrors.lastName = 'Please enter your last name.';
    const ageRaw = formData.age.trim();
    if (!ageRaw) {
      newErrors.age = 'Please enter your age.';
    } else {
      const parsedAge = Number(ageRaw);
      if (isNaN(parsedAge) || parsedAge < 1) {
        newErrors.age = 'Please enter a valid age.';
      } else if (parsedAge > 100) {
        newErrors.age = 'Please enter an age between 1 and 100.';
      }
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required for follow-up reminders.';
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      newErrors.email = 'Please enter a valid email address.';
    }
    if (!formData.state) newErrors.state = 'Please select your state.';
    if (!formData.location.trim()) newErrors.location = 'Please provide your city area or LGA.';
    if (!formData.occupation.trim()) newErrors.occupation = 'Please enter your current occupation or study.';
    if (!formData.consentGiven) {
      newErrors.consentGiven = 'Your consent is required to participate in GamblePause.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent, startImmediate: boolean) => {
    e.preventDefault();
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      const newClient = dataService.registerClient({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        preferredName: formData.preferredName.trim() || undefined,
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        state: formData.state,
        location: formData.location.trim(),
        occupation: formData.occupation.trim(),
        maritalStatus: formData.maritalStatus,
        howHeard: formData.howHeard,
        emergencyContact: formData.emergencyName
          ? {
              name: formData.emergencyName.trim(),
              relationship: formData.emergencyRelationship.trim() || 'Trusted Contact',
              phone: formData.emergencyPhone.trim(),
            }
          : undefined,
        consentGiven: formData.consentGiven,
      });

      onRegistrationComplete(newClient, startImmediate);
    } catch (err) {
      console.error('Registration failed:', err);
      setErrors({ form: 'An error occurred during registration. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
      {/* Intro hero card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm mb-6 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-semibold mb-4 border border-red-100">
          <HeartHandshake className="w-4 h-4 text-red-600" />
          <span>Step 1 of Your Recovery Pathway</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-950 tracking-tight">
          GamblePause Client Assessment
        </h1>

        <p className="mt-2.5 text-gray-600 text-sm sm:text-base leading-relaxed">
          Welcome. We understand that stepping back from gambling takes genuine courage.
          The information you provide here will be used by our trained, non-judgmental counsellors
          to tailor your personal pause journey and follow-up support.
        </p>

        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-red-600" />
            <span>Strictly Confidential & Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-red-600" />
            <span>Takes ~3 minutes to complete</span>
          </div>
        </div>
      </div>

      {/* Main Biodata Form */}
      <form
        onSubmit={(e) => handleSubmit(e, true)}
        className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm space-y-6"
        id="client-biodata-form"
      >
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-red-600" />
            <span>Personal Biodata</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Please provide accurate details so your counsellor can reach you with reminders and care.
          </p>
        </div>

        {errors.form && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errors.form}</span>
          </div>
        )}

        {/* Name Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              id="biodata-firstname"
              placeholder="e.g. Oluwaseun"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.firstName ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
            />
            {errors.firstName && <p className="text-[11px] text-red-600 mt-1">{errors.firstName}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              id="biodata-lastname"
              placeholder="e.g. Adeleke"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.lastName ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
            />
            {errors.lastName && <p className="text-[11px] text-red-600 mt-1">{errors.lastName}</p>}
          </div>
        </div>

        {/* Preferred Name & Age */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Preferred Name / Nickname <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              id="biodata-preferredname"
              placeholder="What should we call you? (e.g. Seun)"
              value={formData.preferredName}
              onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Age <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={100}
              id="biodata-age"
              placeholder="Enter age (1-100)"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-900 bg-white placeholder-gray-400 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.age ? 'border-red-500 bg-red-50/30' : 'border-gray-300 focus:border-red-500'
              }`}
            />
            {errors.age && <p className="text-[11px] text-red-600 mt-1">{errors.age}</p>}
          </div>
        </div>

        {/* Gender Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-2">
            Gender <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(['Male', 'Female', 'Prefer not to say', 'Other'] as const).map((genderOption) => (
              <label
                key={genderOption}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                  formData.gender === genderOption
                    ? 'border-red-600 bg-red-50 text-red-700 shadow-sm'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="gender"
                  checked={formData.gender === genderOption}
                  onChange={() => setFormData({ ...formData, gender: genderOption })}
                  className="accent-red-600 w-3.5 h-3.5"
                />
                <span>{genderOption}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Contact Info: Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Phone / WhatsApp Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-gray-500 font-medium">
                🇳🇬 +234
              </span>
              <input
                type="tel"
                required
                id="biodata-phone"
                placeholder="803 123 4567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full pl-20 pr-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  errors.phone ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
                }`}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Used for timely assessment reminders via SMS/WhatsApp.</p>
            {errors.phone && <p className="text-[11px] text-red-600 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
              <input
                type="email"
                required
                id="biodata-email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  errors.email ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
                }`}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">We send your secure assessment links here.</p>
            {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
          </div>
        </div>

        {/* Nigerian State & LGA / Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              State (Nigeria) <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.state}
              id="biodata-state"
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {NIGERIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              City / LGA / Neighborhood <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              id="biodata-location"
              placeholder="e.g. Ikeja, Yaba, Garki, Bodija"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.location ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
            />
            {errors.location && <p className="text-[11px] text-red-600 mt-1">{errors.location}</p>}
          </div>
        </div>

        {/* Occupation & Marital Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Occupation / Student Status <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              id="biodata-occupation"
              placeholder="e.g. Trader, Civil Servant, Student, Developer"
              value={formData.occupation}
              onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-red-500 ${
                errors.occupation ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50 focus:bg-white'
              }`}
            />
            {errors.occupation && <p className="text-[11px] text-red-600 mt-1">{errors.occupation}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-800 mb-1.5">
              Marital Status <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.maritalStatus}
              id="biodata-marital"
              onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="Single">Single</option>
              <option value="Married">Married</option>
              <option value="Separated">Separated</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
            </select>
          </div>
        </div>

        {/* How did you hear about GamblePause */}
        <div>
          <label className="block text-xs font-semibold text-gray-800 mb-1.5">
            How did you hear about GamblePause? <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.howHeard}
            id="biodata-howheard"
            onChange={(e) => setFormData({ ...formData, howHeard: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="Social Media (Twitter/X / Instagram / TikTok)">Social Media (Twitter/X / Instagram / TikTok)</option>
            <option value="Friend or Family member">Friend or Family member</option>
            <option value="Community Outreach / Campus Seminar">Community Outreach / Campus Seminar</option>
            <option value="Radio or Podcast Broadcast">Radio or Podcast Broadcast</option>
            <option value="WhatsApp Group or Telegram">WhatsApp Group or Telegram</option>
            <option value="Online Search / News Article">Online Search / News Article</option>
            <option value="Referral from Health Facility / Counsellor">Referral from Health Facility / Counsellor</option>
          </select>
        </div>

        {/* Emergency / Trusted Contact (Optional) */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900">Alternative / Trusted Contact</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider bg-gray-200/70 px-2 py-0.5 rounded">
              Optional
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            A trusted family member, close friend, or mentor we can reach in emergency situations.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                placeholder="Contact Name"
                value={formData.emergencyName}
                onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Relationship (e.g. Spouse, Brother)"
                value={formData.emergencyRelationship}
                onChange={(e) => setFormData({ ...formData, emergencyRelationship: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div>
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.emergencyPhone}
                onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* Privacy & Consent Language */}
        <div className="p-4 rounded-xl border border-red-100 bg-red-50/40 space-y-3">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="biodata-consent"
              checked={formData.consentGiven}
              onChange={(e) => setFormData({ ...formData, consentGiven: e.target.checked })}
              className="mt-1 accent-red-600 w-4 h-4 rounded cursor-pointer shrink-0"
            />
            <label htmlFor="biodata-consent" className="text-xs text-gray-700 leading-relaxed cursor-pointer">
              <strong className="text-gray-950 font-bold">Consent to Participate:</strong> I willingly register for the
              GamblePause harm-reduction programme. I understand my personal data and assessment answers are strictly
              confidential, protected under Nigerian Data Protection Regulations (NDPR), and accessible only by authorized
              GamblePause counsellors to guide my recovery.
            </label>
          </div>
          {errors.consentGiven && <p className="text-[11px] text-red-600 ml-7">{errors.consentGiven}</p>}
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            id="register-submit-start-btn"
            className="flex-1 py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-sm shadow-md shadow-red-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Registering Record...</span>
            ) : (
              <>
                <span>Submit & Start Initial Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400">
          Already registered? Your counsellor or automated SMS will provide your direct secure link.
        </p>
      </form>
    </div>
  );
};
