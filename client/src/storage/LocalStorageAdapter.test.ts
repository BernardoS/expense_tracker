// Unit tests for LocalStorageAdapter.
//
// These tests verify the localStorage-backed storage adapter required by
// Requirements 2.4, 2.5, 2.6, and 15.5:
//   - loadAll() returns existing data from localStorage (2.4)
//   - loadAll() returns empty data when localStorage is empty
//   - loadAll() returns empty data on corrupted JSON without throwing (2.5, 15.5)
//   - saveBudget() persists a budget to localStorage JSON (2.6)
//   - saveExpense() persists an expense to localStorage
//   - deleteBudget() / deleteExpense() remove entries by id
//   - round-trip: save then loadAll returns the saved data; delete then loadAll
//     excludes the deleted data

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'expense_tracker_data_v2';

const sampleBudget: BudgetGoal = {
  id: 'budget-1',
  name: 'Monthly Budget',
  totalAmount: 5000,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  categoryLimits: [{ category: 'Food', maxAmount: 1000 }],
};

const sampleBudget2: BudgetGoal = {
  id: 'budget-2',
  name: 'Vacation Fund',
  totalAmount: 3000,
  startDate: '2024-06-01',
  endDate: '2024-08-31',
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

const sampleExpense2: Expense = {
  id: 'expense-2',
  amount: 120,
  description: 'Gas',
  date: '2024-01-16',
  category: 'Transport',
  budgetId: 'budget-1',
  isEssential: false,
};

const emptyData: StorageData = {
  budgets: [],
  expenses: [],
  activeBudgetId: null,
};

// ---------------------------------------------------------------------------
// localStorage mock helpers
// ---------------------------------------------------------------------------

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  (global as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
});

afterEach(() => {
  delete (global as any).localStorage;
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// loadAll
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter - loadAll', () => {
  it('returns existing data from localStorage', async () => {
    const data: StorageData = {
      budgets: [sampleBudget],
      expenses: [sampleExpense],
      activeBudgetId: 'budget-1',
    };
    store.set(STORAGE_KEY, JSON.stringify(data));

    const adapter = new LocalStorageAdapter();
    const result = await adapter.loadAll();

    expect(result).toEqual(data);
    expect(result.budgets).toHaveLength(1);
    expect(result.expenses).toHaveLength(1);
    expect(result.activeBudgetId).toBe('budget-1');
  });

  it('returns empty data when localStorage is empty', async () => {
    const adapter = new LocalStorageAdapter();
    const result = await adapter.loadAll();

    expect(result).toEqual(emptyData);
    expect(result.budgets).toHaveLength(0);
    expect(result.expenses).toHaveLength(0);
    expect(result.activeBudgetId).toBeNull();
  });

  it('returns empty data on corrupted JSON without throwing', async () => {
    store.set(STORAGE_KEY, 'not valid json {{{');

    const adapter = new LocalStorageAdapter();
    const result = await adapter.loadAll();

    expect(result).toEqual(emptyData);
  });

  it('never throws an unhandled exception', async () => {
    store.set(STORAGE_KEY, '{broken');
    const adapter = new LocalStorageAdapter();

    await expect(adapter.loadAll()).resolves.toEqual(emptyData);
  });
});

// ---------------------------------------------------------------------------
// saveBudget
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter - saveBudget', () => {
  it('adds a new budget to localStorage JSON', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBudget(sampleBudget);

    const raw = store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!) as StorageData;
    expect(parsed.budgets).toHaveLength(1);
    expect(parsed.budgets[0]).toEqual(sampleBudget);
  });

  it('updates an existing budget without duplicating it', async () => {
    store.set(STORAGE_KEY, JSON.stringify({ ...emptyData, budgets: [sampleBudget] }));

    const adapter = new LocalStorageAdapter();
    const updatedBudget: BudgetGoal = { ...sampleBudget, name: 'Updated Budget', totalAmount: 6000 };
    await adapter.saveBudget(updatedBudget);

    const raw = store.get(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as StorageData;
    expect(parsed.budgets).toHaveLength(1);
    expect(parsed.budgets[0]).toEqual(updatedBudget);
  });

  it('persists data under the correct storage key', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBudget(sampleBudget);

    expect(store.has(STORAGE_KEY)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// saveExpense
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter - saveExpense', () => {
  it('adds a new expense to localStorage JSON', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveExpense(sampleExpense);

    const raw = store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!) as StorageData;
    expect(parsed.expenses).toHaveLength(1);
    expect(parsed.expenses[0]).toEqual(sampleExpense);
  });

  it('updates an existing expense without duplicating it', async () => {
    store.set(STORAGE_KEY, JSON.stringify({ ...emptyData, expenses: [sampleExpense] }));

    const adapter = new LocalStorageAdapter();
    const updatedExpense: Expense = { ...sampleExpense, amount: 75, description: 'Dinner' };
    await adapter.saveExpense(updatedExpense);

    const raw = store.get(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as StorageData;
    expect(parsed.expenses).toHaveLength(1);
    expect(parsed.expenses[0]).toEqual(updatedExpense);
  });
});

