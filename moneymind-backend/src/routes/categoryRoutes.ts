import { Router } from 'express';
import { getCategories, createCategory, deleteCategory } from '../controllers/categoryController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Lista as categorias do usuario
 *     tags: [Categorias]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [income, expense] }
 *     responses:
 *       200: { description: "Lista de categorias" }
 */
router.get('/', getCategories);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Cria uma nova categoria
 *     tags: [Categorias]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:  { type: string, example: "Alimentacao" }
 *               type:  { type: string, enum: [income, expense] }
 *               icon:  { type: string, example: "ti-tools-kitchen-2" }
 *               color: { type: string, example: "#EF9F27" }
 *     responses:
 *       201: { description: "Categoria criada" }
 */
router.post('/', createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Remove uma categoria
 *     tags: [Categorias]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "Categoria removida" }
 */
router.delete('/:id', deleteCategory);

export default router;
