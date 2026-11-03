/// <reference types="vite/client" />

// Type declarations for Vite environment variables used by the
// storage backend abstraction feature.
//
// Vite reads variables prefixed with VITE_ from the .env file and
// exposes them via `import.meta.env`. These declarations give
// TypeScript type information for the custom variables defined in
// `.env.example`.

interface ImportMetaEnv {
  /** Storage backend selection: "local" or "firebase". */
  readonly VITE_STORAGE_BACKEND?: string;

  /** Firebase API key (required when backend = "firebase"). */
  readonly VITE_FIREBASE_API_KEY?: string;

  /** Firebase auth domain (required when backend = "firebase"). */
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;

  /** Firebase project ID (required when backend = "firebase"). */
  readonly VITE_FIREBASE_PROJECT_ID?: string;

  /** Firebase storage bucket (required when backend = "firebase"). */
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;

  /** Firebase messaging sender ID (required when backend = "firebase"). */
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;

  /** Firebase app ID (required when backend = "firebase"). */
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
