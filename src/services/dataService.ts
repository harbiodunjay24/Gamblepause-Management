import {
  Client,
  ClientStatus,
  FormDefinition,
  WorkflowStage,
  AssessmentSubmission,
  CaseNote,
  StaffUser,
  NotificationLog,
  AuditLogEntry,
  ScoringRange,
  CounsellorAssignmentHistory,
} from '../types';
import {
  INITIAL_CLIENTS,
  INITIAL_FORMS,
  INITIAL_WORKFLOW_STAGES,
  INITIAL_SUBMISSIONS,
  INITIAL_CASE_NOTES,
  INITIAL_STAFF,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_ASSIGNMENTS,
} from '../data/demoData';
import { authService, AuthUser } from './authService';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';

const STORAGE_KEYS = {
  CLIENTS: 'gamblepause_clients',
  FORMS: 'gamblepause_forms',
  WORKFLOWS: 'gamblepause_workflows',
  SUBMISSIONS: 'gamblepause_submissions',
  CASE_NOTES: 'gamblepause_case_notes',
  STAFF: 'gamblepause_staff',
  NOTIFICATIONS: 'gamblepause_notifications',
  AUDIT_LOGS: 'gamblepause_audit_logs',
  COUNSELLOR_ASSIGNMENTS: 'gamblepause_counsellor_assignments',
};

class DataService {
  private clients: Client[] = [];
  private forms: FormDefinition[] = [];
  private workflows: WorkflowStage[] = [];
  private submissions: AssessmentSubmission[] = [];
  private caseNotes: CaseNote[] = [];
  private staff: StaffUser[] = [];
  private notifications: NotificationLog[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private counsellorAssignments: CounsellorAssignmentHistory[] = [];
  private listeners: Set<() => void> = new Set();
  private statusListeners: Set<(client: Client, oldStatus: ClientStatus, newStatus: ClientStatus) => void> = new Set();
  private eventSource: EventSource | null = null;

  constructor() {
    this.loadFromStorage();
    this.cleanseStaleStaff();
    this.syncWithBackend();
    this.initRealtimeEvents();
    // Re-notify whenever auth state changes
    authService.subscribe(() => {
      this.notify();
    });
  }

  private cleanseStaleStaff() {
    const fakeNames = ['counsellor a', 'counsellor b', 'demo counsellor', 'dr. example', 'sarah', 'john'];
    this.staff = this.staff.filter((s) => !fakeNames.includes(s.name.trim().toLowerCase()));

    // Ensure the 3 real GamblePause counsellors are present as Active counsellors
    const realCounsellors = [
      { id: 'counsellor-benjamin', name: 'Benjamin', email: 'benjamin@gamblepause.org', phone: '+234 809 111 2233' },
      { id: 'counsellor-micheal', name: 'Micheal Akinniku', email: 'micheal.akinniku@gamblepause.org', phone: '+234 812 333 4455' },
      { id: 'counsellor-celia', name: 'Celia Badmus', email: 'celia.badmus@gamblepause.org', phone: '+234 818 555 6677' },
    ];

    for (const rc of realCounsellors) {
      const idx = this.staff.findIndex((s) => s.id === rc.id || s.email.toLowerCase() === rc.email.toLowerCase());
      if (idx === -1) {
        this.staff.push({
          id: rc.id,
          name: rc.name,
          email: rc.email,
          phone: rc.phone,
          role: 'Counsellor',
          assignedClientsCount: 0,
          active: true,
        });
      } else {
        this.staff[idx].name = rc.name;
        this.staff[idx].role = 'Counsellor';
        this.staff[idx].active = this.staff[idx].active !== false;
      }
    }
  }

  public async syncWithBackend(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const [clientsRes, staffRes, submissionsRes, notifsRes, assignmentsRes, notesRes] = await Promise.allSettled([
        fetch('/api/clients').then((r) => r.ok ? r.json() : null),
        fetch('/api/staff').then((r) => r.ok ? r.json() : null),
        fetch('/api/submissions').then((r) => r.ok ? r.json() : null),
        fetch('/api/notifications').then((r) => r.ok ? r.json() : null),
        fetch('/api/counsellor-assignments').then((r) => r.ok ? r.json() : null),
        fetch('/api/case-notes').then((r) => r.ok ? r.json() : null),
      ]);

      let changed = false;

      if (clientsRes.status === 'fulfilled' && Array.isArray(clientsRes.value) && clientsRes.value.length > 0) {
        this.clients = clientsRes.value;
        changed = true;
      }
      if (staffRes.status === 'fulfilled' && Array.isArray(staffRes.value) && staffRes.value.length > 0) {
        this.staff = staffRes.value;
        this.cleanseStaleStaff();
        changed = true;
      }
      if (submissionsRes.status === 'fulfilled' && Array.isArray(submissionsRes.value)) {
        this.submissions = submissionsRes.value;
        changed = true;
      }
      if (notifsRes.status === 'fulfilled' && Array.isArray(notifsRes.value)) {
        this.notifications = notifsRes.value;
        changed = true;
      }
      if (assignmentsRes.status === 'fulfilled' && Array.isArray(assignmentsRes.value)) {
        this.counsellorAssignments = assignmentsRes.value;
        changed = true;
      }
      if (notesRes.status === 'fulfilled' && Array.isArray(notesRes.value)) {
        this.caseNotes = notesRes.value;
        changed = true;
      }

      if (changed) {
        this.saveToStorage();
        this.notify();
      }
    } catch (err) {
      console.warn('[DataService] Backend sync completed with local fallback:', err);
    }
  }

