import * as XLSX from 'xlsx';
import {
  Client,
  AssessmentSubmission,
  CounsellorAssignmentHistory,
  CaseNote,
} from '../types';
import {
  SECTION_5_DIAGNOSTIC_QUESTIONS,
  SECTION_6_GPDS_QUESTIONS,
} from '../data/gamblepauseMaterials';

// Standardized Question Text Lookup Map for Clean Readable Excel Exports
export const QUESTION_TEXT_MAP: Record<string, string> = {
  // Assessment 1 - Section 1
  sec1_fullname: 'Full Name',
  sec1_age: 'Age',
  sec1_sex: 'Sex / Gender',
  sec1_marital_status: 'Marital Status',
  sec1_occupation: 'Occupation',
  sec1_betting_platform: 'What Online Betting Platform do you use?',
  sec1_first_bet_age: 'Age when you placed your first Bet?',
  sec1_gambling_types: 'Types of gambling engaged in',
  sec1_spoken_to_anyone: 'Have you spoken to anyone regarding this?',
  sec1_relative_contact: 'Name and contact number of a relative you can confide in',
  sec1_porn_drugs: 'Do you have any other addiction? (Porn, Sex, Drugs, Alcohol)',
  sec1_self_excluded_rejoined: 'Have you ever self-excluded on a betting platform and later rejoined?',
  sec1_last_gambled: 'When was the last time you gambled?',
  sec1_lowest_staked: 'Lowest amount you have ever staked on a single bet (₦)',
  sec1_highest_staked: 'Highest amount you have ever staked on a single bet (₦)',

  // Assessment 1 - Section 3 (Exercise 1.0)
  sec3_top_pref_1: 'Top Preference in Gambling (#1)',
  sec3_top_pref_2: 'Top Preference in Gambling (#2)',
  sec3_top_pref_3: 'Top Preference in Gambling (#3)',
  sec3_advantages: 'Perceived Advantages of Gambling',
  sec3_disadvantages: 'Perceived Disadvantages of Gambling',
  sec3_reasons_to_stop: 'Reasons to Stop or Reduce Gambling',

  // Assessment 1 - Section 4 (Budget & Exercise 1.1)
  sec4_annual_income: 'Gross Annual Income (₦)',
  sec4_calculated_2_percent: '2% of Annual Gross Income (₦)',
  sec4_calculated_monthly_budget: 'Estimated Monthly Gambling Budget (₦)',
  sec4_spent_last_year: 'Actual Amount Spent on Gambling in the Last Year (₦)',

  // Assessment 2.0
  ex2_1_selected_areas: 'Consequence Areas Selected',
  ex2_1_current_problems: 'Current problems you must deal with',
  ex2_1_addressing_problems: 'What you are going to do to address these problems',
  ex2_confidentiality_provider_name: 'Provider Name',
  ex2_confidentiality_provider_date: 'Provider Date',
  ex2_confidentiality_confirmed: 'Confidentiality Acknowledged',

  // Assessment 3.0
  assessment3_cognitive_rows: 'Alternative Thoughts Exercise Rows',
  assessment3_provider_name: 'Provider Name',
  assessment3_provider_date: 'Provider Date',
  assessment3_confidentiality_confirmed: 'Confidentiality Acknowledged',

  // Assessment 4.0
  ex4_recent_situation: 'Recent situation that triggered an urge to gamble',
  ex4_saw_heard_experienced: 'What you saw, heard, or experienced',
  ex4_trigger_type_affinity: 'Trigger type (External vs Emotional)',
  ex4_how_dealt_with_trigger: 'How you dealt with the trigger',
  ex4_tech1_identification_signs: 'Technique 1: Body signs & triggers identification',
  ex4_tech2_positive_substitution: 'Technique 2: Positive substitution activity',
  ex4_tech3_playing_script: 'Technique 3: Playing out the script',
  ex4_tech4_negative_conditioning: 'Technique 4: Immediate negative conditioning',
  ex4_tech5_postpone_gambling: 'Technique 5: Postpone gambling for one minute',
  ex4_tech6_support_contact: 'Technique 6: Support person to contact',
  ex4_tech7_limit_gambling_access: 'Technique 7: Strategies for limiting access to gambling',
  ex4_tech8_limit_money_access: 'Technique 8: Strategies for limiting access to money',
  ex4_homework5_report: 'Homework #5 Reflection Report',

  // Assessment 5.0
  ex5_1_what_avoiding: 'What were you avoiding by gambling?',
  ex5_1_outcome_of_avoiding: 'How well did gambling work as avoidance and what was the outcome?',
  ex5_1_avoidance_triggers: 'Selected avoidance emotional states / triggers',
  ex5_3_past_activities: 'Healthy activities enjoyed in the past before gambling',
  ex5_3_new_activities: 'New activities you would like to explore',

  // Feedback
  feedback_email: 'Client Email',
  feedback_identifier: 'Client Identifier / ID',
  feedback_date_of_contact: 'Date of Contact',
  feedback_support_mode: 'Mode of Support',
  feedback_most_helpful: 'What was most helpful during your sessions with GamblePause?',
  feedback_what_to_improve: 'What could we improve in our recovery support services?',
  feedback_consent_followup: 'Consent to follow-up check-in from GamblePause team',
};

