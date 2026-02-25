const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

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

/**
 * Envia mensagem para o Claude e retorna a resposta
 */
async function chat(userMessage, systemPromptExtra = '', conversationHistory = []) {
  try {
    const systemPrompt = systemPromptExtra
      ? `${SYSTEM_PROMPT_BASE}\n\n${systemPromptExtra}`
      : SYSTEM_PROMPT_BASE;

    const messages = [
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
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
  } catch (err) {
    logger.error('Erro na chamada ao Claude:', err.message);
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
    logger.warn('Falha ao parsear JSON do Claude, retornando texto bruto');
    return { ...result, parsed: null };
  }
}

module.exports = { chat, analyzeStructured, SYSTEM_PROMPT_BASE };
