import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  User,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MessageSquare,
  Send,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  Activity,
  Award,
  TrendingUp,
  Download,
  History,
  X,
  UserCheck,
} from 'lucide-react';
import { Client, ClientStatus, StaffUser, AssessmentSubmission, CaseNote, CounsellorAssignmentHistory } from '../../types';
import { dataService } from '../../services/dataService';
import { NotificationService } from '../../services/notificationService';
import { exportSingleClientExcel } from '../../services/exportService';

interface ClientProfileProps {
  client: Client;
  currentUser: StaffUser;
  onBack: () => void;
  onOpenAssessmentAsClient?: (client: Client) => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({
  client: initialClient,
  currentUser,
  onBack,
  onOpenAssessmentAsClient,
}) => {
  const [client, setClient] = useState<Client>(initialClient);
  const [selectedTab, setSelectedTab] = useState<'timeline' | 'submissions' | 'notes' | 'notifications' | 'assignments'>('timeline');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteFollowUp, setNewNoteFollowUp] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('Check-in');
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<AssessmentSubmission | null>(null);

  // Counsellor Change Modal State
  const [isChangeCounsellorOpen, setIsChangeCounsellorOpen] = useState(false);
  const [selectedNewCounsellorId, setSelectedNewCounsellorId] = useState('');
  const [reassignmentReason, setReassignmentReason] = useState('');
  const [reassignmentError, setReassignmentError] = useState<string | null>(null);
  const [reassignmentSuccess, setReassignmentSuccess] = useState<string | null>(null);

  // Super User verification
  const isSuperUser = currentUser && (
    currentUser.role === 'Super Admin' ||
    ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org'].includes(currentUser.email.toLowerCase())
  );

  // Synchronize client state with dataService
  useEffect(() => {
    const updated = dataService.getClientById(initialClient.id);
    if (updated) {
      setClient(updated);
    }
  }, [initialClient.id]);

  useEffect(() => {
    const unsub = dataService.subscribe(() => {
      const updated = dataService.getClientById(initialClient.id);
      if (updated) {
        setClient(updated);
      }
    });
    return unsub;
  }, [initialClient.id]);

  const staff = dataService.getStaff();
  const counsellors = staff.filter((s) => s.role === 'Counsellor' && s.active !== false);
  const workflows = dataService.getWorkflows();
  const submissions = dataService.getSubmissionsByClientId(client.id);
  const caseNotes = dataService.getCaseNotes(client.id);
  const notifications = dataService.getNotifications().filter((n) => n.clientId === client.id);
  const assignmentHistory = dataService.getCounsellorAssignments(client.id);

  // Status update
  const handleStatusChange = (newStatus: ClientStatus) => {
    dataService.updateClientStatus(client.id, newStatus, `Manual status update by ${currentUser.name}`);
  };

  // Open Reassignment Modal
  const handleOpenChangeCounsellorModal = () => {
    setSelectedNewCounsellorId(client.assignedCounsellorId || '');
    setReassignmentReason('');
    setReassignmentError(null);
    setIsChangeCounsellorOpen(true);
  };

  // Execute Reassignment with Super User verification and audit logging
  const handleExecuteChangeCounsellor = () => {
    if (!selectedNewCounsellorId) {
      setReassignmentError('Please select a new counsellor from the list.');
      return;
    }
    if (selectedNewCounsellorId === client.assignedCounsellorId) {
      setReassignmentError('Client is already assigned to this counsellor. Please select a different counsellor.');
      return;
    }

    const res = dataService.assignCounsellor(
      client.id,
      selectedNewCounsellorId,
      reassignmentReason.trim() || undefined
    );

    if (!res.success) {
      setReassignmentError(res.error || 'Failed to reassign counsellor.');
      return;
    }

    const updated = dataService.getClientById(client.id);
    if (updated) {
      setClient(updated);
    }

    setIsChangeCounsellorOpen(false);
    setReassignmentSuccess(`Client successfully reassigned to ${updated?.assignedCounsellorName || 'new counsellor'}!`);
    setTimeout(() => setReassignmentSuccess(null), 4500);
  };

