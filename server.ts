import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------
// Types & Data Structures
// ---------------------------------------------------------

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'Super Admin' | 'Counsellor' | 'Staff' | 'Analyst / Viewer';
  assignedClientsCount: number;
  active: boolean;
  status?: 'Active' | 'Inactive' | 'Archived';
  dateAdded?: string;
  lastLogin?: string;
}

export interface Client {
  id: string;
  fullName?: string;
  firstName: string;
  lastName: string;
  preferredName?: string;
  age: number;
  lengthOfGamblingProblem?: string;
  gender: 'Male' | 'Female' | 'Prefer not to say' | 'Other';
  phone: string;
  email: string;
  address?: string;
  state: string;
  location: string;
  country?: string;
  occupation: string;
  maritalStatus?: string;
  howHeard?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  consentGiven: boolean;
  registrationDate: string;
  status: 'Active' | 'Awaiting Assessment' | 'Assessment Due' | 'Overdue' | 'Completed' | 'Closed' | 'Referred';
  currentStageId: string;
  currentStageName: string;
  currentAssessment?: string;
  nextAssessmentId?: string;
  nextAssessmentName?: string;
  nextAssessmentDueDate?: string;
  lastAssessmentName?: string;
  lastAssessmentDate?: string;
  assignedCounsellorId?: string;
  assignedCounsellorName?: string;
  lastActivityDate: string;
  totalAssessmentsCompleted: number;
  totalAssessmentsOverdue: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
  result?: string;
  secureAccessKey: string;
}

export interface StoredCredential {
  usernameOrEmail: string;
  hash: string;
  userId: string;
  role: string;
  name: string;
  clientId?: string;
  active: boolean;
}

export interface CounsellorAssignmentHistory {
  id: string;
  clientId: string;
  clientName: string;
  previousCounsellorId?: string;
  previousCounsellorName?: string;
  newCounsellorId: string;
  newCounsellorName: string;
  changedById: string;
  changedByName: string;
  changedAt: string;
  reason?: string;
}

export interface NotificationRecord {
  id: string;
  clientId: string;
  clientName: string;
  channel: string;
  recipient?: string;
  recipientTarget?: string;
  recipientUserId?: string; // Target counsellor or user UID
  counsellorId?: string;
  counsellorName?: string;
  subject?: string;
  messageBody: string;
  triggerType: string;
  status: string;
  scheduledFor: string;
  sentAt?: string;
  isRead: boolean;
}

export interface AssessmentSubmission {
  id: string;
  clientId: string;
  clientName: string;
  formId: string;
  formName: string;
  stageId: string;
  submittedAt: string;
  answers: any[];
  totalScore?: number;
  section5Score?: number;
  gpdsScore?: number;
  scoreRiskLevel?: 'Low' | 'Medium' | 'High' | 'Severe';
  status: 'Completed' | 'Under Review' | 'Flagged';
  counsellorNotes?: string;
}

export interface CaseNote {
  id: string;
  clientId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  content: string;
  followUpDate?: string;
  tags?: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
}

// ---------------------------------------------------------
// In-Memory & File-Persisted Database
// ---------------------------------------------------------

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'gamblepause.db.json');

interface DatabaseSchema {
  staff: StaffUser[];
  credentials: Record<string, StoredCredential>;
  clients: Client[];
  submissions: AssessmentSubmission[];
  assignments: CounsellorAssignmentHistory[];
  notifications: NotificationRecord[];
  caseNotes: CaseNote[];
  auditLogs: AuditLogEntry[];
}

