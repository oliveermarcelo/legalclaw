const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

let anthropicClient = null;
let geminiApiKey = null;
let openaiApiKey = null;
let openaiBaseUrl = '';

// Inicializar provider conforme configuracao
const provider = config.ai.provider; // 'anthropic', 'gemini' ou 'openai'

if (provider === 'anthropic' && config.ai.anthropicApiKey) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: config.ai.anthropicApiKey });
    logger.info('IA: Usando Anthropic Claude');
  } catch {
    logger.error('IA: @anthropic-ai/sdk nao instalado. Rode: npm install @anthropic-ai/sdk');
  }
} else if (provider === 'openai' && config.ai.openaiApiKey) {
  openaiApiKey = config.ai.openaiApiKey;
  openaiBaseUrl = String(config.ai.openaiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  logger.info(`IA: Usando OpenAI (${config.ai.openaiModel})`);
} else if (provider === 'gemini' && config.ai.geminiApiKey) {
  geminiApiKey = config.ai.geminiApiKey;
  logger.info('IA: Usando Google Gemini Flash');
} else {
  logger.warn('IA: Nenhum provider configurado! Configure AI_PROVIDER + chave.');
}

// System prompt base para contexto juridico brasileiro
const SYSTEM_PROMPT_BASE = `Voce e o Dr. Lex, um assistente juridico com IA especializado no direito brasileiro.
Seu nome vem de "Dr." (autoridade) + "Lex" (lei, do latim). Voce e profissional, preciso e confiavel.

Suas competencias:
- Analise detalhada de contratos (clausulas abusivas, riscos, sugestoes)
- Gestao de prazos processuais (CPC, dias uteis, feriados nacionais e estaduais)
- Monitoramento de diarios oficiais (DOU, DOE, DOM)
- Orientacao sobre procedimentos juridicos brasileiros

Regras:
- Sempre cite artigos de lei relevantes (CPC, CC, CDC, CLT, etc.)
- Identifique riscos em ordem de gravidade: CRITICO, ALTO, MEDIO, BAIXO
- Use linguagem profissional mas acessivel
- Nunca invente jurisprudencia ou artigos de lei
- Quando nao souber, diga claramente
- Respostas em portugues brasileiro`;

// ============================================================
// ANTHROPIC CLAUDE
// ============================================================

async function chatAnthropic(userMessage, systemPromptExtra, conversationHistory) {
  const systemPrompt = systemPromptExtra
    ? `${SYSTEM_PROMPT_BASE}\n\n${systemPromptExtra}`
    : SYSTEM_PROMPT_BASE;

  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const response = await anthropicClient.messages.create({
    model: config.ai.anthropicModel,
    max_tokens: config.ai.maxTokens,
    system: systemPrompt,
    messages,
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    text,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  };
}

// ============================================================
// OPENAI
// ============================================================

async function chatOpenAI(userMessage, systemPromptExtra, conversationHistory) {
  const systemPrompt = systemPromptExtra
    ? `${SYSTEM_PROMPT_BASE}\n\n${systemPromptExtra}`
    : SYSTEM_PROMPT_BASE;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: String(msg.content || ''),
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await axios.post(
    `${openaiBaseUrl}/chat/completions`,
    {
      model: config.ai.openaiModel,
      messages,
      temperature: 0.7,
      max_tokens: config.ai.maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  const text = response.data?.choices?.[0]?.message?.content || '';
  const usage = response.data?.usage || {};

  return {
    text,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    },
  };
}

// ============================================================
// GOOGLE GEMINI
// ============================================================

async function chatGemini(userMessage, systemPromptExtra, conversationHistory) {
  const systemPrompt = systemPromptExtra
    ? `${SYSTEM_PROMPT_BASE}\n\n${systemPromptExtra}`
    : SYSTEM_PROMPT_BASE;

  // Converter historico para formato Gemini
  const contents = [];

  for (const msg of conversationHistory) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  contents.push({
    role: 'user',
    parts: [{ text: userMessage }],
  });

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.geminiModel}:generateContent?key=${geminiApiKey}`,
    {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents,
      generationConfig: {
        maxOutputTokens: config.ai.maxTokens,
        temperature: 0.7,
      },
    },
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    }
  );

  const text = response.data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    ?.join('\n') || '';

  const usage = response.data.usageMetadata || {};

  return {
    text,
    usage: {
      input: usage.promptTokenCount || 0,
      output: usage.candidatesTokenCount || 0,
    },
  };
}

// ============================================================
// INTERFACE UNIFICADA
// ============================================================

/**
 * Envia mensagem para a IA e retorna a resposta
 */
async function chat(userMessage, systemPromptExtra = '', conversationHistory = []) {
  try {
    if (provider === 'anthropic' && anthropicClient) {
      return await chatAnthropic(userMessage, systemPromptExtra, conversationHistory);
    } else if (provider === 'openai' && openaiApiKey) {
      return await chatOpenAI(userMessage, systemPromptExtra, conversationHistory);
    } else if (provider === 'gemini' && geminiApiKey) {
      return await chatGemini(userMessage, systemPromptExtra, conversationHistory);
    }

    throw new Error('Nenhum provider de IA configurado');
  } catch (err) {
    logger.error(`Erro na chamada a IA (${provider}):`, err.message);
    throw err;
  }
}

/**
 * Analise estruturada com JSON (para uso interno)
 */
async function analyzeStructured(userMessage, systemPromptExtra = '') {
  const jsonInstruction = '\n\nResponda EXCLUSIVAMENTE em JSON valido, sem markdown, sem backticks, sem texto antes ou depois.';

  const result = await chat(userMessage, (systemPromptExtra || '') + jsonInstruction);

  try {
    const cleaned = result.text.replace(/```json\s?|```/g, '').trim();
    return { ...result, parsed: JSON.parse(cleaned) };
  } catch {
    logger.warn('Falha ao parsear JSON da IA, retornando texto bruto');
    return { ...result, parsed: null };
  }
}

module.exports = { chat, analyzeStructured, SYSTEM_PROMPT_BASE };