  // Add Case Note
  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    dataService.addCaseNote(
      client.id,
      newNoteContent.trim(),
      newNoteFollowUp ? newNoteFollowUp : undefined,
      [newNoteTag]
    );

    setNewNoteContent('');
    setNewNoteFollowUp('');
  };

  // Copy personal assessment link
  const handleCopyAssessmentLink = () => {
    const link = `${window.location.origin}/a/${client.secureAccessKey}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Manual Trigger Reminder
  const handleSendReminderNow = () => {
    const form = dataService.getFormById(client.nextAssessmentId || '');
    if (form) {
      NotificationService.sendAssessmentReminder(client, form, client.status === 'Overdue' ? 'overdue' : 'ready');
      alert(`Automated reminder notification queued and sent to ${client.firstName}'s email and phone!`);
    } else {
      alert('Client has completed all assessments.');
    }
  };

  // Export Single Client Excel Workbook
  const handleExportClientExcel = () => {
    exportSingleClientExcel(client, submissions, assignmentHistory, caseNotes);
  };

  // Calculate days engaged
  const daysEngaged = Math.max(
    1,
    Math.round(
      (new Date().getTime() - new Date(client.registrationDate).getTime()) / (1000 * 3600 * 24)
    )
  );

  // Scored submissions for progression chart
  const scoredSubmissions = submissions.filter((s) => typeof s.totalScore === 'number');

  return (
    <div className="space-y-6">
      {/* Toast notification for successful counsellor reassignment */}
      {reassignmentSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold">{reassignmentSuccess}</span>
          </div>
          <button
            onClick={() => setReassignmentSuccess(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Back button & top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Client Registry</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Client Workbook (.xlsx) */}
          <button
            type="button"
            id="export-client-xlsx-btn"
            onClick={handleExportClientExcel}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            title="Download complete clinical case file workbook (.xlsx) including all answers and notes"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Export Case File (.xlsx)</span>
          </button>

          <button
            onClick={handleCopyAssessmentLink}
            id="copy-client-link-btn"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-800 bg-white hover:bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            title="Copy unique link to send to client via SMS or WhatsApp"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Client Link'}</span>
          </button>

          <button
            onClick={() => onOpenAssessmentAsClient?.(client)}
            id="test-client-assessment-btn"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-xl transition-all shadow-sm cursor-pointer"
            title="Simulate opening the secure link as this client"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Client Assessment</span>
          </button>
        </div>
      </div>

      {/* Main Client Profile Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-100">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-white flex items-center justify-center font-black text-xl shadow-md shrink-0">
              {client.id.replace('GP-', '')}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-black text-gray-950">
                  {client.firstName} {client.lastName}
                </h1>
                {client.preferredName && (
                  <span className="text-xs font-semibold text-gray-500">
                    ("{client.preferredName}")
                  </span>
                )}
                <span className="text-xs font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                  {client.id}
                </span>
                {client.isDemo && (
                  <span className="text-[10px] font-extrabold uppercase tracking-wider bg-red-50 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                    DEMO DATA
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500 mt-1.5">
                <span>{client.age} years old</span>
                <span>•</span>
                <span>{client.gender}</span>
                <span>•</span>
                <span>{client.occupation}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-500" />
                  {client.location}, {client.state}
                </span>
              </div>
            </div>
          </div>

          {/* Client Status Switcher */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Client Status</label>
            <select
              value={client.status}
              onChange={(e) => handleStatusChange(e.target.value as ClientStatus)}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
            >
              <option value="Active">Active</option>
              <option value="Assessment Due">Assessment Due</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
              <option value="Awaiting Assessment">Awaiting Assessment</option>
              <option value="Closed">Closed</option>
              <option value="Referred">Referred</option>
            </select>
          </div>
        </div>

        {/* FEATURE 1: Clearly Visible Assigned Counsellor Section */}
        <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                Assigned Counsellor
              </span>
              <div className="text-xs text-gray-600">
                <span className="text-gray-500 font-medium">Client ID: </span>
                <span className="font-bold text-gray-900 font-mono mr-3">{client.id}</span>
                <span className="text-gray-500 font-medium">Client Name: </span>
                <span className="font-bold text-gray-900 mr-3">{client.firstName} {client.lastName}</span>
                <span className="text-gray-500 font-medium">Current Counsellor: </span>
                <span className="font-black text-red-600 text-sm">
                  {client.assignedCounsellorName || 'None (Unassigned)'}
                </span>
              </div>
            </div>

            {/* Change Counsellor button restricted strictly to Super Users */}
            {isSuperUser ? (
              <button
                type="button"
                id="btn-change-counsellor"
                onClick={handleOpenChangeCounsellorModal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0"
              >
                <UserCheck className="w-4 h-4" />
                <span>Change Counsellor</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-400 text-[11px] font-medium shrink-0">
                <Shield className="w-3.5 h-3.5 text-gray-400" />
                <span>Reassignment restricted to Super Users</span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Summary Metric Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-[11px] font-medium text-gray-500 block">Current Stage</span>
            <span className="text-sm font-bold text-gray-950 mt-1 block truncate">
              {client.currentStageName}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-[11px] font-medium text-gray-500 block">Next Assessment</span>
            <span className="text-sm font-bold text-gray-950 mt-1 block truncate">
              {client.nextAssessmentName || 'All Finished'}
            </span>
            {client.nextAssessmentDueDate && (
              <span className="text-[10px] text-red-600 font-semibold mt-0.5 block">
                Due {new Date(client.nextAssessmentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-[11px] font-medium text-gray-500 block">Days Engaged</span>
            <span className="text-sm font-bold text-gray-950 mt-1 block">
              {daysEngaged} days
            </span>
            <span className="text-[10px] text-gray-400">
              Registered {new Date(client.registrationDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-[11px] font-medium text-gray-500 block">Harm Risk Indication</span>
            <span
              className={`text-sm font-bold mt-1 inline-flex items-center gap-1 ${
                client.riskLevel === 'High'
                  ? 'text-red-600'
                  : client.riskLevel === 'Medium'
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              {client.riskLevel || 'Under Review'}
            </span>
            <span className="text-[10px] text-gray-400 block">Decision-support tool</span>
          </div>
        </div>

        {/* Contact Info Chips */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-gray-600">
            <span className="flex items-center gap-1.5 font-medium">
              <Phone className="w-3.5 h-3.5 text-red-600" />
              <a href={`tel:${client.phone}`} className="hover:underline text-gray-900">
                {client.phone}
              </a>
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <Mail className="w-3.5 h-3.5 text-red-600" />
              <a href={`mailto:${client.email}`} className="hover:underline text-gray-900">
                {client.email}
              </a>
            </span>
            {client.emergencyContactName && (
              <span className="text-gray-500">
                Emergency: {client.emergencyContactName} ({client.emergencyContactRelationship || 'Contact'}) - {client.emergencyContactPhone || 'N/A'}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSendReminderNow}
            className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
          >
            Send Manual Reminder Now
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-gray-200 text-xs font-bold overflow-x-auto">
        {[
          { id: 'timeline', label: 'Follow-up Timeline & Progress' },
          { id: 'submissions', label: `Assessment History (${submissions.length})` },
          { id: 'notes', label: `Case Notes (${caseNotes.length})` },
          { id: 'notifications', label: `Automated Communications (${notifications.length})` },
          { id: 'assignments', label: `Counsellor History (${assignmentHistory.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`pb-3 px-3 transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
              selectedTab === tab.id
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Follow-up Timeline & Score Progress */}
      {selectedTab === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Visual Milestone Timeline */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm lg:col-span-2 space-y-6">
            <div>
              <h2 className="text-base font-bold text-gray-900">Configured Recovery Pathway</h2>
              <p className="text-xs text-gray-500">
                Client milestone trajectory based on configured assessment delay intervals.
              </p>
            </div>

            <div className="relative pl-6 sm:pl-8 border-l-2 border-gray-200 space-y-8 my-4 ml-3">
              {/* Step 0: Registration */}
              <div className="relative">
                <div className="absolute -left-[33px] sm:-left-[41px] top-0 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    Completed
                  </span>
                  <h3 className="text-sm font-bold text-gray-950 mt-1">Client Registration / Biodata</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Registered on {new Date(client.registrationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Assessment Stages */}
              {workflows.filter((w) => !w.isInitialRegistration).map((stage, idx) => {
                const isCompleted = client.totalAssessmentsCompleted > idx;
                const isCurrent = stage.id === client.currentStageId;
                const submission = submissions.find((s) => s.stageId === stage.id || s.formId === stage.formId);

                return (
                  <div key={stage.id} className="relative">
                    <div
                      className={`absolute -left-[33px] sm:-left-[41px] top-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                        isCompleted
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? client.status === 'Overdue'
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-400 border border-gray-300'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700'
                              : isCurrent
                              ? client.status === 'Overdue'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {isCompleted
                            ? 'Completed'
                            : isCurrent
                            ? client.status === 'Overdue'
                              ? 'Overdue!'
                              : 'In Progress / Due'
                            : `Upcoming (Wait ${stage.delayDaysFromPrevious}d)`}
                        </span>

                        {submission?.totalScore !== undefined && (
                          <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            Score: {submission.totalScore} ({submission.scoreRiskLevel} Risk)
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-gray-950">{stage.stageName}</h3>
                      <p className="text-xs text-gray-500">{stage.description}</p>

                      {submission && (
                        <p className="text-[11px] text-emerald-700 font-medium">
                          Submitted on {new Date(submission.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}

                      {isCurrent && client.nextAssessmentDueDate && (
                        <p className="text-[11px] text-red-600 font-medium">
                          Target Due Date: {new Date(client.nextAssessmentDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Chart / Decision Support View */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Harm Reduction Trajectory</h2>
              <p className="text-xs text-gray-500">
                Tracking change in assessment scores over time (Lower = Reduced Harm).
              </p>

              {scoredSubmissions.length >= 2 ? (
                <div className="my-6 space-y-3">
                  {scoredSubmissions.map((sub, i) => (
                    <div key={sub.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-gray-800">{sub.formName}</span>
                        <span className="font-bold text-gray-950">
                          {sub.totalScore} pts ({sub.scoreRiskLevel})
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            sub.scoreRiskLevel === 'High'
                              ? 'bg-red-600'
                              : sub.scoreRiskLevel === 'Medium'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, ((sub.totalScore || 0) / 24) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 mt-4">
                    <p className="font-bold flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Positive Harm Reduction Detected
                    </p>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      Client shows a measurable drop in gambling urge intensity and distress indicators since intake.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-500 space-y-2">
                  <Activity className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="font-medium text-gray-700">Trajectory Chart Pending</p>
                  <p className="text-[11px]">
                    Requires at least 2 completed scored assessments to chart harm-reduction over time.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200/80 text-[11px] text-gray-500 leading-relaxed">
              <strong className="text-gray-800 font-bold block mb-1">Clinical Note & Decision Support:</strong>
              Automated assessment scores are designed strictly as decision-support indicators and must not replace
              direct clinical evaluation or counsellor judgment.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Assessment History & Answer Inspection */}
      {selectedTab === 'submissions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Submitted Assessments</h2>
              <p className="text-xs text-gray-500">
                Click "View Submitted Answers" to inspect the questions and raw client responses.
              </p>
            </div>

            {submissions.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-500">
                No assessments submitted yet. The client is currently at {client.currentStageName}.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {submissions.map((sub) => (
                  <div key={sub.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-gray-950">{sub.formName}</h3>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {sub.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                        <span>
                          Completed: {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {sub.section5Score !== undefined && (
                          <span className="font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                            Section 5: {sub.section5Score}/19
                          </span>
                        )}
                        {sub.gpdsScore !== undefined && (
                          <span className="font-bold text-gray-800 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                            GPDS: {sub.gpdsScore}/10
                          </span>
                        )}
                        {sub.totalScore !== undefined && sub.section5Score === undefined && (
                          <span className="font-bold text-gray-800">
                            Score: {sub.totalScore} pts ({sub.scoreRiskLevel} Risk)
                          </span>
                        )}
                      </div>

                      {sub.counsellorNotes && (
                        <p className="text-xs text-gray-700 italic mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                          "{sub.counsellorNotes}"
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedSubmission(sub)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/70 border border-red-200 px-3.5 py-2 rounded-xl transition-all cursor-pointer self-start sm:self-center"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Submitted Answers</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Answer inspection modal / expandable card */}
          {selectedSubmission && (
            <div className="bg-white rounded-2xl p-6 border-2 border-red-500/30 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-950">
                    Submission Details: {selectedSubmission.formName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Completed by {selectedSubmission.clientName} on {new Date(selectedSubmission.submittedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg"
                >
                  Close Inspection
                </button>
              </div>

              {selectedSubmission.answers.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Detailed question responses were recorded in the archive.</p>
              ) : (
                <div className="space-y-4">
                  {selectedSubmission.answers.map((ans, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/70 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold text-gray-800">
                          {idx + 1}. {ans.questionText}
                        </span>
                        {ans.score !== undefined && (
                          <span className="font-mono text-[11px] font-bold text-red-600">
                            Score: +{ans.score}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-950 mt-1">
                        {Array.isArray(ans.answer) ? ans.answer.join(', ') : String(ans.answer)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Confidential Case Notes */}
      {selectedTab === 'notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Note Form */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4 h-fit">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-red-600" />
              <span>Log Confidential Note</span>
            </h2>
            <p className="text-xs text-gray-500">
              Only authorized GamblePause counsellors and admins can view these records.
            </p>

            <form onSubmit={handleAddNote} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Tag / Activity</label>
                <select
                  value={newNoteTag}
                  onChange={(e) => setNewNoteTag(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="Phone Call">Phone Call Check-in</option>
                  <option value="WhatsApp Consultation">WhatsApp Consultation</option>
                  <option value="Trigger Management">Trigger Management Session</option>
                  <option value="Relapse Support">Urgent Relapse Support</option>
                  <option value="Caseload Review">Caseload Review</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Case Observations</label>
                <textarea
                  rows={4}
                  required
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Record summary of conversation, client triggers, coping commitments..."
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Next Follow-up Date</label>
                <input
                  type="date"
                  value={newNoteFollowUp}
                  onChange={(e) => setNewNoteFollowUp(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save Case Note</span>
              </button>
            </form>
          </div>

          {/* Notes Log */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm lg:col-span-2 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Historical Case Notes</h2>

            {caseNotes.length === 0 ? (
              <p className="text-xs text-gray-500 italic py-8 text-center">
                No case notes entered yet. Use the form on the left to document clinical touchpoints.
              </p>
            ) : (
              <div className="space-y-4">
                {caseNotes.map((note) => (
                  <div key={note.id} className="p-4 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-950">{note.authorName}</span>
                        <span className="text-[10px] bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200">
                          {note.authorRole}
                        </span>
                      </div>

                      <span className="text-[11px] text-gray-400">
                        {new Date(note.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200/60 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {note.tags?.map((t) => (
                          <span key={t} className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-medium text-[10px]">
                            {t}
                          </span>
                        ))}
                      </div>

                      {note.followUpDate && (
                        <span className="text-red-600 font-semibold flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Follow-up: {note.followUpDate}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Automated Communications Queue & Logs */}
      {selectedTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Automated Notification Logs</h2>
              <p className="text-xs text-gray-500">Email, SMS, and WhatsApp alerts triggered for this client.</p>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No notifications triggered for this client yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 text-xs">
              {notifications.map((n) => (
                <div key={n.id} className="p-4 space-y-1.5 hover:bg-gray-50/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{n.channel} Alert</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          n.status === 'Sent'
                            ? 'bg-emerald-100 text-emerald-800'
                            : n.status === 'Simulated'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {n.status}
                      </span>
                    </div>

                    <span className="text-[11px] text-gray-400">
                      {new Date(n.scheduledFor).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-gray-800">{n.subject || n.triggerType}</p>
                  <p className="text-[11px] text-gray-500 font-mono whitespace-pre-wrap bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    {n.messageBody}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Counsellor Assignment History */}
      {selectedTab === 'assignments' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-6">
          <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-gray-950 flex items-center gap-2">
                <History className="w-5 h-5 text-red-600" />
                <span>Counsellor Assignment & Transfer History</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Permanent chronological record of all clinical counsellor assignments, reallocations, and rationale.
              </p>
            </div>
            {isSuperUser && (
              <button
                type="button"
                onClick={handleOpenChangeCounsellorModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer self-start sm:self-center"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Change Counsellor</span>
              </button>
            )}
          </div>

          {assignmentHistory.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              No previous counsellor transfers recorded for this client. Currently assigned to {client.assignedCounsellorName || 'Unassigned'}.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {assignmentHistory.map((item) => (
                <div key={item.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg">
                        {item.previousCounsellorName || 'Initial Intake'}
                      </span>
                      <span className="text-gray-400 font-bold">→</span>
                      <span className="text-xs font-extrabold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                        {item.newCounsellorName}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">
                      {new Date(item.changedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                    <span>
                      <strong className="text-gray-800">Authorized by:</strong> {item.changedByName}
                    </span>
                    {item.reason && (
                      <span className="italic text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                        "{item.reason}"
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FEATURE 1: Working Modal for Changing Counsellor */}
      {isChangeCounsellorOpen && (
        <div
          id="modal-change-counsellor"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-gray-950 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-red-600" />
                  <span>Change Counsellor</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Update client case file assignment in Firestore with audit logging.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsChangeCounsellorOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reassignmentError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{reassignmentError}</span>
              </div>
            )}

            {/* Current Client & Counsellor Info */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Client ID:</span>
                <span className="font-bold text-gray-950 font-mono">{client.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Client Name:</span>
                <span className="font-bold text-gray-950">{client.firstName} {client.lastName}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200/60 pt-2 mt-1">
                <span className="text-gray-500 font-medium">Current Counsellor:</span>
                <span className="font-black text-red-600 text-sm">
                  {client.assignedCounsellorName || 'None (Unassigned)'}
                </span>
              </div>
            </div>

            {/* Selection Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  New Counsellor: <span className="text-red-600">*</span>
                </label>
                <select
                  id="select-new-counsellor"
                  value={selectedNewCounsellorId}
                  onChange={(e) => {
                    setSelectedNewCounsellorId(e.target.value);
                    setReassignmentError(null);
                  }}
                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                >
                  <option value="">[ Select Counsellor ▼ ]</option>
                  {counsellors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.id === client.assignedCounsellorId ? '(Current)' : ''}
                    </option>
                  ))}
                </select>

                {/* Available counsellors list per user prompt specification */}
                <div className="mt-3 p-3 bg-gray-50/80 rounded-xl border border-gray-100 text-xs">
                  <span className="font-bold text-gray-700 block mb-1">Available counsellors:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-gray-600">
                    {counsellors.map((c) => (
                      <li key={c.id} className={c.id === client.assignedCounsellorId ? 'font-bold text-red-600' : ''}>
                        {c.name} {c.id === client.assignedCounsellorId ? '(Currently assigned)' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1.5">
                  Reason for Change: <span className="text-gray-400 font-normal">(Optional text field)</span>
                </label>
                <textarea
                  id="reassignment-reason-input"
                  rows={3}
                  value={reassignmentReason}
                  onChange={(e) => setReassignmentReason(e.target.value)}
                  placeholder="e.g., Client requested female counsellor for family counselling, or clinical workload rebalancing."
                  className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs text-gray-850 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                id="btn-cancel-reassignment"
                onClick={() => setIsChangeCounsellorOpen(false)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-change-counsellor"
                disabled={!selectedNewCounsellorId || selectedNewCounsellorId === client.assignedCounsellorId}
                onClick={handleExecuteChangeCounsellor}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Change Counsellor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
