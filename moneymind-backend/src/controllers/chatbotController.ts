import { Request, Response } from 'express';
import { processMessage } from '../services/processMessage.service';

export async function sendChatbotMessage(
  req: Request,
  res: Response
): Promise<void> {

  try {

    const userId = req.user?.id;
    const { message } = req.body;

    if (!userId) {
      res.status(401).json({
        error: 'Usuario nao autenticado.'
      });
      return;
    }

    if (!message) {
      res.status(400).json({
        error: 'Mensagem obrigatoria.'
      });
      return;
    }

    const result = await processMessage(
      userId,
      message,
      'web'
    );

    res.json(result);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: 'Erro interno.'
    });
  }
}