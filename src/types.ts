export type ClientStatus =
  | 'Active'
  | 'Awaiting Assessment'
  | 'Assessment Due'
  | 'Overdue'
  | 'Completed'
  | 'Closed'
  | 'Referred';

export type UserRole = 'Super Admin' | 'Counsellor' | 'Staff' | 'Analyst / Viewer';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  whatsappNumber?: string; // Direct counsellor WhatsApp line
  assignedClientsCount: number;
  active: boolean;
  status?: 'Active' | 'Inactive' | 'Archived' | 'Deactivated';
  authUid?: string;
}

export interface Client {
  id: string; // e.g., 'GP-0001'
  fullName?: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  age: number;
  lengthOfGamblingProblem?: string; // e.g., 'Less than 6 months', '1 - 2 years', '3 - 5 years', 'Over 5 years'
  gender: 'Male' | 'Female' | 'Prefer not to say' | 'Other';
  phone: string;
  email: string;
  address?: string;
  state: string; // Nigerian state, e.g., 'Lagos', 'FCT - Abuja', 'Rivers', etc.
  location: string; // LGA or city area, e.g., 'Ikeja', 'Garki'
  country?: string; // Default: 'Nigeria'
  occupation: string;
  maritalStatus?: 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Separated' | 'Other' | string;
  howHeard?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  consentGiven: boolean;
  registrationDate: string; // ISO date string
  createdAt?: string; // Authoritative client creation timestamp
  registeredAt?: string; // Alternative registration timestamp alias
  created_at?: string;
  status: ClientStatus;
  currentStageId: string;
  currentStageName: string;
  currentAssessment?: string;
  nextAssessmentId?: string;
  nextAssessmentName?: string;
  nextAssessmentDueDate?: string; // ISO date string
  lastAssessmentName?: string;
  lastAssessmentDate?: string;
  assignedCounsellorId?: string;
  assignedCounsellorName?: string;
  lastActivityDate: string;
  totalAssessmentsCompleted: number;
  totalAssessmentsOverdue: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  result?: string; // ADMIN-ONLY field: Clinical evaluation / score summary
  secureAccessKey: string; // Unguessable client assessment token
  authUid?: string; // Firebase Authentication UID
  isDemo?: boolean; // Clearly marks DEMO DATA
}

export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'number'
  | 'date'
  | 'single_choice'
  | 'multiple_choice'
  | 'yes_no'
  | 'rating_scale'
  | 'dropdown'
  | 'radio'
  | 'textarea'
  | 'text'
  | 'scale'
  | 'select';

export interface QuestionOption {
  label: string;
  value: string;
  score?: number;
}

export interface QuestionDefinition {
  id: string;
  text: string;
  subtext?: string;
  type: QuestionType;
  required: boolean;
  options?: QuestionOption[];
  minRating?: number;
  maxRating?: number;
  ratingLabels?: { low?: string; high?: string };
  weight?: number;
  placeholder?: string;
}

export interface ScoringRange {
  label: 'Low' | 'Medium' | 'High' | 'Severe';
  minScore: number;
  maxScore: number;
  flagColor: string; // e.g., 'emerald', 'amber', 'rose'
  interpretation: string;
  suggestedAction: string;
}

export interface FormDefinition {
  id: string;
  name: string;
  code: string; // e.g., 'biodata', 'initial_assessment', 'follow_up_1'
  description: string;
  active: boolean;
  isActive?: boolean;
  version?: number;
  instructions?: string;
  order: number;
  waitingDaysAfterCompletion: number; // e.g., 7 days
  nextFormId?: string;
  questions: QuestionDefinition[];
  enableScoring: boolean;
  maxPossibleScore?: number;
  scoringRanges?: ScoringRange[];
}

export type AssessmentAccessMode = 'scheduled' | 'testing';

export interface AppSettings {
  assessmentAccessMode: AssessmentAccessMode;
  updatedAt?: string;
  updatedBy?: string;
}

export interface WorkflowStage {
  id: string;
  formId: string;
  stageName: string;
  order: number;
  delayDaysFromPrevious: number;
  isInitialRegistration?: boolean;
  description: string;
  isActive?: boolean;
  isLegacy?: boolean;
}

export interface AssessmentAnswer {
  questionId: string;
  questionText: string;
  questionType?: QuestionType;
  answer: string | number | string[] | boolean | any;
  score?: number | null;
}

export interface AssessmentSubmission {
  id: string;
  clientId: string;
  clientName: string;
  formId: string;
  formName: string;
  stageId: string;
  submittedAt: string; // ISO date
  answers: AssessmentAnswer[];
  totalScore?: number;
  section5Score?: number;
  gpdsScore?: number;
  scoreRiskLevel?: 'Low' | 'Medium' | 'High' | 'Severe';
  status: 'Completed' | 'Under Review' | 'Flagged';
  counsellorNotes?: string;
  version?: number; // Schema version of form at submission time
  isDemo?: boolean;
}

export interface CaseNote {
  id: string;
  clientId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  content: string;
  followUpDate?: string;
  tags?: string[];
}

export interface NotificationLog {
  id: string;
  clientId: string;
  clientName: string;
  channel: 'Email' | 'SMS' | 'WhatsApp' | 'Dashboard' | string;
  recipient?: string;
  recipientTarget?: string;
  recipientUserId?: string;
  counsellorId?: string;
  counsellorName?: string;
  title?: string;
  isRead?: boolean;
  subject?: string;
  messageBody: string;
  triggerType: 'Assessment Ready' | 'Reminder 24h' | 'Reminder 3d' | 'Overdue Alert' | 'Welcome' | 'Assessment Due' | string;
  status: 'Sent' | 'Pending' | 'Queued' | 'Failed' | 'Not configured' | 'Simulated';
  scheduledFor: string;
  sentAt?: string;
  emailStatus?: 'pending' | 'sent' | 'failed';
  emailSentAt?: string;
  emailMessageId?: string;
  emailLastError?: string;
}

export type NotificationItem = NotificationLog;

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  targetType: 'Client' | 'Assessment' | 'Form' | 'Workflow' | 'CaseNote' | 'System' | 'Staff';
  targetId: string;
  details: string;
}

export interface CounsellorAssignmentHistory {
  id: string;
  clientId: string;
  clientName: string;
  previousCounsellorId?: string;
  previousCounsellorName?: string;
  newCounsellorId: string;
  newCounsellorName: string;
  changedById: string;
  changedByName: string; // e.g. "Abiodun.Ayodeji" or "Ladipo.Abiose"
  changedAt: string; // ISO date string or formatted date
  reason?: string;
}
