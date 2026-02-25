const config = require('../config');
const logger = require('../utils/logger');

let anthropicClient = null;
let geminiApiKey = null;

// Inicializar provider conforme configuração
const provider = config.ai.provider; // 'gemini' ou 'anthropic'

if (provider === 'anthropic' && config.ai.anthropicApiKey) {
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: config.ai.anthropicApiKey });
    logger.info('IA: Usando Anthropic Claude');
  } catch {
    logger.error('IA: @anthropic-ai/sdk não instalado. Rode: npm install @anthropic-ai/sdk');
  }
} else if (provider === 'gemini' && config.ai.geminiApiKey) {
  geminiApiKey = config.ai.geminiApiKey;
  logger.info('IA: Usando Google Gemini Flash');
} else {
  logger.warn('IA: Nenhum provider configurado! Configure AI_PROVIDER + chave.');
}

// System prompt base para contexto jurídico brasileiro
const SYSTEM_PROMPT_BASE = `Você é o Dr. Lex, um assistente jurídico com IA especializado no direito brasileiro.
Seu nome vem de "Dr." (autoridade) + "Lex" (lei, do latim). Você é profissional, preciso e confiável.

Suas competências:
- Análise detalhada de contratos (cláusulas abusivas, riscos, sugestões)
- Gestão de prazos processuais (CPC, dias úteis, feriados nacionais e estaduais)
- Monitoramento de diários oficiais (DOU, DOE, DOM)
- Orientação sobre procedimentos jurídicos brasileiros

Regras:
- Sempre cite artigos de lei relevantes (CPC, CC, CDC, CLT, etc.)
- Identifique riscos em ordem de gravidade: CRÍTICO, ALTO, MÉDIO, BAIXO
- Use linguagem profissional mas acessível
- Nunca invente jurisprudência ou artigos de lei
- Quando não souber, diga claramente
- Respostas em português brasileiro`;

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
// GOOGLE GEMINI
// ============================================================

async function chatGemini(userMessage, systemPromptExtra, conversationHistory) {
  const axios = require('axios');

  const systemPrompt = systemPromptExtra
    ? `${SYSTEM_PROMPT_BASE}\n\n${systemPromptExtra}`
    : SYSTEM_PROMPT_BASE;

  // Converter histórico para formato Gemini
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
 * Envia mensagem para a IA (Claude ou Gemini) e retorna a resposta
 */
async function chat(userMessage, systemPromptExtra = '', conversationHistory = []) {
  try {
    if (provider === 'anthropic' && anthropicClient) {
      return await chatAnthropic(userMessage, systemPromptExtra, conversationHistory);
    } else if (provider === 'gemini' && geminiApiKey) {
      return await chatGemini(userMessage, systemPromptExtra, conversationHistory);
    } else {
      throw new Error('Nenhum provider de IA configurado');
    }
  } catch (err) {
    logger.error(`Erro na chamada à IA (${provider}):`, err.message);
    throw err;
  }
}

/**
 * Análise estruturada com JSON (para uso interno)
 */
async function analyzeStructured(userMessage, systemPromptExtra = '') {
  const jsonInstruction = `\n\nResponda EXCLUSIVAMENTE em JSON válido, sem markdown, sem backticks, sem texto antes ou depois.`;

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