function hashPassword(password: string, salt: string = 'gp_salt_2026'): string {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Production initial counsellors and staff
function createInitialDatabase(): DatabaseSchema {
  const defaultHash = hashPassword('Gamblepause');

  const staff: StaffUser[] = [
    {
      id: 'staff-superadmin',
      name: 'Abiodun Ayodeji',
      email: 'ayodejiharbiodun24@gmail.com',
      phone: '+234 803 123 4567',
      role: 'Super Admin',
      assignedClientsCount: 0,
      active: true,
      status: 'Active',
      dateAdded: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'staff-superadmin-2',
      name: 'Ladipo Abiose',
      email: 'ladipo.abiose@gamblepause.org',
      phone: '+234 802 987 6543',
      role: 'Super Admin',
      assignedClientsCount: 0,
      active: true,
      status: 'Active',
      dateAdded: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'counsellor-benjamin',
      name: 'Benjamin',
      email: 'benjamin@gamblepause.org',
      phone: '+234 801 111 2233',
      role: 'Counsellor',
      assignedClientsCount: 1,
      active: true,
      status: 'Active',
      dateAdded: '2026-01-15T09:00:00.000Z',
    },
    {
      id: 'counsellor-micheal',
      name: 'Micheal Akinniku',
      email: 'micheal.akinniku@gamblepause.org',
      phone: '+234 802 333 4455',
      role: 'Counsellor',
      assignedClientsCount: 1,
      active: true,
      status: 'Active',
      dateAdded: '2026-01-20T10:00:00.000Z',
    },
    {
      id: 'counsellor-celia',
      name: 'Celia Badmus',
      email: 'celia.badmus@gamblepause.org',
      phone: '+234 803 555 6677',
      role: 'Counsellor',
      assignedClientsCount: 1,
      active: true,
      status: 'Active',
      dateAdded: '2026-02-01T11:00:00.000Z',
    },
  ];

  const credentials: Record<string, StoredCredential> = {
    // Abiodun Ayodeji
    'abiodun.ayodeji': {
      usernameOrEmail: 'Abiodun.Ayodeji',
      hash: defaultHash,
      userId: 'staff-superadmin',
      role: 'Super Admin',
      name: 'Abiodun Ayodeji',
      active: true,
    },
    'ayodejiharbiodun24@gmail.com': {
      usernameOrEmail: 'Abiodun.Ayodeji',
      hash: defaultHash,
      userId: 'staff-superadmin',
      role: 'Super Admin',
      name: 'Abiodun Ayodeji',
      active: true,
    },
    // Ladipo Abiose
    'ladipo.abiose': {
      usernameOrEmail: 'Ladipo.Abiose',
      hash: defaultHash,
      userId: 'staff-superadmin-2',
      role: 'Super Admin',
      name: 'Ladipo Abiose',
      active: true,
    },
    'ladipo.abiose@gamblepause.org': {
      usernameOrEmail: 'Ladipo.Abiose',
      hash: defaultHash,
      userId: 'staff-superadmin-2',
      role: 'Super Admin',
      name: 'Ladipo Abiose',
      active: true,
    },
    // Benjamin
    'benjamin': {
      usernameOrEmail: 'Benjamin',
      hash: defaultHash,
      userId: 'counsellor-benjamin',
      role: 'Counsellor',
      name: 'Benjamin',
      active: true,
    },
    'benjamin@gamblepause.org': {
      usernameOrEmail: 'Benjamin',
      hash: defaultHash,
      userId: 'counsellor-benjamin',
      role: 'Counsellor',
      name: 'Benjamin',
      active: true,
    },
    // Micheal Akinniku
    'micheal.akinniku': {
      usernameOrEmail: 'Micheal.Akinniku',
      hash: defaultHash,
      userId: 'counsellor-micheal',
      role: 'Counsellor',
      name: 'Micheal Akinniku',
      active: true,
    },
    'micheal.akinniku@gamblepause.org': {
      usernameOrEmail: 'Micheal.Akinniku',
      hash: defaultHash,
      userId: 'counsellor-micheal',
      role: 'Counsellor',
      name: 'Micheal Akinniku',
      active: true,
    },
    // Celia Badmus
    'celia.badmus': {
      usernameOrEmail: 'Celia.Badmus',
      hash: defaultHash,
      userId: 'counsellor-celia',
      role: 'Counsellor',
      name: 'Celia Badmus',
      active: true,
    },
    'celia.badmus@gamblepause.org': {
      usernameOrEmail: 'Celia.Badmus',
      hash: defaultHash,
      userId: 'counsellor-celia',
      role: 'Counsellor',
      name: 'Celia Badmus',
      active: true,
    },
  };

  const initialClients: Client[] = [
    {
      id: 'GP-2026-001',
      fullName: 'Chidi Okafor',
      firstName: 'Chidi',
      lastName: 'Okafor',
      preferredName: 'Chidi',
      age: 29,
      gender: 'Male',
      phone: '+234 803 456 7890',
      email: 'chidi.okafor@example.com',
      state: 'Lagos',
      location: 'Ikeja',
      occupation: 'Logistics Coordinator',
      maritalStatus: 'Single',
      consentGiven: true,
      registrationDate: '2026-02-10T10:00:00.000Z',
      status: 'Active',
      currentStageId: 'stage-recovery-1',
      currentStageName: 'Client Registration & Initial Assessment',
      nextAssessmentId: 'form-recovery-1',
      nextAssessmentName: 'GPA Recovery Assessment 1: Intake & Baseline',
      nextAssessmentDueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
      assignedCounsellorId: 'counsellor-benjamin',
      assignedCounsellorName: 'Benjamin',
      lastActivityDate: '2026-02-10T10:00:00.000Z',
      totalAssessmentsCompleted: 0,
      totalAssessmentsOverdue: 0,
      riskLevel: 'Medium',
      secureAccessKey: 'key_chidi_2026_001',
    },
    {
      id: 'GP-2026-002',
      fullName: 'Aminat Bello',
      firstName: 'Aminat',
      lastName: 'Bello',
      preferredName: 'Amina',
      age: 34,
      gender: 'Female',
      phone: '+234 802 888 9900',
      email: 'aminat.bello@example.com',
      state: 'FCT - Abuja',
      location: 'Garki',
      occupation: 'Accountant',
      maritalStatus: 'Married',
      consentGiven: true,
      registrationDate: '2026-02-12T14:30:00.000Z',
      status: 'Active',
      currentStageId: 'stage-recovery-2',
      currentStageName: 'Bi-Weekly Recovery Follow-up 1',
      nextAssessmentId: 'form-assessment-2',
      nextAssessmentName: 'GPA Follow-up Assessment 2: 2-Week Check-in',
      nextAssessmentDueDate: new Date(Date.now() + 86400000 * 5).toISOString(),
      assignedCounsellorId: 'counsellor-micheal',
      assignedCounsellorName: 'Micheal Akinniku',
      lastActivityDate: '2026-02-15T09:00:00.000Z',
      totalAssessmentsCompleted: 1,
      totalAssessmentsOverdue: 0,
      riskLevel: 'High',
      secureAccessKey: 'key_aminat_2026_002',
    },
    {
      id: 'GP-2026-003',
      fullName: 'Emeka Nwosu',
      firstName: 'Emeka',
      lastName: 'Nwosu',
      preferredName: 'Emeka',
      age: 26,
      gender: 'Male',
      phone: '+234 805 777 6655',
      email: 'emeka.nwosu@example.com',
      state: 'Rivers',
      location: 'Port Harcourt',
      occupation: 'Tech Sales',
      maritalStatus: 'Single',
      consentGiven: true,
      registrationDate: '2026-02-18T11:15:00.000Z',
      status: 'Active',
      currentStageId: 'stage-recovery-1',
      currentStageName: 'Client Registration & Initial Assessment',
      nextAssessmentId: 'form-recovery-1',
      nextAssessmentName: 'GPA Recovery Assessment 1: Intake & Baseline',
      nextAssessmentDueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
      assignedCounsellorId: 'counsellor-celia',
      assignedCounsellorName: 'Celia Badmus',
      lastActivityDate: '2026-02-18T11:15:00.000Z',
      totalAssessmentsCompleted: 0,
      totalAssessmentsOverdue: 0,
      riskLevel: 'Low',
      secureAccessKey: 'key_emeka_2026_003',
    },
  ];

  const initialAssignments: CounsellorAssignmentHistory[] = [
    {
      id: 'assign-init-1',
      clientId: 'GP-2026-001',
      clientName: 'Chidi Okafor',
      newCounsellorId: 'counsellor-benjamin',
      newCounsellorName: 'Benjamin',
      changedById: 'staff-superadmin',
      changedByName: 'Abiodun.Ayodeji',
      changedAt: '2026-02-10T10:05:00.000Z',
      reason: 'Initial intake counsellor assignment',
    },
    {
      id: 'assign-init-2',
      clientId: 'GP-2026-002',
      clientName: 'Aminat Bello',
      newCounsellorId: 'counsellor-micheal',
      newCounsellorName: 'Micheal Akinniku',
      changedById: 'staff-superadmin',
      changedByName: 'Abiodun.Ayodeji',
      changedAt: '2026-02-12T14:35:00.000Z',
      reason: 'Initial intake counsellor assignment',
    },
    {
      id: 'assign-init-3',
      clientId: 'GP-2026-003',
      clientName: 'Emeka Nwosu',
      newCounsellorId: 'counsellor-celia',
      newCounsellorName: 'Celia Badmus',
      changedById: 'staff-superadmin',
      changedByName: 'Abiodun.Ayodeji',
      changedAt: '2026-02-18T11:20:00.000Z',
      reason: 'Initial intake counsellor assignment',
    },
  ];

  const initialNotifications: NotificationRecord[] = [
    {
      id: 'notif-init-1',
      clientId: 'GP-2026-001',
      clientName: 'Chidi Okafor',
      channel: 'Dashboard',
      recipientUserId: 'counsellor-benjamin',
      counsellorId: 'counsellor-benjamin',
      counsellorName: 'Benjamin',
      subject: 'New Client Assigned: Chidi Okafor (GP-2026-001)',
      messageBody: 'You have been assigned as the primary counsellor for Chidi Okafor (GP-2026-001).',
      triggerType: 'Counsellor Assignment',
      status: 'Sent',
      scheduledFor: '2026-02-10T10:05:00.000Z',
      sentAt: '2026-02-10T10:05:00.000Z',
      isRead: false,
    },
    {
      id: 'notif-init-2',
      clientId: 'GP-2026-002',
      clientName: 'Aminat Bello',
      channel: 'Dashboard',
      recipientUserId: 'counsellor-micheal',
      counsellorId: 'counsellor-micheal',
      counsellorName: 'Micheal Akinniku',
      subject: 'New Client Assigned: Aminat Bello (GP-2026-002)',
      messageBody: 'You have been assigned as the primary counsellor for Aminat Bello (GP-2026-002).',
      triggerType: 'Counsellor Assignment',
      status: 'Sent',
      scheduledFor: '2026-02-12T14:35:00.000Z',
      sentAt: '2026-02-12T14:35:00.000Z',
      isRead: false,
    },
    {
      id: 'notif-init-3',
      clientId: 'GP-2026-003',
      clientName: 'Emeka Nwosu',
      channel: 'Dashboard',
      recipientUserId: 'counsellor-celia',
      counsellorId: 'counsellor-celia',
      counsellorName: 'Celia Badmus',
      subject: 'New Client Assigned: Emeka Nwosu (GP-2026-003)',
      messageBody: 'You have been assigned as the primary counsellor for Emeka Nwosu (GP-2026-003).',
      triggerType: 'Counsellor Assignment',
      status: 'Sent',
      scheduledFor: '2026-02-18T11:20:00.000Z',
      sentAt: '2026-02-18T11:20:00.000Z',
      isRead: false,
    },
  ];

  return {
    staff,
    credentials,
    clients: initialClients,
    submissions: [],
    assignments: initialAssignments,
    notifications: initialNotifications,
    caseNotes: [],
    auditLogs: [],
  };
}

let db: DatabaseSchema;

function loadDatabase(): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);

      // Cleanse any obsolete fake/demo counsellors
      const fakeNames = ['counsellor a', 'counsellor b', 'demo counsellor', 'dr. example', 'sarah', 'john'];
      db.staff = db.staff.filter((s) => !fakeNames.includes(s.name.trim().toLowerCase()));

      // Ensure the three real counsellors exist
      const requiredCounsellors = [
        { id: 'counsellor-benjamin', name: 'Benjamin', email: 'benjamin@gamblepause.org' },
        { id: 'counsellor-micheal', name: 'Micheal Akinniku', email: 'micheal.akinniku@gamblepause.org' },
        { id: 'counsellor-celia', name: 'Celia Badmus', email: 'celia.badmus@gamblepause.org' },
      ];

      for (const rc of requiredCounsellors) {
        const existing = db.staff.find((s) => s.id === rc.id || s.email.toLowerCase() === rc.email.toLowerCase());
        if (!existing) {
          db.staff.push({
            id: rc.id,
            name: rc.name,
            email: rc.email,
            role: 'Counsellor',
            assignedClientsCount: 0,
            active: true,
            status: 'Active',
            dateAdded: new Date().toISOString(),
          });
        } else {
          existing.active = existing.active !== false;
          existing.status = existing.status || 'Active';
          existing.role = 'Counsellor';
        }
      }
    } else {
      db = createInitialDatabase();
      saveDatabase();
    }
  } catch (err) {
    console.error('Error loading database, initializing fresh:', err);
    db = createInitialDatabase();
    saveDatabase();
  }
}

