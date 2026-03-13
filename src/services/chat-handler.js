const ai = require('./ai');
const contractAnalyzer = require('./contract-analyzer');
const contractGenerator = require('./contract-generator');
const deadlineManager = require('./deadline-manager');
const diarioMonitor = require('./diario-monitor');
const { pool } = require('../config/migrate');
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let redis;
try {
  redis = new Redis(config.redis.url);
} catch {
  logger.warn('Redis não disponível, usando memória para contexto');
  redis = null;
}

// Cache de contexto em memória (fallback se Redis indisponível)
const memoryContext = new Map();

/**
 * Obtém/atualiza contexto da conversa
 */
async function getContext(channelId) {
  const key = `chat:context:${channelId}`;
  try {
    if (redis) {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : { state: 'idle', history: [] };
    }
  } catch { /* fallback */ }
  return memoryContext.get(channelId) || { state: 'idle', history: [] };
}

async function setContext(channelId, context) {
  const key = `chat:context:${channelId}`;
  // Manter apenas últimas 10 mensagens no histórico
  if (context.history?.length > 10) {
    context.history = context.history.slice(-10);
  }
  try {
    if (redis) {
      await redis.set(key, JSON.stringify(context), 'EX', 3600); // 1h TTL
      return;
    }
  } catch { /* fallback */ }
  memoryContext.set(channelId, context);
}

/**
 * Handler principal de mensagens
 * Detecta intenção e roteia para o serviço correto
 */
async function handle(text, { channel, remoteId, userName }) {
  const channelId = `${channel}:${remoteId}`;
  const ctx = await getContext(channelId);

  try {
    // Detectar intenção com base no texto e contexto
    const intent = detectIntent(text, ctx);

    let response;

    switch (intent) {
      case 'greeting':
        response = formatGreeting(userName);
        break;

      case 'contract_analyze':
        // Se o texto é curto, pedir o contrato
        if (text.length < 200) {
          ctx.state = 'awaiting_contract';
          await setContext(channelId, ctx);
          return '📄 *Análise de Contrato*\n\nPor favor, envie o texto completo do contrato que deseja analisar.\n\n💡 Cole o texto inteiro para uma análise completa.';
        }
        // Texto longo = é o próprio contrato
        response = await contractAnalyzer.analyzeForChat(text);
        ctx.state = 'idle';
        break;

      case 'awaiting_contract':
        // Estava esperando contrato, texto recebido é o contrato
        response = await contractAnalyzer.analyzeForChat(text);
        ctx.state = 'idle';
        break;

      case 'contract_generate': {
        // Detectar tipo de contrato no próprio texto
        const tipoDetectado = contractGenerator.getContractType(text);
        if (tipoDetectado) {
          ctx.state = 'awaiting_contract_gen_details';
          ctx.contractGenType = tipoDetectado.key;
          ctx.contractGenLabel = tipoDetectado.label;
          await setContext(channelId, ctx);
          return (
            `📝 *Gerar Contrato de ${tipoDetectado.label}*\n\n` +
            `Para gerar o contrato, preciso das seguintes informações:\n\n` +
            `${tipoDetectado.hints}\n\n` +
            `Pode enviar tudo de uma vez ou em partes. Quando terminar, diga *"gerar"*.`
          );
        }
        // Tipo não identificado: pedir escolha
        const lista = Object.entries(contractGenerator.CONTRACT_TYPES)
          .map(([, cfg], i) => `${i + 1}. ${cfg.label}`)
          .join('\n');
        ctx.state = 'awaiting_contract_gen_type';
        await setContext(channelId, ctx);
        return `📝 *Geração de Contrato*\n\nQual tipo de contrato deseja gerar?\n\n${lista}\n\nResponda com o número ou o nome do tipo.`;
      }

      case 'awaiting_contract_gen_type': {
        const tipoEscolhido = contractGenerator.getContractType(text);
        if (!tipoEscolhido) {
          return `Não entendi o tipo. Por favor, escolha um dos tipos listados ou envie o nome do contrato.`;
        }
        ctx.state = 'awaiting_contract_gen_details';
        ctx.contractGenType = tipoEscolhido.key;
        ctx.contractGenLabel = tipoEscolhido.label;
        ctx.contractGenDetails = '';
        await setContext(channelId, ctx);
        return (
          `📝 *${tipoEscolhido.label}*\n\n` +
          `Preciso das seguintes informações:\n\n${tipoEscolhido.hints}\n\n` +
          `Envie os dados e, quando terminar, diga *"gerar"*.`
        );
      }

      case 'awaiting_contract_gen_details': {
        // Acumular detalhes; quando diz "gerar", processar
        const isReady = /^gerar$|^pode gerar|^gera a[ií]|^pronto|^pode fazer|^fazer|^ok gerar/i.test(text.trim());

        if (!isReady) {
          // Acumular e confirmar recebimento
          ctx.contractGenDetails = (ctx.contractGenDetails || '') + '\n' + text;
          await setContext(channelId, ctx);
          return `✅ Informação recebida. Continue enviando os dados ou diga *"gerar"* quando quiser que eu monte o contrato.`;
        }

        const details = (ctx.contractGenDetails || '') + '\n' + text.replace(/^gerar/i, '').trim();
        if (!details.trim() || details.trim().length < 20) {
          return `⚠️ Ainda preciso dos detalhes do contrato (partes, valores, prazo). Por favor, envie as informações primeiro.`;
        }

        // Gerar contrato
        ctx.state = 'idle';
        ctx.contractGenType = null;
        ctx.contractGenLabel = null;
        ctx.contractGenDetails = null;
        await setContext(channelId, ctx);

        try {
          const generated = await contractGenerator.generate({
            type: ctx.contractGenType || 'prestacao_servicos',
            details: details.trim(),
          });
          // Retornar objeto com documento para webhooks.js processar
          return {
            text: `✅ *Contrato gerado com sucesso!*\n\n📄 ${generated.title}\n\nClique no link abaixo para baixar o PDF:\n${generated.downloadUrl}`,
            document: {
              url: generated.downloadUrl,
              fileName: generated.fileName,
              caption: `Contrato: ${generated.title}`,
            },
          };
        } catch (err) {
          logger.error('Erro ao gerar contrato via WhatsApp:', err.message);
          return `⚠️ Ocorreu um erro ao gerar o contrato. Tente novamente ou acesse o painel web.`;
        }
      }

      case 'deadline_calculate':
        response = handleDeadlineQuery(text);
        break;

      case 'deadline_list':
        response = '📅 Para ver seus prazos ativos, acesse o painel web ou use a API.';
        break;

      case 'diario_search':
        response = await handleDiarioQuery(text);
        break;

      case 'help':
        response = formatHelp();
        break;

      default: {
        // Conversa livre — usa modelo avancado para perguntas juridicas longas
        const isComplexQuery = text.length > 300 || /lei|artigo|jurisprud|codigo|processo|tribunal|sentenca|recurso|contrato|clausula|direito/i.test(text);
        const chatOptions = isComplexQuery ? { model: ai.getComplexModel() } : {};
        ctx.history.push({ role: 'user', content: text });
        const aiResult = await ai.chat(text, '', ctx.history, chatOptions);
        ctx.history.push({ role: 'assistant', content: aiResult.text });
        response = aiResult.text;
        break;
      }
    }

    await setContext(channelId, ctx);

    // Limitar tamanho para WhatsApp (4096 chars)
    if (channel === 'whatsapp' && response.length > 4000) {
      response = response.substring(0, 3950) + '\n\n_(mensagem truncada)_';
    }

    return response;
  } catch (err) {
    logger.error('Erro no chat handler:', err.message, { channelId });
    return '⚠️ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em instantes.';
  }
}

