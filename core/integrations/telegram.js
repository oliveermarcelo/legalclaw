/**
 * INTEGRAÇÃO: Telegram Bot
 * 
 * Bot do Telegram para interação com LegalClaw
 */

const { Telegraf, Markup } = require('telegraf');

class TelegramIntegration {
  constructor(config = {}) {
    this.token = config.token || process.env.TELEGRAM_BOT_TOKEN;
    this.allowedUsers = config.allowedUsers || 
      (process.env.TELEGRAM_ALLOWED_USERS || '').split(',').filter(Boolean);
    
    this.bot = new Telegraf(this.token);
    this.sessions = new Map();
    
    this.setupHandlers();
  }

  setupHandlers() {
    // Comando /start
    this.bot.start((ctx) => {
      if (!this.isAuthorized(ctx.from.id)) {
        return ctx.reply('❌ Usuário não autorizado. Entre em contato com o suporte.');
      }

      ctx.reply(
        `🏛️ *LegalClaw - Assistente Jurídico com IA*\n\n` +
        `Olá ${ctx.from.first_name}! Bem-vindo ao seu assistente jurídico.\n\n` +
        `Posso ajudar com:\n` +
        `📄 Análise de contratos\n` +
        `📰 Monitoramento de diários oficiais\n` +
        `⏰ Gestão de prazos processuais\n` +
        `🔍 Pesquisa de jurisprudência\n` +
        `📝 Geração de documentos\n\n` +
        `Use /menu para ver todas as opções.`,
        { parse_mode: 'Markdown' }
      );
    });

    // Comando /menu
    this.bot.command('menu', (ctx) => {
      const keyboard = Markup.keyboard([
        ['📄 Análise de Contratos', '📰 Diários Oficiais'],
        ['⏰ Meus Prazos', '🔍 Pesquisar'],
        ['📝 Gerar Documento', '⚙️ Configurações']
      ]).resize();

      ctx.reply('📋 *Menu Principal*\n\nEscolha uma opção:', {
        parse_mode: 'Markdown',
        ...keyboard
      });
    });

    // Comando /prazos
    this.bot.command('prazos', async (ctx) => {
      const prazos = await this.getDeadlines(ctx.from.id);
      ctx.reply(prazos, { parse_mode: 'Markdown' });
    });

    // Comando /ajuda
    this.bot.command('ajuda', (ctx) => {
      ctx.reply(this.getHelpMessage(), { parse_mode: 'Markdown' });
    });

    // Comando /status
    this.bot.command('status', (ctx) => {
      ctx.reply(this.getStatusMessage(ctx.from.id), { parse_mode: 'Markdown' });
    });

    // Handler para documentos (PDFs)
    this.bot.on('document', async (ctx) => {
      if (!this.isAuthorized(ctx.from.id)) {
        return ctx.reply('❌ Usuário não autorizado.');
      }

      const doc = ctx.message.document;
      
      if (doc.mime_type === 'application/pdf') {
        await ctx.reply('📄 Recebendo contrato... Analisando...');
        await this.handleContractUpload(ctx, doc);
      } else {
        ctx.reply('⚠️ Por favor, envie apenas arquivos PDF.');
      }
    });

    // Handler para mensagens de texto
    this.bot.on('text', async (ctx) => {
      if (!this.isAuthorized(ctx.from.id)) {
        return ctx.reply('❌ Usuário não autorizado.');
      }

      const text = ctx.message.text;

      // Processar botões do teclado
      if (text === '📄 Análise de Contratos') {
        return ctx.reply(
          '📄 *Análise de Contratos*\n\n' +
          'Envie o contrato em PDF para análise automática.\n\n' +
          'A análise incluirá:\n' +
          '• Identificação das partes\n' +
          '• Cláusulas críticas\n' +
          '• Análise de riscos\n' +
          '• Sugestões de melhorias',
          { parse_mode: 'Markdown' }
        );
      }

      if (text === '📰 Diários Oficiais') {
        return this.showDiarioMenu(ctx);
      }

      if (text === '⏰ Meus Prazos') {
        const prazos = await this.getDeadlines(ctx.from.id);
        return ctx.reply(prazos, { parse_mode: 'Markdown' });
      }

      if (text === '🔍 Pesquisar') {
        return ctx.reply(
          '🔍 *Pesquisa de Jurisprudência*\n\n' +
          'Digite sua consulta, exemplo:\n' +
          '`dano moral compra e venda`\n\n' +
          'Buscarei nos tribunais:\n' +
          '• STF (Supremo Tribunal Federal)\n' +
          '• STJ (Superior Tribunal de Justiça)\n' +
          '• TJs (Tribunais de Justiça)',
          { parse_mode: 'Markdown' }
        );
      }

      if (text === '📝 Gerar Documento') {
        return this.showDocumentGeneratorMenu(ctx);
      }

      if (text === '⚙️ Configurações') {
        return this.showSettingsMenu(ctx);
      }

      // Se tiver sessão ativa (contexto de conversa)
      const session = this.sessions.get(ctx.from.id);
      if (session && session.handler) {
        return session.handler(ctx, text);
      }

      // Processar com IA
      await this.processWithAI(ctx, text);
    });

    // Handler de erros
    this.bot.catch((err, ctx) => {
      console.error(`❌ Erro no bot: ${err}`);
      ctx.reply('❌ Ocorreu um erro. Por favor, tente novamente.');
    });
  }

