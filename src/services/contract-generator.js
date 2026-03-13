const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ai = require('./ai');
const { pool } = require('../config/migrate');
const config = require('../config');
const logger = require('../utils/logger');

// Diretório público onde os PDFs gerados ficam disponíveis
const GENERATED_DIR = path.join(process.cwd(), 'public', 'generated');

function ensureDir() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

// URL pública base da API
function getPublicUrl() {
  return (process.env.PUBLIC_API_URL || 'https://drlex.wapify.com.br').replace(/\/+$/, '');
}

const CONTRACT_TYPES = {
  prestacao_servicos: {
    label: 'Prestação de Serviços',
    hints: 'Contratante (nome e CPF/CNPJ), Contratado (nome e CPF/CNPJ), descrição dos serviços, valor e forma de pagamento, prazo de vigência',
  },
  honorarios_advocaticios: {
    label: 'Honorários Advocatícios',
    hints: 'Nome do cliente (CPF/CNPJ), nome do advogado e número OAB, objeto da causa, valor ou percentual dos honorários, condições de pagamento',
  },
  compra_venda: {
    label: 'Compra e Venda',
    hints: 'Vendedor (nome e CPF/CNPJ), Comprador (nome e CPF/CNPJ), descrição do bem, valor total, forma de pagamento',
  },
  locacao: {
    label: 'Locação Imobiliária',
    hints: 'Locador (nome e CPF/CNPJ), Locatário (nome e CPF/CNPJ), endereço do imóvel, valor do aluguel, prazo e data de início',
  },
  confidencialidade: {
    label: 'Confidencialidade (NDA)',
    hints: 'Parte 1 (nome e CPF/CNPJ), Parte 2 (nome e CPF/CNPJ), objetivo da troca de informações, prazo de confidencialidade',
  },
  comodato: {
    label: 'Comodato',
    hints: 'Comodante (nome e CPF/CNPJ), Comodatário (nome e CPF/CNPJ), descrição do bem, prazo de devolução, finalidade',
  },
  parceria_comercial: {
    label: 'Parceria Comercial',
    hints: 'Empresa 1 (nome e CNPJ), Empresa 2 (nome e CNPJ), objeto da parceria, forma de divisão de resultados, prazo',
  },
  distrato: {
    label: 'Distrato / Rescisão',
    hints: 'Parte 1 (nome e CPF/CNPJ), Parte 2 (nome e CPF/CNPJ), contrato original a ser rescindido, data da rescisão, condições',
  },
};

function getContractType(input) {
  const lower = String(input || '').toLowerCase().trim();
  // Busca exata por chave
  if (CONTRACT_TYPES[lower]) return { key: lower, ...CONTRACT_TYPES[lower] };
  // Busca por label ou palavras-chave
  for (const [key, cfg] of Object.entries(CONTRACT_TYPES)) {
    if (cfg.label.toLowerCase().includes(lower) || lower.includes(key.replace(/_/g, ' '))) {
      return { key, ...cfg };
    }
  }
  // Detectar por palavras comuns
  if (/servi[çc]o|trabalho|freelan/.test(lower)) return { key: 'prestacao_servicos', ...CONTRACT_TYPES.prestacao_servicos };
  if (/honor[aá]rio|advocat|adv\.?|oab/.test(lower)) return { key: 'honorarios_advocaticios', ...CONTRACT_TYPES.honorarios_advocaticios };
  if (/compra|venda|aquisi/.test(lower)) return { key: 'compra_venda', ...CONTRACT_TYPES.compra_venda };
  if (/loca[çc]|aluguel|im[oó]vel/.test(lower)) return { key: 'locacao', ...CONTRACT_TYPES.locacao };
  if (/confid|sigilo|nda/.test(lower)) return { key: 'confidencialidade', ...CONTRACT_TYPES.confidencialidade };
  if (/comodato|empr[eé]stimo de bem/.test(lower)) return { key: 'comodato', ...CONTRACT_TYPES.comodato };
  if (/parceria|joint|sociedade/.test(lower)) return { key: 'parceria_comercial', ...CONTRACT_TYPES.parceria_comercial };
  if (/distrato|rescis/.test(lower)) return { key: 'distrato', ...CONTRACT_TYPES.distrato };
  return null;
}

