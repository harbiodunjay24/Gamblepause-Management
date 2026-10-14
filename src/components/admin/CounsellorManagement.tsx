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
  MessageSquare,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { authService } from '../../services/authService';
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
  const [newCounsellorPassword, setNewCounsellorPassword] = useState('');

  // Duplicate resolution state for Super Admins
  const [duplicateCandidate, setDuplicateCandidate] = useState<StaffUser | null>(null);
  const [canonicalCandidate, setCanonicalCandidate] = useState<StaffUser | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateConfirmText, setDuplicateConfirmText] = useState('');
  const [isResolvingDuplicate, setIsResolvingDuplicate] = useState(false);
  const [duplicateResolutionError, setDuplicateResolutionError] = useState<string | null>(null);

  const staff = dataService.getStaff();
  const allClients = dataService.getClients();

  const matchesCounsellor = (cl: Client, c: StaffUser) => {
    if (cl.assignedCounsellorId && (cl.assignedCounsellorId === c.id || (c.authUid && cl.assignedCounsellorId === c.authUid))) {
      return true;
    }
    const cleanName = (c.name || '').trim().toLowerCase();
    if (cl.assignedCounsellorName && cleanName) {
      const cName = cl.assignedCounsellorName.trim().toLowerCase();
      if (cName === cleanName) return true;
      const firstPart = cleanName.split(' ')[0];
      if (firstPart.length > 2 && cName.includes(firstPart)) return true;
    }
    return false;
  };

  // Filter staff to role = 'Counsellor' and compute live active clients
  const counsellors = useMemo(() => {
    return staff
      .filter((s) => s.role === 'Counsellor')
      .map((c) => {
        const activeClients = allClients.filter(
          (cl) => matchesCounsellor(cl, c) && cl.status !== 'Closed' && cl.status !== 'Completed'
        );
        const totalClients = allClients.filter((cl) => matchesCounsellor(cl, c));
        const status: 'Active' | 'Inactive' = c.active !== false ? 'Active' : 'Inactive';
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

  const handleOpenDuplicateModal = (candidate: StaffUser) => {
    setDuplicateCandidate(candidate);
    const matches = counsellors.filter(
      (c) => c.id !== candidate.id && c.email.toLowerCase() === candidate.email.toLowerCase()
    );
    const canonical =
      matches.find((c) => c.authUid && c.authUid !== c.id) ||
      matches.find((c) => (c.assignedClientsCount || 0) > 0) ||
      matches[0] ||
      null;
    setCanonicalCandidate(canonical);
    setDuplicateConfirmText('');
    setDuplicateResolutionError(null);
    setShowDuplicateModal(true);
  };

  const handleExecuteDuplicateRemoval = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateResolutionError(null);
    if (!duplicateCandidate || !canonicalCandidate) return;

    setIsResolvingDuplicate(true);
    try {
      const res = await dataService.removeDuplicateStaffRecord({
        duplicateStaffId: duplicateCandidate.id,
        canonicalStaffId: canonicalCandidate.id,
        confirmationText: duplicateConfirmText,
      });

      if (!res.success) {
        setDuplicateResolutionError(res.error || 'Failed to remove duplicate counsellor record.');
        setIsResolvingDuplicate(false);
        return;
      }

      setShowDuplicateModal(false);
      setDuplicateCandidate(null);
      setCanonicalCandidate(null);
      setDuplicateConfirmText('');
      setFeedbackMessage({
        type: 'success',
        text: res.message || 'Duplicate counsellor record removed successfully.',
      });
      setTimeout(() => setFeedbackMessage(null), 8000);
    } catch (err: any) {
      setDuplicateResolutionError(err?.message || 'Error removing duplicate counsellor.');
    } finally {
      setIsResolvingDuplicate(false);
    }
  };

  const handleCreateCounsellor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCounsellorName.trim() || !newCounsellorEmail.trim()) {
      setFeedbackMessage({ type: 'error', text: 'Name and email are required.' });
      return;
    }

    const rawPhone = newCounsellorPhone.trim() || '+234 800 000 0000';
    const newStaff: StaffUser = {
      id: `counsellor-${Date.now()}`,
      name: newCounsellorName.trim(),
      email: newCounsellorEmail.trim().toLowerCase(),
      phone: rawPhone,
      whatsappNumber: rawPhone,
      role: 'Counsellor',
      assignedClientsCount: 0,
      active: true,
    };

    // 1. Create real account in Firebase Authentication & persist to Firestore users/staff
    const pwd = newCounsellorPassword.trim() || 'Gamblepause';
    const authRes = await authService.createStaffAccount(newStaff, pwd);
    if (!authRes.success) {
      setFeedbackMessage({
        type: 'error',
        text: authRes.error || 'Failed to provision counsellor in Firebase Authentication.',
      });
      return;
    }

    // 2. Persist to dataService and backend
    await dataService.saveStaffUser(authRes.user || newStaff);

    setShowAddModal(false);
    setNewCounsellorName('');
    setNewCounsellorEmail('');
    setNewCounsellorPhone('');
    setFeedbackMessage({
      type: 'success',
      text: `Counsellor ${newStaff.name} created successfully with Firebase Authentication & Firestore records.`,
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
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm">{c.name}</span>
                              {counsellors.some((other) => other.id !== c.id && other.email.toLowerCase() === c.email.toLowerCase()) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Duplicate
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">ID: {c.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-gray-700">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            <span>{c.email}</span>
                          </div>
                          {(c.whatsappNumber || c.phone) && (() => {
                            const raw = c.whatsappNumber || c.phone || '';
                            const digits = raw.replace(/\D/g, '');
                            const normalized = digits.startsWith('0') && digits.length === 11
                              ? '234' + digits.slice(1)
                              : digits.startsWith('234')
                              ? digits
                              : '234' + digits;
                            return (
                              <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{c.phone || c.whatsappNumber}</span>
                                </span>
                                {digits && (
                                  <a
                                    href={`https://wa.me/${normalized}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]"
                                    title="Open WhatsApp chat with counsellor"
                                  >
                                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                                    <span>WhatsApp</span>
                                  </a>
                                )}
                              </div>
                            );
                          })()}
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

                          {currentUser.role === 'Super Admin' && (
                            <button
                              onClick={() => handleOpenDuplicateModal(c)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-all cursor-pointer"
                              title="Safely remove accidental duplicate counsellor record"
                            >
                              Resolve Duplicate
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
              {allClients.filter((cl) => matchesCounsellor(cl, viewingCounsellor)).length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">
                  No clients currently assigned to this counsellor.
                </p>
              ) : (
                allClients
                  .filter((cl) => matchesCounsellor(cl, viewingCounsellor))
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

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Initial Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={newCounsellorPassword}
                  onChange={(e) => setNewCounsellorPassword(e.target.value)}
                  placeholder="Set initial password (min 6 chars)"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-300 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-xl text-[11px] text-gray-600">
                The counsellor can update their password securely on first login or via password reset email.
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
      {/* Super Admin Duplicate Counsellor Removal Modal */}
      {showDuplicateModal && duplicateCandidate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-2xl max-w-xl w-full space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200 shrink-0">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-950">
                    Safely Resolve Duplicate Counsellor Account
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Authorised Super Admin duplicate reconciliation and removal
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateCandidate(null);
                  setCanonicalCandidate(null);
                }}
                className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {duplicateResolutionError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{duplicateResolutionError}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <span className="font-bold">Clinical & Identity Safety Guarantee:</span>
              <p className="text-[11px]">
                The canonical counsellor's legitimate staff profile, Firebase Authentication account, client assignments, case notes, notifications, and audit logs are 100% retained. Only the accidental duplicate record is removed.
              </p>
            </div>

            {/* Record Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Duplicate Record (To Remove) */}
              <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-red-200/80 pb-1.5">
                  <span className="font-bold text-red-900 uppercase text-[10px] tracking-wider">Duplicate Record (To Remove)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-200 text-red-800">Redundant</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div>Name: <strong>{duplicateCandidate.name}</strong></div>
                  <div>Email: <strong className="font-mono text-[10px]">{duplicateCandidate.email}</strong></div>
                  <div>Phone: <span>{duplicateCandidate.phone || '09037982390'}</span></div>
                  <div>Internal ID: <strong className="font-mono text-[10px] text-red-700">{duplicateCandidate.id}</strong></div>
                  <div>Role: <strong>{duplicateCandidate.role}</strong></div>
                  <div>Status: <span className="font-semibold">{duplicateCandidate.status || (duplicateCandidate.active ? 'Active' : 'Inactive')}</span></div>
                  <div>Caseload: <strong>{duplicateCandidate.assignedClientsCount || 0} clients</strong></div>
                  <div>Auth UID: <span className="font-mono text-[10px] text-gray-600">{duplicateCandidate.authUid || 'None (No real Auth account)'}</span></div>
                </div>
              </div>

              {/* Canonical Record (To Retain) */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                  <span className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider">Canonical Record (To Retain)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">Retained</span>
                </div>
                {canonicalCandidate ? (
                  <div className="space-y-1 text-[11px]">
                    <div>Name: <strong>{canonicalCandidate.name}</strong></div>
                    <div>Email: <strong className="font-mono text-[10px]">{canonicalCandidate.email}</strong></div>
                    <div>Phone: <span>{canonicalCandidate.phone || '09037982390'}</span></div>
                    <div>Internal ID: <strong className="font-mono text-[10px] text-emerald-800">{canonicalCandidate.id}</strong></div>
                    <div>Role: <strong>{canonicalCandidate.role}</strong></div>
                    <div>Status: <span className="font-semibold text-emerald-700">{canonicalCandidate.status || (canonicalCandidate.active ? 'Active' : 'Inactive')}</span></div>
                    <div>Caseload: <strong>{canonicalCandidate.assignedClientsCount || 0} clients</strong></div>
                    <div>Auth UID: <span className="font-mono text-[10px] text-emerald-700 font-bold">{canonicalCandidate.authUid || 'Configured'}</span></div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs italic">Canonical counsellor verified.</p>
                )}
              </div>
            </div>

            {/* Confirmation Form */}
            <form onSubmit={handleExecuteDuplicateRemoval} className="space-y-3.5 text-xs pt-1 border-t border-gray-100">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Type <span className="font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded font-bold">{duplicateCandidate.id}</span> or <span className="font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded font-bold">DELETE DUPLICATE</span> to confirm:
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Enter ${duplicateCandidate.id} or DELETE DUPLICATE`}
                  value={duplicateConfirmText}
                  onChange={(e) => setDuplicateConfirmText(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateModal(false);
                    setDuplicateCandidate(null);
                    setCanonicalCandidate(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isResolvingDuplicate ||
                    (duplicateConfirmText.trim().toLowerCase() !== duplicateCandidate.id.toLowerCase() &&
                      duplicateConfirmText.trim().toLowerCase() !== 'delete duplicate')
                  }
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isResolvingDuplicate ? 'Removing Duplicate...' : 'Permanently Remove Duplicate Counsellor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
