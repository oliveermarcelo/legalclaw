const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

const pool = new Pool({ connectionString: config.database.url });

const migrations = [
  // Usuários
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    plan VARCHAR(50) DEFAULT 'solo',
    whatsapp VARCHAR(20),
    telegram_id VARCHAR(50),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Contratos analisados
  `CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(500),
    original_text TEXT NOT NULL,
    analysis JSONB,
    risk_level VARCHAR(20),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Prazos processuais
  `CREATE TABLE IF NOT EXISTS deadlines (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    process_number VARCHAR(50),
    description TEXT NOT NULL,
    deadline_date DATE NOT NULL,
    deadline_type VARCHAR(50),
    dias_uteis BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'active',
    notified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Monitoramento de diários
  `CREATE TABLE IF NOT EXISTS diario_monitors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    keywords TEXT[] NOT NULL,
    diario_type VARCHAR(10) NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Alertas de diários encontrados
  `CREATE TABLE IF NOT EXISTS diario_alerts (
    id SERIAL PRIMARY KEY,
    monitor_id INTEGER REFERENCES diario_monitors(id),
    user_id INTEGER REFERENCES users(id),
    diario_type VARCHAR(10),
    edition_date DATE,
    matched_keyword VARCHAR(255),
    excerpt TEXT,
    url VARCHAR(500),
    notified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Conversas (histórico WhatsApp/Telegram)
  `CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    channel VARCHAR(20) NOT NULL,
    remote_id VARCHAR(100),
    messages JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Base de conhecimento (RAG)
  `CREATE TABLE IF NOT EXISTS knowledge_sources (
    id SERIAL PRIMARY KEY,
    created_by INTEGER REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    source_type VARCHAR(40) DEFAULT 'manual',
    source_ref VARCHAR(1000),
    content TEXT NOT NULL,
    content_hash VARCHAR(64) UNIQUE NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES knowledge_sources(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    tokens_est INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (source_id, chunk_index)
  )`,

  // Logs de consultas externas juridicas
  `CREATE TABLE IF NOT EXISTS external_query_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    provider VARCHAR(50) NOT NULL,
    operation VARCHAR(80) NOT NULL,
    query_payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL,
    latency_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Prospecção de oportunidades jurídicas
  `CREATE TABLE IF NOT EXISTS prospecting_searches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    tribunal_alias VARCHAR(80) NOT NULL,
    specialty VARCHAR(200) NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    total_found INTEGER DEFAULT 0,
    ai_summary TEXT,
    results JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Índices
  `CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_deadlines_user_date ON deadlines(user_id, deadline_date)`,
  `CREATE INDEX IF NOT EXISTS idx_deadlines_status ON deadlines(status, deadline_date)`,
  `CREATE INDEX IF NOT EXISTS idx_diario_alerts_user ON diario_alerts(user_id, notified)`,
  `CREATE INDEX IF NOT EXISTS idx_conversations_remote ON conversations(channel, remote_id)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_sources_created_by ON knowledge_sources(created_by, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_sources_active ON knowledge_sources(active, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON knowledge_chunks(source_id, chunk_index)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv ON knowledge_chunks USING GIN (to_tsvector('portuguese', content))`,
  `CREATE INDEX IF NOT EXISTS idx_external_query_logs_user_date ON external_query_logs(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_external_query_logs_provider ON external_query_logs(provider, operation, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_prospecting_searches_user ON prospecting_searches(user_id, created_at DESC)`,
];

async function migrate() {
  const client = await pool.connect();
  try {
    logger.info('Iniciando migrações do banco de dados...');
    for (const sql of migrations) {
      await client.query(sql);
    }
    logger.info('Migrações concluídas com sucesso.');
  } catch (err) {
    logger.error('Erro na migração:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Executar direto se chamado via CLI
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { pool, migrate };
