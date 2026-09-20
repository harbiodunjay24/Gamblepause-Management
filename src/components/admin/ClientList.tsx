import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Client, ClientStatus, StaffUser } from '../../types';
import { dataService } from '../../services/dataService';
import { NIGERIAN_STATES } from '../../data/demoData';

interface ClientListProps {
  currentUser: StaffUser;
  onSelectClient: (client: Client) => void;
  onNewClientClick: () => void;
}

export const ClientList: React.FC<ClientListProps> = ({
  currentUser,
  onSelectClient,
  onNewClientClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [counsellorFilter, setCounsellorFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const clients = dataService.getClients();
  const staff = dataService.getStaff();

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Search matching: ID, name, email, phone
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesName = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q);
        const matchesEmail = c.email.toLowerCase().includes(q);
        const matchesPhone = c.phone.replace(/[^0-9]/g, '').includes(q.replace(/[^0-9]/g, ''));
        const matchesLocation = c.location.toLowerCase().includes(q) || c.state.toLowerCase().includes(q);

        if (!matchesId && !matchesName && !matchesEmail && !matchesPhone && !matchesLocation) {
          return false;
        }
      }

      // Filter by status
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;

      // Filter by counsellor
      if (counsellorFilter !== 'all' && c.assignedCounsellorId !== counsellorFilter) return false;

      // Filter by state
      if (stateFilter !== 'all' && c.state !== stateFilter) return false;

      return true;
    });
  }, [clients, searchQuery, statusFilter, counsellorFilter, stateFilter]);

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
            <option value="Active">Active</option>
            <option value="Assessment Due">Assessment Due</option>
            <option value="Overdue">Overdue</option>
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
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 font-medium focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="all">All States</option>
            {NIGERIAN_STATES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {(searchQuery || statusFilter !== 'all' || counsellorFilter !== 'all' || stateFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setCounsellorFilter('all');
                setStateFilter('all');
              }}
              className="text-red-600 hover:text-red-700 font-bold ml-auto"
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
                  const isDue = client.status === 'Assessment Due';
                  const isOverdue = client.status === 'Overdue';

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
                        <div className="font-semibold text-gray-800">{client.state}</div>
                        <div className="text-[11px] text-gray-500 truncate max-w-[140px]">{client.location}</div>
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
                        {client.nextAssessmentDueDate && (
                          <div
                            className={`text-[11px] font-semibold ${
                              isOverdue ? 'text-red-600' : isDue ? 'text-amber-600' : 'text-gray-400'
                            }`}
                          >
                            {new Date(client.nextAssessmentDueDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </div>
                        )}
                      </td>

                      {/* Assigned Counsellor */}
                      <td className="py-4 px-4">
                        <div className="font-medium text-gray-900">
                          {client.assignedCounsellorName || (
                            <span className="text-gray-400 italic">Unassigned</span>
                          )}
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
