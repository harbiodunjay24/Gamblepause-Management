import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  UserPlus,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  AlertCircle,
  Clock,
  Shield,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { Client, ClientStatus, StaffUser } from '../../types';
import {
  dataService,
  matchClientSearch,
  isClientUpcomingDue,
  isClientOverdue,
  isClientActiveInPathway,
} from '../../services/dataService';
import { NIGERIAN_STATES } from '../../data/demoData';

interface ClientListProps {
  currentUser: StaffUser;
  onSelectClient: (client: Client) => void;
  onNewClientClick: () => void;
  initialFilter?: string;
}

export const ClientList: React.FC<ClientListProps> = ({
  currentUser,
  onSelectClient,
  onNewClientClick,
  initialFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter || 'all');
  const [counsellorFilter, setCounsellorFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
    }
  }, [initialFilter]);

  // Subscribe to dataService updates (e.g. real-time Firestore sync across devices)
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = dataService.subscribe(() => {
      setTick((t) => t + 1);
    });
    return () => unsub();
  }, []);

  const isLoaded = dataService.isAuthoritativeLoaded();
  const clients = dataService.getClients();
  const staff = dataService.getStaff();

  // Extract available countries
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

  // Extract available states for chosen country
  const availableStates = useMemo(() => {
    const set = new Set<string>();
    const countryClients = countryFilter === 'all'
      ? clients
      : clients.filter((c) => {
          const cCountry = c.country || (NIGERIAN_STATES.includes(c.state) ? 'Nigeria' : 'Not specified');
          return cCountry.toLowerCase() === countryFilter.toLowerCase();
        });

    countryClients.forEach((c) => {
      if (c.state && c.state !== 'Not specified') {
        set.add(c.state);
      }
    });

    if (countryFilter === 'Nigeria' || countryFilter === 'all') {
      NIGERIAN_STATES.forEach((s) => set.add(s));
    }
    set.add('Not specified');
    return Array.from(set).sort((a, b) => {
      if (a === 'Not specified') return 1;
      if (b === 'Not specified') return -1;
      return a.localeCompare(b);
    });
  }, [clients, countryFilter]);

  const upcomingCount = useMemo(() => clients.filter((c) => isClientUpcomingDue(c)).length, [clients]);
  const overdueCount = useMemo(() => clients.filter((c) => isClientOverdue(c)).length, [clients]);
  const activeCount = useMemo(() => clients.filter((c) => isClientActiveInPathway(c)).length, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Crash-proof search matching: ID, name, email, phone, location, country, counsellor
      if (searchQuery.trim() && !matchClientSearch(c, searchQuery)) {
        return false;
      }

      // Filter by status / upcoming / overdue (AND logic)
      if (statusFilter === 'Upcoming Due') {
        if (!isClientUpcomingDue(c)) return false;
      } else if (statusFilter === 'Overdue') {
        if (!isClientOverdue(c)) return false;
      } else if (statusFilter === 'Active' || statusFilter === 'active') {
        if (!isClientActiveInPathway(c)) return false;
      } else if (statusFilter === 'Completed' || statusFilter === 'completed') {
        if (isClientActiveInPathway(c)) return false;
      } else if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      // Filter by counsellor (AND logic)
      if (counsellorFilter !== 'all' && c.assignedCounsellorId !== counsellorFilter) return false;

      // Filter by country (AND logic)
      if (countryFilter !== 'all') {
        const cCountry = c.country || (NIGERIAN_STATES.includes(c.state) ? 'Nigeria' : 'Not specified');
        if ((cCountry || '').toLowerCase() !== countryFilter.toLowerCase()) return false;
      }

      // Filter by state (AND logic)
      if (stateFilter !== 'all') {
        const cState = c.state || 'Not specified';
        if ((cState || '').toLowerCase() !== stateFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [clients, searchQuery, statusFilter, counsellorFilter, countryFilter, stateFilter]);

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
            <p className="text-sm font-bold text-gray-800">Loading client directory from Cloud Firestore...</p>
            <p className="text-xs text-gray-400">Verifying authoritative records</p>
          </div>
        </div>
      </div>
    );
  }

  const copyAssessmentLink = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${window.location.origin}/a/${client.secureAccessKey}`;
    navigator.clipboard.writeText(link);
    setCopiedKey(client.id);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const getStatusBadge = (status: ClientStatus) => {
    switch (status) {
      case 'Active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Assessment Due':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Overdue':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Completed':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'Awaiting Assessment':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-center justify-center py-24">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
            <p className="text-sm font-semibold text-gray-700">Loading authoritative client records...</p>
            <p className="text-xs text-gray-400">Connecting to Cloud Firestore...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Client Registry & Case Files
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Search, filter, and review client assessment records across Nigeria.
          </p>
        </div>

        <button
          id="add-new-client-btn"
          onClick={onNewClientClick}
          className="inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl shadow-md shadow-red-500/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Client</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-sm space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
          <input
            type="text"
            id="client-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Client ID (e.g. GP-0001), Name, Phone, Email, or Nigerian City..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50/70 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Quick Filter Status Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-gray-100 pb-3">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-gray-950 text-white shadow-xs'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            All Clients ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Upcoming Due')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'Upcoming Due'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
            }`}
          >
            Upcoming Due ({upcomingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Overdue')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'Overdue'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
            }`}
          >
            Overdue ({overdueCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('Active')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              statusFilter === 'Active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
            }`}
          >
            Active Pathway ({activeCount})
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-gray-400 font-semibold flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-red-600" />
            Filters:
          </span>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="all">All Statuses ({clients.length})</option>
            <option value="Upcoming Due">Upcoming Due ({upcomingCount})</option>
            <option value="Overdue">Overdue ({overdueCount})</option>
            <option value="Active">Active ({activeCount})</option>
            <option value="Assessment Due">Assessment Due</option>
            <option value="Completed">Completed</option>
            <option value="Awaiting Assessment">Awaiting Assessment</option>
          </select>

          <select
            value={counsellorFilter}
            onChange={(e) => setCounsellorFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="all">All Counsellors</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role})
              </option>
            ))}
          </select>

          <select
            value={countryFilter}
            onChange={(e) => {
              setCountryFilter(e.target.value);
              setStateFilter('all');
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
          >
            <option value="all">All Countries</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
          >
            <option value="all">All States</option>
            {availableStates.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {(searchQuery ||
            statusFilter !== 'all' ||
            counsellorFilter !== 'all' ||
            countryFilter !== 'all' ||
            stateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setCounsellorFilter('all');
                setCountryFilter('all');
                setStateFilter('all');
              }}
              className="text-red-600 hover:text-red-700 font-bold ml-auto cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Client Table / Cards */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-500">
          <span>Found {filteredClients.length} clients</span>
          <span className="text-[11px] text-gray-400">Click any row to open the complete Case File</span>
        </div>

        {filteredClients.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-800">No clients match your filter criteria</p>
            <p className="text-xs text-gray-500 mt-1">Try clearing your search term or adjusting filters.</p>
            {(searchQuery.trim() || statusFilter !== 'all' || counsellorFilter !== 'all' || countryFilter !== 'all' || stateFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCounsellorFilter('all');
                  setCountryFilter('all');
                  setStateFilter('all');
                }}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Clear Search & Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" id="client-management-table">
              <thead className="bg-gray-50/80 text-gray-700 font-bold border-b border-gray-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">Client ID</th>
                  <th className="py-3.5 px-4">Client Name & Demographics</th>
                  <th className="py-3.5 px-4">State & Location</th>
                  <th className="py-3.5 px-4">Current Stage</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Next Assessment</th>
                  <th className="py-3.5 px-4">Assigned Counsellor</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.map((client) => {
                  const isDue = client.status === 'Assessment Due' || (Boolean(client.nextAssessmentDueDate) && new Date(client.nextAssessmentDueDate!).toDateString() === new Date().toDateString());
                  const isOverdue = isClientOverdue(client);
                  const isUpcoming = isClientUpcomingDue(client);

                  return (
                    <tr
                      key={client.id}
                      onClick={() => onSelectClient(client)}
                      className="hover:bg-red-50/20 transition-colors cursor-pointer group"
                    >
                      {/* Client ID */}
                      <td className="py-4 px-4 font-mono font-bold text-gray-950">
                        <span className="bg-gray-100 group-hover:bg-red-100 group-hover:text-red-700 px-2 py-1 rounded text-xs transition-colors">
                          {client.id}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                            {client.firstName} {client.lastName}
                          </span>
                          {client.isDemo && (
                            <span className="text-[9px] font-extrabold uppercase tracking-wider bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                              DEMO DATA
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {client.age} yrs • {client.gender} • {client.occupation}
                        </div>
                      </td>

                      {/* State & Location */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-gray-800 flex items-center gap-1.5 flex-wrap">
                          <span>{client.state}</span>
                          {client.country && client.country !== 'Nigeria' && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              {client.country}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate max-w-[150px]" title={client.location || client.address}>
                          {client.location || client.address || '—'}
                        </div>
                      </td>

                      {/* Current Stage */}
                      <td className="py-4 px-4">
                        <span className="font-semibold text-gray-800">{client.currentStageName}</span>
                        <div className="text-[10px] text-gray-400">
                          {client.totalAssessmentsCompleted} completed
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[11px] px-2.5 py-1 rounded-full border ${getStatusBadge(
                            client.status
                          )}`}
                        >
                          {isOverdue && <AlertCircle className="w-3 h-3 text-red-600" />}
                          {isDue && <Clock className="w-3 h-3 text-amber-600" />}
                          <span>{client.status}</span>
                        </span>
                      </td>

                      {/* Next Assessment & Due Date */}
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-800">
                          {client.nextAssessmentName || 'All Done'}
                        </div>
                        {client.nextAssessmentDueDate ? (
                          <div className="mt-0.5">
                            <span
                              className={`text-[11px] font-semibold ${
                                isOverdue ? 'text-red-600' : isDue ? 'text-amber-600' : 'text-blue-600'
                              }`}
                            >
                              {new Date(client.nextAssessmentDueDate).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            {isOverdue ? (
                              <span className="ml-1 text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">
                                Overdue
                              </span>
                            ) : isDue ? (
                              <span className="ml-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Due Today
                              </span>
                            ) : isUpcoming ? (
                              <span className="ml-1 text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                Scheduled Future
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-[11px] text-gray-400 italic">No due date</div>
                        )}
                      </td>

                      {/* Assigned Counsellor */}
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900 flex items-center gap-1.5">
                          <span>
                            {client.assignedCounsellorName || (
                              <span className="text-gray-400 italic">Unassigned</span>
                            )}
                          </span>
                          {(() => {
                            if (!client.assignedCounsellorId) return null;
                            const counsellor = staff.find((s) => s.id === client.assignedCounsellorId);
                            const rawPhone = counsellor?.whatsappNumber || counsellor?.phone;
                            if (!rawPhone) return null;
                            const digits = rawPhone.replace(/\D/g, '');
                            const normalized = digits.startsWith('0') && digits.length === 11
                              ? '234' + digits.slice(1)
                              : digits.startsWith('234')
                              ? digits
                              : '234' + digits;
                            return (
                              <a
                                href={`https://wa.me/${normalized}?text=${encodeURIComponent(`Hello ${counsellor?.name || 'Counsellor'},\n\nRegarding client: ${client.firstName} ${client.lastName} (${client.id})\nStage: ${client.currentStageName}\nStatus: ${client.status}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors"
                                title={`WhatsApp ${counsellor?.name} regarding this client`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                            );
                          })()}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => copyAssessmentLink(client, e)}
                            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                            title="Copy client's personal assessment link to send via SMS/WhatsApp"
                          >
                            {copiedKey === client.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 group-hover:text-red-600 group-hover:border-red-200 transition-colors"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
