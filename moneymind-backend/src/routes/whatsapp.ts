import { Router, Request, Response } from "express";
import {
  verificarWebhook,
  processarMensagemWhatsApp
} from "../services/whatsapp.service";

const router = Router();

/**
 * Verificação do webhook da Meta
 */
router.get("/webhook", verificarWebhook);

/**
 * Recebimento das mensagens
 */
router.post("/webhook", (req: Request, res: Response, next) => {
  console.log("\n=======================================================");
  console.log("👉 [WEBHOOK] META ENVIOU UMA REQUISIÇÃO POST!");
  console.log("👉 CORPO DA REQUISIÇÃO:", JSON.stringify(req.body, null, 2));
  console.log("=======================================================\n");
  
  // Repassa a bola para o seu serviço processar
  processarMensagemWhatsApp(req, res);
});

export default router;