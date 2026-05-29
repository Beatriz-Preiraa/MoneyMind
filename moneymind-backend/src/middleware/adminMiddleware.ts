import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';

// Verifica se o usuario autenticado tem flag is_admin = true
// Sempre use DEPOIS do authMiddleware
export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT is_admin FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      res.status(403).json({ error: 'Acesso restrito. Permissao de administrador necessaria.' });
      return;
    }

    next();
  } catch (err) {
    console.error('Erro no adminMiddleware:', err);
    res.status(500).json({ error: 'Erro interno de autorizacao.' });
  }
}
