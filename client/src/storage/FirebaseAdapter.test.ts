// Unit tests for FirebaseAdapter.
//
// These tests verify the Firebase Firestore-backed storage adapter using
// vitest mocks for the firebase/firestore module. Tests cover all
// StorageAdapter operations including the partial-failure rejection
// behavior of deleteExpensesByBudget (Requirement 3.9) and error
// propagation when Firestore is unavailable (Requirement 3.10).

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup (hoisted so vi.mock factories can reference the mock fns)
// ---------------------------------------------------------------------------

const { mockGetDocs, mockSetDoc, mockDeleteDoc, mockGetDoc, mockWriteBatch } =
  vi.hoisted(() => ({
    mockGetDocs: vi.fn(),
    mockSetDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockGetDoc: vi.fn(),
    mockWriteBatch: vi.fn(),
  }));

// Mock the firebaseConfig module to provide a fake db
vi.mock('./firebaseConfig', () => ({
  db: {},
  app: {},
}));

// Mock firebase/firestore functions
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  getDoc: mockGetDoc,
  doc: vi.fn((_db: unknown, collectionName: string, id: string) => ({
    path: `${collectionName}/${id}`,
  })),
  query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  writeBatch: mockWriteBatch,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { FirebaseAdapter } from './FirebaseAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleBudget: BudgetGoal = {
  id: 'budget-1',
  name: 'Monthly Budget',
  totalAmount: 5000,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
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

// ---------------------------------------------------------------------------
// Snapshot helpers
// ---------------------------------------------------------------------------

interface MockDoc {
  id: string;
  data: Record<string, unknown>;
}

function makeSnapshot(docs: MockDoc[]) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    forEach: (
      callback: (doc: {
        id: string;
        data: () => Record<string, unknown>;
        ref: unknown;
      }) => void,
    ) => {
      docs.forEach((doc) =>
        callback({
          id: doc.id,
          data: () => doc.data,
          ref: { path: `expenses/${doc.id}` },
        }),
      );
    },
  };
}

function makeDocSnapshot(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists: () => exists,
    data: () => data ?? {},
  };
}

function makeBatch() {
  const operations: Array<{ type: string; ref: unknown; data?: unknown }> = [];
  return {
    set: vi.fn((ref: unknown, data: unknown) =>
      operations.push({ type: 'set', ref, data }),
    ),
    delete: vi.fn((ref: unknown) => operations.push({ type: 'delete', ref })),
    commit: vi.fn().mockResolvedValue(undefined),
    operations,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let adapter: FirebaseAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  mockSetDoc.mockResolvedValue(undefined);
  mockDeleteDoc.mockResolvedValue(undefined);
  adapter = new FirebaseAdapter();
});

// ---------------------------------------------------------------------------
// loadBudgets
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - loadBudgets', () => {
  it('returns budgets from Firestore', async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        {
          id: 'budget-1',
          data: {
            name: 'Monthly Budget',
            totalAmount: 5000,
            startDate: '2024-01-01',
            endDate: '2024-01-31',
          },
        },
        {
          id: 'budget-2',
          data: {
            name: 'Vacation Fund',
            totalAmount: 3000,
            startDate: '2024-06-01',
            endDate: '2024-08-31',
          },
        },
      ]),
    );

    const result = await adapter.loadBudgets();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(sampleBudget);
    expect(result[1]).toEqual(sampleBudget2);
  });

  it('returns empty array when no documents', async () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([]));

    const result = await adapter.loadBudgets();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveBudget
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - saveBudget', () => {
  it('calls setDoc with correct collection and document ID', async () => {
    await adapter.saveBudget(sampleBudget);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, data] = mockSetDoc.mock.calls[0];
    expect(docRef).toEqual({ path: 'budgets/budget-1' });
    expect(data).toEqual(sampleBudget);
  });

  it('persists budget data', async () => {
    await adapter.saveBudget(sampleBudget);

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'budgets/budget-1' }),
      sampleBudget,
    );
  });
});