function saveDatabase(): void {
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database to file:', err);
  }
}

// ---------------------------------------------------------
// Real-Time Server-Sent Events (SSE) System
// ---------------------------------------------------------

const sseClients: Array<{ id: string; res: express.Response }> = [];

function broadcastEvent(type: string, data: any): void {
  const payload = `data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].res.write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------
// API Routes
// ---------------------------------------------------------

// Health & System Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    clientsCount: db.clients.length,
    staffCount: db.staff.length,
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    projectId: 'gamblepause-africa',
    storageMode: 'fullstack-shared-database',
    connectedDevices: sseClients.length,
  });
});

// SSE Stream for cross-device real-time sync
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  sseClients.push({ id: clientId, res });

  // Initial connection ack
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientId })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx >= 0) sseClients.splice(idx, 1);
  });
});

// Authentication
app.post('/api/auth/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ success: false, error: 'Username/email and password required.' });
  }

  const normalized = usernameOrEmail.trim().toLowerCase();
  const cred = db.credentials[normalized];

  if (!cred) {
    return res.status(401).json({ success: false, error: 'Account not found or password incorrect.' });
  }

  const incomingHash = hashPassword(password);
  if (cred.hash !== incomingHash) {
    return res.status(401).json({ success: false, error: 'Account not found or password incorrect.' });
  }

  if (cred.active === false) {
    return res.status(403).json({
      success: false,
      error: 'Account is currently inactive. Please contact a GamblePause Super Administrator.',
    });
  }

  // Update staff user lastLogin where applicable
  const staffMember = db.staff.find((s) => s.id === cred.userId);
  if (staffMember) {
    staffMember.lastLogin = new Date().toISOString();
    saveDatabase();
  }

  return res.json({
    success: true,
    user: {
      id: cred.userId,
      name: cred.name,
      email: cred.usernameOrEmail.includes('@') ? cred.usernameOrEmail : `${normalized}@gamblepause.org`,
      role: cred.role,
      clientId: cred.clientId,
      username: cred.usernameOrEmail,
    },
  });
});

app.post('/api/auth/register-client', (req, res) => {
  const { client, password } = req.body;
  if (!client || !client.id) {
    return res.status(400).json({ success: false, error: 'Invalid client record.' });
  }

  const pwd = password || 'Gamblepause';
  const pwdHash = hashPassword(pwd);

  const cred: StoredCredential = {
    usernameOrEmail: client.id,
    hash: pwdHash,
    userId: client.id,
    role: 'Client',
    name: `${client.firstName} ${client.lastName}`,
    clientId: client.id,
    active: true,
  };

  db.credentials[client.id.toLowerCase()] = cred;
  if (client.email) {
    db.credentials[client.email.trim().toLowerCase()] = cred;
  }

  saveDatabase();
  broadcastEvent('AUTH_USER_REGISTERED', { userId: client.id });

  return res.json({ success: true, clientId: client.id });
});

app.post('/api/auth/change-password', (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Missing parameters.' });
  }

  // Find user credential by userId
  const keys = Object.keys(db.credentials);
  const matchingKey = keys.find((k) => db.credentials[k].userId === userId);

  if (!matchingKey) {
    return res.status(404).json({ success: false, error: 'User credential not found.' });
  }

  const userCred = db.credentials[matchingKey];
  const oldHash = hashPassword(currentPassword);
  if (userCred.hash !== oldHash) {
    return res.status(401).json({ success: false, error: 'Current password incorrect.' });
  }

  const newHash = hashPassword(newPassword);
  for (const k of keys) {
    if (db.credentials[k].userId === userId) {
      db.credentials[k].hash = newHash;
    }
  }

  saveDatabase();
  return res.json({ success: true });
});

// Clients API
app.get('/api/clients', (req, res) => {
  res.json(db.clients);
});

app.post('/api/clients', (req, res) => {
  const client: Client = req.body;
  if (!client || !client.id) {
    return res.status(400).json({ success: false, error: 'Client ID is required.' });
  }

  const existingIdx = db.clients.findIndex((c) => c.id === client.id);
  if (existingIdx >= 0) {
    db.clients[existingIdx] = { ...db.clients[existingIdx], ...client };
  } else {
    db.clients.unshift(client);
  }

  saveDatabase();
  broadcastEvent('CLIENT_SAVED', client);

  res.json({ success: true, client });
});

app.get('/api/clients/:id', (req, res) => {
  const client = db.clients.find((c) => c.id === req.params.id);
  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }
  res.json(client);
});

app.patch('/api/clients/:id', (req, res) => {
  const client = db.clients.find((c) => c.id === req.params.id);
  if (!client) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  Object.assign(client, req.body, { lastActivityDate: new Date().toISOString() });
  saveDatabase();
  broadcastEvent('CLIENT_UPDATED', client);

  res.json({ success: true, client });
});

// Reassign / Assign Counsellor
app.post('/api/clients/:id/assign-counsellor', (req, res) => {
  const { counsellorId, reason, changedById, changedByName } = req.body;
  const client = db.clients.find((c) => c.id === req.params.id);

  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found.' });
  }

  // Validate that counsellor exists, has role 'Counsellor', and is Active
  const counsellor = db.staff.find((s) => s.id === counsellorId && s.role === 'Counsellor');
  if (!counsellor) {
    return res.status(400).json({ success: false, error: 'Selected counsellor not found in system.' });
  }

  if (counsellor.active === false || counsellor.status === 'Inactive' || counsellor.status === 'Archived') {
    return res.status(400).json({
      success: false,
      error: `Cannot assign client to ${counsellor.name}: Counsellor is currently inactive.`,
    });
  }

  const previousCounsellorId = client.assignedCounsellorId;
  const previousCounsellorName = client.assignedCounsellorName;

  // Update client
  client.assignedCounsellorId = counsellor.id;
  client.assignedCounsellorName = counsellor.name;
  client.lastActivityDate = new Date().toISOString();

  // Create historical assignment record
  const assignmentRecord: CounsellorAssignmentHistory = {
    id: `assign-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    clientId: client.id,
    clientName: `${client.firstName} ${client.lastName}`,
    previousCounsellorId,
    previousCounsellorName,
    newCounsellorId: counsellor.id,
    newCounsellorName: counsellor.name,
    changedById: changedById || 'admin',
    changedByName: changedByName || 'Super Administrator',
    changedAt: new Date().toISOString(),
    reason: reason || 'Counsellor assignment update',
  };
  db.assignments.unshift(assignmentRecord);

  // Target notification strictly to the NEW counsellor's UID
  const notif: NotificationRecord = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    clientId: client.id,
    clientName: `${client.firstName} ${client.lastName}`,
    channel: 'Dashboard',
    recipientUserId: counsellor.id, // Strictly counsellor's UID
    recipientTarget: counsellor.id,
    counsellorId: counsellor.id,
    counsellorName: counsellor.name,
    subject: `New Client Assigned: ${client.firstName} ${client.lastName} (${client.id})`,
    messageBody: `You have been assigned as primary counsellor for ${client.firstName} ${client.lastName} (${client.id}).`,
    triggerType: 'Counsellor Assignment',
    status: 'Sent',
    scheduledFor: new Date().toISOString(),
    sentAt: new Date().toISOString(),
    isRead: false,
  };
  db.notifications.unshift(notif);

  // Recalculate caseloads
  for (const s of db.staff) {
    if (s.role === 'Counsellor') {
      s.assignedClientsCount = db.clients.filter((c) => c.assignedCounsellorId === s.id).length;
    }
  }

  saveDatabase();
  broadcastEvent('COUNSELLOR_ASSIGNED', { client, assignment: assignmentRecord, notification: notif });

  res.json({ success: true, client, assignment: assignmentRecord });
});

