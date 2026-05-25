// Tipos compartilhados entre controllers, models e routes.
// Definir os tipos aqui evita repeticao e garante consistencia no projeto.

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  phone?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  color?: string;
  created_at: Date;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  date: Date;
  notes?: string;
  source: 'web' | 'whatsapp' | 'api';
  created_at: Date;
  updated_at: Date;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: Date;
  created_at: Date;
  updated_at: Date;
}

// Dados que o dashboard precisa — agrupados em uma unica consulta otimizada
export interface DashboardSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  month: string;
  year: number;
  expenses_by_category: CategorySummary[];
  monthly_evolution: MonthlyData[];
}

export interface CategorySummary {
  category_name: string;
  total: number;
  percentage: number;
  color?: string;
}

export interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

// Estende o Request do Express para incluir o usuario autenticado
// Assim qualquer controller sabe qual usuario esta logado
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}
