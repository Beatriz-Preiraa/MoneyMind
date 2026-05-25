import { Router } from 'express';
import { getGoals, createGoal, depositGoal, updateGoal, deleteGoal } from '../controllers/goalController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

/**
 * @swagger
 * /api/goals:
 *   get:
 *     summary: Lista as metas financeiras do usuario
 *     tags: [Metas]
 *   post:
 *     summary: Cria uma nova meta financeira
 *     tags: [Metas]
 */
router.get('/',    getGoals);
router.post('/',   createGoal);

/**
 * @swagger
 * /api/goals/{id}/deposit:
 *   put:
 *     summary: Adiciona valor a uma meta (aporte na reserva)
 *     tags: [Metas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, example: 300 }
 */
router.put('/:id/deposit', depositGoal);
router.put('/:id',         updateGoal);
router.delete('/:id',      deleteGoal);

export default router;
