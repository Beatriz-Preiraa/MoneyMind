import { Router } from 'express';
import { authMiddleware }  from '../middleware/auth';
import { adminMiddleware } from '../middleware/adminMiddleware';
import {
  getStats,
  listUsers,
  getUserDetail,
  getUserGrowth,
} from '../controllers/adminController';

const router = Router();

// Todas as rotas admin exigem token valido + flag is_admin
router.use(authMiddleware, adminMiddleware);

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     summary: Metricas gerais da plataforma
 *     tags: [Admin]
 */
router.get('/stats', getStats);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Lista usuarios com paginacao e busca
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 */
router.get('/users', listUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Detalhe de um usuario especifico
 *     tags: [Admin]
 */
router.get('/users/:id', getUserDetail);

/**
 * @swagger
 * /api/admin/growth:
 *   get:
 *     summary: Crescimento de usuarios por mes
 *     tags: [Admin]
 */
router.get('/growth', getUserGrowth);

export default router;
