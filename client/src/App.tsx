import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { Calendar, TrendingUp, Wallet, BarChart3 } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ExpenseProvider } from "./contexts/ExpenseContext";
import DayPage from "./pages/DayPage";
import MonthPage from "./pages/MonthPage";
import ExpensePage from "./pages/ExpensePage";
import AnalysisPage from "./pages/AnalysisPage";

function Navigation() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/", label: "Dia", icon: Calendar },
    { path: "/mes", label: "Mês", icon: TrendingUp },
    { path: "/analise", label: "Análise", icon: BarChart3 },
    { path: "/gastos", label: "Gastos", icon: Wallet },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg">
      <div className="container flex justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`flex flex-col items-center gap-1 py-3 px-4 transition-all rounded-lg ${
                location === item.path
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={1.5} />
              <span className="font-label text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={DayPage} />
      <Route path={"/mes"} component={MonthPage} />
      <Route path={"/analise"} component={AnalysisPage} />
      <Route path={"/gastos"} component={ExpensePage} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <ExpenseProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <Navigation />
          </TooltipProvider>
        </ExpenseProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
