import { Request, Response } from 'express';
import pool from '../config/database';

// -------------------------------------------------------------------------
// POST /api/chat
//
// Chatbot financeiro inteligente.
// Funciona em dois modos:
//   1. Com OpenAI (OPENAI_API_KEY configurada) — respostas geradas por IA
//      com contexto financeiro real do usuario injetado no prompt
//   2. Sem OpenAI (fallback) — respostas por palavras-chave, funciona offline
//
// O frontend envia: { message: "string", history: [{role, content}] }
// -------------------------------------------------------------------------
export async function chat(req: Request, res: Response): Promise<void> {
  const userId  = req.user!.id;
  const { message, history = [] } = req.body;

  if (!message) {
    res.status(400).json({ error: 'Mensagem nao pode ser vazia.' });
    return;
  }

  try {
    // Busca contexto financeiro real do usuario para enriquecer as respostas
    const contexto = await buscarContextoFinanceiro(userId);

    // Tenta usar OpenAI se a chave estiver configurada
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && apiKey !== 'sk-sua_chave_openai_aqui') {
      const resposta = await chatComOpenAI(message, history, contexto, apiKey);
      res.json({ reply: resposta });
      return;
    }

    // Fallback — respostas por palavras-chave com dados reais do usuario
    const resposta = respostaFallback(message, contexto);
    res.json({ reply: resposta });

  } catch (err) {
    console.error('Erro no chatbot:', err);
    res.status(500).json({ error: 'Erro ao processar mensagem.' });
  }
}

// -------------------------------------------------------------------------
// Busca dados financeiros reais para usar no contexto do chatbot
// -------------------------------------------------------------------------
async function buscarContextoFinanceiro(userId: string): Promise<string> {
  const mes = new Date().getMonth() + 1;
  const ano = new Date().getFullYear();

  const totaisResult = await pool.query(
    `SELECT
       SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS entradas,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS saidas
     FROM transactions
     WHERE user_id = $1
       AND EXTRACT(MONTH FROM date) = $2
       AND EXTRACT(YEAR  FROM date) = $3`,
    [userId, mes, ano]
  );

  const catResult = await pool.query(
    `SELECT COALESCE(c.name, 'Sem categoria') AS categoria, SUM(t.amount) AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND t.type = 'expense'
       AND EXTRACT(MONTH FROM t.date) = $2
       AND EXTRACT(YEAR  FROM t.date) = $3
     GROUP BY c.name ORDER BY total DESC LIMIT 5`,
    [userId, mes, ano]
  );

  const goalResult = await pool.query(
    `SELECT name, current_amount, target_amount FROM goals WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );

  const { entradas = 0, saidas = 0 } = totaisResult.rows[0];
  const saldo    = Number(entradas) - Number(saidas);
  const goal     = goalResult.rows[0];
  const fmt      = (v: number) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
  const meses    = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  let ctx = `Dados financeiros do usuario em ${meses[mes - 1]}/${ano}:\n`;
  ctx += `- Entradas: ${fmt(entradas)}\n`;
  ctx += `- Saidas: ${fmt(saidas)}\n`;
  ctx += `- Saldo: ${fmt(saldo)}\n`;

  if (catResult.rows.length > 0) {
    ctx += `- Maiores gastos por categoria:\n`;
    catResult.rows.forEach(r => {
      ctx += `  * ${r.categoria}: ${fmt(r.total)}\n`;
    });
  }

  if (goal) {
    const pct = Math.round((Number(goal.current_amount) / Number(goal.target_amount)) * 100);
    ctx += `- Reserva de emergencia: ${fmt(goal.current_amount)} de ${fmt(goal.target_amount)} (${pct}%)\n`;
  }

  return ctx;
}

// -------------------------------------------------------------------------
// Chama a API da OpenAI com contexto financeiro real injetado no system prompt
// -------------------------------------------------------------------------
async function chatComOpenAI(
  message:   string,
  history:   Array<{ role: string; content: string }>,
  contexto:  string,
  apiKey:    string
): Promise<string> {
  const systemPrompt =
    `Voce e um assistente financeiro pessoal chamado MoneyMind. ` +
    `Responda sempre em portugues brasileiro de forma clara, objetiva e amigavel. ` +
    `Nao use linguagem tecnica demais. Seja como um amigo que entende de financas. ` +
    `Quando der sugestoes de investimento, sempre mencione o Tesouro Selic como opcao segura para reserva de emergencia. ` +
    `Nunca invente dados — use apenas os dados reais abaixo:\n\n${contexto}`;

  // Monta o historico de mensagens para a API (limita a 10 mensagens para economizar tokens)
  const mensagens = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10),
    { role: 'user', content: message },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini', // modelo mais barato e rapido — perfeito para chatbot
      messages:    mensagens,
      max_tokens:  400,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as any;
  return data.choices[0].message.content;
}

// -------------------------------------------------------------------------
// Fallback sem OpenAI — respostas por palavras-chave com dados reais
// -------------------------------------------------------------------------
function respostaFallback(message: string, contexto: string): string {
  const texto = message.toLowerCase();

  // Extrai valores do contexto para usar nas respostas
  const entradas = contexto.match(/Entradas: R\$ ([\d.,]+)/)?.[1] || '0';
  const saidas   = contexto.match(/Saidas: R\$ ([\d.,]+)/)?.[1]   || '0';
  const saldo    = contexto.match(/Saldo: R\$ ([\d.,]+)/)?.[1]    || '0';

  if (texto.includes('gast') || texto.includes('categor') || texto.includes('mais'))
    return `Seus maiores gastos este mes estao detalhados no grafico de categorias. No total, suas saidas foram R$ ${saidas}. Quer dicas para reduzir alguma categoria especifica?`;

  if (texto.includes('econom') || texto.includes('reduz') || texto.includes('cortar'))
    return `Para economizar, analise as categorias com maior gasto no grafico abaixo. Reducoes pequenas no dia a dia — como levar almoco ou cancelar uma assinatura — podem liberar R$ 150 a R$ 300 por mes para a reserva.`;

  if (texto.includes('invest') || texto.includes('aplicar') || texto.includes('rend'))
    return `Para quem esta formando reserva de emergencia, o *Tesouro Selic* e a melhor opcao: seguro, com liquidez diaria (voce resgata quando quiser) e rendimento acima da poupanca. Disponivel a partir de R$ 30 em qualquer corretora.`;

  if (texto.includes('reserva') || texto.includes('emergencia') || texto.includes('meta'))
    return `Sua reserva de emergencia esta em progresso. O ideal e ter de 3 a 6 meses de despesas guardados. Guarde pelo menos R$ 200 por mes no Tesouro Selic para chegar la mais rapido.`;

  if (texto.includes('saldo') || texto.includes('quanto tenho') || texto.includes('resumo'))
    return `Resumo de ${new Date().toLocaleString('pt-BR', { month: 'long' })}: Entradas R$ ${entradas} | Saidas R$ ${saidas} | Saldo R$ ${saldo}.`;

  if (texto.includes('salario') || texto.includes('receita') || texto.includes('entrada'))
    return `Suas entradas este mes somam R$ ${entradas}. Lembre-se de registrar todas as fontes de renda para ter um panorama completo.`;

  return `Posso te ajudar com informacoes sobre seus gastos, dicas de economia, sugestoes de investimento e acompanhamento da sua reserva. O que voce quer saber?`;
}
