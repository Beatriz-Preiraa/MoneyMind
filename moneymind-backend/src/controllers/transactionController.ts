import { Request, Response } from 'express';
import pool from '../config/database';

// GET /api/transactions
// Lista as transacoes do usuario com suporte a filtros por periodo, tipo e categoria
export async function getTransactions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;

  // Filtros opcionais via query string: ?month=5&year=2026&type=expense&category_id=...
  const { month, year, type, category_id, limit = 50, offset = 0 } = req.query;

  try {
    // Construcao dinamica da query — adiciona clausulas WHERE conforme os filtros recebidos
    const conditions: string[] = ['t.user_id = $1'];
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (month && year) {
      conditions.push(`EXTRACT(MONTH FROM t.date) = $${paramIndex} AND EXTRACT(YEAR FROM t.date) = $${paramIndex + 1}`);
      params.push(Number(month), Number(year));
      paramIndex += 2;
    }

    if (type) {
      conditions.push(`t.type = $${paramIndex}`);
      params.push(type as string);
      paramIndex++;
    }

    if (category_id) {
      conditions.push(`t.category_id = $${paramIndex}`);
      params.push(category_id as string);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await pool.query(
      `SELECT
         t.id, t.description, t.amount, t.type, t.date, t.notes, t.source, t.created_at,
         c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${whereClause}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, Number(limit), Number(offset)]
    );

    // Total de registros para paginacao no frontend
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transactions t WHERE ${whereClause}`,
      params
    );

    res.json({
      data: result.rows,
      total: Number(countResult.rows[0].count),
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    console.error('Erro ao listar transacoes:', err);
    res.status(500).json({ error: 'Erro ao buscar transacoes.' });
  }
}

// POST /api/transactions
// Cria uma nova transacao (entrada ou saida)
export async function createTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { description, amount, type, category_id, date, notes, source } = req.body;

  if (!description || !amount || !type) {
    res.status(400).json({ error: 'Descricao, valor e tipo sao obrigatorios.' });
    return;
  }

  if (!['income', 'expense'].includes(type)) {
    res.status(400).json({ error: 'Tipo deve ser "income" ou "expense".' });
    return;
  }

  if (Number(amount) <= 0) {
    res.status(400).json({ error: 'O valor deve ser maior que zero.' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO transactions (user_id, description, amount, type, category_id, date, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        description,
        amount,
        type,
        category_id || null,
        date || new Date(),
        notes || null,
        source || 'web',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar transacao:', err);
    res.status(500).json({ error: 'Erro ao salvar transacao.' });
  }
}

// PUT /api/transactions/:id
// Atualiza uma transacao existente — apenas o dono pode editar
export async function updateTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;
  const { description, amount, type, category_id, date, notes } = req.body;

  try {
    // Garante que o usuario so edita suas proprias transacoes
    const existing = await pool.query(
      'SELECT id FROM transactions WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Transacao nao encontrada.' });
      return;
    }

    const result = await pool.query(
      `UPDATE transactions
       SET description = COALESCE($1, description),
           amount      = COALESCE($2, amount),
           type        = COALESCE($3, type),
           category_id = COALESCE($4, category_id),
           date        = COALESCE($5, date),
           notes       = COALESCE($6, notes),
           updated_at  = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [description, amount, type, category_id, date, notes, id, userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar transacao:', err);
    res.status(500).json({ error: 'Erro ao atualizar transacao.' });
  }
}

// DELETE /api/transactions/:id
// Remove uma transacao — apenas o dono pode deletar
export async function deleteTransaction(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Transacao nao encontrada.' });
      return;
    }

    res.json({ message: 'Transacao removida com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar transacao:', err);
    res.status(500).json({ error: 'Erro ao remover transacao.' });
  }
}
