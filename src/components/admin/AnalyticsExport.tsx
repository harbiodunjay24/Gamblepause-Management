import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Filter,
  BarChart3,
  Lock,
  User,
  Users,
  Search,
  AlertCircle,
  FileText,
  Activity,
  Layers,
  Sparkles,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { StaffUser, ClientStatus, Client } from '../../types';
import {
  exportCompleteClientDataExcel,
  exportAssessment1Excel,
  exportDiagnosticScreenExcel,
  exportGPDSExcel,
  exportAssessment2Excel,
  exportAssessment3Excel,
  exportAssessment4Excel,
  exportAssessment5Excel,
  exportFeedbackExcel,
  exportSingleClientExcel,
} from '../../services/exportService';

interface AnalyticsExportProps {
  currentUser: StaffUser;
}

export const AnalyticsExport: React.FC<AnalyticsExportProps> = ({ currentUser }) => {
  // Filters state
  const [dateRange, setDateRange] = useState<'all' | '30d' | '90d' | '365d'>('all');
  const [selectedCounsellorId, setSelectedCounsellorId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSingleClientId, setSelectedSingleClientId] = useState<string>('');
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [exportedNotice, setExportedNotice] = useState<string | null>(null);

  // Security check: Super User permission for master dataset export
  const isSuperUser = currentUser && (
    currentUser.role === 'Super Admin' ||
    ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org'].includes(currentUser.email.toLowerCase())
  );

  // Raw data from dataService
  const allClients = dataService.getClients();
  const allSubmissions = dataService.getSubmissions();
  const allAssignments = dataService.getCounsellorAssignments();
  const allCaseNotes = dataService.getAllCaseNotes();
  const staff = dataService.getStaff();
  const counsellors = staff.filter((s) => s.role === 'Counsellor');
  const metrics = dataService.getDashboardMetrics();

  // Filter clients based on selected controls
  const filteredClients = allClients.filter((client) => {
    // Counsellor filter
    if (selectedCounsellorId !== 'all') {
      if (client.assignedCounsellorId !== selectedCounsellorId) {
        return false;
      }
    }

    // Status filter
    if (selectedStatus !== 'all') {
      if (client.status !== selectedStatus) {
        return false;
      }
    }

    // Date range filter based on registrationDate
    if (dateRange !== 'all') {
      const now = new Date().getTime();
      const regTime = new Date(client.registrationDate).getTime();
      const diffDays = (now - regTime) / (1000 * 3600 * 24);
      if (dateRange === '30d' && diffDays > 30) return false;
      if (dateRange === '90d' && diffDays > 90) return false;
      if (dateRange === '365d' && diffDays > 365) return false;
    }

    // Text search filter
    if (clientSearchQuery.trim()) {
      const q = clientSearchQuery.toLowerCase();
      const matchesId = client.id.toLowerCase().includes(q);
      const matchesName = `${client.firstName} ${client.lastName}`.toLowerCase().includes(q);
      const matchesPhone = client.phone?.includes(q);
      if (!matchesId && !matchesName && !matchesPhone) return false;
    }

    return true;
  });

  const filteredClientIds = new Set(filteredClients.map((c) => c.id));
  const filteredSubmissions = allSubmissions.filter((s) => filteredClientIds.has(s.clientId));
  const filteredAssignments = allAssignments.filter((a) => filteredClientIds.has(a.clientId));
  const filteredCaseNotes = allCaseNotes.filter((n) => filteredClientIds.has(n.clientId));

  const showSuccessNotice = (msg: string) => {
    setExportedNotice(msg);
    setTimeout(() => setExportedNotice(null), 5000);
  };

  // 1. Export Complete Client Assessment Data (12 Sheets)
  const handleExportCompleteData = () => {
    if (!isSuperUser) {
      alert('Access Restricted: Master export with unredacted personal identifiers is strictly reserved for Super Users.');
      return;
    }

    exportCompleteClientDataExcel(
      filteredClients,
      filteredSubmissions,
      filteredAssignments,
      filteredCaseNotes
    );

    dataService.logAudit(
      'EXPORT_COMPLETE_DATA',
      'System',
      'all',
      `Super User ${currentUser.name} exported Complete Client Data Excel workbook (${filteredClients.length} clients, ${filteredSubmissions.length} submissions).`
    );

    showSuccessNotice(
      `Master workbook generated: 12 clinical sheets exported (${filteredClients.length} clients, ${filteredSubmissions.length} submissions).`
    );
  };

  // 2. Individual Assessment Exports
  const handleExportAssessment1 = () => {
    exportAssessment1Excel(filteredSubmissions, filteredClients);
    dataService.logAudit('EXPORT_ASSESSMENT_DATA', 'Assessment', 'assessment-1', `Exported Assessment 1 responses (.xlsx)`);
    showSuccessNotice('Assessment 1 (Intake & Biodata) Excel file downloaded successfully.');
  };

  const handleExportDiagnosticScreen = () => {
    exportDiagnosticScreenExcel(filteredSubmissions, filteredClients);
    dataService.logAudit('EXPORT_ASSESSMENT_DATA', 'Assessment', 'diagnostic-screen', `Exported Diagnostic Screen responses (.xlsx)`);
    showSuccessNotice('Diagnostic Screen (19-Item Evaluation) Excel file downloaded successfully.');
  };

  const handleExportGPDS = () => {
    exportGPDSExcel(filteredSubmissions, filteredClients);
    dataService.logAudit('EXPORT_ASSESSMENT_DATA', 'Assessment', 'gpds', `Exported GPDS responses (.xlsx)`);
    showSuccessNotice('GPDS (Problem Severity Scale) Excel file downloaded successfully.');
  };

  const handleExportAssessment2 = () => {
    exportAssessment2Excel(filteredSubmissions, filteredClients);
    dataService.logAudit('EXPORT_ASSESSMENT_DATA', 'Assessment', 'assessment-2', `Exported Assessment 2.0 responses (.xlsx)`);
    showSuccessNotice('Assessment 2.0 (Consequences & Action Plan) Excel file downloaded successfully.');
  };

  const handleExportAssessment3 = () => {
    exportAssessment3Excel(filteredSubmissions, filteredClients);
    dataService.logAudit('EXPORT_ASSESSMENT_DATA', 'Assessment', 'assessment-3', `Exported Assessment 3.0 responses (.xlsx)`);
    showSuccessNotice('Assessment 3.0 (Cognitive Restructuring) Excel file downloaded successfully.');
  };

  const handleExportAssessment4 = () => {
    exportAssessment4Excel(filteredSubmissions, filteredClients);
    dataService.logAudit('EXPORT_ASSESSMENT_DATA', 'Assessment', 'assessment-4', `Exported Assessment 4.0 responses (.xlsx)`);
    showSuccessNotice('Assessment 4.0 (Urge Management) Excel file downloaded successfully.');
  };

  const handleExportAssessment5 = () => {
    exportAssessment5Excel(filteredSubmissions, filteredClients);
    dataService.logAudit('EXPORT_ASSESSMENT_DATA', 'Assessment', 'assessment-5', `Exported Assessment 5.0 responses (.xlsx)`);
    showSuccessNotice('Assessment 5.0 (Relapse Prevention & Goals) Excel file downloaded successfully.');
  };

  const handleExportFeedback = () => {
    exportFeedbackExcel(filteredSubmissions, filteredClients);
    dataService.logAudit('EXPORT_ASSESSMENT_DATA', 'Assessment', 'feedback', `Exported Feedback responses (.xlsx)`);
    showSuccessNotice('Client Service Feedback Excel file downloaded successfully.');
  };

  // 3. Export Single Client Case File
  const handleExportSingleClient = () => {
    if (!selectedSingleClientId) {
      alert('Please select a client from the dropdown first.');
      return;
    }
    const client = allClients.find((c) => c.id === selectedSingleClientId);
    if (!client) {
      alert('Selected client not found.');
      return;
    }

    exportSingleClientExcel(client, allSubmissions, allAssignments, allCaseNotes);

    dataService.logAudit(
      'EXPORT_SINGLE_CLIENT',
      'Client',
      client.id,
      `Exported full multi-sheet case file workbook (.xlsx) for ${client.id} (${client.firstName} ${client.lastName}).`
    );

    showSuccessNotice(`Full case file exported for client ${client.id} (${client.firstName} ${client.lastName}).`);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
              Clinical Assessment & Data Export Center
            </h1>
            {isSuperUser ? (
              <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2.5 py-0.5 rounded-full shadow-xs">
                Super User
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                Staff / Counsellor
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Generate authentic Microsoft Excel (.xlsx) workbooks containing complete client records, raw questionnaire answers, and case notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3.5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 text-red-600" />
            <span>Print Executive Summary</span>
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {exportedNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-bold">{exportedNotice}</span>
          </div>
          <button
            onClick={() => setExportedNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 p-1 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
            <Filter className="w-4 h-4 text-red-600" />
            <span>Dataset Scope & Export Filters</span>
          </div>
          <span className="text-xs font-bold text-gray-500">
            Matching: <span className="text-red-600 font-extrabold">{filteredClients.length}</span> / {allClients.length} clients ({filteredSubmissions.length} assessments)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Date Range */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Registration Date</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
            >
              <option value="all">All Historical Records</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="365d">Past Calendar Year</option>
            </select>
          </div>

          {/* Counsellor Filter */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Assigned Counsellor</label>
            <select
              value={selectedCounsellorId}
              onChange={(e) => setSelectedCounsellorId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
            >
              <option value="all">All Counsellors ({counsellors.length})</option>
              {counsellors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Client Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
            >
              <option value="all">All Clinical Statuses</option>
              <option value="Active">Active</option>
              <option value="Assessment Due">Assessment Due</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
              <option value="Closed">Closed</option>
              <option value="Referred">Referred</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1">Search Client / ID</label>
            <div className="relative">
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                placeholder="Search name or GP-XXXX..."
                className="w-full p-2.5 pl-8 rounded-xl border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-3" />
            </div>
          </div>
        </div>
      </div>

      {/* FEATURE 2: PRIMARY COMPLETE CLIENT DATA EXPORT CARD */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-red-950 via-gray-900 to-gray-950 text-white shadow-xl border border-red-900/30 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/30 border border-red-500/40 text-red-200 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-red-400" />
              <span>Multi-Sheet Clinical Master Workbook (.xlsx)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Export Complete Client Data
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Generates an all-inclusive 12-sheet Excel spreadsheet containing raw question text, un-truncated answers, budget calculations, 19-item Diagnostic Screens, GPDS scores, cognitive thought records, counsellor transfer history, and confidential clinical case notes.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {isSuperUser ? (
              <button
                type="button"
                id="btn-export-complete-excel"
                onClick={handleExportCompleteData}
                className="px-6 py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-sm shadow-lg shadow-red-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                <span>Export Complete Client Data (.xlsx)</span>
              </button>
            ) : (
              <div className="px-5 py-3 rounded-xl bg-gray-800/80 border border-gray-700 text-gray-400 text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-400" />
                <span>Super User Access Required</span>
              </div>
            )}
          </div>
        </div>

        {/* 12-Sheet Contents Blueprint Indicator */}
        <div className="pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-[11px]">
          {[
            { num: 'Sheet 1', title: 'Biodata & Registry', icon: '👤' },
            { num: 'Sheet 2', title: 'Assessment 1 (Intake)', icon: '📋' },
            { num: 'Sheet 3', title: 'Diagnostic Screen (19)', icon: '🩺' },
            { num: 'Sheet 4', title: 'GPDS Severity Scale', icon: '📊' },
            { num: 'Sheet 5', title: 'Assessment 2.0 (Goals)', icon: '🎯' },
            { num: 'Sheet 6', title: 'Assessment 3.0 (CBT)', icon: '🧠' },
            { num: 'Sheet 7', title: 'Assessment 4.0 (Urges)', icon: '🛡️' },
            { num: 'Sheet 8', title: 'Assessment 5.0 (Relapse)', icon: '🌱' },
            { num: 'Sheet 9', title: 'Client Feedback', icon: '⭐' },
            { num: 'Sheet 10', title: 'Counsellor Transfers', icon: '🔄' },
            { num: 'Sheet 11', title: 'Clinical Case Notes', icon: '📝' },
            { num: 'Sheet 12', title: 'Assessment Summary', icon: '📈' },
          ].map((s) => (
            <div key={s.num} className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">
                {s.icon} {s.num}
              </span>
              <span className="font-bold text-gray-200 block truncate mt-0.5">{s.title}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION: SINGLE CLIENT CASE FILE EXPORT */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-gray-950 flex items-center gap-2">
              <User className="w-5 h-5 text-red-600" />
              <span>Single Client Case File Export (.xlsx)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select an individual client to generate a standalone 12-sheet Excel case record for clinical reviews or referral handovers.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="w-full sm:w-80">
            <select
              id="select-single-client-export"
              value={selectedSingleClientId}
              onChange={(e) => setSelectedSingleClientId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
            >
              <option value="">[ Choose Client to Export ▼ ]</option>
              {allClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.firstName} {c.lastName} ({c.assignedCounsellorName || 'Unassigned'})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            id="btn-export-single-client-excel"
            disabled={!selectedSingleClientId}
            onClick={handleExportSingleClient}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-red-400" />
            <span>Download Individual Case File (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* SECTION: INDIVIDUAL MODULE EXPORTS GRID */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-gray-950 flex items-center gap-2">
              <Layers className="w-5 h-5 text-red-600" />
              <span>Individual Assessment Module Exports (.xlsx)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Download separate targeted Excel files with all raw answers, timestamps, and counsellor notes for specific research cohorts.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Assessment 1 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-red-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Stage 1 Intake
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1.5">Assessment 1.0</h4>
              <p className="text-xs text-gray-500 mt-1">
                Bio-psychosocial history, gambling habits, 2% income calculations, and staked amounts.
              </p>
            </div>
            <button
              type="button"
              id="export-ass1-btn"
              onClick={handleExportAssessment1}
              className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-red-50 text-red-700 border border-gray-200 hover:border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Assessment 1 (.xlsx)</span>
            </button>
          </div>

          {/* Diagnostic Screen */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-red-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                19 Items
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1.5">Diagnostic Screen</h4>
              <p className="text-xs text-gray-500 mt-1">
                DSM-5 clinical criteria questions, raw responses, and total symptom score calculations.
              </p>
            </div>
            <button
              type="button"
              id="export-diagnostic-btn"
              onClick={handleExportDiagnosticScreen}
              className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-red-50 text-red-700 border border-gray-200 hover:border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Diagnostic Screen (.xlsx)</span>
            </button>
          </div>

          {/* GPDS */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-red-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                10 Items
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1.5">GPDS Severity Scale</h4>
              <p className="text-xs text-gray-500 mt-1">
                GamblePause Diagnostic Scale with item-by-item responses and risk tier classifications.
              </p>
            </div>
            <button
              type="button"
              id="export-gpds-btn"
              onClick={handleExportGPDS}
              className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-red-50 text-red-700 border border-gray-200 hover:border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export GPDS (.xlsx)</span>
            </button>
          </div>

          {/* Assessment 2.0 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-red-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Stage 2
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1.5">Assessment 2.0</h4>
              <p className="text-xs text-gray-500 mt-1">
                Problem recognition, negative consequences analysis, and client-defined action plans.
              </p>
            </div>
            <button
              type="button"
              id="export-ass2-btn"
              onClick={handleExportAssessment2}
              className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-red-50 text-red-700 border border-gray-200 hover:border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Assessment 2.0 (.xlsx)</span>
            </button>
          </div>

          {/* Assessment 3.0 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-red-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Stage 3
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1.5">Assessment 3.0</h4>
              <p className="text-xs text-gray-500 mt-1">
                Cognitive restructuring records, alternative thinking, and irrational belief disputation.
              </p>
            </div>
            <button
              type="button"
              id="export-ass3-btn"
              onClick={handleExportAssessment3}
              className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-red-50 text-red-700 border border-gray-200 hover:border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Assessment 3.0 (.xlsx)</span>
            </button>
          </div>

          {/* Assessment 4.0 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-red-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Stage 4
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1.5">Assessment 4.0</h4>
              <p className="text-xs text-gray-500 mt-1">
                Urge trigger logs, 8 coping techniques responses, and Homework #5 reflection reports.
              </p>
            </div>
            <button
              type="button"
              id="export-ass4-btn"
              onClick={handleExportAssessment4}
              className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-red-50 text-red-700 border border-gray-200 hover:border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Assessment 4.0 (.xlsx)</span>
            </button>
          </div>

          {/* Assessment 5.0 */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-red-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Stage 5
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1.5">Assessment 5.0</h4>
              <p className="text-xs text-gray-500 mt-1">
                Avoidance analysis, healthy substitution activities, and long-term harm reduction goals.
              </p>
            </div>
            <button
              type="button"
              id="export-ass5-btn"
              onClick={handleExportAssessment5}
              className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-red-50 text-red-700 border border-gray-200 hover:border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Assessment 5.0 (.xlsx)</span>
            </button>
          </div>

          {/* Feedback */}
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between space-y-3 hover:border-red-300 transition-colors">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded">
                Evaluation
              </span>
              <h4 className="text-sm font-bold text-gray-900 mt-1.5">Client Feedback</h4>
              <p className="text-xs text-gray-500 mt-1">
                Post-intervention client evaluations, service ratings, and qualitative suggestions.
              </p>
            </div>
            <button
              type="button"
              id="export-feedback-btn"
              onClick={handleExportFeedback}
              className="w-full py-2 px-3 rounded-xl bg-gray-50 hover:bg-red-50 text-red-700 border border-gray-200 hover:border-red-200 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Feedback (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Executive Snapshot for Board / Audits */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4 print:border-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">
              Executive Clinical Metric Summary
            </span>
            <h2 className="text-base font-bold text-gray-950 mt-0.5">
              GamblePause Harm Reduction Initiative — Data Cohort Status
            </h2>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Enrolled Clients</span>
            <span className="text-xl font-black text-gray-950 mt-0.5 block">{metrics.totalClients}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Active Trajectory</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5 block">{metrics.activeClients}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Completed Submissions</span>
            <span className="text-xl font-black text-gray-950 mt-0.5 block">{metrics.completedAssessments}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Counsellor Transfers</span>
            <span className="text-xl font-black text-red-600 mt-0.5 block">{allAssignments.length}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-red-50/50 border border-red-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-600 shrink-0" />
            <span className="text-gray-700">
              All exported files comply with the Nigerian Data Protection Act (NDPA) and clinical data privacy standards. Every export event is recorded in the permanent audit trail.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
