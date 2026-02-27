const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

let anthropicClient = null;
let anthropicApiKey = null;
let geminiApiKey = null;
let openaiApiKey = null;
let openaiBaseUrl = '';

// Inicializar provider conforme configuracao
const provider = config.ai.provider; // 'anthropic', 'gemini' ou 'openai'

if (provider === 'anthropic' && config.ai.anthropicApiKey) {
  anthropicApiKey = config.ai.anthropicApiKey;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropicClient = new Anthropic({ apiKey: config.ai.anthropicApiKey });
    logger.info('IA: Usando Anthropic Claude');
  } catch (err) {
    logger.warn(`IA: SDK Anthropic indisponivel (${err.message}). Usando chamada HTTP direta.`);
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

function uniqueModels(models) {
  return [...new Set((models || []).map((item) => String(item || '').trim()).filter(Boolean))];
}

function getDefaultModel() {
  if (provider === 'openai') return config.ai.openaiModel;
  if (provider === 'anthropic') return config.ai.anthropicModel;
  if (provider === 'gemini') return config.ai.geminiModel;
  return '';
}

function getAvailableModels() {
  if (provider === 'openai') {
    return uniqueModels([...(config.ai.openaiAllowedModels || []), config.ai.openaiModel]);
  }
  if (provider === 'anthropic') {
    return uniqueModels([...(config.ai.anthropicAllowedModels || []), config.ai.anthropicModel]);
  }
  if (provider === 'gemini') {
    return uniqueModels([...(config.ai.geminiAllowedModels || []), config.ai.geminiModel]);
  }
  return [];
}

function resolveModel(requestedModel) {
  const defaultModel = getDefaultModel();
  const availableModels = getAvailableModels();
  const normalized = String(requestedModel || '').trim();

  if (!normalized) {
    return defaultModel;
  }

  if (!availableModels.includes(normalized)) {
    throw new Error(
      `Modelo "${normalized}" nao permitido para ${provider}. Modelos permitidos: ${availableModels.join(', ')}`
    );
  }

  return normalized;
}

// ============================================================
// ANTHROPIC CLAUDE
// ============================================================

async function chatAnthropic(userMessage, systemPromptExtra, conversationHistory, model) {
  const systemPrompt = systemPromptExtra
    ? `${SYSTEM_PROMPT_BASE}\n\n${systemPromptExtra}`
    : SYSTEM_PROMPT_BASE;

  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  if (anthropicClient) {
    const response = await anthropicClient.messages.create({
      model,
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
      model,
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };
  }

  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model,
      max_tokens: config.ai.maxTokens,
      system: systemPrompt,
      messages,
    },
    {
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  const text = response.data?.content
    ?.filter((block) => block.type === 'text')
    ?.map((block) => block.text)
    ?.join('\n') || '';

  const usage = response.data?.usage || {};

  return {
    text,
    model,
    usage: {
      input: usage.input_tokens || 0,
      output: usage.output_tokens || 0,
    },
  };
}

// ============================================================
// OPENAI
// ============================================================

async function chatOpenAI(userMessage, systemPromptExtra, conversationHistory, model) {
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
      model,
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
    model,
    usage: {
      input: usage.prompt_tokens || 0,
      output: usage.completion_tokens || 0,
    },
  };
}

// ============================================================
// GOOGLE GEMINI
// ============================================================

async function chatGemini(userMessage, systemPromptExtra, conversationHistory, model) {
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
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
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
    model,
    usage: {
      input: usage.promptTokenCount || 0,
      output: usage.candidatesTokenCount || 0,
    },
  };
}

// ============================================================
// INTERFACE UNIFICADA
// ============================================================

function mapProviderError(err) {
  const status = err?.response?.status;
  const body = err?.response?.data;
  const detail = body?.error?.message || body?.message || '';

  if (status === 401) {
    return `Falha de autenticacao no provider ${provider} (401). Verifique a API key.`;
  }

  if (status === 403) {
    return `Acesso negado no provider ${provider} (403). Verifique permissao/chave do projeto.`;
  }

  if (status === 404) {
    return `Modelo ou endpoint nao encontrado no provider ${provider} (404).`;
  }

  if (status === 429) {
    return `Limite de requisicoes do provider ${provider} atingido (429).`;
  }

  if (status >= 500) {
    return `Provider ${provider} indisponivel no momento (${status}).`;
  }

  if (err?.code === 'ECONNABORTED') {
    return `Timeout ao chamar provider ${provider}.`;
  }

  if (detail) {
    return `Falha no provider ${provider}: ${detail}`;
  }

  return `Falha no provider ${provider}: ${err?.message || 'erro desconhecido'}`;
}

function getStatus() {
  if (provider === 'anthropic') {
    if (!anthropicApiKey) return 'anthropic:not_configured';
    return anthropicClient ? 'anthropic:configured' : 'anthropic:http_fallback';
  }

  if (provider === 'openai') {
    return openaiApiKey ? 'openai:configured' : 'openai:not_configured';
  }

  if (provider === 'gemini') {
    return geminiApiKey ? 'gemini:configured' : 'gemini:not_configured';
  }

  return `${provider || 'unknown'}:unsupported`;
}

function getModelConfig() {
  return {
    provider,
    defaultModel: getDefaultModel(),
    availableModels: getAvailableModels(),
  };
}

/**
 * Envia mensagem para a IA e retorna a resposta
 */
async function chat(userMessage, systemPromptExtra = '', conversationHistory = [], options = {}) {
  try {
    const model = resolveModel(options?.model);

    if (provider === 'anthropic' && anthropicApiKey) {
      return await chatAnthropic(userMessage, systemPromptExtra, conversationHistory, model);
    } else if (provider === 'openai' && openaiApiKey) {
      return await chatOpenAI(userMessage, systemPromptExtra, conversationHistory, model);
    } else if (provider === 'gemini' && geminiApiKey) {
      return await chatGemini(userMessage, systemPromptExtra, conversationHistory, model);
    }

    throw new Error('Nenhum provider de IA configurado');
  } catch (err) {
    const friendlyMessage = mapProviderError(err);
    logger.error(`Erro na chamada a IA (${provider}): ${friendlyMessage}`);
    throw new Error(friendlyMessage);
  }
}

/**
 * Analise estruturada com JSON (para uso interno)
 */
async function analyzeStructured(userMessage, systemPromptExtra = '', options = {}) {
  const jsonInstruction = '\n\nResponda EXCLUSIVAMENTE em JSON valido, sem markdown, sem backticks, sem texto antes ou depois.';

  const result = await chat(userMessage, (systemPromptExtra || '') + jsonInstruction, [], options);

  try {
    const cleaned = result.text.replace(/```json\s?|```/g, '').trim();
    return { ...result, parsed: JSON.parse(cleaned) };
  } catch {
    logger.warn('Falha ao parsear JSON da IA, retornando texto bruto');
    return { ...result, parsed: null };
  }
}

module.exports = {
  chat,
  analyzeStructured,
  SYSTEM_PROMPT_BASE,
  getStatus,
  getModelConfig,
};
