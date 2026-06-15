import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  category: string;
  budgetId: string;
  isEssential: boolean;
}

export interface CategoryLimit {
  category: string;
  maxAmount: number;
}

export interface BudgetGoal {
  id: string;
  name: string;
  totalAmount: number;
  startDate: string;
  endDate: string;
  initialSpent?: number;
  categoryLimits?: CategoryLimit[];
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
  updateExpense: (id: string, updatedExpense: Omit<Expense, 'id' | 'budgetId'>) => void;
  exportData: () => void;
  importData: (file: File) => Promise<void>;
  setCategoryLimit: (category: string, maxAmount: number) => void;
  getCategorySpent: (category: string) => number;
  getCategoryLimit: (category: string) => number | undefined;
  getExceededCategories: () => { category: string; spent: number; limit: number }[];
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

  const updateExpense = (id: string, updatedExpense: Omit<Expense, 'id' | 'budgetId'>) => {
    setExpenses(expenses.map(exp => 
      exp.id === id 
        ? { ...exp, ...updatedExpense }
        : exp
    ));
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
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data: StorageData = JSON.parse(content);

          if (!data.budgets || !Array.isArray(data.budgets) || !data.expenses || !Array.isArray(data.expenses)) {
            throw new Error('Formato de arquivo inválido');
          }

          setBudgets(data.budgets);
          setExpenses(data.expenses);
          setActiveBudgetId(data.activeBudgetId || (data.budgets?.[0]?.id || null));
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo'));
      };
      reader.readAsText(file);
    });
  };

  const setCategoryLimit = (category: string, maxAmount: number) => {
    if (!activeBudget) return;

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

    setBudgets(updatedBudgets);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      budgets: updatedBudgets,
      expenses,
      activeBudgetId,
    }));
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
