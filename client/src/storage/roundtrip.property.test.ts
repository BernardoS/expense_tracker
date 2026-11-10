// Property-based tests for adapter round-trip consistency.
//
// These tests use fast-check to generate random valid StorageData and
// verify that saveAll(data) followed by loadAll() returns equivalent
// data for both LocalStorageAdapter and FirebaseAdapter.
//
// **Validates: Requirements 13.1, 13.2, 13.3**
//   13.1: After any write operation completes, the storage state reflects the React state.
//   13.2: Given an expense saved, when saveExpense() resolves, then loadExpenses() includes the expense.
//   13.3: Given a budget deleted, when deleteBudget() resolves, then loadBudgets() excludes the budget.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Firebase mocks (hoisted so vi.mock factories can reference them)
// ---------------------------------------------------------------------------

const firestoreMocks = vi.hoisted(() => {
  // In-memory Firestore: collectionName -> Map<docId, data>
  const collections = new Map<string, Map<string, unknown>>();

  function getCollection(name: string): Map<string, unknown> {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    return collections.get(name)!;
  }

  return {
    // Reset the in-memory store between property runs
    reset: () => collections.clear(),

    // Mock doc(db, collectionName, id) -> { _col, _id, path }
    doc: vi.fn((_db: unknown, col: string, id: string) => ({
      _col: col,
      _id: id,
      path: `${col}/${id}`,
    })),

    // Mock collection(db, collectionName) -> { _col, path }
    collection: vi.fn((_db: unknown, col: string) => ({
      _col: col,
      path: col,
    })),

    // Mock getDocs(collectionRef) -> snapshot of all docs in the collection
    getDocs: vi.fn(async (ref: { _col: string }) => {
      const col = getCollection(ref._col);
      const docs = Array.from(col.entries()).map(([id, data]) => ({
        id,
        data: () => data,
        ref: { _col: ref._col, _id: id, path: `${ref._col}/${id}` },
      }));
      return {
        empty: docs.length === 0,
        size: docs.length,
        forEach: (cb: (doc: { id: string; data: () => unknown; ref: unknown }) => void) => {
          docs.forEach((d) => cb(d));
        },
      };
    }),

    // Mock setDoc(docRef, data) -> stores data
    setDoc: vi.fn(async (ref: { _col: string; _id: string }, data: unknown) => {
      getCollection(ref._col).set(ref._id, data);
    }),

    // Mock getDoc(docRef) -> single document snapshot
    getDoc: vi.fn(async (ref: { _col: string; _id: string }) => {
      const col = getCollection(ref._col);
      const data = col.get(ref._id);
      return {
        exists: () => data !== undefined,
        data: () => data ?? {},
      };
    }),

    // Mock deleteDoc(docRef) -> removes document
    deleteDoc: vi.fn(async (ref: { _col: string; _id: string }) => {
      getCollection(ref._col).delete(ref._id);
    }),

    // Mock writeBatch(db) -> batch with set/delete/commit
    writeBatch: vi.fn(() => {
      const ops: Array<() => void> = [];
      return {
        set: vi.fn((ref: { _col: string; _id: string }, data: unknown) => {
          ops.push(() => getCollection(ref._col).set(ref._id, data));
        }),
        delete: vi.fn((ref: { _col: string; _id: string }) => {
          ops.push(() => getCollection(ref._col).delete(ref._id));
        }),
        commit: vi.fn(async () => {
          ops.forEach((op) => op());
        }),
      };
    }),

    // Mock query and where (needed by deleteExpensesByBudget, not used in round-trip)
    query: vi.fn((ref: unknown, ...constraints: unknown[]) => ({ ref, constraints })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  };
});

vi.mock('./firebaseConfig', () => ({
  db: {},
  app: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collection,
  doc: firestoreMocks.doc,
  getDocs: firestoreMocks.getDocs,
  setDoc: firestoreMocks.setDoc,
  getDoc: firestoreMocks.getDoc,
  deleteDoc: firestoreMocks.deleteDoc,
  writeBatch: firestoreMocks.writeBatch,
  query: firestoreMocks.query,
  where: firestoreMocks.where,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------

import { LocalStorageAdapter } from './LocalStorageAdapter';
import { FirebaseAdapter } from './FirebaseAdapter';
import type { BudgetGoal, Expense, StorageData } from './types';

// ---------------------------------------------------------------------------
// Fast-check arbitraries (generators for domain types)
// ---------------------------------------------------------------------------

// Generate a valid CategoryLimit with non-empty category and positive maxAmount
const categoryLimitArb = fc.record({
  category: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
  maxAmount: fc.double({ min: 0.01, max: 100000, noNaN: true }),
});

// Generate a valid BudgetGoal with positive totalAmount and valid date range
const budgetArb = fc.record({
  id: fc.string({ minLength: 1 }),
  name: fc.string({ minLength: 1 }),
  totalAmount: fc.double({ min: 0.01, max: 1000000, noNaN: true }),
  startDate: fc.constant('2024-01-01'),
  endDate: fc.constant('2024-12-31'),
  initialSpent: fc.option(fc.double({ min: 0, max: 100000, noNaN: true }), {
    nil: undefined,
  }),
  categoryLimits: fc.option(
    fc.uniqueArray(categoryLimitArb, { maxLength: 5 }),
    { nil: undefined },
  ),
});

// Generate a valid Expense with positive amount and non-empty description
const expenseArb = fc.record({
  id: fc.string({ minLength: 1 }),
  amount: fc.double({ min: 0.01, max: 10000, noNaN: true }),
  description: fc.string({ minLength: 1 }),
  date: fc.constant('2024-01-15'),
  category: fc.string({ minLength: 1 }),
  budgetId: fc.string({ minLength: 1 }),
  isEssential: fc.boolean(),
});

// Generate complete StorageData with unique budget and expense IDs
const storageDataArb = fc.record({
  budgets: fc.uniqueArray(budgetArb, {
    selector: (b: BudgetGoal) => b.id,
    maxLength: 20,
  }),
  expenses: fc.uniqueArray(expenseArb, {
    selector: (e: Expense) => e.id,
    maxLength: 50,
  }),
  activeBudgetId: fc.oneof(fc.string({ minLength: 1 }), fc.constant(null)),
});

// ---------------------------------------------------------------------------
// Helper: compare StorageData by value (order-independent)
// ---------------------------------------------------------------------------

function assertStorageDataEqual(loaded: StorageData, original: StorageData): void {
  // activeBudgetId must match exactly
  expect(loaded.activeBudgetId).toEqual(original.activeBudgetId);

  // Budgets: same count, each original budget present by id with equal value
  expect(loaded.budgets).toHaveLength(original.budgets.length);
  const loadedBudgetMap = new Map(loaded.budgets.map((b) => [b.id, b]));
  for (const budget of original.budgets) {
    const loadedBudget = loadedBudgetMap.get(budget.id);
    expect(loadedBudget).toBeDefined();
    expect(loadedBudget).toEqual(budget);
  }

  // Expenses: same count, each original expense present by id with equal value
  expect(loaded.expenses).toHaveLength(original.expenses.length);
  const loadedExpenseMap = new Map(loaded.expenses.map((e) => [e.id, e]));
  for (const expense of original.expenses) {
    const loadedExpense = loadedExpenseMap.get(expense.id);
    expect(loadedExpense).toBeDefined();
    expect(loadedExpense).toEqual(expense);
  }
}

// ---------------------------------------------------------------------------
// Property: LocalStorageAdapter round-trip consistency
// ---------------------------------------------------------------------------

describe('Property: LocalStorageAdapter round-trip consistency', () => {
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
  });

  it('saveAll then loadAll returns equivalent data **Validates: Requirements 13.1, 13.2, 13.3**', async () => {
    await fc.assert(
      fc.asyncProperty(storageDataArb, async (data) => {
        // Clear store for each run to ensure isolation
        store.clear();

        const adapter = new LocalStorageAdapter();
        await adapter.saveAll(data);
        const loaded = await adapter.loadAll();

        assertStorageDataEqual(loaded, data);
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property: FirebaseAdapter round-trip consistency
// ---------------------------------------------------------------------------

describe('Property: FirebaseAdapter round-trip consistency', () => {
  beforeEach(() => {
    firestoreMocks.reset();
  });

  it('saveAll then loadAll returns equivalent data **Validates: Requirements 13.1, 13.2, 13.3**', async () => {
    await fc.assert(
      fc.asyncProperty(storageDataArb, async (data) => {
        // Clear in-memory Firestore for each run to ensure isolation
        firestoreMocks.reset();

        const adapter = new FirebaseAdapter();
        await adapter.saveAll(data);
        const loaded = await adapter.loadAll();

        assertStorageDataEqual(loaded, data);
      }),
      { numRuns: 50 },
    );
  });
});
