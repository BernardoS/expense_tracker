// Unit tests for BudgetRepository and ExpenseRepository.
//
// These repositories are thin delegation layers that forward every call
// to an injected `StorageAdapter`. The tests verify that each repository
// method delegates to the correct adapter method with the correct
// arguments (Requirements 5.3, 5.4, 5.5) and that `BudgetRepository.saveAll()`
// iterates over the budgets, calling `adapter.saveBudget()` for each one
// individually while preserving order.
//
// The adapter is mocked with `vi.fn()` so the tests assert DELEGATION,
// not the adapter's actual behavior.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BudgetRepository } from './BudgetRepository';
import { ExpenseRepository } from './ExpenseRepository';
import type { StorageAdapter } from './StorageAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

// ---------------------------------------------------------------------------
// Mock adapter factory
// ---------------------------------------------------------------------------

function createMockAdapter(): {
  adapter: StorageAdapter;
  mocks: Record<string, ReturnType<typeof vi.fn>>;
} {
  const mocks = {
    loadBudgets: vi.fn().mockResolvedValue([]),
    saveBudget: vi.fn().mockResolvedValue(undefined),
    deleteBudget: vi.fn().mockResolvedValue(undefined),
    loadExpenses: vi.fn().mockResolvedValue([]),
    saveExpense: vi.fn().mockResolvedValue(undefined),
    updateExpense: vi.fn().mockResolvedValue(undefined),
    deleteExpense: vi.fn().mockResolvedValue(undefined),
    deleteExpensesByBudget: vi.fn().mockResolvedValue(undefined),
    getActiveBudgetId: vi.fn().mockResolvedValue(null),
    setActiveBudgetId: vi.fn().mockResolvedValue(undefined),
    loadAll: vi.fn().mockResolvedValue<StorageData>({
      budgets: [],
      expenses: [],
      activeBudgetId: null,
    }),
    saveAll: vi.fn().mockResolvedValue(undefined),
  };

  const adapter = mocks as unknown as StorageAdapter;
  return { adapter, mocks };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleBudget: BudgetGoal = {
  id: 'b1',
  name: 'Budget',
  totalAmount: 5000,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
};

const sampleBudget2: BudgetGoal = {
  id: 'b2',
  name: 'Vacation',
  totalAmount: 3000,
  startDate: '2024-06-01',
  endDate: '2024-08-31',
};

const sampleBudget3: BudgetGoal = {
  id: 'b3',
  name: 'Emergency',
  totalAmount: 10000,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
};

const sampleExpense: Expense = {
  id: 'e1',
  amount: 50,
  description: 'Lunch',
  date: '2024-01-15',
  category: 'Food',
  budgetId: 'b1',
  isEssential: true,
};

// ===========================================================================
// BudgetRepository
// ===========================================================================

describe('BudgetRepository', () => {
  let repo: BudgetRepository;
  let mocks: ReturnType<typeof createMockAdapter>['mocks'];

  beforeEach(() => {
    const mock = createMockAdapter();
    repo = new BudgetRepository(mock.adapter);
    mocks = mock.mocks;
  });

  // -------------------------------------------------------------------------
  // getAll -> adapter.loadBudgets
  // -------------------------------------------------------------------------

  describe('getAll', () => {
    it('delegates to adapter.loadBudgets()', async () => {
      const budgets: BudgetGoal[] = [sampleBudget];
      mocks.loadBudgets.mockResolvedValue(budgets);

      const result = await repo.getAll();

      expect(mocks.loadBudgets).toHaveBeenCalledTimes(1);
      expect(mocks.loadBudgets).toHaveBeenCalledWith();
      expect(result).toEqual(budgets);
    });
  });

  // -------------------------------------------------------------------------
  // save -> adapter.saveBudget
  // -------------------------------------------------------------------------

  describe('save', () => {
    it('delegates to adapter.saveBudget(budget)', async () => {
      await repo.save(sampleBudget);

      expect(mocks.saveBudget).toHaveBeenCalledTimes(1);
      expect(mocks.saveBudget).toHaveBeenCalledWith(sampleBudget);
    });
  });

  // -------------------------------------------------------------------------
  // delete -> adapter.deleteBudget
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('delegates to adapter.deleteBudget(budgetId)', async () => {
      await repo.delete('b1');

      expect(mocks.deleteBudget).toHaveBeenCalledTimes(1);
      expect(mocks.deleteBudget).toHaveBeenCalledWith('b1');
    });
  });

  // -------------------------------------------------------------------------
  // saveAll -> iterate and call adapter.saveBudget for each
  // -------------------------------------------------------------------------

  describe('saveAll', () => {
    it('calls adapter.saveBudget for each budget (3 budgets -> 3 calls)', async () => {
      const budgets = [sampleBudget, sampleBudget2, sampleBudget3];

      await repo.saveAll(budgets);

      expect(mocks.saveBudget).toHaveBeenCalledTimes(3);
      expect(mocks.saveBudget).toHaveBeenNthCalledWith(1, sampleBudget);
      expect(mocks.saveBudget).toHaveBeenNthCalledWith(2, sampleBudget2);
      expect(mocks.saveBudget).toHaveBeenNthCalledWith(3, sampleBudget3);
    });

    it('calls adapter.saveBudget zero times for an empty array', async () => {
      await repo.saveAll([]);

      expect(mocks.saveBudget).not.toHaveBeenCalled();
    });

    it('preserves order (first budget saved first)', async () => {
      const budgets = [sampleBudget2, sampleBudget, sampleBudget3];

      await repo.saveAll(budgets);

      expect(mocks.saveBudget).toHaveBeenCalledTimes(3);
      expect(mocks.saveBudget).toHaveBeenNthCalledWith(1, sampleBudget2);
      expect(mocks.saveBudget).toHaveBeenNthCalledWith(2, sampleBudget);
      expect(mocks.saveBudget).toHaveBeenNthCalledWith(3, sampleBudget3);
    });
  });
});

