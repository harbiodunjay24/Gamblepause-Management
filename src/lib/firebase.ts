import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Authoritative Firebase Web App configuration for gamblepause-africa
const getEnv = (key: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env?.[key]) {
      return (import.meta as any).env[key];
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process?.env?.[key]) {
      return process.env[key] as string;
    }
  } catch {}
  return '';
};

const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || 'AIzaSyC8z5JT7n7TeVJFKBEn2AIw4Ef8D4WfAUI',
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || 'gamblepause-africa.firebaseapp.com',
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || 'gamblepause-africa',
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || 'gamblepause-africa.firebasestorage.app',
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || '902783570630',
  appId: getEnv('VITE_FIREBASE_APP_ID') || '1:902783570630:web:40a74e10a8dacf20947dc7',
};

// Authoritative production flag: gamblepause-africa is always configured
export const isFirebaseConfigured = true;

// Initialize Firebase App, Auth, and Cloud Firestore
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db, firebaseConfig };
