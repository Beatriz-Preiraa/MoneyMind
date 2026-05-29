import { Router } from 'express';
import {
  register,
  login,
  me,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Cria uma nova conta de usuario
 *     tags: [Autenticacao]
 *     security: []
 */
router.post('/register', register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Faz login e retorna o token JWT
 *     tags: [Autenticacao]
 *     security: []
 */
router.post('/login', login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Retorna os dados do usuario autenticado
 *     tags: [Autenticacao]
 */
router.get('/me', authMiddleware, me);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Atualiza nome, email e telefone
 *     tags: [Autenticacao]
 */
router.put('/profile', authMiddleware, updateProfile);

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Altera a senha do usuario autenticado
 *     tags: [Autenticacao]
 */
router.put('/change-password', authMiddleware, changePassword);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicita link de redefinicao de senha por email
 *     tags: [Autenticacao]
 *     security: []
 */
router.post('/forgot-password', forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Redefine a senha usando o token recebido por email
 *     tags: [Autenticacao]
 *     security: []
 */
router.post('/reset-password', resetPassword);

export default router;
