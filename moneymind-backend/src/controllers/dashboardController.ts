import { Request, Response } from 'express';
import pool from '../config/database';

// GET /api/dashboard/summary?month=5&year=2026
// Retorna todos os dados que o dashboard precisa em uma unica chamada.
// Evita que o frontend faca multiplas requisicoes para montar a tela.
export async function getSummary(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const now = new Date();
  const month = Number(req.query.month) || now.getMonth() + 1;
  const year  = Number(req.query.year)  || now.getFullYear();

  try {
    // Totais de entradas e saidas do mes
    const totalsResult = await pool.query(
      `SELECT
         SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense
       FROM transactions
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM date) = $2
         AND EXTRACT(YEAR  FROM date) = $3`,
      [userId, month, year]
    );

    const { total_income, total_expense } = totalsResult.rows[0];
    const income  = Number(total_income  || 0);
    const expense = Number(total_expense || 0);
    const balance = income - expense;

    // Gastos agrupados por categoria — usados no grafico de pizza
    const categoriesResult = await pool.query(
      `SELECT
         COALESCE(c.name, 'Sem categoria') AS category_name,
         c.color AS category_color,
         SUM(t.amount) AS total
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1
         AND t.type = 'expense'
         AND EXTRACT(MONTH FROM t.date) = $2
         AND EXTRACT(YEAR  FROM t.date) = $3
       GROUP BY c.name, c.color
       ORDER BY total DESC`,
      [userId, month, year]
    );

    // Adiciona o percentual de cada categoria em relacao ao total de gastos
    const expensesByCategory = categoriesResult.rows.map((row) => ({
      category_name:  row.category_name,
      category_color: row.category_color,
      total:          Number(row.total),
      percentage:     expense > 0 ? Math.round((Number(row.total) / expense) * 100) : 0,
    }));

    // Evolucao dos ultimos 6 meses — usada no grafico de barras/linhas
    const evolutionResult = await pool.query(
      `SELECT
         TO_CHAR(date, 'Mon') AS month_label,
         EXTRACT(MONTH FROM date) AS month_num,
         EXTRACT(YEAR  FROM date) AS year_num,
         SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = $1
         AND date >= (DATE_TRUNC('month', NOW()) - INTERVAL '5 months')
       GROUP BY month_label, month_num, year_num
       ORDER BY year_num ASC, month_num ASC`,
      [userId]
    );

    const monthlyEvolution = evolutionResult.rows.map((row) => ({
      month:   row.month_label,
      income:  Number(row.income),
      expense: Number(row.expense),
    }));

    // Progresso das metas financeiras
    const goalsResult = await pool.query(
      `SELECT id, name, target_amount, current_amount, deadline
       FROM goals
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );

    const goals = goalsResult.rows.map((g) => ({
      ...g,
      target_amount:  Number(g.target_amount),
      current_amount: Number(g.current_amount),
      percentage: Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100),
    }));

    res.json({
      month,
      year,
      total_income:  income,
      total_expense: expense,
      balance,
      expenses_by_category: expensesByCategory,
      monthly_evolution:    monthlyEvolution,
      goals,
    });
  } catch (err) {
    console.error('Erro ao buscar resumo:', err);
    res.status(500).json({ error: 'Erro ao gerar resumo financeiro.' });
  }
}

// GET /api/dashboard/suggestions
// Retorna sugestoes de economia baseadas no historico do usuario.
// Esta e a logica "basica" de ML — o modelo Python substituira isso futuramente.
export async function getSuggestions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear  = now.getFullYear();

  try {
    // Compara os gastos do mes atual com os do mes anterior por categoria
    const result = await pool.query(
      `SELECT
         COALESCE(c.name, 'Sem categoria') AS category,
         SUM(CASE
           WHEN EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3
           THEN t.amount ELSE 0
         END) AS current_month,
         SUM(CASE
           WHEN EXTRACT(MONTH FROM t.date) = $4 AND EXTRACT(YEAR FROM t.date) = $5
           THEN t.amount ELSE 0
         END) AS previous_month
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND t.type = 'expense'
         AND t.date >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
       GROUP BY c.name
       HAVING SUM(t.amount) > 0
       ORDER BY current_month DESC`,
      [
        userId,
        currentMonth, currentYear,
        currentMonth === 1 ? 12 : currentMonth - 1,
        currentMonth === 1 ? currentYear - 1 : currentYear,
      ]
    );

    // Gera sugestoes para categorias com aumento de mais de 15% no mes
    const suggestions = result.rows
      .filter((row) => {
        const curr = Number(row.current_month);
        const prev = Number(row.previous_month);
        // Inclui se gastou mais este mes OU se nao havia gasto anterior (categoria nova)
        return curr > 0 && (prev === 0 || curr > prev * 1.15);
      })
      .map((row) => {
        const curr = Number(row.current_month);
        const prev = Number(row.previous_month);
        const increase = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;

        return {
          category: row.category,
          current_month: curr,
          previous_month: prev,
          increase_percentage: increase,
          suggestion: increase
            ? `Seus gastos com ${row.category} subiram ${increase}% em relacao ao mes passado.`
            : `Voce comecou a gastar com ${row.category} este mes.`,
        };
      });

    res.json({ suggestions });
  } catch (err) {
    console.error('Erro ao gerar sugestoes:', err);
    res.status(500).json({ error: 'Erro ao gerar sugestoes.' });
  }
}
