import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import type { Expense, BudgetGoal, CategoryLimit, StorageData } from '@/storage/types';
import { StorageFactory } from '@/storage/StorageFactory';
import { BudgetRepository } from '@/storage/BudgetRepository';
import { ExpenseRepository } from '@/storage/ExpenseRepository';
import { createDebouncedAdapter } from '@/storage/debounce';

// Re-export the shared storage types so that existing imports from
// ExpenseContext (e.g. `import { Expense } from '@/contexts/ExpenseContext'`)
// continue to resolve. The canonical definitions now live in
// `@/storage/types`, which the storage layer also depends on.
export type { Expense, BudgetGoal, CategoryLimit, StorageData } from '@/storage/types';

interface ExpenseContextType {
  budgets: BudgetGoal[];
  activeBudgetId: string | null;
  expenses: Expense[];
  activeBudget: BudgetGoal | null;
  addExpense: (expense: Omit<Expense, 'id' | 'budgetId'>) => Promise<void>;
  setBudgetGoal: (goal: Omit<BudgetGoal, 'id'>) => Promise<void>;
  deleteBudget: (budgetId: string) => Promise<void>;
  setActiveBudget: (budgetId: string) => Promise<void>;
  getDailySpent: (date: string) => number;
  getMonthlySpent: () => number;
  getDailyBudget: (date: string) => number;
  getDailyRemaining: (date: string) => number;
  getMonthlyRemaining: () => number;
  getTotalBudget: () => number;
  getAdjustedDailyLimit: (date: string) => number;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, updatedExpense: Omit<Expense, 'id' | 'budgetId'>) => Promise<void>;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  setCategoryLimit: (category: string, maxAmount: number) => Promise<void>;
  getCategorySpent: (category: string) => number;
  getCategoryLimit: (category: string) => number | undefined;
  getExceededCategories: () => { category: string; spent: number; limit: number }[];
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

const STORAGE_KEY = 'expense_tracker_data_v2';

// ---------------------------------------------------------------------------
// Zod schemas for import data validation (Requirement 9.2, 9.3, 17.2)
//
// These schemas mirror the domain types in `@/storage/types`. They are
// defined at module level so they are created once and reused across
// import calls, rather than being rebuilt on every import.
// ---------------------------------------------------------------------------

const categoryLimitSchema = z.object({
  category: z.string().min(1),
  maxAmount: z.number().positive(),
});

const budgetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  totalAmount: z.number().positive(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  initialSpent: z.number().nonnegative().optional(),
  categoryLimits: z.array(categoryLimitSchema).optional(),
});

const expenseSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().min(1),
  date: z.string().min(1),
  category: z.string().min(1),
  budgetId: z.string().min(1),
  isEssential: z.boolean(),
});