// Counsellors Management API
app.get('/api/counsellors', (req, res) => {
  const statusFilter = req.query.status as string; // 'all' | 'active' | 'inactive'

  // Calculate live active caseloads from real clients
  const counsellors = db.staff
    .filter((s) => s.role === 'Counsellor')
    .map((c) => {
      const activeClientsCount = db.clients.filter((cl) => cl.assignedCounsellorId === c.id).length;
      return {
        ...c,
        assignedClientsCount: activeClientsCount,
        status: c.active !== false ? 'Active' : 'Inactive',
      };
    });

  if (statusFilter === 'active') {
    return res.json(counsellors.filter((c) => c.status === 'Active'));
  }
  if (statusFilter === 'inactive') {
    return res.json(counsellors.filter((c) => c.status === 'Inactive'));
  }

  res.json(counsellors);
});

app.patch('/api/counsellors/:id/status', (req, res) => {
  const { status } = req.body; // 'Active' | 'Inactive' | 'Archived'
  const counsellor = db.staff.find((s) => s.id === req.params.id);

  if (!counsellor) {
    return res.status(404).json({ success: false, error: 'Counsellor not found.' });
  }

  const isActive = status === 'Active';
  counsellor.active = isActive;
  counsellor.status = status;

  // Also update corresponding login credential active state
  for (const k of Object.keys(db.credentials)) {
    if (db.credentials[k].userId === counsellor.id) {
      db.credentials[k].active = isActive;
    }
  }

  saveDatabase();
  broadcastEvent('COUNSELLOR_STATUS_CHANGED', { counsellorId: counsellor.id, status });

  res.json({ success: true, counsellor });
});

