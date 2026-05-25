import { Request, Response } from 'express';
import pool from '../config/database';

// GET /api/goals — lista todas as metas do usuario
export async function getGoals(req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, name, target_amount, current_amount, deadline, created_at,
              ROUND((current_amount / NULLIF(target_amount, 0)) * 100) AS percentage
       FROM goals WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.user!.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar metas:', err);
    res.status(500).json({ error: 'Erro ao buscar metas.' });
  }
}

// POST /api/goals — cria nova meta
export async function createGoal(req: Request, res: Response): Promise<void> {
  const { name, target_amount, current_amount, deadline } = req.body;
  if (!name || !target_amount) {
    res.status(400).json({ error: 'Nome e valor alvo sao obrigatorios.' });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO goals (user_id, name, target_amount, current_amount, deadline)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user!.id, name, target_amount, current_amount || 0, deadline || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar meta:', err);
    res.status(500).json({ error: 'Erro ao criar meta.' });
  }
}

// PUT /api/goals/:id/deposit — adiciona valor a uma meta (aporte na reserva)
export async function depositGoal(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { amount } = req.body;

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ error: 'Valor do aporte deve ser maior que zero.' });
    return;
  }

  try {
    // Verifica se a meta pertence ao usuario
    const check = await pool.query(
      'SELECT id, name, current_amount, target_amount FROM goals WHERE id = $1 AND user_id = $2',
      [id, req.user!.id]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Meta nao encontrada.' });
      return;
    }

    const meta = check.rows[0];

    // Atualiza o valor atual da meta
    const result = await pool.query(
      `UPDATE goals SET current_amount = current_amount + $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *, ROUND((current_amount / NULLIF(target_amount, 0)) * 100) AS percentage`,
      [amount, id, req.user!.id]
    );

    // Registra como transacao de entrada para aparecer no historico
    await pool.query(
      `INSERT INTO transactions (user_id, description, amount, type, date, notes, source)
       VALUES ($1, $2, $3, 'income', CURRENT_DATE, $4, 'web')`,
      [req.user!.id, `Aporte — ${meta.name}`, amount, `Aporte na meta: ${meta.name}`]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao depositar na meta:', err);
    res.status(500).json({ error: 'Erro ao registrar aporte.' });
  }
}

// PUT /api/goals/:id — atualiza dados da meta (nome, valor alvo, prazo)
export async function updateGoal(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { name, target_amount, deadline } = req.body;
  try {
    const result = await pool.query(
      `UPDATE goals SET
         name          = COALESCE($1, name),
         target_amount = COALESCE($2, target_amount),
         deadline      = COALESCE($3, deadline),
         updated_at    = NOW()
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name, target_amount, deadline, id, req.user!.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Meta nao encontrada.' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar meta:', err);
    res.status(500).json({ error: 'Erro ao atualizar meta.' });
  }
}

// DELETE /api/goals/:id
export async function deleteGoal(req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Meta nao encontrada.' });
      return;
    }
    res.json({ message: 'Meta removida.' });
  } catch (err) {
    console.error('Erro ao deletar meta:', err);
    res.status(500).json({ error: 'Erro ao remover meta.' });
  }
}
