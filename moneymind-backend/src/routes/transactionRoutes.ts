import { Router } from 'express';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '../controllers/transactionController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas as rotas de transacoes exigem autenticacao
router.use(authMiddleware);

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: Lista as transacoes do usuario com filtros opcionais
 *     tags: [Transacoes]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: integer, example: 5 }
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [income, expense] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, example: 0 }
 *     responses:
 *       200: { description: "Lista de transacoes com total para paginacao" }
 */
router.get('/', getTransactions);

/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Registra uma nova transacao
 *     tags: [Transacoes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [description, amount, type]
 *             properties:
 *               description:  { type: string,  example: "Supermercado" }
 *               amount:       { type: number,  example: 250.90 }
 *               type:         { type: string,  enum: [income, expense] }
 *               category_id:  { type: string,  example: "uuid-da-categoria" }
 *               date:         { type: string,  example: "2026-05-19" }
 *               notes:        { type: string,  example: "Compras da semana" }
 *               source:       { type: string,  enum: [web, whatsapp, api] }
 *     responses:
 *       201: { description: "Transacao criada com sucesso" }
 */
router.post('/', createTransaction);

/**
 * @swagger
 * /api/transactions/{id}:
 *   put:
 *     summary: Atualiza uma transacao existente
 *     tags: [Transacoes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Transacao atualizada" }
 *       404: { description: "Transacao nao encontrada" }
 */
router.put('/:id', updateTransaction);

/**
 * @swagger
 * /api/transactions/{id}:
 *   delete:
 *     summary: Remove uma transacao
 *     tags: [Transacoes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Transacao removida" }
 *       404: { description: "Transacao nao encontrada" }
 */
router.delete('/:id', deleteTransaction);

export default router;
