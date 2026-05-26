import { Request, Response } from 'express';
import { processMessage } from '../services/processMessage.service';

/**
 * Controller unificado para o chat da aplicação web.
 * Usa o mesmo processMessage do WhatsApp — garantindo comportamento idêntico.
 */
export const chat = async (req: Request, res: Response) => {
  try {
    // O userId vem do middleware de autenticação (JWT)
    const userId = (req as any).user?.id || (req as any).userId;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Campo "message" é obrigatório.' });
    }

    // Usa o serviço centralizado — mesma lógica do WhatsApp
    const resultado = await processMessage(userId, message.trim(), 'web');

    return res.status(200).json({
      reply: resultado.message,
      success: resultado.success,
      transaction: resultado.transaction || null
    });

  } catch (error) {
    console.error('[chatController] Erro:', error);
    return res.status(500).json({ error: 'Erro interno ao processar mensagem.' });
  }
};
