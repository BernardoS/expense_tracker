// Debounce wrapper for storage adapter save operations.
//
// When the backend is Firebase, rapid successive writes to the same
// entity are collapsed into a single Firestore write via a debounce
// window. This reduces Firestore write costs (Requirement 16.1)
// while preserving correctness: each entity gets its own timer so
// saving budget A does not delay saving expense B, and calls that
// span multiple debounce windows still produce one write per window
// (Requirement 16.2).
//
// The LocalStorageAdapter is synchronous and instant, so debounce is
// never applied to it — the adapter is returned unchanged.
//
// Related design doc: .kiro/specs/storage-backend-abstraction/design.md

import type { StorageAdapter } from './StorageAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

/**
 * Debounce window in milliseconds.
 *
 * Chosen as the midpoint of the 300-500ms range specified in
 * Requirement 16.1 to balance write-cost reduction with perceived
 * responsiveness.
 */
const DEBOUNCE_MS = 400;

/**
 * Wraps a StorageAdapter so that save/update operations are debounced
 * when using Firebase. LocalStorageAdapter operations pass through
 * without debounce since they are synchronous and instantaneous.
 *
 * Debounce behavior (Requirements 16.1, 16.2, 16.4, 16.5):
 * - Multiple calls to the same entity within the debounce window
 *   collapse into a single write (last-write-wins).
 * - Calls that span multiple debounce windows produce one write
 *   per window.
 * - Delete and bulk operations are never debounced (immediate
 *   execution for data integrity).
 *
 * @param adapter - The underlying storage adapter to wrap.
 * @param isFirebase - Whether the backend is Firebase. When false,
 *                     the adapter is returned unchanged.
 * @returns A StorageAdapter with debounced save operations (or the
 *          original adapter if not Firebase).
 */
export function createDebouncedAdapter(
  adapter: StorageAdapter,
  isFirebase: boolean,
): StorageAdapter {
  if (!isFirebase) {
    return adapter; // No debounce for localStorage
  }

  // Per-key debounce timers. Each entity (budget:<id>, expense:<id>,
  // activeBudget) gets its own timer so that saving budget A does not
  // delay saving expense B.
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Debounces a function call by the given key. If a pending call
   * exists for the same key, it is cancelled and replaced by the
   * new call (last-write-wins within the window).
   *
   * The returned Promise resolves/rejects with the result of the
   * last invocation that actually fires (i.e. the one that survives
   * the debounce window).
   */
  function debounce<T>(
    key: string,
    fn: () => Promise<T>,
    ms: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const existing = debounceTimers.get(key);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(async () => {
        debounceTimers.delete(key);
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      }, ms);
      debounceTimers.set(key, timer);
    });
  }

  return {
    // ---- Budget operations ----
    // Only saveBudget is debounced; deleteBudget must be immediate for
    // data integrity (cascade deletes should not wait).
    loadBudgets: () => adapter.loadBudgets(),
    saveBudget: (budget: BudgetGoal) =>
      debounce(`budget:${budget.id}`, () => adapter.saveBudget(budget), DEBOUNCE_MS),
    deleteBudget: (budgetId: string) => adapter.deleteBudget(budgetId),

    // ---- Expense operations ----
    // saveExpense and updateExpense are debounced per expense id.
    // deleteExpense and deleteExpensesByBudget are immediate.
    loadExpenses: () => adapter.loadExpenses(),
    saveExpense: (expense: Expense) =>
      debounce(`expense:${expense.id}`, () => adapter.saveExpense(expense), DEBOUNCE_MS),
    updateExpense: (expense: Expense) =>
      debounce(`expense:${expense.id}`, () => adapter.updateExpense(expense), DEBOUNCE_MS),
    deleteExpense: (expenseId: string) => adapter.deleteExpense(expenseId),
    deleteExpensesByBudget: (budgetId: string) =>
      adapter.deleteExpensesByBudget(budgetId),

    // ---- Metadata ----
    // setActiveBudgetId is debounced under a single key since there
    // is only one active budget at a time.
    getActiveBudgetId: () => adapter.getActiveBudgetId(),
    setActiveBudgetId: (budgetId: string) =>
      debounce('activeBudget', () => adapter.setActiveBudgetId(budgetId), DEBOUNCE_MS),

    // ---- Bulk operations (never debounced) ----
    // loadAll is read-only. saveAll is used for migration/import and
    // must execute immediately.
    loadAll: () => adapter.loadAll(),
    saveAll: (data: StorageData) => adapter.saveAll(data),
  };
}
