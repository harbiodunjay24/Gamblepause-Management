import { StaffUser, UserRole } from '../types';
import { SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL } from '../data/gamblepauseMaterials';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Counsellor' | 'Staff' | 'Analyst / Viewer' | 'Client';
  phone?: string;
  clientId?: string; // Set when role === 'Client'
  username?: string;
}

const STORAGE_KEYS = {
  AUTH_SESSION: 'gamblepause_auth_session',
  PASSWORDS: 'gamblepause_credential_hashes',
  CLIENT_ACCOUNTS: 'gamblepause_client_accounts',
};

// Simple cryptographic SHA-256 hashing using Web Crypto API
async function hashPassword(password: string, salt: string = 'gp_salt_2026'): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface StoredCredential {
  usernameOrEmail: string;
  hash: string;
  userId: string;
  role: AuthUser['role'];
  name: string;
  clientId?: string;
  active?: boolean;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private credentials: Record<string, StoredCredential> = {};
  private listeners: Set<(user: AuthUser | null) => void> = new Set();
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initialized) return;

    // Load credentials or initialize defaults
    const storedCreds = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
    if (storedCreds) {
      try {
        this.credentials = JSON.parse(storedCreds);
      } catch {
        this.credentials = {};
      }
    }

    // Default password for initial accounts is 'Gamblepause'
    const defaultHash = await hashPassword('Gamblepause');

    // Ensure Super Admin 1: Abiodun Ayodeji (Username: Abiodun.Ayodeji, Email: ayodejiharbiodun24@gmail.com)
    const superAdmin1UsernameKey = 'abiodun.ayodeji';
    const superAdmin1EmailKey = SUPER_ADMIN_EMAIL.toLowerCase();
    const admin1Cred: StoredCredential = {
      usernameOrEmail: 'Abiodun.Ayodeji',
      hash: defaultHash,
      userId: 'staff-superadmin',
      role: 'Super Admin',
      name: SUPER_ADMIN_NAME,
      active: true,
    };
    this.credentials[superAdmin1UsernameKey] = admin1Cred;
    this.credentials[superAdmin1EmailKey] = admin1Cred;

    // Ensure Super Admin 2: Ladipo Abiose (Username: Ladipo.Abiose, Email: ladipo.abiose@gamblepause.org)
    const superAdmin2UsernameKey = 'ladipo.abiose';
    const superAdmin2EmailKey = 'ladipo.abiose@gamblepause.org';
    const admin2Cred: StoredCredential = {
      usernameOrEmail: 'Ladipo.Abiose',
      hash: defaultHash,
      userId: 'staff-superadmin-2',
      role: 'Super Admin',
      name: 'Ladipo Abiose',
      active: true,
    };
    this.credentials[superAdmin2UsernameKey] = admin2Cred;
    this.credentials[superAdmin2EmailKey] = admin2Cred;

    // Official Counsellor 1: Benjamin
    const counsellorBenUsername = 'benjamin';
    const counsellorBenEmail = 'benjamin@gamblepause.org';
    const benCred: StoredCredential = {
      usernameOrEmail: 'Benjamin',
      hash: defaultHash,
      userId: 'counsellor-benjamin',
      role: 'Counsellor',
      name: 'Benjamin',
      active: true,
    };
    this.credentials[counsellorBenUsername] = benCred;
    this.credentials[counsellorBenEmail] = benCred;

    // Official Counsellor 2: Micheal Akinniku
    const counsellorMichUsername = 'micheal.akinniku';
    const counsellorMichEmail = 'micheal.akinniku@gamblepause.org';
    const michCred: StoredCredential = {
      usernameOrEmail: 'Micheal.Akinniku',
      hash: defaultHash,
      userId: 'counsellor-micheal',
      role: 'Counsellor',
      name: 'Micheal Akinniku',
      active: true,
    };
    this.credentials[counsellorMichUsername] = michCred;
    this.credentials[counsellorMichEmail] = michCred;

    // Official Counsellor 3: Celia Badmus
    const counsellorCeliaUsername = 'celia.badmus';
    const counsellorCeliaEmail = 'celia.badmus@gamblepause.org';
    const celiaCred: StoredCredential = {
      usernameOrEmail: 'Celia.Badmus',
      hash: defaultHash,
      userId: 'counsellor-celia',
      role: 'Counsellor',
      name: 'Celia Badmus',
      active: true,
    };
    this.credentials[counsellorCeliaUsername] = celiaCred;
    this.credentials[counsellorCeliaEmail] = celiaCred;

    // Purge deprecated fake demo staff accounts
    const deprecatedAccounts = [
      'babajide.adeleke@gamblepause.org',
      'fatima.bello@gamblepause.org',
      'chidinma.okafor@gamblepause.org',
      'tariq.alhassan@gamblepause.org',
      'counsellor a',
      'counsellor b',
    ];
    deprecatedAccounts.forEach((dep) => {
      delete this.credentials[dep];
    });

    // Seed initial demo client account: Oluwaseun Adeleke (GP-0001)
    const demoClientKey = 'oluwaseun.adeleke@example.com';
    if (!this.credentials[demoClientKey]) {
      this.credentials[demoClientKey] = {
        usernameOrEmail: 'oluwaseun.adeleke@example.com',
        hash: defaultHash,
        userId: 'client-gp0001',
        role: 'Client',
        name: 'Oluwaseun Adeleke',
        clientId: 'GP-0001',
      };
      this.credentials['gp-0001'] = {
        usernameOrEmail: 'GP-0001',
        hash: defaultHash,
        userId: 'client-gp0001',
        role: 'Client',
        name: 'Oluwaseun Adeleke',
        clientId: 'GP-0001',
      };
    }

    this.saveCredentials();

    // Load active session from sessionStorage (destroyed on tab close)
    const storedSession = sessionStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    if (storedSession) {
      try {
        this.currentUser = JSON.parse(storedSession);
      } catch {
        this.currentUser = null;
      }
    }

    this.initialized = true;
    this.notify();
  }

  private saveCredentials() {
    try {
      localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(this.credentials));
    } catch (e) {
      console.error('Failed to save credentials', e);
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }

  public subscribe(listener: (user: AuthUser | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  public isSuperAdmin(): boolean {
    return this.currentUser?.role === 'Super Admin';
  }

  public isCounsellor(): boolean {
    return this.currentUser?.role === 'Counsellor' || this.currentUser?.role === 'Super Admin';
  }

  public isStaff(): boolean {
    return (
      this.currentUser?.role === 'Staff' ||
      this.currentUser?.role === 'Counsellor' ||
      this.currentUser?.role === 'Super Admin'
    );
  }

  public isClient(): boolean {
    return this.currentUser?.role === 'Client';
  }

  /**
   * Secure authentication with backend verification and local fallback
   */
  public async login(
    identifier: string,
    passwordAttempt: string,
    targetPortal?: 'admin' | 'counsellor' | 'client'
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    // 1. Attempt authentication against the shared backend database for cross-device consistency
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: identifier.trim(),
          password: passwordAttempt,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success && data.user) {
        const user: AuthUser = data.user;

        // Portal validation checks
        if (targetPortal === 'admin' && user.role !== 'Super Admin' && user.role !== 'Staff' && user.role !== 'Counsellor') {
          return {
            success: false,
            error: 'Access Denied: This account is not authorized for administrative access.',
          };
        }
        if (targetPortal === 'counsellor' && user.role !== 'Counsellor' && user.role !== 'Super Admin') {
          return {
            success: false,
            error: 'Access Denied: Counsellor credentials required.',
          };
        }
        if (targetPortal === 'client' && user.role !== 'Client') {
          return {
            success: false,
            error: 'This account is a Staff/Admin account. Please use the Admin & Staff Login.',
          };
        }

        this.currentUser = user;
        sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(user));
        this.notify();
        return { success: true, user };
      } else if (response.status === 401 || response.status === 403) {
        return { success: false, error: data.error || 'Invalid login credentials.' };
      }
    } catch (err) {
      console.warn('[authService] Backend login unavailable, verifying with local credentials:', err);
    }

    // 2. Fallback to local credential cache
    await this.init();

    const cleanId = identifier.trim().toLowerCase();
    const cred = this.credentials[cleanId];

    if (!cred) {
      return {
        success: false,
        error: 'Invalid login credentials. Please check your username/email and try again.',
      };
    }

    const attemptHash = await hashPassword(passwordAttempt);
    if (attemptHash !== cred.hash) {
      return {
        success: false,
        error: 'Incorrect password. Please verify your password.',
      };
    }

    if (cred.active === false) {
      return {
        success: false,
        error: 'This account has been deactivated. Please contact a GamblePause Super User for assistance.',
      };
    }

    // Portal validation checks
    if (targetPortal === 'admin' && cred.role !== 'Super Admin' && cred.role !== 'Staff' && cred.role !== 'Counsellor') {
      return {
        success: false,
        error: 'Access Denied: This account is not authorized for administrative access.',
      };
    }

    if (targetPortal === 'counsellor' && cred.role !== 'Counsellor' && cred.role !== 'Super Admin') {
      return {
        success: false,
        error: 'Access Denied: Counsellor credentials required.',
      };
    }

    if (targetPortal === 'client' && cred.role !== 'Client') {
      return {
        success: false,
        error: 'This account is a Staff/Admin account. Please use the Admin & Staff Login.',
      };
    }

    const user: AuthUser = {
      id: cred.userId,
      name: cred.name,
      email: cred.usernameOrEmail,
      role: cred.role,
      clientId: cred.clientId,
      username: cred.usernameOrEmail,
    };

    this.currentUser = user;
    sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(user));
    this.notify();

    return { success: true, user };
  }

  /**
   * Log out active user and clear session immediately
   */
  public logout(): void {
    this.currentUser = null;
    sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
    this.notify();
  }

  /**
   * Change password for the currently logged-in user
   */
  public async changePassword(
    currentPasswordAttempt: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentUser) {
      return { success: false, error: 'No active user session.' };
    }

    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    const userEmailKey = this.currentUser.email.toLowerCase();
    const userCred = this.credentials[userEmailKey];

    if (!userCred) {
      return { success: false, error: 'User credential record not found.' };
    }

    const currentHash = await hashPassword(currentPasswordAttempt);
    if (currentHash !== userCred.hash) {
      return { success: false, error: 'Current password does not match.' };
    }

    const newHash = await hashPassword(newPassword);

    // Update all matching identifier keys for this user
    Object.keys(this.credentials).forEach((key) => {
      if (this.credentials[key].userId === this.currentUser!.id) {
        this.credentials[key].hash = newHash;
      }
    });

    this.saveCredentials();

    // Sync password change to backend
    try {
      fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: this.currentUser.username || this.currentUser.email,
          currentPassword: currentPasswordAttempt,
          newPassword,
        }),
      }).catch((e) => console.warn('[authService] Backend change-password sync error:', e));
    } catch (e) {
      console.warn('[authService] Fetch change-password exception:', e);
    }

    return { success: true };
  }

  /**
   * Register client credentials upon intake submission
   */
  public async registerClientCredentials(
    clientId: string,
    email: string,
    firstName: string,
    lastName: string,
    password?: string
  ): Promise<void> {
    await this.init();

    // Default password or custom client password
    const pwd = password?.trim() || 'Gamblepause';
    const hash = await hashPassword(pwd);

    const emailKey = email.toLowerCase().trim();
    const idKey = clientId.toLowerCase().trim();

    const cred: StoredCredential = {
      usernameOrEmail: email,
      hash,
      userId: `client-${clientId.toLowerCase()}`,
      role: 'Client',
      name: `${firstName} ${lastName}`.trim(),
      clientId,
    };

    this.credentials[emailKey] = cred;
    this.credentials[idKey] = cred;
    this.saveCredentials();

    // Sync client credentials to backend
    try {
      fetch('/api/auth/register-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { id: clientId, email, firstName, lastName },
          password: pwd,
        }),
      }).catch((e) => console.warn('[authService] Backend register-client sync error:', e));
    } catch (e) {
      console.warn('[authService] Fetch register-client exception:', e);
    }
  }

  /**
   * Super Admin creates a new staff/counsellor account
   */
  public async createStaffAccount(
    staffUser: StaffUser,
    temporaryPassword: string = 'Gamblepause'
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isSuperAdmin()) {
      return { success: false, error: 'Unauthorized: Only Super Admin can create staff accounts.' };
    }

    const emailKey = staffUser.email.toLowerCase().trim();
    if (this.credentials[emailKey]) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const hash = await hashPassword(temporaryPassword);
    this.credentials[emailKey] = {
      usernameOrEmail: staffUser.email,
      hash,
      userId: staffUser.id,
      role: staffUser.role,
      name: staffUser.name,
      active: true,
    };
    this.saveCredentials();

    // Sync new staff to backend
    try {
      fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffUser),
      }).catch((e) => console.warn('[authService] Backend staff create sync error:', e));
    } catch (e) {
      console.warn('[authService] Fetch staff create exception:', e);
    }

    // Also index by username if applicable
    const usernameKey = staffUser.name.replace(/\s+/g, '.').toLowerCase();
    this.credentials[usernameKey] = {
      usernameOrEmail: staffUser.name.replace(/\s+/g, '.'),
      hash,
      userId: staffUser.id,
      role: staffUser.role,
      name: staffUser.name,
      active: true,
    };

    this.saveCredentials();
    return { success: true };
  }

  /**
   * Toggle staff account active status
   */
  public toggleStaffStatus(userId: string, active: boolean): void {
    Object.keys(this.credentials).forEach((k) => {
      if (this.credentials[k].userId === userId) {
        this.credentials[k].active = active;
      }
    });
    this.saveCredentials();
  }

  /**
   * Super User resets password for a staff/counsellor account
   */
  public async resetStaffPassword(
    userId: string,
    temporaryPassword: string = 'Gamblepause'
  ): Promise<boolean> {
    const newHash = await hashPassword(temporaryPassword);
    let found = false;
    Object.keys(this.credentials).forEach((k) => {
      if (this.credentials[k].userId === userId) {
        this.credentials[k].hash = newHash;
        found = true;
      }
    });
    if (found) {
      this.saveCredentials();
    }
    return found;
  }

  /**
   * Super User deletes a staff/counsellor account
   */
  public deleteStaffAccount(userId: string): void {
    Object.keys(this.credentials).forEach((k) => {
      if (this.credentials[k].userId === userId) {
        delete this.credentials[k];
      }
    });
    this.saveCredentials();
  }
}

export const authService = new AuthService();
