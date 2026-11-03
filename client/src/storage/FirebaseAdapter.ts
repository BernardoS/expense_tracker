// FirebaseAdapter implementation.
//
// Implements the StorageAdapter interface using Firebase Firestore as
// the persistence backend. Budgets are stored in the `budgets`
// collection with document ID = budget.id.
//
// This file fully implements budget operations (loadBudgets,
// saveBudget, deleteBudget), expense operations (loadExpenses,
// saveExpense, updateExpense, deleteExpense, deleteExpensesByBudget),
// metadata operations (getActiveBudgetId, setActiveBudgetId), and bulk
// operations (loadAll, saveAll).
//
// Related design doc: .kiro/specs/storage-backend-abstraction/design.md

import type { Firestore } from 'firebase/firestore';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';

import { db } from './firebaseConfig';
import type { StorageAdapter } from './StorageAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

/**
 * Storage backend that persists data in Firebase Firestore.
 *
 * Entities are mapped to top-level Firestore collections:
 *   - `budgets`   → document ID = budget.id
 *   - `expenses`  → document ID = expense.id
 *   - `metadata`  → document ID = activeBudget
 */
export class FirebaseAdapter implements StorageAdapter {
  private db: Firestore;

  constructor() {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Budget operations
  // ---------------------------------------------------------------------------

  /**
   * Loads all budgets from the `budgets` collection.
   *
   * Each Firestore document is mapped to a `BudgetGoal` by merging the
   * document's id with its stored fields.
   *
   * @returns A Promise that resolves to an array of `BudgetGoal`.
   */
  async loadBudgets(): Promise<BudgetGoal[]> {
    const snapshot = await getDocs(collection(this.db, 'budgets'));
    const budgets: BudgetGoal[] = [];
    snapshot.forEach((document) => {
      budgets.push({ id: document.id, ...(document.data() as Omit<BudgetGoal, 'id'>) });
    });
    return budgets;
  }

  /**
   * Saves (creates or updates) a single budget in the `budgets`
   * collection using `budget.id` as the document ID.
   *
   * @param budget - The budget to persist.
   * @returns A Promise that resolves when the budget has been saved.
   */
  async saveBudget(budget: BudgetGoal): Promise<void> {
    await setDoc(doc(this.db, 'budgets', budget.id), budget);
  }

  /**
   * Deletes a budget document from the `budgets` collection.
   *
   * @param budgetId - The unique identifier of the budget to delete.
   * @returns A Promise that resolves when the budget has been deleted.
   */
  async deleteBudget(budgetId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'budgets', budgetId));
  }

  // ---------------------------------------------------------------------------
  // Expense operations (task 4.3)
  // ---------------------------------------------------------------------------

  /**
   * Loads all expenses from the `expenses` collection.
   *
   * Each Firestore document is mapped to an `Expense` by merging the
   * document's id with its stored fields.
   *
   * @returns A Promise that resolves to an array of `Expense`.
   */
  async loadExpenses(): Promise<Expense[]> {
    const snapshot = await getDocs(collection(this.db, 'expenses'));
    const expenses: Expense[] = [];
    snapshot.forEach((document) => {
      expenses.push({ id: document.id, ...(document.data() as Omit<Expense, 'id'>) });
    });
    return expenses;
  }

  /**
   * Saves (creates or updates) a single expense in the `expenses`
   * collection using `expense.id` as the document ID.
   *
   * @param expense - The expense to persist.
   * @returns A Promise that resolves when the expense has been saved.
   */
  async saveExpense(expense: Expense): Promise<void> {
    await setDoc(doc(this.db, 'expenses', expense.id), expense);
  }

  /**
   * Updates an existing expense in the `expenses` collection using a
   * merge write so that only the provided fields overwrite the stored
   * document.
   *
   * @param expense - The expense with updated fields (id is preserved).
   * @returns A Promise that resolves when the expense has been updated.
   */
  async updateExpense(expense: Expense): Promise<void> {
    await setDoc(doc(this.db, 'expenses', expense.id), expense, { merge: true });
  }

  /**
   * Deletes a single expense document from the `expenses` collection.
   *
   * @param expenseId - The unique identifier of the expense to delete.
   * @returns A Promise that resolves when the expense has been deleted.
   */
  async deleteExpense(expenseId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'expenses', expenseId));
  }

  /**
   * Deletes all expenses that belong to a given budget.
   *
   * Queries the `expenses` collection for documents whose `budgetId`
   * matches the given id, deletes them in a single batch write, then
   * re-queries to verify that no matching documents remain. If any
   * expenses with the budgetId still exist after deletion, the
   * Promise is rejected to signal a partial-failure (Requirement 3.7).
   *
   * @param budgetId - The id of the budget whose expenses should be deleted.
   * @returns A Promise that resolves when all matching expenses have been deleted.
   */
  async deleteExpensesByBudget(budgetId: string): Promise<void> {
    const expensesRef = collection(this.db, 'expenses');
    const q = query(expensesRef, where('budgetId', '==', budgetId));

    // Step 1: Fetch all expenses with the given budgetId.
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return;
    }

    // Step 2: Batch delete all matching documents atomically.
    const batch = writeBatch(this.db);
    snapshot.forEach((document) => {
      batch.delete(document.ref);
    });
    await batch.commit();

    // Step 3: Verify no expenses with the budgetId remain.
    const verifySnapshot = await getDocs(q);
    if (!verifySnapshot.empty) {
      throw new Error(
        `Failed to delete all expenses for budget ${budgetId}: ${verifySnapshot.size} remaining`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Metadata (task 4.4)
  // ---------------------------------------------------------------------------

  /**
   * Reads the active budget id from the `metadata/activeBudget` document.
   *
   * @returns A Promise that resolves to the active budget id or `null`
   *          when the metadata document does not exist yet.
   */
  async getActiveBudgetId(): Promise<string | null> {
    const snapshot = await getDoc(doc(this.db, 'metadata', 'activeBudget'));
    if (!snapshot.exists()) {
      return null;
    }
    return snapshot.data().activeBudgetId ?? null;
  }

  /**
   * Persists the active budget id to the `metadata/activeBudget`
   * document, overwriting any previously stored value.
   *
   * @param budgetId - The budget id to mark as active.
   * @returns A Promise that resolves when the active budget id has been saved.
   */
  async setActiveBudgetId(budgetId: string): Promise<void> {
    await setDoc(doc(this.db, 'metadata', 'activeBudget'), { activeBudgetId: budgetId });
  }

  // ---------------------------------------------------------------------------
  // Bulk operations (task 4.4)
  // ---------------------------------------------------------------------------

  /**
   * Loads all persisted data concurrently.
   *
   * Delegates to `loadBudgets()`, `loadExpenses()`, and
   * `getActiveBudgetId()` via `Promise.all` so that the three reads
   * execute in parallel, then assembles the results into a
   * `StorageData` object.
   *
   * @returns A Promise that resolves to a `StorageData` object containing
   *          budgets, expenses, and the active budget id.
   */
  async loadAll(): Promise<StorageData> {
    const [budgets, expenses, activeBudgetId] = await Promise.all([
      this.loadBudgets(),
      this.loadExpenses(),
      this.getActiveBudgetId(),
    ]);
    return { budgets, expenses, activeBudgetId };
  }

  /**
   * Persists all data atomically using a single Firestore batch write.
   *
   * Every budget, every expense, and (when not null) the active budget
   * id are staged in a `writeBatch` and committed together. Using a
   * batch guarantees that either all documents are written or none are,
   * which is required for migration and import flows (Requirements 8.3,
   * 16.3).
   *
   * @param data - The complete application state to persist.
   * @returns A Promise that resolves when the batch has been committed.
   */
  async saveAll(data: StorageData): Promise<void> {
    const batch = writeBatch(this.db);
    for (const budget of data.budgets) {
      batch.set(doc(this.db, 'budgets', budget.id), budget);
    }
    for (const expense of data.expenses) {
      batch.set(doc(this.db, 'expenses', expense.id), expense);
    }
    if (data.activeBudgetId !== null) {
      batch.set(doc(this.db, 'metadata', 'activeBudget'), {
        activeBudgetId: data.activeBudgetId,
      });
    }
    await batch.commit();
  }
}
