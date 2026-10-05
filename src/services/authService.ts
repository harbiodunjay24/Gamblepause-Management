import { StaffUser, UserRole } from '../types';
import { SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL } from '../data/gamblepauseMaterials';
import { auth, db, firebaseConfig, isFirebaseConfigured } from '../lib/firebase';
import { initializeApp, getApps } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
  updateEmail,
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
  onSnapshot as onFirestoreSnapshot,
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
  private sessionUnsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initialized) return;

    // Purge any stored staff passwords from localStorage to ensure Firebase Auth is sole source of truth
    try {
      localStorage.removeItem(STORAGE_KEYS.PASSWORDS);
    } catch {
      // Ignore
    }
    this.credentials = {};

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
            cleanEmail === 'ladipo.abiose@gamblepause.org' ||
            cleanEmail === 'stevobenjo@gmail.com'
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
          const canonicalCounsellorNames: Record<string, string> = {
            'benjamin@gamblepause.org': 'Benjamin',
            'micheal.akinniku@gamblepause.org': 'Micheal Akinniku',
            'celia.badmus@gamblepause.org': 'Celia Badmus',
          };
          let displayName =
            canonicalCounsellorNames[cleanEmail] ||
            fbUser.displayName ||
            fbUser.email?.split('@')[0] ||
            'User';
          let isDeactivated = false;

          if (db) {
            try {
              const uDoc = await getDoc(doc(db, 'users', fbUser.uid));
              if (uDoc.exists()) {
                const uData = uDoc.data();
                if (uData.role) role = uData.role;
                if (uData.name) displayName = uData.name;
                if (uData.active === false || uData.status === 'Deactivated') {
                  isDeactivated = true;
                }
              }

              // Also check staff collection for counsellors/staff
              if (!isDeactivated && role !== 'Client') {
                const qStaff = query(collection(db, 'staff'), where('email', '==', cleanEmail));
                const sSnap = await getDocs(qStaff);
                if (!sSnap.empty) {
                  const sData = sSnap.docs[0].data();
                  if (sData.active === false || sData.status === 'Deactivated') {
                    isDeactivated = true;
                  }
                }
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

          // DEFENSE-IN-DEPTH: Immediately terminate session if deactivated
          if (isDeactivated) {
            console.warn('[authService] Deactivated account attempted session restore. Signing out immediately.');
            await signOut(auth);
            if (this.sessionUnsubscribe) {
              this.sessionUnsubscribe();
              this.sessionUnsubscribe = null;
            }
            this.currentUser = null;
            sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
            this.notify();
            return;
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

          // Active session watchdog: detect deactivation in real-time
          if (this.sessionUnsubscribe) {
            this.sessionUnsubscribe();
            this.sessionUnsubscribe = null;
          }
          if (db) {
            this.sessionUnsubscribe = onFirestoreSnapshot(doc(db, 'users', fbUser.uid), async (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data.active === false || data.status === 'Deactivated') {
                  console.warn('[authService] Account deactivated in real-time. Immediately terminating session.');
                  await signOut(auth);
                  if (this.sessionUnsubscribe) {
                    this.sessionUnsubscribe();
                    this.sessionUnsubscribe = null;
                  }
                  this.currentUser = null;
                  sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
                  this.notify();
                  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                    window.location.href = '/admin/login?deactivated=1';
                  }
                }
              }
            });
          }

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
   * Resolve a staff username to their registered staff email address
   */
  public async resolveStaffEmail(identifier: string): Promise<string> {
    const trimmed = identifier.trim().toLowerCase();
    if (trimmed.includes('@')) {
      return trimmed;
    }

    const usernameMap: Record<string, string> = {
      'abiodun.ayodeji': 'ayodejiharbiodun24@gmail.com',
      'abiodun': 'ayodejiharbiodun24@gmail.com',
      'ayodeji': 'ayodejiharbiodun24@gmail.com',
      'ladipo.abiose': 'ladipo.abiose@gamblepause.org',
      'ladipo': 'ladipo.abiose@gamblepause.org',
      'abiose': 'ladipo.abiose@gamblepause.org',
      'benjamin': 'benjamin@gamblepause.org',
      'micheal.akinniku': 'micheal.akinniku@gamblepause.org',
      'micheal': 'micheal.akinniku@gamblepause.org',
      'celia.badmus': 'celia.badmus@gamblepause.org',
      'celia': 'celia.badmus@gamblepause.org',
    };

    if (usernameMap[trimmed]) {
      return usernameMap[trimmed];
    }

    if (db) {
      try {
        const uQ = query(collection(db, 'users'), where('username', '==', trimmed));
        const uSnap = await getDocs(uQ);
        if (!uSnap.empty) {
          const docData = uSnap.docs[0].data();
          if (docData.email) {
            return docData.email.toLowerCase().trim();
          }
        }
      } catch {
        // Ignore and fallback
      }
    }

    return `${trimmed}@gamblepause.org`;
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

    const isSuperAdminEmail =
      cleanEmail === 'ayodejiharbiodun24@gmail.com' ||
      cleanEmail === 'ladipo.abiose@gamblepause.org' ||
      cleanEmail === 'stevobenjo@gmail.com';

    try {
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (signInErr: any) {
        // If it's an initial setup Super Admin (Abiodun/Ladipo) and account does not exist in Firebase Auth yet,
        // provision it securely in Firebase Auth with the password provided on first sign-in
        if (
          (cleanEmail === 'ayodejiharbiodun24@gmail.com' || cleanEmail === 'ladipo.abiose@gamblepause.org') &&
          (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential')
        ) {
          try {
            cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
            const defaultName = cleanEmail === 'ayodejiharbiodun24@gmail.com' ? 'Abiodun Ayodeji' : 'Ladipo Abiose';
            await updateProfile(cred.user, { displayName: defaultName });
          } catch {
            throw signInErr;
          }
        } else {
          throw signInErr;
        }
      }

      const fbUser = cred.user;

      let role: AuthUser['role'] = 'Client';
      if (isSuperAdminEmail) {
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
      const canonicalCounsellorNames: Record<string, string> = {
        'benjamin@gamblepause.org': 'Benjamin',
        'micheal.akinniku@gamblepause.org': 'Micheal Akinniku',
        'celia.badmus@gamblepause.org': 'Celia Badmus',
      };
      let displayName =
        canonicalCounsellorNames[cleanEmail] ||
        fbUser.displayName ||
        cleanEmail.split('@')[0];
      let isActive = true;
      let isDeactivated = false;

      if (db) {
        try {
          const uDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (uDoc.exists()) {
            const uData = uDoc.data();
            if (uData.role) {
              role = isSuperAdminEmail ? 'Super Admin' : uData.role;
            }
            if (uData.name) displayName = uData.name;
            if (uData.active === false || uData.status === 'Deactivated') {
              isActive = false;
              isDeactivated = true;
            }
          } else if (isSuperAdminEmail) {
            // Ensure Super Admin profile exists in Firestore users/{uid}
            displayName =
              cleanEmail === 'ayodejiharbiodun24@gmail.com'
                ? 'Abiodun Ayodeji'
                : (cleanEmail === 'stevobenjo@gmail.com' ? 'Steven Benjamin' : 'Ladipo Abiose');
            await setDoc(
              doc(db, 'users', fbUser.uid),
              {
                id: fbUser.uid,
                name: displayName,
                email: cleanEmail,
                role: 'Super Admin',
                active: true,
                status: 'Active',
                authUid: fbUser.uid,
                createdAt: serverTimestamp(),
              },
              { merge: true }
            );
          }

          // Authoritative staff collection verification
          if (!isDeactivated && role !== 'Client') {
            const qStaff = query(collection(db, 'staff'), where('email', '==', cleanEmail));
            const sSnap = await getDocs(qStaff);
            if (!sSnap.empty) {
              const sData = sSnap.docs[0].data();
              if (sData.active === false || sData.status === 'Deactivated') {
                isActive = false;
                isDeactivated = true;
              }
            }
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
          console.warn('[authService] Client/user lookup notice:', e);
        }
      }

      // DEFENSE-IN-DEPTH CHECK: Deactivated accounts MUST NOT enter any protected route
      if (!isActive || isDeactivated) {
        await signOut(auth);
        if (this.sessionUnsubscribe) {
          this.sessionUnsubscribe();
          this.sessionUnsubscribe = null;
        }
        this.currentUser = null;
        sessionStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
        this.notify();
        return {
          success: false,
          error: 'Your account has been deactivated. Please contact an administrator.',
        };
      }

      // Check portal restrictions
      if (targetPortal === 'admin' && role !== 'Super Admin' && role !== 'Staff' && role !== 'Counsellor') {
        await signOut(auth);
        return {
          success: false,
          error: 'Access Denied: This account is not authorized for administrative access.',
        };
      }
      if (targetPortal === 'counsellor' && role !== 'Counsellor' && role !== 'Super Admin') {
        await signOut(auth);
        return {
          success: false,
          error: 'Access Denied: Counsellor credentials required.',
        };
      }
      if (targetPortal === 'client' && role !== 'Client') {
        await signOut(auth);
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
      if (err?.code === 'auth/user-disabled') {
        return {
          success: false,
          error: 'Your account has been deactivated. Please contact an administrator.',
        };
      }
      // As requested: IF EMAIL / PASSWORD ARE INCORRECT DISPLAY "PASSWORD OR EMAIL INCORRECT"
      return { success: false, error: 'PASSWORD OR EMAIL INCORRECT' };
    }
  }

  /**
   * Secure authentication: Staff always uses real Firebase Auth; Clients use Firebase Auth with fallback
   */
  public async login(
    identifier: string,
    passwordAttempt: string,
    targetPortal?: 'admin' | 'counsellor' | 'client'
  ): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    const trimmedId = identifier.trim();

    // 1. For Staff and Admin portals: STRICTLY authenticate with real Firebase Authentication
    // Never authenticate one person by selecting another person's profile
    // Never use localStorage/demo data to authenticate staff
    if (targetPortal === 'admin' || targetPortal === 'counsellor') {
      const email = await this.resolveStaffEmail(trimmedId);
      return this.firebaseLogin(email, passwordAttempt, targetPortal);
    }

    // 2. If identifier is an email (for Client portal)
    if (trimmedId.includes('@')) {
      return this.firebaseLogin(trimmedId, passwordAttempt, targetPortal);
    }

    // 3. If identifier is a Client ID (e.g. GP-2026-001 or GP-0001):
    // Authoritatively resolve client's registered email directly from Cloud Firestore
    let clientEmail: string | null = null;
    if (db && isFirebaseConfigured) {
      try {
        const cDoc = await getDoc(doc(db, 'clients', trimmedId));
        if (cDoc.exists() && cDoc.data()?.email) {
          clientEmail = cDoc.data().email;
        } else {
          const q = query(collection(db, 'clients'), where('id', '==', trimmedId));
          const qSnap = await getDocs(q);
          if (!qSnap.empty && qSnap.docs[0].data()?.email) {
            clientEmail = qSnap.docs[0].data().email;
          }
        }
      } catch (err) {
        console.warn('[authService] Firestore lookup for client ID notice:', err);
      }
    }

    if (clientEmail) {
      return this.firebaseLogin(clientEmail, passwordAttempt, targetPortal);
    }

    return {
      success: false,
      error: 'PASSWORD OR EMAIL INCORRECT',
    };
  }

  /**
   * Log out active user and clear session immediately
   */
  public async logout(): Promise<void> {
    if (this.sessionUnsubscribe) {
      this.sessionUnsubscribe();
      this.sessionUnsubscribe = null;
    }
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

    // 1. If user is authenticated in Firebase Auth, re-authenticate and update real Firebase password
    if (auth.currentUser && auth.currentUser.email) {
      try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPasswordAttempt);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
      } catch (fbErr: any) {
        console.warn('[authService] Firebase password change error:', fbErr);
        if (
          fbErr.code === 'auth/wrong-password' ||
          fbErr.code === 'auth/invalid-credential' ||
          fbErr.code === 'auth/invalid-login-credentials'
        ) {
          return { success: false, error: 'Current password does not match.' };
        }
        if (fbErr.code === 'auth/weak-password') {
          return { success: false, error: 'New password must be at least 6 characters long.' };
        }
        if (fbErr.code === 'auth/requires-recent-login') {
          return {
            success: false,
            error: 'Security requirement: Please sign in again before updating your password.',
          };
        }
        return { success: false, error: fbErr.message || 'Failed to update Firebase password.' };
      }
    } else {
      // 2. Offline / local credential check if not in Firebase Auth
      const userEmailKey = this.currentUser.email.toLowerCase();
      const userCred =
        this.credentials[userEmailKey] ||
        Object.values(this.credentials).find((c) => c.userId === this.currentUser!.id);

      if (userCred) {
        const currentHash = await hashPassword(currentPasswordAttempt);
        if (currentHash !== userCred.hash) {
          return { success: false, error: 'Current password does not match.' };
        }
      }
    }

    // 3. Sync password change to backend
    try {
      fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUser.id,
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
   * Send password reset email via Firebase Auth
   */
  public async sendStaffPasswordResetEmail(email: string): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'A valid email address is required.' };
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return { success: true };
    } catch (e: any) {
      console.warn('[authService] sendPasswordResetEmail notice:', e);
      return { success: false, error: e.message || 'Failed to send password reset email.' };
    }
  }

  /**
   * Allows the currently authenticated user (e.g. Super Admin) to update their own email.
   * Respects Firebase Authentication security requirements (re-authentication if needed).
   * Upon successful update, refreshes the auth profile and synchronizes users/{uid}.email.
   */
  public async updateCurrentUserEmail(
    newEmail: string,
    currentPassword?: string
  ): Promise<{ success: boolean; requiresReauth?: boolean; error?: string; message?: string }> {
    const user = auth.currentUser;
    if (!user) {
      return { success: false, error: 'No active authenticated user session.' };
    }

    const cleanEmail = (newEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (cleanEmail === (user.email || '').toLowerCase()) {
      return { success: false, error: 'New email is identical to the current email.' };
    }

    // If currentPassword is provided, attempt re-authentication first
    if (currentPassword && user.email) {
      try {
        const cred = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, cred);
      } catch (reauthErr: any) {
        return {
          success: false,
          error: `Re-authentication failed: ${reauthErr?.message || reauthErr?.code || 'Invalid password'}`,
        };
      }
    }

    try {
      try {
        await verifyBeforeUpdateEmail(user, cleanEmail);
        return {
          success: true,
          message: `Verification link sent to ${cleanEmail}. Please click the link in your inbox to confirm the Firebase Authentication email change. Once verified, return to GamblePause to sync your profile.`,
        };
      } catch (verifyErr: any) {
        if (verifyErr.code === 'auth/requires-recent-login') {
          return {
            success: false,
            requiresReauth: true,
            error: 'This operation is sensitive and requires recent authentication. Please enter your current password to proceed.',
          };
        }
        // Fallback to updateEmail if verifyBeforeUpdateEmail is not supported
        await updateEmail(user, cleanEmail);
        await user.reload();

        if (db) {
          await setDoc(
            doc(db, 'users', user.uid),
            {
              email: cleanEmail,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        if (this.currentUser && this.currentUser.id === user.uid) {
          this.currentUser.email = cleanEmail;
          sessionStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(this.currentUser));
          this.notify();
        }

        return {
          success: true,
          message: `Your email address has been successfully updated to ${cleanEmail}.`,
        };
      }
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        return {
          success: false,
          requiresReauth: true,
          error: 'This operation is sensitive and requires recent authentication. Please enter your current password to proceed.',
        };
      }
      return {
        success: false,
        error: err?.message || err?.code || 'Failed to update email in Firebase Authentication.',
      };
    }
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
   * Super Admin creates a new staff/counsellor account with real Firebase Authentication & Firestore persistence
   */
  public async createStaffAccount(
    staffUser: StaffUser,
    temporaryPassword: string = 'Gamblepause'
  ): Promise<{ success: boolean; user?: StaffUser; error?: string }> {
    if (!this.isSuperAdmin()) {
      return { success: false, error: 'Unauthorized: Only Super Admin can create staff accounts.' };
    }

    const cleanEmail = staffUser.email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'A valid email address is required.' };
    }
    if (!staffUser.name || staffUser.name.trim().length === 0) {
      return { success: false, error: 'Staff name is required.' };
    }
    if (!temporaryPassword || temporaryPassword.length < 6) {
      return { success: false, error: 'Initial password must be at least 6 characters long.' };
    }

    let firebaseUid = staffUser.id;

    // 1. Create real user in Firebase Authentication via secondary app
    // This creates the auth user without changing or logging out the Super Admin's active session!
    if (isFirebaseConfigured) {
      try {
        const secondaryAppName = 'SecondaryAdminAuthApp';
        const secondaryApp =
          getApps().find((a) => a.name === secondaryAppName) ||
          initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, temporaryPassword);
          firebaseUid = cred.user.uid;
          try {
            await updateProfile(cred.user, { displayName: staffUser.name.trim() });
          } catch (pe) {
            console.warn('[authService] Secondary auth updateProfile notice:', pe);
          }
          await signOut(secondaryAuth);
        } catch (fbErr: any) {
          if (fbErr.code === 'auth/email-already-in-use') {
            console.warn('[authService] Account already exists in Firebase Auth, linking to Firestore.');
          } else if (fbErr.code === 'auth/weak-password') {
            return { success: false, error: 'Initial password must be at least 6 characters long.' };
          } else {
            return { success: false, error: fbErr.message || 'Firebase Auth account creation failed.' };
          }
        }
      } catch (authErr: any) {
        console.error('[authService] Firebase Auth create error:', authErr);
        return { success: false, error: authErr.message || 'Firebase Auth initialization failed.' };
      }
    }

    const updatedStaffUser: StaffUser = {
      ...staffUser,
      authUid: firebaseUid,
      active: true,
    };

    // 2. Persist to Firestore: users/{firebaseUid} and staff/{staffUser.id}
    if (db && isFirebaseConfigured) {
      try {
        // Users collection record for role and auth checks
        await setDoc(
          doc(db, 'users', firebaseUid),
          {
            id: firebaseUid,
            name: staffUser.name.trim(),
            email: cleanEmail,
            phone: staffUser.phone?.trim() || '',
            role: staffUser.role,
            active: true,
            authUid: firebaseUid,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser?.uid || 'super-admin',
            createdByName: auth.currentUser?.displayName || 'Super Admin',
          },
          { merge: true }
        );

        // Staff collection record for administrative directory
        await setDoc(
          doc(db, 'staff', staffUser.id),
          {
            id: staffUser.id,
            name: staffUser.name.trim(),
            email: cleanEmail,
            phone: staffUser.phone?.trim() || '',
            role: staffUser.role,
            assignedClientsCount: staffUser.assignedClientsCount || 0,
            active: true,
            authUid: firebaseUid,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser?.uid || 'super-admin',
          },
          { merge: true }
        );
      } catch (fsErr: any) {
        console.warn('[authService] Firestore staff sync notice:', fsErr);
      }
    }

    // 3. Sync new staff to backend
    try {
      fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStaffUser),
      }).catch((e) => console.warn('[authService] Backend staff create sync error:', e));
    } catch (e) {
      console.warn('[authService] Fetch staff create exception:', e);
    }

    return { success: true, user: updatedStaffUser };
  }

  /**
   * Toggle staff account active status
   */
  public async toggleStaffStatus(userId: string, active: boolean): Promise<void> {
    Object.keys(this.credentials).forEach((k) => {
      if (this.credentials[k].userId === userId) {
        this.credentials[k].active = active;
      }
    });
    this.saveCredentials();

    const status = active ? 'Active' : 'Deactivated';
    const currentAdminUid = auth.currentUser?.uid || 'super-admin';
    const now = serverTimestamp();
    const updateObj = active
      ? {
          active: true,
          status: 'Active',
          reactivatedAt: now,
          reactivatedBy: currentAdminUid,
        }
      : {
          active: false,
          status: 'Deactivated',
          deactivatedAt: now,
          deactivatedBy: currentAdminUid,
        };

    if (db && isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'users', userId), updateObj, { merge: true });
      } catch {
        // Ignore
      }
      try {
        await setDoc(doc(db, 'staff', userId), updateObj, { merge: true });
      } catch {
        // Ignore
      }
    }
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
