import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { TrendingUp, Plus, Sparkles, AlertCircle } from 'lucide-react';
import { useExpense } from '@/contexts/ExpenseContext';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function MonthPage() {
  const { getMonthlySpent, getTotalBudget, getMonthlyRemaining, activeBudget, expenses } = useExpense();
  const [, setLocation] = useLocation();

  const monthlySpent = getMonthlySpent();
  const totalBudget = getTotalBudget();
  const monthlyRemaining = getMonthlyRemaining();

  // Generate chart data for each day of the month
  const chartData = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const data = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const daySpent = expenses
        .filter(exp => exp.date === dateStr)
        .reduce((sum, exp) => sum + exp.amount, 0);

      data.push({
        day: day,
        spent: daySpent,
      });
    }
    return data;
  }, [expenses]);

  const percentage = totalBudget > 0 ? (monthlySpent / totalBudget) * 100 : 0;

  if (!activeBudget) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <TrendingUp className="w-16 h-16 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-headline text-3xl mb-4">Seu Mês</h1>
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

  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container pt-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-primary" strokeWidth={1.5} />
            <h1 className="font-headline text-3xl">Seu Mês</h1>
          </div>
          <p className="font-label text-muted-foreground mt-1 capitalize">
            {monthName}
          </p>
        </div>

        {/* Chart Section */}
        <div className="m3-card p-6 mb-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e0ec" vertical={false} />
              <XAxis
                dataKey="day"
                stroke="#49454e"
                tick={{ fontSize: 12, fill: '#49454e' }}
                interval={Math.floor(chartData.length / 7)}
                axisLine={false}
              />
              <YAxis 
                stroke="#49454e" 
                tick={{ fontSize: 12, fill: '#49454e' }}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e7e0ec',
                  borderRadius: '12px',
                  boxShadow: '0 3px 6px rgba(0, 0, 0, 0.15)',
                }}
                formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`}
                labelStyle={{ color: '#1c1b1f' }}
              />
              <Bar dataKey="spent" fill="#6750a4" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stats Card */}
        <div className="m3-card p-8 mb-6">
          <div className="text-center mb-8">
            <p className="font-label text-muted-foreground mb-2">GASTO ESTE MÊS</p>
            <p className="font-display text-5xl text-primary mb-6">
              R$ {monthlySpent.toFixed(2)}
            </p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="font-label text-muted-foreground mt-3">
              {percentage.toFixed(0)}% DO ORÇAMENTO MENSAL
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/10 p-6 rounded-xl border border-primary/20">
              <p className="font-label text-muted-foreground mb-2">ORÇAMENTO</p>
              <p className="font-headline text-2xl text-primary">
                R$ {totalBudget.toFixed(2)}
              </p>
            </div>
            <div className="bg-accent/10 p-6 rounded-xl border border-accent/20">
              <p className="font-label text-muted-foreground mb-2">DISPONÍVEL</p>
              <p className="font-headline text-2xl text-accent">
                R$ {monthlyRemaining.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="text-center mb-8 p-6 rounded-xl bg-primary/5 border border-primary/20">
          {monthlyRemaining > 0 ? (
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" strokeWidth={2.5} />
              <p className="font-title text-primary">
                Você pode gastar até R$ {monthlyRemaining.toFixed(2)} este mês!
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" strokeWidth={2.5} />
              <p className="font-title text-destructive">
                Orçamento mensal atingido!
              </p>
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={() => setLocation('/gastos')}
          className="w-full px-6 py-4 bg-accent text-accent-foreground rounded-full font-medium uppercase text-sm tracking-wider shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
          Adicionar Gasto
        </button>
      </div>
    </div>
  );
}
