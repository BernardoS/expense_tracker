// StorageAdapter interface definition.
//
// Defines the common contract that all storage implementations
// (LocalStorageAdapter, FirebaseAdapter) must satisfy. Every method
// returns a Promise so that the calling code is agnostic to whether
// the underlying storage is synchronous (localStorage) or
// asynchronous (Firestore).
//
// Related design doc: .kiro/specs/storage-backend-abstraction/design.md

import type { BudgetGoal, Expense, StorageData } from './types';

/**
 * Contract for storage backends.
 *
 * Implementations of this interface handle persistence of budgets,
 * expenses, and the active-budget metadata. The interface is fully
 * asynchronous so that both synchronous (localStorage) and
 * asynchronous (Firestore) backends can be used interchangeably.
 */
export interface StorageAdapter {
  // ---------------------------------------------------------------------------
  // Budget operations
  // ---------------------------------------------------------------------------

  /**
   * Loads all budgets from storage.
   *
   * @returns A Promise that resolves to an array of `BudgetGoal`.
   */
  loadBudgets(): Promise<BudgetGoal[]>;

  /**
   * Saves (creates or updates) a single budget.
   *
   * @param budget - The budget to persist.
   * @returns A Promise that resolves when the budget has been saved.
   */
  saveBudget(budget: BudgetGoal): Promise<void>;

  /**
   * Deletes a budget by its id.
   *
   * @param budgetId - The unique identifier of the budget to delete.
   * @returns A Promise that resolves when the budget has been deleted.
   */
  deleteBudget(budgetId: string): Promise<void>;

  // ---------------------------------------------------------------------------
  // Expense operations
  // ---------------------------------------------------------------------------

  /**
   * Loads all expenses from storage.
   *
   * @returns A Promise that resolves to an array of `Expense`.
   */
  loadExpenses(): Promise<Expense[]>;

  /**
   * Saves (creates) a single expense.
   *
   * @param expense - The expense to persist.
   * @returns A Promise that resolves when the expense has been saved.
   */
  saveExpense(expense: Expense): Promise<void>;

  /**
   * Updates an existing expense.
   *
   * @param expense - The expense with updated fields (id is preserved).
   * @returns A Promise that resolves when the expense has been updated.
   */
  updateExpense(expense: Expense): Promise<void>;

  /**
   * Deletes a single expense by its id.
   *
   * @param expenseId - The unique identifier of the expense to delete.
   * @returns A Promise that resolves when the expense has been deleted.
   */
  deleteExpense(expenseId: string): Promise<void>;

  /**
   * Deletes all expenses that belong to a given budget.
   *
   * Used for cascade deletion when a budget is removed.
   *
   * @param budgetId - The id of the budget whose expenses should be deleted.
   * @returns A Promise that resolves when all matching expenses have been deleted.
   */
  deleteExpensesByBudget(budgetId: string): Promise<void>;

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  /**
   * Retrieves the id of the currently active budget, if any.
   *
   * @returns A Promise that resolves to the active budget id or `null`.
   */
  getActiveBudgetId(): Promise<string | null>;

  /**
   * Persists the active budget id.
   *
   * @param budgetId - The budget id to mark as active.
   * @returns A Promise that resolves when the active budget id has been saved.
   */
  setActiveBudgetId(budgetId: string): Promise<void>;

  // ---------------------------------------------------------------------------
  // Bulk operations (for import/export)
  // ---------------------------------------------------------------------------

  /**
   * Loads all persisted data in a single call.
   *
   * @returns A Promise that resolves to a `StorageData` object containing
   *          budgets, expenses, and the active budget id.
   */
  loadAll(): Promise<StorageData>;

  /**
   * Persists all data in a single call.
   *
   * @param data - The complete application state to persist.
   * @returns A Promise that resolves when all data has been saved.
   */
  saveAll(data: StorageData): Promise<void>;
}
