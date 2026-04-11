import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// These values should be provided via environment variables in your .env file.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Ensure we only initialize once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * Safely initialize the Realtime Database.
 * This prevents the "FATAL ERROR: Can't determine Firebase Database URL" which occurs
 * if getDatabase is called with an incomplete configuration during SSR or initial load.
 */
export const db = (() => {
  if (!firebaseConfig.databaseURL || !firebaseConfig.projectId) {
    if (typeof window !== 'undefined') {
      console.warn(
        'Firebase configuration is incomplete. ' +
        'Please ensure NEXT_PUBLIC_FIREBASE_DATABASE_URL and NEXT_PUBLIC_FIREBASE_PROJECT_ID are set in your .env file.'
      );
    }
    // Return a dummy object to prevent the fatal initialization crash.
    // Subsequent calls to Firebase functions using this (like ref()) will still fail, but it prevents the app from crashing on load.
    return null as any;
  }
  return getDatabase(app);
})();
