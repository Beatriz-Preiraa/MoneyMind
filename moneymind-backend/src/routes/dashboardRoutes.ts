import { Router } from 'express';
import { getSummary, getSuggestions } from '../controllers/dashboardController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Retorna todos os dados do dashboard (totais, graficos, metas)
 *     tags: [Dashboard]
 *     parameters:
 *       - in: query
 *         name: month
 *         schema: { type: integer, example: 5 }
 *       - in: query
 *         name: year
 *         schema: { type: integer, example: 2026 }
 *     responses:
 *       200: { description: "Resumo financeiro completo" }
 */
router.get('/summary', getSummary);

/**
 * @swagger
 * /api/dashboard/suggestions:
 *   get:
 *     summary: Retorna sugestoes de economia baseadas no historico
 *     tags: [Dashboard]
 *     responses:
 *       200: { description: "Lista de sugestoes" }
 */
router.get('/suggestions', getSuggestions);

export default router;