// ---------------------------------------------------------------------------
// deleteBudget
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - deleteBudget', () => {
  it('calls deleteDoc with correct path', async () => {
    await adapter.deleteBudget('budget-1');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).toHaveBeenCalledWith({ path: 'budgets/budget-1' });
  });
});

// ---------------------------------------------------------------------------
// loadExpenses
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - loadExpenses', () => {
  it('returns expenses from Firestore', async () => {
    mockGetDocs.mockResolvedValue(
      makeSnapshot([
        {
          id: 'expense-1',
          data: {
            amount: 50,
            description: 'Lunch',
            date: '2024-01-15',
            category: 'Food',
            budgetId: 'budget-1',
            isEssential: true,
          },
        },
        {
          id: 'expense-2',
          data: {
            amount: 120,
            description: 'Gas',
            date: '2024-01-16',
            category: 'Transport',
            budgetId: 'budget-1',
            isEssential: false,
          },
        },
      ]),
    );

    const result = await adapter.loadExpenses();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(sampleExpense);
    expect(result[1]).toEqual(sampleExpense2);
  });

  it('returns empty array when no documents', async () => {
    mockGetDocs.mockResolvedValue(makeSnapshot([]));

    const result = await adapter.loadExpenses();
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// saveExpense
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - saveExpense', () => {
  it('calls setDoc with correct collection and document ID', async () => {
    await adapter.saveExpense(sampleExpense);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, data] = mockSetDoc.mock.calls[0];
    expect(docRef).toEqual({ path: 'expenses/expense-1' });
    expect(data).toEqual(sampleExpense);
  });

  it('rejects with descriptive error when Firestore is unavailable (Requirement 3.10)', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('Firestore unavailable'));

    await expect(adapter.saveExpense(sampleExpense)).rejects.toThrow(
      'Firestore unavailable',
    );
  });
});

// ---------------------------------------------------------------------------
// updateExpense
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - updateExpense', () => {
  it('calls setDoc with merge option', async () => {
    await adapter.updateExpense(sampleExpense);

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, data, options] = mockSetDoc.mock.calls[0];
    expect(docRef).toEqual({ path: 'expenses/expense-1' });
    expect(data).toEqual(sampleExpense);
    expect(options).toEqual({ merge: true });
  });
});

// ---------------------------------------------------------------------------
// deleteExpense
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - deleteExpense', () => {
  it('calls deleteDoc with correct path', async () => {
    await adapter.deleteExpense('expense-1');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).toHaveBeenCalledWith({ path: 'expenses/expense-1' });
  });
});

