// Unit tests for the createDebouncedAdapter debounce wrapper.
//
// These tests verify the debounce behavior required by Requirements
// 16.1, 16.2, 16.4, and 16.5:
//   - Save operations are debounced when backend is Firebase
//   - Multiple rapid calls within one window collapse to a single write
//   - Calls spanning multiple windows produce one write per window
//   - Delete/load/bulk operations are never debounced
//   - LocalStorageAdapter (isFirebase=false) passes through unchanged

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedAdapter } from './debounce';
import type { StorageAdapter } from './StorageAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

function makeMockAdapter(): StorageAdapter {
  return {
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
    loadAll: vi.fn().mockResolvedValue({ budgets: [], expenses: [], activeBudgetId: null }),
    saveAll: vi.fn().mockResolvedValue(undefined),
  };
}

const sampleBudget: BudgetGoal = {
  id: 'budget-1',
  name: 'Groceries',
  totalAmount: 1000,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
};

const sampleExpense: Expense = {
  id: 'expense-1',
  amount: 50,
  description: 'Lunch',
  date: '2024-01-15',
  category: 'Food',
  budgetId: 'budget-1',
  isEssential: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createDebouncedAdapter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // -- Pass-through when not Firebase -----------------------------------------

  describe('when isFirebase is false (LocalStorageAdapter)', () => {
    it('returns the original adapter unchanged', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, false);
      expect(wrapped).toBe(adapter);
    });

    it('does not debounce saveBudget (immediate execution)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, false);
      await wrapped.saveBudget(sampleBudget);
      expect(adapter.saveBudget).toHaveBeenCalledTimes(1);
      expect(adapter.saveBudget).toHaveBeenCalledWith(sampleBudget);
    });

    it('does not debounce saveExpense (immediate execution)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, false);
      await wrapped.saveExpense(sampleExpense);
      expect(adapter.saveExpense).toHaveBeenCalledTimes(1);
    });
  });

  // -- Debounce when Firebase --------------------------------------------------

  describe('when isFirebase is true (FirebaseAdapter)', () => {
    it('returns a different object (wrapper) from the original', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      expect(wrapped).not.toBe(adapter);
    });

    // Requirement 16.4: 10 rapid calls within one window → at most 1 write
    it('collapses 10 rapid saveExpense calls into a single write', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);

      for (let i = 0; i < 10; i++) {
        wrapped.saveExpense({ ...sampleExpense, amount: i + 1 });
      }

      // Nothing has been written yet (debounce window hasn't elapsed)
      expect(adapter.saveExpense).not.toHaveBeenCalled();

      // Advance past the debounce window (400ms)
      vi.advanceTimersByTime(400);

      // Only the last call's data should have been written
      expect(adapter.saveExpense).toHaveBeenCalledTimes(1);
      expect(adapter.saveExpense).toHaveBeenCalledWith({ ...sampleExpense, amount: 10 });
    });

    // Requirement 16.5: calls spanning multiple windows → one write per window
    it('produces one write per debounce window when calls span multiple windows', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);

      // First batch: 5 calls in window 1
      for (let i = 0; i < 5; i++) {
        wrapped.saveExpense({ ...sampleExpense, amount: i + 1 });
      }

      vi.advanceTimersByTime(400);
      expect(adapter.saveExpense).toHaveBeenCalledTimes(1);
      expect(adapter.saveExpense).toHaveBeenLastCalledWith({ ...sampleExpense, amount: 5 });

      // Second batch: 3 calls in window 2
      for (let i = 0; i < 3; i++) {
        wrapped.saveExpense({ ...sampleExpense, amount: 100 + i });
      }

      vi.advanceTimersByTime(400);
      expect(adapter.saveExpense).toHaveBeenCalledTimes(2);
      expect(adapter.saveExpense).toHaveBeenLastCalledWith({ ...sampleExpense, amount: 102 });
    });

    it('debounces saveBudget per budget id', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);

      wrapped.saveBudget({ ...sampleBudget, name: 'A' });
      wrapped.saveBudget({ ...sampleBudget, name: 'B' });
      wrapped.saveBudget({ ...sampleBudget, name: 'C' });

      vi.advanceTimersByTime(400);
      expect(adapter.saveBudget).toHaveBeenCalledTimes(1);
      expect(adapter.saveBudget).toHaveBeenCalledWith({ ...sampleBudget, name: 'C' });
    });

    it('debounces updateExpense per expense id', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);

      wrapped.updateExpense({ ...sampleExpense, amount: 10 });
      wrapped.updateExpense({ ...sampleExpense, amount: 20 });
      wrapped.updateExpense({ ...sampleExpense, amount: 30 });

      vi.advanceTimersByTime(400);
      expect(adapter.updateExpense).toHaveBeenCalledTimes(1);
      expect(adapter.updateExpense).toHaveBeenCalledWith({ ...sampleExpense, amount: 30 });
    });

    it('uses independent debounce keys per entity (budget vs expense)', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);

      wrapped.saveBudget(sampleBudget);
      wrapped.saveExpense(sampleExpense);

      // Both should still be pending (neither has fired)
      expect(adapter.saveBudget).not.toHaveBeenCalled();
      expect(adapter.saveExpense).not.toHaveBeenCalled();

      vi.advanceTimersByTime(400);

      // Both should fire independently
      expect(adapter.saveBudget).toHaveBeenCalledTimes(1);
      expect(adapter.saveExpense).toHaveBeenCalledTimes(1);
    });

    it('uses independent debounce keys for different expense ids', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);

      const expenseA: Expense = { ...sampleExpense, id: 'exp-a' };
      const expenseB: Expense = { ...sampleExpense, id: 'exp-b' };

      wrapped.saveExpense(expenseA);

      // Wait half the window, then save expense B
      vi.advanceTimersByTime(200);

      wrapped.saveExpense(expenseB);

      // Advance 200ms more — expense A's window (400ms from its call) has elapsed
      vi.advanceTimersByTime(200);
      expect(adapter.saveExpense).toHaveBeenCalledTimes(1);
      expect(adapter.saveExpense).toHaveBeenCalledWith(expenseA);

      // Advance the remaining 200ms — expense B's window elapses
      vi.advanceTimersByTime(200);
      expect(adapter.saveExpense).toHaveBeenCalledTimes(2);
    });

    it('debounces setActiveBudgetId under a single key', () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);

      wrapped.setActiveBudgetId('budget-a');
      wrapped.setActiveBudgetId('budget-b');
      wrapped.setActiveBudgetId('budget-c');

      vi.advanceTimersByTime(400);
      expect(adapter.setActiveBudgetId).toHaveBeenCalledTimes(1);
      expect(adapter.setActiveBudgetId).toHaveBeenCalledWith('budget-c');
    });

    // -- Non-debounced operations (immediate) ---------------------------------

    it('does not debounce deleteBudget (immediate)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      await wrapped.deleteBudget('budget-1');
      expect(adapter.deleteBudget).toHaveBeenCalledTimes(1);
    });

    it('does not debounce deleteExpense (immediate)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      await wrapped.deleteExpense('expense-1');
      expect(adapter.deleteExpense).toHaveBeenCalledTimes(1);
    });

    it('does not debounce deleteExpensesByBudget (immediate)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      await wrapped.deleteExpensesByBudget('budget-1');
      expect(adapter.deleteExpensesByBudget).toHaveBeenCalledTimes(1);
    });

    it('does not debounce loadBudgets (immediate)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      await wrapped.loadBudgets();
      expect(adapter.loadBudgets).toHaveBeenCalledTimes(1);
    });

    it('does not debounce loadExpenses (immediate)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      await wrapped.loadExpenses();
      expect(adapter.loadExpenses).toHaveBeenCalledTimes(1);
    });

    it('does not debounce getActiveBudgetId (immediate)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      await wrapped.getActiveBudgetId();
      expect(adapter.getActiveBudgetId).toHaveBeenCalledTimes(1);
    });

    it('does not debounce loadAll (immediate)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      await wrapped.loadAll();
      expect(adapter.loadAll).toHaveBeenCalledTimes(1);
    });

    it('does not debounce saveAll (immediate)', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);
      const data: StorageData = { budgets: [sampleBudget], expenses: [], activeBudgetId: 'budget-1' };
      await wrapped.saveAll(data);
      expect(adapter.saveAll).toHaveBeenCalledTimes(1);
      expect(adapter.saveAll).toHaveBeenCalledWith(data);
    });

    // -- Promise resolution -----------------------------------------------------

    it('resolves the debounced saveExpense promise after the window elapses', async () => {
      const adapter = makeMockAdapter();
      const wrapped = createDebouncedAdapter(adapter, true);

      const promise = wrapped.saveExpense(sampleExpense);
      let resolved = false;
      promise.then(() => { resolved = true; });

      // Not resolved yet
      vi.advanceTimersByTime(200);
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
      expect(resolved).toBe(true);
    });

    it('rejects the promise if the underlying save fails', async () => {
      const adapter = makeMockAdapter();
      adapter.saveExpense = vi.fn().mockRejectedValue(new Error('Firestore write failed'));
      const wrapped = createDebouncedAdapter(adapter, true);

      const promise = wrapped.saveExpense(sampleExpense);
      vi.advanceTimersByTime(400);

      await expect(promise).rejects.toThrow('Firestore write failed');
    });
  });
});
