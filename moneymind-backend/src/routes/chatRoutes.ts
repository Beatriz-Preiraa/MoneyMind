import { Router } from 'express';
import { chat } from '../controllers/chatController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Envia mensagem para o assistente financeiro
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Onde gastei mais este mes?"
 *               history:
 *                 type: array
 *                 description: Historico da conversa para manter contexto
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:    { type: string, enum: [user, assistant] }
 *                     content: { type: string }
 *     responses:
 *       200:
 *         description: Resposta do assistente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 reply: { type: string }
 */
router.post('/', chat);

export default router;