// Staff API
app.get('/api/staff', (req, res) => {
  // Update caseloads dynamically
  for (const s of db.staff) {
    if (s.role === 'Counsellor') {
      s.assignedClientsCount = db.clients.filter((c) => c.assignedCounsellorId === s.id).length;
    }
  }
  res.json(db.staff);
});

app.post('/api/staff', (req, res) => {
  const newStaff: StaffUser = req.body;
  if (!newStaff || !newStaff.id || !newStaff.name) {
    return res.status(400).json({ success: false, error: 'Invalid staff record.' });
  }

  const existingIdx = db.staff.findIndex((s) => s.id === newStaff.id);
  if (existingIdx >= 0) {
    db.staff[existingIdx] = { ...db.staff[existingIdx], ...newStaff };
  } else {
    db.staff.push(newStaff);
  }

  // Provision credentials
  const defaultHash = hashPassword('Gamblepause');
  const cred: StoredCredential = {
    usernameOrEmail: newStaff.name.replace(/\s+/g, '.'),
    hash: defaultHash,
    userId: newStaff.id,
    role: newStaff.role,
    name: newStaff.name,
    active: newStaff.active !== false,
  };
  db.credentials[cred.usernameOrEmail.toLowerCase()] = cred;
  if (newStaff.email) {
    db.credentials[newStaff.email.trim().toLowerCase()] = cred;
  }

  saveDatabase();
  broadcastEvent('STAFF_SAVED', newStaff);

  res.json({ success: true, staff: newStaff });
});