/**
 * Detecta a intenção da mensagem
 */
function detectIntent(text, ctx) {
  const lower = text.toLowerCase().trim();

  // Estados de espera têm prioridade
  if (ctx.state === 'awaiting_contract') return 'awaiting_contract';
  if (ctx.state === 'awaiting_contract_gen_type') return 'awaiting_contract_gen_type';
  if (ctx.state === 'awaiting_contract_gen_details') return 'awaiting_contract_gen_details';

  // Saudações
  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|hello|hi)\b/.test(lower)) return 'greeting';

  // Gerar contrato (antes de analisar, para não confundir)
  if (/ger(e|ar|a)\s+contrato|cri(e|ar)\s+contrato|montar\s+contrato|fazer\s+contrato|novo contrato/.test(lower)) return 'contract_generate';

  // Contrato (análise)
  if (/contrato|analis(ar|e)|cláusula|clausula|revisar contrato/.test(lower)) return 'contract_analyze';

  // Prazos
  if (/prazo|deadline|vencimento|dias? (úteis|uteis)|cpc art/.test(lower)) {
    if (/meus prazos|listar|ativos/.test(lower)) return 'deadline_list';
    return 'deadline_calculate';
  }

  // Diário Oficial
  if (/di[aá]rio|dou\b|doe\b|dom\b|oficial|publica[çc][aã]o/.test(lower)) return 'diario_search';

  // Ajuda
  if (/ajuda|help|menu|comandos|como funciona/.test(lower)) return 'help';

  // Se texto é muito longo, provavelmente é um contrato
  if (text.length > 500) return 'contract_analyze';

  return 'general';
}