async function generateContractText(typeLabel, details) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const prompt = `Você é advogado especialista em contratos brasileiros. Gere um contrato de ${typeLabel} completo e profissional em português, seguindo o Código Civil (CC/2002) e demais normas aplicáveis.

Detalhes fornecidos pelo usuário:
${details}

Data de hoje: ${today}

Estrutura obrigatória do contrato:
1. QUALIFICAÇÃO DAS PARTES
2. OBJETO
3. OBRIGAÇÕES DAS PARTES
4. VALOR E FORMA DE PAGAMENTO (se aplicável)
5. PRAZO DE VIGÊNCIA
6. RESCISÃO
7. PENALIDADES (multas, juros)
8. DISPOSIÇÕES GERAIS
9. FORO (use Brasília-DF como padrão caso não informado)
10. Linhas para ASSINATURAS com data, nome completo e CPF/CNPJ, e linha para testemunhas

Use linguagem jurídica formal. Use os dados fornecidos pelo usuário para preencher as partes. Se alguma informação não foi fornecida, use "[A PREENCHER]".

Retorne APENAS o texto do contrato, sem introdução ou comentários adicionais.`;

  const result = await ai.chat(prompt, '', [], { model: ai.getComplexModel() });
  return result.text || '';
}

function generatePdfBuffer(title, contractText) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Cabeçalho
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(title.toUpperCase(), { align: 'center' })
      .moveDown(0.3);

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' })
      .moveDown(1.5);

    // Linha separadora
    doc
      .moveTo(60, doc.y)
      .lineTo(doc.page.width - 60, doc.y)
      .stroke()
      .moveDown(1);

    // Corpo do contrato
    doc
      .fontSize(11)
      .font('Helvetica')
      .text(contractText, {
        align: 'justify',
        lineGap: 4,
      });

    doc.end();
  });
}

async function generate({ type, details, userId = null }) {
  const typeConfig = getContractType(type);
  if (!typeConfig) {
    throw new Error('Tipo de contrato não reconhecido. Informe um tipo válido.');
  }
  if (!details || String(details).trim().length < 20) {
    throw new Error('Detalhes insuficientes para gerar o contrato.');
  }

  ensureDir();

  const contractText = await generateContractText(typeConfig.label, details);
  if (!contractText) throw new Error('Falha ao gerar o texto do contrato.');

  const uuid = crypto.randomUUID();
  const fileName = `contrato_${uuid}.pdf`;
  const filePath = path.join(GENERATED_DIR, fileName);

  const pdfBuffer = await generatePdfBuffer(`Contrato de ${typeConfig.label}`, contractText);
  fs.writeFileSync(filePath, pdfBuffer);

  const downloadUrl = `${getPublicUrl()}/generated/${fileName}`;
  const title = `Contrato de ${typeConfig.label}`;

  // Salvar no banco
  let contractId = null;
  try {
    const result = await pool.query(
      `INSERT INTO generated_contracts (user_id, contract_type, title, details_text, contract_text, pdf_filename, pdf_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId || null, typeConfig.key, title, details, contractText, fileName, downloadUrl]
    );
    contractId = result.rows[0]?.id;
  } catch (err) {
    logger.warn(`Falha ao salvar contrato gerado: ${err.message}`);
  }

  return {
    id: contractId,
    title,
    contractType: typeConfig.key,
    contractTypeLabel: typeConfig.label,
    contractText,
    downloadUrl,
    fileName,
  };
}

async function listGenerated(userId, limit = 20) {
  try {
    const result = await pool.query(
      `SELECT id, contract_type, title, pdf_url, created_at
       FROM generated_contracts
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } catch (err) {
    logger.warn(`Falha ao listar contratos gerados: ${err.message}`);
    return [];
  }
}

// Limpa arquivos com mais de 7 dias
function cleanupOldFiles() {
  try {
    if (!fs.existsSync(GENERATED_DIR)) return;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    fs.readdirSync(GENERATED_DIR).forEach((file) => {
      const fullPath = path.join(GENERATED_DIR, file);
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(fullPath);
    });
  } catch { /* silencioso */ }
}

module.exports = {
  generate,
  listGenerated,
  getContractType,
  CONTRACT_TYPES,
  cleanupOldFiles,
  GENERATED_DIR,
};
