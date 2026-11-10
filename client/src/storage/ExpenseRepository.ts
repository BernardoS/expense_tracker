// ExpenseRepository implementation.
//
// A thin delegation layer that exposes expense-specific persistence
// operations by forwarding every call to the injected `StorageAdapter`.
// The repository decouples the application layer from the concrete
// storage backend (localStorage or Firebase) so that components depend
// on a stable, domain-oriented API rather than the raw adapter.
//
// All methods return Promises so that callers remain agnostic to
// whether the underlying storage is synchronous or asynchronous.
//
// Related design doc: .kiro/specs/storage-backend-abstraction/design.md

import type { StorageAdapter } from './StorageAdapter';
import type { Expense } from './types';

/**
 * Repository that persists expenses through a `StorageAdapter`.
 *
 * The repository holds no state of its own; every operation is
 * delegated to the adapter injected at construction time. This keeps
 * the storage backend swappable (localStorage, Firebase, or any future
 * implementation) without changes to the calling code.
 */
export class ExpenseRepository {
  /**
   * @param adapter - The storage backend that performs the actual reads and writes.
   */
  constructor(private adapter: StorageAdapter) {}

  // ---------------------------------------------------------------------------
  // Expense operations
  // ---------------------------------------------------------------------------

  /**
   * Loads all expenses from storage.
   *
   * Delegates to `adapter.loadExpenses()`.
   *
   * @returns A Promise that resolves to an array of `Expense`.
   */
  async getAll(): Promise<Expense[]> {
    return this.adapter.loadExpenses();
  }

  /**
   * Saves (creates) a single expense.
   *
   * Delegates to `adapter.saveExpense(expense)`.
   *
   * @param expense - The expense to persist.
   * @returns A Promise that resolves when the expense has been saved.
   */
  async save(expense: Expense): Promise<void> {
    return this.adapter.saveExpense(expense);
  }

  /**
   * Updates an existing expense.
   *
   * Delegates to `adapter.updateExpense(expense)`.
   *
   * @param expense - The expense with updated fields (id is preserved).
   * @returns A Promise that resolves when the expense has been updated.
   */
  async update(expense: Expense): Promise<void> {
    return this.adapter.updateExpense(expense);
  }

  /**
   * Deletes a single expense by its id.
   *
   * Delegates to `adapter.deleteExpense(expenseId)`.
   *
   * @param expenseId - The unique identifier of the expense to delete.
   * @returns A Promise that resolves when the expense has been deleted.
   */
  async delete(expenseId: string): Promise<void> {
    return this.adapter.deleteExpense(expenseId);
  }

  /**
   * Deletes all expenses that belong to a given budget.
   *
   * Delegates to `adapter.deleteExpensesByBudget(budgetId)`.
   * Used for cascade deletion when a budget is removed.
   *
   * @param budgetId - The id of the budget whose expenses should be deleted.
   * @returns A Promise that resolves when all matching expenses have been deleted.
   */
  async deleteByBudgetId(budgetId: string): Promise<void> {
    return this.adapter.deleteExpensesByBudget(budgetId);
  }
}