// Counsellor Assignment History
app.get('/api/counsellor-assignments', (req, res) => {
  const clientId = req.query.clientId as string;
  if (clientId) {
    return res.json(db.assignments.filter((a) => a.clientId === clientId));
  }
  res.json(db.assignments);
});

// Submissions API
app.get('/api/submissions', (req, res) => {
  const clientId = req.query.clientId as string;
  if (clientId) {
    return res.json(db.submissions.filter((s) => s.clientId === clientId));
  }
  res.json(db.submissions);
});

app.post('/api/submissions', (req, res) => {
  const submission: AssessmentSubmission = req.body;
  if (!submission || !submission.clientId) {
    return res.status(400).json({ success: false, error: 'Invalid submission.' });
  }

  db.submissions.unshift(submission);

  // Update client assessment milestone
  const client = db.clients.find((c) => c.id === submission.clientId);
  if (client) {
    client.totalAssessmentsCompleted = (client.totalAssessmentsCompleted || 0) + 1;
    client.lastAssessmentName = submission.formName;
    client.lastAssessmentDate = submission.submittedAt || new Date().toISOString();
    client.lastActivityDate = new Date().toISOString();

    if (submission.scoreRiskLevel) {
      client.riskLevel = submission.scoreRiskLevel === 'Severe' ? 'High' : submission.scoreRiskLevel;
    }
  }

  saveDatabase();
  broadcastEvent('SUBMISSION_CREATED', submission);

  res.json({ success: true, submission });
});

