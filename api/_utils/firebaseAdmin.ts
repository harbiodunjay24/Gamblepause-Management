import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;

export function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'gamblepause-africa';

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id || projectId,
      });
      return adminApp;
    } catch (e) {
      console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
    }
  }

  if (clientEmail && privateKey) {
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
      projectId,
    });
    return adminApp;
  }

  // Fallback to standard initialization (supports token verification via Google Public Keys)
  adminApp = initializeApp({ projectId });
  return adminApp;
}

export function getAdminAuthInstance(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminFirestoreInstance(): Firestore | null {
  try {
    const app = getAdminApp();
    const databaseId =
      process.env.FIREBASE_DATABASE_ID ||
      process.env.VITE_FIREBASE_DATABASE_ID ||
      'ai-studio-gamblepauseclien-cde82668-4f2d-49c6-ace1-d40fa583bceb';

    try {
      return getFirestore(app, databaseId);
    } catch {
      return getFirestore(app);
    }
  } catch (err) {
    console.warn('[Firebase Admin] Firestore initialization notice:', err);
    return null;
  }
}
