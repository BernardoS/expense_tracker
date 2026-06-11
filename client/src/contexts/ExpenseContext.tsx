import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  budgetId: string;
}

export interface BudgetGoal {
  id: string;
  name: string;
  totalAmount: number;
  durationDays: number;
  startDate: string;
  initialSpent?: number;
}

interface ExpenseContextType {
  budgets: BudgetGoal[];
  activeBudgetId: string | null;
  expenses: Expense[];
  activeBudget: BudgetGoal | null;
  addExpense: (expense: Omit<Expense, 'id' | 'budgetId'>) => void;
  setBudgetGoal: (goal: Omit<BudgetGoal, 'id'>) => void;
  deleteBudget: (budgetId: string) => void;
  setActiveBudget: (budgetId: string) => void;
  getDailySpent: (date: string) => number;
  getMonthlySpent: () => number;
  getDailyBudget: (date: string) => number;
  getDailyRemaining: (date: string) => number;
  getMonthlyRemaining: () => number;
  getTotalBudget: () => number;
  getAdjustedDailyLimit: (date: string) => number;
  deleteExpense: (id: string) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

const STORAGE_KEY = 'expense_tracker_data_v2';

interface StorageData {
  budgets: BudgetGoal[];
  expenses: Expense[];
  activeBudgetId: string | null;
}

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [budgets, setBudgets] = useState<BudgetGoal[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeBudgetId, setActiveBudgetId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data: StorageData = JSON.parse(saved);
        setBudgets(data.budgets || []);
        setExpenses(data.expenses || []);
        setActiveBudgetId(data.activeBudgetId || (data.budgets?.[0]?.id || null));
      } catch (e) {
        console.error('Failed to parse data from localStorage', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    if (isLoaded) {
      const data: StorageData = {
        budgets,
        expenses,
        activeBudgetId,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [budgets, expenses, activeBudgetId, isLoaded]);

  const activeBudget = budgets.find((b) => b.id === activeBudgetId) || null;

  const addExpense = (expense: Omit<Expense, 'id' | 'budgetId'>) => {
    if (!activeBudgetId) return;
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString(),
      budgetId: activeBudgetId,
    };
    setExpenses([...expenses, newExpense]);
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter(exp => exp.id !== id));
  };

  const setBudgetGoal = (goal: Omit<BudgetGoal, 'id'>) => {
    const newBudget: BudgetGoal = {
      ...goal,
      id: Date.now().toString(),
    };
    setBudgets([...budgets, newBudget]);
    setActiveBudgetId(newBudget.id);
  };

  const deleteBudget = (budgetId: string) => {
    setBudgets(budgets.filter((b) => b.id !== budgetId));
    setExpenses(expenses.filter((e) => e.budgetId !== budgetId));
    if (activeBudgetId === budgetId) {
      const remaining = budgets.filter((b) => b.id !== budgetId);
      setActiveBudgetId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const setActiveBudget = (budgetId: string) => {
    setActiveBudgetId(budgetId);
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
    const currentDate = new Date(date);
    const daysElapsed = Math.floor(
      (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysRemaining = Math.max(0, activeBudget.durationDays - daysElapsed);
    const remainingBudget = getTotalBudget() - getMonthlySpent();

    return daysRemaining > 0 ? remainingBudget / daysRemaining : 0;
  };

  const getAdjustedDailyLimit = (date: string): number => {
    if (!activeBudget) return 0;

    const startDate = new Date(activeBudget.startDate);
    const currentDate = new Date(date);
    const daysElapsed = Math.floor(
      (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const daysRemaining = Math.max(0, activeBudget.durationDays - daysElapsed);
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
