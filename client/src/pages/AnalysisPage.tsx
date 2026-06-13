import React, { useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, TrendingUp, AlertCircle } from 'lucide-react';
import { useExpense } from '@/contexts/ExpenseContext';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const COLORS = ['#6750a4', '#f06292', '#00bcd4', '#4caf50', '#ff9800', '#9c27b0', '#2196f3', '#e91e63'];

export default function AnalysisPage() {
  const { activeBudget, expenses, getTotalBudget, getMonthlySpent, getExceededCategories } = useExpense();
  const [, setLocation] = useLocation();
  const pieChartRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeBudgetExpenses = expenses.filter(e => e.budgetId === activeBudget?.id);

  // Calculate category data for pie chart
  const categoryData = useMemo(() => {
    const categoryMap: { [key: string]: number } = {};

    activeBudgetExpenses.forEach(expense => {
      if (categoryMap[expense.category]) {
        categoryMap[expense.category] += expense.amount;
      } else {
        categoryMap[expense.category] = expense.amount;
      }
    });

    return Object.entries(categoryMap)
      .map(([name, value]) => ({
        name,
        value: parseFloat(value.toFixed(2)),
      }))
      .sort((a, b) => b.value - a.value);
  }, [activeBudgetExpenses]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalSpent = getMonthlySpent();
    const totalBudget = getTotalBudget();
    const avgPerExpense = activeBudgetExpenses.length > 0 ? totalSpent / activeBudgetExpenses.length : 0;
    const highestCategory = categoryData[0];

    return {
      totalSpent,
      totalBudget,
      avgPerExpense,
      highestCategory,
      totalExpenses: activeBudgetExpenses.length,
    };
  }, [activeBudgetExpenses, categoryData, getMonthlySpent, getTotalBudget]);

  const handleExportPDF = async () => {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      let yPosition = 20;

      // Title
      pdf.setFontSize(20);
      pdf.text('Análise de Gastos', 20, yPosition);
      yPosition += 10;

      // Meta info
      pdf.setFontSize(12);
      pdf.text(`Meta: ${activeBudget?.name}`, 20, yPosition);
      yPosition += 7;
      pdf.text(
        `Período: ${new Date(activeBudget?.startDate!).toLocaleDateString('pt-BR')} até ${new Date(activeBudget?.endDate!).toLocaleDateString('pt-BR')}`,
        20,
        yPosition
      );
      yPosition += 15;

      // Statistics
      pdf.setFontSize(14);
      pdf.text('Resumo Financeiro', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(11);
      pdf.text(`Total Gasto: R$ ${stats.totalSpent.toFixed(2)}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Orçamento Total: R$ ${stats.totalBudget.toFixed(2)}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Percentual Gasto: ${((stats.totalSpent / stats.totalBudget) * 100).toFixed(1)}%`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Total de Transações: ${stats.totalExpenses}`, 20, yPosition);
      yPosition += 7;
      pdf.text(`Gasto Médio por Transação: R$ ${stats.avgPerExpense.toFixed(2)}`, 20, yPosition);
      yPosition += 15;

      // Category breakdown
      pdf.setFontSize(14);
      pdf.text('Gastos por Categoria', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(10);
      categoryData.forEach((category) => {
        const percentage = ((category.value / stats.totalSpent) * 100).toFixed(1);
        pdf.text(
          `${category.name}: R$ ${category.value.toFixed(2)} (${percentage}%)`,
          20,
          yPosition
        );
        yPosition += 7;
        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 20;
        }
      });

      yPosition += 10;

      // Expense list
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(14);
      pdf.text('Lista de Transações', 20, yPosition);
      yPosition += 10;

      pdf.setFontSize(9);
      const sortedExpenses = [...activeBudgetExpenses].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      sortedExpenses.forEach((expense) => {
        const dateStr = new Date(expense.date).toLocaleDateString('pt-BR');
        const line = `${dateStr} | ${expense.description} | ${expense.category} | R$ ${expense.amount.toFixed(2)}`;

        if (yPosition > 270) {
          pdf.addPage();
          yPosition = 20;
        }

        pdf.text(line, 20, yPosition);
        yPosition += 6;
      });

      pdf.save(`analise-gastos-${activeBudget?.name}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar PDF');
      console.error(error);
    }
  };

  if (!activeBudget) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <TrendingUp className="w-16 h-16 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-headline text-3xl mb-4">Análise</h1>
          <p className="font-body text-lg mb-8 text-muted-foreground">Defina uma meta de gastos para começar!</p>
          <button
            onClick={() => setLocation('/gastos')}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            Definir Meta
          </button>
        </div>
      </div>
    );
  }

  if (activeBudgetExpenses.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <TrendingUp className="w-16 h-16 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-headline text-3xl mb-4">Análise</h1>
          <p className="font-body text-lg mb-8 text-muted-foreground">Nenhum gasto registrado ainda!</p>
          <button
            onClick={() => setLocation('/gastos')}
            className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5"
          >
            Adicionar Gasto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container pt-8">
        <div className="mb-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-8 h-8 text-primary" strokeWidth={1.5} />
              <h1 className="font-headline text-3xl">Análise</h1>
            </div>
            <p className="font-label text-muted-foreground mt-1">
              {activeBudget.name}
            </p>
          </div>
          <button
            onClick={handleExportPDF}
            className="px-6 py-3 bg-accent text-accent-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2"
          >
            <Download className="w-5 h-5" strokeWidth={2.5} />
            Exportar PDF
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="m3-card p-6">
            <p className="font-label text-muted-foreground mb-2">TOTAL GASTO</p>
            <p className="font-headline text-3xl text-primary">
              R$ {stats.totalSpent.toFixed(2)}
            </p>
            <p className="font-label text-muted-foreground mt-2 text-sm">
              {((stats.totalSpent / stats.totalBudget) * 100).toFixed(1)}% do orçamento
            </p>
          </div>

          <div className="m3-card p-6">
            <p className="font-label text-muted-foreground mb-2">TRANSAÇÕES</p>
            <p className="font-headline text-3xl text-accent">
              {stats.totalExpenses}
            </p>
            <p className="font-label text-muted-foreground mt-2 text-sm">
              Média: R$ {stats.avgPerExpense.toFixed(2)}
            </p>
          </div>

          <div className="m3-card p-6">
            <p className="font-label text-muted-foreground mb-2">CATEGORIA TOP</p>
            <p className="font-headline text-2xl text-primary">
              {stats.highestCategory?.name}
            </p>
            <p className="font-label text-muted-foreground mt-2 text-sm">
              R$ {stats.highestCategory?.value.toFixed(2)}
            </p>
          </div>

          <div className="m3-card p-6">
            <p className="font-label text-muted-foreground mb-2">ORÇAMENTO</p>
            <p className="font-headline text-3xl text-accent">
              R$ {stats.totalBudget.toFixed(2)}
            </p>
            <p className="font-label text-muted-foreground mt-2 text-sm">
              Disponível: R$ {(stats.totalBudget - stats.totalSpent).toFixed(2)}
            </p>
          </div>
        </div>
        {/* Exceeded Categories Alert */}
        {getExceededCategories().length > 0 && (
          <div className="m3-card p-6 mb-8 bg-destructive/5 border-2 border-destructive/30">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-destructive" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-headline text-lg text-destructive mb-2">Limites de Categoria Excedidos</h3>
                <div className="space-y-2">
                  {getExceededCategories().map((item) => (
                    <p key={item.category} className="font-body text-sm text-destructive">
                      <strong>{item.category}:</strong> R$ {item.spent.toFixed(2)} de R$ {item.limit.toFixed(2)} ({((item.spent / item.limit) * 100).toFixed(0)}%)
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pie Chart */}
        <div className="m3-card p-8 mb-8" ref={pieChartRef}>
          <h2 className="font-headline text-2xl mb-6">Gastos por Categoria</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown Table */}
        <div className="m3-card p-8 mb-8">
          <h2 className="font-headline text-2xl mb-6">Detalhamento por Categoria</h2>
          <div className="space-y-3">
            {categoryData.map((category, index) => {
              const percentage = ((category.value / stats.totalSpent) * 100).toFixed(1);
              return (
                <div key={category.name} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div className="flex-1">
                    <p className="font-body font-medium">{category.name}</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
                      <div
                        className="h-full transition-all duration-300 rounded-full"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-headline text-lg">R$ {category.value.toFixed(2)}</p>
                    <p className="font-label text-muted-foreground text-sm">{percentage}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expense List */}
        <div className="m3-card p-8" ref={listRef}>
          <h2 className="font-headline text-2xl mb-6">Lista de Transações</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {[...activeBudgetExpenses]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((expense) => (
                <div
                  key={expense.id}
                  className="flex justify-between items-center p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-body font-medium">{expense.description}</p>
                    <p className="font-label text-muted-foreground text-sm">
                      {expense.category} • {new Date(expense.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className="font-headline text-lg text-accent">R$ {expense.amount.toFixed(2)}</p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
