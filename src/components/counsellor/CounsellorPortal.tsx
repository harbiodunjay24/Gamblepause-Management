import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  LayoutDashboard,
  Clock,
  AlertCircle,
  FileText,
  LogOut,
  Search,
  CheckCircle2,
  CheckCircle,
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
  UserCheck,
  TrendingUp,
  Activity,
  Filter,
  RefreshCw,
  Download,
} from 'lucide-react';
import { Client, CaseNote, AssessmentSubmission, FormDefinition, NotificationLog } from '../../types';
import {
  dataService,
  isClientActiveInPathway,
  isHistoricalMigratedClient,
  isClientUpcomingDue,
  isClientOverdue,
  matchClientSearch,
} from '../../services/dataService';
import { AuthUser } from '../../services/authService';
import { GamblePauseLogo } from '../common/GamblePauseLogo';
import { createWhatsAppDirectUrl, generateWhatsAppMessage } from '../../services/whatsappService';
import { NIGERIAN_STATES } from '../../data/demoData';
import {
  exportSingleClientExcel,
  exportAssessment1Excel,
  exportAssessment2Excel,
  exportAssessment3Excel,
  exportAssessment4Excel,
  exportAssessment5Excel,
  exportDiagnosticScreenExcel,
  exportGPDSExcel,
  exportFeedbackExcel,
} from '../../services/exportService';

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
  const [isLoadingCaseload, setIsLoadingCaseload] = useState(!dataService.isAuthoritativeLoaded());

  // Case note draft
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('Clinical Check-in');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);

  // Security test lookup
  const [manualLookupId, setManualLookupId] = useState('');
  const [manualLookupError, setManualLookupError] = useState<string | null>(null);

  // Parity with Super Admin: Caseload Filtering Controls
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const loadData = () => {
    // getClients() automatically filters strictly to assigned counsellor when called by counsellor
    const myClients = dataService.getClients();
    setClients(myClients);
    const notifs = dataService.getCounsellorNotifications(user.id, user.name);
    setNotifications(notifs);
  };

  useEffect(() => {
    loadData();
    let isMounted = true;
    dataService.ensureAuthoritativeData().finally(() => {
      if (isMounted) {
        loadData();
        setIsLoadingCaseload(false);
      }
    });
    const unsub = dataService.subscribe(() => {
      if (isMounted) {
        loadData();
        setIsLoadingCaseload(false);
      }
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [user.id, user.name]);

  const unreadCount = notifications.filter((n) => !dataService.isNotificationRead(n, user.id)).length;

  // Dynamically extract available countries from counsellor's authorized caseload
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    clients.forEach((c) => {
      if (c.country && c.country !== 'Not specified') {
        set.add(c.country);
      }
    });
    set.add('Nigeria');
    set.add('Ghana');
    set.add('Other African Countries');
    return Array.from(set).sort();
  }, [clients]);

  // Dynamically extract available states for selected country within counsellor's caseload
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    const countryClients = selectedCountry === 'all'
      ? clients
      : clients.filter((c) => {
          const cCountry = c.country || (NIGERIAN_STATES.includes(c.state) ? 'Nigeria' : 'Not specified');
          return cCountry.toLowerCase() === selectedCountry.toLowerCase();
        });

    countryClients.forEach((c) => {
      if (c.state && c.state !== 'Not specified') {
        set.add(c.state);
      }
    });

    if (selectedCountry === 'Nigeria' || selectedCountry === 'all') {
      NIGERIAN_STATES.forEach((s) => set.add(s));
    }
    set.add('Not specified');
    return Array.from(set).sort((a, b) => {
      if (a === 'Not specified') return 1;
      if (b === 'Not specified') return -1;
      return a.localeCompare(b);
    });
  }, [clients, selectedCountry]);

  // Comprehensive multi-factor filter logic identical to Super Admin analytics
  const filteredCaseload = useMemo(() => {
    return clients.filter((c) => {
      // 1. Country filter (AND logic)
      if (selectedCountry !== 'all') {
        const cCountry = c.country || (NIGERIAN_STATES.includes(c.state) ? 'Nigeria' : 'Not specified');
        if (cCountry.toLowerCase() !== selectedCountry.toLowerCase()) {
          return false;
        }
      }

      // 2. State filter (AND logic)
      if (selectedState !== 'all') {
        const cState = c.state || 'Not specified';
        if (cState.toLowerCase() !== selectedState.toLowerCase()) {
          return false;
        }
      }

      // 3. Status filter (AND logic)
      if (selectedStatus !== 'all' && c.status !== selectedStatus) {
        return false;
      }

      // 4. Gender filter (AND logic)
      if (selectedGender !== 'all' && c.gender !== selectedGender) {
        return false;
      }

      // 5. Risk Level filter (AND logic)
      if (selectedRiskLevel !== 'all' && c.riskLevel !== selectedRiskLevel) {
        return false;
      }

      // 6. Timeframe filter (AND logic)
      if (dateRange !== 'all') {
        if (isHistoricalMigratedClient(c)) {
          return false;
        }
        const regDateStr = c.createdAt || c.registeredAt || c.registrationDate || c.created_at;
        if (!regDateStr) return false;
        const regTime = new Date(regDateStr).getTime();
        if (isNaN(regTime)) return false;
        const now = Date.now();
        const days = (now - regTime) / (1000 * 3600 * 24);
        if (dateRange === '7d' && days > 7) return false;
        if (dateRange === '30d' && days > 30) return false;
        if (dateRange === '90d' && days > 90) return false;
      }

      // 7. Search query filter (crash-proof)
      if (searchQuery.trim() && !matchClientSearch(c, searchQuery)) {
        return false;
      }

      return true;
    });
  }, [
    clients,
    selectedCountry,
    selectedState,
    selectedStatus,
    selectedGender,
    selectedRiskLevel,
    dateRange,
    searchQuery,
  ]);

  // Compute dashboard metrics dynamically from filteredCaseload
  const metrics = useMemo(() => {
    return dataService.getDashboardMetrics(filteredCaseload);
  }, [filteredCaseload]);

  // Funnel calculations derived directly from filteredCaseload
  const stageCounts = useMemo(() => {
    return {
      'Client Registration': filteredCaseload.length,
      'Assessment 1.0': filteredCaseload.filter((c) => c.totalAssessmentsCompleted >= 1).length,
      'Assessment 2.0': filteredCaseload.filter((c) => c.totalAssessmentsCompleted >= 2).length,
      'Assessment 3.0': filteredCaseload.filter((c) => c.totalAssessmentsCompleted >= 3).length,
      'Assessment 4.0': filteredCaseload.filter((c) => c.totalAssessmentsCompleted >= 4).length,
      'Assessment 5.0': filteredCaseload.filter((c) => c.totalAssessmentsCompleted >= 5).length,
      'Client Feedback': filteredCaseload.filter((c) => c.totalAssessmentsCompleted >= 6).length,
    };
  }, [filteredCaseload]);

  // Demographic state calculations derived directly from filteredCaseload
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCaseload.forEach((c) => {
      const key = c.state || 'Not specified';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredCaseload]);

  // Priority follow-up queue derived from filteredCaseload
  const priorityClients = useMemo(() => {
    return filteredCaseload
      .filter((c) => isClientActiveInPathway(c) && (c.status === 'Overdue' || c.status === 'Assessment Due' || c.riskLevel === 'High'))
      .slice(0, 5);
  }, [filteredCaseload]);

  // Active filter count indicator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCountry !== 'all') count++;
    if (selectedState !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (selectedGender !== 'all') count++;
    if (selectedRiskLevel !== 'all') count++;
    if (dateRange !== 'all') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    selectedCountry,
    selectedState,
    selectedStatus,
    selectedGender,
    selectedRiskLevel,
    dateRange,
    searchQuery,
  ]);

  const handleResetFilters = () => {
    setSelectedCountry('all');
    setSelectedState('all');
    setSelectedStatus('all');
    setSelectedGender('all');
    setSelectedRiskLevel('all');
    setDateRange('all');
    setSearchQuery('');
  };

  const handleExportCaseloadSummary = () => {
    const allSubs = dataService.getSubmissions();
    const authorizedSubs = allSubs.filter((s) => filteredCaseload.some((c) => c.id === s.clientId));
    exportAssessment1Excel(authorizedSubs, filteredCaseload);
    setExportNotice(`Caseload summary exported successfully (${filteredCaseload.length} clients).`);
    setTimeout(() => setExportNotice(null), 4000);
  };

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

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await dataService.markNotificationAsRead(id);
    setNotifications(dataService.getCounsellorNotifications(user.id, user.name));
  };

  const handleMarkAllAsRead = async () => {
    await dataService.markAllNotificationsAsRead(user.id);
    setNotifications(dataService.getCounsellorNotifications(user.id, user.name));
  };

  // Caseload operational status lists
  const totalCaseload = clients.length;
  const dueToday = filteredCaseload.filter((c) => {
    if (!c.nextAssessmentDueDate || c.status === 'Completed' || c.status === 'Closed') return false;
    const d = new Date(c.nextAssessmentDueDate);
    return d.toDateString() === new Date().toDateString() || c.status === 'Assessment Due';
  });
  const overdueClients = filteredCaseload.filter((c) => isClientOverdue(c));
  const upcomingClients = filteredCaseload.filter((c) => isClientUpcomingDue(c));

  const filteredClients =
    activeTab === 'overdue'
      ? overdueClients
      : activeTab === 'upcoming'
      ? upcomingClients
      : filteredCaseload;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between font-sans">
      {/* Counsellor Portal Header with GamblePause Logo Only */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-30 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GamblePauseLogo size="sm" alt="GamblePause Logo" />
            <div className="text-xs text-gray-600 font-medium leading-tight">
              <span className="font-bold text-gray-950 block">{user.name}</span>
              <span className="text-red-600 font-semibold text-[11px]">
                Caseload: {dataService.isAuthoritativeLoaded() ? `${totalCaseload} clients` : 'Loading...'}
              </span>
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
            <span>Upcoming Due ({upcomingClients.length})</span>
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
        {!dataService.isAuthoritativeLoaded() ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="text-sm font-bold text-gray-800">Connecting to Cloud Firestore...</p>
              <p className="text-xs text-gray-400">Loading assigned counsellor caseload</p>
            </div>
          </div>
        ) : selectedClient ? (
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
                      {selectedClient.phone || 'No phone recorded'}
                    </span>
                    {selectedClient.phone && (() => {
                      const waUrl = createWhatsAppDirectUrl(
                        selectedClient.phone,
                        generateWhatsAppMessage({
                          client: selectedClient,
                          counsellorName: user.name,
                          messageType: selectedClient.status === 'Overdue' ? 'assessment_reminder' : selectedClient.nextAssessmentName ? 'assessment_upcoming' : 'general_checkin',
                        })
                      );
                      if (!waUrl) return null;
                      return (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-lg transition-colors cursor-pointer"
                          title="Open WhatsApp chat with client with pre-filled check-in message"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp Client</span>
                        </a>
                      );
                    })()}
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
                <div className="flex items-center gap-3">
                  <div className="text-xs font-bold text-gray-600">
                    {unreadCount} unread
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Mark All as Read
                    </button>
                  )}
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
                    const isRead = dataService.isNotificationRead(notif, user.id);

                    return (
                      <div
                        key={notif.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isRead
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
                              {!isRead && (
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
                              onClick={async () => {
                                const cl = dataService.getClientById(notif.clientId);
                                if (cl) {
                                  await handleMarkAsRead(notif.id);
                                  handleSelectClient(cl);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                            >
                              Open Case
                            </button>
                          )}
                          {!isRead && (
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
                {/* Export Feedback Notice */}
                {exportNotice && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>{exportNotice}</span>
                    </div>
                    <button onClick={() => setExportNotice(null)} className="text-emerald-700 font-bold hover:underline">
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Filter Toolbar Placed Authoritatively at the Top of Analytics View */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
                      <Filter className="w-4 h-4 text-red-600" />
                      <span>Active Caseload Analytics Filters</span>
                      {activeFilterCount > 0 && (
                        <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                          {activeFilterCount} active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[11px] font-semibold text-gray-500">
                        Showing <strong className="text-gray-900">{filteredCaseload.length}</strong> of{' '}
                        <strong className="text-gray-900">{clients.length}</strong> caseload clients
                      </span>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                        >
                          Reset Filters
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleExportCaseloadSummary}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                        title="Export filtered caseload summary to Excel (.xlsx)"
                      >
                        <Download className="w-3.5 h-3.5 text-red-600" />
                        <span>Export (.xlsx)</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                    {/* 1. Country Filter */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Country</label>
                      <select
                        value={selectedCountry}
                        onChange={(e) => {
                          setSelectedCountry(e.target.value);
                          setSelectedState('all');
                        }}
                        className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                      >
                        <option value="all">All Countries</option>
                        {availableCountries.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 2. State Filter */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">State / Region</label>
                      <select
                        value={selectedState}
                        onChange={(e) => setSelectedState(e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                      >
                        <option value="all">All States / Regions</option>
                        {availableStates.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Status Filter */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Status</label>
                      <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                      >
                        <option value="all">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Assessment Due">Assessment Due</option>
                        <option value="Overdue">Overdue</option>
                        <option value="Completed">Completed</option>
                        <option value="Awaiting Assessment">Awaiting Assessment</option>
                      </select>
                    </div>

                    {/* 4. Risk Level Filter */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Risk Level</label>
                      <select
                        value={selectedRiskLevel}
                        onChange={(e) => setSelectedRiskLevel(e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                      >
                        <option value="all">All Risk Levels</option>
                        <option value="High">High Risk</option>
                        <option value="Medium">Medium Risk</option>
                        <option value="Low">Low Risk</option>
                      </select>
                    </div>

                    {/* 5. Gender Filter */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Gender</label>
                      <select
                        value={selectedGender}
                        onChange={(e) => setSelectedGender(e.target.value)}
                        className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                      >
                        <option value="all">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>

                    {/* 6. Timeframe Filter */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Timeframe</label>
                      <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as any)}
                        className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                      >
                        <option value="all">All Time</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Empty State Banner if no clients match active filter */}
                {filteredCaseload.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center space-y-3">
                    <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                    <h3 className="text-base font-bold text-amber-950">No clients match your filter criteria</h3>
                    <p className="text-xs text-amber-800 max-w-md mx-auto">
                      The selected combination of filters yielded 0 client records in your caseload. Adjust your dropdown selections or reset filters.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reset All Filters</span>
                    </button>
                  </div>
                )}

                {/* 7 Metric Summary Cards Calculated on filteredCaseload */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  {/* 1. Total Clients */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                      <span>Total Caseload</span>
                      <Users className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 mt-2">{metrics.totalClients}</p>
                    <span className="text-[10px] text-gray-400 mt-1">Assigned to you</span>
                  </div>

                  {/* 2. Active Clients */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                      <span>Active</span>
                      <UserCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-black text-emerald-600 mt-2">{metrics.activeClients}</p>
                    <span className="text-[10px] text-emerald-700 font-medium mt-1">In progress</span>
                  </div>

                  {/* 3. New Clients */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                      <span>New (7 Days)</span>
                      <TrendingUp className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 mt-2">{metrics.newClients}</p>
                    <span className="text-[10px] text-gray-400 mt-1">Recent intake</span>
                  </div>

                  {/* 4. Due Today */}
                  <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
                      <span>Due Today</span>
                      <Clock className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-2xl font-black text-amber-600 mt-2">{metrics.assessmentsDueToday}</p>
                    <span className="text-[10px] text-amber-700 mt-1">Ready for review</span>
                  </div>

                  {/* 5. Overdue */}
                  <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-red-700 text-xs font-medium">
                      <span>Overdue</span>
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    </div>
                    <p className="text-2xl font-black text-red-600 mt-2">{metrics.overdueAssessments}</p>
                    <span className="text-[10px] text-red-700 font-semibold mt-1">Needs outreach</span>
                  </div>

                  {/* 6. Completed Submissions */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                      <span>Completed</span>
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 mt-2">{metrics.completedAssessments}</p>
                    <span className="text-[10px] text-gray-400 mt-1">Assessments filed</span>
                  </div>

                  {/* 7. Requiring Follow-up */}
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
                      <span>High Priority</span>
                      <Activity className="w-4 h-4 text-red-600" />
                    </div>
                    <p className="text-2xl font-black text-red-700 mt-2">{metrics.clientsRequiringFollowup}</p>
                    <span className="text-[10px] text-red-600 font-medium mt-1">Needs outreach</span>
                  </div>
                </div>

                {/* Analytics Charts & Visual Distribution Derived from filteredCaseload */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* 1. Assessment Progression Funnel */}
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-xs lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-gray-900">Assessment Pathway Progression</h2>
                        <p className="text-xs text-gray-500">
                          Cumulative clients in your caseload reaching each stage of the recovery workflow ({filteredCaseload.length} in filtered cohort)
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-gray-400">Progression Funnel</span>
                    </div>

                    <div className="space-y-3 pt-2">
                      {Object.entries(stageCounts).map(([stage, count], idx) => {
                        const total = filteredCaseload.length || 1;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={stage} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-700 font-bold text-[10px] flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                {stage}
                              </span>
                              <span className="font-bold text-gray-900">
                                {count} <span className="text-gray-400 font-normal">({pct}%)</span>
                              </span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                      <span>7-day delay configured between check-ins</span>
                      <span>Target completion velocity: 90 days</span>
                    </div>
                  </div>

                  {/* 2. Client Status Breakdown */}
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-xs space-y-4 flex flex-col justify-between">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">Client Status Breakdown</h2>
                      <p className="text-xs text-gray-500">Caseload status distribution</p>

                      <div className="space-y-2.5 mt-4">
                        {[
                          { label: 'Active', count: metrics.activeClients, color: 'bg-emerald-500', text: 'text-emerald-700' },
                          { label: 'Assessment Due', count: metrics.assessmentsDueToday, color: 'bg-amber-500', text: 'text-amber-700' },
                          { label: 'Overdue', count: metrics.overdueAssessments, color: 'bg-red-600', text: 'text-red-700' },
                          { label: 'Completed Pathway', count: filteredCaseload.filter((c) => c.status === 'Completed').length, color: 'bg-emerald-600', text: 'text-emerald-800' },
                          { label: 'Awaiting Assessment', count: filteredCaseload.filter((c) => c.status === 'Awaiting Assessment').length, color: 'bg-gray-400', text: 'text-gray-700' },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                              <span className="font-semibold text-gray-800">{item.label}</span>
                            </div>
                            <span className={`font-bold ${item.text}`}>{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-[11px] text-red-900 space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        Clinical Alert
                      </p>
                      <p className="text-gray-600">
                        Clients are flagged as Overdue after 72 hours without response. Please initiate a WhatsApp check-in or telephone follow-up.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Demographics & Priority Action Queue Derived from filteredCaseload */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Top Demographics (Nigerian States & Locations) */}
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-xs space-y-4">
                    <h2 className="text-base font-bold text-gray-900">Demographic Insights</h2>
                    <p className="text-xs text-gray-500">Top states & locations in your caseload</p>

                    <div className="space-y-3">
                      {stateCounts.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No location data for current filter.</p>
                      ) : (
                        stateCounts.map(([stateName, count]) => {
                          const pct = Math.round((count / (filteredCaseload.length || 1)) * 100);
                          return (
                            <div key={stateName} className="space-y-1 text-xs">
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-800">{stateName}</span>
                                <span className="text-gray-900 font-bold">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gray-900 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-[11px] text-gray-400">
                        *Caseload demography strictly limited to your authorized assigned clients.
                      </p>
                    </div>
                  </div>

                  {/* Priority Follow-up Queue */}
                  <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-xs lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <span>Priority Action Queue</span>
                        </h2>
                        <p className="text-xs text-gray-500">Clients in your caseload requiring urgent check-in, overdue follow-up, or high-risk outreach</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('clients')}
                        className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Caseload Table</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {priorityClients.length === 0 ? (
                        <p className="text-xs text-gray-400 py-6 text-center italic">No high priority clients match current filter.</p>
                      ) : (
                        priorityClients.map((client) => (
                          <div
                            key={client.id}
                            onClick={() => handleSelectClient(client)}
                            className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 -mx-2 px-2 rounded-xl transition-colors cursor-pointer group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-700 font-extrabold text-xs flex items-center justify-center border border-red-100 shrink-0">
                                {client.id.replace('GP-', '')}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-gray-950 group-hover:text-red-600 transition-colors">
                                    {client.firstName} {client.lastName}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      client.status === 'Overdue'
                                        ? 'bg-red-100 text-red-700 border border-red-200'
                                        : client.status === 'Assessment Due'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {client.status}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {client.location}, {client.state} &bull; Stage: {client.currentStageName}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-semibold text-gray-700 block">
                                {client.phone || 'No phone'}
                              </span>
                              <span className="text-[11px] text-red-600 font-medium">Open Case File &rarr;</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
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
                      ? `Overdue Caseload (${overdueClients.length})`
                      : activeTab === 'upcoming'
                      ? `Upcoming Check-ins (${upcomingClients.length})`
                      : `My Assigned Clients (${filteredCaseload.length})`}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    {activeTab === 'overdue'
                      ? `Showing clients with past-due assessments assigned to `
                      : activeTab === 'upcoming'
                      ? `Showing clients with upcoming scheduled assessments assigned to `
                      : `Showing clients assigned strictly to `}
                    <strong className="text-gray-900">{user.name}</strong>.
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
                  {activeTab === 'overdue'
                    ? 'No overdue assessments in your caseload. All check-ins are up to date.'
                    : activeTab === 'upcoming'
                    ? 'No clients currently scheduled for upcoming assessments in this window.'
                    : 'No assigned clients found matching your filter or query.'}
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
                          <td className="py-3.5 px-3">
                            {client.nextAssessmentDueDate ? (
                              <div>
                                <div className="font-medium text-gray-800">
                                  {new Date(client.nextAssessmentDueDate).toLocaleDateString()}
                                </div>
                                {isClientOverdue(client) ? (
                                  <span className="inline-block mt-0.5 text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                                    Overdue
                                  </span>
                                ) : new Date(client.nextAssessmentDueDate).toDateString() === new Date().toDateString() ? (
                                  <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    Due Today
                                  </span>
                                ) : (
                                  <span className="inline-block mt-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                    Scheduled Future
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">None</span>
                            )}
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
