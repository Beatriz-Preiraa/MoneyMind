import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Este middleware roda antes de qualquer controller que precise de autenticacao.
// Ele verifica se o token JWT enviado no header Authorization e valido.
// Se for invalido ou ausente, a requisicao e bloqueada aqui mesmo.
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  // O header deve ser: "Authorization: Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticacao nao fornecido.' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET as string;
    const decoded = jwt.verify(token, secret) as { id: string; email: string };

    // Anexa os dados do usuario ao request para que os controllers acessem
    req.user = { id: decoded.id, email: decoded.email };

    next();
  } catch {
    res.status(401).json({ error: 'Token invalido ou expirado. Faca login novamente.' });
  }
}
