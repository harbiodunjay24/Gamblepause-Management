import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Authoritative Firebase Web App configuration for gamblepause-africa
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC8z5JT7n7TeVJFKBEn2AIw4Ef8D4WfAUI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'gamblepause-africa.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gamblepause-africa',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'gamblepause-africa.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '902783570630',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:902783570630:web:abcab41297019700947dc7',
};

// Authoritative production flag: gamblepause-africa is always configured
export const isFirebaseConfigured = true;

// Initialize Firebase App, Auth, and Cloud Firestore
const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export { app, auth, db, firebaseConfig };