// ===========================================================================
// ExpenseRepository
// ===========================================================================

describe('ExpenseRepository', () => {
  let repo: ExpenseRepository;
  let mocks: ReturnType<typeof createMockAdapter>['mocks'];

  beforeEach(() => {
    const mock = createMockAdapter();
    repo = new ExpenseRepository(mock.adapter);
    mocks = mock.mocks;
  });

  // -------------------------------------------------------------------------
  // getAll -> adapter.loadExpenses
  // -------------------------------------------------------------------------

  describe('getAll', () => {
    it('delegates to adapter.loadExpenses()', async () => {
      const expenses: Expense[] = [sampleExpense];
      mocks.loadExpenses.mockResolvedValue(expenses);

      const result = await repo.getAll();

      expect(mocks.loadExpenses).toHaveBeenCalledTimes(1);
      expect(mocks.loadExpenses).toHaveBeenCalledWith();
      expect(result).toEqual(expenses);
    });
  });

  // -------------------------------------------------------------------------
  // save -> adapter.saveExpense
  // -------------------------------------------------------------------------

  describe('save', () => {
    it('delegates to adapter.saveExpense(expense)', async () => {
      await repo.save(sampleExpense);

      expect(mocks.saveExpense).toHaveBeenCalledTimes(1);
      expect(mocks.saveExpense).toHaveBeenCalledWith(sampleExpense);
    });
  });

  // -------------------------------------------------------------------------
  // update -> adapter.updateExpense
  // -------------------------------------------------------------------------

  describe('update', () => {
    it('delegates to adapter.updateExpense(expense)', async () => {
      await repo.update(sampleExpense);

      expect(mocks.updateExpense).toHaveBeenCalledTimes(1);
      expect(mocks.updateExpense).toHaveBeenCalledWith(sampleExpense);
    });
  });

  // -------------------------------------------------------------------------
  // delete -> adapter.deleteExpense
  // -------------------------------------------------------------------------

  describe('delete', () => {
    it('delegates to adapter.deleteExpense(expenseId)', async () => {
      await repo.delete('e1');

      expect(mocks.deleteExpense).toHaveBeenCalledTimes(1);
      expect(mocks.deleteExpense).toHaveBeenCalledWith('e1');
    });
  });

  // -------------------------------------------------------------------------
  // deleteByBudgetId -> adapter.deleteExpensesByBudget
  // -------------------------------------------------------------------------

  describe('deleteByBudgetId', () => {
    it('delegates to adapter.deleteExpensesByBudget(budgetId)', async () => {
      await repo.deleteByBudgetId('abc');

      expect(mocks.deleteExpensesByBudget).toHaveBeenCalledTimes(1);
      expect(mocks.deleteExpensesByBudget).toHaveBeenCalledWith('abc');
    });
  });
});
