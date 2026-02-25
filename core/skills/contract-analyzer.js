/**
 * SKILL: Análise de Contratos
 * 
 * Analisa contratos jurídicos brasileiros e identifica:
 * - Partes envolvidas
 * - Objeto do contrato
 * - Valores e condições de pagamento
 * - Prazos e vigência
 * - Cláusulas críticas (rescisão, multa, confidencialidade)
 * - Possíveis riscos jurídicos
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { Anthropic } = require('@anthropic-ai/sdk');

class ContractAnalyzer {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    this.systemPrompt = `Você é um assistente jurídico especializado em análise de contratos brasileiros.

Sua tarefa é analisar contratos e fornecer:

1. RESUMO EXECUTIVO
   - Tipo de contrato
   - Partes (qualificação completa)
   - Objeto principal
   - Valores envolvidos
   
2. PRAZOS E VIGÊNCIA
   - Data de início
   - Prazo de duração
   - Condições de renovação
   - Prazos críticos
   
3. OBRIGAÇÕES PRINCIPAIS
   - Obrigações da parte A
   - Obrigações da parte B
   - Condições de pagamento
   
4. CLÁUSULAS CRÍTICAS
   - Rescisão (condições e multas)
   - Confidencialidade
   - Não-concorrência
   - Responsabilidades e garantias
   - Foro e jurisdição
   
5. ANÁLISE DE RISCOS
   - Cláusulas abusivas ou desequilibradas
   - Termos ambíguos que precisam esclarecimento
   - Lacunas contratuais
   - Sugestões de melhorias
   
6. CHECKLIST DE COMPLIANCE
   - Conformidade com LGPD (se aplicável)
   - Adequação ao Código de Defesa do Consumidor
   - Requisitos legais específicos do tipo de contrato

Formato: JSON estruturado para fácil processamento.`;
  }

  async analyzePDF(filePath) {
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      return pdfData.text;
    } catch (error) {
      throw new Error(`Erro ao ler PDF: ${error.message}`);
    }
  }

  async analyzeContract(contractText, metadata = {}) {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        system: this.systemPrompt,
        messages: [{
          role: 'user',
          content: `Analise o seguinte contrato em português brasileiro:

${contractText}

Metadata adicional:
- Cliente: ${metadata.clientName || 'N/A'}
- Número do processo: ${metadata.processNumber || 'N/A'}
- Data de upload: ${metadata.uploadDate || new Date().toISOString()}

Forneça a análise completa em formato JSON.`
        }]
      });

      const analysisText = response.content[0].text;
      
      // Tentar extrair JSON da resposta
      const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/) || 
                       analysisText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          success: true,
          analysis,
          rawResponse: analysisText,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        analysis: { rawAnalysis: analysisText },
        rawResponse: analysisText,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async analyzeFromFile(filePath, metadata = {}) {
    const ext = path.extname(filePath).toLowerCase();
    
    let contractText;
    
    if (ext === '.pdf') {
      contractText = await this.analyzePDF(filePath);
    } else if (ext === '.txt' || ext === '.md') {
      contractText = fs.readFileSync(filePath, 'utf-8');
    } else {
      throw new Error(`Formato não suportado: ${ext}`);
    }

    return this.analyzeContract(contractText, metadata);
  }

  generateReport(analysis) {
    if (!analysis.success) {
      return `❌ Erro na análise: ${analysis.error}`;
    }

    const a = analysis.analysis;
    
    return `
📄 **ANÁLISE DE CONTRATO**
━━━━━━━━━━━━━━━━━━━━━━━━━

**1. RESUMO EXECUTIVO**
${JSON.stringify(a.resumo || a.rawAnalysis, null, 2)}

**2. PRAZOS E VIGÊNCIA**
${JSON.stringify(a.prazos || 'N/A', null, 2)}

**3. OBRIGAÇÕES PRINCIPAIS**
${JSON.stringify(a.obrigacoes || 'N/A', null, 2)}

**4. CLÁUSULAS CRÍTICAS**
${JSON.stringify(a.clausulas_criticas || 'N/A', null, 2)}

**5. ANÁLISE DE RISCOS**
${JSON.stringify(a.riscos || 'N/A', null, 2)}

**6. COMPLIANCE**
${JSON.stringify(a.compliance || 'N/A', null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Análise realizada em: ${analysis.timestamp}
`;
  }
}

// Interface para OpenClaw
const skill = {
  name: 'contract_analyzer',
  description: 'Analisa contratos jurídicos brasileiros',
  
  commands: {
    'analisar_contrato': async (params) => {
      const analyzer = new ContractAnalyzer();
      
      if (!params.filePath) {
        return {
          success: false,
          message: 'Caminho do arquivo é obrigatório'
        };
      }

      try {
        const analysis = await analyzer.analyzeFromFile(
          params.filePath,
          params.metadata || {}
        );
        
        const report = analyzer.generateReport(analysis);
        
        return {
          success: true,
          message: report,
          data: analysis
        };
      } catch (error) {
        return {
          success: false,
          message: `Erro: ${error.message}`
        };
      }
    }
  }
};

module.exports = { ContractAnalyzer, skill };
