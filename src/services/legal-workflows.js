const ai = require('./ai');
const knowledgeBase = require('./knowledge-base');

const MODE_DEFINITIONS = {
  manifestacao_processual: {
    label: 'Manifestacao Processual',
    description: 'Estrutura manifestacoes com pedidos, fundamentos e checklist final.',
    requiresDocument: false,
    useRag: true,
    instruction: `Voce e um redator juridico processual brasileiro.
Produza uma minuta tecnica com:
1) Sintese objetiva dos fatos
2) Preliminares processuais cabiveis
3) Fundamentos juridicos com artigos de lei
4) Pedidos finais claros e numerados
5) Checklist de protocolo e documentos`,
  },
  criacao_peca: {
    label: 'Criacao de Peca',
    description: 'Gera peca inicial/intermediaria com estrutura pronta para edicao.',
    requiresDocument: false,
    useRag: true,
    instruction: `Voce e um especialista em redacao de pecas juridicas.
Gere texto em formato de minuta com:
- Enderecamento e qualificacao (com campos sinalizados quando faltar dado)
- Dos fatos
- Do direito (fundamentacao objetiva)
- Dos pedidos
- Fecho e orientacao de personalizacao`,
  },
  pesquisa_juridica: {
    label: 'Pesquisa Juridica',
    description: 'Organiza pesquisa em tese, base legal, riscos e lacunas.',
    requiresDocument: false,
    useRag: true,
    instruction: `Voce e um pesquisador juridico brasileiro.
Estruture a resposta em:
1) Questao juridica central
2) Normas e artigos aplicaveis
3) Entendimentos relevantes
4) Riscos de interpretacao
5) Proximos passos de pesquisa
Se nao houver base suficiente, declare limitacao explicitamente.`,
  },
  parecer_juridico: {
    label: 'Parecer Juridico',
    description: 'Entrega parecer com conclusao executiva e matriz de riscos.',
    requiresDocument: false,
    useRag: true,
    instruction: `Voce e um parecerista juridico.
Entregue:
1) Ementa curta
2) Relatorio dos fatos
3) Fundamentacao juridica
4) Conclusao objetiva (sim/nao/depende, com condicoes)
5) Matriz de risco (CRITICO, ALTO, MEDIO, BAIXO)`,
  },
  analise_caso: {
    label: 'Analise de Caso',
    description: 'Mapeia teses, estrategia, provas e risco de litigio.',
    requiresDocument: false,
    useRag: true,
    instruction: `Voce e um estrategista juridico de contencioso.
Entregue:
1) Diagnostico do caso
2) Teses favoraveis e contrarias
3) Provas necessarias por prioridade
4) Estrategia recomendada (curto/medio prazo)
5) Risco de litigio e impacto`,
  },
  fundamentacao: {
    label: 'Fundamentacao',
    description: 'Monta fundamentacao juridica por tese com citacoes.',
    requiresDocument: false,
    useRag: true,
    instruction: `Voce e um assistente de fundamentacao juridica.
Responda com:
1) Tese principal
2) Fundamentos normativos (artigos e principios)
3) Argumentacao aplicada ao caso
4) Contrapontos provaveis
5) Fechamento argumentativo`,
  },
  revisao_texto: {
    label: 'Revisao de Texto',
    description: 'Revisa clareza, tecnica juridica, coerencia e linguagem.',
    requiresDocument: true,
    useRag: false,
    instruction: `Voce e um revisor juridico.
Analise e devolva:
1) Problemas criticos de forma e conteudo
2) Sugestoes de melhoria por prioridade
3) Versao revisada do texto
Nao altere o sentido juridico sem sinalizar.`,
  },
};

function sanitizeText(value, maxLength = 24000) {
  return String(value || '').replace(/\u0000/g, ' ').trim().slice(0, maxLength);
}

function normalizeMode(mode) {
  return String(mode || '').trim().toLowerCase();
}

function getModeConfig(mode) {
  return MODE_DEFINITIONS[normalizeMode(mode)] || null;
}

function listModes() {
  return Object.entries(MODE_DEFINITIONS).map(([id, item]) => ({
    id,
    label: item.label,
    description: item.description,
    requiresDocument: item.requiresDocument,
  }));
}

function buildUserPrompt({
  objective,
  context,
  documentText,
  audience,
  desiredOutput,
}) {
  const blocks = [
    `Objetivo: ${objective || 'Nao informado'}`,
    `Contexto adicional: ${context || 'Nao informado'}`,
    `Publico alvo: ${audience || 'Advogado(a) responsavel'}`,
    `Formato esperado: ${desiredOutput || 'Minuta objetiva com secoes claras'}`,
  ];

  if (documentText) {
    blocks.push(`Documento base:\n${documentText}`);
  }

  return blocks.join('\n\n');
}

async function loadRagContext(query, userId, useRag) {
  if (!useRag || !userId) {
    return { systemPromptExtra: '', sources: [] };
  }

  const hits = await knowledgeBase.search(query, 6, userId);
  if (hits.length === 0) {
    return { systemPromptExtra: '', sources: [] };
  }

  const built = knowledgeBase.buildContext(hits);
  return {
    systemPromptExtra: `
Use as fontes abaixo como base prioritaria quando forem relevantes.
Se usar, cite no texto como [Fonte 1], [Fonte 2], etc.
Se a base nao cobrir algum ponto, diga explicitamente.

${built.context}
    `.trim(),
    sources: built.sources,
  };
}

async function runWorkflow({
  mode,
  objective,
  context = '',
  documentText = '',
  audience = '',
  desiredOutput = '',
  userId = null,
  model = '',
}) {
  const modeId = normalizeMode(mode);
  const modeConfig = getModeConfig(modeId);
  if (!modeConfig) {
    throw new Error('Modo de workflow invalido');
  }

  const safeObjective = sanitizeText(objective, 4000);
  const safeContext = sanitizeText(context, 8000);
  const safeDocumentText = sanitizeText(documentText, 24000);
  const safeAudience = sanitizeText(audience, 200);
  const safeDesiredOutput = sanitizeText(desiredOutput, 300);

  if (!safeObjective && !safeDocumentText) {
    throw new Error('Informe objetivo ou documento base');
  }

  if (modeConfig.requiresDocument && safeDocumentText.length < 80) {
    throw new Error('Este modo exige um texto/documento base com no minimo 80 caracteres');
  }

  const ragQuery = `${safeObjective}\n${safeContext}`.trim().slice(0, 2000);
  const rag = await loadRagContext(ragQuery, userId, modeConfig.useRag);

  const composedSystemPrompt = `
${modeConfig.instruction}

Regras:
- Responda em portugues brasileiro.
- Nao invente lei, artigo, jurisprudencia ou fato inexistente.
- Sinalize premissas quando faltar informacao.
  `.trim();

  const userPrompt = buildUserPrompt({
    objective: safeObjective,
    context: safeContext,
    documentText: safeDocumentText,
    audience: safeAudience,
    desiredOutput: safeDesiredOutput,
  });

  // Workflows sao tarefas complexas: usar modelo avancado salvo se o caller especificou outro
  const resolvedModel = sanitizeText(model, 120) || ai.getComplexModel();

  const result = await ai.chat(
    userPrompt,
    [composedSystemPrompt, rag.systemPromptExtra].filter(Boolean).join('\n\n'),
    [],
    { model: resolvedModel }
  );

  return {
    mode: modeId,
    text: result.text,
    model: result.model,
    usage: result.usage,
    sources: rag.sources,
  };
}

module.exports = {
  listModes,
  runWorkflow,
};

