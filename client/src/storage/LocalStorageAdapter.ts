// LocalStorageAdapter implementation.
//
// Implements the StorageAdapter interface using the browser's
// localStorage as the persistence backend. This adapter maintains
// backward compatibility with the existing data format stored under
// the `expense_tracker_data_v2` key.
//
// All methods return Promises (synchronous operations wrapped in
// `Promise.resolve()`) so that the calling code is agnostic to whether
// the underlying storage is synchronous or asynchronous.
//
// Related design doc: .kiro/specs/storage-backend-abstraction/design.md

import type { StorageAdapter } from './StorageAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

/**
 * Storage backend that persists data in the browser's localStorage.
 *
 * Data is stored as a single JSON blob under the
 * `expense_tracker_data_v2` key, matching the format previously
 * written directly by `ExpenseContext`. Individual operations
 * (saveBudget, saveExpense, etc.) read the current blob, update only
 * the relevant section, and write it back, preserving the rest of the
 * state unchanged.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly STORAGE_KEY = 'expense_tracker_data_v2';

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Reads and parses the full `StorageData` blob from localStorage.
   *
   * Returns an empty-state object when the key is absent so that
   * callers always receive a well-formed `StorageData`.
   */
  private readData(): StorageData {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (raw === null) {
      return { budgets: [], expenses: [], activeBudgetId: null };
    }
    try {
      return JSON.parse(raw) as StorageData;
    } catch (error) {
      console.error('Failed to parse localStorage data:', error);
      return { budgets: [], expenses: [], activeBudgetId: null };
    }
  }

  /**
   * Serializes and writes the full `StorageData` blob to localStorage.
   */
  private writeData(data: StorageData): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // ---------------------------------------------------------------------------
  // Budget operations
  // ---------------------------------------------------------------------------

  loadBudgets(): Promise<BudgetGoal[]> {
    return Promise.resolve(this.readData().budgets);
  }

  saveBudget(budget: BudgetGoal): Promise<void> {
    const data = this.readData();
    const index = data.budgets.findIndex((b) => b.id === budget.id);
    if (index >= 0) {
      data.budgets[index] = budget;
    } else {
      data.budgets.push(budget);
    }
    this.writeData(data);
    return Promise.resolve();
  }

  deleteBudget(budgetId: string): Promise<void> {
    const data = this.readData();
    data.budgets = data.budgets.filter((b) => b.id !== budgetId);
    this.writeData(data);
    return Promise.resolve();
  }

  // ---------------------------------------------------------------------------
  // Expense operations
  // ---------------------------------------------------------------------------

  loadExpenses(): Promise<Expense[]> {
    return Promise.resolve(this.readData().expenses);
  }

  saveExpense(expense: Expense): Promise<void> {
    const data = this.readData();
    const index = data.expenses.findIndex((e) => e.id === expense.id);
    if (index >= 0) {
      data.expenses[index] = expense;
    } else {
      data.expenses.push(expense);
    }
    this.writeData(data);
    return Promise.resolve();
  }

  updateExpense(expense: Expense): Promise<void> {
    const data = this.readData();
    const index = data.expenses.findIndex((e) => e.id === expense.id);
    if (index >= 0) {
      data.expenses[index] = expense;
    } else {
      data.expenses.push(expense);
    }
    this.writeData(data);
    return Promise.resolve();
  }

  deleteExpense(expenseId: string): Promise<void> {
    const data = this.readData();
    data.expenses = data.expenses.filter((e) => e.id !== expenseId);
    this.writeData(data);
    return Promise.resolve();
  }

  deleteExpensesByBudget(budgetId: string): Promise<void> {
    const data = this.readData();
    data.expenses = data.expenses.filter((e) => e.budgetId !== budgetId);
    this.writeData(data);
    return Promise.resolve();
  }

  // ---------------------------------------------------------------------------
  // Metadata
  // ---------------------------------------------------------------------------

  getActiveBudgetId(): Promise<string | null> {
    return Promise.resolve(this.readData().activeBudgetId);
  }

  setActiveBudgetId(budgetId: string): Promise<void> {
    const data = this.readData();
    data.activeBudgetId = budgetId;
    this.writeData(data);
    return Promise.resolve();
  }

  // ---------------------------------------------------------------------------
  // Bulk operations (for import/export)
  // ---------------------------------------------------------------------------

  loadAll(): Promise<StorageData> {
    return Promise.resolve(this.readData());
  }

  saveAll(data: StorageData): Promise<void> {
    this.writeData(data);
    return Promise.resolve();
  }
}