// ---------------------------------------------------------------------------
// deleteBudget
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter - deleteBudget', () => {
  it('removes a budget by id', async () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({ ...emptyData, budgets: [sampleBudget, sampleBudget2] }),
    );

    const adapter = new LocalStorageAdapter();
    await adapter.deleteBudget('budget-1');

    const raw = store.get(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as StorageData;
    expect(parsed.budgets).toHaveLength(1);
    expect(parsed.budgets.find((b) => b.id === 'budget-1')).toBeUndefined();
    expect(parsed.budgets[0]).toEqual(sampleBudget2);
  });

  it('is a no-op when the budget does not exist', async () => {
    store.set(STORAGE_KEY, JSON.stringify({ ...emptyData, budgets: [sampleBudget] }));

    const adapter = new LocalStorageAdapter();
    await adapter.deleteBudget('non-existent-id');

    const raw = store.get(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as StorageData;
    expect(parsed.budgets).toHaveLength(1);
    expect(parsed.budgets[0]).toEqual(sampleBudget);
  });
});

// ---------------------------------------------------------------------------
// deleteExpense
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter - deleteExpense', () => {
  it('removes an expense by id', async () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify({ ...emptyData, expenses: [sampleExpense, sampleExpense2] }),
    );

    const adapter = new LocalStorageAdapter();
    await adapter.deleteExpense('expense-1');

    const raw = store.get(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as StorageData;
    expect(parsed.expenses).toHaveLength(1);
    expect(parsed.expenses.find((e) => e.id === 'expense-1')).toBeUndefined();
    expect(parsed.expenses[0]).toEqual(sampleExpense2);
  });

  it('is a no-op when the expense does not exist', async () => {
    store.set(STORAGE_KEY, JSON.stringify({ ...emptyData, expenses: [sampleExpense] }));

    const adapter = new LocalStorageAdapter();
    await adapter.deleteExpense('non-existent-id');

    const raw = store.get(STORAGE_KEY);
    const parsed = JSON.parse(raw!) as StorageData;
    expect(parsed.expenses).toHaveLength(1);
    expect(parsed.expenses[0]).toEqual(sampleExpense);
  });
});

// ---------------------------------------------------------------------------
// round-trip (save/delete then loadAll)
// ---------------------------------------------------------------------------

describe('LocalStorageAdapter - round-trip', () => {
  it('save budget then loadAll includes the budget', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBudget(sampleBudget);

    const result = await adapter.loadAll();
    expect(result.budgets).toContainEqual(sampleBudget);
  });

  it('save expense then loadAll includes the expense', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveExpense(sampleExpense);

    const result = await adapter.loadAll();
    expect(result.expenses).toContainEqual(sampleExpense);
  });

  it('delete budget then loadAll excludes the budget', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBudget(sampleBudget);
    await adapter.saveBudget(sampleBudget2);
    await adapter.deleteBudget('budget-1');

    const result = await adapter.loadAll();
    expect(result.budgets).not.toContainEqual(sampleBudget);
    expect(result.budgets).toContainEqual(sampleBudget2);
  });

  it('delete expense then loadAll excludes the expense', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveExpense(sampleExpense);
    await adapter.saveExpense(sampleExpense2);
    await adapter.deleteExpense('expense-1');

    const result = await adapter.loadAll();
    expect(result.expenses).not.toContainEqual(sampleExpense);
    expect(result.expenses).toContainEqual(sampleExpense2);
  });

  it('save multiple budgets and expenses then loadAll returns all', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBudget(sampleBudget);
    await adapter.saveBudget(sampleBudget2);
    await adapter.saveExpense(sampleExpense);
    await adapter.saveExpense(sampleExpense2);

    const result = await adapter.loadAll();
    expect(result.budgets).toHaveLength(2);
    expect(result.expenses).toHaveLength(2);
    expect(result.budgets).toEqual(expect.arrayContaining([sampleBudget, sampleBudget2]));
    expect(result.expenses).toEqual(expect.arrayContaining([sampleExpense, sampleExpense2]));
  });

  it('save, delete, then loadAll reflects the changes', async () => {
    const adapter = new LocalStorageAdapter();
    await adapter.saveBudget(sampleBudget);
    await adapter.saveExpense(sampleExpense);
    await adapter.saveBudget(sampleBudget2);
    await adapter.saveExpense(sampleExpense2);

    // Delete one of each
    await adapter.deleteBudget('budget-1');
    await adapter.deleteExpense('expense-1');

    const result = await adapter.loadAll();
    expect(result.budgets).toHaveLength(1);
    expect(result.budgets[0]).toEqual(sampleBudget2);
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0]).toEqual(sampleExpense2);
  });
});
