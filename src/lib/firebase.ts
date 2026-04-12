import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

/**
 * Firebase configuration object.
 * In Next.js, environment variables prefixed with NEXT_PUBLIC_ are accessible on the client side.
 * We use process.env as per Next.js standards.
 */
const firebaseConfig = {
apiKey: "AIzaSyCnAituTyyU2JtWPnL1L1mYBzX45xKV1uI",
authDomain: "studio-1664944821-7e3d5.firebaseapp.com"
databaseURL: "https://studio-1664944821-7e3d5-default-rtdb.firebaseio.com"
projectId: "studio-1664944821-7e3d5"
 storageBucket: "studio-1664944821-7e3d5.firebasestorage.app"
 messagingSenderId: "1002608889303"
 appId: "1:1002608889303:web:51a341e375c883cb648f92"
};
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
