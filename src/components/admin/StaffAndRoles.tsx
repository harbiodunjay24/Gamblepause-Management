import React, { useState } from 'react';
import {
  Users,
  Shield,
  UserCheck,
  UserX,
  Lock,
  Mail,
  Phone,
  Plus,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Eye,
  ShieldCheck,
  FileText,
  X,
  ExternalLink,
  Info,
  HelpCircle,
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { authService } from '../../services/authService';
import { StaffUser, UserRole } from '../../types';

interface StaffAndRolesProps {
  currentUser: StaffUser;
}

export const StaffAndRoles: React.FC<StaffAndRolesProps> = ({ currentUser }) => {
  const staff = dataService.getStaff();
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingStaff, setViewingStaff] = useState<StaffUser | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [newStaff, setNewStaff] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Counsellor' as UserRole,
    temporaryPassword: 'Gamblepause',
  });
  const [addStaffError, setAddStaffError] = useState<string | null>(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);

  // Email management modal state
  const [editingEmailUser, setEditingEmailUser] = useState<StaffUser | null>(null);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [customUidInput, setCustomUidInput] = useState('');
  const [confirmConsoleSync, setConfirmConsoleSync] = useState(false);
  const [isSyncingEmail, setIsSyncingEmail] = useState(false);
  const [emailSyncError, setEmailSyncError] = useState<string | null>(null);
  const [selfCurrentPassword, setSelfCurrentPassword] = useState('');

  // Generic Firebase Auth UID linking state
  const [linkingStaffUser, setLinkingStaffUser] = useState<StaffUser | null>(null);
  const [linkUidInput, setLinkUidInput] = useState('');
  const [isLinkingStaff, setIsLinkingStaff] = useState(false);
  const [linkStaffError, setLinkStaffError] = useState<string | null>(null);

  // Duplicate resolution state
  const [duplicateCandidate, setDuplicateCandidate] = useState<StaffUser | null>(null);
  const [canonicalCandidate, setCanonicalCandidate] = useState<StaffUser | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateConfirmText, setDuplicateConfirmText] = useState('');
  const [isResolvingDuplicate, setIsResolvingDuplicate] = useState(false);
  const [duplicateResolutionError, setDuplicateResolutionError] = useState<string | null>(null);

  // Manual Firebase Console Guide state
  const [showConsoleGuide, setShowConsoleGuide] = useState(false);

  // Password change state for Super Admin
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStaffError(null);

    if (!newStaff.name.trim() || !newStaff.email.trim()) {
      setAddStaffError('Name and email address are required.');
      return;
    }
    if (newStaff.temporaryPassword.length < 6) {
      setAddStaffError('Initial temporary password must be at least 6 characters long.');
      return;
    }

    setIsAddingStaff(true);
    try {
      const staffMember: StaffUser = {
        id: `staff-${Date.now()}`,
        name: newStaff.name.trim(),
        email: newStaff.email.trim().toLowerCase(),
        phone: newStaff.phone.trim() || '+234 800 000 0000',
        role: newStaff.role,
        assignedClientsCount: 0,
        active: true,
      };

      // 1. Create real account in Firebase Authentication & persist to Firestore users/staff
      const authRes = await authService.createStaffAccount(staffMember, newStaff.temporaryPassword);
      if (!authRes.success) {
        setAddStaffError(authRes.error || 'Failed to create user in Firebase Authentication.');
        setIsAddingStaff(false);
        return;
      }

      // 2. Persist to dataService
      await dataService.saveStaffUser(authRes.user || staffMember);

      setShowAddModal(false);
      setNewStaff({
        name: '',
        email: '',
        phone: '',
        role: 'Counsellor',
        temporaryPassword: 'Gamblepause',
      });
      setActionFeedback({
        type: 'success',
        message: `Account for ${staffMember.name} created successfully with Firebase Authentication & Firestore records.`,
      });
      setTimeout(() => setActionFeedback(null), 6000);
    } catch (err: any) {
      setAddStaffError(err.message || 'Error creating staff member.');
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleToggleStatus = async (member: StaffUser) => {
    const nextStatus = member.active === false ? true : false;
    const res = await dataService.setStaffStatus(member.id, nextStatus);
    if (res.success) {
      setActionFeedback({
        type: 'success',
        message: `Staff member ${member.name} has been ${nextStatus ? 'activated' : 'deactivated'}.`,
      });
      if (viewingStaff?.id === member.id) {
        setViewingStaff({ ...viewingStaff, active: nextStatus });
      }
    } else {
      setActionFeedback({
        type: 'error',
        message: res.error || 'Failed to update account status.',
      });
    }
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleSendPasswordReset = async (member: StaffUser) => {
    const res = await authService.sendStaffPasswordResetEmail(member.email);
    if (res.success) {
      setActionFeedback({
        type: 'success',
        message: `Password reset email sent to ${member.email}.`,
      });
    } else {
      setActionFeedback({
        type: 'error',
        message: res.error || `Failed to send password reset to ${member.email}.`,
      });
    }
    setTimeout(() => setActionFeedback(null), 5000);
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
        setPwdSuccess('Password changed successfully in Firebase Authentication. Your new credentials are now active.');
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

  const handleOpenChangeEmail = (member: StaffUser) => {
    setEditingEmailUser(member);
    setNewEmailInput('');
    setCustomUidInput(member.authUid || (member.id && !member.id.startsWith('staff-') ? member.id : ''));
    setConfirmConsoleSync(false);
    setEmailSyncError(null);
    setSelfCurrentPassword('');
  };

  const handleSyncUserEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmailUser) return;
    setEmailSyncError(null);

    const cleanEmail = newEmailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setEmailSyncError('Please enter a valid email address (e.g. employee@gamblepause.org).');
      return;
    }
    if (cleanEmail === editingEmailUser.email.toLowerCase()) {
      setEmailSyncError('The new email is identical to the current email.');
      return;
    }

    const isSelf =
      editingEmailUser.id === currentUser.id ||
      (editingEmailUser.authUid && currentUser.authUid && editingEmailUser.authUid === currentUser.authUid) ||
      editingEmailUser.email.toLowerCase() === currentUser.email.toLowerCase();

    const targetUid = customUidInput.trim() || editingEmailUser.authUid || editingEmailUser.id;
    if (!targetUid || targetUid.length < 5) {
      setEmailSyncError('A valid Firebase Authentication UID is required to synchronize the Firestore profile.');
      return;
    }

    setIsSyncingEmail(true);
    try {
      if (isSelf) {
        // Self email update through Firebase Authentication client flow
        const authRes = await authService.updateCurrentUserEmail(cleanEmail, selfCurrentPassword);
        if (!authRes.success) {
          setEmailSyncError(authRes.error || 'Failed to update email in Firebase Authentication.');
          setIsSyncingEmail(false);
          return;
        }

        // Synchronize Firestore profile
        await dataService.syncUserEmail({
          uid: targetUid,
          newEmail: cleanEmail,
          staffId: editingEmailUser.id,
        });

        setActionFeedback({
          type: 'success',
          message:
            authRes.message ||
            `Your email has been successfully updated to ${cleanEmail}. Firebase UID (${targetUid}) remained identical.`,
        });
      } else {
        // Another user: Ensure Super Admin confirmed manual update in Firebase Console
        if (!confirmConsoleSync) {
          setEmailSyncError('Please confirm that you have updated the email in Firebase Console first.');
          setIsSyncingEmail(false);
          return;
        }

        const res = await dataService.syncUserEmail({
          uid: targetUid,
          newEmail: cleanEmail,
          staffId: editingEmailUser.id,
        });

        if (!res.success) {
          setEmailSyncError(res.error || 'Failed to synchronize email in Firestore.');
          setIsSyncingEmail(false);
          return;
        }

        setActionFeedback({
          type: 'success',
          message: `Firestore profile email synchronized to ${cleanEmail} for ${editingEmailUser.name}. Permanent Firebase UID (${targetUid}) remained identical.`,
        });
      }

      setEditingEmailUser(null);
      setTimeout(() => setActionFeedback(null), 7000);
    } catch (err: any) {
      setEmailSyncError(err?.message || 'Error synchronizing email.');
    } finally {
      setIsSyncingEmail(false);
    }
  };

  const handleLinkStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkStaffError(null);
    if (!linkingStaffUser) return;

    const cleanUid = linkUidInput.trim();
    if (!cleanUid || cleanUid.length < 5) {
      setLinkStaffError('Please enter a valid Firebase Authentication UID copied from the Firebase Console.');
      return;
    }

    setIsLinkingStaff(true);
    try {
      const res = await dataService.linkStaffAuthAccount({
        staffId: linkingStaffUser.id,
        authUid: cleanUid,
      });

      if (!res.success) {
        setLinkStaffError(res.error || 'Failed to link staff member in Firestore.');
        setIsLinkingStaff(false);
        return;
      }

      setLinkingStaffUser(null);
      setLinkUidInput('');
      setActionFeedback({
        type: 'success',
        message: `Account for ${linkingStaffUser.name} (${linkingStaffUser.role}) linked successfully with Firebase UID: ${cleanUid}.`,
      });
      setTimeout(() => setActionFeedback(null), 7000);
    } catch (err: any) {
      setLinkStaffError(err?.message || 'Error linking Firebase Authentication account.');
    } finally {
      setIsLinkingStaff(false);
    }
  };

  const handleOpenDuplicateModal = (candidate: StaffUser) => {
    setDuplicateCandidate(candidate);
    // Find canonical counterpart: staff with same email or similar name having a valid authUid or oldest creation
    const matches = staff.filter((s) => s.id !== candidate.id && s.email.toLowerCase() === candidate.email.toLowerCase());
    const canonical = matches.find((s) => s.authUid && s.authUid !== s.id) || matches[0] || null;
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
        setDuplicateResolutionError(res.error || 'Failed to remove duplicate staff record.');
        setIsResolvingDuplicate(false);
        return;
      }

      setShowDuplicateModal(false);
      setDuplicateCandidate(null);
      setCanonicalCandidate(null);
      setDuplicateConfirmText('');
      setActionFeedback({
        type: 'success',
        message: res.message || 'Duplicate staff record removed successfully.',
      });
      setTimeout(() => setActionFeedback(null), 8000);
    } catch (err: any) {
      setDuplicateResolutionError(err?.message || 'Error removing duplicate staff record.');
    } finally {
      setIsResolvingDuplicate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification Banner */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-gray-400 hover:text-gray-700 ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                const unlinked = staff.find((s) => !s.authUid || s.authUid === s.id) || staff[0];
                setLinkingStaffUser(unlinked || null);
                setLinkUidInput(unlinked?.authUid || '');
                setLinkStaffError(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-800 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer shadow-xs"
              title="Link or synchronize any staff member using their Firebase Auth UID"
            >
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>Link Firebase UID</span>
            </button>
            <button
              onClick={() => {
                setAddStaffError(null);
                setShowAddModal(true);
              }}
              id="add-staff-member-btn"
              className="inline-flex items-center gap-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl shadow-md shadow-red-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Counsellor / Staff</span>
            </button>
          </div>
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
                  Securely update password for currently active Super User account ({currentUser.name} &bull; {currentUser.email}).
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

      {/* Duplicate Staff Detection Banner for Super Admins */}
      {currentUser.role === 'Super Admin' && (() => {
        const emailCounts = new Map<string, StaffUser[]>();
        staff.forEach((s) => {
          const em = s.email?.toLowerCase().trim();
          if (em) {
            const list = emailCounts.get(em) || [];
            list.push(s);
            emailCounts.set(em, list);
          }
        });
        const duplicateGroups = Array.from(emailCounts.entries()).filter(([_, list]) => list.length > 1);
        if (duplicateGroups.length === 0) return null;

        return (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-red-950">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <span className="font-bold">Duplicate Staff Entry Detected:</span> Found multiple records registered with email <span className="font-mono text-[11px] font-semibold">{duplicateGroups[0][0]}</span> ({duplicateGroups[0][1].length} entries).
                <p className="text-[11px] text-red-800 mt-0.5">Safely resolve duplicates to retain one legitimate account and eliminate orphaned records without losing clinical assignments.</p>
              </div>
            </div>
            <button
              onClick={() => {
                const group = duplicateGroups[0][1];
                // Determine duplicate: record with no real authUid or created later
                const dup = group.find((s) => !s.authUid || s.authUid === s.id) || group[1];
                handleOpenDuplicateModal(dup);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
            >
              Resolve Duplicate
            </button>
          </div>
        );
      })()}

      {/* Generic Staff Pending Link Banner for Super Admins */}
      {currentUser.role === 'Super Admin' && (() => {
        const unlinked = staff.filter((s) => !s.authUid || s.authUid === s.id);
        if (unlinked.length === 0) return null;
        return (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Staff Accounts Awaiting Firebase UID Link:</span> {unlinked.length} account(s) can be synchronized with their Firebase Authentication UID.
              </div>
            </div>
            <button
              onClick={() => {
                setLinkingStaffUser(unlinked[0]);
                setLinkUidInput('');
                setLinkStaffError(null);
              }}
              className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer transition-colors"
            >
              Link UID ({unlinked[0].name})
            </button>
          </div>
        );
      })()}

      {/* Staff Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {staff.map((member) => {
          const isCurrentUser = member.id === currentUser.id || member.email.toLowerCase() === currentUser.email.toLowerCase();
          const isActive = member.active !== false;
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
                          You
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
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
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-gray-100 text-gray-600 border-gray-300'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
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
                {member.assignedClientsCount !== undefined && (
                  <div className="text-[11px] text-gray-400">
                    Active Caseload: <strong className="text-gray-700">{member.assignedClientsCount}</strong> clients
                  </div>
                )}
              </div>

              {/* Administrative Actions - Strictly no account switching or impersonation */}
              <div className="pt-2 flex flex-col gap-2">
                {!isCurrentUser ? (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingStaff(member)}
                        className="flex-1 py-2 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-gray-500" />
                        <span>View Profile</span>
                      </button>

                      {currentUser.role === 'Super Admin' && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(member)}
                          className={`py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1 border ${
                            isActive
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                          title={isActive ? 'Deactivate account access' : 'Activate account access'}
                        >
                          {isActive ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Activate</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {currentUser.role === 'Super Admin' && (
                      <div className="space-y-1.5 pt-1 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenChangeEmail(member)}
                            className="flex-1 py-1.5 px-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 hover:text-gray-950 font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1"
                            title="Change or synchronize this staff member's email address"
                          >
                            <Mail className="w-3.5 h-3.5 text-gray-500" />
                            <span>Change Email</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingStaffUser(member);
                              setLinkUidInput(member.authUid || '');
                              setLinkStaffError(null);
                            }}
                            className="flex-1 py-1.5 px-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 hover:text-gray-950 font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1"
                            title="Link or synchronize Firebase Authentication UID"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
                            <span>Link UID</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendPasswordReset(member)}
                            className="py-1.5 px-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900 font-semibold text-[11px] transition-all cursor-pointer flex items-center justify-center"
                            title="Send Password Reset Email"
                          >
                            <KeyRound className="w-3 h-3 text-gray-400" />
                          </button>
                        </div>

                        {staff.some((s) => s.id !== member.id && s.email.toLowerCase() === member.email.toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => handleOpenDuplicateModal(member)}
                            className="w-full py-1.5 px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            title="Safely remove accidental duplicate counsellor or staff account"
                          >
                            <UserX className="w-3.5 h-3.5 text-red-600" />
                            <span>Resolve Duplicate Record</span>
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="text-center text-[11px] font-bold text-red-600 bg-red-50 py-1.5 rounded-xl border border-red-200 flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Current Session Operator (You)</span>
                    </div>
                    {currentUser.role === 'Super Admin' && (
                      <button
                        type="button"
                        onClick={() => handleOpenChangeEmail(member)}
                        className="w-full py-1.5 px-3 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5 text-red-600" />
                        <span>Change My Email</span>
                      </button>
                    )}
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
                      <span className="inline-block w-5 h-5 rounded-full bg-gray-100 text-gray-400 font-bold leading-5">✕</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.an ? (
                      <span className="inline-block w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold leading-5">✓</span>
                    ) : (
                      <span className="inline-block w-5 h-5 rounded-full bg-gray-100 text-gray-400 font-bold leading-5">✕</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admin Manual & Firebase Console Procedures Help Section */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center border border-gray-200">
              <HelpCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                Super Admin Manual: Firebase Console & User Management
              </h2>
              <p className="text-xs text-gray-500">
                Standard operating procedures for managing staff accounts, credentials, and email synchronization.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowConsoleGuide(!showConsoleGuide)}
            className="text-xs font-bold text-gray-700 hover:text-gray-950 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer"
          >
            {showConsoleGuide ? 'Hide Guide' : 'View Guide'}
          </button>
        </div>

        {showConsoleGuide && (
          <div className="space-y-4 text-xs text-gray-700 pt-3 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Procedure A: Changing another user's email */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                <div className="font-bold text-gray-950 flex items-center gap-1.5 text-xs">
                  <Mail className="w-4 h-4 text-red-600" />
                  <span>Procedure 1: Changing Another User's Email</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-600 text-[11px]">
                  <li>Open the <strong>Firebase Console</strong> at <span className="font-mono text-gray-800">console.firebase.google.com</span>.</li>
                  <li>Select project: <strong className="font-mono text-red-700">gamblepause-africa</strong>.</li>
                  <li>Click on <strong>Authentication</strong> in the left sidebar, then select the <strong>Users</strong> tab.</li>
                  <li>Locate the target staff member by current email or UID.</li>
                  <li>Click the three vertical dots (actions) and choose <strong>Edit email address</strong>.</li>
                  <li>Enter the new official email and click <strong>Save</strong>.</li>
                  <li>Return to GamblePause, click <strong>Change Email</strong> on the staff card, enter the new email, and click <strong>Confirm & Synchronize Firestore Profile</strong>.</li>
                </ol>
                <div className="text-[10px] text-gray-500 italic pt-1 border-t border-gray-200">
                  Guarantee: The permanent UID remains unchanged. Client records, assessments, case notes, and counsellor assignments are completely preserved.
                </div>
              </div>

              {/* Procedure B: Generic Staff & Super Admin Provisioning */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
                <div className="font-bold text-gray-950 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-red-600" />
                  <span>Procedure 2: Generic Staff & Super Admin Provisioning and UID Linking</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-gray-600 text-[11px]">
                  <li>Open Firebase Console → <strong className="font-mono text-red-700">gamblepause-africa</strong>.</li>
                  <li>Go to <strong>Authentication</strong> → <strong>Users</strong>.</li>
                  <li>If creating a new staff account manually, click <strong>Add user</strong>, enter the official email and set a temporary password.</li>
                  <li>Copy the generated <strong>User UID</strong> from Firebase Authentication.</li>
                  <li>In GamblePause, click <strong>Link UID</strong> on the staff card.</li>
                  <li>Paste the Firebase UID and click <strong>Link & Synchronize Staff Profile</strong>.</li>
                </ol>
                <div className="text-[10px] text-gray-500 italic pt-1 border-t border-gray-200">
                  Security note: The Firestore profile is maintained at <span className="font-mono">users/{'{uid}'}</span> and <span className="font-mono">staff/{'{id}'}</span>. No passwords or credentials are ever stored in Firestore.
                </div>
              </div>
            </div>

            {/* Architecture & Non-disruption Guarantee */}
            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1 text-emerald-950 text-[11px]">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Architecture & Non-Disruption Guarantees</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-emerald-900">
                <li><strong>No Cloud Functions</strong> or paid backend infrastructure deployed.</li>
                <li><strong>Firebase Blaze upgrade</strong> is NOT required.</li>
                <li><strong>All assessment progression</strong> (Assessments 1.0 - 5.0 + Feedback) is 100% preserved.</li>
                <li><strong>Existing client biodata</strong> and historical assessment responses are never altered.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Staff Profile Details Modal */}
      {viewingStaff && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-700" />
                <h3 className="text-base font-bold text-gray-950">Staff Profile & Credentials</h3>
              </div>
              <button
                onClick={() => setViewingStaff(null)}
                className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-500 font-semibold">Full Name:</span>
                <span className="font-bold text-gray-900">{viewingStaff.name}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-500 font-semibold">Email:</span>
                <span className="font-bold text-gray-900">{viewingStaff.email}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-500 font-semibold">Phone:</span>
                <span className="font-bold text-gray-900">{viewingStaff.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-500 font-semibold">Role:</span>
                <span className="font-bold text-gray-900">{viewingStaff.role}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-500 font-semibold">Account Status:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    viewingStaff.active !== false
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {viewingStaff.active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-500 font-semibold">Assigned Caseload:</span>
                <span className="font-bold text-gray-900">{viewingStaff.assignedClientsCount || 0} clients</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
                <span className="text-gray-500 font-semibold">System ID / Firebase UID:</span>
                <span className="font-mono text-[10px] text-gray-600 truncate max-w-[200px]">
                  {viewingStaff.authUid || viewingStaff.id}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-gray-100">
              {currentUser.role === 'Super Admin' && (
                <button
                  type="button"
                  onClick={() => {
                    const target = viewingStaff;
                    setViewingStaff(null);
                    handleOpenChangeEmail(target);
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 text-gray-800 cursor-pointer flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5 text-gray-600" />
                  <span>Change Email</span>
                </button>
              )}
              {currentUser.role === 'Super Admin' && viewingStaff.id !== currentUser.id && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleToggleStatus(viewingStaff);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    {viewingStaff.active !== false ? 'Deactivate Account' : 'Activate Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSendPasswordReset(viewingStaff);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-800 cursor-pointer"
                  >
                    Send Reset Email
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-950">Add Authorized Staff Member</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            {addStaffError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{addStaffError}</span>
              </div>
            )}

            <form onSubmit={handleAddStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
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
                <label className="block font-bold text-gray-800 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
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
                  Designated Super Users: Abiodun Ayodeji and Ladipo Abiose. Staff accounts can be assigned as Counsellor, Staff, or Analyst.
                </p>
              </div>

              <div>
                <label className="block font-bold text-gray-800 mb-1">Initial Temporary Password</label>
                <input
                  type="text"
                  required
                  placeholder="Gamblepause"
                  value={newStaff.temporaryPassword}
                  onChange={(e) => setNewStaff({ ...newStaff, temporaryPassword: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  The staff member can sign in using this password and update it at any time.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingStaff}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isAddingStaff ? 'Creating...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Management & Synchronization Modal */}
      {editingEmailUser && (() => {
        const isSelf =
          editingEmailUser.id === currentUser.id ||
          (editingEmailUser.authUid && currentUser.authUid && editingEmailUser.authUid === currentUser.authUid) ||
          editingEmailUser.email.toLowerCase() === currentUser.email.toLowerCase();
        const targetUid = customUidInput.trim() || editingEmailUser.authUid || editingEmailUser.id;
        const isTargetActive = editingEmailUser.active !== false;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-2xl max-w-lg w-full space-y-4 my-8">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-950">
                      {isSelf ? 'Update Your Email Address' : 'Manage User Email & Profile Synchronization'}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      {isSelf ? 'Client-side Firebase Authentication update' : 'Safe manual update & Firestore profile sync'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingEmailUser(null)}
                  className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              {/* Target User Details Card */}
              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">User:</span>
                  <span className="font-bold text-gray-900">{editingEmailUser.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Designated Role:</span>
                  <span className="font-bold text-gray-900">{editingEmailUser.role}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Account Status:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      isTargetActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {isTargetActive ? 'Active' : 'Deactivated'} (Status preserved)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-semibold">Current Email:</span>
                  <span className="font-mono font-bold text-gray-900">{editingEmailUser.email}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-gray-200/60">
                  <span className="text-gray-500 font-semibold">Permanent Firebase UID:</span>
                  <span className="font-mono text-[11px] text-gray-700 font-bold bg-white px-2 py-0.5 rounded border border-gray-200">
                    {targetUid}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 italic">
                  Note: The Firebase UID is permanent and will NEVER change. Changing email updates only the email attribute.
                </div>
              </div>

              {emailSyncError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{emailSyncError}</span>
                </div>
              )}

              {/* Modal Body: Self vs Other */}
              {isSelf ? (
                /* Self Email Change Flow */
                <form onSubmit={handleSyncUserEmail} className="space-y-3.5 text-xs">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-xs text-blue-950">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>Authenticated Session Operator</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      You are updating your own authenticated email address. Firebase Authentication will verify or update your credentials directly.
                    </p>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      New Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="employee@gamblepause.org"
                      value={newEmailInput}
                      onChange={(e) => setNewEmailInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      Current Password (for Re-authentication)
                    </label>
                    <input
                      type="password"
                      placeholder="Enter current password if prompted"
                      value={selfCurrentPassword}
                      onChange={(e) => setSelfCurrentPassword(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Sensitive security operations in Firebase Authentication require recent login or password confirmation.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setEditingEmailUser(null)}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSyncingEmail}
                      className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {isSyncingEmail ? 'Updating...' : 'Update Authentication & Profile Email'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Another User Email Change Flow */
                <form onSubmit={handleSyncUserEmail} className="space-y-3.5 text-xs">
                  {/* Step-by-step instructions for Firebase Console */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2 text-amber-950">
                    <div className="font-bold flex items-center gap-1.5 text-xs text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Manual Firebase Console Requirement (No Cloud Functions)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900">
                      GamblePause uses a secure client-side architecture without deployed Cloud Functions or service account credentials. Therefore, a user’s Firebase Authentication email must be changed manually in Firebase Console first, then synchronized to Firestore.
                    </p>
                    <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 text-[11px] space-y-1 text-gray-800">
                      <div className="font-bold text-gray-900">Follow these exact steps:</div>
                      <ol className="list-decimal list-inside space-y-0.5 text-gray-700">
                        <li>Open Firebase Console (<span className="font-mono text-xs text-red-700">gamblepause-africa</span>).</li>
                        <li>Navigate to <span className="font-semibold">Authentication</span> → <span className="font-semibold">Users</span>.</li>
                        <li>Locate <span className="font-semibold">{editingEmailUser.name}</span> by email (<span className="font-mono text-[11px]">{editingEmailUser.email}</span>) or UID (<span className="font-mono text-[10px]">{targetUid}</span>).</li>
                        <li>Click <span className="font-semibold">Edit email address</span>, enter the new email, and click <span className="font-semibold">Save</span>.</li>
                        <li className="text-red-700 font-semibold">Do NOT delete the user. Do NOT create a new user. The UID remains unchanged.</li>
                        <li>Return here, enter the new email below, check confirmation, and synchronize.</li>
                      </ol>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      New Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. employee@gamblepause.org"
                      value={newEmailInput}
                      onChange={(e) => setNewEmailInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-800 mb-1">
                      Firebase Authentication UID (from Console)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ba9N30y4cHVF79Ee78LMZFc8kAB2"
                      value={customUidInput}
                      onChange={(e) => setCustomUidInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 text-xs font-mono"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">
                      Identifies the target Firestore document at <span className="font-mono">users/{'{uid}'}</span>. Never modifies client records or assessment history.
                    </p>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                    <label className="flex items-start gap-2 text-xs font-semibold text-gray-800 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={confirmConsoleSync}
                        onChange={(e) => setConfirmConsoleSync(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                      />
                      <span>
                        I confirm that I have updated this user's email address in the Firebase Console (gamblepause-africa) and verified that their permanent Firebase UID is unchanged.
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setEditingEmailUser(null)}
                      className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSyncingEmail || !confirmConsoleSync}
                      className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 cursor-pointer"
                    >
                      {isSyncingEmail ? 'Synchronizing...' : 'Confirm & Synchronize Firestore Profile'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        );
      })()}

      {/* Generic Firebase UID Linking Modal */}
      {linkingStaffUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-2xl max-w-lg w-full space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-950">
                    Link Firebase Authentication UID
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Synchronize {linkingStaffUser.name}'s profile with their authoritative Firebase Auth record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLinkingStaffUser(null)}
                className="text-gray-400 hover:text-gray-700 font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {linkStaffError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{linkStaffError}</span>
              </div>
            )}

            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs text-gray-800">
              <div className="font-bold text-gray-900">Target Staff Member:</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>Name: <strong>{linkingStaffUser.name}</strong></div>
                <div>Role: <strong>{linkingStaffUser.role}</strong></div>
                <div>Email: <strong className="font-mono">{linkingStaffUser.email}</strong></div>
                <div>Internal ID: <strong className="font-mono text-[10px]">{linkingStaffUser.id}</strong></div>
              </div>
            </div>

            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs space-y-1.5 text-amber-950">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Firebase Authentication Link Instructions:</span>
              </div>
              <ol className="list-decimal list-inside text-[11px] space-y-0.5 text-gray-700">
                <li>Open the Firebase Console (<span className="font-mono text-red-700">gamblepause-africa</span>).</li>
                <li>Go to <span className="font-semibold">Authentication</span> → <span className="font-semibold">Users</span>.</li>
                <li>Find or create the account for <span className="font-mono font-semibold">{linkingStaffUser.email}</span>.</li>
                <li>Copy the generated <span className="font-semibold">User UID</span>.</li>
                <li>Paste the UID below and click Link Profile.</li>
              </ol>
            </div>

            <form onSubmit={handleLinkStaffAccount} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-800 mb-1">
                  Firebase Authentication UID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Paste Firebase Auth UID (e.g. Ba9N30y4cHVF79Ee78LMZFc8kAB2)"
                  value={linkUidInput}
                  onChange={(e) => setLinkUidInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-xs"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Links this staff profile to their authentic Firebase Authentication account without creating dummy credentials.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setLinkingStaffUser(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLinkingStaff || !linkUidInput.trim()}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isLinkingStaff ? 'Linking...' : 'Link & Synchronize Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Duplicate Staff Resolution Modal */}
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
                    Safely Resolve Duplicate Staff Record
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    Super Admin reconciliation and non-destructive cleanup
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
                The canonical counsellor's legitimate staff profile, Firebase Auth account, client assignments, case notes, notifications, and audit logs will be 100% retained and protected.
              </p>
            </div>

            {/* Record Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Duplicate to Remove */}
              <div className="p-3.5 bg-red-50/60 border border-red-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-red-200/80 pb-1.5">
                  <span className="font-bold text-red-900 uppercase text-[10px] tracking-wider">Duplicate (To Remove)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-200 text-red-800">Redundant</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div>Name: <strong>{duplicateCandidate.name}</strong></div>
                  <div>Email: <strong className="font-mono text-[10px]">{duplicateCandidate.email}</strong></div>
                  <div>Internal ID: <strong className="font-mono text-[10px] text-red-700">{duplicateCandidate.id}</strong></div>
                  <div>Role: <strong>{duplicateCandidate.role}</strong></div>
                  <div>Status: <span className="font-semibold">{duplicateCandidate.status || (duplicateCandidate.active ? 'Active' : 'Inactive')}</span></div>
                  <div>Caseload: <strong>{duplicateCandidate.assignedClientsCount || 0} clients</strong></div>
                  <div>Auth UID: <span className="font-mono text-[10px] text-gray-600">{duplicateCandidate.authUid || 'None (No real user)'}</span></div>
                </div>
              </div>

              {/* Canonical to Retain */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                  <span className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider">Canonical (To Retain)</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">Retained</span>
                </div>
                {canonicalCandidate ? (
                  <div className="space-y-1 text-[11px]">
                    <div>Name: <strong>{canonicalCandidate.name}</strong></div>
                    <div>Email: <strong className="font-mono text-[10px]">{canonicalCandidate.email}</strong></div>
                    <div>Internal ID: <strong className="font-mono text-[10px] text-emerald-800">{canonicalCandidate.id}</strong></div>
                    <div>Role: <strong>{canonicalCandidate.role}</strong></div>
                    <div>Status: <span className="font-semibold text-emerald-700">{canonicalCandidate.status || (canonicalCandidate.active ? 'Active' : 'Inactive')}</span></div>
                    <div>Caseload: <strong>{canonicalCandidate.assignedClientsCount || 0} clients</strong></div>
                    <div>Auth UID: <span className="font-mono text-[10px] text-emerald-700 font-bold">{canonicalCandidate.authUid || 'Configured'}</span></div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs italic">Select or verify canonical record.</p>
                )}
              </div>
            </div>

            {/* Confirmation form */}
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
                  {isResolvingDuplicate ? 'Removing Duplicate...' : 'Permanently Remove Duplicate Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
