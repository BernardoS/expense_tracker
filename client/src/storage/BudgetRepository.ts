// BudgetRepository implementation.
//
// A thin delegation layer that exposes budget-specific persistence
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
import type { BudgetGoal } from './types';

/**
 * Repository that persists budgets through a `StorageAdapter`.
 *
 * The repository holds no state of its own; every operation is
 * delegated to the adapter injected at construction time. This keeps
 * the storage backend swappable (localStorage, Firebase, or any future
 * implementation) without changes to the calling code.
 */
export class BudgetRepository {
  /**
   * @param adapter - The storage backend that performs the actual reads and writes.
   */
  constructor(private adapter: StorageAdapter) {}

  // ---------------------------------------------------------------------------
  // Budget operations
  // ---------------------------------------------------------------------------

  /**
   * Loads all budgets from storage.
   *
   * Delegates to `adapter.loadBudgets()`.
   *
   * @returns A Promise that resolves to an array of `BudgetGoal`.
   */
  async getAll(): Promise<BudgetGoal[]> {
    return this.adapter.loadBudgets();
  }

  /**
   * Saves (creates or updates) a single budget.
   *
   * Delegates to `adapter.saveBudget(budget)`.
   *
   * @param budget - The budget to persist.
   * @returns A Promise that resolves when the budget has been saved.
   */
  async save(budget: BudgetGoal): Promise<void> {
    return this.adapter.saveBudget(budget);
  }

  /**
   * Deletes a budget by its id.
   *
   * Delegates to `adapter.deleteBudget(budgetId)`.
   *
   * @param budgetId - The unique identifier of the budget to delete.
   * @returns A Promise that resolves when the budget has been deleted.
   */
  async delete(budgetId: string): Promise<void> {
    return this.adapter.deleteBudget(budgetId);
  }

  /**
   * Saves (creates or updates) multiple budgets in sequence.
   *
   * Iterates over the provided array and calls `adapter.saveBudget()`
   * for each budget individually. This preserves order and surfaces the
   * first error should any individual save fail.
   *
   * @param budgets - The budgets to persist.
   * @returns A Promise that resolves when all budgets have been saved.
   */
  async saveAll(budgets: BudgetGoal[]): Promise<void> {
    for (const budget of budgets) {
      await this.adapter.saveBudget(budget);
    }
  }
}