  isAuthorized(userId) {
    if (this.allowedUsers.length === 0) return true;
    return this.allowedUsers.includes(userId.toString());
  }

  async handleContractUpload(ctx, document) {
    try {
      // Download do arquivo
      const fileLink = await ctx.telegram.getFileLink(document.file_id);
      
      // Aqui integraria com ContractAnalyzer
      // const analysis = await contractAnalyzer.analyzeFromURL(fileLink.href);

      // Simulação de análise
      await new Promise(resolve => setTimeout(resolve, 3000));

      ctx.reply(
        `✅ *Análise Concluída*\n\n` +
        `📄 Arquivo: ${document.file_name}\n` +
        `📊 Tamanho: ${(document.file_size / 1024).toFixed(2)} KB\n\n` +
        `*RESUMO EXECUTIVO*\n` +
        `Tipo: Contrato de Prestação de Serviços\n` +
        `Partes: Empresa ABC x Cliente XYZ\n` +
        `Valor: R$ 50.000,00\n` +
        `Prazo: 12 meses\n\n` +
        `*CLÁUSULAS CRÍTICAS*\n` +
        `⚠️ Cláusula 5.2 - Multa rescisória (30%)\n` +
        `⚠️ Cláusula 8.1 - Foro: São Paulo/SP\n\n` +
        `*RISCOS IDENTIFICADOS*\n` +
        `🔴 Alto: Cláusula de não-concorrência muito ampla\n` +
        `🟡 Médio: Prazo de rescisão não especificado\n\n` +
        `Digite /relatorio para ver análise completa em PDF.`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      console.error('Erro ao processar contrato:', error);
      ctx.reply('❌ Erro ao processar o contrato. Tente novamente.');
    }
  }

  async showDiarioMenu(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📰 Verificar Hoje', 'check_diarios')],
      [Markup.button.callback('⚙️ Configurar Alertas', 'config_alertas')],
      [Markup.button.callback('📋 Histórico', 'historico_diarios')]
    ]);

