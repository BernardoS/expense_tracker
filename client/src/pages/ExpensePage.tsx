import React, { useState } from 'react';
import { Plus, Target, Trash2, ChevronDown } from 'lucide-react';
import { useExpense } from '@/contexts/ExpenseContext';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { toast } from 'sonner';

export default function ExpensePage() {
  const { addExpense, setBudgetGoal, activeBudget, budgets, setActiveBudget, deleteBudget, expenses } = useExpense();
  const [, setLocation] = useLocation();

  const [tab, setTab] = useState<'add' | 'budget' | 'metas'>('add');
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    category: 'Alimentação',
  });

  const [budgetForm, setBudgetForm] = useState({
    name: '',
    totalAmount: '',
    durationDays: '30',
    initialSpent: '',
  });

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeBudget) {
      toast.error('Selecione uma meta primeiro');
      return;
    }

    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      toast.error('Digite um valor válido');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    addExpense({
      amount: parseFloat(expenseForm.amount),
      description: expenseForm.description || 'Sem descrição',
      date: today,
      category: expenseForm.category,
    });

    setExpenseForm({
      amount: '',
      description: '',
      category: 'Alimentação',
    });

    toast.success('Gasto adicionado com sucesso!');
  };

  const handleSetBudget = (e: React.FormEvent) => {
    e.preventDefault();

    if (!budgetForm.name.trim()) {
      toast.error('Digite um nome para a meta');
      return;
    }

    if (!budgetForm.totalAmount || parseFloat(budgetForm.totalAmount) <= 0) {
      toast.error('Digite um valor válido para o orçamento');
      return;
    }

    if (!budgetForm.durationDays || parseInt(budgetForm.durationDays) <= 0) {
      toast.error('Digite um número válido de dias');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    setBudgetGoal({
      name: budgetForm.name,
      totalAmount: parseFloat(budgetForm.totalAmount),
      durationDays: parseInt(budgetForm.durationDays),
      startDate: today,
      initialSpent: budgetForm.initialSpent ? parseFloat(budgetForm.initialSpent) : 0,
    });

    setBudgetForm({
      name: '',
      totalAmount: '',
      durationDays: '30',
      initialSpent: '',
    });

    toast.success('Meta criada com sucesso!');
    setTab('metas');
  };

  const handleDeleteBudget = (budgetId: string) => {
    if (confirm('Tem certeza que deseja deletar esta meta e todos seus gastos?')) {
      deleteBudget(budgetId);
      toast.success('Meta deletada com sucesso!');
    }
  };

  const categories = ['Alimentação', 'Transporte', 'Entretenimento', 'Saúde', 'Compras', 'Outros'];
  const activeBudgetExpenses = expenses.filter(e => e.budgetId === activeBudget?.id);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container pt-8">
        <div className="mb-8">
          <h1 className="font-headline text-3xl">Gastos</h1>
          <p className="font-label text-muted-foreground mt-1">Gerencie suas despesas e metas</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setTab('add')}
            className={`flex-1 py-3 px-4 font-medium rounded-full uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 ${
              tab === 'add'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-foreground border border-border'
            }`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Adicionar
          </button>
          <button
            onClick={() => setTab('metas')}
            className={`flex-1 py-3 px-4 font-medium rounded-full uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 ${
              tab === 'metas'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-foreground border border-border'
            }`}
          >
            <Target className="w-4 h-4" strokeWidth={2.5} />
            Metas
          </button>
          <button
            onClick={() => setTab('budget')}
            className={`flex-1 py-3 px-4 font-medium rounded-full uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 ${
              tab === 'budget'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-foreground border border-border'
            }`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Nova
          </button>
        </div>

        {/* Add Expense Tab */}
        {tab === 'add' && (
          <div className="m3-card p-8 mb-6">
            {!activeBudget ? (
              <div className="text-center py-8">
                <p className="font-body text-muted-foreground mb-4">Nenhuma meta selecionada</p>
                <button
                  onClick={() => setTab('metas')}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium uppercase text-sm tracking-wider"
                >
                  Selecionar Meta
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <p className="font-label text-muted-foreground mb-1">META ATIVA</p>
                  <p className="font-headline text-lg text-primary">{activeBudget.name}</p>
                </div>

                <form onSubmit={handleAddExpense} className="space-y-6">
                  <div>
                    <label className="block font-label text-muted-foreground mb-3">VALOR (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={expenseForm.amount}
                      onChange={(e) =>
                        setExpenseForm({ ...expenseForm, amount: e.target.value })
                      }
                      className="m3-input font-headline text-2xl"
                    />
                  </div>

                  <div>
                    <label className="block font-label text-muted-foreground mb-3">DESCRIÇÃO</label>
                    <input
                      type="text"
                      placeholder="Ex: Almoço no restaurante"
                      value={expenseForm.description}
                      onChange={(e) =>
                        setExpenseForm({ ...expenseForm, description: e.target.value })
                      }
                      className="m3-input font-body"
                    />
                  </div>

                  <div>
                    <label className="block font-label text-muted-foreground mb-3">CATEGORIA</label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) =>
                        setExpenseForm({ ...expenseForm, category: e.target.value })
                      }
                      className="m3-select font-body"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full px-6 py-4 bg-accent text-accent-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" strokeWidth={2.5} />
                    Confirmar Gasto
                  </button>
                </form>

                {/* Recent Expenses */}
                {activeBudgetExpenses.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-border">
                    <h3 className="font-title text-lg mb-4">Últimos Gastos</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {[...activeBudgetExpenses]
                        .reverse()
                        .slice(0, 5)
                        .map((exp) => (
                          <div
                            key={exp.id}
                            className="flex justify-between items-center p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                          >
                            <div>
                              <p className="font-body font-medium">{exp.description}</p>
                              <p className="font-label text-muted-foreground">{exp.category}</p>
                            </div>
                            <p className="font-headline text-lg text-accent">R$ {exp.amount.toFixed(2)}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Metas Tab */}
        {tab === 'metas' && (
          <div className="space-y-4">
            {budgets.length === 0 ? (
              <div className="m3-card p-8 text-center">
                <p className="font-body text-muted-foreground mb-4">Nenhuma meta criada ainda</p>
                <button
                  onClick={() => setTab('budget')}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium uppercase text-sm tracking-wider"
                >
                  Criar Nova Meta
                </button>
              </div>
            ) : (
              budgets.map((budget) => (
                <div
                  key={budget.id}
                  className={`m3-card p-6 cursor-pointer transition-all ${
                    activeBudget?.id === budget.id
                      ? 'border-2 border-primary bg-primary/5'
                      : 'border border-border hover:border-primary/50'
                  }`}
                  onClick={() => setActiveBudget(budget.id)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-headline text-lg text-primary">{budget.name}</h3>
                      <p className="font-label text-muted-foreground text-sm">
                        {new Date(budget.startDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBudget(budget.id);
                      }}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-destructive" strokeWidth={2.5} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-primary/10 p-4 rounded-lg">
                      <p className="font-label text-muted-foreground text-xs">ORÇAMENTO</p>
                      <p className="font-headline text-lg text-primary">R$ {budget.totalAmount.toFixed(2)}</p>
                    </div>
                    <div className="bg-accent/10 p-4 rounded-lg">
                      <p className="font-label text-muted-foreground text-xs">DURAÇÃO</p>
                      <p className="font-headline text-lg text-accent">{budget.durationDays} dias</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Create Budget Tab */}
        {tab === 'budget' && (
          <div className="m3-card p-8 mb-6">
            <form onSubmit={handleSetBudget} className="space-y-6">
              <div>
                <label className="block font-label text-muted-foreground mb-3">NOME DA META</label>
                <input
                  type="text"
                  placeholder="Ex: Férias 2026"
                  value={budgetForm.name}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, name: e.target.value })
                  }
                  className="m3-input font-headline text-lg"
                />
              </div>

              <div>
                <label className="block font-label text-muted-foreground mb-3">ORÇAMENTO TOTAL (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="3500.00"
                  value={budgetForm.totalAmount}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, totalAmount: e.target.value })
                  }
                  className="m3-input font-headline text-2xl"
                />
                <p className="font-label text-muted-foreground mt-2">
                  Valor total que você quer gastar
                </p>
              </div>

              <div>
                <label className="block font-label text-muted-foreground mb-3">DURAÇÃO (DIAS)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="30"
                  value={budgetForm.durationDays}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, durationDays: e.target.value })
                  }
                  className="m3-input font-headline text-2xl"
                />
                <p className="font-label text-muted-foreground mt-2">
                  Quantos dias para atingir o limite?
                </p>
              </div>

              <div>
                <label className="block font-label text-muted-foreground mb-3">GASTO INICIAL (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={budgetForm.initialSpent}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, initialSpent: e.target.value })
                  }
                  className="m3-input font-headline text-2xl"
                />
                <p className="font-label text-muted-foreground mt-2">
                  Valor que você já gastou neste período (opcional)
                </p>
              </div>

              {budgetForm.totalAmount && budgetForm.durationDays && (
                <div className="space-y-3">
                  <div className="bg-primary/10 p-6 rounded-xl border border-primary/20">
                    <p className="font-label text-muted-foreground mb-2">ORÇAMENTO DISPONÍVEL</p>
                    <p className="font-headline text-3xl text-primary">
                      R$ {(parseFloat(budgetForm.totalAmount) - (budgetForm.initialSpent ? parseFloat(budgetForm.initialSpent) : 0)).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-accent/10 p-6 rounded-xl border border-accent/20">
                    <p className="font-label text-muted-foreground mb-2">LIMITE DIÁRIO ESTIMADO</p>
                    <p className="font-headline text-3xl text-accent">
                      R$ {((parseFloat(budgetForm.totalAmount) - (budgetForm.initialSpent ? parseFloat(budgetForm.initialSpent) : 0)) / parseInt(budgetForm.durationDays)).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Target className="w-5 h-5" strokeWidth={2.5} />
                Criar Meta
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
