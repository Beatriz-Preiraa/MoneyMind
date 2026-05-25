import { Router } from 'express';
import { register, login, me } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Cria uma nova conta de usuario
 *     tags: [Autenticacao]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:     { type: string, example: "Fabio Silva" }
 *               email:    { type: string, example: "fabio@email.com" }
 *               password: { type: string, example: "minhasenha123" }
 *               phone:    { type: string, example: "11999990000" }
 *     responses:
 *       201: { description: "Conta criada com sucesso" }
 *       409: { description: "Email ja cadastrado" }
 */
router.post('/register', register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Faz login e retorna o token JWT
 *     tags: [Autenticacao]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: "Login realizado, token retornado" }
 *       401: { description: "Email ou senha incorretos" }
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Retorna os dados do usuario autenticado
 *     tags: [Autenticacao]
 *     responses:
 *       200: { description: "Dados do usuario" }
 *       401: { description: "Nao autenticado" }
 */
router.get('/me', authMiddleware, me);

export default router;
