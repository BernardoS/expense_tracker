// StorageFactory implementation.
//
// Provides a single entry point (`StorageFactory.create()`) that
// returns the appropriate storage adapter based on the
// `VITE_STORAGE_BACKEND` environment variable. This decouples the
// rest of the application from the concrete storage backend so that
// switching between localStorage and Firebase requires only an
// environment change, not a code change.
//
// Selection rules (Requirements 4.1 – 4.6):
//   - "firebase"          → FirebaseAdapter
//   - "local"              → LocalStorageAdapter
//   - undefined / not set  → LocalStorageAdapter (default)
//   - any other value      → throws a descriptive Error
//
// Related design doc: .kiro/specs/storage-backend-abstraction/design.md

import type { StorageAdapter } from './StorageAdapter';
import { FirebaseAdapter } from './FirebaseAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';

/**
 * Factory that instantiates the storage backend selected via the
 * `VITE_STORAGE_BACKEND` environment variable.
 */
export class StorageFactory {
  /**
   * Creates and returns the storage adapter selected by the
   * `VITE_STORAGE_BACKEND` environment variable.
   *
   * - `"firebase"` returns a `FirebaseAdapter`.
   * - `"local"` returns a `LocalStorageAdapter`.
   * - When the variable is undefined (not set) a `LocalStorageAdapter`
   *   is returned as the default (Requirement 4.5).
   * - Any other value throws a descriptive `Error` (Requirement 4.6).
   *
   * @returns A `StorageAdapter` instance for the configured backend.
   * @throws {Error} When `VITE_STORAGE_BACKEND` has an unknown value.
   */
  static create(): StorageAdapter {
    const backend = import.meta.env.VITE_STORAGE_BACKEND;

    switch (backend) {
      case 'firebase':
        return new FirebaseAdapter();
      case 'local':
      case undefined:
        return new LocalStorageAdapter();
      default:
        throw new Error(`Unknown storage backend: ${backend}`);
    }
  }
}
