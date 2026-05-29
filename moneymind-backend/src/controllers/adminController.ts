import { Request, Response } from 'express';
import pool from '../config/database';

// ─────────────────────────────────────────────
// Middleware de verificacao de Admin
// Adicione is_admin BOOLEAN DEFAULT false na tabela users
// e passe req.user.is_admin pelo authMiddleware
// ─────────────────────────────────────────────

// GET /api/admin/stats
// Retorna metricas gerais do sistema
export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const [users, txResult, goalsResult, activeResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS total,
                         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_last_30d,
                         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS new_last_7d
                  FROM users`),

      pool.query(`SELECT COUNT(*)                   AS total_transactions,
                         SUM(amount) FILTER (WHERE type = 'income')  AS total_income,
                         SUM(amount) FILTER (WHERE type = 'expense') AS total_expense
                  FROM transactions`),

      pool.query(`SELECT COUNT(*) AS total_goals FROM goals`),

      // Usuarios ativos = fizeram ao menos 1 transacao nos ultimos 30 dias
      pool.query(`SELECT COUNT(DISTINCT user_id) AS active_users
                  FROM transactions
                  WHERE created_at >= NOW() - INTERVAL '30 days'`),
    ]);

    res.json({
      users: {
        total:        Number(users.rows[0].total),
        new_last_30d: Number(users.rows[0].new_last_30d),
        new_last_7d:  Number(users.rows[0].new_last_7d),
        active_last_30d: Number(activeResult.rows[0].active_users),
      },
      transactions: {
        total:         Number(txResult.rows[0].total_transactions),
        total_income:  Number(txResult.rows[0].total_income  || 0),
        total_expense: Number(txResult.rows[0].total_expense || 0),
      },
      goals: {
        total: Number(goalsResult.rows[0].total_goals),
      },
    });
  } catch (err) {
    console.error('Erro em admin/stats:', err);
    res.status(500).json({ error: 'Erro ao buscar estatisticas.' });
  }
}

// GET /api/admin/users
// Lista usuarios com paginacao (query: page, limit, search)
export async function listUsers(req: Request, res: Response): Promise<void> {
  const page   = Math.max(1, Number(req.query.page)  || 1);
  const limit  = Math.min(50, Number(req.query.limit) || 20);
  const search = (req.query.search as string) || '';
  const offset = (page - 1) * limit;

  try {
    const searchPattern = `%${search}%`;

    const [countResult, usersResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM users
         WHERE ($1 = '' OR name ILIKE $1 OR email ILIKE $1)`,
        [search ? searchPattern : '']
      ),
      pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.created_at,
                COUNT(t.id)         AS total_transactions,
                MAX(t.created_at)   AS last_transaction_at
         FROM users u
         LEFT JOIN transactions t ON t.user_id = u.id
         WHERE ($1 = '' OR u.name ILIKE $1 OR u.email ILIKE $1)
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT $2 OFFSET $3`,
        [search ? searchPattern : '', limit, offset]
      ),
    ]);

    const total      = Number(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    res.json({
      users:      usersResult.rows,
      pagination: { page, limit, total, total_pages: totalPages },
    });
  } catch (err) {
    console.error('Erro em admin/users:', err);
    res.status(500).json({ error: 'Erro ao listar usuarios.' });
  }
}

// GET /api/admin/users/:id
// Detalhe de um usuario especifico
export async function getUserDetail(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const [userResult, txResult, goalsResult] = await Promise.all([
      pool.query(
        `SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = $1`,
        [id]
      ),
      pool.query(
        `SELECT t.*, c.name AS category_name
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = $1
         ORDER BY t.date DESC
         LIMIT 10`,
        [id]
      ),
      pool.query(
        `SELECT id, name, target_amount, current_amount, deadline FROM goals WHERE user_id = $1`,
        [id]
      ),
    ]);

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: 'Usuario nao encontrado.' });
      return;
    }

    res.json({
      user:               userResult.rows[0],
      recent_transactions: txResult.rows,
      goals:              goalsResult.rows,
    });
  } catch (err) {
    console.error('Erro em admin/users/:id:', err);
    res.status(500).json({ error: 'Erro ao buscar detalhes do usuario.' });
  }
}

// GET /api/admin/growth
// Crescimento de usuarios por mes (ultimos 6 meses)
export async function getUserGrowth(req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon/YY') AS month,
              COUNT(*) AS new_users
       FROM users
       WHERE created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY DATE_TRUNC('month', created_at)`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erro em admin/growth:', err);
    res.status(500).json({ error: 'Erro ao buscar crescimento.' });
  }
}