const storageDataSchema = z.object({
  budgets: z.array(budgetSchema),
  expenses: z.array(expenseSchema),
  activeBudgetId: z.string().nullable(),
});

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [budgets, setBudgets] = useState<BudgetGoal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Create adapter and repositories once (Requirement 6.2).
  // When the backend is Firebase, save/update operations are debounced
  // to reduce Firestore write costs (Requirement 16.1). LocalStorageAdapter
  // operations pass through without debounce since they are synchronous.
  const adapter = useMemo(() => {
    const rawAdapter = StorageFactory.create();
    const isFirebase = import.meta.env.VITE_STORAGE_BACKEND === 'firebase';
    return createDebouncedAdapter(rawAdapter, isFirebase);
  }, []);
  const budgetRepo = useMemo(() => new BudgetRepository(adapter), [adapter]);
  const expenseRepo = useMemo(() => new ExpenseRepository(adapter), [adapter]);

  // Load from storage adapter on mount (Requirement 6.3, 6.8)
  useEffect(() => {
    (async () => {
      try {
        const data = await adapter.loadAll();
        setBudgets(data.budgets || []);
        setExpenses(data.expenses || []);
        const activeId = data.activeBudgetId || (data.budgets?.[0]?.id || null);
        setActiveBudgetId(activeId);
      } catch (e) {
        console.error('Failed to load data from storage', e);
      }
      setIsLoaded(true);
    })();
  }, [adapter]);

  const activeBudget = budgets.find((b) => b.id === activeBudgetId) || null;

  const addExpense = async (expense: Omit<Expense, 'id' | 'budgetId'>) => {
    if (!activeBudgetId) return;
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString(),
      budgetId: activeBudgetId,
    };
    const prevExpenses = expenses;
    setExpenses([...expenses, newExpense]);
    try {
      await expenseRepo.save(newExpense);
    } catch (e) {
      setExpenses(prevExpenses);
      toast.error('Erro ao salvar despesa');
      console.error('Failed to save expense', e);
    }
  };

  const deleteExpense = async (id: string) => {
    const prevExpenses = expenses;
    setExpenses(expenses.filter(exp => exp.id !== id));
    try {
      await expenseRepo.delete(id);
    } catch (e) {
      setExpenses(prevExpenses);
      toast.error('Erro ao deletar despesa');
      console.error('Failed to delete expense', e);
    }
  };

  const updateExpense = async (id: string, updatedExpense: Omit<Expense, 'id' | 'budgetId'>) => {
    const prevExpenses = expenses;
    setExpenses(expenses.map(exp =>
      exp.id === id
        ? { ...exp, ...updatedExpense }
        : exp
    ));
    try {
      const existing = expenses.find(e => e.id === id);
      if (existing) {
        await expenseRepo.update({ ...existing, ...updatedExpense });
      }
    } catch (e) {
      setExpenses(prevExpenses);
      toast.error('Erro ao atualizar despesa');
      console.error('Failed to update expense', e);
    }
  };

  const setBudgetGoal = async (goal: Omit<BudgetGoal, 'id'>) => {
    const newBudget: BudgetGoal = {
      ...goal,
      id: Date.now().toString(),
    };
    const prevBudgets = budgets;
    const prevActiveBudgetId = activeBudgetId;
    setBudgets([...budgets, newBudget]);
    setActiveBudgetId(newBudget.id);
    try {
      await budgetRepo.save(newBudget);
      await adapter.setActiveBudgetId(newBudget.id);
    } catch (e) {
      setBudgets(prevBudgets);
      setActiveBudgetId(prevActiveBudgetId);
      toast.error('Erro ao salvar orçamento');
      console.error('Failed to save budget', e);
    }
  };

  const deleteBudget = async (budgetId: string) => {
    const prevBudgets = budgets;
    const prevExpenses = expenses;
    const prevActiveBudgetId = activeBudgetId;

    // Optimistic update: filter out the budget and cascade-delete its expenses
    const updatedBudgets = budgets.filter((b) => b.id !== budgetId);
    const updatedExpenses = expenses.filter((e) => e.budgetId !== budgetId);
    setBudgets(updatedBudgets);
    setExpenses(updatedExpenses);

    // Handle active budget selection (Requirement 10.3, 10.5)
    let newActiveBudgetId = activeBudgetId;
    if (activeBudgetId === budgetId) {
      newActiveBudgetId = updatedBudgets.length > 0
        ? updatedBudgets[updatedBudgets.length - 1].id  // most recently created
        : null;
      setActiveBudgetId(newActiveBudgetId);
    }

    try {
      await budgetRepo.delete(budgetId);
      await expenseRepo.deleteByBudgetId(budgetId);
      // Persist new active budget ID only when it changed and is not null
      // (adapter.setActiveBudgetId accepts a string, not null)
      if (newActiveBudgetId !== null && newActiveBudgetId !== prevActiveBudgetId) {
        await adapter.setActiveBudgetId(newActiveBudgetId);
      }
    } catch (e) {
      // Rollback on failure
      setBudgets(prevBudgets);
      setExpenses(prevExpenses);
      setActiveBudgetId(prevActiveBudgetId);
      toast.error('Erro ao deletar orçamento');
      console.error('Failed to delete budget', e);
    }
  };

  const setActiveBudget = async (budgetId: string) => {
    const prevActiveBudgetId = activeBudgetId;
    setActiveBudgetId(budgetId); // optimistic update
    try {
      await adapter.setActiveBudgetId(budgetId);
    } catch (e) {
      setActiveBudgetId(prevActiveBudgetId); // rollback
      toast.error('Erro ao alterar orçamento ativo');
      console.error('Failed to set active budget', e);
    }
  };

  const getDailySpent = (date: string): number => {
    if (!activeBudgetId) return 0;
    return expenses
      .filter((e) => e.date === date && e.budgetId === activeBudgetId)
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const getMonthlySpent = (): number => {
    if (!activeBudgetId) return 0;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const expensesSum = expenses
      .filter(exp => {
        const expDate = new Date(exp.date);
        return exp.budgetId === activeBudgetId && expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
      })
      .reduce((sum, exp) => sum + exp.amount, 0);

    const initialSpent = activeBudget?.initialSpent || 0;
    return expensesSum + initialSpent;
  };

  const getTotalBudget = (): number => {
    return activeBudget?.totalAmount || 0;
  };

  const getDailyBudget = (date: string): number => {
    if (!activeBudget) return 0;

    const startDate = new Date(activeBudget.startDate);
    const endDate = new Date(activeBudget.endDate);
    const currentDate = new Date(date);
    const daysElapsed = Math.floor(
      (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalDays = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const remainingBudget = getTotalBudget() - getMonthlySpent();

    return daysRemaining > 0 ? remainingBudget / daysRemaining : 0;
  };

  const getAdjustedDailyLimit = (date: string): number => {
    if (!activeBudget) return 0;

    const startDate = new Date(activeBudget.startDate);
    const endDate = new Date(activeBudget.endDate);
    const currentDate = new Date(date);
    const daysElapsed = Math.floor(
      (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalDays = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;

    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const totalSpent = getMonthlySpent();
    const remainingBudget = Math.max(0, getTotalBudget() - totalSpent);

    if (daysRemaining <= 0) return 0;

    return remainingBudget / daysRemaining;
  }

  const getDailyRemaining = (date: string): number => {
    const dailySpent = getDailySpent(date);
    const dailyBudget = getAdjustedDailyLimit(date);
    return Math.max(0, dailyBudget - dailySpent);
  };

  const getMonthlyRemaining = (): number => {
    const totalBudget = getTotalBudget();
    const monthlySpent = getMonthlySpent();
    return Math.max(0, totalBudget - monthlySpent);
  };

  const exportData = () => {
    const data: StorageData = {
      budgets,
      expenses,
      activeBudgetId,
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsed = JSON.parse(content);

          // Validate the imported structure with zod (Requirements 9.3, 17.2, 17.4).
          // safeParse returns a result object instead of throwing, so we can
          // produce a consistent "Formato de arquivo inválido" error for any
          // validation failure (Requirement 9.6).
          const result = storageDataSchema.safeParse(parsed);
          if (!result.success) {
            throw new Error('Formato de arquivo inválido');
          }

          const data = result.data as StorageData;

          // Update React state with the validated data
          setBudgets(data.budgets);
          setExpenses(data.expenses);
          setActiveBudgetId(data.activeBudgetId || (data.budgets[0]?.id || null));

          // Persist the imported data via the storage adapter (Requirement 9.5).
          // Persistence errors are logged and surfaced via toast but do not
          // reject the import promise — the React state has already been
          // updated optimistically, matching the pattern used elsewhere in
          // this context.
          try {
            await adapter.saveAll(data);
          } catch (persistError) {
            console.error('Failed to persist imported data', persistError);
            toast.error('Erro ao salvar dados importados');
          }

          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Formato de arquivo inválido'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'));
      };
      reader.readAsText(file);
    });
  };

  const setCategoryLimit = async (category: string, maxAmount: number) => {
    if (!activeBudget) return;

    const prevBudgets = budgets;
    const updatedBudgets = budgets.map(budget => {
      if (budget.id === activeBudget.id) {
        const categoryLimits = budget.categoryLimits || [];
        const existingIndex = categoryLimits.findIndex(cl => cl.category === category);

        if (existingIndex >= 0) {
          categoryLimits[existingIndex].maxAmount = maxAmount;
        } else {
          categoryLimits.push({ category, maxAmount });
        }

        return { ...budget, categoryLimits };
      }
      return budget;
    });

    setBudgets(updatedBudgets); // optimistic update

    try {
      const updatedBudget = updatedBudgets.find(b => b.id === activeBudget.id);
      if (updatedBudget) {
        await budgetRepo.save(updatedBudget);
      }
    } catch (e) {
      setBudgets(prevBudgets); // rollback
      toast.error('Erro ao salvar limite de categoria');
      console.error('Failed to set category limit', e);
    }
  };

  const getCategorySpent = (category: string): number => {
    return expenses
      .filter(exp => exp.category === category && exp.budgetId === activeBudget?.id)
      .reduce((sum, exp) => sum + exp.amount, 0);
  };

  const getCategoryLimit = (category: string): number | undefined => {
    return activeBudget?.categoryLimits?.find(cl => cl.category === category)?.maxAmount;
  };

  const getExceededCategories = () => {
    if (!activeBudget?.categoryLimits) return [];

    return activeBudget.categoryLimits
      .map(limit => ({
        category: limit.category,
        spent: getCategorySpent(limit.category),
        limit: limit.maxAmount,
      }))
      .filter(item => item.spent > item.limit);
  };

  return (
    <ExpenseContext.Provider
      value={{
        budgets,
        activeBudgetId,
        expenses,
        activeBudget,
        addExpense,
        setBudgetGoal,
        deleteBudget,
        setActiveBudget,
        getDailySpent,
        getMonthlySpent,
        getDailyBudget,
        getDailyRemaining,
        getMonthlyRemaining,
        getTotalBudget,
        getAdjustedDailyLimit,
        deleteExpense,
        updateExpense,
        exportData,
        importData,
        setCategoryLimit,
        getCategorySpent,
        getCategoryLimit,
        getExceededCategories,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpense = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
};
