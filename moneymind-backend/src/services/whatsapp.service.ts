import { Request, Response } from "express";
import axios from "axios";
import pool from "../config/database";
import { processMessage } from "../services/processMessage.service";

// -------------------------------------------------------------------------
// Verifica o webhook da Meta (necessario para ativar o webhook no painel)
// -------------------------------------------------------------------------
export const verificarWebhook = (req: Request, res: Response) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Webhook verificado com sucesso");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
};

// -------------------------------------------------------------------------
// Processa mensagens recebidas pelo WhatsApp
// -------------------------------------------------------------------------
export const processarMensagemWhatsApp = async (req: Request, res: Response) => {
  // Responde 200 imediatamente — a Meta exige isso em menos de 5 segundos
  res.sendStatus(200);

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== "text") return;

    const numeroUsuario = message.from; // formato: 5511999990000
    const texto = (message.text?.body || "").trim();

    console.log(`[WhatsApp] Mensagem de ${numeroUsuario}: "${texto}"`);

    // Busca o usuario pelo numero de telefone cadastrado
    const userResult = await pool.query(
      "SELECT id, name FROM users WHERE phone = $1 OR phone = $2",
      [numeroUsuario, "+" + numeroUsuario]
    );

    // 👇 ADICIONE ESSES DOIS LOGS AQUI ABAIXO:
    console.log(`👉 Parâmetros buscados: "$1" = ${numeroUsuario} | "$2" = +${numeroUsuario}`);
    console.log(`👉 Quantidade de usuários encontrados no banco: ${userResult.rows.length}`);
    if (userResult.rows.length > 0) {
      console.log(`👉 Usuário encontrado:`, userResult.rows[0]);
    } else {
      console.log(`❌ Nenhum usuário retornado para o número ${numeroUsuario}`);
    }

    // Se nao encontrar o usuario, orienta como se cadastrar
    if (userResult.rows.length === 0) {
      await enviarMensagem(
        numeroUsuario,
        `Olá! Seu número não está cadastrado no MoneyMind.\n\nAcesse o app e cadastre seu telefone nas configurações para usar o lançamento via WhatsApp.`
      );
      return;
    }

    const usuario = userResult.rows[0];
    const textoMinusculo = texto.toLowerCase();

    // 1. INTERCEPTA COMANDOS RÁPIDOS E ESTÁTICOS
    if (/^(saldo|resumo|quanto tenho|meu saldo)/.test(textoMinusculo)) {
      await responderSaldo(usuario.id, numeroUsuario);
      return;
    }

    if (/^(ajuda|help|comandos|como usar)/.test(textoMinusculo)) {
      await enviarMensagem(
        numeroUsuario,
        `*MoneyMind — Como usar no WhatsApp:*\n\n` +
        `Você pode conversar comigo naturalmente! Escreva como se estivesse falando com um amigo.\n\n` +
        `*Exemplos de lançamentos:*\n` +
        `• "Gastei 50 reais no almoço hoje"\n` +
        `• "Recebi meu salário de 3500"\n` +
        `• "Acabei de pagar 150 de gasolina"\n\n` +
        `*Consultas rápidas:*\n` +
        `• Escreva "saldo" ou "resumo"`
      );
      return;
    }

    // 2. CASO NÃO SEJA UM COMANDO DIRETO, PASSA PARA A IA CENTRALIZADA (Groq + FastAPI)
    // O processMessage já vai buscar o histórico, rodar a IA, cadastrar no banco e devolver a resposta ideal.
    const resultadoIA = await processMessage(usuario.id, texto, 'whatsapp');

    // 3. ENVIA A RESPOSTA GERADA PELA IA DE VOLTA PARA O WHATSAPP
    await enviarMensagem(numeroUsuario, resultadoIA.message);

  } catch (error) {
    console.error("[WhatsApp] Erro ao processar mensagem:", error);
  }
};

// -------------------------------------------------------------------------
// Responde com o saldo atual do mes
// -------------------------------------------------------------------------
async function responderSaldo(userId: string, numero: string): Promise<void> {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();

  const result = await pool.query(
    `SELECT
       SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS entradas,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS saidas
     FROM transactions
     WHERE user_id = $1
       AND EXTRACT(MONTH FROM date) = $2
       AND EXTRACT(YEAR  FROM date) = $3`,
    [userId, mes, ano]
  );

  const goalResult = await pool.query(
    "SELECT name, current_amount, target_amount FROM goals WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1",
    [userId]
  );

  const { entradas = 0, saidas = 0 } = result.rows[0];
  const saldo = Number(entradas) - Number(saidas);
  const goal  = goalResult.rows[0];

  const fmt = (v: number) => `R$ ${Number(v).toFixed(2).replace(".", ",")}`;

  let msg =
    `汇 *Resumo de ${new Date().toLocaleString("pt-BR", { month: "long" })}/${ano}*\n\n` +
    `✅ Entradas: ${fmt(entradas)}\n` +
    `💸 Saídas:   ${fmt(saidas)}\n` +
    `💰 Saldo:    ${fmt(saldo)}\n`;

  if (goal) {
    const pct = Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100);
    msg += `\n🐷 Reserva: ${fmt(goal.current_amount)} de ${fmt(goal.target_amount)} (${pct}%)`;
  }

  await enviarMensagem(numero, msg);
}

// -------------------------------------------------------------------------
// Envia mensagem pelo WhatsApp Cloud API
// -------------------------------------------------------------------------
const enviarMensagem = async (numero: string, mensagem: string): Promise<void> => {
  try {
    const token         = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to:   numero,
        text: { body: mensagem },
      },
      {
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("[WhatsApp] Erro ao enviar mensagem:", error);
  }
};