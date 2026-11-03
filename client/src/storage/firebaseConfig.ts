// Firebase configuration and initialization.
//
// This module reads Firebase credentials from Vite environment
// variables, initializes the Firebase app, and exports the Firestore
// `db` instance (plus the `app` instance) for use by `FirebaseAdapter`.
//
// Environment variables are validated only when the active storage
// backend is "firebase" (controlled by `VITE_STORAGE_BACKEND`), so
// that a project configured for localStorage does not fail when
// Firebase credentials are absent.
//
// Related design doc: .kiro/specs/storage-backend-abstraction/design.md

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Environment variable access
// ---------------------------------------------------------------------------

const {
  VITE_STORAGE_BACKEND,
  VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID,
} = import.meta.env;

// ---------------------------------------------------------------------------
// Validation (only when Firebase backend is selected)
// ---------------------------------------------------------------------------

/**
 * The required Firebase environment variables.
 *
 * Each entry maps a human-readable name to its corresponding value so
 * that the error message can report exactly which variable is
 * missing.
 */
const requiredFirebaseEnvVars: ReadonlyArray<{ name: string; value: string | undefined }> = [
  { name: 'VITE_FIREBASE_API_KEY', value: VITE_FIREBASE_API_KEY },
  { name: 'VITE_FIREBASE_AUTH_DOMAIN', value: VITE_FIREBASE_AUTH_DOMAIN },
  { name: 'VITE_FIREBASE_PROJECT_ID', value: VITE_FIREBASE_PROJECT_ID },
  { name: 'VITE_FIREBASE_STORAGE_BUCKET', value: VITE_FIREBASE_STORAGE_BUCKET },
  { name: 'VITE_FIREBASE_MESSAGING_SENDER_ID', value: VITE_FIREBASE_MESSAGING_SENDER_ID },
  { name: 'VITE_FIREBASE_APP_ID', value: VITE_FIREBASE_APP_ID },
];

if (VITE_STORAGE_BACKEND === 'firebase') {
  const missing = requiredFirebaseEnvVars
    .filter((v) => !v.value)
    .map((v) => v.name);

  if (missing.length > 0) {
    const missingList = missing.join(', ');
    throw new Error(
      `Firebase configuration missing: ${missingList} ${missing.length === 1 ? 'is' : 'are'} required when VITE_STORAGE_BACKEND=firebase`,
    );
  }
}

// ---------------------------------------------------------------------------
// Firebase initialization
// ---------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: VITE_FIREBASE_API_KEY,
  authDomain: VITE_FIREBASE_AUTH_DOMAIN,
  projectId: VITE_FIREBASE_PROJECT_ID,
  storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: VITE_FIREBASE_APP_ID,
};

/** The initialized Firebase app instance. */
export const app: FirebaseApp = initializeApp(firebaseConfig);

/** The Firestore instance for database operations. */
export const db: Firestore = getFirestore(app);
