
import { Router } from 'express';
import { sendChatbotMessage } from '../controllers/chatbotController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post(
  '/message',
  authMiddleware,
  sendChatbotMessage
);

export default router;
