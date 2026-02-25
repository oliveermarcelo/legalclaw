/**
 * LEGALCLAW - Sistema Principal
 * 
 * Orquestra todos os componentes do assistente jurídico
 */

require('dotenv').config();
const express = require('express');
const winston = require('winston');

// Importar componentes
const WhatsAppIntegration = require('./core/integrations/whatsapp');
const TelegramIntegration = require('./core/integrations/telegram');
const { ContractAnalyzer } = require('./core/skills/contract-analyzer');
const { DiarioMonitor } = require('./core/skills/diario-monitor');
const { DeadlineManager } = require('./core/skills/deadline-manager');

// Configurar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class LegalClaw {
  constructor() {
    this.config = {
      port: process.env.API_PORT || 3000,
      enableWhatsApp: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN,
      enableTelegram: process.env.TELEGRAM_BOT_TOKEN,
      enableDiarioMonitor: process.env.ENABLE_DIARIO_MONITOR === 'true',
      enableDeadlineAlerts: process.env.ENABLE_DEADLINE_MANAGER === 'true'
    };

    this.app = express();
    this.setupMiddleware();
    
    // Componentes
    this.whatsapp = null;
    this.telegram = null;
    this.contractAnalyzer = new ContractAnalyzer();
    this.diarioMonitor = null;
    this.deadlineManager = new DeadlineManager();
    
    this.sessions = new Map();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    
    // Logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`);
      next();
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
          whatsapp: !!this.whatsapp,
          telegram: !!this.telegram,
          diarioMonitor: !!this.diarioMonitor
        }
      });
    });
  }

  async initialize() {
    logger.info('🚀 Inicializando LegalClaw...');

    try {
      // Inicializar WhatsApp
      if (this.config.enableWhatsApp) {
        logger.info('📱 Configurando WhatsApp...');
        this.whatsapp = new WhatsAppIntegration();
        this.whatsapp.setupWebhook(this.app);
        logger.info('✅ WhatsApp configurado');
      }

      // Inicializar Telegram
      if (this.config.enableTelegram) {
        logger.info('🤖 Configurando Telegram...');
        this.telegram = new TelegramIntegration();
        this.telegram.launch();
        logger.info('✅ Telegram configurado');
      }

      // Inicializar Monitor de Diários
      if (this.config.enableDiarioMonitor) {
        logger.info('📰 Configurando Monitor de Diários Oficiais...');
        this.diarioMonitor = new DiarioMonitor({
          checkInterval: process.env.DOU_CHECK_INTERVAL || '0 8 * * *',
          keywords: (process.env.DOU_KEYWORDS || '').split(',').filter(Boolean)
        });

        // Handler para achados
        this.diarioMonitor.startMonitoring((findings) => {
          this.handleDiarioFindings(findings);
        });
        
        logger.info('✅ Monitor de Diários configurado');
      }

      // Inicializar alertas de prazos
      if (this.config.enableDeadlineAlerts) {
        logger.info('⏰ Configurando alertas de prazos...');
        this.setupDeadlineAlerts();
        logger.info('✅ Alertas de prazos configurados');
      }

      logger.info('🎉 LegalClaw inicializado com sucesso!');

    } catch (error) {
      logger.error(`❌ Erro na inicialização: ${error.message}`);
      throw error;
    }
  }

  setupDeadlineAlerts() {
    // Verificar prazos a cada hora
    setInterval(() => {
      const upcoming = this.deadlineManager.listUpcoming(7);
      
      upcoming.forEach(deadline => {
        const daysLeft = this.deadlineManager.getBusinessDaysUntil(
          new Date(deadline.deadline)
        );

        // Alertar quando faltar 7, 3 ou 1 dia
        if ([7, 3, 1].includes(daysLeft)) {
          this.sendDeadlineAlert(deadline, daysLeft);
        }
      });
    }, 60 * 60 * 1000); // 1 hora
  }

  async sendDeadlineAlert(deadline, daysLeft) {
    const message = this.deadlineManager.generateAlertMessage(deadline, `${daysLeft}d`);

    // Enviar via WhatsApp
    if (this.whatsapp && deadline.whatsappNumber) {
      await this.whatsapp.sendMessage(deadline.whatsappNumber, message);
    }

    // Enviar via Telegram
    if (this.telegram && deadline.telegramId) {
      await this.telegram.sendMessage(deadline.telegramId, message);
    }

    logger.info(`📅 Alerta de prazo enviado: ${deadline.title} (${daysLeft} dias)`);
  }

  async handleDiarioFindings(findings) {
    const alert = this.diarioMonitor.generateAlert(findings);
    
    logger.info(`📰 ${findings.length} publicações relevantes encontradas`);

    // Enviar alertas para usuários configurados
    const subscribers = this.getSubscribers('diario');
    
    for (const subscriber of subscribers) {
      if (subscriber.whatsappNumber && this.whatsapp) {
        await this.whatsapp.sendMessage(subscriber.whatsappNumber, alert);
      }
      
      if (subscriber.telegramId && this.telegram) {
        await this.telegram.sendMessage(subscriber.telegramId, alert);
      }
    }
  }

  getSubscribers(service) {
    // Aqui você buscaria do banco de dados
    // Por enquanto, retorna array vazio
    return [];
  }

  // API Routes
  setupRoutes() {
    // Análise de contratos
    this.app.post('/api/contracts/analyze', async (req, res) => {
      try {
        const { filePath, metadata } = req.body;
        
        const analysis = await this.contractAnalyzer.analyzeFromFile(
          filePath,
          metadata
        );

        res.json(analysis);
      } catch (error) {
        logger.error(`Erro na análise: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Verificar diários
    this.app.get('/api/diarios/check', async (req, res) => {
      try {
        if (!this.diarioMonitor) {
          return res.status(400).json({ error: 'Monitor não habilitado' });
        }

        const findings = await this.diarioMonitor.check();
        res.json({ findings });
      } catch (error) {
        logger.error(`Erro ao verificar diários: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Listar prazos
    this.app.get('/api/deadlines', async (req, res) => {
      try {
        const days = parseInt(req.query.days) || 30;
        const deadlines = this.deadlineManager.listUpcoming(days);
        res.json({ deadlines });
      } catch (error) {
        logger.error(`Erro ao listar prazos: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Adicionar prazo
    this.app.post('/api/deadlines', async (req, res) => {
      try {
        const deadline = this.deadlineManager.addDeadline(req.body);
        res.json({ deadline });
      } catch (error) {
        logger.error(`Erro ao adicionar prazo: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Calcular prazo
    this.app.post('/api/deadlines/calculate', async (req, res) => {
      try {
        const result = this.deadlineManager.calculateDeadline(req.body);
        res.json(result);
      } catch (error) {
        logger.error(`Erro ao calcular prazo: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });
  }

  start() {
    this.setupRoutes();

    this.app.listen(this.config.port, () => {
      logger.info(`🌐 API rodando na porta ${this.config.port}`);
      logger.info(`📱 WhatsApp: ${this.config.enableWhatsApp ? 'Ativo' : 'Inativo'}`);
      logger.info(`🤖 Telegram: ${this.config.enableTelegram ? 'Ativo' : 'Inativo'}`);
      logger.info(`📰 Monitor Diários: ${this.config.enableDiarioMonitor ? 'Ativo' : 'Inativo'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('⏸️  Encerrando gracefully...');
      process.exit(0);
    });
  }
}

// Inicializar e executar
async function main() {
  const legalClaw = new LegalClaw();
  
  try {
    await legalClaw.initialize();
    legalClaw.start();
  } catch (error) {
    logger.error(`❌ Erro fatal: ${error.message}`);
    process.exit(1);
  }
}

// Executar se for o arquivo principal
if (require.main === module) {
  main();
}

module.exports = LegalClaw;
