import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/database';
import { sendPasswordResetEmail } from '../services/email.service';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function generateToken(id: string, email: string): string {
  const secret    = process.env.JWT_SECRET as string;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id, email }, secret, { expiresIn } as jwt.SignOptions);
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
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
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Este email ja esta cadastrado.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, phone, created_at`,
      [name, email, hashedPassword, phone || null]
    );

    const user = result.rows[0];

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

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
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
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const user          = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      res.status(401).json({ error: 'Email ou senha incorretos.' });
      return;
    }

    const token = generateToken(user.id, user.email);
    const { password: _pw, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro ao fazer login. Tente novamente.' });
  }
}

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// PUT /api/auth/profile
// Atualiza nome, email e/ou telefone do usuario
// ─────────────────────────────────────────────
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { name, email, phone } = req.body;
  const userId = req.user!.id;

  if (!name && !email && phone === undefined) {
    res.status(400).json({ error: 'Informe ao menos um campo para atualizar.' });
    return;
  }

  try {
    if (email) {
      const conflict = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      if (conflict.rows.length > 0) {
        res.status(409).json({ error: 'Este email ja esta em uso por outra conta.' });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE users
       SET name       = COALESCE($1, name),
           email      = COALESCE($2, email),
           phone      = COALESCE($3, phone),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, phone, created_at, updated_at`,
      [name || null, email || null, phone !== undefined ? phone : null, userId]
    );

    res.json({ message: 'Perfil atualizado com sucesso.', user: result.rows[0] });
  } catch (err) {
    console.error('Erro ao atualizar perfil:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil. Tente novamente.' });
  }
}

// ─────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────
export async function changePassword(req: Request, res: Response): Promise<void> {
  const { current_password, new_password } = req.body;
  const userId = req.user!.id;

  if (!current_password || !new_password) {
    res.status(400).json({ error: 'Senha atual e nova senha sao obrigatorias.' });
    return;
  }

  if (new_password.length < 6) {
    res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
    return;
  }

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Usuario nao encontrado.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(current_password, result.rows[0].password);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Senha atual incorreta.' });
      return;
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );

    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    console.error('Erro ao trocar senha:', err);
    res.status(500).json({ error: 'Erro ao alterar senha.' });
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Email e obrigatorio.' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, name FROM users WHERE email = $1',
      [email]
    );

    // Resposta generica — nao revelamos se o email existe (seguranca)
    if (result.rows.length === 0) {
      res.json({ message: 'Se este email estiver cadastrado, voce recebera as instrucoes em breve.' });
      return;
    }

    const user       = result.rows[0];
    const resetToken = generateResetToken();
    const expiresAt  = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Salva o hash do token — nunca o token puro
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET token_hash = $2, expires_at = $3, created_at = NOW()`,
      [user.id, tokenHash, expiresAt]
    );

    await sendPasswordResetEmail(email, user.name, resetToken);

    res.json({ message: 'Se este email estiver cadastrado, voce recebera as instrucoes em breve.' });
  } catch (err) {
    console.error('Erro no forgot-password:', err);
    res.status(500).json({ error: 'Erro ao processar solicitacao. Tente novamente.' });
  }
}

// ─────────────────────────────────────────────
// POST /api/auth/reset-password
// ─────────────────────────────────────────────
export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, new_password } = req.body;

  if (!token || !new_password) {
    res.status(400).json({ error: 'Token e nova senha sao obrigatorios.' });
    return;
  }

  if (new_password.length < 6) {
    res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    return;
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await pool.query(
      `SELECT prt.user_id, prt.expires_at, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Link de redefinicao invalido ou ja utilizado.' });
      return;
    }

    const { user_id, expires_at } = result.rows[0];

    if (new Date() > new Date(expires_at)) {
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user_id]);
      res.status(400).json({ error: 'Este link expirou. Solicite um novo.' });
      return;
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [newHash, user_id]
    );

    // Invalida o token apos uso — token de uso unico
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user_id]);

    res.json({ message: 'Senha redefinida com sucesso! Faca login com sua nova senha.' });
  } catch (err) {
    console.error('Erro no reset-password:', err);
    res.status(500).json({ error: 'Erro ao redefinir senha. Tente novamente.' });
  }
}
