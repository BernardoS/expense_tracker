import React, { useState, useRef } from 'react';
import { Plus, Target, Trash2, ChevronDown, Download, Upload, Calendar } from 'lucide-react';
import { useExpense } from '@/contexts/ExpenseContext';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { toLocalDateStr, parseLocalDate } from '@/lib/date';

export default function ExpensePage() {
  const { addExpense, setBudgetGoal, activeBudget, budgets, setActiveBudget, deleteBudget, expenses, exportData, importData, setCategoryLimit, getCategoryLimit, updateExpense, deleteExpense } = useExpense();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<'add' | 'budget' | 'metas' | 'backup' | 'limites'>('add');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingExpenseForm, setEditingExpenseForm] = useState({
    amount: '',
    description: '',
    category: 'Alimentação',
    date: toLocalDateStr(),
    isEssential: true,
  });
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    category: 'Alimentação',
    date: toLocalDateStr(),
    isEssential: true,
  });

  const [categoryLimitForm, setCategoryLimitForm] = useState({
    category: 'Alimentação',
    maxAmount: '',
  });

  const [budgetForm, setBudgetForm] = useState({
    name: '',
    totalAmount: '',
    startDate: '',
    endDate: '',
    initialSpent: '',
  });

  const handleSetCategoryLimit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryLimitForm.maxAmount || parseFloat(categoryLimitForm.maxAmount) <= 0) {
      toast.error('Digite um valor válido para o limite');
      return;
    }

    setCategoryLimit(categoryLimitForm.category, parseFloat(categoryLimitForm.maxAmount));
    setCategoryLimitForm({
      category: 'Alimentação',
      maxAmount: '',
    });
    toast.success('Limite de categoria definido com sucesso!');
  }

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

    addExpense({
      amount: parseFloat(expenseForm.amount),
      description: expenseForm.description || 'Sem descrição',
      date: expenseForm.date,
      category: expenseForm.category,
      isEssential: expenseForm.isEssential,
    });

    setExpenseForm({
      amount: '',
      description: '',
      category: 'Alimentação',
      date: toLocalDateStr(),
      isEssential: true,
    });

    toast.success('Gasto adicionado com sucesso!');
  };
  const handleEditExpense = (expense: any) => {
    setEditingExpenseId(expense.id);
    setEditingExpenseForm({
      amount: expense.amount.toString(),
      description: expense.description,
      category: expense.category,
      date: expense.date,
      isEssential: expense.isEssential,
    });
  };

  const handleSaveEditedExpense = () => {
    if (!editingExpenseId) return;

    if (!editingExpenseForm.amount || parseFloat(editingExpenseForm.amount) <= 0) {
      toast.error("Digite um valor válido");
      return;
    }

    updateExpense(editingExpenseId, {
      amount: parseFloat(editingExpenseForm.amount),
      description: editingExpenseForm.description || "Sem descrição",
      date: editingExpenseForm.date,
      category: editingExpenseForm.category,
      isEssential: editingExpenseForm.isEssential,
    });

    setEditingExpenseId(null);
    toast.success("Gasto atualizado com sucesso!");
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm("Tem certeza que deseja deletar este gasto?")) {
      deleteExpense(id);
      toast.success("Gasto deletado com sucesso!");
    }
  };

  const calculateDurationDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
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

    if (!budgetForm.startDate) {
      toast.error('Selecione a data inicial');
      return;
    }

    if (!budgetForm.endDate) {
      toast.error('Selecione a data final');
      return;
    }

    const startDate = parseLocalDate(budgetForm.startDate);
    const endDate = parseLocalDate(budgetForm.endDate);

    if (endDate < startDate) {
      toast.error('A data final deve ser após a data inicial');
      return;
    }

    setBudgetGoal({
      name: budgetForm.name,
      totalAmount: parseFloat(budgetForm.totalAmount),
      startDate: budgetForm.startDate,
      endDate: budgetForm.endDate,
      initialSpent: budgetForm.initialSpent ? parseFloat(budgetForm.initialSpent) : 0,
    });

    setBudgetForm({
      name: '',
      totalAmount: '',
      startDate: '',
      endDate: '',
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

  const handleExport = () => {
    try {
      exportData();
      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar dados');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await importData(file);
      toast.success('Dados importados com sucesso!');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar dados');
    }
  };

  const categories = ['Alimentação', 'Transporte', 'Entretenimento', 'Saúde', 'Compras', 'Lazer', 'Outros'];
  const activeBudgetExpenses = expenses.filter(e => e.budgetId === activeBudget?.id);
  const durationDays = calculateDurationDays(budgetForm.startDate, budgetForm.endDate);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container pt-8">
        <div className="mb-8">
          <h1 className="font-headline text-3xl">Gastos</h1>
          <p className="font-label text-muted-foreground mt-1">Gerencie suas despesas e metas</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          <button
            onClick={() => setTab('add')}
            className={`py-3 px-4 font-medium rounded-full uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
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
            className={`py-3 px-4 font-medium rounded-full uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
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
            className={`py-3 px-4 font-medium rounded-full uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              tab === 'budget'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-foreground border border-border'
            }`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Nova
          </button>
          <button
            onClick={() => setTab('backup')}
            className={`py-3 px-4 font-medium rounded-full uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              tab === 'backup'
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-foreground border border-border'
            }`}
          >
            <Download className="w-4 h-4" strokeWidth={2.5} />
            Backup
          </button>
          <button
            onClick={() => setTab("limites")}
            className={`py-3 px-4 font-medium rounded-full uppercase text-sm tracking-wider transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
              tab === "limites"
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-foreground border border-border"
            }`}
          >
            <Target className="w-4 h-4" strokeWidth={2.5} />
            Limites
          </button>
        </div>

        {/* Hidden file input for import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />

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
                  <div>
                    <label className="block font-label text-muted-foreground mb-3">DATA DO GASTO</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground pointer-events-none" strokeWidth={2} />
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) =>
                          setExpenseForm({ ...expenseForm, date: e.target.value })
                        }
                        className="m3-input font-body pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-label text-muted-foreground mb-3">CLASSIFICAÇÃO</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setExpenseForm({ ...expenseForm, isEssential: true })}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium uppercase text-sm tracking-wider transition-all ${
                          expenseForm.isEssential
                            ? "bg-primary text-primary-foreground shadow-md"
                            : "bg-muted text-foreground border border-border"
                        }`}
                      >
                        Essencial
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpenseForm({ ...expenseForm, isEssential: false })}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium uppercase text-sm tracking-wider transition-all ${
                          !expenseForm.isEssential
                            ? "bg-accent text-accent-foreground shadow-md"
                            : "bg-muted text-foreground border border-border"
                        }`}
                      >
                        Não Essencial
                      </button>
                    </div>
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
                            <div className="flex-1">
                              <p className="font-body font-medium">{exp.description}</p>
                              <p className="font-label text-muted-foreground">{exp.category}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-headline text-lg text-accent">R$ {exp.amount.toFixed(2)}</p>
                              <button
                                onClick={() => handleEditExpense(exp)}
                                className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                              >
                                <Plus className="w-4 h-4 text-primary" strokeWidth={2.5} />
                              </button>
                              <button
                                onClick={() => handleDeleteExpense(exp.id)}
                                className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" strokeWidth={2.5} />
                              </button>
                            </div>
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
              budgets.map((budget) => {
                const daysTotal = calculateDurationDays(budget.startDate, budget.endDate);
                return (
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
                          {parseLocalDate(budget.startDate).toLocaleDateString('pt-BR')} até{' '}
                          {parseLocalDate(budget.endDate).toLocaleDateString('pt-BR')}
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
                        <p className="font-headline text-lg text-accent">{daysTotal} dias</p>
                      </div>
                    </div>
                  </div>
                );
              })
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-label text-muted-foreground mb-3">DATA INICIAL</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground pointer-events-none" strokeWidth={2} />
                    <input
                      type="date"
                      value={budgetForm.startDate}
                      onChange={(e) =>
                        setBudgetForm({ ...budgetForm, startDate: e.target.value })
                      }
                      className="m3-input font-body pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-label text-muted-foreground mb-3">DATA FINAL</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground pointer-events-none" strokeWidth={2} />
                    <input
                      type="date"
                      value={budgetForm.endDate}
                      onChange={(e) =>
                        setBudgetForm({ ...budgetForm, endDate: e.target.value })
                      }
                      className="m3-input font-body pl-10"
                    />
                  </div>
                </div>
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

              {budgetForm.totalAmount && budgetForm.startDate && budgetForm.endDate && (
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
                      R$ {durationDays > 0 ? ((parseFloat(budgetForm.totalAmount) - (budgetForm.initialSpent ? parseFloat(budgetForm.initialSpent) : 0)) / durationDays).toFixed(2) : '0.00'}
                    </p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg border border-border">
                    <p className="font-label text-muted-foreground">DURAÇÃO TOTAL</p>
                    <p className="font-headline text-xl">{durationDays} dias</p>
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

        {/* Backup Tab */}
        {tab === 'backup' && (
          <div className="space-y-6">
            {/* Export Section */}
            <div className="m3-card p-8">
              <div className="mb-6">
                <h2 className="font-headline text-2xl mb-2">Exportar Dados</h2>
                <p className="font-body text-muted-foreground">
                  Faça download de um arquivo JSON com todas as suas metas e gastos. Você poderá importar esses dados depois.
                </p>
              </div>

              <div className="bg-primary/10 p-6 rounded-lg border border-primary/20 mb-6">
                <p className="font-label text-muted-foreground mb-2">TOTAL DE METAS</p>
                <p className="font-headline text-3xl text-primary">{budgets.length}</p>
                <p className="font-label text-muted-foreground mt-4">TOTAL DE GASTOS</p>
                <p className="font-headline text-3xl text-primary">{expenses.length}</p>
              </div>

              <button
                onClick={handleExport}
                className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" strokeWidth={2.5} />
                Exportar como JSON
              </button>
            </div>

            {/* Import Section */}
            <div className="m3-card p-8">
              <div className="mb-6">
                <h2 className="font-headline text-2xl mb-2">Importar Dados</h2>
                <p className="font-body text-muted-foreground">
                  Carregue um arquivo JSON previamente exportado para restaurar suas metas e gastos. Os dados importados substituirão os atuais.
                </p>
              </div>

              <div className="bg-accent/10 p-6 rounded-lg border border-accent/20 mb-6">
                <p className="font-label text-muted-foreground mb-3">INSTRUÇÕES:</p>
                <ul className="font-body text-foreground space-y-2 list-disc list-inside">
                  <li>Selecione um arquivo JSON válido exportado desta aplicação</li>
                  <li>Os dados atuais serão substituídos pelos dados do arquivo</li>
                  <li>Certifique-se de fazer backup antes de importar</li>
                </ul>
              </div>

              <button
                onClick={handleImportClick}
                className="w-full px-6 py-4 bg-accent text-accent-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5" strokeWidth={2.5} />
                Selecionar Arquivo
              </button>
            </div>
          </div>
        )}

        {/* Category Limits Tab */}
        {tab === 'limites' && (
          <div className="m3-card p-8 mb-6">
            {!activeBudget ? (
              <div className="text-center py-8">
                <p className="font-body text-muted-foreground mb-4">Nenhuma meta selecionada</p>
              </div>
            ) : (
              <form onSubmit={handleSetCategoryLimit} className="space-y-6">
                <div>
                  <label className="block font-label text-muted-foreground mb-3">CATEGORIA</label>
                  <select
                    value={categoryLimitForm.category}
                    onChange={(e) =>
                      setCategoryLimitForm({ ...categoryLimitForm, category: e.target.value })
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

                <div>
                  <label className="block font-label text-muted-foreground mb-3">LIMITE MÁXIMO (R$)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={categoryLimitForm.maxAmount}
                    onChange={(e) =>
                      setCategoryLimitForm({ ...categoryLimitForm, maxAmount: e.target.value })
                    }
                    className="m3-input font-headline text-lg"
                  />
                  <p className="font-label text-muted-foreground text-sm mt-2">Deixe em branco para remover o limite</p>
                </div>

                <button
                  type="submit"
                  className="w-full px-6 py-4 bg-primary text-primary-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
                >
                  Definir Limite
                </button>
              </form>
            )}

            {/* Current Limits */}
            {activeBudget?.categoryLimits && activeBudget.categoryLimits.length > 0 && (
              <div className="mt-8 pt-8 border-t border-border">
                <h3 className="font-headline text-lg mb-4">Limites Configurados</h3>
                <div className="space-y-3">
                  {activeBudget.categoryLimits.map((limit) => {
                    const spent = getCategoryLimit(limit.category);
                    return (
                      <div key={limit.category} className="p-4 bg-muted/30 rounded-lg border border-border">
                        <div className="flex justify-between items-center">
                          <span className="font-body font-medium">{limit.category}</span>
                          <span className="font-headline text-primary">R$ {limit.maxAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Edit Expense Modal */}
        {editingExpenseId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="m3-card p-8 w-full max-w-md">
              <h2 className="font-headline text-2xl mb-6">Editar Gasto</h2>
              <div className="space-y-6">
                <div>
                  <label className="block font-label text-muted-foreground mb-3">VALOR (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={editingExpenseForm.amount}
                    onChange={(e) =>
                      setEditingExpenseForm({ ...editingExpenseForm, amount: e.target.value })
                    }
                    className="m3-input font-headline text-2xl"
                  />
                </div>

                <div>
                  <label className="block font-label text-muted-foreground mb-3">DESCRIÇÃO</label>
                  <input
                    type="text"
                    placeholder="Ex: Almoço no restaurante"
                    value={editingExpenseForm.description}
                    onChange={(e) =>
                      setEditingExpenseForm({ ...editingExpenseForm, description: e.target.value })
                    }
                    className="m3-input font-body"
                  />
                </div>

                <div>
                  <label className="block font-label text-muted-foreground mb-3">CATEGORIA</label>
                  <select
                    value={editingExpenseForm.category}
                    onChange={(e) =>
                      setEditingExpenseForm({ ...editingExpenseForm, category: e.target.value })
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

                <div>
                  <label className="block font-label text-muted-foreground mb-3">DATA DO GASTO</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground pointer-events-none" strokeWidth={2} />
                    <input
                      type="date"
                      value={editingExpenseForm.date}
                      onChange={(e) =>
                        setEditingExpenseForm({ ...editingExpenseForm, date: e.target.value })
                      }
                      className="m3-input font-body pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-label text-muted-foreground mb-3">CLASSIFICAÇÃO</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingExpenseForm({ ...editingExpenseForm, isEssential: true })}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium uppercase text-sm tracking-wider transition-all ${
                        editingExpenseForm.isEssential
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted text-foreground border border-border"
                      }`}
                    >
                      Essencial
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingExpenseForm({ ...editingExpenseForm, isEssential: false })}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium uppercase text-sm tracking-wider transition-all ${
                        !editingExpenseForm.isEssential
                          ? "bg-accent text-accent-foreground shadow-md"
                          : "bg-muted text-foreground border border-border"
                      }`}
                    >
                      Não Essencial
                    </button>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleSaveEditedExpense}
                    className="flex-1 px-6 py-4 bg-primary text-primary-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingExpenseId(null)}
                    className="flex-1 px-6 py-4 bg-muted text-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}