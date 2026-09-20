import React, { useState, useEffect } from 'react';
import {
  Users,
  LayoutDashboard,
  Clock,
  AlertCircle,
  FileText,
  LogOut,
  Search,
  CheckCircle2,
  Phone,
  Mail,
  Shield,
  Save,
  AlertTriangle,
  Copy,
  Check,
  Bell,
  ExternalLink,
  MessageSquare,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Client, CaseNote, AssessmentSubmission, FormDefinition, NotificationLog } from '../../types';
import { dataService } from '../../services/dataService';
import { AuthUser } from '../../services/authService';

interface CounsellorPortalProps {
  user: AuthUser;
  onLogout: () => void;
}

export const CounsellorPortal: React.FC<CounsellorPortalProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'upcoming' | 'overdue' | 'notifications'>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSubmissions, setClientSubmissions] = useState<AssessmentSubmission[]>([]);
  const [clientCaseNotes, setClientCaseNotes] = useState<CaseNote[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedClientId, setCopiedClientId] = useState<string | null>(null);

  // Case note draft
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('Clinical Check-in');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Security test lookup
  const [manualLookupId, setManualLookupId] = useState('');
  const [manualLookupError, setManualLookupError] = useState<string | null>(null);

  const loadData = () => {
    // getClients() automatically filters strictly to assigned counsellor when called by counsellor
    const myClients = dataService.getClients();
    setClients(myClients);
    const notifs = dataService.getCounsellorNotifications(user.id, user.name);
    setNotifications(notifs);
  };

  useEffect(() => {
    loadData();
    const unsub = dataService.subscribe(loadData);
    return unsub;
  }, [user.id, user.name]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleSelectClient = (c: Client) => {
    const verified = dataService.getClientById(c.id);
    if (!verified) {
      alert('ACCESS DENIED: You are not authorized to view this client.');
      return;
    }
    setSelectedClient(verified);
    setClientSubmissions(dataService.getSubmissionsByClientId(verified.id));
    setClientCaseNotes(dataService.getCaseNotes(verified.id));
    setNewNoteContent('');
    setNewFollowUpDate('');
    setNoteSuccess(false);
  };

  const handleCopyLink = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const origin = window.location.origin;
    const link = `${origin}/a/${client.secureAccessKey}`;
    navigator.clipboard.writeText(link);
    setCopiedClientId(client.id);
    setTimeout(() => setCopiedClientId(null), 3000);
  };

  const handleManualLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setManualLookupError(null);
    if (!manualLookupId.trim()) return;

    const searchedId = manualLookupId.trim().toUpperCase();
    const res = dataService.getClientById(searchedId);
    if (!res) {
      setManualLookupError(
        `ACCESS DENIED: Client "${searchedId}" was not found or is not assigned to your caseload.`
      );
      return;
    }
    handleSelectClient(res);
  };

  const handleAddCaseNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !newNoteContent.trim()) return;

    setIsSavingNote(true);
    try {
      dataService.addCaseNote(
        selectedClient.id,
        newNoteContent.trim(),
        newFollowUpDate || undefined,
        [newNoteTag]
      );
      setClientCaseNotes(dataService.getCaseNotes(selectedClient.id));
      setNewNoteContent('');
      setNewFollowUpDate('');
      setNoteSuccess(true);
      setTimeout(() => setNoteSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save case note');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    dataService.markNotificationAsRead(id);
    setNotifications(dataService.getCounsellorNotifications(user.id, user.name));
  };

  // Metrics isolated strictly for this counsellor's caseload
  const totalCaseload = clients.length;
  const activeClients = clients.filter((c) => c.status === 'Active').length;
  const dueToday = clients.filter((c) => {
    if (!c.nextAssessmentDueDate || c.status === 'Completed' || c.status === 'Closed') return false;
    const d = new Date(c.nextAssessmentDueDate);
    return d.toDateString() === new Date().toDateString() || c.status === 'Assessment Due';
  });
  const overdueClients = clients.filter((c) => {
    if (c.status === 'Overdue') return true;
    if (!c.nextAssessmentDueDate || c.status === 'Completed' || c.status === 'Closed') return false;
    return new Date(c.nextAssessmentDueDate).getTime() < new Date().getTime();
  });

  const filteredClients = clients.filter(
    (c) =>
      c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between font-sans">
      {/* Counsellor Portal Header with GamblePause Red & White Identity */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-30 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              GP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-gray-950 tracking-tight">
                  GAMBLE<span className="text-red-600">PAUSE</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-200">
                  Counsellor Portal
                </span>
              </div>
              <div className="text-xs text-gray-600 font-medium flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-gray-900">{user.name}</span>
                <span className="text-gray-400">&bull;</span>
                <span className="text-red-600 font-semibold">Caseload: {totalCaseload} clients</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications quick button */}
            <button
              onClick={() => {
                setActiveTab('notifications');
                setSelectedClient(null);
              }}
              className={`relative p-2 rounded-xl border transition-colors cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
              title="View Dashboard Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-red-50 text-gray-700 hover:text-red-700 border border-gray-200 hover:border-red-300 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto mt-3 flex items-center gap-1.5 overflow-x-auto border-t border-gray-100 pt-2 text-xs font-bold">
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedClient(null);
            }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'dashboard' && !selectedClient
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('clients');
              setSelectedClient(null);
            }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'clients' && !selectedClient
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>My Clients ({totalCaseload})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('upcoming');
              setSelectedClient(null);
            }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'upcoming' && !selectedClient
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Upcoming Due ({dueToday.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('overdue');
              setSelectedClient(null);
            }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'overdue' && !selectedClient
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Overdue ({overdueClients.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('notifications');
              setSelectedClient(null);
            }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-2 cursor-pointer relative ${
              activeTab === 'notifications' && !selectedClient
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 bg-red-100 text-red-700 text-[10px] font-black rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {/* Selected Client Clinical Case View */}
        {selectedClient ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
              <button
                onClick={() => setSelectedClient(null)}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
              >
                &larr; Back to My Caseload
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleCopyLink(selectedClient)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Copy client assessment link"
                >
                  {copiedClientId === selectedClient.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Assessment Link</span>
                    </>
                  )}
                </button>
                <div className="text-xs text-gray-500 font-medium">
                  Counsellor: <strong className="text-gray-900">{user.name}</strong>
                </div>
              </div>
            </div>

            {/* Client Profile Header Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700 font-mono text-xs font-black">
                      {selectedClient.id}
                    </span>
                    <h1 className="text-2xl font-black text-gray-950">
                      {selectedClient.firstName} {selectedClient.lastName}
                    </h1>
                    {selectedClient.preferredName && (
                      <span className="text-xs text-gray-500 font-medium">
                        (Preferred: {selectedClient.preferredName})
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      {selectedClient.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-gray-400" />
                      {selectedClient.email}
                    </span>
                    <span>State: <strong>{selectedClient.state}</strong></span>
                    <span>Age: <strong>{selectedClient.age}</strong></span>
                    <span>Registered: {new Date(selectedClient.registrationDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      selectedClient.riskLevel === 'High'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : selectedClient.riskLevel === 'Medium'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    Risk Level: {selectedClient.riskLevel}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">
                    Status: {selectedClient.status}
                  </span>
                </div>
              </div>

              {/* Assessment Progress Details */}
              <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <div className="text-gray-500 font-medium">Current Pathway Stage</div>
                  <div className="font-bold text-gray-900 mt-1 text-sm">{selectedClient.currentStageName}</div>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <div className="text-gray-500 font-medium">Next Scheduled Check-in</div>
                  <div className="font-bold text-red-600 mt-1 text-sm">
                    {selectedClient.nextAssessmentName || 'All Assessments Complete'}
                  </div>
                </div>
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <div className="text-gray-500 font-medium">Completed Submissions</div>
                  <div className="font-bold text-gray-900 mt-1 text-sm">
                    {selectedClient.totalAssessmentsCompleted} assessments completed
                  </div>
                </div>
              </div>
            </div>

            {/* Split Grid: Submissions & Case Notes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Assessment Submissions */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4.5 h-4.5 text-red-600" />
                  <span>Assessment Submissions & Scores</span>
                </h3>

                {clientSubmissions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                    No assessment submissions have been recorded yet for this client.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {clientSubmissions.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-900">{sub.formName}</span>
                          <span className="text-gray-500 font-medium">
                            {new Date(sub.submittedAt).toLocaleDateString()}
                          </span>
                        </div>

                        {sub.totalScore !== undefined && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-500">Total Score:</span>
                            <span className="font-mono font-bold text-gray-900 bg-white border border-gray-200 px-2 py-0.5 rounded">
                              {sub.totalScore}
                            </span>
                            {sub.scoreRiskLevel && (
                              <span className="text-red-700 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[11px]">
                                {sub.scoreRiskLevel} Risk
                              </span>
                            )}
                          </div>
                        )}

                        <div className="text-xs text-gray-600">
                          {sub.answers.length} questions completed.
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Case Notes & Clinical Follow-up */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4.5 h-4.5 text-red-600" />
                    <span>Confidential Case Notes</span>
                  </h3>
                  <span className="text-xs font-semibold text-gray-500">{clientCaseNotes.length} notes</span>
                </div>

                {/* Add New Case Note Form */}
                <form onSubmit={handleAddCaseNote} className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="text-xs font-bold text-gray-800">Add Clinical Note</div>
                  <textarea
                    rows={3}
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Enter confidential clinical observation, session takeaways, or client state..."
                    className="w-full p-3 rounded-xl bg-white border border-gray-300 text-gray-900 placeholder-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-gray-600 font-semibold mb-1">Follow-up Date</label>
                      <input
                        type="date"
                        value={newFollowUpDate}
                        onChange={(e) => setNewFollowUpDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 font-semibold mb-1">Category / Tag</label>
                      <select
                        value={newNoteTag}
                        onChange={(e) => setNewNoteTag(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-gray-300 text-gray-900 text-xs"
                      >
                        <option value="Clinical Check-in">Clinical Check-in</option>
                        <option value="Follow-up Call">Follow-up Call</option>
                        <option value="Risk Assessment">Risk Assessment</option>
                        <option value="Treatment Milestones">Treatment Milestones</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingNote || !newNoteContent.trim()}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingNote ? 'Saving...' : 'Save Case Note'}</span>
                  </button>

                  {noteSuccess && (
                    <div className="text-xs text-emerald-700 font-bold text-center bg-emerald-50 border border-emerald-200 py-1.5 rounded-lg">
                      ✓ Note successfully saved to client record.
                    </div>
                  )}
                </form>

                {/* Existing Case Notes List */}
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {clientCaseNotes.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No case notes recorded yet. Add the first clinical check-in note above.
                    </div>
                  ) : (
                    clientCaseNotes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-gray-500 font-medium">
                          <span className="font-bold text-gray-900">{note.authorName}</span>
                          <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                          {note.content}
                        </p>
                        {note.followUpDate && (
                          <div className="text-xs text-red-600 font-bold pt-1">
                            Scheduled Follow-up: {note.followUpDate}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'notifications' ? (
          /* Notifications Tab: Official notification stream for assigned/reassigned clients */
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-950">
                    Counsellor Notifications
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    Instant alerts for newly assigned or reassigned clients in your caseload.
                  </p>
                </div>
                <div className="text-xs font-bold text-gray-600">
                  {unreadCount} unread
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="p-10 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="font-bold text-gray-700">No Notifications</p>
                  <p className="text-gray-500 mt-1">You do not have any new caseload assignment alerts at this time.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => {
                    const isNewAssigned = notif.subject?.includes('New Client Assigned');
                    const isReassigned = notif.subject?.includes('Reassigned');

                    return (
                      <div
                        key={notif.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          notif.isRead
                            ? 'bg-gray-50 border-gray-200 opacity-80'
                            : 'bg-red-50/50 border-red-200 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isReassigned
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-gray-950">
                                {notif.subject || 'Client Assignment'}
                              </span>
                              {!notif.isRead && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                                  New
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-800 font-medium mt-1">
                              {notif.messageBody}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">
                              {new Date(notif.scheduledFor).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {notif.clientId && (
                            <button
                              onClick={() => {
                                const cl = dataService.getClientById(notif.clientId);
                                if (cl) {
                                  handleMarkAsRead(notif.id);
                                  handleSelectClient(cl);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                            >
                              Open Case
                            </button>
                          )}
                          {!notif.isRead && (
                            <button
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 text-xs font-bold transition-colors cursor-pointer"
                            >
                              Mark Read
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Main Tab Views */
          <div className="space-y-6">
            {/* Caseload Dashboard Metrics */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs">
                    <div className="text-xs text-gray-500 font-bold">My Assigned Clients</div>
                    <div className="text-3xl font-black text-gray-950 mt-1">{totalCaseload}</div>
                    <div className="text-[11px] text-red-600 font-bold mt-1">Active Caseload</div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs">
                    <div className="text-xs text-gray-500 font-bold">Active In Program</div>
                    <div className="text-3xl font-black text-emerald-600 mt-1">{activeClients}</div>
                    <div className="text-[11px] text-gray-500 font-medium mt-1">Ongoing check-ins</div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs">
                    <div className="text-xs text-gray-500 font-bold">Due Today</div>
                    <div className="text-3xl font-black text-amber-600 mt-1">{dueToday.length}</div>
                    <div className="text-[11px] text-gray-500 font-medium mt-1">Assessments scheduled</div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-xs">
                    <div className="text-xs text-gray-500 font-bold">Overdue Check-ins</div>
                    <div className="text-3xl font-black text-red-600 mt-1">{overdueClients.length}</div>
                    <div className="text-[11px] text-red-700 font-bold mt-1">Requires follow-up</div>
                  </div>
                </div>

                {/* Authorization Security Check / Manual Lookup Box */}
                <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-red-600" />
                      <span>Security & Caseload Boundary Verification</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Enter any Client ID to test and verify your caseload access boundaries.
                    </p>
                  </div>

                  <form onSubmit={handleManualLookup} className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      value={manualLookupId}
                      onChange={(e) => setManualLookupId(e.target.value)}
                      placeholder="e.g. GP-0002"
                      className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 text-xs w-36 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
                    >
                      Lookup
                    </button>
                  </form>
                </div>

                {manualLookupError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{manualLookupError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Clients List (Strictly Assigned to Benjamin, Micheal Akinniku, or Celia Badmus) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-gray-950">
                    {activeTab === 'overdue'
                      ? 'Overdue Caseload'
                      : activeTab === 'upcoming'
                      ? 'Upcoming Check-ins'
                      : 'My Assigned Clients'}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    Showing clients assigned strictly to <strong className="text-gray-900">{user.name}</strong>.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, ID, phone..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {filteredClients.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500 bg-gray-50 rounded-xl border border-gray-200">
                  No assigned clients found matching your filter or query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 text-gray-500 font-bold bg-gray-50/70">
                        <th className="py-3 px-3">Client ID</th>
                        <th className="py-3 px-3">Client Name</th>
                        <th className="py-3 px-3">Current Stage</th>
                        <th className="py-3 px-3">Next Due</th>
                        <th className="py-3 px-3">Risk Level</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredClients.map((client) => (
                        <tr
                          key={client.id}
                          onClick={() => handleSelectClient(client)}
                          className="hover:bg-red-50/40 cursor-pointer transition-colors"
                        >
                          <td className="py-3.5 px-3 font-mono font-bold text-red-600">
                            {client.id}
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-gray-900">
                              {client.firstName} {client.lastName}
                            </div>
                            <div className="text-[11px] text-gray-500">{client.phone}</div>
                          </td>
                          <td className="py-3.5 px-3 text-gray-700 font-medium">
                            {client.currentStageName}
                          </td>
                          <td className="py-3.5 px-3 text-gray-600">
                            {client.nextAssessmentDueDate
                              ? new Date(client.nextAssessmentDueDate).toLocaleDateString()
                              : 'None'}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                client.riskLevel === 'High'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : client.riskLevel === 'Medium'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {client.riskLevel}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="text-gray-800 font-semibold">{client.status}</span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* Copy Assessment Link button */}
                              <button
                                onClick={(e) => handleCopyLink(client, e)}
                                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-[11px] font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                                title="Copy Assessment Link for Client"
                              >
                                {copiedClientId === client.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-gray-500" />
                                    <span>Copy Link</span>
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() => handleSelectClient(client)}
                                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                              >
                                Open Case
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Official Footer with GamblePause Digital Team signature */}
      <footer className="border-t border-gray-200 bg-white px-4 py-4 text-xs text-gray-500 text-center shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-gray-600 font-medium">
            <Shield className="w-4 h-4 text-red-600" />
            <span>GamblePause Client Management & Assessment System &bull; Confidential Caseload Isolation</span>
          </div>
          <div className="text-gray-500 font-semibold">
            Developed & Maintained by <span className="text-red-600 font-bold">GamblePause Digital Team</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
