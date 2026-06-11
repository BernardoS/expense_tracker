import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Calendar, Plus, Sparkles, AlertCircle } from 'lucide-react';
import { useExpense } from '@/contexts/ExpenseContext';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

export default function DayPage() {
  const { getDailySpent, getAdjustedDailyLimit, activeBudget } = useExpense();
  const [, setLocation] = useLocation();

  const today = new Date().toISOString().split('T')[0];
  const dailySpent = getDailySpent(today);
  const dailyLimit = getAdjustedDailyLimit(today);
  const dailyRemaining = Math.max(0, dailyLimit - dailySpent);

  const chartData = useMemo(() => {
    return [
      { name: 'Gasto', value: dailySpent },
      { name: 'Disponível', value: dailyRemaining },
    ];
  }, [dailySpent, dailyRemaining]);

  const percentage = dailyLimit > 0 ? (dailySpent / dailyLimit) * 100 : 0;

  if (!activeBudget) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Calendar className="w-16 h-16 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-headline text-3xl mb-4">Seu Dia</h1>
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

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container pt-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-primary" strokeWidth={1.5} />
            <h1 className="font-headline text-3xl">Seu Dia</h1>
          </div>
          <p className="font-label text-muted-foreground">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Chart Section */}
        <div className="flex justify-center mb-8">
          <div className="w-full max-w-sm m3-card p-6">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="#6750a4" />
                  <Cell fill="#e7e0ec" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stats Card */}
        <div className="m3-card p-8 mb-6">
          <div className="text-center mb-8">
            <p className="font-label text-muted-foreground mb-2">GASTO HOJE</p>
            <p className="font-display text-5xl text-primary mb-6">
              R$ {dailySpent.toFixed(2)}
            </p>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="font-label text-muted-foreground mt-3">
              {percentage.toFixed(0)}% DO LIMITE DIÁRIO
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-primary/10 p-6 rounded-xl border border-primary/20">
              <p className="font-label text-muted-foreground mb-2">LIMITE DIÁRIO</p>
              <p className="font-headline text-2xl text-primary">
                R$ {dailyLimit.toFixed(2)}
              </p>
            </div>
            <div className="bg-accent/10 p-6 rounded-xl border border-accent/20">
              <p className="font-label text-muted-foreground mb-2">DISPONÍVEL</p>
              <p className="font-headline text-2xl text-accent">
                R$ {dailyRemaining.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Status Message */}
        <div className="text-center mb-8 p-6 rounded-xl bg-primary/5 border border-primary/20">
          {dailyRemaining > 0 ? (
            <div className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" strokeWidth={2.5} />
              <p className="font-title text-primary">
                Você pode gastar até R$ {dailyRemaining.toFixed(2)} hoje!
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" strokeWidth={2.5} />
              <p className="font-title text-destructive">
                Limite diário atingido!
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
