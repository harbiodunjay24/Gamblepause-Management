import { StaffUser, UserRole } from '../types';
import { SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL } from '../data/gamblepauseMaterials';
import { auth, db } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

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

    // Listen for Firebase Auth changes to keep state in sync across tabs and refreshes
    try {
      onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          const cleanEmail = (fbUser.email || '').toLowerCase().trim();
          let role: AuthUser['role'] = 'Client';

          if (
            cleanEmail === 'ayodejiharbiodun24@gmail.com' ||
            cleanEmail === 'ladipo.abiose@gamblepause.org'
          ) {
            role = 'Super Admin';
          } else if (
            cleanEmail === 'benjamin@gamblepause.org' ||
            cleanEmail === 'micheal.akinniku@gamblepause.org' ||
            cleanEmail === 'celia.badmus@gamblepause.org'
          ) {
            role = 'Counsellor';
          } else if (cleanEmail.endsWith('@gamblepause.org')) {
            role = 'Staff';
          }

          let clientId: string | undefined = undefined;
          let displayName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';

          if (db) {
            try {
              const uDoc = await getDoc(doc(db, 'users', fbUser.uid));
              if (uDoc.exists()) {
                const uData = uDoc.data();
                if (uData.role) role = uData.role;
                if (uData.name) displayName = uData.name;
              }

              // Look up client by authUid where client.authUid == fbUser.uid
              if (role === 'Client') {
                const q = query(collection(db, 'clients'), where('authUid', '==', fbUser.uid));
                const cSnap = await getDocs(q);
                if (!cSnap.empty) {
                  const cDoc = cSnap.docs[0];
                  clientId = cDoc.id;
                  const cData = cDoc.data();
                  if (cData.firstName) {
                    displayName = `${cData.firstName} ${cData.lastName || ''}`.trim();
                  }
                }
              }
            } catch (e) {
              // Ignore
            }
          }

          const authUser: AuthUser = {
            id: fbUser.uid,
            name: displayName,
            email: fbUser.email || '',
            role: role,
            clientId: clientId,
            username: fbUser.email?.split('@')[0],
          };

          this.currentUser = authUser;
          sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(authUser));
          this.notify();
        }
      });
    } catch (e) {
      console.warn('[authService] onAuthStateChanged listener notice:', e);
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
   * Firebase Authentication user registration with email and password
   */
  public async firebaseRegister(
    email: string,
    password: string,
    name?: string,
    role: AuthUser['role'] = 'Client'
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'PASSWORD OR EMAIL INCORRECT' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const fbUser = cred.user;
      const displayName = name?.trim() || cleanEmail.split('@')[0];

      // Update Firebase Auth profile display name
      try {
        await updateProfile(fbUser, { displayName });
      } catch (profileErr) {
        console.warn('[authService] updateProfile notice:', profileErr);
      }

      // Save user profile to Firestore
      if (db) {
        try {
          await setDoc(
            doc(db, 'users', fbUser.uid),
            {
              id: fbUser.uid,
              name: displayName,
              email: cleanEmail,
              role: role,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (firestoreErr) {
          console.warn('[authService] Firestore user profile sync notice:', firestoreErr);
        }
      }

      const authUser: AuthUser = {
        id: fbUser.uid,
        name: displayName,
        email: fbUser.email || cleanEmail,
        role: role,
        username: cleanEmail.split('@')[0],
      };

      this.currentUser = authUser;
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(authUser));
      this.notify();

      return { success: true, user: authUser };
    } catch (err: any) {
      console.warn('[authService] Firebase registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        return { success: false, error: 'USER ALREADY EXISTS ,SIGN IN' };
      }
      if (err.code === 'auth/weak-password') {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }
      if (err.code === 'auth/invalid-email') {
        return { success: false, error: 'PASSWORD OR EMAIL INCORRECT' };
      }
      return { success: false, error: err.message || 'Registration failed. Please try again.' };
    }
  }

  /**
   * Firebase Authentication user login with email and password
   */
  public async firebaseLogin(
    email: string,
    password: string,
    targetPortal?: 'admin' | 'counsellor' | 'client'
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'PASSWORD OR EMAIL INCORRECT' };
    }
    if (!password) {
      return { success: false, error: 'PASSWORD OR EMAIL INCORRECT' };
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const fbUser = cred.user;

      let role: AuthUser['role'] = 'Client';
      if (
        cleanEmail === 'ayodejiharbiodun24@gmail.com' ||
        cleanEmail === 'ladipo.abiose@gamblepause.org'
      ) {
        role = 'Super Admin';
      } else if (
        cleanEmail === 'benjamin@gamblepause.org' ||
        cleanEmail === 'micheal.akinniku@gamblepause.org' ||
        cleanEmail === 'celia.badmus@gamblepause.org'
      ) {
        role = 'Counsellor';
      } else if (cleanEmail.endsWith('@gamblepause.org')) {
        role = 'Staff';
      }

      let clientId: string | undefined = undefined;
      let displayName = fbUser.displayName || cleanEmail.split('@')[0];

      if (db) {
        try {
          const uDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (uDoc.exists()) {
            const uData = uDoc.data();
            if (uData.role) role = uData.role;
            if (uData.name) displayName = uData.name;
          }

          // Authoritative lookup: find Firestore client where client.authUid == fbUser.uid
          if (role === 'Client') {
            const q = query(collection(db, 'clients'), where('authUid', '==', fbUser.uid));
            const cSnap = await getDocs(q);
            if (!cSnap.empty) {
              const cDoc = cSnap.docs[0];
              clientId = cDoc.id;
              const cData = cDoc.data();
              if (cData.firstName) {
                displayName = `${cData.firstName} ${cData.lastName || ''}`.trim();
              }
            }
          }
        } catch (e) {
          console.warn('[authService] Client lookup notice:', e);
        }
      }

      // Check portal restrictions
      if (targetPortal === 'admin' && role !== 'Super Admin' && role !== 'Staff' && role !== 'Counsellor') {
        return {
          success: false,
          error: 'Access Denied: This account is not authorized for administrative access.',
        };
      }
      if (targetPortal === 'counsellor' && role !== 'Counsellor' && role !== 'Super Admin') {
        return {
          success: false,
          error: 'Access Denied: Counsellor credentials required.',
        };
      }
      if (targetPortal === 'client' && role !== 'Client') {
        return {
          success: false,
          error: 'This account is a Staff/Admin account. Please use the Admin & Staff Login.',
        };
      }

      const authUser: AuthUser = {
        id: fbUser.uid,
        name: displayName,
        email: fbUser.email || cleanEmail,
        role: role,
        clientId: clientId,
        username: cleanEmail.split('@')[0],
      };

      this.currentUser = authUser;
      sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(authUser));
      this.notify();

      return { success: true, user: authUser };
    } catch (err: any) {
      console.warn('[authService] Firebase login error:', err);
      // As requested: IF EMAIL / PASSWORD ARE INCORRECT DISPLAY "PASSWORD OR EMAIL INCORRECT"
      return { success: false, error: 'PASSWORD OR EMAIL INCORRECT' };
    }
  }

  /**
   * Secure authentication with Firebase Auth first, followed by backend verification and local fallback
   */
  public async login(
    identifier: string,
    passwordAttempt: string,
    targetPortal?: 'admin' | 'counsellor' | 'client'
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const trimmedId = identifier.trim();

    // 1. If identifier is an email, authenticate via Firebase Authentication
    if (trimmedId.includes('@')) {
      const fbResult = await this.firebaseLogin(trimmedId, passwordAttempt, targetPortal);
      if (fbResult.success) {
        return fbResult;
      }
      // If Firebase Auth returned invalid credentials, check if it exists in local seeded fallback (e.g. for offline dev)
      const cleanId = trimmedId.toLowerCase();
      const localCred = this.credentials[cleanId];
      if (localCred) {
        const attemptHash = await hashPassword(passwordAttempt);
        if (attemptHash === localCred.hash) {
          const user: AuthUser = {
            id: localCred.userId,
            name: localCred.name,
            email: localCred.usernameOrEmail,
            role: localCred.role,
            clientId: localCred.clientId,
            username: localCred.usernameOrEmail,
          };
          this.currentUser = user;
          sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(user));
          this.notify();
          return { success: true, user };
        }
      }
      // Otherwise return user-specified exact error message
      return { success: false, error: 'PASSWORD OR EMAIL INCORRECT' };
    }

    // 2. Attempt authentication against the shared backend database for cross-device consistency
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usernameOrEmail: trimmedId,
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
        return { success: false, error: data.error || 'PASSWORD OR EMAIL INCORRECT' };
      }
    } catch (err) {
      console.warn('[authService] Backend login unavailable, verifying with local credentials:', err);
    }

    // 3. Fallback to local credential cache
    await this.init();

    const cleanId = trimmedId.toLowerCase();
    const cred = this.credentials[cleanId];

    if (!cred) {
      return {
        success: false,
        error: 'PASSWORD OR EMAIL INCORRECT',
      };
    }

    const attemptHash = await hashPassword(passwordAttempt);
    if (attemptHash !== cred.hash) {
      return {
        success: false,
        error: 'PASSWORD OR EMAIL INCORRECT',
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
  public async logout(): Promise<void> {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('[authService] Firebase signOut notice:', e);
    }
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
