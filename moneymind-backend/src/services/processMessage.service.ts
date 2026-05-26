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

    // 1. BUSCAR HISTÓRICO DE MENSAGENS (para dar memória à IA)
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

    // Como pegamos em ordem decrescente (DESC) para limitar, invertemos para a ordem cronológica correta
    const historico: ChatMessage[] = historyResult.rows.reverse();

    // Adiciona a nova mensagem do usuário ao histórico antes de enviar
    const mensagensParaEnvio = [
      ...historico,
      { role: 'user', content: texto }
    ];

    // 2. REQUISIÇÃO PARA O FASTAPI
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
      // CORREÇÃO 1: usa action.payload.descricao como descrição da transação
      const { valor, categoria, tipo, descricao } = action.payload;

      console.log('PAYLOAD DA IA:', action.payload);

      // CORREÇÃO 2: normaliza o tipo vindo da IA para os valores aceitos pelo banco (expense / income)
      let tipoNormalizado = tipo;
      if (tipo === 'gasto' || tipo === 'saida') tipoNormalizado = 'expense';
      if (tipo === 'entrada' || tipo === 'ganho') tipoNormalizado = 'income';

      // CORREÇÃO 3: busca a categoria usando unaccent para ignorar diferença de acentuação
      // Isso resolve o caso onde a IA retorna "Alimentacao" mas no banco está "Alimentação"
      let categoryId = null;
      const categoryResult = await pool.query(
        `
        SELECT id FROM categories 
        WHERE unaccent(LOWER(name)) = unaccent(LOWER($1)) 
        LIMIT 1
        `,
        [categoria]
      );

      if (categoryResult.rows.length > 0) {
        categoryId = categoryResult.rows[0].id;
      } else {
        // Categoria não encontrada — registra no log para facilitar debug
        console.warn(`Categoria não encontrada no banco: "${categoria}". Transação será salva sem categoria.`);
      }

      // Insere a transação na tabela usando a descricao vinda da IA (não o texto bruto do usuário)
      const transactionResult = await pool.query(
        `
        INSERT INTO transactions (
          user_id, description, amount, type, category_id, source
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [userId, descricao || texto, valor, tipoNormalizado, categoryId, origem]
      );

      transaction = transactionResult.rows[0];
      console.log('TRANSAÇÃO SALVA NO PAINEL:', transaction);
    }

    // 4. SALVAR A CONVERSA NO BANCO (para as próximas mensagens terem contexto)
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
      message: resposta
    };

  } catch (error) {
    console.error('Erro ao processar mensagem no service:', error);

    return {
      success: false,
      message: 'Erro ao processar mensagem.'
    };
  }
}
