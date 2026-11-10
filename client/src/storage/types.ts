// Shared storage domain types.
//
// These interfaces were previously declared inside ExpenseContext.tsx.
// They have been moved here so that the storage layer (adapters,
// repositories, factory) and the React context can both reference the
// same canonical definitions without creating import cycles.
//
// ExpenseContext.tsx re-exports these types to preserve backward
// compatibility for any component that imports them from the context.

/**
 * A single expense entry belonging to a budget.
 */
export interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  budgetId: string;
  isEssential: boolean;
}

/**
 * A per-category spending limit attached to a budget.
 */
export interface CategoryLimit {
  category: string;
  maxAmount: number;
}

/**
 * A budget goal that groups expenses over a date range.
 */
export interface BudgetGoal {
  id: string;
  name: string;
  totalAmount: number;
  startDate: string;
  endDate: string;
  initialSpent?: number;
  categoryLimits?: CategoryLimit[];
}

/**
 * The complete persisted state of the application.
 *
 * This shape matches the JSON blob that the current localStorage
 * implementation stores under the `expense_tracker_data_v2` key.
 */
export interface StorageData {
  budgets: BudgetGoal[];
  expenses: Expense[];
  activeBudgetId: string | null;
}
