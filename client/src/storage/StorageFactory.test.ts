// Unit tests for StorageFactory.
//
// These tests verify that StorageFactory.create() returns the correct
// adapter based on the VITE_STORAGE_BACKEND environment variable:
//   - "firebase" → FirebaseAdapter
//   - "local"    → LocalStorageAdapter
//   - undefined  → LocalStorageAdapter (default)
//   - any other  → throws Error("Unknown storage backend: ...")
//
// Validates: Requirements 4.7, 4.8, 4.9, 4.10

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

// Mock firebaseConfig to prevent Firebase initialization errors during tests
vi.mock('./firebaseConfig', () => ({
  db: {},
  app: {},
}));

// Mock firebase/firestore so that importing FirebaseAdapter does not
// attempt to load the real Firestore SDK (we only need instanceof checks).
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  setDoc: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { StorageFactory } from './StorageFactory';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { FirebaseAdapter } from './FirebaseAdapter';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StorageFactory.create', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns LocalStorageAdapter when VITE_STORAGE_BACKEND = "local"', () => {
    vi.stubEnv('VITE_STORAGE_BACKEND', 'local');
    const adapter = StorageFactory.create();
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('returns FirebaseAdapter when VITE_STORAGE_BACKEND = "firebase"', () => {
    vi.stubEnv('VITE_STORAGE_BACKEND', 'firebase');
    const adapter = StorageFactory.create();
    expect(adapter).toBeInstanceOf(FirebaseAdapter);
  });

  it('returns LocalStorageAdapter when VITE_STORAGE_BACKEND is undefined', () => {
    vi.unstubAllEnvs();
    const adapter = StorageFactory.create();
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
  });

  it('throws error for unknown value "invalid"', () => {
    vi.stubEnv('VITE_STORAGE_BACKEND', 'invalid');
    expect(() => StorageFactory.create()).toThrow('Unknown storage backend: invalid');
  });

  it('throws error for empty string', () => {
    vi.stubEnv('VITE_STORAGE_BACKEND', '');
    expect(() => StorageFactory.create()).toThrow('Unknown storage backend: ');
  });

  it('throws error for arbitrary unknown value "mongodb"', () => {
    vi.stubEnv('VITE_STORAGE_BACKEND', 'mongodb');
    expect(() => StorageFactory.create()).toThrow('Unknown storage backend: mongodb');
  });
});