// ---------------------------------------------------------------------------
// deleteExpensesByBudget
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - deleteExpensesByBudget', () => {
  it('deletes all matching expenses in a batch', async () => {
    const batch = makeBatch();
    mockWriteBatch.mockReturnValue(batch);

    mockGetDocs
      .mockResolvedValueOnce(
        makeSnapshot([
          { id: 'expense-1', data: { budgetId: 'budget-1', amount: 50 } },
          { id: 'expense-2', data: { budgetId: 'budget-1', amount: 120 } },
        ]),
      )
      .mockResolvedValueOnce(makeSnapshot([])); // verification: empty

    await adapter.deleteExpensesByBudget('budget-1');

    // Batch delete was called for each expense
    expect(batch.delete).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('rejects if expenses remain after deletion (Requirement 3.9)', async () => {
    const batch = makeBatch();
    mockWriteBatch.mockReturnValue(batch);

    mockGetDocs
      .mockResolvedValueOnce(
        makeSnapshot([
          { id: 'expense-1', data: { budgetId: 'budget-1', amount: 50 } },
          { id: 'expense-2', data: { budgetId: 'budget-1', amount: 120 } },
        ]),
      )
      .mockResolvedValueOnce(
        // verification: one expense still remains
        makeSnapshot([
          { id: 'expense-1', data: { budgetId: 'budget-1', amount: 50 } },
        ]),
      );

    await expect(adapter.deleteExpensesByBudget('budget-1')).rejects.toThrow(
      /Failed to delete all expenses for budget budget-1: 1 remaining/,
    );

    // batch.delete was still called for both expenses
    expect(batch.delete).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when no matching expenses exist', async () => {
    mockGetDocs.mockResolvedValueOnce(makeSnapshot([]));

    await adapter.deleteExpensesByBudget('budget-1');

    // writeBatch should not have been called
    expect(mockWriteBatch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getActiveBudgetId
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - getActiveBudgetId', () => {
  it('returns the stored value', async () => {
    mockGetDoc.mockResolvedValue(
      makeDocSnapshot(true, { activeBudgetId: 'budget-1' }),
    );

    const result = await adapter.getActiveBudgetId();
    expect(result).toBe('budget-1');
  });

  it('returns null when document does not exist', async () => {
    mockGetDoc.mockResolvedValue(makeDocSnapshot(false));

    const result = await adapter.getActiveBudgetId();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setActiveBudgetId
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - setActiveBudgetId', () => {
  it('calls setDoc with metadata/activeBudget', async () => {
    await adapter.setActiveBudgetId('budget-1');

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, data] = mockSetDoc.mock.calls[0];
    expect(docRef).toEqual({ path: 'metadata/activeBudget' });
    expect(data).toEqual({ activeBudgetId: 'budget-1' });
  });
});

// ---------------------------------------------------------------------------
// loadAll
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - loadAll', () => {
  it('combines loadBudgets, loadExpenses, and getActiveBudgetId', async () => {
    // loadBudgets uses getDocs (call 1), loadExpenses uses getDocs (call 2),
    // getActiveBudgetId uses getDoc
    mockGetDocs
      .mockResolvedValueOnce(
        makeSnapshot([
          {
            id: 'budget-1',
            data: {
              name: 'Monthly Budget',
              totalAmount: 5000,
              startDate: '2024-01-01',
              endDate: '2024-01-31',
            },
          },
        ]),
      )
      .mockResolvedValueOnce(
        makeSnapshot([
          {
            id: 'expense-1',
            data: {
              amount: 50,
              description: 'Lunch',
              date: '2024-01-15',
              category: 'Food',
              budgetId: 'budget-1',
              isEssential: true,
            },
          },
        ]),
      );
    mockGetDoc.mockResolvedValueOnce(
      makeDocSnapshot(true, { activeBudgetId: 'budget-1' }),
    );

    const result = await adapter.loadAll();

    expect(result).toEqual({
      budgets: [sampleBudget],
      expenses: [sampleExpense],
      activeBudgetId: 'budget-1',
    });
  });
});

// ---------------------------------------------------------------------------
// saveAll
// ---------------------------------------------------------------------------

describe('FirebaseAdapter - saveAll', () => {
  it('uses writeBatch to save all budgets, expenses, and activeBudgetId', async () => {
    const batch = makeBatch();
    mockWriteBatch.mockReturnValue(batch);

    const data: StorageData = {
      budgets: [sampleBudget],
      expenses: [sampleExpense],
      activeBudgetId: 'budget-1',
    };

    await adapter.saveAll(data);

    // batch.set called for budget, expense, and metadata
    expect(batch.set).toHaveBeenCalledTimes(3);

    expect(batch.set).toHaveBeenCalledWith(
      { path: 'budgets/budget-1' },
      sampleBudget,
    );
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'expenses/expense-1' },
      sampleExpense,
    );
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'metadata/activeBudget' },
      { activeBudgetId: 'budget-1' },
    );

    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('does not save activeBudgetId when null', async () => {
    const batch = makeBatch();
    mockWriteBatch.mockReturnValue(batch);

    const data: StorageData = {
      budgets: [sampleBudget],
      expenses: [sampleExpense],
      activeBudgetId: null,
    };

    await adapter.saveAll(data);

    // Only budget and expense should be set, not metadata
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'budgets/budget-1' },
      sampleBudget,
    );
    expect(batch.set).toHaveBeenCalledWith(
      { path: 'expenses/expense-1' },
      sampleExpense,
    );
    // Verify metadata/activeBudget was not among the calls
    expect(batch.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: 'metadata/activeBudget' }),
      expect.anything(),
    );

    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
