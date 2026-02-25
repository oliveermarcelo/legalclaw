/**
 * SKILL: Monitor de Diário Oficial
 * 
 * Monitora publicações em:
 * - DOU (Diário Oficial da União)
 * - DOE (Diários Estaduais)
 * - DOM (Diários Municipais)
 * 
 * Envia alertas quando encontra publicações relevantes
 */

const axios = require('axios');
const cheerio = require('cheerio');
const cron = require('node-cron');
const { Anthropic } = require('@anthropic-ai/sdk');

class DiarioMonitor {
  constructor(config = {}) {
    this.config = {
      checkInterval: config.checkInterval || '0 8 * * *', // 8h da manhã
      keywords: config.keywords || [],
      cnpjs: config.cnpjs || [],
      cpfs: config.cpfs || [],
      processNumbers: config.processNumbers || [],
      tribunals: config.tribunals || ['DOU', 'DOE-SP', 'DOM-SP'],
      ...config
    };

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.lastCheck = null;
    this.findings = [];
  }

  async fetchDOU(section = 1, date = null) {
    try {
      // URL do DOU (API pública limitada)
      const targetDate = date || new Date().toISOString().split('T')[0];
      const url = `https://www.in.gov.br/consulta/-/buscar/dou${section}/${targetDate}`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LegalClaw/1.0)'
        },
        timeout: 30000
      });

      const $ = cheerio.load(response.data);
      const publications = [];

      // Parsing específico do DOU
      $('.resultado-busca').each((i, elem) => {
        const title = $(elem).find('.identifica').text().trim();
        const content = $(elem).find('.texto-dou').text().trim();
        const pubDate = $(elem).find('.data').text().trim();
        const link = $(elem).find('a').attr('href');

        publications.push({
          title,
          content,
          pubDate,
          link: `https://www.in.gov.br${link}`,
          source: `DOU Seção ${section}`,
          section
        });
      });

      return publications;
    } catch (error) {
      console.error(`Erro ao buscar DOU: ${error.message}`);
      return [];
    }
  }

  async fetchDOE(state = 'SP', date = null) {
    // Implementação específica por estado
    // Exemplo para São Paulo
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const url = `https://www.imprensaoficial.com.br/DO/BuscaDO2001Resultado_11_3.aspx?data=${targetDate}`;

      const response = await axios.get(url, {
        timeout: 30000
      });

      // Parsing específico do DOE-SP
      const $ = cheerio.load(response.data);
      const publications = [];

      // Lógica de parsing aqui...

      return publications;
    } catch (error) {
      console.error(`Erro ao buscar DOE-${state}: ${error.message}`);
      return [];
    }
  }

  isRelevant(publication) {
    const text = `${publication.title} ${publication.content}`.toLowerCase();

    // Verifica keywords
    if (this.config.keywords.length > 0) {
      const hasKeyword = this.config.keywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
      if (hasKeyword) return true;
    }

    // Verifica CNPJs
    if (this.config.cnpjs.length > 0) {
      const hasCNPJ = this.config.cnpjs.some(cnpj => 
        text.includes(cnpj.replace(/[^\d]/g, ''))
      );
      if (hasCNPJ) return true;
    }

    // Verifica CPFs
    if (this.config.cpfs.length > 0) {
      const hasCPF = this.config.cpfs.some(cpf => 
        text.includes(cpf.replace(/[^\d]/g, ''))
      );
      if (hasCPF) return true;
    }

    // Verifica números de processo
    if (this.config.processNumbers.length > 0) {
      const hasProcess = this.config.processNumbers.some(num => 
        text.includes(num)
      );
      if (hasProcess) return true;
    }

    return false;
  }

  async analyzeRelevance(publication) {
    // Use IA para análise mais profunda
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Analise esta publicação do diário oficial e classifique sua importância jurídica:

Título: ${publication.title}
Conteúdo: ${publication.content}

Classifique como:
- CRÍTICO: Exige ação imediata
- IMPORTANTE: Requer atenção
- INFORMATIVO: Apenas para conhecimento
- IRRELEVANTE: Pode ignorar

Forneça também um resumo em 2-3 linhas do que é e qual ação deve ser tomada.

Formato: JSON com {nivel, resumo, acao_sugerida}`
        }]
      });

      const analysisText = response.content[0].text;
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        nivel: 'INFORMATIVO',
        resumo: analysisText,
        acao_sugerida: 'Revisar manualmente'
      };

    } catch (error) {
      return {
        nivel: 'INFORMATIVO',
        resumo: 'Erro na análise automática',
        acao_sugerida: 'Revisar manualmente'
      };
    }
  }

  async check() {
    console.log('🔍 Iniciando verificação de diários oficiais...');
    this.lastCheck = new Date();

    const allPublications = [];

    // Busca DOU (seções 1, 2, 3)
    if (this.config.tribunals.includes('DOU')) {
      for (let section = 1; section <= 3; section++) {
        const pubs = await this.fetchDOU(section);
        allPublications.push(...pubs);
      }
    }

    // Busca DOEs
    const statesDOE = this.config.tribunals
      .filter(t => t.startsWith('DOE-'))
      .map(t => t.split('-')[1]);

    for (const state of statesDOE) {
      const pubs = await this.fetchDOE(state);
      allPublications.push(...pubs);
    }

    // Filtra publicações relevantes
    const relevantPubs = allPublications.filter(pub => this.isRelevant(pub));

    console.log(`📊 Total de publicações: ${allPublications.length}`);
    console.log(`⚠️  Publicações relevantes: ${relevantPubs.length}`);

    // Analisa cada publicação relevante
    const analyzed = [];
    for (const pub of relevantPubs) {
      const analysis = await this.analyzeRelevance(pub);
      analyzed.push({
        ...pub,
        analysis
      });
    }

    this.findings = analyzed;
    return analyzed;
  }

  async startMonitoring(onFinding) {
    console.log(`⏰ Monitor iniciado. Verificação: ${this.config.checkInterval}`);

    // Executa verificação imediatamente
    const findings = await this.check();
    if (findings.length > 0 && onFinding) {
      onFinding(findings);
    }

    // Agenda verificações periódicas
    cron.schedule(this.config.checkInterval, async () => {
      const findings = await this.check();
      if (findings.length > 0 && onFinding) {
        onFinding(findings);
      }
    });
  }

  generateAlert(findings) {
    if (findings.length === 0) {
      return '✅ Nenhuma publicação relevante encontrada.';
    }

    let alert = `🚨 **ALERTA DE DIÁRIO OFICIAL**\n`;
    alert += `📅 Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
    alert += `📊 ${findings.length} publicação(ões) relevante(s)\n\n`;

    findings.forEach((finding, i) => {
      const { analysis } = finding;
      const emoji = {
        'CRÍTICO': '🔴',
        'IMPORTANTE': '🟡',
        'INFORMATIVO': '🔵'
      }[analysis.nivel] || '⚪';

      alert += `${emoji} **${i + 1}. ${finding.title}**\n`;
      alert += `   Fonte: ${finding.source}\n`;
      alert += `   Nível: ${analysis.nivel}\n`;
      alert += `   Resumo: ${analysis.resumo}\n`;
      alert += `   Ação: ${analysis.acao_sugerida}\n`;
      alert += `   Link: ${finding.link}\n\n`;
    });

    return alert;
  }
}

// Interface para OpenClaw
const skill = {
  name: 'diario_monitor',
  description: 'Monitora diários oficiais (DOU, DOE, DOM)',
  
  commands: {
    'verificar_diarios': async (params) => {
      const monitor = new DiarioMonitor(params.config || {});
      const findings = await monitor.check();
      const alert = monitor.generateAlert(findings);

      return {
        success: true,
        message: alert,
        data: findings
      };
    },

    'iniciar_monitoramento': async (params) => {
      const monitor = new DiarioMonitor(params.config || {});
      
      monitor.startMonitoring((findings) => {
        const alert = monitor.generateAlert(findings);
        // Enviar alerta via WhatsApp/Telegram
        if (params.onAlert) {
          params.onAlert(alert, findings);
        }
      });

      return {
        success: true,
        message: '✅ Monitoramento iniciado com sucesso!'
      };
    }
  }
};

module.exports = { DiarioMonitor, skill };
