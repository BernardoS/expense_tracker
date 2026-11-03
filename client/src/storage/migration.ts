// Data migration utility: localStorage → Firebase.
//
// Provides `migrateFromLocalToFirebase()`, a one-shot function that
// transfers the entire persisted state from localStorage to Firestore.
// It instantiates temporary adapter instances (independent of the
// global adapter selected by StorageFactory) so it can be called from
// any context — e.g. a settings page or a one-off migration script.
//
// Related design doc: .kiro/specs/storage-backend-abstraction/design.md
// Requirements: 8.1, 8.2, 8.3, 8.4, 8.5

import { FirebaseAdapter } from './FirebaseAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

/**
 * Result returned by a successful migration, describing what was moved.
 */
export interface MigrationResult {
  budgetsMigrated: number;
  expensesMigrated: number;
  activeBudgetId: string | null;
}

/**
 * Helper that sorts an array of entities by their `id` so that two
 * arrays can be compared regardless of ordering differences between
 * storage backends (Firestore does not guarantee document order while
 * localStorage preserves insertion order).
 */
function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Verifies that two arrays of entities contain the same IDs in the
 * same sorted order. Throws a descriptive error when a mismatch is
 * detected so the caller knows exactly what went wrong.
 */
function assertSameIds<T extends { id: string }>(
  label: string,
  localItems: T[],
  firebaseItems: T[],
): void {
  const localIds = sortById(localItems).map((item) => item.id);
  const firebaseIds = sortById(firebaseItems).map((item) => item.id);

  if (localIds.length !== firebaseIds.length) {
    throw new Error(
      `Migration verification failed: ${label} count mismatch (${localIds.length} → ${firebaseIds.length})`,
    );
  }

  for (let i = 0; i < localIds.length; i++) {
    if (localIds[i] !== firebaseIds[i]) {
      throw new Error(
        `Migration verification failed: ${label} ID mismatch at index ${i} (local="${localIds[i]}" vs firebase="${firebaseIds[i]}")`,
      );
    }
  }
}

/**
 * Migrates all application data from localStorage to Firebase Firestore.
 *
 * The function performs three steps:
 *  1. Loads the complete state from localStorage using a temporary
 *     `LocalStorageAdapter`.
 *  2. Saves the state to Firestore using a temporary `FirebaseAdapter`.
 *     `saveAll` stages every document in a single `writeBatch` and
 *     commits it atomically, satisfying Requirement 8.3.
 *  3. Reloads the data from Firestore and verifies integrity by
 *     comparing budget counts/IDs, expense counts/IDs, and the
 *     active budget id. Any mismatch throws an error (Requirement 8.2).
 *
 * The function does not modify or delete the source localStorage
 * data; callers can remove it manually once they are confident the
 * migration succeeded.
 *
 * @returns A `MigrationResult` summarising the migrated data.
 * @throws  When loading, saving, or the post-migration verification fails.
 */
export async function migrateFromLocalToFirebase(): Promise<MigrationResult> {
  // Step 1: Load all data from localStorage.
  const localAdapter = new LocalStorageAdapter();
  const localData: StorageData = await localAdapter.loadAll();

  // Step 2: Save all data to Firebase (uses writeBatch internally).
  const firebaseAdapter = new FirebaseAdapter();
  await firebaseAdapter.saveAll(localData);

  // Step 3: Verify integrity by reloading from Firebase and comparing.
  const firebaseData: StorageData = await firebaseAdapter.loadAll();

  // Verify budgets match by count and ID.
  assertSameIds<BudgetGoal>('budgets', localData.budgets, firebaseData.budgets);

  // Verify expenses match by count and ID.
  assertSameIds<Expense>('expenses', localData.expenses, firebaseData.expenses);

  // Verify activeBudgetId matches.
  if (firebaseData.activeBudgetId !== localData.activeBudgetId) {
    throw new Error(
      `Migration verification failed: activeBudgetId mismatch ("${localData.activeBudgetId}" → "${firebaseData.activeBudgetId}")`,
    );
  }

  const result: MigrationResult = {
    budgetsMigrated: localData.budgets.length,
    expensesMigrated: localData.expenses.length,
    activeBudgetId: localData.activeBudgetId,
  };

  console.log(
    `Migration complete: ${result.budgetsMigrated} budgets, ${result.expensesMigrated} expenses verified successfully`,
  );

  return result;
}
