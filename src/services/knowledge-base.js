const crypto = require('crypto');
const { pool } = require('../config/migrate');
const logger = require('../utils/logger');

function normalizeContent(content) {
  return String(content || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function splitIntoChunks(text, maxChars = 1200, overlap = 180) {
  const content = normalizeContent(text);
  if (!content) return [];

  const chunks = [];
  let start = 0;

  while (start < content.length) {
    let end = Math.min(start + maxChars, content.length);

    if (end < content.length) {
      const lastBreak = Math.max(
        content.lastIndexOf('\n\n', end),
        content.lastIndexOf('. ', end),
        content.lastIndexOf('; ', end),
        content.lastIndexOf(': ', end)
      );

      if (lastBreak > start + 280) {
        end = lastBreak + 1;
      }
    }

    const chunk = content.slice(start, end).trim();
    if (chunk.length >= 120) {
      chunks.push(chunk);
    }

    if (end >= content.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  if (chunks.length === 0 && content.length >= 40) {
    chunks.push(content);
  }

  return chunks.slice(0, 300);
}

function mapSourceRow(row) {
  return {
    id: row.id,
    createdBy: row.created_by,
    title: row.title,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    metadata: row.metadata || {},
    active: row.active,
    chunkCount: row.chunk_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createSource({
  title,
  content,
  sourceType = 'manual',
  sourceRef = null,
  metadata = {},
  createdBy = null,
}) {
  const safeTitle = String(title || '').trim();
  const normalizedContent = normalizeContent(content);

  if (!safeTitle) {
    throw new Error('Titulo da fonte e obrigatorio');
  }

  if (normalizedContent.length < 120) {
    throw new Error('Conteudo muito curto para indexacao (minimo 120 caracteres)');
  }

  const contentHash = crypto.createHash('sha256').update(normalizedContent).digest('hex');

  const duplicated = await pool.query(
    `SELECT id
     FROM knowledge_sources
     WHERE content_hash = $1
       AND (($2::int IS NULL AND created_by IS NULL) OR created_by = $2)`,
    [contentHash, createdBy || null]
  );

  if (duplicated.rows.length > 0) {
    const existingId = duplicated.rows[0].id;
    const existing = await pool.query(
      `SELECT ks.*,
        (SELECT COUNT(*)::int FROM knowledge_chunks kc WHERE kc.source_id = ks.id) AS chunk_count
       FROM knowledge_sources ks
       WHERE ks.id = $1`,
      [existingId]
    );

    return {
      ...mapSourceRow(existing.rows[0]),
      duplicated: true,
    };
  }

  const chunks = splitIntoChunks(normalizedContent);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sourceResult = await client.query(
      `INSERT INTO knowledge_sources
        (title, source_type, source_ref, content, content_hash, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING *`,
      [
        safeTitle,
        String(sourceType || 'manual').slice(0, 40),
        sourceRef ? String(sourceRef).trim() : null,
        normalizedContent,
        contentHash,
        JSON.stringify(metadata || {}),
        createdBy || null,
      ]
    );

    const source = sourceResult.rows[0];

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      await client.query(
        `INSERT INTO knowledge_chunks (source_id, chunk_index, content, tokens_est)
         VALUES ($1, $2, $3, $4)`,
        [source.id, i, chunk, estimateTokens(chunk)]
      );
    }

    await client.query('COMMIT');

    logger.info('Fonte de conhecimento criada', {
      sourceId: source.id,
      chunkCount: chunks.length,
      sourceType,
    });

    return {
      ...mapSourceRow(source),
      chunkCount: chunks.length,
      duplicated: false,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Erro ao criar fonte de conhecimento:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function listSources(limit = 50, createdBy = null) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const hasOwnerFilter = Number.isInteger(createdBy);
  const params = [safeLimit];
  let whereClause = '';

  if (hasOwnerFilter) {
    whereClause = 'WHERE ks.created_by = $2';
    params.push(createdBy);
  }

  const result = await pool.query(
    `SELECT ks.*,
      (SELECT COUNT(*)::int FROM knowledge_chunks kc WHERE kc.source_id = ks.id) AS chunk_count
     FROM knowledge_sources ks
     ${whereClause}
     ORDER BY ks.created_at DESC
     LIMIT $1`,
    params
  );

  return result.rows.map(mapSourceRow);
}

async function setSourceActive(sourceId, active, createdBy = null) {
  const hasOwnerFilter = Number.isInteger(createdBy);
  const whereOwner = hasOwnerFilter ? 'AND created_by = $3' : '';
  const params = hasOwnerFilter
    ? [sourceId, active, createdBy]
    : [sourceId, active];

  const result = await pool.query(
    `UPDATE knowledge_sources
     SET active = $2, updated_at = NOW()
     WHERE id = $1 ${whereOwner}
     RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return null;
  }

  const mapped = mapSourceRow(result.rows[0]);
  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS chunk_count FROM knowledge_chunks WHERE source_id = $1',
    [sourceId]
  );
  mapped.chunkCount = countResult.rows[0]?.chunk_count || 0;
  return mapped;
}

async function search(query, limit = 5, createdBy = null) {
  const q = String(query || '').trim();
  if (q.length < 3) return [];

  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);

  const result = await pool.query(
    `SELECT
       kc.id AS chunk_id,
       kc.source_id,
       kc.chunk_index,
       kc.content,
       ks.title,
       ks.source_type,
       ks.source_ref,
       ts_rank_cd(to_tsvector('portuguese', kc.content), plainto_tsquery('portuguese', $1)) AS rank
     FROM knowledge_chunks kc
     JOIN knowledge_sources ks ON ks.id = kc.source_id
     WHERE ks.active = true
       AND ($3::int IS NULL OR ks.created_by = $3)
       AND (
         to_tsvector('portuguese', kc.content) @@ plainto_tsquery('portuguese', $1)
         OR kc.content ILIKE ('%' || $1 || '%')
       )
     ORDER BY rank DESC NULLS LAST, kc.id DESC
     LIMIT $2`,
    [q, safeLimit * 3, createdBy || null]
  );

  const seenSources = new Set();
  const deduped = [];

  for (const row of result.rows) {
    if (seenSources.has(row.source_id)) continue;
    seenSources.add(row.source_id);

    deduped.push({
      sourceId: row.source_id,
      title: row.title,
      sourceType: row.source_type,
      sourceRef: row.source_ref,
      chunkIndex: row.chunk_index,
      score: Number(row.rank || 0),
      content: row.content,
      excerpt: String(row.content || '').slice(0, 420).trim(),
    });

    if (deduped.length >= safeLimit) break;
  }

  return deduped;
}

function buildContext(hits) {
  const sources = (hits || []).map((hit, index) => ({
    id: index + 1,
    title: hit.title,
    sourceRef: hit.sourceRef,
    sourceType: hit.sourceType,
    excerpt: hit.excerpt,
  }));

  const context = sources
    .map(
      (source) =>
        `[Fonte ${source.id}] ${source.title}${source.sourceRef ? ` (${source.sourceRef})` : ''}\n${source.excerpt}`
    )
    .join('\n\n');

  return { context, sources };
}

module.exports = {
  createSource,
  listSources,
  setSourceActive,
  search,
  buildContext,
  splitIntoChunks,
};
