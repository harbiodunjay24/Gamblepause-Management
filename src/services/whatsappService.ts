import { Client } from '../types';

/**
 * Normalizes phone numbers (especially Nigerian numbers) into international E.164-compatible format without '+' or spaces
 * Examples:
 *   "0803 123 4567"     -> "2348031234567"
 *   "+234 803 123 4567" -> "2348031234567"
 *   "2348031234567"     -> "2348031234567"
 *   "07012345678"       -> "2347012345678"
 *   "09012345678"       -> "2349012345678"
 *   "08112345678"       -> "2348112345678"
 */
export function normalizeWhatsAppNumber(rawPhone: string): string {
  if (!rawPhone) return '';

  // Strip all non-digit characters
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits) return '';

  // Handle Nigerian numbers starting with 0 (e.g. 08031234567 -> 2348031234567)
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '234' + digits.substring(1);
  }

  // Handle number already starting with country code 234
  if (digits.startsWith('234') && (digits.length === 13 || digits.length === 14)) {
    return digits;
  }

  // 10 digits without leading 0 (e.g. 8031234567 -> 2348031234567)
  if (digits.length === 10 && !digits.startsWith('0')) {
    return '234' + digits;
  }

  // International numbers (e.g. 44 for UK, 1 for US) with 10-15 digits
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }

  return '';
}

export type WhatsAppMessageType =
  | 'assessment_available'
  | 'assessment_upcoming'
  | 'assessment_reminder'
  | 'general_checkin'
  | 'welcome_intake';

export interface WhatsAppMessageOptions {
  client: Client;
  counsellorName?: string;
  messageType?: WhatsAppMessageType;
  currentStageName?: string;
  nextStageName?: string;
  scheduledDate?: string;
}

/**
 * Generates a clean, empathetic, non-stigmatizing personalized WhatsApp message.
 * STRICT CLINICAL PRIVACY RULE:
 * NEVER includes gambling amounts lost, DSM evaluation scores, test answers, or confidential case notes.
 */
export function generateWhatsAppMessage(options: WhatsAppMessageOptions): string {
  const {
    client,
    counsellorName = 'Your GamblePause Clinical Counsellor',
    messageType = 'general_checkin',
    currentStageName = client.currentStageName || 'Assessment 1.0',
    nextStageName = client.nextAssessmentName || 'Next Check-in',
    scheduledDate = client.nextAssessmentDueDate
      ? new Date(client.nextAssessmentDueDate).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : undefined,
  } = options;

  const firstName = client.preferredName || client.firstName || 'there';

  // 1. Newly Available Assessment
  if (messageType === 'assessment_available') {
    return (
`Hello ${firstName},

This is ${counsellorName} from GamblePause.

Your next clinical check-in, *${nextStageName}*, is now available in your recovery portal. Taking a moment for your reflection keeps your journey on track.

Please log in to your GamblePause Client Portal to complete it at your convenience:
https://gamblepausemanagement.com/

We're here to support you every step of the way.

Warm regards,
${counsellorName}
GamblePause Initiative Africa`
    ).trim();
  }

  // 2. Upcoming Scheduled Assessment
  if (messageType === 'assessment_upcoming') {
    const formattedDate = scheduledDate ? `scheduled for ${scheduledDate}` : 'coming up soon';
    return (
`Hello ${firstName}, your next GamblePause assessment, *${nextStageName}*, is ${formattedDate}. Keep taking things one step at a time. We're here to support you throughout your recovery journey.

Warm regards,
${counsellorName}
GamblePause Initiative Africa`
    ).trim();
  }

  // 3. Overdue Assessment Reminder
  if (messageType === 'assessment_reminder') {
    return (
`Hello ${firstName},

This is ${counsellorName} from GamblePause.

This is a gentle reminder regarding your check-in: *${nextStageName}*.

Taking a moment for your reflection helps keep your recovery journey on track. You can access your form through your GamblePause Client Portal:
https://gamblepausemanagement.com/

Please let me know if you need any assistance accessing your portal.

Warm regards,
${counsellorName}
GamblePause Initiative Africa`
    ).trim();
  }

  // 4. Welcome / Intake
  if (messageType === 'welcome_intake') {
    return (
`Hello ${firstName},

Welcome to GamblePause. This is ${counsellorName}, your assigned clinical counsellor.

I am reaching out to confirm that your intake registration has been received confidentially. You can access your recovery roadmap and initial clinical check-in at any time through the GamblePause Client Portal.

I am here to support you every step of the way.

Warm regards,
${counsellorName}
GamblePause Initiative Africa`
    ).trim();
  }

  // 5. Default: General Client Check-in
  return (
`Hello ${firstName},

This is ${counsellorName} from GamblePause.

I am reaching out to check in on your ongoing support and recovery journey. You are currently on *${currentStageName}*.

Please let me know how you are doing or if you need any assistance today.

Warm regards,
${counsellorName}
GamblePause Initiative Africa`
  ).trim();
}

/**
 * Creates a direct WhatsApp conversation URL (https://wa.me/...)
 * Opens the conversation with the pre-filled message for the counsellor to review and press Send.
 * Does not auto-dispatch without user review.
 */
export function createWhatsAppDirectUrl(rawPhone: string, messageText: string): string {
  const normalized = normalizeWhatsAppNumber(rawPhone);
  if (!normalized) return '';
  return `https://wa.me/${normalized}?text=${encodeURIComponent(messageText)}`;
}
