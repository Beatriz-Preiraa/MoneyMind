import { Request, Response } from 'express';
import pool from '../config/database';

// GET /api/categories
// Lista todas as categorias do usuario
export async function getCategories(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { type } = req.query; // filtro opcional: ?type=expense ou ?type=income

  try {
    let query = `
      SELECT id, name, type, icon, color, created_at
      FROM categories
      WHERE (user_id = $1 OR user_id IS NULL)
    `;
    const params: (string | number)[] = [userId];

    if (type) {
      query += ' AND type = $2';
      params.push(type as string);
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar categorias:', err);
    res.status(500).json({ error: 'Erro ao buscar categorias.' });
  }
}

// POST /api/categories
// Cria uma nova categoria personalizada
export async function createCategory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { name, type, icon, color } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'Nome e tipo sao obrigatorios.' });
    return;
  }

  if (!['income', 'expense'].includes(type)) {
    res.status(400).json({ error: 'Tipo deve ser "income" ou "expense".' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO categories (user_id, name, type, icon, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, name, type, icon || null, color || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar categoria:', err);
    res.status(500).json({ error: 'Erro ao criar categoria.' });
  }
}

// DELETE /api/categories/:id
// Remove uma categoria — transacoes ligadas a ela ficam sem categoria (SET NULL)
export async function deleteCategory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Categoria nao encontrada.' });
      return;
    }

    res.json({ message: 'Categoria removida com sucesso.' });
  } catch (err) {
    console.error('Erro ao deletar categoria:', err);
    res.status(500).json({ error: 'Erro ao remover categoria.' });
  }
}
