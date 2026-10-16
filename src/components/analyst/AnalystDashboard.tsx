import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Download,
  Filter,
  RefreshCw,
  Users,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  Search,
  ChevronDown,
  Printer,
  ShieldCheck,
  Calendar,
  Layers,
  MapPin,
  HelpCircle,
  FileText,
  Activity,
  ChevronRight,
  ChevronLeft,
  X,
  Eye,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import {
  dataService,
  isGenuineClient,
  isClientActiveInPathway,
  isClientUpcomingDue,
  isClientOverdue,
  isHistoricalMigratedClient,
  isClientNewInLast7Days,
  matchClientSearch,
} from '../../services/dataService';
import { Client, StaffUser, AssessmentSubmission } from '../../types';
import { NIGERIAN_STATES } from '../../data/demoData';
import {
  exportAnalystReportExcel,
  exportAnalystReportCSV,
} from '../../services/exportService';

interface AnalystDashboardProps {
  currentUser: StaffUser;
  onSelectClient?: (client: Client) => void;
  onNavigateTab?: (tab: string, filter?: string) => void;
}

export const AnalystDashboard: React.FC<AnalystDashboardProps> = ({
  currentUser,
  onSelectClient,
  onNavigateTab,
}) => {
  const [, setTick] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Filter States
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d' | '365d' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedCounsellor, setSelectedCounsellor] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table pagination & inspect modal
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const [inspectClient, setInspectClient] = useState<Client | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Subscribe to real-time changes in Firestore via DataService
  useEffect(() => {
    const unsub = dataService.subscribe(() => {
      setTick((t) => t + 1);
      setLastSyncTime(new Date());
    });
    return () => unsub();
  }, []);

  const isLoaded = dataService.isAuthoritativeLoaded();
  const rawClients = dataService.getClients();
  const genuineClients = useMemo(() => rawClients.filter(isGenuineClient), [rawClients]);
  const submissions = dataService.getSubmissions();
  const staff = dataService.getStaff();
  const counsellors = useMemo(() => staff.filter((s) => s.role === 'Counsellor'), [staff]);

  // Available countries
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    genuineClients.forEach((c) => {
      if (c.country && c.country !== 'Not specified') {
        set.add(c.country);
      }
    });
    set.add('Nigeria');
    set.add('Ghana');
    set.add('Other African Countries');
    return Array.from(set).sort();
  }, [genuineClients]);

  // Available states for chosen country
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    const countryClients =
      selectedCountry === 'all'
        ? genuineClients
        : genuineClients.filter((c) => {
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
  }, [genuineClients, selectedCountry]);

  // Filter clients using strict AND logic across all active controls
  const filteredClients = useMemo(() => {
    return genuineClients.filter((c) => {
      // 1. Search Query
      if (searchQuery.trim() && !matchClientSearch(c, searchQuery)) {
        return false;
      }

      // 2. Status Filter
      if (selectedStatus === 'Active') {
        if (c.status !== 'Active') return false;
      } else if (selectedStatus === 'Completed') {
        if ((c.status || '').toLowerCase() !== 'completed' && !(typeof c.totalAssessmentsCompleted === 'number' && c.totalAssessmentsCompleted >= 6)) return false;
      } else if (selectedStatus === 'Assessment Due') {
        if (c.status !== 'Assessment Due' && !isClientUpcomingDue(c)) return false;
      } else if (selectedStatus === 'Overdue') {
        if (!isClientOverdue(c)) return false;
      } else if (selectedStatus !== 'all' && c.status !== selectedStatus) {
        return false;
      }

      // 3. Country Filter
      if (selectedCountry !== 'all') {
        const cCountry = c.country || (NIGERIAN_STATES.includes(c.state) ? 'Nigeria' : 'Not specified');
        if (cCountry.toLowerCase() !== selectedCountry.toLowerCase()) return false;
      }

      // 4. State Filter
      if (selectedState !== 'all') {
        const cState = c.state || 'Not specified';
        if (cState.toLowerCase() !== selectedState.toLowerCase()) return false;
      }

      // 5. Risk Level Filter
      if (selectedRiskLevel !== 'all') {
        const r = (c.riskLevel || '').toLowerCase();
        if (selectedRiskLevel === 'High' && !r.includes('high') && !r.includes('severe')) return false;
        if (selectedRiskLevel === 'Moderate' && !r.includes('moderate') && !r.includes('medium')) return false;
        if (selectedRiskLevel === 'Low / Non-Problematic' && !r.includes('low') && !r.includes('standard') && !r.includes('non')) return false;
      }

      // 6. Gender Filter
      if (selectedGender !== 'all' && c.gender !== selectedGender) {
        return false;
      }

      // 7. Counsellor Filter
      if (selectedCounsellor !== 'all' && c.assignedCounsellorId !== selectedCounsellor) {
        return false;
      }

      // 8. Stage Filter
      if (selectedStage !== 'all') {
        const completed = c.totalAssessmentsCompleted || 0;
        if (selectedStage === 'Stage 1' && completed !== 0) return false;
        if (selectedStage === 'Stage 2' && completed !== 1) return false;
        if (selectedStage === 'Stage 3' && completed !== 2) return false;
        if (selectedStage === 'Stage 4' && completed !== 3) return false;
        if (selectedStage === 'Stage 5' && completed !== 4) return false;
        if (selectedStage === 'Stage 6' && completed !== 5) return false;
        if (selectedStage === 'Stage 7' && completed < 6) return false;
      }

      // 9. Timeframe Filter
      if (dateRange !== 'all') {
        if (isHistoricalMigratedClient(c)) return false;
        const regDateStr = c.createdAt || c.registeredAt || c.registrationDate || c.created_at;
        if (!regDateStr) return false;
        const regTime = new Date(regDateStr).getTime();
        if (isNaN(regTime)) return false;

        const now = Date.now();
        if (dateRange === '7d' && (now - regTime) > 7 * 86400000) return false;
        if (dateRange === '30d' && (now - regTime) > 30 * 86400000) return false;
        if (dateRange === '90d' && (now - regTime) > 90 * 86400000) return false;
        if (dateRange === '365d' && (now - regTime) > 365 * 86400000) return false;

        if (dateRange === 'custom') {
          if (customStartDate) {
            const startMs = new Date(customStartDate).getTime();
            if (!isNaN(startMs) && regTime < startMs) return false;
          }
          if (customEndDate) {
            const endMs = new Date(customEndDate).getTime() + 86400000;
            if (!isNaN(endMs) && regTime > endMs) return false;
          }
        }
      }

      return true;
    });
  }, [
    genuineClients,
    searchQuery,
    selectedStatus,
    selectedCountry,
    selectedState,
    selectedRiskLevel,
    selectedGender,
    selectedCounsellor,
    selectedStage,
    dateRange,
    customStartDate,
    customEndDate,
  ]);

  // Synchronized metrics for the filtered client pool
  const metrics = useMemo(() => {
    const totalClients = filteredClients.length;
    const activeClients = filteredClients.filter((c) => c.status === 'Active').length;
    const activeCohort = filteredClients.filter(isClientActiveInPathway);

    const completedClients = filteredClients.filter(
      (c) =>
        (c.status || '').toLowerCase() === 'completed' ||
        (typeof c.totalAssessmentsCompleted === 'number' && c.totalAssessmentsCompleted >= 6)
    ).length;

    const assessmentsDueToday = activeCohort.filter((c) => {
      if (!c.nextAssessmentDueDate) return c.status === 'Assessment Due';
      const d = new Date(c.nextAssessmentDueDate);
      const isToday = d.toDateString() === new Date().toDateString();
      return isToday || c.status === 'Assessment Due';
    }).length;

    const overdueAssessments = activeCohort.filter((c) => isClientOverdue(c)).length;

    // Filtered submissions: assessment responses belonging to filtered clients
    const filteredClientIds = new Set(filteredClients.map((c) => c.id));
    const relevantSubmissions = submissions.filter((s) => filteredClientIds.has(s.clientId));
    const completedAssessments = relevantSubmissions.length;

    const highRiskCount = filteredClients.filter((c) => {
      const r = (c.riskLevel || '').toLowerCase();
      return r.includes('high') || r.includes('severe');
    }).length;

    const newClients7d = filteredClients.filter(isClientNewInLast7Days).length;

    return {
      totalClients,
      activeClients,
      completedClients,
      assessmentsDueToday,
      overdueAssessments,
      completedAssessments,
      highRiskCount,
      newClients7d,
      activeCohortCount: activeCohort.length,
      completionRate: totalClients > 0 ? ((completedClients / totalClients) * 100).toFixed(1) : '0.0',
    };
  }, [filteredClients, submissions]);

  // Status Distribution for Charts & Breakdown
  const statusDistribution = useMemo(() => {
    const counts = {
      Active: filteredClients.filter((c) => c.status === 'Active').length,
      'Assessment Due': filteredClients.filter((c) => c.status === 'Assessment Due' || isClientUpcomingDue(c)).length,
      Overdue: filteredClients.filter((c) => isClientOverdue(c)).length,
      Completed: filteredClients.filter(
        (c) =>
          (c.status || '').toLowerCase() === 'completed' ||
          (typeof c.totalAssessmentsCompleted === 'number' && c.totalAssessmentsCompleted >= 6)
      ).length,
    };
    const total = filteredClients.length || 1;
    return [
      { label: 'Active', count: counts.Active, color: '#10b981', bg: 'bg-emerald-500', pct: ((counts.Active / total) * 100).toFixed(1) },
      { label: 'Assessment Due', count: counts['Assessment Due'], color: '#f59e0b', bg: 'bg-amber-500', pct: ((counts['Assessment Due'] / total) * 100).toFixed(1) },
      { label: 'Overdue', count: counts.Overdue, color: '#ef4444', bg: 'bg-red-500', pct: ((counts.Overdue / total) * 100).toFixed(1) },
      { label: 'Completed', count: counts.Completed, color: '#3b82f6', bg: 'bg-blue-500', pct: ((counts.Completed / total) * 100).toFixed(1) },
    ];
  }, [filteredClients]);

  // Pathway Progression Funnel (Stages 1 through 7)
  const pathwayProgression = useMemo(() => {
    const total = filteredClients.length || 1;
    const stages = [
      { id: 'stage-1', name: 'Intake / Registration', minAssessments: 0 },
      { id: 'stage-2', name: 'GPA 1.0 (Clinical Diagnostic)', minAssessments: 1 },
      { id: 'stage-3', name: 'GPA 2.0 (Dealing with Family)', minAssessments: 2 },
      { id: 'stage-4', name: 'GPA 3.0 (Cognitive Restructuring)', minAssessments: 3 },
      { id: 'stage-5', name: 'GPA 4.0 (Relapse Prevention)', minAssessments: 4 },
      { id: 'stage-6', name: 'GPA 5.0 (Long-Term Maintenance)', minAssessments: 5 },
      { id: 'stage-7', name: 'Client Feedback (Graduation)', minAssessments: 6 },
    ];

    return stages.map((st) => {
      const reached = st.minAssessments === 0
        ? filteredClients.length
        : filteredClients.filter((c) => (c.totalAssessmentsCompleted || 0) >= st.minAssessments).length;
      const pct = ((reached / total) * 100).toFixed(1);
      return {
        ...st,
        count: reached,
        percentage: pct,
      };
    });
  }, [filteredClients]);

  // Top Geographic Regions / States
  const topStates = useMemo(() => {
    const map: Record<string, number> = {};
    filteredClients.forEach((c) => {
      const state = c.state || 'Not specified';
      map[state] = (map[state] || 0) + 1;
    });
    const total = filteredClients.length || 1;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([state, count]) => ({
        state,
        count,
        pct: ((count / total) * 100).toFixed(1),
      }));
  }, [filteredClients]);

  // Risk Distribution
  const riskDistribution = useMemo(() => {
    let high = 0;
    let moderate = 0;
    let low = 0;
    let notAssessed = 0;

    filteredClients.forEach((c) => {
      const r = (c.riskLevel || '').toLowerCase();
      if (r.includes('high') || r.includes('severe')) high++;
      else if (r.includes('moderate') || r.includes('medium')) moderate++;
      else if (r.includes('low') || r.includes('standard') || r.includes('non')) low++;
      else notAssessed++;
    });

    const total = filteredClients.length || 1;
    return [
      { label: 'High / Severe', count: high, color: '#ef4444', pct: ((high / total) * 100).toFixed(1) },
      { label: 'Moderate', count: moderate, color: '#f59e0b', pct: ((moderate / total) * 100).toFixed(1) },
      { label: 'Low / Standard', count: low, color: '#10b981', pct: ((low / total) * 100).toFixed(1) },
      { label: 'Not Assessed / Other', count: notAssessed, color: '#6b7280', pct: ((notAssessed / total) * 100).toFixed(1) },
    ];
  }, [filteredClients]);

  // Paginated client list for table
  const totalPages = Math.ceil(filteredClients.length / pageSize) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, currentPage, pageSize]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedStatus,
    selectedCountry,
    selectedState,
    selectedRiskLevel,
    selectedGender,
    selectedCounsellor,
    selectedStage,
    dateRange,
    customStartDate,
    customEndDate,
    searchQuery,
  ]);

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateRange !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    if (selectedCountry !== 'all') count++;
    if (selectedState !== 'all') count++;
    if (selectedRiskLevel !== 'all') count++;
    if (selectedGender !== 'all') count++;
    if (selectedCounsellor !== 'all') count++;
    if (selectedStage !== 'all') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [
    dateRange,
    selectedStatus,
    selectedCountry,
    selectedState,
    selectedRiskLevel,
    selectedGender,
    selectedCounsellor,
    selectedStage,
    searchQuery,
  ]);

  const handleResetFilters = () => {
    setDateRange('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedStatus('all');
    setSelectedCountry('all');
    setSelectedState('all');
    setSelectedRiskLevel('all');
    setSelectedGender('all');
    setSelectedCounsellor('all');
    setSelectedStage('all');
    setSearchQuery('');
  };

  // Export handlers
  const handleExportExcel = () => {
    try {
      exportAnalystReportExcel({
        clients: filteredClients,
        submissions,
        metrics,
        filters: {
          dateRange: dateRange === 'custom' ? `${customStartDate} to ${customEndDate}` : dateRange,
          status: selectedStatus,
          country: selectedCountry,
          state: selectedState,
          riskLevel: selectedRiskLevel,
          gender: selectedGender,
          counsellor: selectedCounsellor !== 'all' ? counsellors.find((c) => c.id === selectedCounsellor)?.name : 'All',
          stage: selectedStage,
        },
        generatedBy: currentUser.name || currentUser.email || 'Analyst',
      });
      setExportNotice('Excel report generated successfully and saved to your device.');
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      console.error('Failed to export Excel report:', err);
    }
  };

  const handleExportCSV = () => {
    try {
      exportAnalystReportCSV({
        clients: filteredClients,
        metrics,
        filters: {
          dateRange: dateRange === 'custom' ? `${customStartDate} to ${customEndDate}` : dateRange,
          status: selectedStatus,
          country: selectedCountry,
          state: selectedState,
          riskLevel: selectedRiskLevel,
          gender: selectedGender,
          counsellor: selectedCounsellor !== 'all' ? counsellors.find((c) => c.id === selectedCounsellor)?.name : 'All',
          stage: selectedStage,
        },
        generatedBy: currentUser.name || currentUser.email || 'Analyst',
      });
      setExportNotice('CSV report generated successfully and saved to your device.');
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err: any) {
      console.error('Failed to export CSV report:', err);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isLoaded) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-sm flex items-center justify-center my-8">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="text-sm font-semibold text-gray-700">Connecting to Cloud Firestore...</p>
          <p className="text-xs text-gray-400">Loading authoritative client datasets & assessment metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* 1. Header & Live Firestore Status */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
              Analyst / Viewer Workspace
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Firestore Live Synced</span>
            </div>
            <span className="text-[10px] text-gray-400">
              Updated {lastSyncTime.toLocaleTimeString()}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-red-600 shrink-0" />
            <span>Clinical Data Intelligence & Research Console</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Authoritative clinical metrics, progression analytics, epidemiological demographics & downloadable reports.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            title="Export filtered dataset to CSV for SPSS, R, Python, or Excel"
          >
            <Download className="w-3.5 h-3.5 text-gray-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
            title="Download multi-tab formatted Excel workbook"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>Download Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            title="Print or save executive summary as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-gray-600" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* Export notification alert */}
      {exportNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* 2. Comprehensive Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-red-600" />
            <span className="text-xs font-black uppercase tracking-wider text-gray-900">
              Caseload Filter & Cohort Controls
            </span>
            {activeFiltersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">
                {activeFiltersCount} active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-red-600 hover:text-red-700 underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset All Filters</span>
              </button>
            )}
            <span className="text-xs text-gray-400 font-medium">
              Filtered Caseload: <strong className="text-gray-900">{filteredClients.length}</strong> of{' '}
              <strong className="text-gray-900">{genuineClients.length}</strong> Genuine Clients
            </span>
          </div>
        </div>

        {/* Filter Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {/* Timeframe */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Enrollment Timeframe</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Time (Full Dataset)</option>
              <option value="7d">Last 7 Days (Recent)</option>
              <option value="30d">Last 30 Days (Monthly)</option>
              <option value="90d">Last 90 Days (Quarterly)</option>
              <option value="365d">Last 1 Year (Annual)</option>
              <option value="custom">Custom Date Range...</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Clinical Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active Pathway ({genuineClients.filter((c) => c.status === 'Active').length})</option>
              <option value="Assessment Due">Assessment Due ({genuineClients.filter((c) => c.status === 'Assessment Due' || isClientUpcomingDue(c)).length})</option>
              <option value="Overdue">Overdue Caseload ({genuineClients.filter((c) => isClientOverdue(c)).length})</option>
              <option value="Completed">Completed Pathway ({genuineClients.filter((c) => c.status === 'Completed' || (c.totalAssessmentsCompleted || 0) >= 6).length})</option>
            </select>
          </div>

          {/* Country */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Country</label>
            <select
              value={selectedCountry}
              onChange={(e) => {
                setSelectedCountry(e.target.value);
                setSelectedState('all');
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Countries</option>
              {availableCountries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          </div>

          {/* State / Region */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">State / Region</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All States / Regions</option>
              {availableStates.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Level */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Risk Category</label>
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Risk Tiers</option>
              <option value="High">High / Severe Risk</option>
              <option value="Moderate">Moderate Risk</option>
              <option value="Low / Non-Problematic">Low / Non-Problematic</option>
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Gender</label>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other / Prefer not to say</option>
            </select>
          </div>

          {/* Counsellor */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Assigned Clinician</label>
            <select
              value={selectedCounsellor}
              onChange={(e) => setSelectedCounsellor(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Counsellors</option>
              {counsellors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pathway Stage */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Pathway Stage Milestone</label>
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">All Stages</option>
              <option value="Stage 1">Stage 1: Registration (0 completed)</option>
              <option value="Stage 2">Stage 2: GPA 1.0 (1 completed)</option>
              <option value="Stage 3">Stage 3: GPA 2.0 (2 completed)</option>
              <option value="Stage 4">Stage 4: GPA 3.0 (3 completed)</option>
              <option value="Stage 5">Stage 5: GPA 4.0 (4 completed)</option>
              <option value="Stage 6">Stage 6: GPA 5.0 (5 completed)</option>
              <option value="Stage 7">Stage 7: Feedback / Graduated (6 completed)</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Row (Conditional) */}
        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs">
            <span className="font-bold text-gray-700">Custom Period:</span>
            <div className="flex items-center gap-2">
              <label className="text-gray-500">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>
        )}

        {/* Search input bar */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 absolute left-3.5 top-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cohort by Client ID (e.g. GP-0001), Location, State, or Counsellor..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/70 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* 3. Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Genuine Clients */}
        <div
          onClick={() => setSelectedStatus('all')}
          className={`bg-white p-4 rounded-2xl border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'all' ? 'border-gray-900 ring-2 ring-gray-900/10' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-gray-500">
            <span>Genuine Clients</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-950 mt-2">{metrics.totalClients}</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <span>Enrolled Cohort</span>
            <span className="font-bold text-gray-700">100%</span>
          </div>
        </div>

        {/* Active Clients */}
        <div
          onClick={() => setSelectedStatus('Active')}
          className={`bg-white p-4 rounded-2xl border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'Active' ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
            <span>Active Clients</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2">{metrics.activeClients}</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <span>In active recovery</span>
            <span className="font-bold text-emerald-700">
              {metrics.totalClients > 0 ? ((metrics.activeClients / metrics.totalClients) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>

        {/* Completed Pathways */}
        <div
          onClick={() => setSelectedStatus('Completed')}
          className={`bg-white p-4 rounded-2xl border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'Completed' ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-blue-700">
            <span>Completed Pathways</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-600 mt-2">{metrics.completedClients}</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <span>Completed all 6 stages</span>
            <span className="font-bold text-blue-700">{metrics.completionRate}%</span>
          </div>
        </div>

        {/* Total Assessments Filed */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-purple-700">
            <span>Assessments Filed</span>
            <FileSpreadsheet className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-purple-600 mt-2">{metrics.completedAssessments}</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <span>Unique Responses</span>
            <span className="font-bold text-purple-700">Submissions</span>
          </div>
        </div>

        {/* Assessments Due */}
        <div
          onClick={() => setSelectedStatus('Assessment Due')}
          className={`bg-white p-4 rounded-2xl border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'Assessment Due' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/20' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-700">
            <span>Assessments Due</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 mt-2">{metrics.assessmentsDueToday}</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <span>Due for assessment</span>
            <span className="font-bold text-amber-700">Active cohort</span>
          </div>
        </div>

        {/* Overdue Caseload */}
        <div
          onClick={() => setSelectedStatus('Overdue')}
          className={`bg-white p-4 rounded-2xl border shadow-xs transition-all cursor-pointer hover:shadow-md ${
            selectedStatus === 'Overdue' ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/20' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-red-700">
            <span>Overdue Caseload</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-red-600 mt-2">{metrics.overdueAssessments}</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <span>Immediate follow-up</span>
            <span className="font-bold text-red-700">Priority queue</span>
          </div>
        </div>

        {/* New Clients (7d) */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-teal-700">
            <span>New Registrations</span>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-teal-600 mt-2">{metrics.newClients7d}</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <span>Rolling 7 days</span>
            <span className="font-bold text-teal-700">Intake velocity</span>
          </div>
        </div>

        {/* High Risk Flagged */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-700">
            <span>High Risk Caseload</span>
            <Activity className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 mt-2">{metrics.highRiskCount}</p>
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
            <span>Severe/High risk</span>
            <span className="font-bold text-rose-700">
              {metrics.totalClients > 0 ? ((metrics.highRiskCount / metrics.totalClients) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* 4. Interactive Visualizations & Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart A: Status Distribution Ring / Doughnut Chart */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-black text-gray-900 tracking-tight">Client Status Distribution</h3>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">Click slice to filter table</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 my-4">
            {/* SVG Doughnut */}
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f3f4f6" strokeWidth="12" />
                {(() => {
                  let accumulatedPercent = 0;
                  return statusDistribution.map((item, idx) => {
                    const percent = parseFloat(item.pct) || 0;
                    if (percent <= 0) return null;
                    const strokeDasharray = `${percent * 2.3876} 238.76`;
                    const strokeDashoffset = `-${accumulatedPercent * 2.3876}`;
                    accumulatedPercent += percent;
                    return (
                      <circle
                        key={idx}
                        cx="50"
                        cy="50"
                        r="38"
                        fill="transparent"
                        stroke={item.color}
                        strokeWidth="12"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-500 cursor-pointer hover:opacity-80"
                        onClick={() => setSelectedStatus(item.label)}
                      />
                    );
                  });
                })()}
              </svg>
              {/* Inner Center Label */}
              <div className="absolute text-center">
                <span className="text-xs text-gray-400 font-bold block uppercase tracking-wider">Total</span>
                <span className="text-2xl font-black text-gray-950 block">{metrics.totalClients}</span>
                <span className="text-[10px] text-gray-400 font-medium">Clients</span>
              </div>
            </div>

            {/* Legend & Interactive Buttons */}
            <div className="space-y-2.5 w-full max-w-xs">
              {statusDistribution.map((item) => (
                <div
                  key={item.label}
                  onClick={() => setSelectedStatus(selectedStatus === item.label ? 'all' : item.label)}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    selectedStatus === item.label
                      ? 'bg-gray-100 ring-2 ring-gray-900/10 font-bold'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-md ${item.bg}`}></span>
                    <span className="text-gray-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-950">{item.count}</span>
                    <span className="text-gray-400 text-[11px] w-12 text-right">({item.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>Authoritative genuine clients</span>
            <span className="font-semibold text-gray-700">100.0% accounted</span>
          </div>
        </div>

        {/* Chart B: Clinical Pathway Progression Funnel */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-black text-gray-900 tracking-tight">Pathway Progression & Milestones</h3>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">Stage-by-stage reach</span>
          </div>

          <div className="space-y-2.5 my-3">
            {pathwayProgression.map((st, idx) => (
              <div key={st.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-600 text-[10px] font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span>{st.name}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-gray-950">{st.count}</span>
                    <span className="text-gray-400 text-[10px]">({st.percentage}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      idx === 0
                        ? 'bg-gray-800'
                        : idx === 6
                        ? 'bg-blue-600'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(Number(st.percentage), 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>Full 6-Stage Completion:</span>
            <strong className="text-blue-600 font-black">{metrics.completedClients} Clients ({metrics.completionRate}%)</strong>
          </div>
        </div>
      </div>

      {/* 5. Geographic Demographics & Risk Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top States Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-black text-gray-900 tracking-tight">Geographic Concentration (Top States)</h3>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">Nigerian regional reach</span>
          </div>

          <div className="space-y-3 my-3">
            {topStates.map((item) => (
              <div key={item.state} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800">{item.state}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-gray-950">{item.count} clients</span>
                    <span className="text-gray-400 text-[10px]">({item.pct}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(Number(item.pct), 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>Primary Country:</span>
            <span className="font-bold text-gray-700">Nigeria (Pan-African clinical support)</span>
          </div>
        </div>

        {/* Risk Level Severity Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-black text-gray-900 tracking-tight">Risk Tier & Clinical Severity</h3>
            </div>
            <span className="text-[11px] text-gray-400 font-medium">Standardized scoring</span>
          </div>

          <div className="space-y-3 my-3">
            {riskDistribution.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-gray-950">{item.count} clients</span>
                    <span className="text-gray-400 text-[10px]">({item.pct}%)</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: item.color,
                      width: `${Math.max(Number(item.pct), 2)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>High Risk Caseload:</span>
            <span className="font-black text-rose-600">
              {metrics.highRiskCount} Clients ({metrics.totalClients > 0 ? ((metrics.highRiskCount / metrics.totalClients) * 100).toFixed(1) : 0}%)
            </span>
          </div>
        </div>
      </div>

      {/* 6. Supporting Data Table (De-identified & Privacy Compliant) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Database className="w-4 h-4 text-red-600" />
              <span>Supporting Client Cohort Record Table</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Privacy-preserving research directory. De-identified case records matching active filters.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <span className="text-xs text-gray-500">
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredClients.length} records)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[10px] border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Client ID</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Risk Level</th>
                <th className="px-4 py-3">Gender / Age</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Pathway Stage</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Next Due</th>
                <th className="px-4 py-3">Clinician</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                    <p className="font-semibold text-gray-600">No client records match the selected filters.</p>
                    <p className="text-xs mt-1">Try resetting or broadening your filter criteria above.</p>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const completed = client.totalAssessmentsCompleted || 0;
                  return (
                    <tr key={client.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-black text-gray-900">
                        {client.id}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            client.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : client.status === 'Completed'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : client.status === 'Overdue'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : client.status === 'Assessment Due'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {client.status || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (client.riskLevel || '').toLowerCase().includes('high') || (client.riskLevel || '').toLowerCase().includes('severe')
                              ? 'bg-rose-100 text-rose-800'
                              : (client.riskLevel || '').toLowerCase().includes('moderate')
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {client.riskLevel || 'Standard'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {client.gender || 'Not specified'} / {typeof client.age === 'number' ? `${client.age}y` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {client.state || 'Not specified'}, {client.country || 'Nigeria'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {client.currentStageName || `Stage ${completed + 1}`}
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-bold">
                        {completed} / 6
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-[11px]">
                        {client.nextAssessmentDueDate
                          ? new Date(client.nextAssessmentDueDate).toLocaleDateString()
                          : 'None scheduled'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {client.assignedCounsellorName || 'Unassigned'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectClient(client)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500 bg-gray-50/50">
          <div>
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, filteredClients.length)}</strong> of{' '}
            <strong>{filteredClients.length}</strong> matching records
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
            >
              Previous
            </button>
            <span className="font-bold text-gray-900 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 7. Client Detail Modal (Read-Only Analytical Inspection) */}
      {inspectClient && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800">
                  Analytical Case Profile
                </span>
                <h3 className="text-xl font-black text-gray-950 mt-1 flex items-center gap-2">
                  <span>Client {inspectClient.id}</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectClient(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Status</span>
                <span className="font-black text-gray-900">{inspectClient.status || 'Active'}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Risk Tier</span>
                <span className="font-black text-gray-900">{inspectClient.riskLevel || 'Standard'}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Demographics</span>
                <span className="font-bold text-gray-800">
                  {inspectClient.gender || 'Not specified'}, {inspectClient.age || 'N/A'} yrs
                </span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Location</span>
                <span className="font-bold text-gray-800">
                  {inspectClient.state || 'Not specified'}, {inspectClient.country || 'Nigeria'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Assessments Completed</span>
                <span className="font-black text-gray-900">{inspectClient.totalAssessmentsCompleted || 0} of 6</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Current Stage</span>
                <span className="font-bold text-gray-800">{inspectClient.currentStageName || 'Stage 1'}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Last Assessment</span>
                <span className="font-medium text-gray-800">{inspectClient.lastAssessmentName || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Next Due Date</span>
                <span className="font-medium text-gray-800">
                  {inspectClient.nextAssessmentDueDate
                    ? new Date(inspectClient.nextAssessmentDueDate).toLocaleDateString()
                    : 'None scheduled'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 col-span-2">
                <span className="text-[10px] font-bold text-gray-400 block uppercase">Assigned Counsellor</span>
                <span className="font-bold text-gray-800">{inspectClient.assignedCounsellorName || 'Unassigned'}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Read-Only Research View:</strong> Direct client communication details and password credentials are restricted under clinical privacy standards.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectClient(null)}
                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
