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

  // Contratos gerados por IA
  `CREATE TABLE IF NOT EXISTS generated_contracts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    contract_type VARCHAR(100) NOT NULL,
    title VARCHAR(500) NOT NULL,
    details_text TEXT NOT NULL,
    contract_text TEXT NOT NULL,
    pdf_filename VARCHAR(200),
    pdf_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Organizações (multi-tenant)
  `CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan VARCHAR(50) DEFAULT 'solo',
    owner_id INTEGER REFERENCES users(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS org_memberships (
    id SERIAL PRIMARY KEY,
    org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    invited_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (org_id, user_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON org_memberships(org_id)`,
  `CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug)`,

  // Adicionar org_id a todas as tabelas de dados (idempotente)
  `ALTER TABLE contracts            ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,
  `ALTER TABLE deadlines            ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,
  `ALTER TABLE diario_monitors      ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,
  `ALTER TABLE diario_alerts        ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,
  `ALTER TABLE conversations        ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,
  `ALTER TABLE knowledge_sources    ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,
  `ALTER TABLE external_query_logs  ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,
  `ALTER TABLE prospecting_searches ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,
  `ALTER TABLE generated_contracts  ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES organizations(id)`,

  `CREATE INDEX IF NOT EXISTS idx_contracts_org              ON contracts(org_id)`,
  `CREATE INDEX IF NOT EXISTS idx_deadlines_org              ON deadlines(org_id, deadline_date)`,
  `CREATE INDEX IF NOT EXISTS idx_knowledge_sources_org      ON knowledge_sources(org_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_generated_contracts_org    ON generated_contracts(org_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_prospecting_searches_org   ON prospecting_searches(org_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_external_query_logs_org    ON external_query_logs(org_id, created_at DESC)`,

  // Backfill: criar org pessoal para usuários existentes e preencher org_id nas linhas existentes
  `DO $$
  DECLARE
    u RECORD;
    new_org_id INTEGER;
    slug_base TEXT;
    slug_candidate TEXT;
    slug_suffix INTEGER;
  BEGIN
    FOR u IN SELECT id, name, email, plan FROM users LOOP
      IF EXISTS (
        SELECT 1 FROM org_memberships om WHERE om.user_id = u.id AND om.role = 'owner'
      ) THEN
        SELECT om.org_id INTO new_org_id FROM org_memberships om WHERE om.user_id = u.id AND om.role = 'owner' LIMIT 1;
      ELSE
        slug_base := lower(regexp_replace(split_part(u.email, '@', 1), '[^a-z0-9]', '-', 'g'));
        slug_candidate := slug_base;
        slug_suffix := 1;
        WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = slug_candidate) LOOP
          slug_candidate := slug_base || '-' || slug_suffix;
          slug_suffix := slug_suffix + 1;
        END LOOP;
        INSERT INTO organizations (name, slug, plan, owner_id)
        VALUES (u.name, slug_candidate, u.plan, u.id)
        RETURNING id INTO new_org_id;
        INSERT INTO org_memberships (org_id, user_id, role) VALUES (new_org_id, u.id, 'owner');
      END IF;
      UPDATE contracts            SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      UPDATE deadlines            SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      UPDATE diario_monitors      SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      UPDATE diario_alerts        SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      UPDATE conversations        SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      UPDATE knowledge_sources    SET org_id = new_org_id WHERE created_by = u.id AND org_id IS NULL;
      UPDATE external_query_logs  SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      UPDATE prospecting_searches SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
      UPDATE generated_contracts  SET org_id = new_org_id WHERE user_id = u.id AND org_id IS NULL;
    END LOOP;
  END $$`,

  // Índices
  `CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_generated_contracts_user ON generated_contracts(user_id, created_at DESC)`,
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

  // Super admin
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false`,
  `UPDATE users SET is_super_admin = true WHERE email = 'marcelo.olliv@gmail.com' AND is_super_admin = false`,

  // Configuração de features por plano
  `CREATE TABLE IF NOT EXISTS plan_features (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(50) NOT NULL,
    feature_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (plan_name, feature_key)
  )`,

  // Seed inicial de features por plano (idempotente via ON CONFLICT DO NOTHING)
  `INSERT INTO plan_features (plan_name, feature_key, enabled) VALUES
    ('solo',       'contracts_analyze',   true),
    ('solo',       'contracts_generate',  true),
    ('solo',       'deadlines',           true),
    ('solo',       'diario_monitor',      true),
    ('solo',       'knowledge_base',      true),
    ('solo',       'external_processes',  true),
    ('solo',       'prospecting',         false),
    ('solo',       'whatsapp',            false),
    ('solo',       'workflows',           false),
    ('escritorio', 'contracts_analyze',   true),
    ('escritorio', 'contracts_generate',  true),
    ('escritorio', 'deadlines',           true),
    ('escritorio', 'diario_monitor',      true),
    ('escritorio', 'knowledge_base',      true),
    ('escritorio', 'external_processes',  true),
    ('escritorio', 'prospecting',         true),
    ('escritorio', 'whatsapp',            true),
    ('escritorio', 'workflows',           true),
    ('enterprise', 'contracts_analyze',   true),
    ('enterprise', 'contracts_generate',  true),
    ('enterprise', 'deadlines',           true),
    ('enterprise', 'diario_monitor',      true),
    ('enterprise', 'knowledge_base',      true),
    ('enterprise', 'external_processes',  true),
    ('enterprise', 'prospecting',         true),
    ('enterprise', 'whatsapp',            true),
    ('enterprise', 'workflows',           true)
  ON CONFLICT (plan_name, feature_key) DO NOTHING`,
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
