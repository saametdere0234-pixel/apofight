import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

/**
 * Firebase configuration object.
 * In Next.js, environment variables prefixed with NEXT_PUBLIC_ are accessible on the client side.
 * We use process.env as per Next.js standards.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Validates the configuration and identifies missing keys for easier debugging.
 */
const getMissingKeys = () => {
  const required = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID'
  ];
  return required.filter(key => !process.env[key]);
};

const missingKeys = getMissingKeys();
const isConfigValid = missingKeys.length === 0;

if (!isConfigValid && typeof window !== 'undefined') {
  console.warn(
    `[Firebase] Configuration is incomplete. Missing keys: ${missingKeys.join(', ')}. ` +
    'Multiplayer features will be disabled until these are added to your environment variables.'
  );
}

// Ensure we only initialize once and only if config is valid
const app = (isConfigValid && (getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()));

/**
 * Exported Database instance.
 * If the configuration is invalid, this will be null. 
 * The application UI handles the null state by showing the "System Error" alert.
 */
export const db = app ? getDatabase(app) : null;