/**
 * Processa consulta sobre prazos
 */
function handleDeadlineQuery(text) {
  const lower = text.toLowerCase();

  // Tentar extrair tipo de prazo e data
  for (const [tipo, info] of Object.entries(deadlineManager.PRAZOS_CPC)) {
    if (lower.includes(tipo.replace('_', ' ')) || lower.includes(tipo)) {
      // Tentar extrair data
      const dateMatch = text.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/);
      const today = new Date();
      let dataInicial;

      if (dateMatch) {
        const d = dateMatch[1];
        dataInicial = d.includes('/') 
          ? new Date(d.split('/').reverse().join('-'))
          : new Date(d);
      } else {
        dataInicial = today;
      }

      const prazoFinal = deadlineManager.calcularPrazo(dataInicial, info.dias);
      const formatDate = (d) => d.toLocaleDateString('pt-BR');

      return (
        `📅 *Cálculo de Prazo*\n\n` +
        `📌 Tipo: *${tipo.replace(/_/g, ' ').toUpperCase()}*\n` +
        `📖 Base legal: ${info.lei}\n` +
        `📆 Data inicial: ${formatDate(dataInicial)}\n` +
        `⏱️ Prazo: ${info.dias} dias ${info.uteis ? 'úteis' : 'corridos'}\n` +
        `🎯 *Vencimento: ${formatDate(prazoFinal)}*\n\n` +
        `⚠️ Verifique feriados locais e suspensões do tribunal.`
      );
    }
  }

  // Não encontrou tipo específico - listar opções
  const tipos = Object.entries(deadlineManager.PRAZOS_CPC)
    .map(([k, v]) => `• ${k.replace(/_/g, ' ')} - ${v.dias} dias ${v.uteis ? 'úteis' : 'corridos'} (${v.lei})`)
    .join('\n');

  return (
    `📅 *Prazos Processuais (CPC)*\n\n${tipos}\n\n` +
    `💡 Diga o tipo de prazo e a data. Ex:\n"contestação 2025-03-15"`
  );
}

/**
 * Processa consulta sobre diários oficiais
 */
async function handleDiarioQuery(text) {
  const lower = text.toLowerCase();

  // Extrair palavra-chave (remover palavras comuns)
  const keyword = text
    .replace(/di[aá]rio|oficial|dou|doe|dom|buscar|pesquisar|procurar|monitor(ar)?/gi, '')
    .trim();

  if (!keyword || keyword.length < 3) {
    return (
      `📰 *Monitor de Diários Oficiais*\n\n` +
      `Para buscar no DOU, envie:\n"diário [sua palavra-chave]"\n\n` +
      `Exemplos:\n` +
      `• "diário licitação prefeitura"\n` +
      `• "diário nome da empresa"\n` +
      `• "diário edital concurso"`
    );
  }

  const results = await diarioMonitor.searchDOU(keyword);

  if (results.length === 0) {
    return `📰 Nenhum resultado encontrado no DOU para "${keyword}".\n\nTente outras palavras-chave ou verifique a grafia.`;
  }

  const formatted = results.slice(0, 5).map((r, i) =>
    `${i + 1}. *${r.title?.substring(0, 80)}*\n   📅 ${r.date}\n   🔗 ${r.url}`
  ).join('\n\n');

  return `📰 *Resultados no DOU para "${keyword}":*\n\n${formatted}`;
}

function formatGreeting(name) {
  return (
    `⚖️ Olá, ${name}! Sou o *Dr. Lex*, seu assistente jurídico com IA.\n\n` +
    `Como posso ajudar?\n` +
    `• 📝 Gerar contratos em PDF\n` +
    `• 📄 Analisar contratos\n` +
    `• 📅 Calcular prazos\n` +
    `• 📰 Buscar no Diário Oficial\n` +
    `• 💬 Tirar dúvidas jurídicas`
  );
}

function formatHelp() {
  return (
    `⚖️ *Dr. Lex - Menu de Ajuda*\n\n` +
    `📝 *Gerar contrato:* Envie "gerar contrato de prestação de serviços"\n` +
    `📄 *Analisar contrato:* Envie "analisar contrato" e cole o texto\n` +
    `📅 *Prazos:* Envie "prazo contestação 2025-03-15"\n` +
    `📰 *Diários:* Envie "diário [palavra-chave]"\n` +
    `💬 *Dúvidas:* Pergunte qualquer questão jurídica\n\n` +
    `💡 Dica: Quanto mais detalhada sua pergunta, melhor a resposta!`
  );
}

module.exports = { handle };