// Case Notes API
app.get('/api/case-notes', (req, res) => {
  const clientId = req.query.clientId as string;
  if (clientId) {
    return res.json(db.caseNotes.filter((n) => n.clientId === clientId));
  }
  res.json(db.caseNotes);
});

app.post('/api/case-notes', (req, res) => {
  const note: CaseNote = req.body;
  if (!note || !note.clientId) {
    return res.status(400).json({ success: false, error: 'Invalid case note.' });
  }

  db.caseNotes.unshift(note);
  saveDatabase();
  broadcastEvent('CASE_NOTE_CREATED', note);

  res.json({ success: true, note });
});

// Notifications API (Strict UID isolation)
app.get('/api/notifications', (req, res) => {
  const userId = req.query.userId as string; // Target counsellor or staff UID
  if (userId) {
    // Strictly isolate notifications to this user's UID
    const filtered = db.notifications.filter((n) => n.recipientUserId === userId || n.recipientTarget === userId);
    return res.json(filtered);
  }
  res.json(db.notifications);
});

app.patch('/api/notifications/:id/read', (req, res) => {
  const notif = db.notifications.find((n) => n.id === req.params.id);
  if (notif) {
    notif.isRead = true;
    saveDatabase();
    broadcastEvent('NOTIFICATION_READ', { id: notif.id });
  }
  res.json({ success: true });
});

// ---------------------------------------------------------
// Vite & Production Static Serving
// ---------------------------------------------------------

async function startServer() {
  loadDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GamblePause full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
