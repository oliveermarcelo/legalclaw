/**
 * INTEGRAÇÃO: WhatsApp via Twilio
 * 
 * Gerencia comunicação bidirecional com clientes via WhatsApp
 */

const twilio = require('twilio');
const express = require('express');

class WhatsAppIntegration {
  constructor(config = {}) {
    this.accountSid = config.accountSid || process.env.TWILIO_ACCOUNT_SID;
    this.authToken = config.authToken || process.env.TWILIO_AUTH_TOKEN;
    this.whatsappNumber = config.whatsappNumber || process.env.TWILIO_WHATSAPP_NUMBER;
    
    this.client = twilio(this.accountSid, this.authToken);
    this.messageHandlers = new Map();
    this.sessionStore = new Map();
  }

  // Enviar mensagem
  async sendMessage(to, message, mediaUrl = null) {
    try {
      const messageData = {
        from: `whatsapp:${this.whatsappNumber}`,
        to: `whatsapp:${to}`,
        body: message
      };

      if (mediaUrl) {
        messageData.mediaUrl = [mediaUrl];
      }

      const result = await this.client.messages.create(messageData);
      
      console.log(`✅ Mensagem enviada para ${to}: ${result.sid}`);
      return {
        success: true,
        messageSid: result.sid,
        status: result.status
      };

    } catch (error) {
      console.error(`❌ Erro ao enviar mensagem: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Enviar template de mensagem
  async sendTemplate(to, templateName, params = {}) {
    const templates = {
      'welcome': (p) => `🏛️ Bem-vindo ao LegalClaw!

Olá ${p.name}! Sou seu assistente jurídico com IA.

Posso ajudar você com:
📄 Análise de contratos
📰 Monitoramento de diários oficiais
⏰ Gestão de prazos processuais
🔍 Pesquisa de jurisprudência

Digite *ajuda* para ver todos os comandos.`,

      'deadline_alert': (p) => `🔔 ALERTA DE PRAZO

⚖️ Processo: ${p.processNumber}
📋 ${p.title}
📅 Prazo: ${p.deadline}
⏰ Faltam ${p.daysLeft} dias úteis

${p.action || 'Verifique as ações necessárias.'}`,

      'diario_alert': (p) => `🚨 DIÁRIO OFICIAL

${p.source} - ${p.date}
📄 ${p.title}

${p.summary}

🔗 ${p.link}`,

      'contract_analysis_complete': (p) => `✅ Análise de contrato concluída

📄 ${p.contractName}
⏱️ Tempo: ${p.duration}

${p.summary}

Digite *ver análise* para detalhes completos.`
    };

    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template não encontrado: ${templateName}`);
    }

    const message = template(params);
    return this.sendMessage(to, message);
  }

  // Configurar webhook para receber mensagens
  setupWebhook(app, path = '/webhook/whatsapp') {
    app.post(path, express.urlencoded({ extended: false }), async (req, res) => {
      const { From, Body, MediaUrl0 } = req.body;
      const userNumber = From.replace('whatsapp:', '');

      console.log(`📨 Mensagem recebida de ${userNumber}: ${Body}`);

      // Processar mensagem
      const response = await this.handleIncomingMessage({
        from: userNumber,
        body: Body,
        mediaUrl: MediaUrl0
      });

      // Responder via TwiML
      const twiml = new twilio.twiml.MessagingResponse();
      if (response) {
        twiml.message(response);
      }

      res.type('text/xml').send(twiml.toString());
    });

    console.log(`🔗 Webhook WhatsApp configurado em ${path}`);
  }

  // Handler de mensagens recebidas
  async handleIncomingMessage(message) {
    const { from, body, mediaUrl } = message;

    // Comandos básicos
    const commands = {
      'ajuda': () => this.getHelpMessage(),
      'menu': () => this.getMenuMessage(),
      'status': () => this.getStatusMessage(from),
      'prazos': () => this.listDeadlines(from),
      'contratos': () => this.listContracts(from)
    };

    const command = body.toLowerCase().trim();

    if (commands[command]) {
      return commands[command]();
    }

    // Se tiver handler customizado
    if (this.messageHandlers.has(from)) {
      const handler = this.messageHandlers.get(from);
      return handler(message);
    }

    // Processar com IA (OpenClaw)
    return this.processWithAI(message);
  }

  async processWithAI(message) {
    // Aqui integraria com OpenClaw para processar a mensagem
    // Por enquanto, resposta genérica
    return `Recebi sua mensagem: "${message.body}"

Para comandos específicos, digite *menu*.`;
  }

  getHelpMessage() {
    return `📚 **COMANDOS DISPONÍVEIS**

*menu* - Ver menu principal
*prazos* - Listar prazos próximos
*contratos* - Listar contratos
*ajuda* - Esta mensagem

📄 **ANÁLISE DE CONTRATOS**
Envie um PDF do contrato

📰 **DIÁRIOS OFICIAIS**
*monitorar [palavra-chave]* - Adicionar monitoramento

⏰ **PRAZOS**
*novo prazo [descrição]* - Criar novo prazo

Envie sua dúvida para conversar com a IA!`;
  }

  getMenuMessage() {
    return `🏛️ **MENU PRINCIPAL**

1️⃣ Análise de Contratos
2️⃣ Monitorar Diários Oficiais  
3️⃣ Gestão de Prazos
4️⃣ Pesquisa Jurisprudência
5️⃣ Gerar Documento

Digite o número ou nome da opção.`;
  }

  async getStatusMessage(userNumber) {
    const session = this.sessionStore.get(userNumber) || {};
    
    return `📊 **SEU STATUS**

✅ Conta ativa
📱 Número: ${userNumber}
📅 Último acesso: ${session.lastAccess || 'Agora'}

Estatísticas:
- Contratos analisados: ${session.contractsAnalyzed || 0}
- Prazos ativos: ${session.activeDeadlines || 0}
- Alertas configurados: ${session.alerts || 0}`;
  }

  async listDeadlines(userNumber) {
    // Integrar com DeadlineManager
    return `📅 **SEUS PRAZOS**

🔴 *Urgente* (1-3 dias)
• Recurso Apelação - Proc. 123456 - 2 dias

🟡 *Importante* (4-7 dias)  
• Contestação - Proc. 789012 - 5 dias

🔵 *Normal* (8+ dias)
• Parecer técnico - Proc. 345678 - 12 dias

Digite *ver prazo [número]* para detalhes.`;
  }

  async listContracts(userNumber) {
    return `📄 **SEUS CONTRATOS**

Recentes:
• Prestação de Serviços - Cliente ABC - 15/01
• Locação Comercial - Imóvel XYZ - 10/01
• Compra e Venda - Produto 123 - 05/01

Digite *ver contrato [nome]* para análise completa.`;
  }

  // Registrar handler customizado para usuário
  setMessageHandler(userNumber, handler) {
    this.messageHandlers.set(userNumber, handler);
  }

  // Remover handler
  removeMessageHandler(userNumber) {
    this.messageHandlers.delete(userNumber);
  }

  // Broadcast para múltiplos usuários
  async broadcast(numbers, message) {
    const results = [];
    
    for (const number of numbers) {
      const result = await this.sendMessage(number, message);
      results.push({ number, ...result });
    }

    return results;
  }
}

module.exports = WhatsAppIntegration;
