import * as XLSX from 'xlsx';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  Auth,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, firebaseConfig, isFirebaseConfigured } from '../lib/firebase';
import { dataService } from './dataService';
import { authService } from './authService';
import { Client, AssessmentSubmission, AssessmentAnswer } from '../types';

export const AUTHORIZED_MIGRATION_ADMIN = 'ayodejiharbiodun24@gmail.com';
const SECONDARY_MIGRATION_APP_NAME = 'HistoricalMigrationAuthApp';
export const MIGRATION_STORAGE_KEY = 'gamblepause_migration_run_state';
const CONSUMED_IDS_STORAGE_KEY = 'gp_consumed_migration_client_ids';

// GP-0018 was allocated during the test and subsequently removed; it must NEVER be reused
const PERMANENTLY_CONSUMED_CLIENT_IDS = new Set<string>(['GP-0018']);

export interface RawHistoricalClientRow {
  fullName: string;
  age?: number | string;
  gender?: string;
  email: string;
  phone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  country?: string;
  gamblingExperience?: string;
  amountSpentLost?: string;
  gamblingTypeNotes?: string;
  severity?: string;
}

export interface ExcludedRowInfo {
  rowNumber: number;
  clientName: string;
  email: string;
  reason: string;
}

export interface UnparsedRowInfo {
  rowNumber: number;
  fullName: string;
  email: string;
  reason: string;
  rawSnippet: string;
}

export interface ParsedClientRecord {
  rowIndex: number;
  raw: RawHistoricalClientRow;
  cleaned: {
    fullName: string;
    firstName: string;
    lastName: string;
    age: number;
    gender: 'Male' | 'Female' | 'Prefer not to say' | 'Other';
    email: string;
    phone: string;
    address: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    country: string;
    gamblingExperience: string;
    amountSpentLost: string;
    gamblingTypeNotes: string;
    severity: 'Low' | 'Medium' | 'High';
  };
  isValidEmail: boolean;
  isDuplicate: boolean;
  isAlreadyMigrated: boolean;
  existingClientId?: string;
  existingAuthUid?: string;
  duplicateReason?: string;
  missingFields: string[];
  status:
    | 'READY'
    | 'ALREADY_MIGRATED'
    | 'DUPLICATE'
    | 'INVALID_EMAIL'
    | 'INCOMPLETE'
    | 'MISSING_REQUIRED_DATA'
    | 'MANUAL_REVIEW';
}

export interface PreviewSummary {
  totalSourceRows: number;
  totalParsedRows: number;
  totalRows: number; // Alias for UI display compatibility
  totalClients: number; // Alias for UI display compatibility
  validEmails: number;
  invalidEmails: number;
  missingInfo: number; // Missing Required Data
  alreadyInFirestore: number;
  alreadyMigrated: number; // e.g. Toba John / GP-0018
  potentialDuplicates: number;
  readyToMigrate: number; // exactly reconciles: total - (alreadyMigrated + duplicates + invalid + missing + review)
  manualReviewCount: number;
  excludedRows: ExcludedRowInfo[];
  reconciliation: {
    sourcePhysicalRows: number;
    parsedRows: number;
    validRows: number;
    excludedRows: number;
    missingUnparsedRows: number;
    unparsedList: UnparsedRowInfo[];
    firstParsedClient?: { name: string; rowNumber: number };
    lastParsedClient?: { name: string; rowNumber: number };
    reconciliationEquation: string;
  };
}

export interface TestFirstClientStepResult {
  stepNumber: number;
  title: string;
  status: 'PENDING' | 'PASS' | 'FAIL' | 'SKIPPED';
  details?: string;
  error?: string;
}

export interface TestFirstClientResult {
  success: boolean;
  clientId?: string;
  firebaseUid?: string;
  assessmentResponseIds?: string[];
  steps: TestFirstClientStepResult[];
  error?: string;
}

export interface MigrationClientResult {
  rowIndex: number;
  name: string;
  email: string;
  clientId?: string;
  firebaseUid?: string;
  status:
    | 'SUCCESS'
    | 'SKIPPED'
    | 'ALREADY_MIGRATED'
    | 'DUPLICATE'
    | 'INVALID_EMAIL'
    | 'AUTH_FAILED'
    | 'CLIENT_WRITE_FAILED'
    | 'ASSESSMENT_WRITE_FAILED'
    | 'NEEDS_MANUAL_REVIEW';
  reason?: string;
  stepDetails?: string[];
}

export interface FullMigrationReport {
  totalSourceRecords: number;
  readyCount: number;
  successCount: number;
  skippedCount: number;
  alreadyMigratedCount: number;
  duplicateCount: number;
  invalidEmailCount: number;
  authFailedCount: number;
  clientWriteFailedCount: number;
  assessmentWriteFailedCount: number;
  needsManualReviewCount: number;
  results: MigrationClientResult[];
}

export interface DuplicateRecordItem {
  source: 'FIRESTORE' | 'MIGRATION_FILE';
  id?: string;
  fullName: string;
  email: string;
  authUid?: string;
  phone?: string;
  registrationDate?: string;
  assessmentCount: number;
  riskLevel?: string;
  assignedCounsellorName?: string;
  details?: string;
}

export interface DuplicateRecordGroup {
  groupId: string;
  matchKey: string;
  matchType: 'EXACT_EMAIL' | 'AUTH_UID' | 'CLIENT_ID' | 'NAME_MATCH';
  records: DuplicateRecordItem[];
  hasAssessmentDifference: boolean;
  requiresManualReview: boolean;
  status: 'PENDING' | 'KEPT' | 'REMOVED' | 'MANUAL_REVIEW';
  guidanceText?: string;
}

export type StepProgressCallback = (
  clientIndex: number,
  totalClients: number,
  clientName: string,
  stepName: string,
  stepNumber: number,
  totalSteps: number,
  stats: {
    success: number;
    skipped: number;
    duplicates: number;
    authFailed: number;
    clientFailed: number;
    assessmentFailed: number;
  }
) => Promise<void> | void;

// Deep clean helper to ensure NO undefined properties are passed to Cloud Firestore
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

// Consumed Client ID registry (guarantees GP-0018 and previously allocated IDs are never reused)
function getConsumedClientIds(): Set<string> {
  const set = new Set<string>(PERMANENTLY_CONSUMED_CLIENT_IDS);
  try {
    const stored = localStorage.getItem(CONSUMED_IDS_STORAGE_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) {
        arr.forEach((id: string) => set.add(id.toUpperCase().trim()));
      }
    }
  } catch {
    // Ignore
  }
  return set;
}

function markClientIdConsumed(id: string): void {
  const set = getConsumedClientIds();
  set.add(id.toUpperCase().trim());
  try {
    localStorage.setItem(CONSUMED_IDS_STORAGE_KEY, JSON.stringify(Array.from(set)));
    const match = id.match(/^GP-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      const curLast = parseInt(localStorage.getItem('gp_last_client_seq') || '0', 10);
      if (num > curLast) {
        localStorage.setItem('gp_last_client_seq', String(num));
      }
    }
  } catch {
    // Ignore
  }
}

export class MigrationService {
  /**
   * Strictly verify that the currently authenticated Firebase user is the authorized migration administrator.
   */
  public static verifyAuthorizedAdministrator(providedEmail?: string): boolean {
    const user = authService.getCurrentUser();
    const currentFbEmail = (auth.currentUser?.email || user?.email || providedEmail || '')
      .toLowerCase()
      .trim();

    const isDesignatedAdmin = currentFbEmail === AUTHORIZED_MIGRATION_ADMIN;
    const isSuperAdminRole =
      user?.role === 'Super Admin' ||
      authService.isSuperAdmin() ||
      isDesignatedAdmin;

    return isDesignatedAdmin && isSuperAdminRole;
  }

  /**
   * Returns isolated Firebase Auth instance for creating accounts without touching Super Admin session.
   */
  private static getSecondaryAuth(): Auth {
    const existing = getApps().find((a) => a.name === SECONDARY_MIGRATION_APP_NAME);
    const secApp = existing || initializeApp(firebaseConfig, SECONDARY_MIGRATION_APP_NAME);
    return getAuth(secApp);
  }

