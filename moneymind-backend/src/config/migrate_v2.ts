import pool from './database';

//  adicionando tabela de reset de senha e coluna is_admin
async function migrateV2(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('Iniciando migracao v2...');

    // Coluna is_admin na tabela users
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false
    `);

    // Tabela de tokens para reset de senha
    // ON CONFLICT (user_id) garante um unico token ativo por usuario
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        user_id    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP  NOT NULL,
        created_at TIMESTAMP  DEFAULT NOW()
      )
    `);

    console.log('Migracao v2 concluida com sucesso.');
    console.log('Tabela password_reset_tokens criada.');
    console.log('Coluna is_admin adicionada em users.');
  } catch (err) {
    console.error('Erro na migracao v2:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateV2();