  private initRealtimeEvents() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    try {
      if (this.eventSource) {
        this.eventSource.close();
      }
      this.eventSource = new EventSource('/api/events');
      this.eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'CLIENT_SAVED' || payload.type === 'CLIENT_UPDATED') {
            const client: Client = payload.data;
            const idx = this.clients.findIndex((c) => c.id === client.id);
            if (idx >= 0) {
              this.clients[idx] = client;
            } else {
              this.clients.unshift(client);
            }
            this.saveToStorage();
            this.notify();
          } else if (payload.type === 'COUNSELLOR_ASSIGNED') {
            const { client, assignment, notification } = payload.data;
            if (client) {
              const idx = this.clients.findIndex((c) => c.id === client.id);
              if (idx >= 0) this.clients[idx] = client;
            }
            if (assignment) {
              const existingIdx = this.counsellorAssignments.findIndex((a) => a.id === assignment.id);
              if (existingIdx === -1) this.counsellorAssignments.unshift(assignment);
            }
            if (notification) {
              const existingN = this.notifications.findIndex((n) => n.id === notification.id);
              if (existingN === -1) this.notifications.unshift(notification);
            }
            this.saveToStorage();
            this.notify();
          } else if (payload.type === 'COUNSELLOR_STATUS_CHANGED') {
            const { counsellorId, status } = payload.data;
            const counsellor = this.staff.find((s) => s.id === counsellorId);
            if (counsellor) {
              counsellor.active = status === 'Active';
              this.saveToStorage();
              this.notify();
            }
          } else if (payload.type === 'SUBMISSION_CREATED') {
            const submission = payload.data;
            const idx = this.submissions.findIndex((s) => s.id === submission.id);
            if (idx === -1) {
              this.submissions.unshift(submission);
              this.saveToStorage();
              this.notify();
            }
          } else if (payload.type === 'NOTIFICATION_CREATED') {
            const notif = payload.data;
            const idx = this.notifications.findIndex((n) => n.id === notif.id);
            if (idx === -1) {
              this.notifications.unshift(notif);
              this.saveToStorage();
              this.notify();
            }
          }
        } catch (e) {
          console.warn('[DataService] Error parsing realtime event:', e);
        }
      };
      this.eventSource.onerror = () => {
        // SSE error, will auto-reconnect
      };
    } catch (e) {
      console.warn('[DataService] SSE init exception:', e);
    }
  }

  private loadFromStorage() {
    try {
      const storedClients = localStorage.getItem(STORAGE_KEYS.CLIENTS);
      const storedForms = localStorage.getItem(STORAGE_KEYS.FORMS);
      const storedWorkflows = localStorage.getItem(STORAGE_KEYS.WORKFLOWS);
      const storedSubmissions = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
      const storedNotes = localStorage.getItem(STORAGE_KEYS.CASE_NOTES);
      const storedStaff = localStorage.getItem(STORAGE_KEYS.STAFF);
      const storedNotifs = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      const storedAudit = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      const storedAssignments = localStorage.getItem(STORAGE_KEYS.COUNSELLOR_ASSIGNMENTS);

      this.clients = storedClients ? JSON.parse(storedClients) : [...INITIAL_CLIENTS];
      this.forms = storedForms ? JSON.parse(storedForms) : [...INITIAL_FORMS];
      this.workflows = storedWorkflows ? JSON.parse(storedWorkflows) : [...INITIAL_WORKFLOW_STAGES];
      this.submissions = storedSubmissions ? JSON.parse(storedSubmissions) : [...INITIAL_SUBMISSIONS];
      this.caseNotes = storedNotes ? JSON.parse(storedNotes) : [...INITIAL_CASE_NOTES];
      this.staff = storedStaff ? JSON.parse(storedStaff) : [...INITIAL_STAFF];
      this.notifications = storedNotifs ? JSON.parse(storedNotifs) : [...INITIAL_NOTIFICATIONS];
      this.auditLogs = storedAudit ? JSON.parse(storedAudit) : [...INITIAL_AUDIT_LOGS];
      this.counsellorAssignments = storedAssignments ? JSON.parse(storedAssignments) : [...INITIAL_ASSIGNMENTS];
    } catch (e) {
      console.error('Error loading data from localStorage, resetting to defaults', e);
      this.resetToDefaults();
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(this.clients));
      localStorage.setItem(STORAGE_KEYS.FORMS, JSON.stringify(this.forms));
      localStorage.setItem(STORAGE_KEYS.WORKFLOWS, JSON.stringify(this.workflows));
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(this.submissions));
      localStorage.setItem(STORAGE_KEYS.CASE_NOTES, JSON.stringify(this.caseNotes));
      localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(this.staff));
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(this.notifications));
      localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(this.auditLogs));
      localStorage.setItem(STORAGE_KEYS.COUNSELLOR_ASSIGNMENTS, JSON.stringify(this.counsellorAssignments));
    } catch (e) {
      console.error('Error saving to storage', e);
    }
    this.notify();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public onStatusChange(
    listener: (client: Client, oldStatus: ClientStatus, newStatus: ClientStatus) => void
  ) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public resetToDefaults() {
    this.clients = [...INITIAL_CLIENTS];
    this.forms = [...INITIAL_FORMS];
    this.workflows = [...INITIAL_WORKFLOW_STAGES];
    this.submissions = [...INITIAL_SUBMISSIONS];
    this.caseNotes = [...INITIAL_CASE_NOTES];
    this.staff = [...INITIAL_STAFF];
    this.notifications = [...INITIAL_NOTIFICATIONS];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.counsellorAssignments = [...INITIAL_ASSIGNMENTS];
    this.saveToStorage();
    this.logAudit('SYSTEM_RESET', 'System', 'all', 'Reset all records to initial demonstration data.');
  }

  // --- Current User Helper ---
  public getCurrentUser(): StaffUser {
    const authUser = authService.getCurrentUser();
    if (authUser) {
      const match = this.staff.find((s) => s.id === authUser.id || s.email.toLowerCase() === authUser.email.toLowerCase());
      if (match) return match;
      return {
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: (authUser.role === 'Client' ? 'Staff' : authUser.role) as any,
        assignedClientsCount: 0,
        active: true,
      };
    }
    // Return placeholder when unauthenticated
    return this.staff[0];
  }

  public setCurrentUser(user: StaffUser) {
    this.logAudit('AUTH_SWITCH', 'Staff', user.id, `Switched current session user to ${user.name} (${user.role})`);
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLogEntry[] {
    const user = authService.getCurrentUser();
    if (!user || user.role !== 'Super Admin') return [];
    return [...this.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public logAudit(action: string, targetType: AuditLogEntry['targetType'], targetId: string, details: string) {
    const user = authService.getCurrentUser();
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      userId: user?.id || 'system',
      userName: user?.name || 'GamblePause System',
      userRole: user?.role || 'System',
      action,
      targetType,
      targetId,
      details,
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
    this.saveToStorage();
  }

  // --- Clients with STRICT ROLE-BASED ACCESS CONTROL ---
  public getClients(): Client[] {
    const user = authService.getCurrentUser();
    if (!user) {
      // Unauthenticated users NEVER receive client data
      return [];
    }

    if (user.role === 'Super Admin') {
      return [...this.clients];
    }

    if (user.role === 'Counsellor') {
      // Counsellor sees ONLY clients assigned to them
      return this.clients.filter(
        (c) =>
          c.assignedCounsellorId === user.id ||
          (c.assignedCounsellorName && user.name && c.assignedCounsellorName.toLowerCase() === user.name.toLowerCase()) ||
          (c.assignedCounsellorName && user.name && c.assignedCounsellorName.includes(user.name.split(' ')[0]))
      );
    }

    if (user.role === 'Client') {
      // Client sees ONLY their own client record
      return this.clients.filter((c) => c.id === user.clientId);
    }

    if (user.role === 'Staff' || user.role === 'Analyst / Viewer') {
      return [...this.clients];
    }

    return [];
  }

  public getClientById(id: string): Client | undefined {
    const user = authService.getCurrentUser();
    if (!user) return undefined;

    // Direct match by ID
    const client = this.clients.find((c) => c.id === id);
    if (!client) return undefined;

    if (user.role === 'Super Admin' || user.role === 'Staff' || user.role === 'Analyst / Viewer') {
      return client;
    }

    if (user.role === 'Client') {
      // Client can ONLY view their own client ID
      if (user.clientId === client.id) return client;
      // TEST 7: ACCESS DENIED when querying another client ID
      return undefined;
    }

    if (user.role === 'Counsellor') {
      const isAssigned =
        client.assignedCounsellorId === user.id ||
        (client.assignedCounsellorName && user.name && client.assignedCounsellorName.toLowerCase() === user.name.toLowerCase()) ||
        (client.assignedCounsellorName && user.name && client.assignedCounsellorName.includes(user.name.split(' ')[0]));
      if (isAssigned) return client;
      // Counsellor cannot access unassigned client
      return undefined;
    }

    return undefined;
  }

  /**
   * Internal / Secure Token lookup for personalized assessment links
   * Token is an unguessable hash (e.g. sec_tok_...) and does not expose client ID in URL
   */
  public getClientByAccessKey(key: string): Client | undefined {
    if (!key || key.length < 8) return undefined;
    return this.clients.find((c) => c.secureAccessKey === key);
  }

  /**
   * Resolves a personalized assessment token to assessment metadata
   */
  public resolveSecureToken(token: string): {
    valid: boolean;
    client?: Client;
    form?: FormDefinition;
    isCompleted?: boolean;
    isExpired?: boolean;
    error?: string;
  } {
    const client = this.getClientByAccessKey(token);
    if (!client) {
      return {
        valid: false,
        error: 'Invalid or unrecognized assessment link.',
      };
    }

    const targetFormId = client.nextAssessmentId || client.currentStageId || 'form-recovery-1';
    const form = this.forms.find((f) => f.id === targetFormId) || this.forms[0];

    // Check if the assessment was already completed
    const existingSubmissions = this.submissions.filter((s) => s.clientId === client.id);
    const prior = existingSubmissions.find((s) => s.formId === form?.id || s.formName === form?.name);

    if (prior && client.nextAssessmentId !== form?.id) {
      return {
        valid: true,
        client,
        form,
        isCompleted: true,
      };
    }

    return {
      valid: true,
      client,
      form,
      isCompleted: false,
    };
  }

  public generateNextClientId(): string {
    const existingNumbers = this.clients
      .map((c) => {
        const match = c.id.match(/^GP-(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const maxNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNum = maxNum + 1;
    return `GP-${String(nextNum).padStart(4, '0')}`;
  }

  public registerClient(biodata: {
    firstName: string;
    lastName: string;
    preferredName?: string;
    age: number;
    gender: 'Male' | 'Female' | 'Prefer not to say' | 'Other';
    phone: string;
    email: string;
    state: string;
    location: string;
    occupation: string;
    maritalStatus: 'Single' | 'Married' | 'Divorced' | 'Widowed' | 'Separated';
    howHeard: string;
    emergencyContact?: { name: string; relationship: string; phone: string };
    consentGiven: boolean;
  }): Client {
    const newId = this.generateNextClientId();
    const secureKey = `sec_${newId.toLowerCase().replace('-', '')}_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    // Assign a counsellor evenly
    const activeCounsellors = this.staff.filter((s) => s.role === 'Counsellor' || s.role === 'Super Admin');
    const assignedCounsellor = activeCounsellors.length > 0
      ? activeCounsellors[this.clients.length % activeCounsellors.length]
      : undefined;

    // Determine initial assessment
    const initialStage = this.workflows.find((w) => w.id === 'stage-initial') || this.workflows[1];
    const initialForm = this.forms.find((f) => f.id === initialStage?.formId || f.code === 'initial_assessment') || this.forms[0];

    const newClient: Client = {
      id: newId,
      ...biodata,
      registrationDate: now,
      status: 'Active',
      currentStageId: initialStage?.id || 'stage-initial',
      currentStageName: initialStage?.stageName || 'Initial Assessment',
      nextAssessmentId: initialForm?.id,
      nextAssessmentName: initialForm?.name || 'Initial Assessment',
      nextAssessmentDueDate: now, // ready immediately upon registration
      assignedCounsellorId: assignedCounsellor?.id,
      assignedCounsellorName: assignedCounsellor?.name,
      lastActivityDate: now,
      totalAssessmentsCompleted: 0,
      totalAssessmentsOverdue: 0,
      riskLevel: 'Medium',
      secureAccessKey: secureKey,
    };

    this.clients.unshift(newClient);

    // Create a welcoming notification
    this.queueNotification({
      clientId: newClient.id,
      clientName: `${newClient.firstName} ${newClient.lastName}`,
      channel: 'Email',
      recipient: newClient.email,
      subject: 'Welcome to GamblePause Initiative Africa',
      messageBody: `Hello ${newClient.firstName},\n\nThank you for taking the courageous first step with GamblePause. Your registration has been received and your unique client record is created.\n\nYour Initial Assessment is ready now. Please complete it here: https://gamblepause.org/assess/${newClient.secureAccessKey}\n\nWe are walking this journey with you.\n\nWarmly,\nGamblePause Initiative Africa`,
      triggerType: 'Welcome',
      status: 'Queued',
      scheduledFor: now,
    });

    // Also queue an SMS welcome simulation
    this.queueNotification({
      clientId: newClient.id,
      clientName: `${newClient.firstName} ${newClient.lastName}`,
      channel: 'SMS',
      recipient: newClient.phone,
      messageBody: `GamblePause Africa: Welcome ${newClient.firstName}. Your assessment link is ready: https://gamblepause.org/a/${newClient.secureAccessKey}. We are here to support you.`,
      triggerType: 'Welcome',
      status: 'Queued',
      scheduledFor: now,
    });

    this.logAudit('REGISTER_CLIENT', 'Client', newClient.id, `Client ${newClient.firstName} ${newClient.lastName} registered successfully.`);
    this.saveToStorage();

    // Dispatch to shared backend for cross-device multi-phone sync
    try {
      fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      }).catch((e) => console.warn('[Backend] Register client sync error:', e));
    } catch (e) {
      console.warn('[Backend] Fetch client register error:', e);
    }

    // Automatically provision client login credentials in authService
    authService.registerClientCredentials(
      newClient.id,
      newClient.email,
      newClient.firstName,
      newClient.lastName,
      'Gamblepause'
    );

    return newClient;
  }

  public updateClientStatus(clientId: string, status: ClientStatus, noteReason?: string) {
    const client = this.clients.find((c) => c.id === clientId);
    if (!client) return;

    const oldStatus = client.status;
    client.status = status;
    client.lastActivityDate = new Date().toISOString();

    if (noteReason) {
      this.addCaseNote(
        clientId,
        `Status changed from ${oldStatus} to ${status}. Reason / Context: ${noteReason}`,
        undefined,
        ['Status Change']
      );
    }

    this.logAudit('UPDATE_CLIENT_STATUS', 'Client', clientId, `Changed status from ${oldStatus} to ${status}`);
    this.saveToStorage();

    try {
      fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch((e) => console.warn('[Backend] Update status sync error:', e));
    } catch (e) {
      console.warn('[Backend] Fetch update status error:', e);
    }

    if (oldStatus !== status) {
      this.statusListeners.forEach((listener) => {
        try {
          listener(client, oldStatus, status);
        } catch (err) {
          console.error('Error invoking status listener:', err);
        }
      });
    }
  }

  /**
   * Generates or retrieves the secure assessment token for a given client and form
   */
  public getAssessmentToken(clientId: string, _formId?: string): string {
    const client = this.clients.find((c) => c.id === clientId);
    if (!client) return '';
    return client.secureAccessKey;
  }

  public getCounsellorAssignments(clientId?: string): CounsellorAssignmentHistory[] {
    const user = authService.getCurrentUser();
    if (!user) return [];

    let list = [...this.counsellorAssignments];
    if (clientId) {
      list = list.filter((a) => a.clientId === clientId);
    }

    // Role-based visibility
    if (user.role === 'Counsellor') {
      list = list.filter(
        (a) =>
          a.newCounsellorId === user.id ||
          a.previousCounsellorId === user.id ||
          (user.name && a.newCounsellorName && a.newCounsellorName.toLowerCase() === user.name.toLowerCase()) ||
          (user.name && a.previousCounsellorName && a.previousCounsellorName.toLowerCase() === user.name.toLowerCase())
      );
    }

    return list.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  }

  public assignCounsellor(clientId: string, staffId: string, reason?: string): { success: boolean; error?: string; assignment?: CounsellorAssignmentHistory } {
    const client = this.clients.find((c) => c.id === clientId);
    const staff = this.staff.find((s) => s.id === staffId);
    if (!client) {
      return { success: false, error: `Client ${clientId} not found.` };
    }
    if (!staff) {
      return { success: false, error: `Staff member ${staffId} not found.` };
    }

    if (staff.role !== 'Counsellor' || staff.active === false) {
      return { success: false, error: 'Only active counsellors can be assigned to clients.' };
    }

    const currentUser = authService.getCurrentUser();
    const isSuperAdmin = currentUser && (
      currentUser.role === 'Super Admin' ||
      ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org'].includes(currentUser.email.toLowerCase())
    );

    if (!isSuperAdmin) {
      console.warn('Unauthorized: Only Super Users can reassign counsellors.');
      return { success: false, error: 'Unauthorized: Only Super Users are permitted to reassign counsellors.' };
    }

    const previousCounsellorId = client.assignedCounsellorId;
    const isReassignment = !!previousCounsellorId && previousCounsellorId !== staff.id;
    const prevStaff = this.staff.find((s) => s.id === previousCounsellorId);
    const previousCounsellorName = prevStaff?.name || client.assignedCounsellorName || (previousCounsellorId ? 'Previous Counsellor' : 'None (Initial Registration)');

    // 1. Update client record
    client.assignedCounsellorId = staff.id;
    client.assignedCounsellorName = staff.name;
    client.lastActivityDate = new Date().toISOString();

    const assignerName = currentUser?.name || 'Super User';

    // 2. Create permanent assignment history record
    const assignmentRecord: CounsellorAssignmentHistory = {
      id: `asgn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      previousCounsellorId: previousCounsellorId || '',
      previousCounsellorName,
      newCounsellorId: staff.id,
      newCounsellorName: staff.name,
      changedById: currentUser.id,
      changedByName: assignerName,
      changedAt: new Date().toISOString(),
      reason: reason?.trim() || (isReassignment ? 'Clinical workload rebalancing' : 'Initial intake assignment'),
    };

    this.counsellorAssignments.unshift(assignmentRecord);

    // 3. Notification for new counsellor ONLY (strictly targeted to this counsellor's user ID)
    const notifTitle = isReassignment ? 'Client Reassigned' : 'New Client Assigned';
    const notifBody = isReassignment
      ? `${client.id} has been reassigned to you.`
      : `You have been assigned a new client, ${client.id}.`;

    const counsellorNotification: NotificationLog = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      channel: 'Dashboard' as any,
      recipient: staff.email,
      recipientTarget: staff.id,
      recipientUserId: staff.id,
      subject: notifTitle,
      messageBody: notifBody,
      triggerType: notifTitle,
      status: 'Sent',
      scheduledFor: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      isRead: false,
    };

    this.notifications.unshift(counsellorNotification);

    // 4. Notification for previous counsellor if reassigned
    if (isReassignment && previousCounsellorId && prevStaff) {
      this.notifications.unshift({
        id: `notif-prev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        channel: 'Dashboard' as any,
        recipient: prevStaff.email,
        recipientTarget: prevStaff.id,
        recipientUserId: prevStaff.id,
        subject: 'Client Reassigned to Another Counsellor',
        messageBody: `${client.id} has been transferred to counsellor ${staff.name} by ${assignerName}. Reason: ${assignmentRecord.reason}`,
        triggerType: 'Client Reassigned',
        status: 'Sent',
        scheduledFor: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        isRead: false,
      });
    }

    // 5. Audit log
    this.logAudit(
      isReassignment ? 'REASSIGN_COUNSELLOR' : 'ASSIGN_COUNSELLOR',
      'Client',
      clientId,
      `Reassigned client from ${previousCounsellorName} to ${staff.name} by ${assignerName}${reason ? `. Reason: ${reason}` : ''}`
    );

    // 6. Dispatch to shared backend for cross-device synchronization
    try {
      fetch(`/api/clients/${clientId}/assign-counsellor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counsellorId: staff.id, reason: assignmentRecord.reason }),
      }).catch((err) => console.warn('[Backend] Counsellor assignment sync notice:', err));
    } catch (err) {
      console.warn('[Backend] Fetch exception:', err);
    }

    // 7. Firestore synchronization (fallback)
    if (db) {
      try {
        const clientRef = doc(db, 'clients', client.id);
        updateDoc(clientRef, {
          assignedCounsellorId: staff.id,
          assignedCounsellorName: staff.name,
          lastActivityDate: new Date().toISOString(),
        }).catch((err) => console.warn('[Firestore] Error updating client counsellor:', err));

        addDoc(collection(db, 'counsellorAssignments'), assignmentRecord)
          .catch((err) => console.warn('[Firestore] Error writing counsellor assignment:', err));

        addDoc(collection(db, 'notifications'), counsellorNotification)
          .catch((err) => console.warn('[Firestore] Error writing notification:', err));
      } catch (err) {
        console.warn('[Firestore] Sync exception:', err);
      }
    }

    // 8. Persist and notify
    this.saveToStorage();
    this.notify();

    return { success: true, assignment: assignmentRecord };
  }

  public getActiveCounsellors(): StaffUser[] {
    return this.staff.filter((s) => s.role === 'Counsellor' && s.active !== false);
  }

  public async setCounsellorStatus(
    counsellorId: string,
    active: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const counsellor = this.staff.find((s) => s.id === counsellorId);
    if (!counsellor) {
      return { success: false, error: 'Counsellor not found' };
    }
    counsellor.active = active;
    this.saveToStorage();
    this.notify();

    try {
      await fetch(`/api/counsellors/${counsellorId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: active ? 'Active' : 'Inactive' }),
      });
    } catch (e) {
      console.warn('Backend counsellor status patch failed:', e);
    }

    return { success: true };
  }

  public getCounsellorNotifications(counsellorId?: string, _counsellorName?: string): NotificationLog[] {
    const user = authService.getCurrentUser();
    const targetId = counsellorId || user?.id;

    if (!targetId) return [];

    return this.notifications.filter((n) => {
      // Must match specifically this counsellor's ID or email - never leak notifications to other counsellors
      if (n.recipientUserId && n.recipientUserId === targetId) return true;
      if (n.recipientTarget && n.recipientTarget === targetId) return true;
      if (user?.email && n.recipient && n.recipient.toLowerCase() === user.email.toLowerCase()) return true;
      return false;
    });
  }

  public markNotificationAsRead(id: string): void {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.isRead = true;
      this.saveToStorage();
      this.notify();
    }
  }

  // --- Forms ---
  public getForms(): FormDefinition[] {
    return [...this.forms].sort((a, b) => a.order - b.order);
  }

  public getFormById(id: string): FormDefinition | undefined {
    return this.forms.find((f) => f.id === id || f.code === id);
  }

  public saveForm(form: FormDefinition) {
    const index = this.forms.findIndex((f) => f.id === form.id);
    if (index >= 0) {
      this.forms[index] = form;
      this.logAudit('UPDATE_FORM', 'Form', form.id, `Updated form "${form.name}"`);
    } else {
      this.forms.push(form);
      this.logAudit('CREATE_FORM', 'Form', form.id, `Created new form "${form.name}"`);
    }
    this.saveToStorage();
  }

  public duplicateForm(formId: string): FormDefinition | undefined {
    const original = this.forms.find((f) => f.id === formId);
    if (!original) return undefined;

    const copy: FormDefinition = {
      ...JSON.parse(JSON.stringify(original)),
      id: `form-${Date.now()}`,
      code: `${original.code}_copy`,
      name: `${original.name} (Copy)`,
      order: this.forms.length + 1,
    };
    this.forms.push(copy);
    this.logAudit('CREATE_FORM', 'Form', copy.id, `Duplicated form from "${original.name}"`);
    this.saveToStorage();
    return copy;
  }

  public toggleFormActive(formId: string) {
    const form = this.forms.find((f) => f.id === formId);
    if (form) {
      form.active = !form.active;
      this.logAudit('UPDATE_FORM', 'Form', form.id, `${form.active ? 'Activated' : 'Deactivated'} form "${form.name}"`);
      this.saveToStorage();
    }
  }

  // --- Workflows ---
  public getWorkflows(): WorkflowStage[] {
    return [...this.workflows].sort((a, b) => a.order - b.order);
  }

  public saveWorkflows(workflows: WorkflowStage[]) {
    this.workflows = workflows;
    this.logAudit('UPDATE_WORKFLOW', 'Workflow', 'all', 'Updated assessment pipeline sequence and delay intervals.');
    this.saveToStorage();
  }

  // --- Assessment Submissions with Role Enforcement ---
  public getSubmissions(): AssessmentSubmission[] {
    const user = authService.getCurrentUser();
    if (!user) return [];

    if (user.role === 'Super Admin') {
      return [...this.submissions].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }

    if (user.role === 'Counsellor') {
      const myClients = this.getClients();
      const myClientIds = new Set(myClients.map((c) => c.id));
      return this.submissions
        .filter((s) => myClientIds.has(s.clientId))
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }

    if (user.role === 'Client' && user.clientId) {
      return this.submissions
        .filter((s) => s.clientId === user.clientId)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    }

    return [];
  }

  public getSubmissionsByClientId(clientId: string): AssessmentSubmission[] {
    const user = authService.getCurrentUser();
    if (!user) return [];

    if (user.role === 'Client') {
      if (user.clientId !== clientId) return [];
      return this.submissions
        .filter((s) => s.clientId === clientId)
        .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    }

    if (user.role === 'Counsellor') {
      const client = this.getClientById(clientId);
      if (!client) return []; // Not assigned to this counsellor
      return this.submissions
        .filter((s) => s.clientId === clientId)
        .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    }

    if (user.role === 'Super Admin' || user.role === 'Staff') {
      return this.submissions
        .filter((s) => s.clientId === clientId)
        .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    }

    return [];
  }

  public submitAssessment(data: {
    clientId: string;
    formId: string;
    answers: { questionId: string; answer: any; score?: number }[];
    section5Score?: number;
    gpdsScore?: number;
    totalScore?: number;
  }): { submission: AssessmentSubmission; nextStageName?: string; delayDays?: number } {
    const client = this.clients.find((c) => c.id === data.clientId || c.secureAccessKey === data.clientId);
    if (!client) throw new Error('Client not found');

    const form = this.forms.find((f) => f.id === data.formId || f.code === data.formId);
    if (!form) throw new Error('Form not found');

    // Duplicate submission guard (Scenario 8: Prevent duplicate submission or link reuse)
    const existingSubmission = this.submissions.find(
      (s) => s.clientId === client.id && s.formId === form.id
    );
    if (existingSubmission && client.nextAssessmentId && client.nextAssessmentId !== form.id) {
      throw new Error(`This assessment (${form.name}) has already been completed. Your next scheduled stage is ${client.nextAssessmentName || 'in progress'}.`);
    }

    // Calculate score
    let calculatedScore: number | undefined = data.totalScore;
    let riskLevel: 'Low' | 'Medium' | 'High' | 'Severe' | undefined = undefined;

    if (calculatedScore === undefined && form.enableScoring) {
      calculatedScore = 0;
      data.answers.forEach((ans) => {
        if (typeof ans.score === 'number') {
          calculatedScore! += ans.score;
        } else if (ans.answer) {
          const qDef = form.questions?.find((q) => q.id === ans.questionId);
          if (qDef && qDef.options) {
            const opt = qDef.options.find((o) => o.value === ans.answer);
            if (opt && typeof opt.score === 'number') {
              calculatedScore! += opt.score;
            }
          }
        }
      });
    }

    // Match scoring range
    if (form.scoringRanges && form.scoringRanges.length > 0 && typeof calculatedScore === 'number') {
      const matched = form.scoringRanges.find(
        (r) => calculatedScore! >= r.minScore && calculatedScore! <= r.maxScore
      );
      if (matched) {
        riskLevel = matched.label;
      }
    }

    const now = new Date().toISOString();
    const submissionId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Build enriched answers with question text
    const enrichedAnswers = data.answers.map((a) => {
      const q = form.questions?.find((item) => item.id === a.questionId);
      return {
        questionId: a.questionId,
        questionText: (a as any).questionText || (q ? q.text : a.questionId),
        questionType: (q ? q.type : 'short_text') as any,
        answer: a.answer,
        score: a.score,
      };
    });

    const submission: AssessmentSubmission = {
      id: submissionId,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`.trim() || client.fullName || 'Client',
      formId: form.id,
      formName: form.name,
      stageId: client.currentStageId,
      submittedAt: now,
      answers: enrichedAnswers,
      section5Score: data.section5Score,
      gpdsScore: data.gpdsScore,
      totalScore: calculatedScore,
      scoreRiskLevel: riskLevel,
      status: riskLevel === 'High' || riskLevel === 'Severe' ? 'Flagged' : 'Completed',
    };

    this.submissions.unshift(submission);

    // Update client trajectory:
    client.lastAssessmentName = form.name;
    client.lastAssessmentDate = now;
    if (data.section5Score !== undefined || data.gpdsScore !== undefined) {
      client.result = `Section 5 Score: ${data.section5Score ?? 'N/A'}/19, GPDS: ${data.gpdsScore ?? 'N/A'}/10. Risk: ${riskLevel || 'Standard'}`;
    }

    // Update client trajectory:
    // Determine the next stage in workflow
    const currentWorkflowIndex = this.workflows.findIndex((w) => w.formId === form.id || w.id === client.currentStageId);
    const nextStage = currentWorkflowIndex >= 0 && currentWorkflowIndex < this.workflows.length - 1
      ? this.workflows[currentWorkflowIndex + 1]
      : null;

    client.totalAssessmentsCompleted += 1;
    client.lastActivityDate = now;
    if (riskLevel) {
      client.riskLevel = riskLevel === 'Severe' ? 'High' : riskLevel;
    }

    let delayDays = form.waitingDaysAfterCompletion || 7;

    if (nextStage) {
      delayDays = nextStage.delayDaysFromPrevious || form.waitingDaysAfterCompletion || 7;
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + delayDays);

      client.currentStageId = nextStage.id;
      client.currentStageName = nextStage.stageName;
      client.nextAssessmentId = nextStage.formId;
      const nextForm = this.forms.find((f) => f.id === nextStage.formId);
      client.nextAssessmentName = nextForm ? nextForm.name : nextStage.stageName;
      client.nextAssessmentDueDate = nextDueDate.toISOString();
      client.status = 'Active';

      // Queue automated reminder for the next assessment
      this.queueNotification({
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        channel: 'Email',
        recipient: client.email,
        subject: `Your GamblePause ${client.nextAssessmentName} is Scheduled`,
        messageBody: `Hello ${client.firstName},\n\nThank you for completing your ${form.name}.\n\nYour next check-in (${client.nextAssessmentName}) will be ready in ${delayDays} days on ${nextDueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.\n\nKeep holding the pause.\n\nWarmly,\nGamblePause Initiative Africa`,
        triggerType: 'Assessment Ready',
        status: 'Queued',
        scheduledFor: nextDueDate.toISOString(),
      });
    } else {
      // Completed all assessments in the workflow
      client.nextAssessmentId = undefined;
      client.nextAssessmentName = 'Programme Completed';
      client.nextAssessmentDueDate = undefined;
      client.status = 'Completed';

      this.queueNotification({
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        channel: 'Email',
        recipient: client.email,
        subject: 'Congratulations on Completing your GamblePause Journey!',
        messageBody: `Hello ${client.firstName},\n\nCongratulations on completing your assessment pathway with GamblePause Initiative Africa. You have demonstrated incredible perseverance and strength.\n\nOur counsellors remain on standby whenever you need advice or peer connection.\n\nWarm regards,\nGamblePause Initiative Africa`,
        triggerType: 'Assessment Ready',
        status: 'Queued',
        scheduledFor: now,
      });
    }

    this.logAudit(
      'SUBMIT_ASSESSMENT',
      'Assessment',
      submission.id,
      `Client ${client.firstName} ${client.lastName} submitted "${form.name}". Total score: ${calculatedScore ?? 'N/A'}`
    );

    this.saveToStorage();
    return { submission, nextStageName: nextStage?.stageName, delayDays };
  }

  // --- Case Notes with Role Enforcement ---
  public getAllCaseNotes(): CaseNote[] {
    const user = authService.getCurrentUser();
    if (!user) return [];
    if (
      user.role === 'Super Admin' ||
      ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org'].includes(user.email.toLowerCase())
    ) {
      return [...this.caseNotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (user.role === 'Counsellor') {
      const myClients = new Set(this.getClients().map((c) => c.id));
      return this.caseNotes.filter((n) => myClients.has(n.clientId) || n.authorId === user.id);
    }
    return [];
  }

  public getCaseNotes(clientId: string): CaseNote[] {
    const user = authService.getCurrentUser();
    if (!user) return [];

    // Clients NEVER have permission to read case notes
    if (user.role === 'Client') return [];

    if (user.role === 'Counsellor') {
      const client = this.getClientById(clientId);
      if (!client) return []; // Client not in their caseload
    }

    return this.caseNotes
      .filter((n) => n.clientId === clientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public addCaseNote(clientId: string, content: string, followUpDate?: string, tags: string[] = []): CaseNote {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'Counsellor' && user.role !== 'Super Admin')) {
      throw new Error('Unauthorized: Only assigned counsellors and administrators can add clinical case notes.');
    }

    const note: CaseNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      clientId,
      authorId: user.id,
      authorName: user.name,
      authorRole: user.role,
      createdAt: new Date().toISOString(),
      content,
      followUpDate,
      tags,
    };
    this.caseNotes.unshift(note);
    this.logAudit('ADD_CASE_NOTE', 'CaseNote', note.id, `Added case note for client ${clientId}`);
    this.saveToStorage();
    return note;
  }

  // --- Staff Directory with Role Enforcement ---
  public getStaff(): StaffUser[] {
    const user = authService.getCurrentUser();
    if (!user || user.role === 'Client') {
      // Unauthenticated or Client cannot view internal staff list
      return [];
    }
    return [...this.staff];
  }

  public saveStaffUser(user: StaffUser): StaffUser {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'Super Admin') {
      throw new Error('Unauthorized: Only Super Admin can manage staff profiles.');
    }

    const existingIdx = this.staff.findIndex((s) => s.id === user.id);
    if (existingIdx >= 0) {
      this.staff[existingIdx] = user;
    } else {
      this.staff.push(user);
    }
    this.saveToStorage();
    this.logAudit('STAFF_UPDATE', 'Staff', user.id, `Saved staff user ${user.name} (${user.role})`);

    try {
      fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      }).catch((e) => console.warn('[dataService] Backend staff sync error:', e));
    } catch (e) {
      console.warn('[dataService] Fetch staff error:', e);
    }

    return user;
  }

  // --- Notifications ---
  public getNotifications(): NotificationLog[] {
    const user = authService.getCurrentUser();
    if (!user || (user.role !== 'Super Admin' && user.role !== 'Staff')) {
      return [];
    }
    return [...this.notifications].sort(
      (a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
    );
  }

  public queueNotification(notif: Omit<NotificationLog, 'id'>): NotificationLog {
    const entry: NotificationLog = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    };
    this.notifications.unshift(entry);
    this.saveToStorage();
    return entry;
  }

  public triggerSendNotification(notifId: string) {
    const notif = this.notifications.find((n) => n.id === notifId);
    if (!notif) return;
    notif.status = 'Sent';
    notif.sentAt = new Date().toISOString();
    this.logAudit(
      'SEND_NOTIFICATION',
      'Client',
      notif.clientId,
      `Sent ${notif.channel} notification to ${notif.recipient} (${notif.subject || notif.triggerType})`
    );
    this.saveToStorage();
  }

  // --- High Level Metrics Isolated By Role ---
  public getDashboardMetrics() {
    const user = authService.getCurrentUser();
    if (!user || user.role === 'Client') {
      return {
        totalClients: 0,
        activeClients: 0,
        newClients: 0,
        assessmentsDueToday: 0,
        overdueAssessments: 0,
        completedAssessments: 0,
        clientsRequiringFollowup: 0,
      };
    }

    // Counsellor metrics are computed strictly on their assigned caseload
    const clientPool = this.getClients();
    const clientIds = new Set(clientPool.map((c) => c.id));
    const submissionPool = this.submissions.filter((s) => clientIds.has(s.clientId));

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const totalClients = clientPool.length;
    const activeClients = clientPool.filter((c) => c.status === 'Active').length;
    const newClients = clientPool.filter((c) => new Date(c.registrationDate) >= sevenDaysAgo).length;

    const assessmentsDueToday = clientPool.filter((c) => {
      if (!c.nextAssessmentDueDate || c.status === 'Completed' || c.status === 'Closed') return false;
      const d = new Date(c.nextAssessmentDueDate);
      const isToday = d.toDateString() === new Date().toDateString();
      return isToday || c.status === 'Assessment Due';
    }).length;

    const overdueAssessments = clientPool.filter((c) => {
      if (c.status === 'Overdue') return true;
      if (!c.nextAssessmentDueDate || c.status === 'Completed' || c.status === 'Closed') return false;
      return new Date(c.nextAssessmentDueDate).getTime() < new Date().getTime();
    }).length;

    const completedAssessments = submissionPool.length;
    const clientsRequiringFollowup = clientPool.filter(
      (c) => c.riskLevel === 'High' || c.status === 'Overdue' || c.status === 'Assessment Due'
    ).length;

    return {
      totalClients,
      activeClients,
      newClients,
      assessmentsDueToday,
      overdueAssessments,
      completedAssessments,
      clientsRequiringFollowup,
    };
  }
}

export const dataService = new DataService();