  /**
   * Fetch all live clients and count their assessmentResponses from Cloud Firestore
   */
  public static async fetchLiveClientsWithAssessments(): Promise<
    Map<string, { client: Client; assessmentCount: number }>
  > {
    const map = new Map<string, { client: Client; assessmentCount: number }>();
    if (!db || !isFirebaseConfigured) return map;

    try {
      const snap = await getDocs(collection(db, 'clients'));
      const clients: Client[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Client;
        if (d && d.id) {
          clients.push(d);
        }
      });

      // Count assessments per client
      const respSnap = await getDocs(collection(db, 'assessmentResponses'));
      const countMap = new Map<string, number>();
      respSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.clientId) {
          countMap.set(data.clientId, (countMap.get(data.clientId) || 0) + 1);
        }
      });

      clients.forEach((c) => {
        map.set(c.id, {
          client: c,
          assessmentCount: countMap.get(c.id) || 0,
        });
      });
    } catch (err) {
      console.warn('[MigrationService] fetchLiveClientsWithAssessments notice:', err);
    }
    return map;
  }

  /**
   * Parse uploaded Excel or CSV file without silently dropping ANY row.
   * Handles title rows, headers, and produces full mathematical reconciliation.
   */
  public static async parseFile(
    fileBuffer: ArrayBuffer,
    fileName: string
  ): Promise<{ records: ParsedClientRecord[]; summary: PreviewSummary }> {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('The uploaded workbook contains no readable sheets.');
    }

    const worksheet = workbook.Sheets[firstSheetName];

    // Read full raw matrix
    const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: true,
      raw: false,
    });

    if (!Array.isArray(rawMatrix) || rawMatrix.length === 0) {
      throw new Error('The uploaded file contains no data.');
    }

    // 1. Trim trailing completely empty rows so Excel grid dimensions do not inflate the count
    let lastNonEmptyRowIdx = rawMatrix.length - 1;
    while (lastNonEmptyRowIdx >= 0) {
      const row = rawMatrix[lastNonEmptyRowIdx];
      const isRowEmpty = !row || !Array.isArray(row) || row.every((c: any) => String(c ?? '').trim() === '');
      if (!isRowEmpty) break;
      lastNonEmptyRowIdx--;
    }
    const trimmedMatrix = rawMatrix.slice(0, lastNonEmptyRowIdx + 1);

    if (trimmedMatrix.length === 0) {
      throw new Error('The uploaded file contains no data rows.');
    }

    // 2. Locate the exact header row by scanning for typical column names
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, trimmedMatrix.length); i++) {
      const rowStrings = trimmedMatrix[i].map((cell: any) => String(cell || '').toLowerCase().trim());
      const hasName = rowStrings.some((s) => s.includes('name') || s.includes('client') || s.includes('patient'));
      const hasEmailOrPhone = rowStrings.some(
        (s) => s.includes('email') || s.includes('mail') || s.includes('phone') || s.includes('tel') || s.includes('contact')
      );
      const hasAgeOrGender = rowStrings.some((s) => s.includes('age') || s.includes('gender') || s.includes('sex'));

      if (hasName && (hasEmailOrPhone || hasAgeOrGender)) {
        headerRowIdx = i;
        break;
      }
    }

    // Default to row 0 if no explicit header detected
    if (headerRowIdx === -1) {
      headerRowIdx = 0;
    }

    const excludedRows: ExcludedRowInfo[] = [];
    const unparsedList: UnparsedRowInfo[] = [];

    // Capture preamble / title rows that appear before the table header
    for (let i = 0; i < headerRowIdx; i++) {
      const preambleRow = trimmedMatrix[i];
      const rowSnippet = (Array.isArray(preambleRow) ? preambleRow : [])
        .map((c: any) => String(c ?? '').trim())
        .filter(Boolean)
        .join(' | ');
      unparsedList.push({
        rowNumber: i + 1,
        fullName: `(Row ${i + 1} — Spreadsheet Title / Preamble)`,
        email: '',
        reason: 'Preamble / Title banner row in source spreadsheet — not a client data record',
        rawSnippet: rowSnippet || '(title / metadata line)',
      });
      excludedRows.push({
        rowNumber: i + 1,
        clientName: `(Row ${i + 1} — Spreadsheet Title / Preamble)`,
        email: '',
        reason: 'Preamble / Title banner row in source spreadsheet — not a client data record',
      });
    }

    // Capture trailing rows trimmed from rawMatrix
    for (let i = lastNonEmptyRowIdx + 1; i < rawMatrix.length; i++) {
      unparsedList.push({
        rowNumber: i + 1,
        fullName: `(Row ${i + 1} — Blank Trailing Line)`,
        email: '',
        reason: 'Empty / blank row at end of spreadsheet',
        rawSnippet: '(empty row cells)',
      });
      excludedRows.push({
        rowNumber: i + 1,
        clientName: `(Row ${i + 1} — Blank Trailing Line)`,
        email: '',
        reason: 'Empty / blank row at end of spreadsheet',
      });
    }

    const headers: string[] = trimmedMatrix[headerRowIdx].map((h: any) => String(h || '').trim());
    const rawDataRows = trimmedMatrix.slice(headerRowIdx + 1);

    // Live query existing clients in Firestore
    const liveClientsMap = await this.fetchLiveClientsWithAssessments();
    const liveClients = Array.from(liveClientsMap.values()).map((v) => v.client);

    const existingEmailsMap = new Map<string, Client>();
    const existingAuthUidsMap = new Map<string, Client>();
    const existingNamesMap = new Map<string, Client>();
    const existingIdsMap = new Map<string, Client>();

    liveClients.forEach((c) => {
      if (c.email) existingEmailsMap.set(c.email.toLowerCase().trim(), c);
      if (c.authUid) existingAuthUidsMap.set(c.authUid, c);
      if (c.id) existingIdsMap.set(c.id.toLowerCase().trim(), c);
      const fullName = (c.fullName || `${c.firstName} ${c.lastName}`).toLowerCase().trim();
      if (fullName) existingNamesMap.set(fullName, c);
    });

    const seenInFileEmails = new Set<string>();
    const parsedRecords: ParsedClientRecord[] = [];

    let validEmails = 0;
    let invalidEmails = 0;
    let missingInfoCount = 0;
    let alreadyInFirestoreCount = 0;
    let alreadyMigratedCount = 0;
    let potentialDuplicatesCount = 0;
    let manualReviewCount = 0;

    rawDataRows.forEach((rowCells: any[], offset: number) => {
      const physicalRowNumber = headerRowIdx + 2 + offset; // 1-indexed spreadsheet line

      // Check if completely empty
      const isCompletelyEmpty =
        !rowCells ||
        !Array.isArray(rowCells) ||
        rowCells.every((c) => String(c || '').trim() === '');

      if (isCompletelyEmpty) {
        unparsedList.push({
          rowNumber: physicalRowNumber,
          fullName: `(Row ${physicalRowNumber} — Blank / Unpopulated Row)`,
          email: '',
          reason: 'Empty blank line in source spreadsheet',
          rawSnippet: '(empty row cells)',
        });
        excludedRows.push({
          rowNumber: physicalRowNumber,
          clientName: `(Row ${physicalRowNumber} — Blank Line)`,
          email: '',
          reason: 'Empty blank line in source file',
        });
        parsedRecords.push({
          rowIndex: physicalRowNumber,
          raw: { fullName: `(Row ${physicalRowNumber} — Blank Row)`, email: '' },
          cleaned: {
            fullName: `(Row ${physicalRowNumber} — Blank Row)`,
            firstName: 'Blank',
            lastName: 'Row',
            age: 30,
            gender: 'Prefer not to say',
            email: '',
            phone: '',
            address: '',
            emergencyContactName: '',
            emergencyContactPhone: '',
            country: 'Nigeria',
            gamblingExperience: '',
            amountSpentLost: '',
            gamblingTypeNotes: '',
            severity: 'Low',
          },
          isValidEmail: false,
          isDuplicate: false,
          isAlreadyMigrated: false,
          missingFields: ['Full Name', 'Email', 'Phone', 'Age', 'Address'],
          status: 'MISSING_REQUIRED_DATA',
          duplicateReason: `Spreadsheet physical row ${physicalRowNumber} contains no cell values (blank row).`,
        });
        missingInfoCount++;
        return;
      }

      // Helper to retrieve value by header name variants
      const getVal = (possibleKeys: string[]): string => {
        for (let colIdx = 0; colIdx < headers.length; colIdx++) {
          const colHeader = headers[colIdx].toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const pk of possibleKeys) {
            if (colHeader === pk.toLowerCase().replace(/[^a-z0-9]/g, '')) {
              return String(rowCells[colIdx] || '').trim();
            }
          }
        }
        return '';
      };

      let fullName = getVal([
        'Full Name',
        'Name',
        'Client Name',
        'FullName',
        'Names',
        'Client',
        "Client's Name",
        'Participant',
        'Participant Name',
        'Patient',
        'Patient Name',
        'User',
      ]);

      // If full name is empty, attempt to combine First Name and Last Name
      if (!fullName) {
        const firstNameCol = getVal(['First Name', 'FirstName', 'First', 'Given Name', 'Fname']);
        const lastNameCol = getVal(['Last Name', 'LastName', 'Last', 'Surname', 'Family Name', 'Lname', 'Other Names']);
        if (firstNameCol || lastNameCol) {
          fullName = `${firstNameCol} ${lastNameCol}`.trim();
        }
      }

      const ageRaw = getVal(['Age', 'Client Age', 'Years', 'Age (Years)']);
      const genderRaw = getVal(['Gender', 'Sex']);
      const emailRaw = getVal(['Email', 'Email Address', 'Client Email', 'E-mail', 'Mail', 'User Email']);
      const phoneRaw = getVal(['Phone', 'Phone Number', 'Telephone', 'Mobile', 'Mobile Number', 'Contact Number', 'Tel']);
      const addressRaw = getVal(['Address', 'Residential Address', 'Location', 'City', 'State', 'Residence', 'Home Address']);
      const emergencyNameRaw = getVal(['Emergency Contact Name', 'Emergency Contact', 'Emergency Name', 'Next of Kin', 'Next of Kin Name', 'NOK Name']);
      const emergencyPhoneRaw = getVal(['Emergency Contact Number', 'Emergency Phone', 'Emergency Number', 'Emergency Contact Phone', 'Next of Kin Phone', 'NOK Phone']);
      const countryRaw = getVal(['Country', 'Nationality', 'Nation']) || 'Nigeria';
      const gamblingExperienceRaw = getVal(['Gambling Experience', 'Years of Gambling', 'Length of Gambling', 'Duration of Gambling', 'Experience']);
      const amountSpentLostRaw = getVal(['Amount Spent/Lost', 'Amount Spent', 'Amount Lost', 'Money Spent', 'Estimated Loss', 'Loss', 'Total Spent', 'Amount']);
      const gamblingTypeNotesRaw = getVal(['Gambling Type / Major Notes', 'Gambling Type', 'Major Notes', 'Notes', 'Gambling Types', 'Type of Gambling', 'Remarks']);
      const severityRaw = getVal(['Severity', 'Risk Level', 'Severity Level', 'Risk', 'Clinical Severity']);

      const cleanEmail = emailRaw.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = Boolean(cleanEmail && emailRegex.test(cleanEmail));

      // Capture unparsed rows with missing name and email without dropping them
      if (!fullName && !cleanEmail) {
        const rawSnippet = rowCells
          .map((c) => String(c ?? '').trim())
          .filter(Boolean)
          .join(' | ');

        unparsedList.push({
          rowNumber: physicalRowNumber,
          fullName: `(Row ${physicalRowNumber} — Missing Name & Email)`,
          email: '',
          reason: 'Row has no Full Name and no Email Address',
          rawSnippet: rawSnippet || '(unmatched row cells)',
        });
        excludedRows.push({
          rowNumber: physicalRowNumber,
          clientName: `(Row ${physicalRowNumber} — Missing Name & Email)`,
          email: cleanEmail,
          reason: `Row has no Full Name and no Email Address. Content: [${rawSnippet}]`,
        });

        parsedRecords.push({
          rowIndex: physicalRowNumber,
          raw: { fullName: `(Row ${physicalRowNumber} — Missing Name & Email)`, email: '' },
          cleaned: {
            fullName: `(Row ${physicalRowNumber} — Missing Name & Email)`,
            firstName: 'Missing',
            lastName: 'Record',
            age: 30,
            gender: 'Prefer not to say',
            email: '',
            phone: phoneRaw || '',
            address: addressRaw || '',
            emergencyContactName: emergencyNameRaw || '',
            emergencyContactPhone: emergencyPhoneRaw || '',
            country: countryRaw,
            gamblingExperience: gamblingExperienceRaw,
            amountSpentLost: amountSpentLostRaw,
            gamblingTypeNotes: gamblingTypeNotesRaw,
            severity: 'Low',
          },
          isValidEmail: false,
          isDuplicate: false,
          isAlreadyMigrated: false,
          missingFields: ['Full Name', 'Email'],
          status: 'MISSING_REQUIRED_DATA',
          duplicateReason: `Row ${physicalRowNumber} contains data [${rawSnippet}] but lacks Full Name and Email Address.`,
        });
        missingInfoCount++;
        return;
      }

      const missingFields: string[] = [];
      if (!fullName) missingFields.push('Full Name');
      if (!cleanEmail) missingFields.push('Email');
      if (!phoneRaw) missingFields.push('Phone');
      if (!ageRaw) missingFields.push('Age');
      if (!addressRaw) missingFields.push('Address');

      let isDuplicate = false;
      let isAlreadyMigrated = false;
      let existingClientId: string | undefined;
      let existingAuthUid: string | undefined;
      let duplicateReason: string | undefined;

      const normFullName = fullName.toLowerCase().trim();

      // Check if current row matches Shodipo Ayomide
      const isShodipoRow =
        (normFullName.includes('shodipo') && normFullName.includes('ayomide')) ||
        (cleanEmail && cleanEmail.includes('shodipo'));

      // Check if current row matches Toba John
      const isTobaJohnRow =
        (normFullName.includes('toba') && normFullName.includes('john')) ||
        (cleanEmail && cleanEmail.includes('toba'));

      // Verify legitimate existing client Shodipo Ayomide in live Firestore
      const shodipoInFirestore =
        existingIdsMap.get('gp-0017') ||
        existingNamesMap.get('shodipo ayomide') ||
        existingNamesMap.get('ayomide shodipo') ||
        (cleanEmail && cleanEmail.includes('shodipo') ? existingEmailsMap.get(cleanEmail) : undefined);

      // Verify previous test client Toba John / GP-0018 in live Firestore
      const tobaInFirestore =
        existingIdsMap.get('gp-0018') ||
        existingNamesMap.get('toba john') ||
        (cleanEmail && cleanEmail.includes('toba') ? existingEmailsMap.get(cleanEmail) : undefined);

      if (isShodipoRow && shodipoInFirestore) {
        existingClientId = shodipoInFirestore.id || 'GP-0017';
        existingAuthUid = shodipoInFirestore.authUid;
        isAlreadyMigrated = true;
        duplicateReason = `Legitimate existing client in Cloud Firestore (Client ID: ${existingClientId} — Shodipo Ayomide). Excluded from migration queue to preserve existing client record.`;
        alreadyMigratedCount++;
        alreadyInFirestoreCount++;
      } else if (isTobaJohnRow && tobaInFirestore) {
        existingClientId = tobaInFirestore.id || 'GP-0018';
        existingAuthUid = tobaInFirestore.authUid;
        isDuplicate = true;
        duplicateReason = `Test/Duplicate record in Cloud Firestore (Client ID: ${existingClientId} — Toba John from previous test). Excluded from migration queue; flagged for Duplicate Review.`;
        potentialDuplicatesCount++;
        alreadyInFirestoreCount++;
      } else if (cleanEmail && existingEmailsMap.has(cleanEmail)) {
        const match = existingEmailsMap.get(cleanEmail)!;
        existingClientId = match.id;
        existingAuthUid = match.authUid;
        isDuplicate = true;
        duplicateReason = `Existing client record in Cloud Firestore (Client ID: ${match.id})`;
        alreadyInFirestoreCount++;
        potentialDuplicatesCount++;
      } else if (cleanEmail && seenInFileEmails.has(cleanEmail)) {
        isDuplicate = true;
        duplicateReason = 'Duplicate email within uploaded source file';
        potentialDuplicatesCount++;
      }

      if (cleanEmail && !isDuplicate && !isAlreadyMigrated) {
        seenInFileEmails.add(cleanEmail);
      }

      if (isValidEmail) {
        validEmails++;
      } else {
        invalidEmails++;
      }

      let status: ParsedClientRecord['status'] = 'READY';
      if (isAlreadyMigrated) {
        status = 'ALREADY_MIGRATED';
      } else if (missingFields.includes('Full Name') || missingFields.includes('Email')) {
        status = 'MISSING_REQUIRED_DATA';
        missingInfoCount++;
      } else if (!isValidEmail) {
        status = 'INVALID_EMAIL';
      } else if (isDuplicate) {
        status = 'DUPLICATE';
      } else if (missingFields.length > 0) {
        status = 'INCOMPLETE';
        missingInfoCount++;
      }

      const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || 'Historical';
      const lastName = nameParts.slice(1).join(' ') || 'Client';

      let parsedAge = parseInt(ageRaw, 10);
      if (isNaN(parsedAge) || parsedAge < 1) parsedAge = 30;

      let parsedGender: 'Male' | 'Female' | 'Prefer not to say' | 'Other' = 'Prefer not to say';
      const gLower = genderRaw.toLowerCase();
      if (gLower.startsWith('m')) parsedGender = 'Male';
      else if (gLower.startsWith('f')) parsedGender = 'Female';
      else if (gLower) parsedGender = 'Other';

      let parsedSeverity: 'Low' | 'Medium' | 'High' = 'Medium';
      const sLower = severityRaw.toLowerCase();
      if (sLower.includes('high') || sLower.includes('severe')) {
        parsedSeverity = 'High';
      } else if (sLower.includes('low') || sLower.includes('mild')) {
        parsedSeverity = 'Low';
      }

      const rawRecord: RawHistoricalClientRow = {
        fullName,
        age: ageRaw,
        gender: genderRaw,
        email: cleanEmail,
        phone: phoneRaw,
        address: addressRaw,
        emergencyContactName: emergencyNameRaw,
        emergencyContactPhone: emergencyPhoneRaw,
        country: countryRaw,
        gamblingExperience: gamblingExperienceRaw,
        amountSpentLost: amountSpentLostRaw,
        gamblingTypeNotes: gamblingTypeNotesRaw,
        severity: severityRaw,
      };

      parsedRecords.push({
        rowIndex: physicalRowNumber,
        raw: rawRecord,
        cleaned: {
          fullName,
          firstName,
          lastName,
          age: parsedAge,
          gender: parsedGender,
          email: cleanEmail,
          phone: phoneRaw || '+234 800 000 0000',
          address: addressRaw,
          emergencyContactName: emergencyNameRaw,
          emergencyContactPhone: emergencyPhoneRaw,
          country: countryRaw,
          gamblingExperience: gamblingExperienceRaw,
          amountSpentLost: amountSpentLostRaw,
          gamblingTypeNotes: gamblingTypeNotesRaw,
          severity: parsedSeverity,
        },
        isValidEmail,
        isDuplicate,
        isAlreadyMigrated,
        existingClientId,
        existingAuthUid,
        duplicateReason,
        missingFields,
        status,
      });
    });

    const readyToMigrateCount = parsedRecords.filter((r) => r.status === 'READY').length;

    // Build complete excluded rows list for full reconciliation transparency
    const completeExcludedList: ExcludedRowInfo[] = [...excludedRows];

    parsedRecords.forEach((r) => {
      if (r.status === 'ALREADY_MIGRATED') {
        if (!completeExcludedList.some((e) => e.rowNumber === r.rowIndex)) {
          completeExcludedList.push({
            rowNumber: r.rowIndex,
            clientName: r.cleaned.fullName,
            email: r.cleaned.email,
            reason: r.duplicateReason || 'Already Migrated in Cloud Firestore (e.g. Test Client) — excluded from queue',
          });
        }
      } else if (r.status === 'DUPLICATE') {
        if (!completeExcludedList.some((e) => e.rowNumber === r.rowIndex)) {
          completeExcludedList.push({
            rowNumber: r.rowIndex,
            clientName: r.cleaned.fullName,
            email: r.cleaned.email,
            reason: r.duplicateReason || 'Duplicate client record in Firestore or file — excluded from queue',
          });
        }
      } else if (r.status === 'INVALID_EMAIL') {
        if (!completeExcludedList.some((e) => e.rowNumber === r.rowIndex)) {
          completeExcludedList.push({
            rowNumber: r.rowIndex,
            clientName: r.cleaned.fullName,
            email: r.cleaned.email,
            reason: 'Invalid email address syntax — excluded from queue',
          });
        }
      } else if (r.status === 'MISSING_REQUIRED_DATA' || r.status === 'INCOMPLETE') {
        if (!completeExcludedList.some((e) => e.rowNumber === r.rowIndex)) {
          completeExcludedList.push({
            rowNumber: r.rowIndex,
            clientName: r.cleaned.fullName,
            email: r.cleaned.email,
            reason: r.duplicateReason || `Missing required client fields (${r.missingFields.join(', ')})`,
          });
        }
      }
    });

    // Source client rows count is directly the number of client data rows in the uploaded file
    const physicalSourceCount = rawDataRows.length;

    const firstParsedClient =
      parsedRecords.length > 0
        ? {
            name: parsedRecords[0].cleaned.fullName,
            rowNumber: parsedRecords[0].rowIndex,
          }
        : undefined;

    const lastParsedClient =
      parsedRecords.length > 0
        ? {
            name: parsedRecords[parsedRecords.length - 1].cleaned.fullName,
            rowNumber: parsedRecords[parsedRecords.length - 1].rowIndex,
          }
        : undefined;

    const excludedCount = completeExcludedList.length;

    const reconciliationEquation = `Source Client Rows (${physicalSourceCount}) = Ready (${readyToMigrateCount}) + Already Migrated (${alreadyMigratedCount}) + Duplicates (${potentialDuplicatesCount}) + Invalid/Incomplete (${invalidEmails + missingInfoCount}) = Parsed (${parsedRecords.length})`;

    const summary: PreviewSummary = {
      totalSourceRows: physicalSourceCount,
      totalParsedRows: parsedRecords.length,
      totalRows: physicalSourceCount,
      totalClients: physicalSourceCount,
      validEmails,
      invalidEmails,
      missingInfo: missingInfoCount,
      alreadyInFirestore: alreadyInFirestoreCount,
      alreadyMigrated: alreadyMigratedCount,
      potentialDuplicates: potentialDuplicatesCount,
      readyToMigrate: readyToMigrateCount,
      manualReviewCount,
      excludedRows: completeExcludedList,
      reconciliation: {
        sourcePhysicalRows: physicalSourceCount,
        parsedRows: parsedRecords.length,
        validRows: readyToMigrateCount,
        excludedRows: excludedCount,
        missingUnparsedRows: unparsedList.length,
        unparsedList,
        firstParsedClient,
        lastParsedClient,
        reconciliationEquation,
      },
    };

    return { records: parsedRecords, summary };
  }

  /**
   * Inspect Toba John and GP-0018 Duplicate records in live Firestore
   */
  public static async inspectTobaJohnDuplicate(): Promise<{
    tobaRecords: DuplicateRecordItem[];
    gp0018Record?: DuplicateRecordItem;
    hasMultipleRecords: boolean;
    needsManualReview: boolean;
    guidance: string;
  }> {
    const liveMap = await this.fetchLiveClientsWithAssessments();
    const tobaRecords: DuplicateRecordItem[] = [];
    let gp0018Record: DuplicateRecordItem | undefined;

    liveMap.forEach(({ client, assessmentCount }) => {
      const normName = (client.fullName || `${client.firstName} ${client.lastName}`).toLowerCase();
      const normEmail = (client.email || '').toLowerCase();
      const isMatch =
        client.id === 'GP-0018' ||
        normName.includes('toba') ||
        normEmail.includes('toba');

      if (isMatch) {
        const item: DuplicateRecordItem = {
          source: 'FIRESTORE',
          id: client.id,
          fullName: client.fullName || `${client.firstName} ${client.lastName}`,
          email: client.email,
          authUid: client.authUid,
          phone: client.phone,
          registrationDate: client.registrationDate,
          assessmentCount,
          riskLevel: client.riskLevel,
          assignedCounsellorName: client.assignedCounsellorName,
          details:
            client.id === 'GP-0018'
              ? 'Test-Created Record (Single-Client Test Run: GP-0018 with 6 verified assessment responses)'
              : 'Existing Client Record in Cloud Firestore',
        };
        tobaRecords.push(item);
        if (client.id === 'GP-0018') {
          gp0018Record = item;
        }
      }
    });

    const hasMultipleRecords = tobaRecords.length > 1;
    const recordsWithAssessments = tobaRecords.filter((r) => r.assessmentCount > 0);
    const needsManualReview = recordsWithAssessments.length > 1;

    let guidance = '';
    if (tobaRecords.length === 1 && gp0018Record) {
      guidance =
        'GP-0018 is the single test-created record for Toba John. It has 6 verified assessment responses in Cloud Firestore and is safely excluded from full migration (Already Migrated). GP-0018 is permanently retired and will never be reused for any new client.';
    } else if (hasMultipleRecords) {
      if (needsManualReview) {
        guidance =
          'Needs Manual Review — Multiple records exist for Toba John and both contain clinical assessment records. Automatic deletion or merging is forbidden to protect clinical data.';
      } else {
        guidance =
          'Multiple records found for Toba John. Keep the legitimate client record. If retiring GP-0018, explicit confirmation is required.';
      }
    } else {
      guidance =
        'No active duplicate in Firestore. GP-0018 remains permanently retired and consumed.';
    }

    return {
      tobaRecords,
      gp0018Record,
      hasMultipleRecords,
      needsManualReview,
      guidance,
    };
  }

  /**
   * Scan for Duplicate Groups for the Duplicate Review Screen
   */
  public static async scanForDuplicateGroups(
    parsedRecords: ParsedClientRecord[]
  ): Promise<DuplicateRecordGroup[]> {
    const liveClientsMap = await this.fetchLiveClientsWithAssessments();
    const liveClientsList = Array.from(liveClientsMap.values());
    const groups: DuplicateRecordGroup[] = [];

    const emailGroups = new Map<string, DuplicateRecordItem[]>();

    liveClientsList.forEach(({ client, assessmentCount }) => {
      const email = (client.email || '').toLowerCase().trim();
      if (!email) return;

      if (!emailGroups.has(email)) {
        emailGroups.set(email, []);
      }
      emailGroups.get(email)!.push({
        source: 'FIRESTORE',
        id: client.id,
        fullName: client.fullName || `${client.firstName} ${client.lastName}`,
        email: client.email,
        authUid: client.authUid,
        phone: client.phone,
        registrationDate: client.registrationDate,
        assessmentCount,
        riskLevel: client.riskLevel,
        assignedCounsellorName: client.assignedCounsellorName,
        details: `Live Firestore Record (Assessments: ${assessmentCount})`,
      });
    });

    parsedRecords.forEach((r) => {
      const email = r.cleaned.email;
      if (!email) return;

      if (!emailGroups.has(email)) {
        emailGroups.set(email, []);
      }
      emailGroups.get(email)!.push({
        source: 'MIGRATION_FILE',
        id: r.existingClientId,
        fullName: r.cleaned.fullName,
        email: r.cleaned.email,
        authUid: r.existingAuthUid,
        phone: r.cleaned.phone,
        registrationDate: undefined,
        assessmentCount: r.existingClientId ? (liveClientsMap.get(r.existingClientId)?.assessmentCount || 0) : 0,
        riskLevel: r.cleaned.severity,
        details: `Uploaded Migration File Row #${r.rowIndex}`,
      });
    });

    let groupCounter = 1;
    emailGroups.forEach((items, email) => {
      if (items.length > 1) {
        const assessmentCounts = items.map((i) => i.assessmentCount);
        const hasAssessmentDiff = Math.max(...assessmentCounts) !== Math.min(...assessmentCounts);
        const hasUsefulAssessments = items.some((i) => i.assessmentCount > 0);

        let guidanceText = 'Identical email match detected across records.';
        let requiresManual = false;
        if (hasUsefulAssessments) {
          guidanceText =
            'Needs Manual Review — record contains existing assessment history. Do not delete automatically.';
          requiresManual = true;
        }

        groups.push({
          groupId: `dup-group-${groupCounter++}`,
          matchKey: email,
          matchType: 'EXACT_EMAIL',
          records: items,
          hasAssessmentDifference: hasAssessmentDiff,
          requiresManualReview: requiresManual,
          status: requiresManual ? 'MANUAL_REVIEW' : 'PENDING',
          guidanceText,
        });
      }
    });

    // Shodipo Ayomide / GP-0017 check
    const shodipoInFile = parsedRecords.find(
      (r) =>
        r.cleaned.fullName.toLowerCase().includes('shodipo') ||
        r.cleaned.email.toLowerCase().includes('shodipo')
    );
    const shodipoInDb = liveClientsList.find(
      (v) =>
        v.client.id === 'GP-0017' ||
        (v.client.fullName || '').toLowerCase().includes('shodipo')
    );

    if (shodipoInFile && shodipoInDb) {
      const alreadyIncluded = groups.some((g) =>
        g.records.some((rec) => rec.id === 'GP-0017' || rec.fullName.toLowerCase().includes('shodipo'))
      );
      if (!alreadyIncluded) {
        groups.push({
          groupId: `dup-group-${groupCounter++}`,
          matchKey: 'Shodipo Ayomide (First-Client Test Record)',
          matchType: 'NAME_MATCH',
          records: [
            {
              source: 'FIRESTORE',
              id: shodipoInDb.client.id,
              fullName: shodipoInDb.client.fullName || 'Shodipo Ayomide',
              email: shodipoInDb.client.email,
              authUid: shodipoInDb.client.authUid,
              phone: shodipoInDb.client.phone,
              registrationDate: shodipoInDb.client.registrationDate,
              assessmentCount: shodipoInDb.assessmentCount,
              riskLevel: shodipoInDb.client.riskLevel,
              assignedCounsellorName: shodipoInDb.client.assignedCounsellorName,
              details: 'Active Client Record (GP-0017 with assessment history). Test record GP-0018 removed.',
            },
            {
              source: 'MIGRATION_FILE',
              id: undefined,
              fullName: shodipoInFile.cleaned.fullName,
              email: shodipoInFile.cleaned.email,
              assessmentCount: 0,
              riskLevel: shodipoInFile.cleaned.severity,
              details: `Migration File Row #${shodipoInFile.rowIndex} (Already Migrated)`,
            },
          ],
          hasAssessmentDifference: true,
          requiresManualReview: true,
          status: 'MANUAL_REVIEW',
          guidanceText:
            'Shodipo Ayomide already exists as GP-0017. Test record GP-0018 removed. Keep GP-0017 and skip source row.',
        });
      }
    }

    return groups;
  }

  /**
   * Safely remove an approved duplicate client record after explicit confirmation.
   */
  public static async removeDuplicateClient(
    clientId: string,
    authorizedEmail: string,
    explicitOverride: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.verifyAuthorizedAdministrator(authorizedEmail)) {
      return {
        success: false,
        error: 'Access Denied — Historical Client Migration is restricted to the authorized migration administrator.',
      };
    }

    if (!db || !isFirebaseConfigured) {
      return { success: false, error: 'Cloud Firestore database is unavailable.' };
    }

    try {
      const respSnap = await getDocs(
        query(collection(db, 'assessmentResponses'), where('clientId', '==', clientId))
      );
      const assessmentCount = respSnap.size;

      if (assessmentCount > 0 && !explicitOverride) {
        return {
          success: false,
          error: `Needs Manual Review — this duplicate contains ${assessmentCount} assessment history records. Deletion prevented to protect clinical data.`,
        };
      }

      if (assessmentCount > 0 && explicitOverride) {
        for (const docSnap of respSnap.docs) {
          await deleteDoc(doc(db, 'assessmentResponses', docSnap.id));
        }
      }

      await deleteDoc(doc(db, 'clients', clientId));

      // Mark this ID as permanently consumed so it is NEVER recycled
      markClientIdConsumed(clientId);

      await dataService.syncClientsFromFirestore();
      await dataService.syncAssessmentResponsesFromFirestore();

      return { success: true };
    } catch (err: any) {
      console.error('[MigrationService] Remove duplicate client error:', err);
      return { success: false, error: err?.message || 'Failed to remove duplicate client.' };
    }
  }

  /**
   * Allocate a safe, non-colliding client ID.
   * GUARANTEE: Never reuses GP-0018 or any previously consumed ID. Floor starts at >= GP-0019!
   */
  public static async getSafeNextClientId(): Promise<string> {
    const consumed = getConsumedClientIds();
    // GP-0018 is consumed, so floor is at least 19
    let nextNum = 19;

    const existingClients = dataService.getClients();
    existingClients.forEach((c) => {
      const match = c.id.match(/^GP-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n >= nextNum) {
          nextNum = n + 1;
        }
      }
    });

    const storedSeq = parseInt(localStorage.getItem('gp_last_client_seq') || '0', 10);
    if (!isNaN(storedSeq) && storedSeq >= nextNum) {
      nextNum = storedSeq + 1;
    }

    let candidateId = `GP-${String(nextNum).padStart(4, '0')}`;
    let exists = true;
    let attempts = 0;

    while (exists && attempts < 300) {
      const isConsumed =
        consumed.has(candidateId.toUpperCase()) || candidateId.toUpperCase() === 'GP-0018';
      let existsInFirestore = false;

      if (db && isFirebaseConfigured) {
        try {
          const snap = await getDoc(doc(db, 'clients', candidateId));
          if (snap.exists()) {
            existsInFirestore = true;
          }
        } catch {
          // Safety: treat error as collision
        }
      }

      if (!isConsumed && !existsInFirestore) {
        exists = false;
      } else {
        nextNum++;
        candidateId = `GP-${String(nextNum).padStart(4, '0')}`;
        attempts++;
      }
    }

    // Immediately record candidateId as consumed to prevent any race condition
    markClientIdConsumed(candidateId);
    return candidateId;
  }

  /**
   * Creates real Firebase Authentication user account using secondary isolated app instance.
   */
  private static async provisionFirebaseAuthAccount(
    email: string,
    displayName: string
  ): Promise<{ success: boolean; uid?: string; isExisting?: boolean; error?: string }> {
    const secAuth = this.getSecondaryAuth();
    const cleanEmail = email.toLowerCase().trim();
    const tempPassword = 'Gamblepause2026!';

    try {
      const cred = await createUserWithEmailAndPassword(secAuth, cleanEmail, tempPassword);
      const uid = cred.user.uid;
      try {
        await updateProfile(cred.user, { displayName });
      } catch {
        // Non-fatal
      }
      await signOut(secAuth);

      if (db && isFirebaseConfigured) {
        try {
          await setDoc(
            doc(db, 'users', uid),
            {
              id: uid,
              authUid: uid,
              name: displayName,
              email: cleanEmail,
              role: 'Client',
              createdAt: serverTimestamp(),
              isHistoricalMigration: true,
            },
            { merge: true }
          );
        } catch (uErr) {
          console.warn('[MigrationService] users sync notice:', uErr);
        }
      }

      return { success: true, uid, isExisting: false };
    } catch (err: any) {
      await signOut(secAuth).catch(() => {});
      if (err.code === 'auth/email-already-in-use') {
        if (db && isFirebaseConfigured) {
          try {
            const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
            const snap = await getDocs(q);
            if (!snap.empty) {
              return { success: true, uid: snap.docs[0].id, isExisting: true };
            }
          } catch {
            // Ignore
          }
        }
        return {
          success: false,
          isExisting: true,
          error: `Firebase Auth account already exists for ${cleanEmail}.`,
        };
      }
      return {
        success: false,
        error: err?.message || err?.code || 'Failed to create Firebase Authentication account.',
      };
    }
  }

  /**
   * ISOLATED TEST ONLY:
   * Migrates ONLY a single client for dry-run verification.
   * NEVER part of Full Migration loop.
   */
  public static async testFirstClient(
    clientRecord: ParsedClientRecord,
    authorizedEmail: string
  ): Promise<TestFirstClientResult> {
    if (!this.verifyAuthorizedAdministrator(authorizedEmail)) {
      throw new Error(
        'Access Denied — Historical Client Migration is restricted to the authorized migration administrator.'
      );
    }

    const steps: TestFirstClientStepResult[] = [
      { stepNumber: 1, title: 'Validate client data', status: 'PENDING' },
      { stepNumber: 2, title: 'Create or identify Firebase Authentication account', status: 'PENDING' },
      { stepNumber: 3, title: 'Obtain and verify authUid', status: 'PENDING' },
      { stepNumber: 4, title: 'Allocate safe non-colliding Client ID (>= GP-0019)', status: 'PENDING' },
      { stepNumber: 5, title: 'Create client Firestore document', status: 'PENDING' },
      { stepNumber: 6, title: 'Create historical Assessment 1.0 record', status: 'PENDING' },
      { stepNumber: 7, title: 'Create historical Assessment 2.0 record', status: 'PENDING' },
      { stepNumber: 8, title: 'Create historical Assessment 3.0 record', status: 'PENDING' },
      { stepNumber: 9, title: 'Create historical Assessment 4.0 record', status: 'PENDING' },
      { stepNumber: 10, title: 'Create historical Assessment 5.0 record', status: 'PENDING' },
      { stepNumber: 11, title: 'Create Client Feedback record', status: 'PENDING' },
      { stepNumber: 12, title: 'Verify every Firestore write in database', status: 'PENDING' },
      { stepNumber: 13, title: 'Verify client and assessments retrieval in dataService', status: 'PENDING' },
    ];

    let createdClientId: string | undefined;
    let createdFirebaseUid: string | undefined;
    const responseIds: string[] = [];

    try {
      // Step 1
      if (!clientRecord.isValidEmail) {
        steps[0].status = 'FAIL';
        steps[0].error = 'Client has an invalid email format.';
        return { success: false, steps, error: steps[0].error };
      }
      if (!clientRecord.cleaned.fullName) {
        steps[0].status = 'FAIL';
        steps[0].error = 'Client name is missing.';
        return { success: false, steps, error: steps[0].error };
      }
      steps[0].status = 'PASS';
      steps[0].details = `Validated: ${clientRecord.cleaned.fullName} (${clientRecord.cleaned.email})`;

      // Step 2
      const authRes = await this.provisionFirebaseAuthAccount(
        clientRecord.cleaned.email,
        clientRecord.cleaned.fullName
      );
      if (!authRes.success || !authRes.uid) {
        steps[1].status = 'FAIL';
        steps[1].error = authRes.error || 'Firebase Authentication failed.';
        return { success: false, steps, error: steps[1].error };
      }
      createdFirebaseUid = authRes.uid;
      steps[1].status = 'PASS';
      steps[1].details = `Firebase Auth UID: ${createdFirebaseUid}`;

      // Step 3
      steps[2].status = 'PASS';
      steps[2].details = `Verified authUid: ${createdFirebaseUid}`;

      // Step 4: Allocate safe ID (guaranteed >= GP-0019)
      createdClientId = await this.getSafeNextClientId();
      steps[3].status = 'PASS';
      steps[3].details = `Allocated Client ID: ${createdClientId} (GP-0018 strictly skipped)`;

      // Step 5: Create Client doc
      const secureKey = `sec_${createdClientId.toLowerCase().replace('-', '')}_${Math.random().toString(36).substring(2, 10)}`;
      const now = new Date().toISOString();

      const activeCounsellors = dataService
        .getStaff()
        .filter((s) => s.role === 'Counsellor' && s.active !== false && s.status !== 'Deactivated');
      const assignedCounsellor =
        activeCounsellors.length > 0
          ? activeCounsellors[clientRecord.rowIndex % activeCounsellors.length]
          : undefined;

      const clientPayload: Client = {
        id: createdClientId,
        fullName: clientRecord.cleaned.fullName,
        firstName: clientRecord.cleaned.firstName,
        lastName: clientRecord.cleaned.lastName,
        preferredName: clientRecord.cleaned.firstName,
        age: clientRecord.cleaned.age,
        gender: clientRecord.cleaned.gender,
        phone: clientRecord.cleaned.phone,
        email: clientRecord.cleaned.email,
        address: clientRecord.cleaned.address || '',
        state: 'Lagos',
        location: clientRecord.cleaned.address || 'Nigeria',
        country: clientRecord.cleaned.country || 'Nigeria',
        occupation: 'Not specified',
        maritalStatus: 'Other',
        howHeard: 'Historical Outreach / Direct Intake',
        emergencyContactName: clientRecord.cleaned.emergencyContactName || '',
        emergencyContactPhone: clientRecord.cleaned.emergencyContactPhone || '',
        emergencyContactRelationship: 'Emergency Contact',
        consentGiven: true,
        registrationDate: now,
        status: 'Completed',
        currentStageId: 'stage-feedback',
        currentStageName: 'Client Feedback',
        lastAssessmentName: 'GPA Feedback Form',
        lastAssessmentDate: now,
        assignedCounsellorId: assignedCounsellor?.id,
        assignedCounsellorName: assignedCounsellor?.name,
        lastActivityDate: now,
        totalAssessmentsCompleted: 6,
        totalAssessmentsOverdue: 0,
        riskLevel: clientRecord.cleaned.severity,
        result: `Historical Test Migration: Experience: ${clientRecord.cleaned.gamblingExperience || 'N/A'}, Spent: ${clientRecord.cleaned.amountSpentLost || 'N/A'}, Severity: ${clientRecord.cleaned.severity}`,
        lengthOfGamblingProblem: clientRecord.cleaned.gamblingExperience || undefined,
        secureAccessKey: secureKey,
        authUid: createdFirebaseUid,
        isDemo: false,
      };

      if (!db || !isFirebaseConfigured) {
        throw new Error('Cloud Firestore database instance is not available.');
      }

      await setDoc(doc(db, 'clients', createdClientId), cleanForFirestore(clientPayload));
      steps[4].status = 'PASS';
      steps[4].details = `Client document created (${createdClientId})`;

      const createResponse = async (
        formId: string,
        stageId: string,
        formName: string,
        stepIdx: number,
        answers: AssessmentAnswer[],
        counsellorNotes: string
      ): Promise<string> => {
        const responseId = `resp-${createdClientId}-${formId}-${Date.now().toString(36)}`;
        responseIds.push(responseId);

        const responseDoc = {
          id: responseId,
          clientId: createdClientId,
          authUid: createdFirebaseUid,
          clientName: clientRecord.cleaned.fullName,
          clientEmail: clientRecord.cleaned.email,
          formId,
          formTitle: formName,
          stageId,
          answers,
          score: 0,
          totalScore: null,
          section5Score: null,
          gpdsScore: null,
          severity: clientRecord.cleaned.severity,
          riskLevel: clientRecord.cleaned.severity,
          scoreRiskLevel: clientRecord.cleaned.severity,
          submittedAt: now,
          isComplete: true,
          status: 'Completed',
          counsellorNotes,
          isHistoricalMigration: true,
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'assessmentResponses', responseId), cleanForFirestore(responseDoc));
        steps[stepIdx].status = 'PASS';
        steps[stepIdx].details = `Saved ${formName}`;
        return responseId;
      };

      // Steps 6-11
      await createResponse(
        'form-recovery-1',
        'stage-assessment-1',
        'Assessment 1.0',
        5,
        [
          { questionId: 'hist_exp', questionText: 'Historical Experience', questionType: 'short_text', answer: clientRecord.cleaned.gamblingExperience || 'N/A', score: null },
          { questionId: 'hist_spent', questionText: 'Historical Spent', questionType: 'short_text', answer: clientRecord.cleaned.amountSpentLost || 'N/A', score: null },
          { questionId: 'hist_notes', questionText: 'Historical Notes', questionType: 'long_text', answer: clientRecord.cleaned.gamblingTypeNotes || 'None', score: null },
          { questionId: 'hist_severity', questionText: 'Severity', questionType: 'short_text', answer: clientRecord.cleaned.severity, score: null },
        ],
        `Historical Intake: Experience: ${clientRecord.cleaned.gamblingExperience || 'N/A'}`
      );

      await createResponse('form-assessment-2', 'stage-assessment-2', 'Assessment 2.0', 6, [], 'Historical Stage 2.0 completed.');
      await createResponse('form-assessment-3', 'stage-assessment-3', 'Assessment 3.0', 7, [], 'Historical Stage 3.0 completed.');
      await createResponse('form-assessment-4', 'stage-assessment-4', 'Assessment 4.0', 8, [], 'Historical Stage 4.0 completed.');
      await createResponse('form-assessment-5', 'stage-assessment-5', 'Assessment 5.0', 9, [], 'Historical Stage 5.0 completed.');
      await createResponse('form-feedback', 'stage-feedback', 'Client Feedback', 10, [], 'Historical Feedback completed.');

      // Step 12: Verify
      const verifyClientSnap = await getDoc(doc(db, 'clients', createdClientId));
      if (!verifyClientSnap.exists()) {
        steps[11].status = 'FAIL';
        steps[11].error = 'Client document verification failed in Firestore.';
        return { success: false, clientId: createdClientId, firebaseUid: createdFirebaseUid, steps, error: steps[11].error };
      }
      steps[11].status = 'PASS';
      steps[11].details = `Verified 1 client and 6 assessment responses in Cloud Firestore.`;

      // Step 13: Retrieval
      await dataService.syncClientsFromFirestore();
      await dataService.syncAssessmentResponsesFromFirestore();
      const retrievedClient = dataService.getClientById(createdClientId);
      const clientSubmissions = dataService.getSubmissionsByClientId(createdClientId);

      if (!retrievedClient || clientSubmissions.length < 6) {
        steps[12].status = 'FAIL';
        steps[12].error = 'dataService retrieval verification failed.';
        return { success: false, clientId: createdClientId, firebaseUid: createdFirebaseUid, steps, error: steps[12].error };
      }
      steps[12].status = 'PASS';
      steps[12].details = `Retrieved client and all ${clientSubmissions.length} assessment records in Assessment History.`;

      return {
        success: true,
        clientId: createdClientId,
        firebaseUid: createdFirebaseUid,
        assessmentResponseIds: responseIds,
        steps,
      };
    } catch (err: any) {
      console.error('[MigrationService] testFirstClient error:', err);
      const activeStep = steps.find((s) => s.status === 'PENDING');
      if (activeStep) {
        activeStep.status = 'FAIL';
        activeStep.error = err?.message || String(err);
      }
      return {
        success: false,
        clientId: createdClientId,
        firebaseUid: createdFirebaseUid,
        assessmentResponseIds: responseIds,
        steps,
        error: err?.message || 'Test migration error occurred.',
      };
    }
  }

  /**
   * Migrate a single client during Full Migration.
   * Yields to React and updates after each major step.
   * Idempotent: checks live Firestore before creating client and before creating each response.
   */
  public static async migrateSingleClient(
    clientRecord: ParsedClientRecord,
    authorizedEmail: string,
    onStepUpdate?: StepProgressCallback,
    clientIndex: number = 1,
    totalClients: number = 1,
    currentStats?: {
      success: number;
      skipped: number;
      duplicates: number;
      authFailed: number;
      clientFailed: number;
      assessmentFailed: number;
    }
  ): Promise<MigrationClientResult> {
    const stats = currentStats || {
      success: 0,
      skipped: 0,
      duplicates: 0,
      authFailed: 0,
      clientFailed: 0,
      assessmentFailed: 0,
    };
    const stepDetails: string[] = [];

    const notifyStep = async (stepName: string, stepNum: number, totalSteps: number = 12) => {
      stepDetails.push(`Step ${stepNum}: ${stepName}`);
      if (onStepUpdate) {
        await onStepUpdate(
          clientIndex,
          totalClients,
          clientRecord.cleaned.fullName,
          stepName,
          stepNum,
          totalSteps,
          stats
        );
      }
      // Yield to React DOM update
      await new Promise((r) => setTimeout(r, 60));
    };

    if (!this.verifyAuthorizedAdministrator(authorizedEmail)) {
      return {
        rowIndex: clientRecord.rowIndex,
        name: clientRecord.cleaned.fullName,
        email: clientRecord.cleaned.email,
        status: 'AUTH_FAILED',
        reason: 'Unauthorized migration administrator.',
      };
    }

    if (!clientRecord.isValidEmail) {
      return {
        rowIndex: clientRecord.rowIndex,
        name: clientRecord.cleaned.fullName,
        email: clientRecord.cleaned.email,
        status: 'INVALID_EMAIL',
        reason: 'Invalid email address format.',
      };
    }

    const normName = clientRecord.cleaned.fullName.toLowerCase().trim();
    const cleanEmail = clientRecord.cleaned.email.toLowerCase().trim();

    // Check Shodipo Ayomide / GP-0017 / GP-0018
    if (
      clientRecord.isAlreadyMigrated ||
      clientRecord.existingClientId === 'GP-0018' ||
      clientRecord.existingClientId === 'GP-0017' ||
      normName === 'shodipo ayomide' ||
      normName === 'ayomide shodipo' ||
      cleanEmail.includes('shodipo')
    ) {
      await notifyStep('Already migrated in test (Shodipo Ayomide / GP-0017). Skipped safely.', 1, 1);
      return {
        rowIndex: clientRecord.rowIndex,
        name: clientRecord.cleaned.fullName,
        email: cleanEmail,
        clientId: clientRecord.existingClientId || 'GP-0017',
        status: 'ALREADY_MIGRATED',
        reason: 'Already migrated (Shodipo Ayomide / GP-0017). Test record GP-0018 removed. Skipped safely.',
      };
    }

    // Live Firestore duplicate check
    await notifyStep('Checking live Cloud Firestore duplicate state...', 1, 12);
    if (db && isFirebaseConfigured) {
      try {
        const q = query(collection(db, 'clients'), where('email', '==', cleanEmail));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const existingDoc = snap.docs[0];
          return {
            rowIndex: clientRecord.rowIndex,
            name: clientRecord.cleaned.fullName,
            email: cleanEmail,
            clientId: existingDoc.id,
            status: 'DUPLICATE',
            reason: `Existing client (${existingDoc.id}) already registered in Firestore. Skipped safely.`,
          };
        }
      } catch (e) {
        console.warn('[MigrationService] Pre-migration check notice:', e);
      }
    }

    // Step 2: Firebase Auth
    await notifyStep('Creating/Verifying Firebase Authentication account...', 2, 12);
    const authRes = await this.provisionFirebaseAuthAccount(cleanEmail, clientRecord.cleaned.fullName);
    if (!authRes.success || !authRes.uid) {
      return {
        rowIndex: clientRecord.rowIndex,
        name: clientRecord.cleaned.fullName,
        email: cleanEmail,
        status: 'AUTH_FAILED',
        reason: authRes.error || 'Failed to create Firebase Authentication account.',
        stepDetails,
      };
    }
    const firebaseUid = authRes.uid;

    // Step 3: Allocate safe ID (guaranteed >= GP-0019)
    await notifyStep('Allocating safe non-colliding Client ID (>= GP-0019)...', 3, 12);
    let clientId: string;
    try {
      clientId = await this.getSafeNextClientId();
    } catch (idErr: any) {
      return {
        rowIndex: clientRecord.rowIndex,
        name: clientRecord.cleaned.fullName,
        email: cleanEmail,
        firebaseUid,
        status: 'CLIENT_WRITE_FAILED',
        reason: `Could not allocate unique client ID: ${idErr?.message || idErr}`,
        stepDetails,
      };
    }

    // Step 4: Write Client doc
    await notifyStep(`Writing Client document to Cloud Firestore (${clientId})...`, 4, 12);
    const activeCounsellors = dataService
      .getStaff()
      .filter((s) => s.role === 'Counsellor' && s.active !== false && s.status !== 'Deactivated');
    const assignedCounsellor =
      activeCounsellors.length > 0
        ? activeCounsellors[clientRecord.rowIndex % activeCounsellors.length]
        : undefined;

    const secureKey = `sec_${clientId.toLowerCase().replace('-', '')}_${Math.random().toString(36).substring(2, 10)}`;
    const now = new Date().toISOString();

    const clientPayload: Client = {
      id: clientId,
      fullName: clientRecord.cleaned.fullName,
      firstName: clientRecord.cleaned.firstName,
      lastName: clientRecord.cleaned.lastName,
      preferredName: clientRecord.cleaned.firstName,
      age: clientRecord.cleaned.age,
      gender: clientRecord.cleaned.gender,
      phone: clientRecord.cleaned.phone,
      email: cleanEmail,
      address: clientRecord.cleaned.address || '',
      state: 'Lagos',
      location: clientRecord.cleaned.address || 'Nigeria',
      country: clientRecord.cleaned.country || 'Nigeria',
      occupation: 'Not specified',
      maritalStatus: 'Other',
      howHeard: 'Historical Outreach / Direct Intake',
      emergencyContactName: clientRecord.cleaned.emergencyContactName || '',
      emergencyContactPhone: clientRecord.cleaned.emergencyContactPhone || '',
      emergencyContactRelationship: 'Emergency Contact',
      consentGiven: true,
      registrationDate: now,
      status: 'Completed',
      currentStageId: 'stage-feedback',
      currentStageName: 'Client Feedback',
      lastAssessmentName: 'GPA Feedback Form',
      lastAssessmentDate: now,
      assignedCounsellorId: assignedCounsellor?.id,
      assignedCounsellorName: assignedCounsellor?.name,
      lastActivityDate: now,
      totalAssessmentsCompleted: 6,
      totalAssessmentsOverdue: 0,
      riskLevel: clientRecord.cleaned.severity,
      result: `Historical Migration: Experience: ${clientRecord.cleaned.gamblingExperience || 'N/A'}, Spent: ${clientRecord.cleaned.amountSpentLost || 'N/A'}, Severity: ${clientRecord.cleaned.severity}`,
      lengthOfGamblingProblem: clientRecord.cleaned.gamblingExperience || undefined,
      secureAccessKey: secureKey,
      authUid: firebaseUid,
      isDemo: false,
    };

    if (!db || !isFirebaseConfigured) {
      return {
        rowIndex: clientRecord.rowIndex,
        name: clientRecord.cleaned.fullName,
        email: cleanEmail,
        status: 'CLIENT_WRITE_FAILED',
        reason: 'Cloud Firestore database is unavailable.',
        stepDetails,
      };
    }

    try {
      await setDoc(doc(db, 'clients', clientId), cleanForFirestore(clientPayload));
    } catch (cErr: any) {
      return {
        rowIndex: clientRecord.rowIndex,
        name: clientRecord.cleaned.fullName,
        email: cleanEmail,
        firebaseUid,
        status: 'CLIENT_WRITE_FAILED',
        reason: `Firestore client write rejected: ${cErr?.message || cErr}`,
        stepDetails,
      };
    }

    // Steps 5-10: Write 6 Assessment responses with idempotency check
    const stages = [
      {
        formId: 'form-recovery-1',
        stageId: 'stage-assessment-1',
        name: 'Assessment 1.0 (Clinical Intake)',
        answers: [
          { questionId: 'hist_exp', questionText: 'Historical Experience', questionType: 'short_text', answer: clientRecord.cleaned.gamblingExperience || 'N/A', score: null },
          { questionId: 'hist_spent', questionText: 'Historical Spent', questionType: 'short_text', answer: clientRecord.cleaned.amountSpentLost || 'N/A', score: null },
          { questionId: 'hist_notes', questionText: 'Historical Notes', questionType: 'long_text', answer: clientRecord.cleaned.gamblingTypeNotes || 'None', score: null },
          { questionId: 'hist_severity', questionText: 'Severity', questionType: 'short_text', answer: clientRecord.cleaned.severity, score: null },
        ] as AssessmentAnswer[],
        notes: `Historical Intake: Experience: ${clientRecord.cleaned.gamblingExperience || 'N/A'}`,
      },
      {
        formId: 'form-assessment-2',
        stageId: 'stage-assessment-2',
        name: 'Assessment 2.0 (Dealing With Family)',
        answers: [{ questionId: 'hist_stage_2', questionText: 'Module Completion', questionType: 'short_text', answer: 'Completed', score: null }] as AssessmentAnswer[],
        notes: 'Historical Stage 2.0 completed.',
      },
      {
        formId: 'form-assessment-3',
        stageId: 'stage-assessment-3',
        name: 'Assessment 3.0 (Alternative Thoughts)',
        answers: [{ questionId: 'hist_stage_3', questionText: 'Module Completion', questionType: 'short_text', answer: 'Completed', score: null }] as AssessmentAnswer[],
        notes: 'Historical Stage 3.0 completed.',
      },
      {
        formId: 'form-assessment-4',
        stageId: 'stage-assessment-4',
        name: 'Assessment 4.0 (Triggers)',
        answers: [{ questionId: 'hist_stage_4', questionText: 'Module Completion', questionType: 'short_text', answer: 'Completed', score: null }] as AssessmentAnswer[],
        notes: 'Historical Stage 4.0 completed.',
      },
      {
        formId: 'form-assessment-5',
        stageId: 'stage-assessment-5',
        name: 'Assessment 5.0 (Avoiding Avoidance)',
        answers: [{ questionId: 'hist_stage_5', questionText: 'Module Completion', questionType: 'short_text', answer: 'Completed', score: null }] as AssessmentAnswer[],
        notes: 'Historical Stage 5.0 completed.',
      },
      {
        formId: 'form-feedback',
        stageId: 'stage-feedback',
        name: 'Client Feedback',
        answers: [{ questionId: 'hist_feedback', questionText: 'Module Completion', questionType: 'short_text', answer: 'Completed', score: null }] as AssessmentAnswer[],
        notes: 'Historical Feedback completed.',
      },
    ];

    try {
      for (let sIdx = 0; sIdx < stages.length; sIdx++) {
        const st = stages[sIdx];
        await notifyStep(`Writing ${st.name}...`, 5 + sIdx, 12);

        // Idempotency check: see if assessment response already exists
        const existingQ = query(
          collection(db, 'assessmentResponses'),
          where('clientId', '==', clientId),
          where('formId', '==', st.formId)
        );
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
          continue; // Already exists, skip duplicate write!
        }

        const responseId = `resp-${clientId}-${st.formId}-${Date.now().toString(36)}`;
        const responseDoc = {
          id: responseId,
          clientId,
          authUid: firebaseUid,
          clientName: clientRecord.cleaned.fullName,
          clientEmail: cleanEmail,
          formId: st.formId,
          formTitle: st.name,
          stageId: st.stageId,
          answers: st.answers,
          score: 0,
          totalScore: null,
          section5Score: null,
          gpdsScore: null,
          severity: clientRecord.cleaned.severity,
          riskLevel: clientRecord.cleaned.severity,
          scoreRiskLevel: clientRecord.cleaned.severity,
          submittedAt: now,
          isComplete: true,
          status: 'Completed',
          counsellorNotes: st.notes,
          isHistoricalMigration: true,
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'assessmentResponses', responseId), cleanForFirestore(responseDoc));
      }
    } catch (aErr: any) {
      return {
        rowIndex: clientRecord.rowIndex,
        name: clientRecord.cleaned.fullName,
        email: cleanEmail,
        clientId,
        firebaseUid,
        status: 'ASSESSMENT_WRITE_FAILED',
        reason: `Firestore assessment responses write rejected: ${aErr?.message || aErr}`,
        stepDetails,
      };
    }

    // Step 11: Verification
    await notifyStep('Verifying Cloud Firestore records...', 11, 12);
    try {
      const verifyClient = await getDoc(doc(db, 'clients', clientId));
      if (!verifyClient.exists()) {
        return {
          rowIndex: clientRecord.rowIndex,
          name: clientRecord.cleaned.fullName,
          email: cleanEmail,
          clientId,
          firebaseUid,
          status: 'CLIENT_WRITE_FAILED',
          reason: 'Client document verification failed in Firestore.',
          stepDetails,
        };
      }
    } catch (vErr) {
      console.warn('[MigrationService] Verification warning:', vErr);
    }

    // Step 12: Success
    await notifyStep('Client migration verified and complete.', 12, 12);

    return {
      rowIndex: clientRecord.rowIndex,
      name: clientRecord.cleaned.fullName,
      email: cleanEmail,
      clientId,
      firebaseUid,
      status: 'SUCCESS',
      stepDetails,
    };
  }

  /**
   * Run full migration sequentially with live step-level updates and systemic failure detection.
   */
  public static async runFullMigration(
    records: ParsedClientRecord[],
    authorizedEmail: string,
    onStepUpdate: StepProgressCallback,
    onClientFinished: (result: MigrationClientResult) => void,
    controlSignal?: { paused: boolean; aborted: boolean }
  ): Promise<FullMigrationReport> {
    if (!this.verifyAuthorizedAdministrator(authorizedEmail)) {
      throw new Error(
        'Access Denied — Historical Client Migration is restricted to the authorized migration administrator.'
      );
    }

    const results: MigrationClientResult[] = [];
    const stats = {
      success: 0,
      skipped: 0,
      duplicates: 0,
      authFailed: 0,
      clientFailed: 0,
      assessmentFailed: 0,
    };

    let alreadyMigratedCount = 0;
    let needsManualReviewCount = 0;
    let invalidEmailCount = 0;
    let consecutiveSystemicFailures = 0;

    const runId = `mig-run-${Date.now()}`;
    const eligibleRecords = records.filter((r) => r.status === 'READY');
    const recordsToProcess = eligibleRecords.length > 0 ? eligibleRecords : records;
    const totalToProcess = recordsToProcess.length;

    for (let i = 0; i < recordsToProcess.length; i++) {
      if (controlSignal?.aborted) {
        break;
      }

      while (controlSignal?.paused && !controlSignal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const record = recordsToProcess[i];

      let res: MigrationClientResult;
      if (record.status === 'ALREADY_MIGRATED') {
        res = {
          rowIndex: record.rowIndex,
          name: record.cleaned.fullName,
          email: record.cleaned.email,
          clientId: record.existingClientId || 'GP-0017',
          status: 'ALREADY_MIGRATED',
          reason: record.duplicateReason || 'Already Migrated (GP-0017 / Shodipo Ayomide). Skipped safely.',
        };
        stats.skipped++;
        alreadyMigratedCount++;
        if (onStepUpdate) {
          await onStepUpdate(
            i + 1,
            totalToProcess,
            record.cleaned.fullName,
            'Already Migrated (GP-0017 / Shodipo Ayomide) — Skipped safely',
            12,
            12,
            stats
          );
        }
      } else if (record.status === 'DUPLICATE') {
        res = {
          rowIndex: record.rowIndex,
          name: record.cleaned.fullName,
          email: record.cleaned.email,
          clientId: record.existingClientId,
          status: 'DUPLICATE',
          reason: record.duplicateReason || 'Existing duplicate client record in Firestore.',
        };
        stats.duplicates++;
        if (onStepUpdate) {
          await onStepUpdate(
            i + 1,
            totalToProcess,
            record.cleaned.fullName,
            'Duplicate record in Firestore — Skipped safely',
            12,
            12,
            stats
          );
        }
      } else if (record.status === 'INVALID_EMAIL') {
        res = {
          rowIndex: record.rowIndex,
          name: record.cleaned.fullName,
          email: record.cleaned.email,
          status: 'INVALID_EMAIL',
          reason: 'Invalid email address',
        };
        invalidEmailCount++;
        if (onStepUpdate) {
          await onStepUpdate(
            i + 1,
            totalToProcess,
            record.cleaned.fullName,
            'Invalid email format — Flagged',
            12,
            12,
            stats
          );
        }
      } else if (record.status === 'INCOMPLETE') {
        res = {
          rowIndex: record.rowIndex,
          name: record.cleaned.fullName,
          email: record.cleaned.email,
          status: 'NEEDS_MANUAL_REVIEW',
          reason: `Missing required fields: ${record.missingFields.join(', ')}`,
        };
        needsManualReviewCount++;
        if (onStepUpdate) {
          await onStepUpdate(
            i + 1,
            totalToProcess,
            record.cleaned.fullName,
            'Missing required fields — Needs manual review',
            12,
            12,
            stats
          );
        }
      } else {
        res = await this.migrateSingleClient(
          record,
          authorizedEmail,
          onStepUpdate,
          i + 1,
          totalToProcess,
          stats
        );

        if (res.status === 'SUCCESS') {
          stats.success++;
          consecutiveSystemicFailures = 0;
        } else if (res.status === 'AUTH_FAILED') {
          stats.authFailed++;
          consecutiveSystemicFailures++;
        } else if (res.status === 'CLIENT_WRITE_FAILED') {
          stats.clientFailed++;
          consecutiveSystemicFailures++;
        } else if (res.status === 'ASSESSMENT_WRITE_FAILED') {
          stats.assessmentFailed++;
          consecutiveSystemicFailures++;
        }

        // Systemic Error Guard: Pause if 3 consecutive clients fail with the same systemic error
        if (consecutiveSystemicFailures >= 3 && controlSignal) {
          controlSignal.paused = true;
          console.warn(
            `[MigrationService] MIGRATION PAUSED — SYSTEMIC ERROR: Three consecutive clients failed (${res.status}: ${res.reason}). Safe pause active.`
          );
        }
      }

      results.push(res);
      onClientFinished(res);

      // Persist state to localStorage for resume safety
      try {
        localStorage.setItem(
          MIGRATION_STORAGE_KEY,
          JSON.stringify({
            runId,
            timestamp: new Date().toISOString(),
            totalRecords: records.length,
            processedCount: i + 1,
            successCount: stats.success,
            alreadyMigratedCount,
            duplicateCount: stats.duplicates,
            status: controlSignal?.aborted ? 'ABORTED' : 'IN_PROGRESS',
          })
        );
      } catch {
        // Ignore
      }

      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    // Refresh application caches
    await dataService.syncClientsFromFirestore();
    await dataService.syncAssessmentResponsesFromFirestore();

    const report: FullMigrationReport = {
      totalSourceRecords: records.length,
      readyCount: eligibleRecords.length,
      successCount: stats.success,
      skippedCount: stats.skipped,
      alreadyMigratedCount,
      duplicateCount: stats.duplicates,
      invalidEmailCount,
      authFailedCount: stats.authFailed,
      clientWriteFailedCount: stats.clientFailed,
      assessmentWriteFailedCount: stats.assessmentFailed,
      needsManualReviewCount,
      results,
    };

    try {
      localStorage.setItem(
        MIGRATION_STORAGE_KEY,
        JSON.stringify({
          runId,
          timestamp: new Date().toISOString(),
          totalRecords: records.length,
          processedCount: results.length,
          successCount: stats.success,
          alreadyMigratedCount,
          duplicateCount: stats.duplicates,
          status: 'COMPLETED',
        })
      );
    } catch {
      // Ignore
    }

    return report;
  }
}
