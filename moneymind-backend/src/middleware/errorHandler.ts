import { Request, Response, NextFunction } from 'express';

// Centraliza o tratamento de erros.
// Em vez de cada controller ter seu proprio try/catch com res.json,
// eles lancam o erro e este middleware captura e responde de forma padronizada.
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Erro]', err.message);

  // Em producao, nao expomos detalhes tecnicos ao usuario
  const isDev = process.env.NODE_ENV === 'development';

  res.status(500).json({
    error: 'Erro interno do servidor.',
    ...(isDev && { details: err.message, stack: err.stack }),
  });
}
