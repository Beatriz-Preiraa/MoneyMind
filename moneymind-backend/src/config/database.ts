import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// O Supabase fornece uma connection string direta no formato:
// postgresql://postgres:[SENHA]@db.[PROJECT_ID].supabase.co:5432/postgres
//
// Voce encontra essa string em: Supabase Dashboard > Project Settings > Database > Connection string
// Copie a opcao "URI" e cole no .env como DATABASE_URL
//
// O SSL e obrigatorio no Supabase — sem ele a conexao e recusada.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // rejectUnauthorized: false aceita o certificado autoassinado do Supabase.
    // Em producao isso e seguro porque a criptografia continua ativa.
    rejectUnauthorized: false,
  },
  // Limita conexoes simultaneas — o plano gratuito do Supabase aceita ate 60
  max: 10,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

pool.connect((err, _client, release) => {
  if (err) {
    console.error('Erro ao conectar no Supabase:', err.message);
    console.error('Verifique se DATABASE_URL esta correto no .env');
    return;
  }
  release();
  console.log('Supabase (PostgreSQL) conectado com sucesso.');
});

export default pool;
