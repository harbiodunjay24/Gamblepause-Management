import React, { useState } from 'react';
import {
  Users,
  Shield,
  UserCheck,
  Lock,
  Mail,
  Phone,
  Plus,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { authService } from '../../services/authService';
import { StaffUser, UserRole } from '../../types';

interface StaffAndRolesProps {
  currentUser: StaffUser;
  onSwitchUser: (staff: StaffUser) => void;
}

export const StaffAndRoles: React.FC<StaffAndRolesProps> = ({ currentUser, onSwitchUser }) => {
  const staff = dataService.getStaff();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Counsellor' as UserRole,
  });

  // Password change state for Super Admin
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.name || !newStaff.email) return;

    const staffMember: StaffUser = {
      id: `staff-${Date.now()}`,
      name: newStaff.name.trim(),
      email: newStaff.email.trim().toLowerCase(),
      phone: newStaff.phone.trim(),
      role: newStaff.role,
      assignedClientsCount: 0,
      active: true,
    };

    dataService.saveStaffUser(staffMember);

    // Also provision login credentials in authService
    await authService.createStaffAccount(staffMember, 'Gamblepause');

    setShowAddModal(false);
    setNewStaff({ name: '', email: '', phone: '', role: 'Counsellor' });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (newPwd !== confirmPwd) {
      setPwdError('New passwords do not match.');
      return;
    }
    if (newPwd.length < 6) {
      setPwdError('Password must be at least 6 characters long.');
      return;
    }

    setIsChangingPwd(true);
    try {
      const res = await authService.changePassword(currentPwd, newPwd);
      if (res.success) {
        setPwdSuccess('Password changed successfully. Your new credentials are now active.');
        setCurrentPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        setPwdError(res.error || 'Failed to change password. Please check your current password.');
      }
    } catch (err: any) {
      setPwdError(err.message || 'Error changing password.');
    } finally {
      setIsChangingPwd(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-950 tracking-tight">
            Role-Based Access Control & Staff Directory
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage authorized GamblePause clinical staff, counsellors, and system credentials.
          </p>
        </div>

        {currentUser.role === 'Super Admin' && (
          <button
            onClick={() => setShowAddModal(true)}
            id="add-staff-member-btn"
            className="inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl shadow-md shadow-red-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Counsellor / Staff</span>
          </button>
        )}
      </div>

      {/* Super Admin Security & Password Management */}
      {currentUser.role === 'Super Admin' && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Super User Security & Password Update
                </h3>
                <p className="text-xs text-gray-500">
                  Securely update password for currently active Super User account ({currentUser.name}).
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
              Super User Access
            </span>
          </div>

          {pwdError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{pwdError}</span>
            </div>
          )}

          {pwdSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{pwdSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="Current password"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="New password (min 6 chars)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Re-type new password"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isChangingPwd || !currentPwd || !newPwd}
                className="w-full py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isChangingPwd ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {staff.map((member) => {
          const isCurrentUser = member.id === currentUser.id;
          return (
            <div
              key={member.id}
              className={`bg-white rounded-2xl p-5 border transition-all space-y-4 ${
                isCurrentUser
                  ? 'border-red-600 ring-2 ring-red-500/20 shadow-md'
                  : 'border-gray-200 shadow-sm hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-900 text-white font-black text-sm flex items-center justify-center">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
                      {member.name}
                      {isCurrentUser && (
                        <span className="text-[10px] bg-red-50 text-red-700 font-bold px-1.5 py-0.2 rounded border border-red-200">
                          Active
                        </span>
                      )}
                    </h3>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        member.role === 'Super Admin'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : member.role === 'Counsellor'
                          ? 'bg-gray-100 text-gray-800 border-gray-200'
                          : 'bg-gray-50 text-gray-700 border-gray-200'
                      }`}
                    >
                      {member.role === 'Super Admin' ? 'Super User' : member.role}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-gray-600 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span className="truncate">{member.email}</span>
                </div>
                {member.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span>{member.phone}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                {!isCurrentUser ? (
                  <button
                    type="button"
                    onClick={() => onSwitchUser(member)}
                    className="w-full py-2 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Switch to this Profile</span>
                  </button>
                ) : (
                  <div className="text-center text-[11px] font-bold text-red-600 bg-red-50 py-1.5 rounded-lg">
                    Current Session Operator
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Role Permissions Matrix</h2>
          <p className="text-xs text-gray-500">
            Security boundary enforcement as defined in GamblePause information governance rules.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-700 uppercase tracking-wider text-[10px] font-bold border-b border-gray-200">
              <tr>
                <th className="py-3 px-4">Feature / Capability</th>
                <th className="py-3 px-4 text-center">Super Admin</th>
                <th className="py-3 px-4 text-center">Counsellor</th>
                <th className="py-3 px-4 text-center">Analyst / Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { feature: 'View Dashboard Metrics & Aggregate Analytics', sa: true, co: true, an: true },
                { feature: 'View Client PII (Name, Phone, Email, Location)', sa: true, co: true, an: false },
                { feature: 'Register New Clients & Start Assessments', sa: true, co: true, an: false },
                { feature: 'Log Confidential Clinical Case Notes', sa: true, co: true, an: false },
                { feature: 'Reassign Counsellor & Update Status', sa: true, co: true, an: false },
                { feature: 'Configure Assessment Forms & Questions', sa: true, co: false, an: false },
                { feature: 'Configure Workflow Sequence & Delay Intervals', sa: true, co: false, an: false },
                { feature: 'Manage Staff Members & Roles', sa: true, co: false, an: false },
                { feature: 'Export Anonymized CSV Datasets', sa: true, co: false, an: true },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-800">{row.feature}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold leading-5">✓</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.co ? (
                      <span className="inline-block w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold leading-5">✓</span>
                    ) : (
                      <span className="text-gray-300 font-bold">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.an ? (
                      <span className="inline-block w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold leading-5">✓</span>
                    ) : (
                      <span className="text-gray-300 font-bold">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-2xl max-w-md w-full space-y-4">
            <h3 className="text-base font-bold text-gray-950">Add Authorized Staff Member</h3>

            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Ngozi Okonjo"
                  value={newStaff.name}
                  onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="counsellor@gamblepause.org"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Phone Number</label>
                <input
                  type="tel"
                  placeholder="+234 803 123 4567"
                  value={newStaff.phone}
                  onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Designated Role</label>
                <select
                  value={newStaff.role}
                  onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value as UserRole })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="Counsellor">Counsellor</option>
                  <option value="Staff">Registration / Staff User</option>
                  <option value="Analyst">Analyst / Viewer</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  *Designated Super Users: Abiodun Ayodeji and Ladipo Abiose. New staff members can be assigned as Counsellor, Staff, or Analyst.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
