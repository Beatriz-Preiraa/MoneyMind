import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';

// Gera um token JWT com os dados do usuario.
// O token expira conforme configurado no .env (padrao: 7 dias).
function generateToken(id: string, email: string): string {
  const secret = process.env.JWT_SECRET as string;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id, email }, secret, { expiresIn } as jwt.SignOptions);
}

// POST /api/auth/register
// Cria um novo usuario. A senha e armazenada como hash — nunca em texto puro.
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Nome, email e senha sao obrigatorios.' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    return;
  }

  try {
    // Verifica se o email ja esta em uso
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Este email ja esta cadastrado.' });
      return;
    }

    // O salt com 10 rounds e o padrao seguro para aplicacoes web
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, created_at`,
      [name, email, hashedPassword, phone || null]
    );

const user = result.rows[0];

// Cria a meta de reserva de emergencia automaticamente para todo usuario novo
// O valor padrao e 9600 — o usuario pode ajustar depois
await pool.query(
  `INSERT INTO goals (user_id, name, target_amount, current_amount)
   VALUES ($1, 'Reserva de Emergencia', 9600.00, 0.00)`,
  [user.id]
);

const token = generateToken(user.id, user.email);

res.status(201).json({ user, token });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
  }
}

// POST /api/auth/login
// Autentica o usuario e retorna o token JWT
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email e senha sao obrigatorios.' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, password, phone FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Mensagem generica — nao informamos se o email existe ou nao (seguranca)
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const token = generateToken(user.id, user.email);

    // Retorna o usuario sem o campo password
    const { password: _pw, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao fazer login. Tente novamente.' });
  }
}

// GET /api/auth/me
// Retorna os dados do usuario atualmente autenticado
export async function me(req: Request, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT id, name, email, phone, created_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario nao encontrado.' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar usuario:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
}
