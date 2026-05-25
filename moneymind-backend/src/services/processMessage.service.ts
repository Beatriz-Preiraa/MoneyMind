import axios from 'axios';
import pool from '../config/database';

interface ProcessMessageResult {
  success: boolean;
  message: string;
  transaction?: any;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function processMessage(
  userId: string,
  texto: string,
  origem: 'web' | 'whatsapp'
): Promise<ProcessMessageResult> {

  try {
    const fastApiUrl = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

    // 1. BUSCAR HISTÓRICO DE MENSAGENS (Para dar memória à IA)
    // Buscamos as últimas 6 mensagens trocadas para manter o contexto sem pesar a requisição
    const historyResult = await pool.query(
      `
      SELECT role, content 
      FROM chat_messages 
      WHERE user_id = $1 
      ORDER BY id DESC 
      LIMIT 6
      `,
      [userId]
    );

    // Como pegamos em ordem decrescente (DESC) para limitar, invertemos para enviar na ordem cronológica correta
    const historico: ChatMessage[] = historyResult.rows.reverse();

    // Adiciona a nova mensagem enviada pelo usuário ao histórico
    const mensagensParaEnvio = [
      ...historico,
      { role: 'user', content: texto }
    ];

    // 2. REQUISIÇÃO PARA O NOVO ENDPOINT DO FASTAPI
    const respostaML = await axios.post(
      `${fastApiUrl}/v1/chat`,
      {
        messages: mensagensParaEnvio
      }
    );

    const { resposta, action } = respostaML.data;
    console.log('RESPOSTA IA:', respostaML.data);

    let transaction = null;

    // 3. SE A IA DETECTOU UMA AÇÃO DE CADASTRO (Function Calling)
    if (action && action.type === 'INSERT_TRANSACTION') {
      const { valor, categoria, tipo } = action.payload;

      // Normaliza o tipo vindo da IA para bater com o seu banco (expense / income)
      let tipoNormalizado = tipo;
      if (tipo === 'gasto' || tipo === 'saida') tipoNormalizado = 'expense';
      if (tipo === 'entrada' || tipo === 'ganho') tipoNormalizado = 'income';

      // Busca o ID da categoria no banco
      let categoryId = null;
      const categoryResult = await pool.query(
        `
        SELECT id FROM categories 
        WHERE LOWER(name) = LOWER($1) 
        LIMIT 1
        `,
        [categoria]
      );

      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].id;
      }

      // Faz a inserção real na sua tabela de transações
      const transactionResult = await pool.query(
        `
        INSERT INTO transactions (
          user_id, description, amount, type, category_id, source
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [userId, texto, valor, tipoNormalizado, categoryId, origem]
      );

      transaction = transactionResult.rows[0];
      console.log('TRANSACÃO SALVA NO DASH:', transaction);
    }

    // 4. SALVAR A CONVERSA ATUAL NO BANCO (Para as próximas mensagens terem contexto)
    // Garante que a pergunta do usuário e a resposta da IA fiquem gravadas
    await pool.query(
      `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'user', $2)`,
      [userId, texto]
    );
    await pool.query(
      `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'assistant', $2)`,
      [userId, resposta]
    );

    // 5. RETORNO PARA A INTERFACE
    return {
      success: true,
      transaction,
      message: resposta // Agora a mensagem retornada é a frase natural construída pela IA!
    };

  } catch (error) {
    console.error('Erro ao processar mensagem no service:', error);

    return {
      success: false,
      message: 'Erro ao processar mensagem.'
    };
  }
}