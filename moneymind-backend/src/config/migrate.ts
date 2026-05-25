import pool from './database';

// Este script cria as tabelas no banco caso ainda nao existam.
// Execute com: npm run db:migrate
async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('Iniciando migracao...');

    // Habilita a extensao uuid-ossp para gerar IDs unicos automaticamente
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Tabela de usuarios — cada usuario tem sua propria conta no sistema
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       VARCHAR(100)        NOT NULL,
        email      VARCHAR(150) UNIQUE NOT NULL,
        password   VARCHAR(255)        NOT NULL,
        phone      VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabela de categorias — alimentacao, transporte, moradia etc.
    // Algumas categorias vem pre-cadastradas (seed abaixo)
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
        name       VARCHAR(80)  NOT NULL,
        type       VARCHAR(10)  NOT NULL CHECK (type IN ('income', 'expense')),
        icon       VARCHAR(50),
        color      VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabela principal de transacoes — cada entrada ou saida de dinheiro
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
        category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
        description   VARCHAR(200) NOT NULL,
        amount        NUMERIC(12, 2) NOT NULL,
        type          VARCHAR(10)  NOT NULL CHECK (type IN ('income', 'expense')),
        date          DATE         NOT NULL DEFAULT CURRENT_DATE,
        notes         TEXT,
        source        VARCHAR(20) DEFAULT 'web' CHECK (source IN ('web', 'whatsapp', 'api')),
        created_at    TIMESTAMP DEFAULT NOW(),
        updated_at    TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabela de metas financeiras — ex: reserva de emergencia
    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
        name         VARCHAR(100) NOT NULL,
        target_amount NUMERIC(12, 2) NOT NULL,
        current_amount NUMERIC(12, 2) DEFAULT 0,
        deadline     DATE,
        created_at   TIMESTAMP DEFAULT NOW(),
        updated_at   TIMESTAMP DEFAULT NOW()
      )
    `);

    // Indices para acelerar as consultas mais frequentes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id   ON transactions(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_date       ON transactions(date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_type       ON transactions(type)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_transactions_category   ON transactions(category_id)`);

    console.log('Tabelas criadas com sucesso.');
    console.log('Migracao concluida.');

  } catch (err) {
    console.error('Erro na migracao:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
