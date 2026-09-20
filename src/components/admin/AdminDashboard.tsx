import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Filter,
  RefreshCw,
  Search,
  ChevronRight,
  PhoneCall,
  Activity,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { NotificationService } from '../../services/notificationService';
import { Client, StaffUser } from '../../types';
import { NIGERIAN_STATES } from '../../data/demoData';

interface AdminDashboardProps {
  currentUser: StaffUser;
  onSelectClient: (client: Client) => void;
  onNavigateTab: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onSelectClient,
  onNavigateTab,
}) => {
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCounsellor, setSelectedCounsellor] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [scanResult, setScanResult] = useState<string | null>(null);

  const rawClients = dataService.getClients();
  const staff = dataService.getStaff();
  const metrics = dataService.getDashboardMetrics();

  // Filter clients based on user controls
  const filteredClients = useMemo(() => {
    return rawClients.filter((c) => {
      // Counsellor role limitation: counsellors see all or assigned clients
      if (currentUser.role === 'Counsellor' && c.assignedCounsellorId !== currentUser.id) {
        // Counsellors can see assigned primarily, but let's allow filter
      }

      if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
      if (selectedCounsellor !== 'all' && c.assignedCounsellorId !== selectedCounsellor) return false;
      if (selectedState !== 'all' && c.state !== selectedState) return false;
      if (selectedGender !== 'all' && c.gender !== selectedGender) return false;

      if (dateRange !== 'all') {
        const regTime = new Date(c.registrationDate).getTime();
        const now = new Date().getTime();
        const days = (now - regTime) / (1000 * 3600 * 24);
        if (dateRange === '7d' && days > 7) return false;
        if (dateRange === '30d' && days > 30) return false;
        if (dateRange === '90d' && days > 90) return false;
      }

      return true;
    });
  }, [rawClients, currentUser, selectedStatus, selectedCounsellor, selectedState, selectedGender, dateRange]);

  const handleTriggerAutomatedCheck = async () => {
    const res = await NotificationService.runAutomatedChecks();
    setScanResult(`Check complete: ${res.overdueCount} newly flagged as overdue, ${res.remindersSent} automated notifications processed.`);
    setTimeout(() => setScanResult(null), 5000);
  };

  // Funnel calculations
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'Client Registration': rawClients.length,
      'Initial Assessment': rawClients.filter((c) => c.totalAssessmentsCompleted >= 1).length,
      'Follow-up 1': rawClients.filter((c) => c.totalAssessmentsCompleted >= 2).length,
      'Follow-up 2': rawClients.filter((c) => c.totalAssessmentsCompleted >= 3).length,
      'Recovery Progress': rawClients.filter((c) => c.totalAssessmentsCompleted >= 4).length,
      'Final Assessment': rawClients.filter((c) => c.totalAssessmentsCompleted >= 5).length,
    };
    return counts;
  }, [rawClients]);

  // Demographic state calculations
  const stateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rawClients.forEach((c) => {
      counts[c.state] = (counts[c.state] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [rawClients]);

  // Overdue and Priority Follow-up Clients
  const priorityClients = useMemo(() => {
    return rawClients
      .filter((c) => c.status === 'Overdue' || c.status === 'Assessment Due' || c.riskLevel === 'High')
      .slice(0, 5);
  }, [rawClients]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
              Programme Overview & Analytics
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded">
              Live Monitor
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            GamblePause client engagement, assessment completion velocity, and harm-reduction monitoring.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleTriggerAutomatedCheck}
            id="trigger-overdue-check-btn"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm"
            title="Scan client database to identify overdue assessments and queue automated email/SMS reminders"
          >
            <RefreshCw className="w-3.5 h-3.5 text-red-600" />
            <span>Run Automated Check</span>
          </button>

          <button
            onClick={() => onNavigateTab('clients')}
            id="view-all-clients-btn"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl transition-all cursor-pointer shadow-md shadow-red-500/20"
          >
            <Users className="w-3.5 h-3.5" />
            <span>View All Clients</span>
          </button>
        </div>
      </div>

      {scanResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{scanResult}</span>
          </div>
          <button onClick={() => setScanResult(null)} className="text-emerald-700 font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* 1. Total Clients */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Total Clients</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{metrics.totalClients}</p>
          <span className="text-[10px] text-gray-400 mt-1">Enrolled</span>
        </div>

        {/* 2. Active Clients */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Active</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{metrics.activeClients}</p>
          <span className="text-[10px] text-emerald-700 font-medium mt-1">In progress</span>
        </div>

        {/* 3. New Clients */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>New (7 Days)</span>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{metrics.newClients}</p>
          <span className="text-[10px] text-gray-400 mt-1">Recent intake</span>
        </div>

        {/* 4. Due Today */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 text-xs font-medium">
            <span>Due Today</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 mt-2">{metrics.assessmentsDueToday}</p>
          <span className="text-[10px] text-amber-700 mt-1">Ready to complete</span>
        </div>

        {/* 5. Overdue */}
        <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-red-700 text-xs font-medium">
            <span>Overdue</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-600 mt-2">{metrics.overdueAssessments}</p>
          <span className="text-[10px] text-red-700 font-semibold mt-1">Alert triggered</span>
        </div>

        {/* 6. Completed Submissions */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>Completed</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{metrics.completedAssessments}</p>
          <span className="text-[10px] text-gray-400 mt-1">Assessments filed</span>
        </div>

        {/* 7. Requiring Follow-up */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gray-500 text-xs font-medium">
            <span>High Priority</span>
            <Activity className="w-4 h-4 text-red-600" />
          </div>
          <p className="text-2xl font-black text-red-700 mt-2">{metrics.clientsRequiringFollowup}</p>
          <span className="text-[10px] text-red-600 font-medium mt-1">Needs outreach</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-800">
            <Filter className="w-3.5 h-3.5 text-red-600" />
            <span>Filter Dashboard Analytics</span>
          </div>
          <span className="text-[11px] text-gray-400">
            Showing {filteredClients.length} of {rawClients.length} clients
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          {/* Date range */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Timeframe</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Assessment Due">Assessment Due</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
              <option value="Awaiting Assessment">Awaiting Assessment</option>
            </select>
          </div>

          {/* Counsellor */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Counsellor</label>
            <select
              value={selectedCounsellor}
              onChange={(e) => setSelectedCounsellor(e.target.value)}
              className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All Staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* State */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Nigerian State</label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All States</option>
              {NIGERIAN_STATES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1">Gender</label>
            <select
              value={selectedGender}
              onChange={(e) => setSelectedGender(e.target.value)}
              className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="all">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Visual Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Assessment Progression Funnel */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Assessment Pathway Progression</h2>
              <p className="text-xs text-gray-500">Cumulative clients reaching each stage of the recovery workflow</p>
            </div>
            <span className="text-xs font-semibold text-gray-400">Progression Funnel</span>
          </div>

          <div className="space-y-3 pt-2">
            {Object.entries(stageCounts).map(([stage, count], idx) => {
              const total = rawClients.length || 1;
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
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Client Status Breakdown</h2>
            <p className="text-xs text-gray-500">Current cohort status distribution</p>

            <div className="space-y-2.5 mt-4">
              {[
                { label: 'Active', count: metrics.activeClients, color: 'bg-emerald-500', text: 'text-emerald-700' },
                { label: 'Assessment Due', count: metrics.assessmentsDueToday, color: 'bg-amber-500', text: 'text-amber-700' },
                { label: 'Overdue', count: metrics.overdueAssessments, color: 'bg-red-600', text: 'text-red-700' },
                { label: 'Completed Pathway', count: rawClients.filter((c) => c.status === 'Completed').length, color: 'bg-emerald-600', text: 'text-emerald-800' },
                { label: 'Awaiting Assessment', count: rawClients.filter((c) => c.status === 'Awaiting Assessment').length, color: 'bg-gray-400', text: 'text-gray-700' },
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
              Automated Flagging Notice
            </p>
            <p className="text-gray-600">
              Clients are flagged as Overdue after 72 hours without response. Assigned counsellors are automatically alerted.
            </p>
          </div>
        </div>
      </div>

      {/* Demographics & Priority Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Demographics (Nigerian States & Age Groups) */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900">Demographic Insights</h2>
          <p className="text-xs text-gray-500">Top enrolled Nigerian States & locations</p>

          <div className="space-y-3">
            {stateCounts.map(([stateName, count]) => {
              const pct = Math.round((count / (rawClients.length || 1)) * 100);
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
            })}
          </div>

          <div className="pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-400">
              *All demographic aggregations are anonymized in accordance with GamblePause privacy policy.
            </p>
          </div>
        </div>

        {/* Priority Follow-up Queue */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Priority Action Queue</span>
              </h2>
              <p className="text-xs text-gray-500">Clients requiring urgent check-in, overdue follow-up, or high-risk outreach</p>
            </div>
            <button
              onClick={() => onNavigateTab('clients')}
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <span>View Table</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-gray-100">
            {priorityClients.map((client) => (
              <div
                key={client.id}
                onClick={() => onSelectClient(client)}
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
                      {client.location}, {client.state} • Stage: {client.currentStageName}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-700 block">
                    {client.assignedCounsellorName || 'Unassigned'}
                  </span>
                  <span className="text-[11px] text-red-600 font-medium">Open Case File →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
