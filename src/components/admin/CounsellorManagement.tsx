import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Archive,
  RefreshCw,
  Eye,
  ShieldCheck,
  FileText,
  Clock,
  Phone,
  Mail,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { StaffUser, Client } from '../../types';

interface CounsellorManagementProps {
  currentUser: StaffUser;
  onSelectClient?: (client: Client) => void;
  onNavigateTab?: (tab: string) => void;
}

export const CounsellorManagement: React.FC<CounsellorManagementProps> = ({
  currentUser,
  onSelectClient,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingCounsellor, setViewingCounsellor] = useState<StaffUser | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New counsellor form state
  const [newCounsellorName, setNewCounsellorName] = useState('');
  const [newCounsellorEmail, setNewCounsellorEmail] = useState('');
  const [newCounsellorPhone, setNewCounsellorPhone] = useState('');

  const staff = dataService.getStaff();
  const allClients = dataService.getClients();

  // Filter staff to role = 'Counsellor' and compute live active clients
  const counsellors = useMemo(() => {
    return staff
      .filter((s) => s.role === 'Counsellor')
      .map((c) => {
        const activeClients = allClients.filter(
          (cl) => cl.assignedCounsellorId === c.id && cl.status !== 'Closed' && cl.status !== 'Completed'
        );
        const totalClients = allClients.filter((cl) => cl.assignedCounsellorId === c.id);
        const status = c.active !== false ? 'Active' : 'Inactive';
        return {
          ...c,
          assignedClientsCount: activeClients.length,
          totalCaseload: totalClients.length,
          status,
        };
      });
  }, [staff, allClients]);

  const activeCount = counsellors.filter((c) => c.status === 'Active').length;
  const inactiveCount = counsellors.filter((c) => c.status === 'Inactive').length;

  const filteredCounsellors = useMemo(() => {
    return counsellors.filter((c) => {
      if (filter === 'active' && c.status !== 'Active') return false;
      if (filter === 'inactive' && c.status !== 'Inactive') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesEmail = c.email.toLowerCase().includes(q);
        const matchesPhone = (c.phone || '').toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      return true;
    });
  }, [counsellors, filter, searchQuery]);

  const handleDeactivate = async (counsellor: StaffUser) => {
    const res = await dataService.setCounsellorStatus(counsellor.id, false);
    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: `Counsellor ${counsellor.name} has been deactivated. They will no longer appear in new client assignment dropdowns.`,
      });
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'Failed to update counsellor status.' });
    }
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleReactivate = async (counsellor: StaffUser) => {
    const res = await dataService.setCounsellorStatus(counsellor.id, true);
    if (res.success) {
      setFeedbackMessage({
        type: 'success',
        text: `Counsellor ${counsellor.name} has been reactivated. They are now available in the assignment dropdown.`,
      });
    } else {
      setFeedbackMessage({ type: 'error', text: res.error || 'Failed to reactivate counsellor.' });
    }
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleCreateCounsellor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCounsellorName.trim() || !newCounsellorEmail.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Name and email are required.' });
      return;
    }

    const newStaff: StaffUser = {
      id: `counsellor-${Date.now()}`,
      name: newCounsellorName.trim(),
      email: newCounsellorEmail.trim().toLowerCase(),
      phone: newCounsellorPhone.trim() || '+234 800 000 0000',
      role: 'Counsellor',
      assignedClientsCount: 0,
      active: true,
    };

    await dataService.saveStaffUser(newStaff);
    setShowAddModal(false);
    setNewCounsellorName('');
    setNewCounsellorEmail('');
    setNewCounsellorPhone('');
    setFeedbackMessage({
      type: 'success',
      text: `Counsellor ${newStaff.name} created successfully and added to active database.`,
    });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-xs font-bold text-gray-500 hover:text-gray-900 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
              Counsellor Management
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded">
              GamblePause Roster
            </span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Official GamblePause clinical team directory. Manage active status, caseloads, and assignment eligibility.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            id="btn-add-counsellor"
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Counsellor</span>
          </button>
        </div>
      </div>

      {/* Metric Counters & Filter Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Active Counsellors</span>
            <div className="text-3xl font-black text-emerald-600 mt-1">{activeCount}</div>
            <p className="text-[11px] text-gray-400 mt-0.5">Available for client assignments</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inactive Counsellors</span>
            <div className="text-3xl font-black text-gray-600 mt-1">{inactiveCount}</div>
            <p className="text-[11px] text-gray-400 mt-0.5">Excluded from assignment dropdown</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-500">
            <UserX className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Active Caseload</span>
            <div className="text-3xl font-black text-red-600 mt-1">
              {counsellors.reduce((acc, c) => acc + c.assignedClientsCount, 0)}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">Clients currently supported</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Filter:</span>
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                filter === tab
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'all' ? `All (${counsellors.length})` : tab === 'active' ? `Active (${activeCount})` : `Inactive (${inactiveCount})`}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Counsellor Cards & Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-800">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Counsellor</th>
                <th className="px-5 py-3.5">Contact Details</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-center">Active Clients</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredCounsellors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 font-medium">
                    No counsellors found matching this filter.
                  </td>
                </tr>
              ) : (
                filteredCounsellors.map((c) => {
                  const isActive = c.status === 'Active';
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs ${
                              isActive ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            {c.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .substring(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">{c.name}</div>
                            <div className="text-[11px] text-gray-400">ID: {c.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span>{c.email}</span>
                          </div>
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 font-semibold text-gray-700">
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                          {c.role}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <span
                          className={`font-black text-sm px-2.5 py-0.5 rounded-md ${
                            c.assignedClientsCount > 0
                              ? 'bg-red-50 text-red-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {c.assignedClientsCount}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingCounsellor(c)}
                            title="View Caseload"
                            className="p-1.5 text-gray-600 hover:text-gray-950 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isActive ? (
                            <button
                              onClick={() => handleDeactivate(c)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(c)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Caseload Modal */}
      {viewingCounsellor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gray-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-black text-gray-900">
                  {viewingCounsellor.name} — Assigned Clients
                </h2>
                <p className="text-xs text-gray-500">
                  {viewingCounsellor.email} | {viewingCounsellor.phone || 'No phone'}
                </p>
              </div>
              <button
                onClick={() => setViewingCounsellor(null)}
                className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {allClients.filter((cl) => cl.assignedCounsellorId === viewingCounsellor.id).length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">
                  No clients currently assigned to this counsellor.
                </p>
              ) : (
                allClients
                  .filter((cl) => cl.assignedCounsellorId === viewingCounsellor.id)
                  .map((cl) => (
                    <div
                      key={cl.id}
                      onClick={() => {
                        if (onSelectClient) {
                          onSelectClient(cl);
                          setViewingCounsellor(null);
                        }
                      }}
                      className="p-3 bg-gray-50 hover:bg-red-50/50 rounded-xl border border-gray-200 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-bold text-xs text-gray-900">
                          {cl.firstName} {cl.lastName} ({cl.id})
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Stage: {cl.currentStageName} | State: {cl.state}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white border border-gray-200 text-gray-700">
                        {cl.status}
                      </span>
                    </div>
                  ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingCounsellor(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Counsellor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gray-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-lg font-black text-gray-900">Add New Counsellor</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCounsellor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCounsellorName}
                  onChange={(e) => setNewCounsellorName(e.target.value)}
                  placeholder="e.g. Dr. Kemi Johnson"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newCounsellorEmail}
                  onChange={(e) => setNewCounsellorEmail(e.target.value)}
                  placeholder="e.g. kemi.johnson@gamblepause.org"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={newCounsellorPhone}
                  onChange={(e) => setNewCounsellorPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-xl text-[11px] text-gray-600">
                Initial password will be set to: <strong>Gamblepause</strong>. The counsellor can change their password on first login.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Create Counsellor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
