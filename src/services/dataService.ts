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
  AssessmentAccessMode,
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
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

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
  SETTINGS: 'gamblepause_settings',
};

/**
 * Recursively removes or converts undefined values to null to ensure Firestore setDoc/updateDoc
 * calls never fail with 'Function setDoc() called with invalid data. Unsupported field value: undefined'.
 */
function cleanForFirestore<T>(data: T): T {
  if (data === undefined) return null as any;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map((item) => cleanForFirestore(item)) as any;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    } else {
      cleaned[key] = null;
    }
  }
  return cleaned as any;
}

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
  private firestoreClientsUnsubscribe: (() => void) | null = null;
  private firestoreWorkflowsUnsubscribe: (() => void) | null = null;
  private firestoreFormsUnsubscribe: (() => void) | null = null;
  private firestoreSettingsUnsubscribe: (() => void) | null = null;
  private firestoreSyncActive: boolean = false;
  private authoritativeLoaded: boolean = false;
  private assessmentAccessMode: AssessmentAccessMode = 'scheduled';

  constructor() {
    this.loadFromStorage();
    this.cleanseStaleStaff();
    this.cleanseWorkflows();
    this.syncAllFromFirestore();
    this.initRealtimeEvents();
    // Re-sync with Firestore whenever auth state changes (e.g. login/logout)
    authService.subscribe((user) => {
      if (user) {
        this.syncAllFromFirestore();
        if (user.role === 'Super Admin') {
          this.reconcileCanonicalWorkflowIfSuperAdmin().catch(() => {});
        }
      } else {
        this.clients = [];
        this.authoritativeLoaded = false;
      }
      this.notify();
    });
  }

  public isAuthoritativeLoaded(): boolean {
    return this.authoritativeLoaded;
  }

  public async ensureAuthoritativeData(): Promise<void> {
    if (this.authoritativeLoaded) return;
    await this.syncAllFromFirestore();
  }

  /**
   * Unified authoritative sync for Cloud Firestore collections based on authenticated role
   */
  public async syncAllFromFirestore(): Promise<void> {
    const user = authService.getCurrentUser();

    // 1. Public collections readable by everyone (forms, workflows, app settings)
    const tasks: Promise<any>[] = [
      this.syncFormsAndWorkflowsFromFirestore(),
      this.syncSettingsFromFirestore(),
    ];

    if (!user) {
      await Promise.allSettled(tasks);
      return;
    }

    const isSuperAdminUser =
      user.role === 'Super Admin' ||
      ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org', 'stevobenjo@gmail.com'].includes(
        user.email?.toLowerCase() || ''
      );

    if (isSuperAdminUser) {
      // Super Admin: full access to all collections
      tasks.push(
        this.syncClientsFromFirestore(),
        this.syncStaffFromFirestore(),
        this.syncAssessmentResponsesFromFirestore(),
        this.syncAssignmentsFromFirestore(),
        this.syncNotificationsFromFirestore()
      );
    } else if (user.role === 'Counsellor' || user.role === 'Staff' || user.role === 'Analyst / Viewer') {
      // Staff / Counsellors: sync staff, assigned clients, responses, assignments, and notifications
      tasks.push(
        this.syncClientsFromFirestore(),
        this.syncStaffFromFirestore(),
        this.syncAssessmentResponsesFromFirestore(),
        this.syncAssignmentsFromFirestore(),
        this.syncNotificationsFromFirestore()
      );
    } else if (user.role === 'Client') {
      // Client: ONLY sync their own client record and their own responses
      tasks.push(
        this.syncClientsFromFirestore(),
        this.syncAssessmentResponsesFromFirestore()
      );
    }

    await Promise.allSettled(tasks);
  }

  /**
   * Authoritative real-time retrieval of global settings (e.g. assessmentAccessMode) from Cloud Firestore
   */
  public async syncSettingsFromFirestore(): Promise<void> {
    if (!db || !isFirebaseConfigured) return;
    try {
      const snap = await getDoc(doc(db, 'settings', 'app'));
      if (snap.exists()) {
        const data = snap.data();
        if (data && (data.assessmentAccessMode === 'scheduled' || data.assessmentAccessMode === 'testing')) {
          this.assessmentAccessMode = data.assessmentAccessMode;
        }
      }

      if (this.firestoreSettingsUnsubscribe) {
        this.firestoreSettingsUnsubscribe();
      }
      this.firestoreSettingsUnsubscribe = onSnapshot(
        doc(db, 'settings', 'app'),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && (data.assessmentAccessMode === 'scheduled' || data.assessmentAccessMode === 'testing')) {
              const changed = this.assessmentAccessMode !== data.assessmentAccessMode;
              this.assessmentAccessMode = data.assessmentAccessMode;
              if (changed) {
                this.saveToStorage();
                this.notify();
              }
            }
          }
        },
        (err) => {
          console.warn('[DataService] Firestore settings listener notice:', err?.message || err);
        }
      );
    } catch (err: any) {
      console.warn('[DataService] Firestore settings sync notice:', err?.message || err);
    }
  }

  public getAssessmentAccessMode(): AssessmentAccessMode {
    return this.assessmentAccessMode;
  }

  public async setAssessmentAccessMode(mode: AssessmentAccessMode): Promise<{ success: boolean; error?: string }> {
    const user = authService.getCurrentUser();
    if (!user || user.role !== 'Super Admin') {
      return { success: false, error: 'Unauthorized: Only Super Admins can configure assessment access mode.' };
    }
    if (mode !== 'scheduled' && mode !== 'testing') {
      return { success: false, error: 'Invalid mode. Must be "scheduled" or "testing".' };
    }

    const oldMode = this.assessmentAccessMode;

    if (db && isFirebaseConfigured) {
      try {
        await setDoc(
          doc(db, 'settings', 'app'),
          {
            assessmentAccessMode: mode,
            updatedAt: serverTimestamp(),
            updatedBy: user.email || user.id,
            updatedByName: user.name || 'Super Admin',
          },
          { merge: true }
        );
        console.log(`[Firestore] assessmentAccessMode updated to "${mode}" in settings/app.`);
      } catch (err: any) {
        console.error('[DataService] Error saving assessmentAccessMode to Firestore:', err);
        return { success: false, error: `Firestore Error: ${err?.message || err}` };
      }
    }

    this.assessmentAccessMode = mode;
    this.saveToStorage();
    this.logAudit(
      'CHANGE_ACCESS_MODE',
      'System',
      'app',
      `Assessment access mode changed from "${oldMode}" to "${mode}" by ${user.name || user.email}.`
    );
    this.notify();
    return { success: true };
  }

  public async updateStageDelay(stageId: string, newDelayDays: number): Promise<{ success: boolean; error?: string }> {
    const user = authService.getCurrentUser();
    if (!user || user.role !== 'Super Admin') {
      return { success: false, error: 'Unauthorized: Only Super Admins can configure stage delay intervals.' };
    }
    if (typeof newDelayDays !== 'number' || isNaN(newDelayDays) || newDelayDays < 0 || !Number.isInteger(newDelayDays)) {
      return { success: false, error: 'Delay interval must be a valid non-negative integer (e.g. 0, 7, 14).' };
    }

    const stage = this.workflows.find((w) => w.id === stageId);
    if (!stage) {
      return { success: false, error: `Workflow stage "${stageId}" not found.` };
    }

    const oldDelay = stage.delayDaysFromPrevious;

    if (db && isFirebaseConfigured) {
      try {
        await setDoc(
          doc(db, 'workflows', stageId),
          {
            delayDaysFromPrevious: newDelayDays,
            updatedAt: serverTimestamp(),
            updatedBy: user.email || user.id,
          },
          { merge: true }
        );
        console.log(`[Firestore] Stage "${stageId}" delay updated to ${newDelayDays} days.`);
      } catch (err: any) {
        console.error(`[Firestore] Error updating stage delay for ${stageId}:`, err);
        return { success: false, error: `Firestore Error: ${err?.message || err}` };
      }
    }

    stage.delayDaysFromPrevious = newDelayDays;
    this.saveToStorage();
    this.logAudit(
      'UPDATE_WORKFLOW_DELAY',
      'Workflow',
      stageId,
      `Wait interval for stage "${stage.stageName}" updated from ${oldDelay} to ${newDelayDays} days by ${user.name || user.email}.`
    );
    this.notify();
    return { success: true };
  }

  /**
   * Atomically reconciles the canonical 6-stage clinical pathway in Cloud Firestore
   */
  public async reconcileCanonicalWorkflowIfSuperAdmin(): Promise<{ success: boolean; error?: string }> {
    const user = authService.getCurrentUser();
    if (!user || user.role !== 'Super Admin') {
      return { success: false, error: 'Unauthorized: Super Admin required' };
    }
    if (!db || !isFirebaseConfigured) {
      return { success: false, error: 'Firestore not configured' };
    }

    try {
      const batch = writeBatch(db);

      // 1. Six canonical active clinical pathway stages
      const canonicalStages: WorkflowStage[] = [
        {
          id: 'stage-assessment-1',
          formId: 'form-recovery-1',
          stageName: 'Assessment 1.0',
          order: 1,
          delayDaysFromPrevious: 0,
          description: 'Baseline clinical assessment, gambling budget, Exercise 1.0, and diagnostic screening.',
          isInitialRegistration: false,
          isActive: true,
          isLegacy: false,
        },
        {
          id: 'stage-assessment-2',
          formId: 'form-assessment-2',
          stageName: 'Assessment 2.0',
          order: 2,
          delayDaysFromPrevious: 7,
          description: 'Dealing With Family Members & Consequences of Gambling.',
          isInitialRegistration: false,
          isActive: true,
          isLegacy: false,
        },
        {
          id: 'stage-assessment-3',
          formId: 'form-assessment-3',
          stageName: 'Assessment 3.0',
          order: 3,
          delayDaysFromPrevious: 7,
          description: 'Developing Alternative Thoughts & Cognitive Restructuring.',
          isInitialRegistration: false,
          isActive: true,
          isLegacy: false,
        },
        {
          id: 'stage-assessment-4',
          formId: 'form-assessment-4',
          stageName: 'Assessment 4.0',
          order: 4,
          delayDaysFromPrevious: 7,
          description: 'Recognizing and Dealing With Triggers (8 Techniques & Homework #5).',
          isInitialRegistration: false,
          isActive: true,
          isLegacy: false,
        },
        {
          id: 'stage-assessment-5',
          formId: 'form-assessment-5',
          stageName: 'Assessment 5.0',
          order: 5,
          delayDaysFromPrevious: 7,
          description: 'Avoiding Avoidance, Rating Coping Strategies & New Activities.',
          isInitialRegistration: false,
          isActive: true,
          isLegacy: false,
        },
        {
          id: 'stage-feedback',
          formId: 'form-feedback',
          stageName: 'Client Feedback',
          order: 6,
          delayDaysFromPrevious: 7,
          description: 'Quality of Psychological Support & Perceived Improvement Evaluation.',
          isInitialRegistration: false,
          isActive: true,
          isLegacy: false,
        },
      ];

      for (const st of canonicalStages) {
        // Preserve any custom delay if already configured by admin
        const existing = this.workflows.find((w) => w.id === st.id);
        if (existing && typeof existing.delayDaysFromPrevious === 'number') {
          st.delayDaysFromPrevious = existing.delayDaysFromPrevious;
        }
        batch.set(doc(db, 'workflows', st.id), cleanForFirestore(st), { merge: true });
      }

      // 2. Mark legacy old 5-stage workflow records inactive
      const legacyStageIds = [
        'stage-initial',
        'stage-followup-1',
        'stage-followup-2',
        'stage-recovery',
        'stage-final',
      ];
      for (const legId of legacyStageIds) {
        batch.set(doc(db, 'workflows', legId), { isActive: false, isLegacy: true }, { merge: true });
      }

      // 3. Ensure settings document exists
      batch.set(
        doc(db, 'settings', 'app'),
        {
          assessmentAccessMode: this.assessmentAccessMode || 'scheduled',
        },
        { merge: true }
      );

      await batch.commit();
      console.log('[Firestore] Canonical 6-stage clinical pathway atomically reconciled in Firestore.');

      // Refresh workflows
      await this.syncFormsAndWorkflowsFromFirestore();
      this.logAudit(
        'RECONCILE_WORKFLOW',
        'Workflow',
        'canonical-6-stage',
        'Canonical 6-stage clinical pathway atomically reconciled in Firestore.'
      );
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore] Error reconciling canonical workflow in Firestore:', err);
      return { success: false, error: err?.message || 'Firestore commit error' };
    }
  }

  /**
   * Authoritative real-time and snapshot retrieval of real clients from Cloud Firestore
   */
  public async syncClientsFromFirestore(): Promise<void> {
    if (!db || !isFirebaseConfigured) {
      console.warn('[DataService] Firestore db instance not available for sync.');
      return;
    }

    const user = authService.getCurrentUser();
    if (!user) {
      // Clients collection is protected by firestore.rules; await valid authentication
      return;
    }

    // Role-specific client retrieval
    if (user.role === 'Client') {
      const clientAuthUid = auth.currentUser?.uid || user.id;
      if (clientAuthUid) {
        await this.getClientByAuthUid(clientAuthUid);
      }
      return;
    }

    if (user.role === 'Counsellor') {
      try {
        const firestoreClientsMap = new Map<string, Client>();
        const userEmail = (user.email || '').toLowerCase().trim();
        const staffMember = this.staff.find(
          (s) => s.authUid === user.id || s.id === user.id || (userEmail && s.email?.toLowerCase() === userEmail)
        );
        const staffId = staffMember?.id;
        const counsellorName = user.name || staffMember?.name;

        // Query 1: by assignedCounsellorId == user.id (Auth UID)
        try {
          const qId = query(collection(db, 'clients'), where('assignedCounsellorId', '==', user.id));
          const snapId = await getDocs(qId);
          snapId.forEach((docSnap) => {
            const data = docSnap.data() as Client;
            if (data && data.id) {
              firestoreClientsMap.set(data.id, { ...data, isDemo: false });
            }
          });
        } catch (e: any) {
          console.warn('[DataService] Counsellor query by assignedCounsellorId notice:', e?.message || e);
        }

        // Query 2: by assignedCounsellorName == counsellorName
        // Authorized by firestore.rules: resource.data.assignedCounsellorName == getUserData().name
        if (counsellorName) {
          try {
            const qName = query(collection(db, 'clients'), where('assignedCounsellorName', '==', counsellorName));
            const snapName = await getDocs(qName);
            snapName.forEach((docSnap) => {
              const data = docSnap.data() as Client;
              if (data && data.id) {
                firestoreClientsMap.set(data.id, { ...data, isDemo: false });
              }
            });
          } catch (e: any) {
            console.warn('[DataService] Counsellor query by assignedCounsellorName notice:', e?.message || e);
          }
        }

        // Query 3: by assignedCounsellorId == staffId (e.g. counsellor-benjamin) if distinct from user.id
        if (staffId && staffId !== user.id) {
          try {
            const qStaffId = query(collection(db, 'clients'), where('assignedCounsellorId', '==', staffId));
            const snapStaffId = await getDocs(qStaffId);
            snapStaffId.forEach((docSnap) => {
              const data = docSnap.data() as Client;
              if (data && data.id) {
                firestoreClientsMap.set(data.id, { ...data, isDemo: false });
              }
            });
          } catch {
            // Safely ignored if security rules enforce Auth UID
          }
        }

        const firestoreClients = Array.from(firestoreClientsMap.values());
        this.mergeFirestoreClients(firestoreClients);
      } catch (err: any) {
        console.warn('[DataService] Counsellor clients sync notice:', err?.message || err);
      } finally {
        this.authoritativeLoaded = true;
        this.saveToStorage();
        this.notify();
      }
      return;
    }

    // Super Admin: authoritative retrieval of all clients
    try {
      const clientsCol = collection(db, 'clients');
      let snap;
      try {
        snap = await getDocsFromServer(clientsCol);
      } catch {
        snap = await getDocs(clientsCol);
      }

      const firestoreClients: Client[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Client;
        if (data && data.id) {
          firestoreClients.push({
            ...data,
            isDemo: false,
          });
        }
      });

      this.clients = firestoreClients.sort((a, b) => {
        const timeA = new Date(a.registrationDate).getTime() || 0;
        const timeB = new Date(b.registrationDate).getTime() || 0;
        return timeB - timeA;
      });
      this.authoritativeLoaded = true;
      this.saveToStorage();
      this.notify();

      // Refresh real-time snapshot listener
      if (this.firestoreClientsUnsubscribe) {
        this.firestoreClientsUnsubscribe();
        this.firestoreClientsUnsubscribe = null;
      }

      this.firestoreClientsUnsubscribe = onSnapshot(
        clientsCol,
        (snapshot) => {
          const realtimeClients: Client[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Client;
            if (data && data.id) {
              realtimeClients.push({
                ...data,
                isDemo: false,
              });
            }
          });
          this.clients = realtimeClients.sort((a, b) => {
            const timeA = new Date(a.registrationDate).getTime() || 0;
            const timeB = new Date(b.registrationDate).getTime() || 0;
            return timeB - timeA;
          });
          this.authoritativeLoaded = true;
          this.saveToStorage();
          this.notify();
        },
        (err) => {
          console.warn('[DataService] Firestore real-time clients listener warning:', err?.message || err);
        }
      );
      this.firestoreSyncActive = true;
    } catch (err: any) {
      console.warn('[DataService] Firestore clients sync notice:', err?.message || err);
    }
  }

  /**
   * Authoritative synchronization of staff and counsellors from Cloud Firestore
   */
  public async syncStaffFromFirestore(): Promise<void> {
    if (!db || !isFirebaseConfigured) return;
    const user = authService.getCurrentUser();
    const isStaffUser =
      user &&
      (user.role === 'Super Admin' ||
        user.role === 'Counsellor' ||
        user.role === 'Staff' ||
        user.role === 'Analyst / Viewer' ||
        ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org', 'stevobenjo@gmail.com'].includes(
          user.email?.toLowerCase() || ''
        ));
    if (!isStaffUser) return;

    try {
      const snap = await getDocs(collection(db, 'staff'));
      const firestoreStaff: StaffUser[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as StaffUser;
        if (data && data.name && data.role) {
          firestoreStaff.push({
            ...data,
            id: data.id || docSnap.id,
            active: data.active !== false && data.status !== 'Deactivated',
            status: data.status || (data.active !== false ? 'Active' : 'Deactivated'),
          });
        }
      });

      // Reconcile users collection documents only for Super Admin
      if (user.role === 'Super Admin') {
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.forEach((docSnap) => {
            const u = docSnap.data();
            if (u && u.role && u.role !== 'Client') {
              const existing = firestoreStaff.find(
                (s) => s.authUid === docSnap.id || (u.email && s.email?.toLowerCase() === u.email?.toLowerCase())
              );
              if (existing) {
                existing.authUid = docSnap.id;
                if (u.name) existing.name = u.name;
                if (u.email) existing.email = u.email;
                if (u.role) existing.role = u.role;
                if (u.status) existing.status = u.status;
                if (u.active !== undefined) existing.active = u.active !== false && u.status !== 'Deactivated';
              } else if (u.name && u.email) {
                firestoreStaff.push({
                  id: `user-${docSnap.id.substring(0, 10)}`,
                  authUid: docSnap.id,
                  name: u.name,
                  email: u.email,
                  role: u.role,
                  assignedClientsCount: 0,
                  active: u.active !== false && u.status !== 'Deactivated',
                  status: u.status || (u.active !== false ? 'Active' : 'Deactivated'),
                });
              }
            }
          });
        } catch (uErr) {
          console.warn('[DataService] Firestore users sync notice:', uErr);
        }
      }

      if (firestoreStaff.length > 0) {
        this.mergeFirestoreStaff(firestoreStaff);
      }
    } catch (err: any) {
      console.warn('[DataService] Firestore staff sync notice:', err?.message || err);
    }
  }

  private mergeFirestoreStaff(firestoreStaff: StaffUser[]): void {
    if (!Array.isArray(firestoreStaff) || firestoreStaff.length === 0) return;
    const staffMap = new Map<string, StaffUser>();
    for (const s of this.staff) {
      staffMap.set(s.id, s);
    }
    for (const fs of firestoreStaff) {
      staffMap.set(fs.id, {
        ...(staffMap.get(fs.id) || {}),
        ...fs,
      });
    }
    this.staff = Array.from(staffMap.values());
    this.cleanseStaleStaff();
    this.saveToStorage();
    this.notify();
  }

  /**
   * Authoritative synchronization of assessment responses from Cloud Firestore
   */
  public async syncAssessmentResponsesFromFirestore(): Promise<void> {
    if (!db || !isFirebaseConfigured) return;
    const user = authService.getCurrentUser();
    if (!user) return;

    if (user.role === 'Client') {
      const clientAuthUid = auth.currentUser?.uid || user.id;
      if (!clientAuthUid) return;
      try {
        const q = query(collection(db, 'assessmentResponses'), where('authUid', '==', clientAuthUid));
        const snap = await getDocs(q);
        const firestoreSubmissions: AssessmentSubmission[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.clientId) {
            firestoreSubmissions.push({
              id: data.id || docSnap.id,
              clientId: data.clientId,
              clientName: data.clientName || 'Client',
              formId: data.formId,
              formName: data.formTitle || data.formName || 'Assessment',
              stageId: data.stageId || 'stage-initial',
              submittedAt: data.submittedAt || new Date().toISOString(),
              answers: Array.isArray(data.answers) ? data.answers : [],
              totalScore: typeof data.totalScore === 'number' ? data.totalScore : (typeof data.score === 'number' ? data.score : undefined),
              section5Score: typeof data.section5Score === 'number' ? data.section5Score : undefined,
              gpdsScore: typeof data.gpdsScore === 'number' ? data.gpdsScore : undefined,
              scoreRiskLevel: data.scoreRiskLevel || data.severity || data.riskLevel,
              status: data.status || 'Completed',
              counsellorNotes: data.counsellorNotes,
            });
          }
        });
        if (firestoreSubmissions.length > 0) {
          this.mergeFirestoreSubmissions(firestoreSubmissions);
        }
      } catch (err: any) {
        console.warn('[DataService] Client own assessmentResponses sync notice:', err?.message || err);
      }
      return;
    }

    if (user.role === 'Counsellor') {
      // Counsellor: ONLY query assessmentResponses for their assigned clients
      // Strictly respects firestore.rules and prevents PERMISSION_DENIED
      try {
        const assignedClients = this.getClients();
        const firestoreSubmissions: AssessmentSubmission[] = [];

        for (const client of assignedClients) {
          if (!client.id) continue;
          try {
            const q = query(collection(db, 'assessmentResponses'), where('clientId', '==', client.id));
            const snap = await getDocs(q);
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              if (data && data.clientId) {
                firestoreSubmissions.push({
                  id: data.id || docSnap.id,
                  clientId: data.clientId,
                  clientName: data.clientName || client.fullName || `${client.firstName} ${client.lastName}` || 'Client',
                  formId: data.formId,
                  formName: data.formTitle || data.formName || 'Assessment',
                  stageId: data.stageId || 'stage-initial',
                  submittedAt: data.submittedAt || new Date().toISOString(),
                  answers: Array.isArray(data.answers) ? data.answers : [],
                  totalScore: typeof data.totalScore === 'number' ? data.totalScore : (typeof data.score === 'number' ? data.score : undefined),
                  section5Score: typeof data.section5Score === 'number' ? data.section5Score : undefined,
                  gpdsScore: typeof data.gpdsScore === 'number' ? data.gpdsScore : undefined,
                  scoreRiskLevel: data.scoreRiskLevel || data.severity || data.riskLevel,
                  status: data.status || 'Completed',
                  counsellorNotes: data.counsellorNotes,
                });
              }
            });
          } catch (cErr: any) {
            console.warn(`[DataService] Counsellor client ${client.id} responses sync notice:`, cErr?.message || cErr);
          }
        }

        if (firestoreSubmissions.length > 0) {
          this.mergeFirestoreSubmissions(firestoreSubmissions);
        }
      } catch (err: any) {
        console.warn('[DataService] Counsellor assessmentResponses sync notice:', err?.message || err);
      }
      return;
    }

    const isSuperAdminUser =
      user.role === 'Super Admin' ||
      ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org', 'stevobenjo@gmail.com'].includes(
        user.email?.toLowerCase() || ''
      );
    if (!isSuperAdminUser) return;

    try {
      const snap = await getDocs(collection(db, 'assessmentResponses'));
      const firestoreSubmissions: AssessmentSubmission[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.clientId) {
          firestoreSubmissions.push({
            id: data.id || docSnap.id,
            clientId: data.clientId,
            clientName: data.clientName || 'Client',
            formId: data.formId,
            formName: data.formTitle || data.formName || 'Assessment',
            stageId: data.stageId || 'stage-initial',
            submittedAt: data.submittedAt || new Date().toISOString(),
            answers: Array.isArray(data.answers) ? data.answers : [],
            totalScore: typeof data.totalScore === 'number' ? data.totalScore : (typeof data.score === 'number' ? data.score : undefined),
            section5Score: typeof data.section5Score === 'number' ? data.section5Score : undefined,
            gpdsScore: typeof data.gpdsScore === 'number' ? data.gpdsScore : undefined,
            scoreRiskLevel: data.scoreRiskLevel || data.severity || data.riskLevel,
            status: data.status || 'Completed',
            counsellorNotes: data.counsellorNotes,
          });
        }
      });
      if (firestoreSubmissions.length > 0) {
        this.mergeFirestoreSubmissions(firestoreSubmissions);
      }
    } catch (err: any) {
      console.warn('[DataService] Firestore assessmentResponses sync notice:', err?.message || err);
    }
  }

  private mergeFirestoreSubmissions(firestoreSubmissions: AssessmentSubmission[]): void {
    if (!Array.isArray(firestoreSubmissions) || firestoreSubmissions.length === 0) return;
    const subMap = new Map<string, AssessmentSubmission>();
    for (const s of this.submissions) {
      subMap.set(s.id, s);
    }
    for (const fs of firestoreSubmissions) {
      subMap.set(fs.id, fs);
    }
    this.submissions = Array.from(subMap.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    this.saveToStorage();
    this.notify();
  }

  /**
   * Authoritative synchronization of counsellor assignments from Cloud Firestore
   */
  public async syncAssignmentsFromFirestore(): Promise<void> {
    if (!db || !isFirebaseConfigured) return;
    const user = authService.getCurrentUser();
    if (!user) return;

    if (user.role === 'Counsellor') {
      try {
        const asgnsMap = new Map<string, CounsellorAssignmentHistory>();
        const userEmail = (user.email || '').toLowerCase().trim();
        const staffMember = this.staff.find(
          (s) => s.authUid === user.id || s.id === user.id || (userEmail && s.email?.toLowerCase() === userEmail)
        );
        const staffId = staffMember?.id;

        try {
          const qId = query(collection(db, 'counsellorAssignments'), where('newCounsellorId', '==', user.id));
          const snapId = await getDocs(qId);
          snapId.forEach((docSnap) => {
            const data = docSnap.data() as CounsellorAssignmentHistory;
            if (data && data.clientId) asgnsMap.set(data.id || docSnap.id, { ...data, id: data.id || docSnap.id });
          });
        } catch (e: any) {
          console.warn('[DataService] Counsellor assignments by user.id notice:', e?.message || e);
        }

        if (staffId && staffId !== user.id) {
          try {
            const qStaff = query(collection(db, 'counsellorAssignments'), where('newCounsellorId', '==', staffId));
            const snapStaff = await getDocs(qStaff);
            snapStaff.forEach((docSnap) => {
              const data = docSnap.data() as CounsellorAssignmentHistory;
              if (data && data.clientId) asgnsMap.set(data.id || docSnap.id, { ...data, id: data.id || docSnap.id });
            });
          } catch {
            // Safely ignored if rule strictly checks auth.uid
          }
        }

        const firestoreAssignments = Array.from(asgnsMap.values());
        if (firestoreAssignments.length > 0) {
          const asgnMap = new Map<string, CounsellorAssignmentHistory>();
          for (const a of this.counsellorAssignments) asgnMap.set(a.id, a);
          for (const fa of firestoreAssignments) asgnMap.set(fa.id, fa);
          this.counsellorAssignments = Array.from(asgnMap.values()).sort(
            (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
          );
          this.saveToStorage();
          this.notify();
        }
      } catch (err: any) {
        console.warn('[DataService] Counsellor assignments sync notice:', err?.message || err);
      }
      return;
    }

    const isSuperAdminUser =
      user.role === 'Super Admin' ||
      ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org', 'stevobenjo@gmail.com'].includes(
        user.email?.toLowerCase() || ''
      );
    if (!isSuperAdminUser) return;

    try {
      const snap = await getDocs(collection(db, 'counsellorAssignments'));
      const firestoreAssignments: CounsellorAssignmentHistory[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as CounsellorAssignmentHistory;
        if (data && data.clientId && data.newCounsellorId) {
          firestoreAssignments.push({
            ...data,
            id: data.id || docSnap.id,
          });
        }
      });
      if (firestoreAssignments.length > 0) {
        const asgnMap = new Map<string, CounsellorAssignmentHistory>();
        for (const a of this.counsellorAssignments) {
          asgnMap.set(a.id, a);
        }
        for (const fa of firestoreAssignments) {
          asgnMap.set(fa.id, fa);
        }
        this.counsellorAssignments = Array.from(asgnMap.values()).sort(
          (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
        );
        this.saveToStorage();
        this.notify();
      }
    } catch (err: any) {
      console.warn('[DataService] Firestore assignments sync notice:', err?.message || err);
    }
  }

  /**
   * Authoritative synchronization of forms and workflows from Cloud Firestore
   */
  public async syncFormsAndWorkflowsFromFirestore(): Promise<void> {
    if (!db || !isFirebaseConfigured) return;
    try {
      // 1. Sync Forms
      const formsSnap = await getDocs(collection(db, 'forms'));
      if (!formsSnap.empty) {
        const firestoreForms: FormDefinition[] = [];
        formsSnap.forEach((docSnap) => {
          const data = docSnap.data() as FormDefinition;
          if (data && data.name) {
            firestoreForms.push({ ...data, id: data.id || docSnap.id });
          }
        });
        if (firestoreForms.length > 0) {
          this.forms = firestoreForms.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }
      } else {
        // Seed standard GamblePause forms into Firestore so Firestore is single source of truth
        const seedForms = [...INITIAL_FORMS];
        for (const f of seedForms) {
          setDoc(doc(db, 'forms', f.id), cleanForFirestore(f), { merge: true }).catch(() => {});
        }
      }

      if (this.firestoreFormsUnsubscribe) {
        this.firestoreFormsUnsubscribe();
      }
      this.firestoreFormsUnsubscribe = onSnapshot(collection(db, 'forms'), (snapshot) => {
        const realtimeForms: FormDefinition[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as FormDefinition;
          if (data && data.name) {
            realtimeForms.push({ ...data, id: data.id || docSnap.id });
          }
        });
        if (realtimeForms.length > 0) {
          this.forms = realtimeForms.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          this.saveToStorage();
          this.notify();
        }
      });

      // 2. Sync Workflows
      const wfSnap = await getDocs(collection(db, 'workflows'));
      if (!wfSnap.empty) {
        const firestoreWfs: WorkflowStage[] = [];
        wfSnap.forEach((docSnap) => {
          const data = docSnap.data() as WorkflowStage;
          if (data && data.stageName) {
            firestoreWfs.push({ ...data, id: data.id || docSnap.id });
          }
        });
        if (firestoreWfs.length > 0) {
          this.workflows = firestoreWfs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        }
      }

      if (this.firestoreWorkflowsUnsubscribe) {
        this.firestoreWorkflowsUnsubscribe();
      }
      this.firestoreWorkflowsUnsubscribe = onSnapshot(collection(db, 'workflows'), (snapshot) => {
        const realtimeWfs: WorkflowStage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as WorkflowStage;
          if (data && data.stageName) {
            realtimeWfs.push({ ...data, id: data.id || docSnap.id });
          }
        });
        if (realtimeWfs.length > 0) {
          this.workflows = realtimeWfs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          this.cleanseWorkflows();
          this.saveToStorage();
          this.notify();
        }
      });

      this.cleanseWorkflows();
      this.saveToStorage();
      this.notify();
    } catch (err: any) {
      console.warn('[DataService] Firestore forms/workflows sync notice:', err?.message || err);
    }
  }

  /**
   * Authoritative synchronization of notifications from Cloud Firestore
   */
  public async syncNotificationsFromFirestore(): Promise<void> {
    if (!db || !isFirebaseConfigured) return;
    const user = authService.getCurrentUser();
    if (!user) return;

    if (user.role === 'Counsellor') {
      try {
        const notifsMap = new Map<string, NotificationLog>();
        const userEmail = (user.email || '').toLowerCase().trim();
        const staffMember = this.staff.find(
          (s) => s.authUid === user.id || s.id === user.id || (userEmail && s.email?.toLowerCase() === userEmail)
        );
        const counsellorName = user.name || staffMember?.name;
        const staffId = staffMember?.id;

        // Query 1: by counsellorId == user.id
        try {
          const qId = query(collection(db, 'notifications'), where('counsellorId', '==', user.id));
          const snapId = await getDocs(qId);
          snapId.forEach((docSnap) => {
            const data = docSnap.data() as NotificationLog;
            if (data && data.messageBody) notifsMap.set(data.id || docSnap.id, { ...data, id: data.id || docSnap.id });
          });
        } catch (e: any) {
          console.warn('[DataService] Counsellor notifications by counsellorId notice:', e?.message || e);
        }

        // Query 2: by counsellorName == counsellorName
        if (counsellorName) {
          try {
            const qName = query(collection(db, 'notifications'), where('counsellorName', '==', counsellorName));
            const snapName = await getDocs(qName);
            snapName.forEach((docSnap) => {
              const data = docSnap.data() as NotificationLog;
              if (data && data.messageBody) notifsMap.set(data.id || docSnap.id, { ...data, id: data.id || docSnap.id });
            });
          } catch (e: any) {
            console.warn('[DataService] Counsellor notifications by counsellorName notice:', e?.message || e);
          }
        }

        // Query 3: by staffId if distinct
        if (staffId && staffId !== user.id) {
          try {
            const qStaff = query(collection(db, 'notifications'), where('counsellorId', '==', staffId));
            const snapStaff = await getDocs(qStaff);
            snapStaff.forEach((docSnap) => {
              const data = docSnap.data() as NotificationLog;
              if (data && data.messageBody) notifsMap.set(data.id || docSnap.id, { ...data, id: data.id || docSnap.id });
            });
          } catch {
            // Safely ignored
          }
        }

        const firestoreNotifs = Array.from(notifsMap.values());
        if (firestoreNotifs.length > 0) {
          const nMap = new Map<string, NotificationLog>();
          for (const n of this.notifications) nMap.set(n.id, n);
          for (const fn of firestoreNotifs) nMap.set(fn.id, fn);
          this.notifications = Array.from(nMap.values()).sort(
            (a, b) => new Date(b.scheduledFor || b.sentAt || 0).getTime() - new Date(a.scheduledFor || a.sentAt || 0).getTime()
          );
          this.saveToStorage();
          this.notify();
        }
      } catch (err: any) {
        console.warn('[DataService] Counsellor notifications sync notice:', err?.message || err);
      }
      return;
    }

    const isSuperAdminUser =
      user.role === 'Super Admin' ||
      ['ayodejiharbiodun24@gmail.com', 'ladipo.abiose@gamblepause.org', 'stevobenjo@gmail.com'].includes(
        user.email?.toLowerCase() || ''
      );
    if (!isSuperAdminUser) return;

    try {
      const snap = await getDocs(collection(db, 'notifications'));
      if (!snap.empty) {
        const firestoreNotifs: NotificationLog[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as NotificationLog;
          if (data && data.messageBody) {
            firestoreNotifs.push({ ...data, id: data.id || docSnap.id });
          }
        });
        if (firestoreNotifs.length > 0) {
          const nMap = new Map<string, NotificationLog>();
          for (const n of this.notifications) nMap.set(n.id, n);
          for (const fn of firestoreNotifs) nMap.set(fn.id, fn);
          this.notifications = Array.from(nMap.values()).sort(
            (a, b) => new Date(b.scheduledFor || b.sentAt || 0).getTime() - new Date(a.scheduledFor || a.sentAt || 0).getTime()
          );
          this.saveToStorage();
          this.notify();
        }
      }
    } catch (err: any) {
      console.warn('[DataService] Firestore notifications sync notice:', err?.message || err);
    }
  }

  /**
   * Merges real Firestore clients authoritatively without keeping stale demo records
   */
  private mergeFirestoreClients(firestoreClients: Client[]): void {
    if (!Array.isArray(firestoreClients)) return;

    this.clients = firestoreClients.sort((a, b) => {
      const timeA = new Date(a.registrationDate).getTime() || 0;
      const timeB = new Date(b.registrationDate).getTime() || 0;
      return timeB - timeA;
    });

    this.authoritativeLoaded = true;
    this.saveToStorage();
    this.notify();
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

  /**
   * Cleanses the assessment pipeline so that client registration/biodata (which is already
   * permanently recorded during signup/intake) does not appear as an artificial locked assessment stage,
   * and legacy 5-stage workflow records remain inactive.
   */
  private cleanseWorkflows() {
    // 1. Strip redundant standalone registration / biodata stages
    this.workflows = this.workflows.filter((w) => {
      const name = (w.stageName || '').toLowerCase().trim();
      const id = (w.id || '').toLowerCase().trim();
      const formId = (w.formId || '').toLowerCase().trim();
      if (
        name === 'client registration / biodata' ||
        name === 'registration & biodata' ||
        name === 'client registration' ||
        name === 'registration' ||
        name === 'biodata' ||
        id === 'stage-registration' ||
        id === 'stage-biodata' ||
        formId === 'biodata' ||
        formId === 'form-biodata' ||
        formId === 'form-registration'
      ) {
        return false;
      }
      return true;
    });

    // 2. Ensure legacy old 5-stage documents are strictly marked inactive
    this.workflows.forEach((w) => {
      const id = (w.id || '').toLowerCase().trim();
      const name = (w.stageName || '').toLowerCase().trim();
      if (
        id === 'stage-initial' ||
        id === 'stage-followup-1' ||
        id === 'stage-followup-2' ||
        id === 'stage-recovery' ||
        id === 'stage-final' ||
        name === 'initial assessment' ||
        name === 'follow-up assessment 1' ||
        name === 'follow-up assessment 2' ||
        name === 'recovery progress assessment' ||
        name === 'final assessment'
      ) {
        w.isActive = false;
        w.isLegacy = true;
      }
    });

    // 3. Ensure order numbers are defined
    this.workflows.forEach((w, idx) => {
      w.order = typeof w.order === 'number' ? w.order : idx + 1;
    });
  }

  public async syncWithBackend(): Promise<void> {
    // Cloud Firestore is the single authoritative source of truth.
    // Local server json cache does not overwrite production Firestore data.
    return;
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
      this.cleanseWorkflows();
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
      const userEmail = (user.email || '').toLowerCase().trim();
      const staffMember = this.staff.find(
        (s) => s.authUid === user.id || s.id === user.id || (userEmail && s.email?.toLowerCase() === userEmail)
      );
      const staffId = staffMember?.id;
      const staffName = staffMember?.name || user.name;
      const cleanName = (staffName || user.name || '').trim().toLowerCase();

      return this.clients.filter((c) => {
        if (c.assignedCounsellorId && (c.assignedCounsellorId === user.id || (staffId && c.assignedCounsellorId === staffId))) {
          return true;
        }
        if (c.assignedCounsellorName && cleanName) {
          const cName = c.assignedCounsellorName.trim().toLowerCase();
          if (cName === cleanName) return true;
          const firstPart = cleanName.split(' ')[0];
          if (firstPart.length > 2 && cName.includes(firstPart)) return true;
        }
        return false;
      });
    }

    if (user.role === 'Client') {
      // Client sees ONLY their own client record (by clientId or matching authUid)
      return this.clients.filter((c) => c.id === user.clientId || c.authUid === user.id);
    }

    if (user.role === 'Staff' || user.role === 'Analyst / Viewer') {
      return [...this.clients];
    }

    return [];
  }

  /**
   * Authoritative lookup of client profile by authenticated Firebase UID
   * Uses query where('authUid', '==', authUid) directly against Firestore
   */
  public async getClientByAuthUid(authUid: string): Promise<Client | undefined> {
    if (!authUid) return undefined;

    // First check in-memory cache
    const existing = this.clients.find((c) => c.authUid === authUid && !c.isDemo);

    if (db && isFirebaseConfigured) {
      try {
        const q = query(collection(db, 'clients'), where('authUid', '==', authUid));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          const data = docSnap.data() as Client;
          if (data && data.id) {
            const clientRecord: Client = {
              ...data,
              isDemo: false,
            };
            this.mergeFirestoreClients([clientRecord]);
            return clientRecord;
          }
        }
      } catch (err: any) {
        console.warn('[DataService] Error querying client by authUid:', err?.message || err);
      }
    }

    return existing;
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
      // Client can view their own client ID or record matching their auth UID
      if (user.clientId === client.id || client.authUid === user.id) return client;
      // Access denied when querying another client ID
      return undefined;
    }

    if (user.role === 'Counsellor') {
      const userEmail = (user.email || '').toLowerCase().trim();
      const staffMember = this.staff.find(
        (s) => s.authUid === user.id || s.id === user.id || (userEmail && s.email?.toLowerCase() === userEmail)
      );
      const staffId = staffMember?.id;
      const staffName = staffMember?.name || user.name;
      const cleanName = (staffName || user.name || '').trim().toLowerCase();

      const isAssigned =
        client.assignedCounsellorId === user.id ||
        (staffId && client.assignedCounsellorId === staffId) ||
        (client.assignedCounsellorName && cleanName && client.assignedCounsellorName.toLowerCase() === cleanName) ||
        (client.assignedCounsellorName && cleanName && client.assignedCounsellorName.toLowerCase().includes(cleanName.split(' ')[0]));
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

  public async generateNextClientId(): Promise<string> {
    // 1. Query server endpoint for synchronized sequence counter
    try {
      const res = await fetch('/api/clients/next-id');
      if (res.ok) {
        const data = await res.json();
        if (data && data.nextId) {
          return data.nextId;
        }
      }
    } catch {
      // Backend not reachable, fall back to robust local calculation
    }

    // 2. Scan in-memory clients
    const existingNumbers = this.clients
      .map((c) => {
        const match = c.id.match(/^GP-(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));

    // 3. Scan stored sequence in localStorage
    const storedSeq = parseInt(localStorage.getItem('gp_last_client_seq') || '0', 10);
    if (!isNaN(storedSeq) && storedSeq > 0) {
      existingNumbers.push(storedSeq);
    }

    // Baseline floor is 15 based on production Firestore records (GP-0001 through GP-0015)
    const maxNum = Math.max(15, ...existingNumbers);
    const nextNum = maxNum + 1;
    localStorage.setItem('gp_last_client_seq', String(nextNum));

    return `GP-${String(nextNum).padStart(4, '0')}`;
  }

  public async registerClient(biodata: {
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
    authUid?: string;
  }): Promise<Client> {
    // If Super Admin is active, fetch current clients to guarantee correct non-colliding client ID
    if (db && isFirebaseConfigured && authService.isSuperAdmin()) {
      try {
        const snap = await getDocs(collection(db, 'clients'));
        const remoteClients: Client[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as Client;
          if (d && d.id) {
            remoteClients.push({
              ...d,
              isDemo: false,
            });
          }
        });
        if (remoteClients.length > 0) {
          this.mergeFirestoreClients(remoteClients);
        }
      } catch (e) {
        console.warn('[Firestore] Pre-registration client query notice:', e);
      }
    }

    // Check if client record already exists for this authenticated UID
    let existingClient: Client | undefined;
    if (biodata.authUid) {
      existingClient = await this.getClientByAuthUid(biodata.authUid);
    }

    const clientId = existingClient?.id || (await this.generateNextClientId());
    const secureKey = existingClient?.secureAccessKey || `sec_${clientId.toLowerCase().replace('-', '')}_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    // Assign a counsellor evenly among active Counsellors ONLY (Super Admin, Staff, Analyst, Viewer, and inactive users are strictly excluded)
    const activeCounsellors = this.staff.filter(
      (s) => s.role === 'Counsellor' && s.active !== false && s.status !== 'Deactivated' && s.status !== 'Archived'
    );
    const assignedCounsellor = existingClient?.assignedCounsellorId
      ? this.staff.find((s) => s.id === existingClient?.assignedCounsellorId)
      : (activeCounsellors.length > 0 ? activeCounsellors[this.clients.length % activeCounsellors.length] : undefined);

    // Determine initial assessment for the canonical 6-stage clinical pathway
    const activeStages = this.getWorkflows(false);
    const initialStage = activeStages.find((w) => w.order === 1) || activeStages[0] || this.workflows.find((w) => w.id === 'stage-assessment-1' || w.formId === 'form-recovery-1');
    const initialForm = this.forms.find((f) => f.id === initialStage?.formId || f.id === 'form-recovery-1') || this.forms[0];

    const newClient: Client = {
      ...(existingClient || {}),
      id: clientId,
      ...biodata,
      registrationDate: existingClient?.registrationDate || now,
      status: 'Active',
      currentStageId: existingClient?.currentStageId || initialStage?.id || 'stage-assessment-1',
      currentStageName: existingClient?.currentStageName || initialStage?.stageName || 'Assessment 1.0',
      nextAssessmentId: existingClient?.nextAssessmentId || initialForm?.id || 'form-recovery-1',
      nextAssessmentName: existingClient?.nextAssessmentName || initialForm?.name || 'Assessment 1.0',
      nextAssessmentDueDate: existingClient?.nextAssessmentDueDate || now, // ready immediately upon registration
      assignedCounsellorId: existingClient?.assignedCounsellorId || assignedCounsellor?.id,
      assignedCounsellorName: existingClient?.assignedCounsellorName || assignedCounsellor?.name,
      lastActivityDate: now,
      totalAssessmentsCompleted: existingClient?.totalAssessmentsCompleted || 0,
      totalAssessmentsOverdue: existingClient?.totalAssessmentsOverdue || 0,
      riskLevel: existingClient?.riskLevel || 'Medium',
      secureAccessKey: secureKey,
      isDemo: false,
    };

    // Authoritative Cloud Firestore write: Await and verify BEFORE local storage persistence
    if (db && isFirebaseConfigured) {
      try {
        const cleanPayload = cleanForFirestore(newClient);
        await setDoc(doc(db, 'clients', cleanPayload.id), cleanPayload, { merge: true });
        console.log(`[Firestore] Client ${cleanPayload.id} successfully written and verified in Firestore.`);
      } catch (err: any) {
        console.error('[Firestore] Register client sync error:', err);
        const isPermDenied = err?.code === 'permission-denied' || err?.message?.includes('permission-denied');
        if (isPermDenied) {
          throw new Error('Firestore Authorization Error (permission-denied): Security rules rejected creating client document for this authenticated account.');
        }
        throw new Error(`Failed to save client record to Firestore database (${err?.code || err?.message || err}).`);
      }
    }

    // Only once Firestore write is confirmed, update in-memory and local state
    const existingIndex = this.clients.findIndex((c) => c.id === newClient.id);
    if (existingIndex >= 0) {
      this.clients[existingIndex] = newClient;
    } else {
      this.clients.unshift(newClient);
    }

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

    // Authoritatively create Counsellor Assignment Record and In-App Notification for assigned counsellor
    if (newClient.assignedCounsellorId) {
      const counsellorStaff = this.staff.find((s) => s.id === newClient.assignedCounsellorId);
      const assignedCounsellorName = newClient.assignedCounsellorName || counsellorStaff?.name || 'Counsellor';
      const counsellorEmail = counsellorStaff?.email || '';

      const assignmentRecord: CounsellorAssignmentHistory = {
        id: `asgn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        clientId: newClient.id,
        clientName: `${newClient.firstName} ${newClient.lastName}`,
        previousCounsellorId: '',
        previousCounsellorName: 'None (Initial Registration)',
        newCounsellorId: newClient.assignedCounsellorId,
        newCounsellorName: assignedCounsellorName,
        changedById: biodata.authUid || 'system-intake',
        changedByName: 'Initial Intake Registration',
        changedAt: now,
        reason: 'Initial intake assignment',
      };

      const notifTitle = 'New Client Assigned';
      const notifBody = `You have been assigned a new client, ${newClient.id}.`;
      const counsellorNotification: NotificationLog = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        clientId: newClient.id,
        clientName: `${newClient.firstName} ${newClient.lastName}`,
        channel: 'Dashboard' as any,
        recipient: counsellorEmail,
        recipientTarget: newClient.assignedCounsellorId,
        recipientUserId: newClient.assignedCounsellorId,
        counsellorId: newClient.assignedCounsellorId,
        counsellorName: assignedCounsellorName,
        subject: notifTitle,
        messageBody: notifBody,
        triggerType: notifTitle,
        status: 'Sent',
        scheduledFor: now,
        sentAt: now,
        isRead: false,
      };

      if (db && isFirebaseConfigured) {
        try {
          await setDoc(doc(db, 'counsellorAssignments', assignmentRecord.id), cleanForFirestore(assignmentRecord));
          await setDoc(doc(db, 'notifications', counsellorNotification.id), cleanForFirestore(counsellorNotification));
          console.log(`[Firestore] Initial counsellor assignment & notification created for client ${newClient.id}`);
        } catch (err: any) {
          console.warn('[Firestore] Notice persisting initial counsellor assignment/notification:', err?.message || err);
        }
      }

      this.counsellorAssignments.unshift(assignmentRecord);
      this.notifications.unshift(counsellorNotification);

      // Asynchronously trigger server-side email without blocking registration flow
      this.dispatchCounsellorAssignmentEmail({
        notificationId: counsellorNotification.id,
        clientId: newClient.id,
        counsellorId: newClient.assignedCounsellorId,
      }).catch((e) => console.warn('[Email Dispatch] Registration email trigger notice:', e));
    }

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
    await authService.registerClientCredentials(
      newClient.id,
      newClient.email,
      newClient.firstName,
      newClient.lastName,
      'Gamblepause'
    );

    return newClient;
  }

  public async updateClientStatus(clientId: string, status: ClientStatus, noteReason?: string): Promise<{ success: boolean; error?: string }> {
    const client = this.clients.find((c) => c.id === clientId);
    if (!client) return { success: false, error: 'Client not found' };

    const oldStatus = client.status;
    const now = new Date().toISOString();

    // Authoritative Cloud Firestore status sync first
    if (db && isFirebaseConfigured && !client.isDemo) {
      try {
        await updateDoc(doc(db, 'clients', clientId), {
          status,
          lastActivityDate: now,
        });
        console.log(`[Firestore] Client ${clientId} status updated to ${status} in Firestore.`);
      } catch (err: any) {
        console.error('[Firestore] Update status error:', err);
        return { success: false, error: `Failed to update status in Firestore: ${err?.message || err}` };
      }
    }

    client.status = status;
    client.lastActivityDate = now;

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

    return { success: true };
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

  public async assignCounsellor(
    clientId: string,
    staffId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string; assignment?: CounsellorAssignmentHistory }> {
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

    const assignerName = currentUser?.name || 'Super User';

    // 1. Permanent assignment history record
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

    // 2. Notification for new counsellor ONLY (strictly targeted to this counsellor's user ID)
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
      counsellorId: staff.id,
      counsellorName: staff.name,
      subject: notifTitle,
      messageBody: notifBody,
      triggerType: notifTitle,
      status: 'Sent',
      scheduledFor: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      isRead: false,
    };

    let prevNotif: NotificationLog | null = null;
    if (isReassignment && previousCounsellorId && prevStaff) {
      prevNotif = {
        id: `notif-prev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        channel: 'Dashboard' as any,
        recipient: prevStaff.email,
        recipientTarget: prevStaff.id,
        recipientUserId: prevStaff.id,
        counsellorId: prevStaff.id,
        counsellorName: prevStaff.name,
        subject: 'Client Reassigned to Another Counsellor',
        messageBody: `${client.id} has been transferred to counsellor ${staff.name} by ${assignerName}. Reason: ${assignmentRecord.reason}`,
        triggerType: 'Client Reassigned',
        status: 'Sent',
        scheduledFor: new Date().toISOString(),
        sentAt: new Date().toISOString(),
        isRead: false,
      };
    }

    // 3. Authoritative Cloud Firestore writes: Await confirmation BEFORE updating local state
    if (db && isFirebaseConfigured) {
      try {
        const clientRef = doc(db, 'clients', client.id);
        await updateDoc(clientRef, cleanForFirestore({
          assignedCounsellorId: staff.id,
          assignedCounsellorName: staff.name,
          lastActivityDate: new Date().toISOString(),
        }));

        await setDoc(doc(db, 'counsellorAssignments', assignmentRecord.id), cleanForFirestore(assignmentRecord));
        await setDoc(doc(db, 'notifications', counsellorNotification.id), cleanForFirestore(counsellorNotification));
        if (prevNotif) {
          await setDoc(doc(db, 'notifications', prevNotif.id), cleanForFirestore(prevNotif));
        }
      } catch (err: any) {
        console.error('[Firestore] Error persisting counsellor assignment:', err);
        return {
          success: false,
          error: `Failed to persist counsellor assignment in Firestore (${err?.message || err}).`,
        };
      }
    }

    // 4. Update in-memory state only after Firestore acknowledges write
    client.assignedCounsellorId = staff.id;
    client.assignedCounsellorName = staff.name;
    client.lastActivityDate = new Date().toISOString();

    this.counsellorAssignments.unshift(assignmentRecord);
    this.notifications.unshift(counsellorNotification);
    if (prevNotif) {
      this.notifications.unshift(prevNotif);
    }

    // 4b. Non-blocking trigger for real email notification to newly assigned counsellor
    this.dispatchCounsellorAssignmentEmail({
      notificationId: counsellorNotification.id,
      clientId: client.id,
      counsellorId: staff.id,
    }).catch((err) => console.warn('[Email Dispatch] Counsellor assignment email notice:', err));

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

    // 7. Persist to storage and notify listeners
    this.saveToStorage();
    this.notify();

    return { success: true, assignment: assignmentRecord };
  }

  public getActiveCounsellors(): StaffUser[] {
    return this.staff.filter((s) => s.role === 'Counsellor' && s.active !== false);
  }

  public async setStaffStatus(
    staffId: string,
    active: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const member = this.staff.find((s) => s.id === staffId);
    if (!member) {
      return { success: false, error: 'Staff member not found' };
    }

    const currentAdmin = authService.getCurrentUser();
    const adminUid = currentAdmin?.id || 'super-admin';
    const adminName = currentAdmin?.name || 'Super Admin';
    const authUid = member.authUid || member.id;
    const statusStr = active ? 'Active' : 'Deactivated';
    const now = serverTimestamp();

    const firestoreUpdate = active
      ? {
          active: true,
          status: 'Active',
          reactivatedAt: now,
          reactivatedBy: adminUid,
        }
      : {
          active: false,
          status: 'Deactivated',
          deactivatedAt: now,
          deactivatedBy: adminUid,
        };

    // 1. Authoritative Cloud Firestore write: Await before updating UI state
    if (db && isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'staff', staffId), firestoreUpdate, { merge: true });
        if (authUid) {
          await setDoc(doc(db, 'users', authUid), firestoreUpdate, { merge: true });
        }
      } catch (e: any) {
        console.error('[dataService] Firestore staff active update error:', e);
        return { success: false, error: `Failed to update status in Firestore: ${e?.message || e}` };
      }
    }

    // 2. Disable/Enable Firebase Authentication account and server credentials
    try {
      await fetch(`/api/staff/${staffId}/set-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active, status: statusStr, authUid, adminUid }),
      });
    } catch (e) {
      console.warn('[dataService] Backend staff status patch notice:', e);
    }

    // 3. Sync with authService
    await authService.toggleStaffStatus(authUid, active);

    // 4. Audit Log
    this.logAudit(
      active ? 'REACTIVATE_STAFF' : 'DEACTIVATE_STAFF',
      'Staff',
      staffId,
      `Staff/Counsellor "${member.name}" (${member.role}) ${active ? 'reactivated' : 'deactivated'} by ${adminName}.`
    );

    // 5. Reconcile UI and local state only after Firestore acknowledges write
    member.active = active;
    member.status = statusStr as any;
    this.saveToStorage();
    this.notify();

    return { success: true };
  }

  public async setCounsellorStatus(
    counsellorId: string,
    active: boolean
  ): Promise<{ success: boolean; error?: string }> {
    return this.setStaffStatus(counsellorId, active);
  }

  public getCounsellorNotifications(counsellorId?: string, counsellorName?: string): NotificationLog[] {
    const user = authService.getCurrentUser();
    const targetId = counsellorId || user?.id;
    const targetName = counsellorName || user?.name;
    const userEmail = (user?.email || '').toLowerCase().trim();

    const staffMember = this.staff.find(
      (s) => (targetId && (s.authUid === targetId || s.id === targetId)) || (userEmail && s.email?.toLowerCase() === userEmail)
    );
    const staffId = staffMember?.id;

    return this.notifications.filter((n) => {
      // Must match specifically this counsellor's ID or email - never leak notifications to other counsellors
      if (targetId && (n.counsellorId === targetId || n.recipientUserId === targetId || n.recipientTarget === targetId)) return true;
      if (staffId && (n.counsellorId === staffId || n.recipientUserId === staffId || n.recipientTarget === staffId)) return true;
      if (userEmail && n.recipient && n.recipient.toLowerCase() === userEmail) return true;
      if (targetName && n.counsellorName && n.counsellorName.toLowerCase() === targetName.toLowerCase()) return true;
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

  /**
   * Dispatches real email notification to assigned counsellor via authenticated backend/Vercel serverless function
   * Does NOT block or fail client operations if email transport is unavailable or fails.
   */
  public async dispatchCounsellorAssignmentEmail(payload: {
    notificationId: string;
    clientId: string;
    counsellorId: string;
  }): Promise<{ success: boolean; stage?: string; message?: string; error?: string }> {
    console.log(`[Email Dispatch] Started email dispatch for client: "${payload.clientId}", counsellor: "${payload.counsellorId}", notif: "${payload.notificationId}"`);

    try {
      // 1. Ensure Firebase Auth state is ready if SDK provides authStateReady
      if (auth && typeof (auth as any).authStateReady === 'function') {
        try {
          await (auth as any).authStateReady();
        } catch (e) {
          console.warn('[Email Dispatch] authStateReady resolution notice:', e);
        }
      }

      let fbUser = auth?.currentUser;

      // If auth.currentUser is not yet populated, give it a short grace period
      if (!fbUser) {
        console.warn('[Email Dispatch] auth.currentUser is null on first check. Awaiting brief tick for session restore...');
        await new Promise((resolve) => setTimeout(resolve, 300));
        fbUser = auth?.currentUser;
      }

      let idToken = '';
      if (fbUser) {
        try {
          idToken = await fbUser.getIdToken();
          console.log('[Email Dispatch] Firebase ID token successfully obtained for user UID:', fbUser.uid);
        } catch (tokenErr: any) {
          console.error('[Email Dispatch] Failed to retrieve Firebase ID token:', tokenErr?.message || tokenErr);
        }
      } else {
        console.warn('[Email Dispatch] auth.currentUser is still null. Cannot obtain ID token for serverless API.');
        return {
          success: false,
          stage: 'client_auth',
          error: 'No active Firebase Auth user session found in browser. Email API was not called.',
        };
      }

      if (!idToken) {
        console.warn('[Email Dispatch] Firebase ID token is empty. Aborting serverless email call.');
        return {
          success: false,
          stage: 'client_auth',
          error: 'Empty Firebase ID token. Aborting email dispatch.',
        };
      }

      // 2. Dispatch request to Vercel Serverless Function
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const primaryApiUrl = `${baseUrl}/api/notifications/send-counsellor-email`;
      console.log(`[Email Dispatch] Sending POST request to primary endpoint: ${primaryApiUrl}`);

      let response: Response;
      try {
        response = await fetch(primaryApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr: any) {
        console.error(`[Email Dispatch] Network fetch failed to ${primaryApiUrl}:`, fetchErr?.message || fetchErr);
        return {
          success: false,
          stage: 'network_fetch',
          error: `Network error connecting to email API: ${fetchErr?.message || fetchErr}`,
        };
      }

      console.log(`[Email Dispatch] Primary endpoint response status: ${response.status} ${response.statusText}`);

      // 3. If primary route returns 404 (e.g. Vercel flat routing fallback), attempt root alias route
      if (response.status === 404) {
        const fallbackApiUrl = `${baseUrl}/api/send-counsellor-email`;
        console.warn(`[Email Dispatch] ${primaryApiUrl} returned 404. Attempting fallback route: ${fallbackApiUrl}`);
        try {
          const fallbackRes = await fetch(fallbackApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(payload),
          });
          console.log(`[Email Dispatch] Fallback endpoint response status: ${fallbackRes.status} ${fallbackRes.statusText}`);
          if (fallbackRes.status !== 404) {
            response = fallbackRes;
          }
        } catch (fallbackErr: any) {
          console.warn('[Email Dispatch] Fallback route network notice:', fallbackErr?.message || fallbackErr);
        }
      }

      const result = await response.json().catch(() => ({}));
      console.log('[Email Dispatch] Serverless API response payload:', result);

      if (response.ok && result.success) {
        console.log(`[Email Dispatch] Successfully confirmed email dispatch for client ${payload.clientId} (stage: ${result.stage || 'dispatched'})`);
        // Record emailStatus in local memory and storage
        const notif = this.notifications.find((n) => n.id === payload.notificationId);
        if (notif) {
          notif.emailStatus = 'sent';
          notif.emailSentAt = new Date().toISOString();
          this.saveToStorage();
        }
        return {
          success: true,
          stage: result.stage || 'dispatched',
          message: result.message,
        };
      } else {
        console.warn(`[Email Dispatch] Email API returned error (HTTP ${response.status}, stage: ${result.stage || 'unknown'}):`, result.error || response.statusText);
        return {
          success: false,
          stage: result.stage || 'server_error',
          error: result.error || `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (err: any) {
      console.error('[Email Dispatch] Unhandled exception during email dispatch:', err?.message || err);
      return {
        success: false,
        stage: 'client_exception',
        error: err?.message || 'Unexpected dispatch error',
      };
    }
  }

  /**
   * Diagnostic method for Super Admins to verify Vercel serverless email transport independently
   */
  public async testCounsellorEmailTransport(): Promise<{
    success: boolean;
    stage?: string;
    message?: string;
    error?: string;
    httpStatus?: number;
  }> {
    console.log('[Email Diagnostic] Starting independent SMTP transport verification...');

    if (auth && typeof (auth as any).authStateReady === 'function') {
      try {
        await (auth as any).authStateReady();
      } catch (e) {
        console.warn('[Email Diagnostic] authStateReady resolution notice:', e);
      }
    }

    let fbUser = auth?.currentUser;
    if (!fbUser) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      fbUser = auth?.currentUser;
    }

    if (!fbUser) {
      console.warn('[Email Diagnostic] No active Firebase Auth user found in browser.');
      return {
        success: false,
        stage: 'client_auth',
        error: 'No active Firebase Auth user session found in browser. Please sign in as Super Admin.',
      };
    }

    let idToken = '';
    try {
      idToken = await fbUser.getIdToken();
    } catch (tokenErr: any) {
      return {
        success: false,
        stage: 'client_auth',
        error: `Failed to retrieve Firebase ID token: ${tokenErr?.message || tokenErr}`,
      };
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const primaryApiUrl = `${baseUrl}/api/notifications/send-counsellor-email`;
    console.log(`[Email Diagnostic] Testing primary endpoint: ${primaryApiUrl}`);

    try {
      let response = await fetch(primaryApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ isTest: true }),
      });

      console.log(`[Email Diagnostic] Primary endpoint status: ${response.status} ${response.statusText}`);

      if (response.status === 404) {
        const fallbackApiUrl = `${baseUrl}/api/send-counsellor-email`;
        console.warn(`[Email Diagnostic] 404 received. Testing fallback endpoint: ${fallbackApiUrl}`);
        const fallbackRes = await fetch(fallbackApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ isTest: true }),
        });
        console.log(`[Email Diagnostic] Fallback endpoint status: ${fallbackRes.status} ${fallbackRes.statusText}`);
        if (fallbackRes.status !== 404) {
          response = fallbackRes;
        }
      }

      const result = await response.json().catch(() => ({}));
      console.log('[Email Diagnostic] Diagnostic response payload:', result);

      return {
        success: response.ok && result.success,
        stage: result.stage,
        message: result.message,
        error: result.error,
        httpStatus: response.status,
      };
    } catch (err: any) {
      console.error('[Email Diagnostic] Network exception during transport test:', err);
      return {
        success: false,
        stage: 'network_fetch',
        error: `Network error: ${err?.message || err}`,
      };
    }
  }

  // --- Forms ---
  public getForms(): FormDefinition[] {
    return [...this.forms].sort((a, b) => a.order - b.order);
  }

  public getFormById(id: string): FormDefinition | undefined {
    const directMatch = this.forms.find((f) => f.id === id || f.code === id);
    if (directMatch) return directMatch;

    // Authoritative fallback mapping between pipeline stage form IDs and clinical forms
    if (id === 'form-initial') return this.forms.find((f) => f.id === 'form-recovery-1');
    if (id === 'form-followup-1') return this.forms.find((f) => f.id === 'form-assessment-2');
    if (id === 'form-followup-2') return this.forms.find((f) => f.id === 'form-assessment-3');
    if (id === 'form-recovery-progress') return this.forms.find((f) => f.id === 'form-assessment-4' || f.id === 'form-assessment-5');
    if (id === 'form-final') return this.forms.find((f) => f.id === 'form-feedback' || f.id === 'form-assessment-5');

    return undefined;
  }

  public async saveForm(form: FormDefinition): Promise<void> {
    const index = this.forms.findIndex((f) => f.id === form.id);
    if (index >= 0) {
      this.forms[index] = form;
      this.logAudit('UPDATE_FORM', 'Form', form.id, `Updated form "${form.name}"`);
    } else {
      this.forms.push(form);
      this.logAudit('CREATE_FORM', 'Form', form.id, `Created new form "${form.name}"`);
    }

    if (db && isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'forms', form.id), cleanForFirestore(form), { merge: true });
        console.log(`[Firestore] Form ${form.id} successfully saved to Firestore.`);
      } catch (err) {
        console.error('[Firestore] Error saving form to Firestore:', err);
        throw err;
      }
    }

    this.saveToStorage();
    this.notify();
  }

  public async duplicateForm(formId: string): Promise<FormDefinition | undefined> {
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

    if (db && isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'forms', copy.id), cleanForFirestore(copy), { merge: true });
      } catch (err) {
        console.error('[Firestore] Error duplicating form to Firestore:', err);
      }
    }

    this.saveToStorage();
    this.notify();
    return copy;
  }

  public async toggleFormActive(formId: string): Promise<void> {
    const form = this.forms.find((f) => f.id === formId);
    if (form) {
      form.active = !form.active;
      this.logAudit('UPDATE_FORM', 'Form', form.id, `${form.active ? 'Activated' : 'Deactivated'} form "${form.name}"`);

      if (db && isFirebaseConfigured) {
        try {
          await updateDoc(doc(db, 'forms', form.id), { active: form.active });
        } catch (err) {
          console.error('[Firestore] Error updating form active state:', err);
        }
      }

      this.saveToStorage();
      this.notify();
    }
  }

  // --- Workflows ---
  public getWorkflows(includeInactive: boolean = false): WorkflowStage[] {
    return [...this.workflows]
      .filter((w) => {
        if (!includeInactive && (w.isActive === false || w.isLegacy === true)) return false;
        const name = (w.stageName || '').toLowerCase().trim();
        const id = (w.id || '').toLowerCase().trim();
        const formId = (w.formId || '').toLowerCase().trim();

        // When requesting active clinical workflow, strictly exclude legacy old stages
        if (!includeInactive && (
          id === 'stage-initial' ||
          id === 'stage-followup-1' ||
          id === 'stage-followup-2' ||
          id === 'stage-recovery' ||
          id === 'stage-final' ||
          name === 'initial assessment' ||
          name === 'follow-up assessment 1' ||
          name === 'follow-up assessment 2' ||
          name === 'recovery progress assessment' ||
          name === 'final assessment'
        )) {
          return false;
        }

        return !(
          name === 'client registration / biodata' ||
          name === 'registration & biodata' ||
          name === 'client registration' ||
          name === 'registration' ||
          name === 'biodata' ||
          id === 'stage-registration' ||
          id === 'stage-biodata' ||
          formId === 'biodata' ||
          formId === 'form-biodata' ||
          formId === 'form-registration'
        );
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  public async saveWorkflows(workflows: WorkflowStage[]): Promise<void> {
    this.workflows = workflows;
    this.logAudit('UPDATE_WORKFLOW', 'Workflow', 'all', 'Updated assessment pipeline sequence and delay intervals.');

    if (db && isFirebaseConfigured) {
      try {
        await Promise.all(
          workflows.map((w) => setDoc(doc(db, 'workflows', w.id), cleanForFirestore(w), { merge: true }))
        );
        console.log('[Firestore] Workflows successfully saved to Firestore.');
      } catch (err) {
        console.error('[Firestore] Error saving workflows to Firestore:', err);
        throw err;
      }
    }

    this.saveToStorage();
    this.notify();
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

  public async submitAssessment(data: {
    clientId: string;
    formId: string;
    answers: { questionId: string; answer: any; score?: number }[];
    section5Score?: number;
    gpdsScore?: number;
    totalScore?: number;
  }): Promise<{ submission: AssessmentSubmission; nextStageName?: string; delayDays?: number }> {
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

    // Build enriched answers with question text, guaranteeing NO undefined properties
    const enrichedAnswers = data.answers.map((a) => {
      const q = form.questions?.find((item) => item.id === a.questionId);
      return {
        questionId: a.questionId,
        questionText: (a as any).questionText || (q ? q.text : a.questionId) || '',
        questionType: (q ? q.type : 'short_text') as any,
        answer: a.answer !== undefined ? a.answer : '',
        score: typeof a.score === 'number' ? a.score : null,
      };
    });

    const effectiveAuthUid = auth.currentUser?.uid || client.authUid || '';
    if (!client.authUid && effectiveAuthUid) {
      client.authUid = effectiveAuthUid;
    }

    const submission: AssessmentSubmission = {
      id: submissionId,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`.trim() || client.fullName || 'Client',
      formId: form.id,
      formName: form.name,
      stageId: client.currentStageId,
      submittedAt: now,
      answers: enrichedAnswers,
      section5Score: typeof data.section5Score === 'number' ? data.section5Score : undefined,
      gpdsScore: typeof data.gpdsScore === 'number' ? data.gpdsScore : undefined,
      totalScore: calculatedScore,
      scoreRiskLevel: riskLevel,
      status: riskLevel === 'High' || riskLevel === 'Severe' ? 'Flagged' : 'Completed',
    };

    // A. Build complete assessment response document object for Firestore
    const assessmentResponseDoc = {
      id: submissionId,
      clientId: client.id,
      authUid: effectiveAuthUid || null,
      clientName: `${client.firstName} ${client.lastName}`.trim() || client.fullName || 'Client',
      clientEmail: client.email || auth.currentUser?.email || '',
      formId: form.id,
      formTitle: form.name,
      stageId: client.currentStageId || 'stage-assessment-1',
      answers: enrichedAnswers,
      section5Score: typeof data.section5Score === 'number' ? data.section5Score : null,
      gpdsScore: typeof data.gpdsScore === 'number' ? data.gpdsScore : null,
      score: typeof calculatedScore === 'number' ? calculatedScore : 0,
      totalScore: typeof calculatedScore === 'number' ? calculatedScore : 0,
      severity: riskLevel || 'Standard',
      riskLevel: riskLevel || 'Standard',
      submittedAt: now,
      isComplete: true,
      status: riskLevel === 'High' || riskLevel === 'Severe' ? 'Flagged' : 'Completed',
    };

    // B & C. Write to assessmentResponses/{submissionId} and AWAIT
    if (db && isFirebaseConfigured) {
      try {
        const cleanPayload = cleanForFirestore({
          ...assessmentResponseDoc,
          createdAt: serverTimestamp(),
        });
        await setDoc(doc(db, 'assessmentResponses', submissionId), cleanPayload);
        console.log(`[Firestore] Assessment response ${submissionId} successfully written and verified in collection 'assessmentResponses'.`);
      } catch (err: any) {
        console.error('[Firestore] Error persisting assessment response to Firestore:', err);
        // F. If assessmentResponses write fails:
        // - DO NOT advance the client stage.
        // - DO NOT show the assessment as completed.
        // - Display the actual error.
        // - Leave the client on Initial Assessment.
        throw new Error(
          `Firestore Error: Could not save assessment response to assessmentResponses/${submissionId}: ${err?.message || err}. Workflow stage has NOT been advanced.`
        );
      }
    }

    // E. ONLY AFTER SUCCESSFUL assessmentResponses WRITE:
    // Update client trajectory:
    client.lastAssessmentName = form.name;
    client.lastAssessmentDate = now;
    if (data.section5Score !== undefined || data.gpdsScore !== undefined) {
      client.result = `Section 5 Score: ${data.section5Score ?? 'N/A'}/19, GPDS: ${data.gpdsScore ?? 'N/A'}/10. Risk: ${riskLevel || 'Standard'}`;
    }

    // Determine the next stage in active clinical workflow
    const activeStages = this.getWorkflows(false);
    const currentWorkflowIndex = activeStages.findIndex(
      (w) =>
        w.formId === form.id ||
        w.id === client.currentStageId ||
        (form.id === 'form-recovery-1' && (w.id === 'stage-assessment-1' || w.id === 'stage-initial'))
    );
    const nextStage =
      currentWorkflowIndex >= 0 && currentWorkflowIndex < activeStages.length - 1
        ? activeStages[currentWorkflowIndex + 1]
        : null;

    client.totalAssessmentsCompleted = (client.totalAssessmentsCompleted || 0) + 1;
    client.lastActivityDate = now;
    if (riskLevel) {
      client.riskLevel = riskLevel === 'Severe' ? 'High' : riskLevel;
    }

    let delayDays = 0;
    if (nextStage) {
      delayDays =
        typeof nextStage.delayDaysFromPrevious === 'number'
          ? nextStage.delayDaysFromPrevious
          : (typeof form.waitingDaysAfterCompletion === 'number' ? form.waitingDaysAfterCompletion : 7);
      const nextDueDate = new Date();
      nextDueDate.setDate(nextDueDate.getDate() + delayDays);

      client.currentStageId = nextStage.id;
      client.currentStageName = nextStage.stageName;
      client.nextAssessmentId = nextStage.formId;
      const nextForm = this.getFormById(nextStage.formId);
      client.nextAssessmentName = nextForm ? nextForm.name : nextStage.stageName;
      client.nextAssessmentDueDate = nextDueDate.toISOString();
      client.status = delayDays === 0 ? 'Assessment Due' : 'Active';

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

    // Update client document in collection 'clients/{clientId}' in Firestore
    const clientUpdateData: Record<string, any> = {
      currentStageId: client.currentStageId,
      currentStageName: client.currentStageName || '',
      stage: client.currentStageName || client.currentStageId,
      lastAssessmentName: client.lastAssessmentName,
      lastAssessmentDate: client.lastAssessmentDate,
      nextAssessmentId: client.nextAssessmentId || null,
      nextAssessmentName: client.nextAssessmentName || null,
      nextAssessmentDueDate: client.nextAssessmentDueDate || null,
      status: client.status,
      totalAssessmentsCompleted: client.totalAssessmentsCompleted,
      lastActivityDate: client.lastActivityDate,
    };
    if (client.riskLevel) {
      clientUpdateData.riskLevel = client.riskLevel;
    }
    if (client.result) {
      clientUpdateData.result = client.result;
    }
    if (calculatedScore !== undefined) {
      clientUpdateData.recoveryScore = calculatedScore;
    }
    if (effectiveAuthUid) {
      clientUpdateData.authUid = effectiveAuthUid;
    }

    if (db && isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, 'clients', client.id), cleanForFirestore(clientUpdateData));
        console.log(`[Firestore] Client ${client.id} successfully updated in clients collection.`);
      } catch (clientErr: any) {
        console.warn('[Firestore] updateDoc on client failed, attempting setDoc with merge:', clientErr?.message || clientErr);
        try {
          await setDoc(doc(db, 'clients', client.id), cleanForFirestore(clientUpdateData), { merge: true });
        } catch (setErr) {
          console.error('[Firestore] Failed to update client document in Firestore:', setErr);
        }
      }
    }

    // Update in-memory collections and storage
    this.submissions.unshift(submission);

    const cIdx = this.clients.findIndex((c) => c.id === client.id);
    if (cIdx >= 0) {
      this.clients[cIdx] = { ...client };
    }

    // Dispatch to shared backend for multi-phone / cross-device sync
    try {
      fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      }).catch((e) => console.warn('[Backend] Submit assessment sync error:', e));

      fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientUpdateData),
      }).catch((e) => console.warn('[Backend] Client update sync error:', e));
    } catch (e) {
      console.warn('[Backend] Sync fetch error:', e);
    }

    this.logAudit(
      'SUBMIT_ASSESSMENT',
      'Assessment',
      submission.id,
      `Client ${client.firstName} ${client.lastName} submitted "${form.name}". Total score: ${calculatedScore ?? 'N/A'}`
    );

    this.saveToStorage();
    this.notify();
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

  public async addCaseNote(clientId: string, content: string, followUpDate?: string, tags: string[] = []): Promise<CaseNote> {
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

    if (db && isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'caseNotes', note.id), cleanForFirestore(note));
      } catch (err) {
        console.warn('[DataService] Firestore caseNote write notice:', err);
      }
    }

    this.caseNotes.unshift(note);
    this.logAudit('ADD_CASE_NOTE', 'CaseNote', note.id, `Added case note for client ${clientId}`);
    this.saveToStorage();
    this.notify();
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

  public async saveStaffUser(user: StaffUser): Promise<StaffUser> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'Super Admin') {
      throw new Error('Unauthorized: Only Super Admin can manage staff profiles.');
    }

    // 1. Authoritative Cloud Firestore writes: Await before updating local state
    if (db && isFirebaseConfigured) {
      const docId = user.authUid || user.id;
      try {
        await setDoc(
          doc(db, 'users', docId),
          {
            id: docId,
            name: user.name,
            email: user.email.toLowerCase(),
            phone: user.phone || '',
            role: user.role,
            active: user.active !== false,
            authUid: docId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        await setDoc(
          doc(db, 'staff', user.id),
          {
            ...user,
            authUid: docId,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e: any) {
        console.error('[dataService] Firestore staff update error:', e);
        throw new Error(`Failed to save staff profile in Firestore: ${e?.message || e}`);
      }
    }

    // 2. Reconcile UI and local state only after Firestore acknowledges write
    const existingIdx = this.staff.findIndex((s) => s.id === user.id);
    if (existingIdx >= 0) {
      this.staff[existingIdx] = { ...this.staff[existingIdx], ...user };
    } else {
      this.staff.push(user);
    }
    this.saveToStorage();
    this.logAudit('STAFF_UPDATE', 'Staff', user.id, `Saved staff user ${user.name} (${user.role})`);
    this.notify();

    try {
      fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      }).catch((e) => console.warn('[dataService] Backend staff sync error:', e));
    } catch (e) {
      console.warn('[dataService] Fetch staff error:', e);
    }

    this.notify();
    return user;
  }

  /**
   * Safe email synchronization for Super Admin user management.
   * Updates users/{uid}.email (and linked staff/{id}.email if present)
   * NEVER changes the Firebase UID or document ID.
   * Preserves all other profile fields (active, status, role, username, etc.).
   */
  public async syncUserEmail(params: {
    uid: string;
    newEmail: string;
    staffId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'Super Admin') {
      return { success: false, error: 'Unauthorized: Only Super Admins can manage user emails.' };
    }

    const { uid, newEmail, staffId } = params;
    const cleanEmail = (newEmail || '').trim().toLowerCase();

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address (e.g. user@gamblepause.org).' };
    }

    if (!uid) {
      return { success: false, error: 'Missing required Firebase UID.' };
    }

    if (db && isFirebaseConfigured) {
      try {
        // 1. Verify target doc exists and retrieve existing email for audit
        const userDocRef = doc(db, 'users', uid);
        const userDocSnap = await getDoc(userDocRef);
        const oldEmail = userDocSnap.exists() ? (userDocSnap.data()?.email || '') : '';
        const staffRecord = this.staff.find((s) => s.authUid === uid || s.id === staffId || s.id === uid);

        const userUpdateData: Record<string, any> = {
          email: cleanEmail,
          emailUpdatedAt: serverTimestamp(),
          emailUpdatedBy: currentUser.id || currentUser.email,
        };

        if (!userDocSnap.exists()) {
          userUpdateData.id = uid;
          userUpdateData.authUid = uid;
          userUpdateData.name = staffRecord?.name || 'Staff User';
          userUpdateData.role = staffRecord?.role || 'Staff';
          userUpdateData.active = staffRecord?.active !== false;
          userUpdateData.status = staffRecord?.status || 'Active';
          userUpdateData.createdAt = serverTimestamp();
        }

        // 2. Targeted merge update on users/{uid} - NEVER replaces document or changes UID
        await setDoc(userDocRef, userUpdateData, { merge: true });

        // 3. If a linked staff/{staffId} record exists, update its email as well
        if (staffId) {
          await setDoc(
            doc(db, 'staff', staffId),
            {
              email: cleanEmail,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          // Check if any staff doc has authUid == uid
          const staffQuery = query(collection(db, 'staff'), where('authUid', '==', uid));
          const staffSnap = await getDocs(staffQuery);
          for (const sDoc of staffSnap.docs) {
            await setDoc(
              doc(db, 'staff', sDoc.id),
              {
                email: cleanEmail,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        }

        // 4. Create audit log entry per requirement 17
        try {
          const auditRef = doc(collection(db, 'auditLogs'));
          await setDoc(auditRef, {
            id: auditRef.id,
            action: 'email_changed',
            targetType: 'Staff',
            targetId: uid,
            targetUid: uid,
            oldEmail: oldEmail || null,
            newEmail: cleanEmail,
            performedByUid: currentUser.id,
            performedByEmail: currentUser.email,
            actingSuperAdminUid: currentUser.id,
            actingSuperAdminEmail: currentUser.email,
            timestamp: new Date().toISOString(),
            createdAt: serverTimestamp(),
          });
        } catch (auditErr) {
          console.warn('[DataService] Non-blocking audit log notice:', auditErr);
        }

        console.log(`[Firestore] users/${uid}.email successfully synchronized to ${cleanEmail}`);
      } catch (err: any) {
        console.error('[DataService] Error synchronizing email in Firestore:', err);
        return { success: false, error: err?.message || 'Firestore write error' };
      }
    }

    // 5. Update local memory state without changing UID or active status
    const staffIdx = this.staff.findIndex((s) => s.authUid === uid || s.id === staffId || s.id === uid);
    if (staffIdx >= 0) {
      this.staff[staffIdx].email = cleanEmail;
    }
    this.saveToStorage();
    this.logAudit(
      'EMAIL_CHANGED',
      'Staff',
      uid,
      `User email synchronized to ${cleanEmail} by ${currentUser.name || currentUser.email}`
    );
    this.notify();
    return { success: true };
  }

  /**
   * Links and synchronizes Steven Benjamin's Super Admin profile in Firestore
   * using the actual Firebase Authentication UID generated in Firebase Console.
   */
  public async syncStevenBenjamin(uid: string): Promise<{ success: boolean; error?: string }> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'Super Admin') {
      return { success: false, error: 'Unauthorized: Only Super Admins can configure Super Admin profiles.' };
    }

    const cleanUid = (uid || '').trim();
    if (!cleanUid || cleanUid.length < 5) {
      return { success: false, error: 'Please enter a valid Firebase Authentication UID from the Firebase Console.' };
    }

    const stevenProfile: StaffUser = {
      id: 'staff-steven',
      authUid: cleanUid,
      name: 'Steven Benjamin',
      email: 'stevobenjo@gmail.com',
      role: 'Super Admin',
      active: true,
      status: 'Active',
      phone: '+234 800 000 0000',
      assignedClientsCount: 0,
    };

    if (db && isFirebaseConfigured) {
      try {
        // Write to users/{uid} with actual Firebase Auth UID as document ID
        await setDoc(
          doc(db, 'users', cleanUid),
          {
            id: cleanUid,
            authUid: cleanUid,
            name: stevenProfile.name,
            email: stevenProfile.email,
            role: 'Super Admin',
            active: true,
            status: 'Active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Also write to staff/staff-steven
        await setDoc(
          doc(db, 'staff', stevenProfile.id),
          {
            ...stevenProfile,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Audit log
        try {
          const auditRef = doc(collection(db, 'auditLogs'));
          await setDoc(auditRef, {
            id: auditRef.id,
            action: 'superadmin_registered',
            targetType: 'Staff',
            targetId: cleanUid,
            targetUid: cleanUid,
            name: 'Steven Benjamin',
            email: 'stevobenjo@gmail.com',
            performedByUid: currentUser.id,
            performedByEmail: currentUser.email,
            timestamp: new Date().toISOString(),
            createdAt: serverTimestamp(),
          });
        } catch {}

        console.log(`[Firestore] Steven Benjamin Super Admin profile created/synced at users/${cleanUid}`);
      } catch (err: any) {
        console.error('[DataService] Error saving Steven Benjamin in Firestore:', err);
        return { success: false, error: err?.message || 'Firestore write error' };
      }
    }

    // Update in-memory state
    const existingIdx = this.staff.findIndex(
      (s) => s.authUid === cleanUid || s.email?.toLowerCase() === stevenProfile.email.toLowerCase()
    );
    if (existingIdx >= 0) {
      this.staff[existingIdx] = { ...this.staff[existingIdx], ...stevenProfile };
    } else {
      this.staff.push(stevenProfile);
    }
    this.saveToStorage();
    this.logAudit(
      'SUPERADMIN_REGISTERED',
      'Staff',
      cleanUid,
      `Steven Benjamin registered as Super Admin by ${currentUser.name || currentUser.email}`
    );
    this.notify();
    return { success: true };
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
  public getDashboardMetrics(providedClients?: Client[]) {
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

    // If providedClients is passed (e.g. from active filters in Admin Dashboard), compute metrics on that pool.
    // Otherwise, default to role-authorized caseload.
    const clientPool = providedClients !== undefined ? providedClients : this.getClients();
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