    ctx.reply(
      '📰 *Diários Oficiais*\n\n' +
      'Monitoramento automático de:\n' +
      '• DOU (Diário Oficial da União)\n' +
      '• DOE-SP (Diário Oficial do Estado)\n' +
      '• DOM-SP (Diário Oficial do Município)\n\n' +
      'Escolha uma opção:',
      { parse_mode: 'Markdown', ...keyboard }
    );
  }

  async showDocumentGeneratorMenu(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📄 Petição Inicial', 'doc_peticao')],
      [Markup.button.callback('📝 Contestação', 'doc_contestacao')],
      [Markup.button.callback('📋 Procuração', 'doc_procuracao')],
      [Markup.button.callback('📃 Contrato', 'doc_contrato')]
    ]);

    ctx.reply(
      '📝 *Gerador de Documentos*\n\n' +
      'Selecione o tipo de documento:',
      { parse_mode: 'Markdown', ...keyboard }
    );
  }

  async showSettingsMenu(ctx) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔔 Notificações', 'settings_notif')],
      [Markup.button.callback('👤 Perfil', 'settings_profile')],
      [Markup.button.callback('🔐 Segurança', 'settings_security')]
    ]);

    ctx.reply(
      '⚙️ *Configurações*\n\n' +
      'Personalize sua experiência:',
      { parse_mode: 'Markdown', ...keyboard }
    );
  }

  async getDeadlines(userId) {
    // Integrar com DeadlineManager
    return `📅 *SEUS PRAZOS*\n\n` +
      `🔴 *URGENTE* (1-3 dias)\n` +
      `• Recurso de Apelação\n` +
      `  Processo: 1234567-89.2024.8.26.0100\n` +
      `  Prazo: 10/02/2026 (2 dias úteis)\n\n` +
      `🟡 *IMPORTANTE* (4-7 dias)\n` +
      `• Contestação\n` +
      `  Processo: 9876543-21.2024.8.26.0200\n` +
      `  Prazo: 15/02/2026 (5 dias úteis)\n\n` +
      `🔵 *NORMAL* (8+ dias)\n` +
      `• Parecer Técnico\n` +
      `  Processo: 5555555-55.2024.8.26.0300\n` +
      `  Prazo: 25/02/2026 (12 dias úteis)`;
  }

  getHelpMessage() {
    return `📚 *COMANDOS DISPONÍVEIS*\n\n` +
      `*Comandos Básicos*\n` +
      `/start - Iniciar o bot\n` +
      `/menu - Ver menu principal\n` +
      `/ajuda - Esta mensagem\n` +
      `/status - Ver status da conta\n\n` +
      `*Gestão*\n` +
      `/prazos - Listar prazos próximos\n` +
      `/contratos - Listar contratos\n` +
      `/alertas - Configurar alertas\n\n` +
      `*Interação*\n` +
      `• Envie PDF para análise de contrato\n` +
      `• Digite sua dúvida para conversar com IA\n` +
      `• Use o menu para navegação rápida`;
  }

  getStatusMessage(userId) {
    const session = this.sessions.get(userId) || {};
    
    return `📊 *SEU STATUS*\n\n` +
      `✅ Conta ativa\n` +
      `🆔 ID: ${userId}\n` +
      `📅 Último acesso: ${session.lastAccess || 'Agora'}\n\n` +
      `*Estatísticas*\n` +
      `• Contratos analisados: ${session.contractsAnalyzed || 0}\n` +
      `• Prazos ativos: ${session.activeDeadlines || 0}\n` +
      `• Alertas configurados: ${session.alerts || 0}`;
  }

  async processWithAI(ctx, text) {
    await ctx.reply('🤔 Processando sua mensagem...');
    
    // Aqui integraria com OpenClaw
    // const response = await openclaw.process(text);
    
    // Simulação
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    ctx.reply(
      `Recebi sua mensagem: "${text}"\n\n` +
      `Esta é uma resposta simulada. A integração completa com OpenClaw ` +
      `processará sua consulta usando IA.\n\n` +
      `Use /menu para ver as opções disponíveis.`
    );
  }

  // Criar sessão de conversa
  createSession(userId, handler) {
    this.sessions.set(userId, {
      handler,
      createdAt: new Date(),
      lastAccess: new Date()
    });
  }

  // Remover sessão
  clearSession(userId) {
    this.sessions.delete(userId);
  }

  // Enviar mensagem para usuário específico
  async sendMessage(userId, message, options = {}) {
    try {
      await this.bot.telegram.sendMessage(userId, message, {
        parse_mode: 'Markdown',
        ...options
      });
      return { success: true };
    } catch (error) {
      console.error(`Erro ao enviar mensagem para ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Broadcast para múltiplos usuários
  async broadcast(userIds, message, options = {}) {
    const results = [];
    
    for (const userId of userIds) {
      const result = await this.sendMessage(userId, message, options);
      results.push({ userId, ...result });
    }
    
    return results;
  }

  // Iniciar bot
  launch(options = {}) {
    this.bot.launch(options);
    console.log('🤖 Bot do Telegram iniciado com sucesso!');
    
    // Graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }
}

module.exports = TelegramIntegration;