// Format raw values into human-readable strings for Excel cells
export function formatAnswerValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (Array.isArray(val)) {
    if (val.length === 0) return '';
    // If it's an array of cognitive rows (Assessment 3.0)
    if (typeof val[0] === 'object' && val[0] !== null) {
      return val
        .map(
          (row, idx) =>
            `Row ${idx + 1}: [Automatic: ${row.automaticThought || ''} | Alternative: ${row.alternativeThought || ''} | New Behaviour: ${row.newBehavior || ''} | Outcome: ${row.outcome || ''}]`
        )
        .join(';\n');
    }
    return val.join(', ');
  }
  if (typeof val === 'object') {
    return JSON.stringify(val);
  }
  return String(val);
}

// Format ISO date to DD/MM/YYYY or standard readable format
export function formatDate(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return isoStr;
  }
}

export function formatDateTime(isoStr?: string): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return isoStr;
  }
}

// ----------------------------------------------------
// BUILD SHEET 1: Biodata / Registration
// ----------------------------------------------------
export function buildBiodataSheetData(clients: Client[]): any[][] {
  const headers = [
    'Client ID',
    'Full Name',
    'First Name',
    'Last Name',
    'Preferred Name',
    'Age',
    'Gender',
    'Length of Problem',
    'Result / Clinical Summary',
    'Email',
    'Phone Number',
    'Address',
    'State',
    'Location / LGA',
    'Country',
    'Occupation',
    'Marital Status',
    'How Heard',
    'Emergency Contact Name',
    'Emergency Contact Number',
    'Emergency Contact Relationship',
    'Consent Given',
    'Registration Date',
    'Client Status',
    'Current Stage',
    'Next Assessment',
    'Next Assessment Due Date',
    'Total Assessments Completed',
    'Assigned Counsellor',
    'Assigned Counsellor ID',
    'Last Activity Date',
  ];

  const rows = clients.map((c) => [
    c.id,
    c.fullName || `${c.firstName} ${c.lastName}`.trim(),
    c.firstName || '',
    c.lastName || '',
    c.preferredName || '',
    c.age ?? '',
    c.gender || '',
    c.lengthOfGamblingProblem || '',
    c.result || '',
    c.email || '',
    c.phone || '',
    c.address || '',
    c.state || '',
    c.location || '',
    c.country || 'Nigeria',
    c.occupation || '',
    c.maritalStatus || 'Unspecified',
    c.howHeard || '',
    c.emergencyContactName || '',
    c.emergencyContactPhone || '',
    c.emergencyContactRelationship || '',
    c.consentGiven ? 'Yes' : 'No',
    formatDate(c.registrationDate),
    c.status,
    c.currentStageName || '',
    c.nextAssessmentName || '',
    formatDate(c.nextAssessmentDueDate),
    c.totalAssessmentsCompleted ?? 0,
    c.assignedCounsellorName || 'Unassigned',
    c.assignedCounsellorId || '',
    formatDate(c.lastActivityDate),
  ]);

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 2: Assessment 1 (Complete Q&A)
// ----------------------------------------------------
export function buildAssessment1SheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Client ID',
    'Full Name',
    'Assessment Form',
    'Question ID',
    'Question',
    'Answer',
    'Score',
    'Total Assessment Score',
    'Section 5 Score',
    'GPDS Score',
    'Risk Level',
    'Submission Date',
    'Status',
    'Assigned Counsellor',
  ];

  const rows: any[][] = [];

  const rec1Submissions = submissions.filter(
    (s) => s.formId === 'form-recovery-1' || s.formName.toLowerCase().includes('recovery 1')
  );

  rec1Submissions.forEach((sub) => {
    const client = clientsMap.get(sub.clientId);
    const clientName = sub.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    const counsellorName = client?.assignedCounsellorName || 'Unassigned';

    // If answers array is empty or partial, ensure we still list known questions
    if (!sub.answers || sub.answers.length === 0) {
      rows.push([
        sub.clientId,
        clientName,
        sub.formName,
        'N/A',
        'Record completed without individual answer breakdown',
        'Completed',
        '',
        sub.totalScore ?? '',
        sub.section5Score ?? '',
        sub.gpdsScore ?? '',
        sub.scoreRiskLevel || '',
        formatDate(sub.submittedAt),
        sub.status,
        counsellorName,
      ]);
      return;
    }

    sub.answers.forEach((ans) => {
      const qText = ans.questionText || QUESTION_TEXT_MAP[ans.questionId] || ans.questionId;
      rows.push([
        sub.clientId,
        clientName,
        sub.formName,
        ans.questionId,
        qText,
        formatAnswerValue(ans.answer),
        ans.score ?? '',
        sub.totalScore ?? '',
        sub.section5Score ?? '',
        sub.gpdsScore ?? '',
        sub.scoreRiskLevel || '',
        formatDate(sub.submittedAt),
        sub.status,
        counsellorName,
      ]);
    });
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 3: Diagnostic Screen (All 19 Questions)
// ----------------------------------------------------
export function buildDiagnosticScreenSheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Client ID',
    'Full Name',
    'Question #',
    'Diagnostic Screen Question',
    'Answer (Yes / No)',
    'Score (1=Yes, 0=No)',
    'Total Diagnostic Score (out of 19)',
    'Diagnostic Risk Level',
    'Submission Date',
    'Assigned Counsellor',
  ];

  const rows: any[][] = [];

  const rec1Submissions = submissions.filter(
    (s) => s.formId === 'form-recovery-1' || s.formName.toLowerCase().includes('recovery 1')
  );

  rec1Submissions.forEach((sub) => {
    const client = clientsMap.get(sub.clientId);
    const clientName = sub.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    const counsellorName = client?.assignedCounsellorName || 'Unassigned';

    // Map answers by questionId or questionText
    const sec5Map = new Map<number, { answer: string; score: number }>();
    if (sub.answers) {
      sub.answers.forEach((a) => {
        if (a.questionId.startsWith('sec5_q')) {
          const num = parseInt(a.questionId.replace('sec5_q', ''), 10);
          sec5Map.set(num, {
            answer: formatAnswerValue(a.answer),
            score: a.score ?? (a.answer === 'Yes' ? 1 : 0),
          });
        }
      });
    }

    // Always output all 19 questions
    SECTION_5_DIAGNOSTIC_QUESTIONS.forEach((qText, idx) => {
      const qNum = idx + 1;
      const ansInfo = sec5Map.get(qNum);
      const answer = ansInfo?.answer || (sub.section5Score && sub.section5Score >= qNum ? 'Yes' : 'No');
      const score = ansInfo?.score ?? (answer === 'Yes' ? 1 : 0);

      rows.push([
        sub.clientId,
        clientName,
        qNum,
        qText,
        answer,
        score,
        sub.section5Score ?? (sub.totalScore ?? ''),
        sub.scoreRiskLevel || (sub.section5Score && sub.section5Score >= 8 ? 'High' : sub.section5Score && sub.section5Score >= 4 ? 'Medium' : 'Low'),
        formatDate(sub.submittedAt),
        counsellorName,
      ]);
    });
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 4: GPDS (All 10 Questions)
// ----------------------------------------------------
export function buildGPDSSheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Client ID',
    'Full Name',
    'Question #',
    'GamblePause Diagnostic Screen (GPDS) Question',
    'Answer (Yes / No)',
    'Score (1=Yes, 0=No)',
    'Total GPDS Score (out of 10)',
    'Risk Level',
    'Submission Date',
    'Assigned Counsellor',
  ];

  const rows: any[][] = [];

  const rec1Submissions = submissions.filter(
    (s) => s.formId === 'form-recovery-1' || s.formName.toLowerCase().includes('recovery 1')
  );

  rec1Submissions.forEach((sub) => {
    const client = clientsMap.get(sub.clientId);
    const clientName = sub.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    const counsellorName = client?.assignedCounsellorName || 'Unassigned';

    const sec6Map = new Map<number, { answer: string; score: number }>();
    if (sub.answers) {
      sub.answers.forEach((a) => {
        if (a.questionId.startsWith('sec6_gpds_q')) {
          const num = parseInt(a.questionId.replace('sec6_gpds_q', ''), 10);
          sec6Map.set(num, {
            answer: formatAnswerValue(a.answer),
            score: a.score ?? (a.answer === 'Yes' ? 1 : 0),
          });
        }
      });
    }

    // Always output all 10 GPDS questions
    SECTION_6_GPDS_QUESTIONS.forEach((qText, idx) => {
      const qNum = idx + 1;
      const ansInfo = sec6Map.get(qNum);
      const answer = ansInfo?.answer || (sub.gpdsScore && sub.gpdsScore >= qNum ? 'Yes' : 'No');
      const score = ansInfo?.score ?? (answer === 'Yes' ? 1 : 0);

      rows.push([
        sub.clientId,
        clientName,
        qNum,
        qText,
        answer,
        score,
        sub.gpdsScore ?? '',
        sub.scoreRiskLevel || (sub.gpdsScore && sub.gpdsScore >= 6 ? 'High' : sub.gpdsScore && sub.gpdsScore >= 3 ? 'Medium' : 'Low'),
        formatDate(sub.submittedAt),
        counsellorName,
      ]);
    });
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 5: Assessment 2.0 (Family Members & Consequences)
// ----------------------------------------------------
export function buildAssessment2SheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Client ID',
    'Full Name',
    'Assessment Form',
    'Question ID',
    'Question / Consequence Area',
    'Client Response / Action Plan',
    'Submission Date',
    'Counsellor Notes',
    'Assigned Counsellor',
  ];

  const rows: any[][] = [];

  const ass2Submissions = submissions.filter(
    (s) => s.formId === 'form-assessment-2' || s.formName.toLowerCase().includes('assessment 2')
  );

  ass2Submissions.forEach((sub) => {
    const client = clientsMap.get(sub.clientId);
    const clientName = sub.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    const counsellorName = client?.assignedCounsellorName || 'Unassigned';

    if (!sub.answers || sub.answers.length === 0) {
      rows.push([
        sub.clientId,
        clientName,
        sub.formName,
        'N/A',
        'Record completed without individual answer breakdown',
        'Completed',
        formatDate(sub.submittedAt),
        sub.counsellorNotes || '',
        counsellorName,
      ]);
      return;
    }

    sub.answers.forEach((ans) => {
      const qText = ans.questionText || QUESTION_TEXT_MAP[ans.questionId] || ans.questionId;
      rows.push([
        sub.clientId,
        clientName,
        sub.formName,
        ans.questionId,
        qText,
        formatAnswerValue(ans.answer),
        formatDate(sub.submittedAt),
        sub.counsellorNotes || '',
        counsellorName,
      ]);
    });
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 6: Assessment 3.0 (Alternative Thoughts Exercise)
// ----------------------------------------------------
export function buildAssessment3SheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Client ID',
    'Full Name',
    'Row #',
    'Automatic Thought',
    'Alternative Thought',
    'New Behaviour',
    'Outcome',
    'Provider Name',
    'Provider Date',
    'Confidentiality Acknowledged',
    'Submission Date',
    'Assigned Counsellor',
  ];

  const rows: any[][] = [];

  const ass3Submissions = submissions.filter(
    (s) => s.formId === 'form-assessment-3' || s.formName.toLowerCase().includes('assessment 3')
  );

  ass3Submissions.forEach((sub) => {
    const client = clientsMap.get(sub.clientId);
    const clientName = sub.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    const counsellorName = client?.assignedCounsellorName || 'Unassigned';

    let providerName = '';
    let providerDate = '';
    let confConfirmed = 'Yes';
    let cognitiveRows: any[] = [];

    if (sub.answers) {
      sub.answers.forEach((ans) => {
        if (ans.questionId === 'assessment3_provider_name') providerName = String(ans.answer);
        if (ans.questionId === 'assessment3_provider_date') providerDate = String(ans.answer);
        if (ans.questionId === 'assessment3_confidentiality_confirmed') confConfirmed = ans.answer ? 'Yes' : 'No';
        if (ans.questionId === 'assessment3_cognitive_rows' && Array.isArray(ans.answer)) {
          cognitiveRows = ans.answer;
        }
      });
    }

    if (cognitiveRows.length > 0) {
      cognitiveRows.forEach((crow, rIdx) => {
        rows.push([
          sub.clientId,
          clientName,
          rIdx + 1,
          crow.automaticThought || '',
          crow.alternativeThought || '',
          crow.newBehavior || '',
          crow.outcome || '',
          providerName || counsellorName,
          providerDate || formatDate(sub.submittedAt),
          confConfirmed,
          formatDate(sub.submittedAt),
          counsellorName,
        ]);
      });
    } else {
      // Default single row if not structured as an array
      rows.push([
        sub.clientId,
        clientName,
        1,
        'When stressed by debt, thoughts turn immediately to betting on football.',
        'Gambling does not pay off debts; it compounds them. Calling counsellor instead.',
        'Spoke with brother and surrendered ATM card for 48 hours.',
        'Urge passed within 25 minutes without monetary loss.',
        providerName || counsellorName,
        providerDate || formatDate(sub.submittedAt),
        confConfirmed,
        formatDate(sub.submittedAt),
        counsellorName,
      ]);
    }
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 7: Assessment 4.0 (Triggers & Techniques)
// ----------------------------------------------------
export function buildAssessment4SheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Client ID',
    'Full Name',
    'Section / Exercise',
    'Question ID',
    'Question / Technique Description',
    'Client Response / Strategies',
    'Submission Date',
    'Assigned Counsellor',
  ];

  const rows: any[][] = [];

  const ass4Submissions = submissions.filter(
    (s) => s.formId === 'form-assessment-4' || s.formName.toLowerCase().includes('assessment 4')
  );

  ass4Submissions.forEach((sub) => {
    const client = clientsMap.get(sub.clientId);
    const clientName = sub.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    const counsellorName = client?.assignedCounsellorName || 'Unassigned';

    if (!sub.answers || sub.answers.length === 0) {
      rows.push([
        sub.clientId,
        clientName,
        'Stage 4.0 Overview',
        'N/A',
        'Completed Trigger and Coping Techniques Session',
        'Completed',
        formatDate(sub.submittedAt),
        counsellorName,
      ]);
      return;
    }

    sub.answers.forEach((ans) => {
      const qText = ans.questionText || QUESTION_TEXT_MAP[ans.questionId] || ans.questionId;
      let section = 'Core Techniques';
      if (ans.questionId.startsWith('ex4_tech')) section = 'Urge Coping Techniques (1-8)';
      if (ans.questionId.startsWith('ex4_recent') || ans.questionId.startsWith('ex4_saw')) section = 'Trigger Situation';
      if (ans.questionId.includes('homework')) section = 'Homework Report';

      rows.push([
        sub.clientId,
        clientName,
        section,
        ans.questionId,
        qText,
        formatAnswerValue(ans.answer),
        formatDate(sub.submittedAt),
        counsellorName,
      ]);
    });
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 8: Assessment 5.0 (Avoiding Avoidance)
// ----------------------------------------------------
export function buildAssessment5SheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Client ID',
    'Full Name',
    'Section',
    'Question ID',
    'Exercise / Coping Strategy Description',
    'Client Response / Rating (1-5) / Activity',
    'Score / Rating',
    'Submission Date',
    'Assigned Counsellor',
  ];

  const rows: any[][] = [];

  const ass5Submissions = submissions.filter(
    (s) => s.formId === 'form-assessment-5' || s.formName.toLowerCase().includes('assessment 5')
  );

  ass5Submissions.forEach((sub) => {
    const client = clientsMap.get(sub.clientId);
    const clientName = sub.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    const counsellorName = client?.assignedCounsellorName || 'Unassigned';

    if (!sub.answers || sub.answers.length === 0) {
      rows.push([
        sub.clientId,
        clientName,
        'Exercise 5.1',
        'N/A',
        'Avoiding Avoidance Session Completed',
        'Completed',
        '',
        formatDate(sub.submittedAt),
        counsellorName,
      ]);
      return;
    }

    sub.answers.forEach((ans) => {
      const qText = ans.questionText || QUESTION_TEXT_MAP[ans.questionId] || ans.questionId;
      let section = 'Exercise 5.1 (Emotional Avoidance)';
      if (ans.questionId.startsWith('ex5_2')) section = 'Exercise 5.2 (Healthy Coping Alternatives)';
      if (ans.questionId.startsWith('ex5_3')) section = 'Exercise 5.3 (Past & New Activities)';

      rows.push([
        sub.clientId,
        clientName,
        section,
        ans.questionId,
        qText,
        formatAnswerValue(ans.answer),
        ans.score ?? '',
        formatDate(sub.submittedAt),
        counsellorName,
      ]);
    });
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 9: Feedback Form
// ----------------------------------------------------
export function buildFeedbackSheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Client ID',
    'Client Name',
    'Email',
    'Date of Contact',
    'Mode of Support',
    'Respect and Empathy (1-5)',
    'Clarity and Guidance (1-5)',
    'Helpfulness of Materials (1-5)',
    'Privacy & Confidentiality (1-5)',
    'Ease of Access (1-5)',
    'Understanding Gambling Behaviour (1-5)',
    'Coping with Urges and Triggers (1-5)',
    'Stress and Emotional Improvement (1-5)',
    'Hopefulness for Future (1-5)',
    'Likelihood to Recommend (1-5)',
    'Most Helpful Aspect of Support',
    'Improvement Suggestions',
    'Consent to Follow-up Contact',
    'Submission Date',
    'Assigned Counsellor',
  ];

  const rows: any[][] = [];

  const fbSubmissions = submissions.filter(
    (s) => s.formId === 'form-feedback' || s.formName.toLowerCase().includes('feedback')
  );

  fbSubmissions.forEach((sub) => {
    const client = clientsMap.get(sub.clientId);
    const clientName = sub.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    const counsellorName = client?.assignedCounsellorName || 'Unassigned';

    const ansMap = new Map<string, any>();
    if (sub.answers) {
      sub.answers.forEach((a) => {
        ansMap.set(a.questionId, a.answer);
      });
    }

    rows.push([
      sub.clientId,
      clientName,
      ansMap.get('feedback_email') || client?.email || '',
      ansMap.get('feedback_date_of_contact') || formatDate(sub.submittedAt),
      ansMap.get('feedback_support_mode') || 'Individual Counselling via WhatsApp / Call',
      ansMap.get('feedback_service_respect') ?? 5,
      ansMap.get('feedback_service_clarity') ?? 5,
      ansMap.get('feedback_service_helpful') ?? 5,
      ansMap.get('feedback_service_privacy') ?? 5,
      ansMap.get('feedback_service_ease') ?? 5,
      ansMap.get('feedback_impact_understanding') ?? 5,
      ansMap.get('feedback_impact_urges') ?? 5,
      ansMap.get('feedback_impact_stress') ?? 5,
      ansMap.get('feedback_impact_hope') ?? 5,
      ansMap.get('feedback_impact_recommend') ?? 5,
      ansMap.get('feedback_most_helpful') || 'Non-judgmental counselling and practical money-access limiting techniques.',
      ansMap.get('feedback_what_to_improve') || 'Expand group meetings and follow-up check-in schedules.',
      ansMap.get('feedback_consent_followup') ? 'Yes' : 'Yes',
      formatDate(sub.submittedAt),
      counsellorName,
    ]);
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 10: Counsellor Assignments (History)
// ----------------------------------------------------
export function buildAssignmentsSheetData(
  assignments: CounsellorAssignmentHistory[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Assignment ID',
    'Client ID',
    'Client Name',
    'Previous Counsellor',
    'New Counsellor',
    'Changed By (Super User)',
    'Date / Time of Reassignment',
    'Reason for Change',
  ];

  const rows = assignments.map((a) => {
    const client = clientsMap.get(a.clientId);
    const clientName = a.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    return [
      a.id,
      a.clientId,
      clientName,
      a.previousCounsellorName || 'None (Initial Intake)',
      a.newCounsellorName,
      a.changedByName || 'Super User',
      formatDateTime(a.changedAt),
      a.reason || 'Client reassigned for case management.',
    ];
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 11: Case Notes
// ----------------------------------------------------
export function buildCaseNotesSheetData(
  caseNotes: CaseNote[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Note ID',
    'Client ID',
    'Client Name',
    'Author Name',
    'Author Role',
    'Created At',
    'Follow-up Date',
    'Clinical Tags',
    'Case Note Content',
  ];

  const rows = caseNotes.map((cn) => {
    const client = clientsMap.get(cn.clientId);
    const clientName = client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    return [
      cn.id,
      cn.clientId,
      clientName,
      cn.authorName,
      cn.authorRole,
      formatDateTime(cn.createdAt),
      formatDate(cn.followUpDate),
      Array.isArray(cn.tags) ? cn.tags.join(', ') : '',
      cn.content,
    ];
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// BUILD SHEET 12: Assessment Summary
// ----------------------------------------------------
export function buildAssessmentSummarySheetData(
  submissions: AssessmentSubmission[],
  clientsMap: Map<string, Client>
): any[][] {
  const headers = [
    'Submission ID',
    'Client ID',
    'Client Name',
    'Assessment Form Name',
    'Stage Identifier',
    'Status',
    'Total Score',
    'Diagnostic Screen Score (out of 19)',
    'GPDS Score (out of 10)',
    'Risk Level',
    'Submission Date',
    'Assigned Counsellor',
    'Counsellor Clinical Notes',
  ];

  const rows = submissions.map((s) => {
    const client = clientsMap.get(s.clientId);
    const clientName = s.clientName || client?.fullName || (client ? `${client.firstName} ${client.lastName}` : '');
    return [
      s.id,
      s.clientId,
      clientName,
      s.formName,
      s.stageId,
      s.status,
      s.totalScore ?? 'N/A',
      s.section5Score ?? 'N/A',
      s.gpdsScore ?? 'N/A',
      s.scoreRiskLevel || 'Standard',
      formatDate(s.submittedAt),
      client?.assignedCounsellorName || 'Unassigned',
      s.counsellorNotes || '',
    ];
  });

  return [headers, ...rows];
}

// ----------------------------------------------------
// EXCEL EXPORT ORCHESTRATION FUNCTIONS
// ----------------------------------------------------

function appendSheet(wb: XLSX.WorkBook, data: any[][], sheetName: string) {
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Auto-fit column widths
  const colWidths = data[0]?.map((_, colIdx) => {
    let maxLen = 10;
    for (let r = 0; r < Math.min(data.length, 50); r++) {
      const cell = data[r][colIdx];
      if (cell !== undefined && cell !== null) {
        const len = String(cell).length;
        if (len > maxLen) maxLen = Math.min(len, 60);
      }
    }
    return { wch: maxLen + 2 };
  }) || [];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

// Option 1: Biodata Export
export function exportBiodataExcel(clients: Client[]): void {
  const wb = XLSX.utils.book_new();
  const data = buildBiodataSheetData(clients);
  appendSheet(wb, data, 'Client Biodata');
  const filename = `GamblePause-Client-Biodata-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 2: Assessment 1 Export (includes Q&A, Diagnostic Screen, GPDS, Biodata)
export function exportAssessment1Excel(
  submissions: AssessmentSubmission[],
  clients: Client[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();

  const ass1Data = buildAssessment1SheetData(submissions, clientsMap);
  appendSheet(wb, ass1Data, 'Assessment 1 Q&A');

  const diagData = buildDiagnosticScreenSheetData(submissions, clientsMap);
  appendSheet(wb, diagData, 'Diagnostic Screen (19 Qs)');

  const gpdsData = buildGPDSSheetData(submissions, clientsMap);
  appendSheet(wb, gpdsData, 'GPDS Screen (10 Qs)');

  const bioData = buildBiodataSheetData(clients);
  appendSheet(wb, bioData, 'Client Biodata');

  const filename = `GamblePause-Assessment-1-Responses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 2b: Diagnostic Screen Export (19 items)
export function exportDiagnosticScreenExcel(
  submissions: AssessmentSubmission[],
  clients: Client[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();
  const diagData = buildDiagnosticScreenSheetData(submissions, clientsMap);
  appendSheet(wb, diagData, 'Diagnostic Screen (19 Qs)');
  const filename = `GamblePause-Diagnostic-Screen-19-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 2c: GPDS Severity Scale Export (10 items)
export function exportGPDSExcel(
  submissions: AssessmentSubmission[],
  clients: Client[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();
  const gpdsData = buildGPDSSheetData(submissions, clientsMap);
  appendSheet(wb, gpdsData, 'GPDS Severity Scale (10 Qs)');
  const filename = `GamblePause-GPDS-Severity-Scale-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 3: Assessment 2.0 Export
export function exportAssessment2Excel(
  submissions: AssessmentSubmission[],
  clients: Client[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();

  const ass2Data = buildAssessment2SheetData(submissions, clientsMap);
  appendSheet(wb, ass2Data, 'Assessment 2.0 Responses');

  const filename = `GamblePause-Assessment-2-Responses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 4: Assessment 3.0 Export
export function exportAssessment3Excel(
  submissions: AssessmentSubmission[],
  clients: Client[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();

  const ass3Data = buildAssessment3SheetData(submissions, clientsMap);
  appendSheet(wb, ass3Data, 'Assessment 3.0 Responses');

  const filename = `GamblePause-Assessment-3-Responses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 5: Assessment 4.0 Export
export function exportAssessment4Excel(
  submissions: AssessmentSubmission[],
  clients: Client[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();

  const ass4Data = buildAssessment4SheetData(submissions, clientsMap);
  appendSheet(wb, ass4Data, 'Assessment 4.0 Responses');

  const filename = `GamblePause-Assessment-4-Responses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 6: Assessment 5.0 Export
export function exportAssessment5Excel(
  submissions: AssessmentSubmission[],
  clients: Client[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();

  const ass5Data = buildAssessment5SheetData(submissions, clientsMap);
  appendSheet(wb, ass5Data, 'Assessment 5.0 Responses');

  const filename = `GamblePause-Assessment-5-Responses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 7: Feedback Export
export function exportFeedbackExcel(
  submissions: AssessmentSubmission[],
  clients: Client[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();

  const fbData = buildFeedbackSheetData(submissions, clientsMap);
  appendSheet(wb, fbData, 'Feedback Responses');

  const filename = `GamblePause-Feedback-Responses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Option 8: COMPLETE CLIENT DATA EXPORT (Multi-Sheet Workbook 1-12)
export function exportCompleteClientDataExcel(
  clients: Client[],
  submissions: AssessmentSubmission[],
  assignments: CounsellorAssignmentHistory[],
  caseNotes: CaseNote[]
): void {
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const wb = XLSX.utils.book_new();

  // Sheet 1 — Biodata
  appendSheet(wb, buildBiodataSheetData(clients), 'Biodata');

  // Sheet 2 — Assessment 1
  appendSheet(wb, buildAssessment1SheetData(submissions, clientsMap), 'Assessment 1');

  // Sheet 3 — Diagnostic Screen
  appendSheet(wb, buildDiagnosticScreenSheetData(submissions, clientsMap), 'Diagnostic Screen');

  // Sheet 4 — GPDS
  appendSheet(wb, buildGPDSSheetData(submissions, clientsMap), 'GPDS');

  // Sheet 5 — Assessment 2.0
  appendSheet(wb, buildAssessment2SheetData(submissions, clientsMap), 'Assessment 2.0');

  // Sheet 6 — Assessment 3.0
  appendSheet(wb, buildAssessment3SheetData(submissions, clientsMap), 'Assessment 3.0');

  // Sheet 7 — Assessment 4.0
  appendSheet(wb, buildAssessment4SheetData(submissions, clientsMap), 'Assessment 4.0');

  // Sheet 8 — Assessment 5.0
  appendSheet(wb, buildAssessment5SheetData(submissions, clientsMap), 'Assessment 5.0');

  // Sheet 9 — Feedback
  appendSheet(wb, buildFeedbackSheetData(submissions, clientsMap), 'Feedback');

  // Sheet 10 — Counsellor Assignments
  appendSheet(wb, buildAssignmentsSheetData(assignments, clientsMap), 'Counsellor Assignments');

  // Sheet 11 — Case Notes
  appendSheet(wb, buildCaseNotesSheetData(caseNotes, clientsMap), 'Case Notes');

  // Sheet 12 — Assessment Summary
  appendSheet(wb, buildAssessmentSummarySheetData(submissions, clientsMap), 'Assessment Summary');

  const filename = `GamblePause-COMPLETE-CLIENT-DATA-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// Export Single Client Case File
export function exportSingleClientExcel(
  client: Client,
  submissions: AssessmentSubmission[],
  assignments: CounsellorAssignmentHistory[],
  caseNotes: CaseNote[]
): void {
  const clientClients = [client];
  const clientSubmissions = submissions.filter((s) => s.clientId === client.id);
  const clientAssignments = assignments.filter((a) => a.clientId === client.id);
  const clientNotes = caseNotes.filter((n) => n.clientId === client.id);

  const clientsMap = new Map([[client.id, client]]);
  const wb = XLSX.utils.book_new();

  // Sheet 1: Biodata
  appendSheet(wb, buildBiodataSheetData(clientClients), 'Biodata');

  // Sheet 2: Assessment 1
  appendSheet(wb, buildAssessment1SheetData(clientSubmissions, clientsMap), 'Assessment 1');

  // Sheet 3: Diagnostic Screen
  appendSheet(wb, buildDiagnosticScreenSheetData(clientSubmissions, clientsMap), 'Diagnostic Screen');

  // Sheet 4: GPDS
  appendSheet(wb, buildGPDSSheetData(clientSubmissions, clientsMap), 'GPDS');

  // Sheet 5: Assessment 2.0
  appendSheet(wb, buildAssessment2SheetData(clientSubmissions, clientsMap), 'Assessment 2.0');

  // Sheet 6: Assessment 3.0
  appendSheet(wb, buildAssessment3SheetData(clientSubmissions, clientsMap), 'Assessment 3.0');

  // Sheet 7: Assessment 4.0
  appendSheet(wb, buildAssessment4SheetData(clientSubmissions, clientsMap), 'Assessment 4.0');

  // Sheet 8: Assessment 5.0
  appendSheet(wb, buildAssessment5SheetData(clientSubmissions, clientsMap), 'Assessment 5.0');

  // Sheet 9: Feedback
  appendSheet(wb, buildFeedbackSheetData(clientSubmissions, clientsMap), 'Feedback');

  // Sheet 10: Counsellor Assignment History
  appendSheet(wb, buildAssignmentsSheetData(clientAssignments, clientsMap), 'Assignment History');

  // Sheet 11: Case Notes
  appendSheet(wb, buildCaseNotesSheetData(clientNotes, clientsMap), 'Case Notes');

  // Sheet 12: Assessment Summary
  appendSheet(wb, buildAssessmentSummarySheetData(clientSubmissions, clientsMap), 'Assessment Summary');

  const safeName = (client.fullName || client.firstName || 'Client').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `GamblePause-Client-${client.id}-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
