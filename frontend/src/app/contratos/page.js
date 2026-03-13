'use client';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileSearch,
  FilePlus2,
  FileText,
  FileUp,
  Gavel,
  History,
  Loader2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { analyzeContract, analyzeContractPdf, getContracts, getContractGenerateTypes, generateContract, getGeneratedContracts } from '@/lib/api';

const TABS = [
  { id: 'generate', label: 'Gerar', icon: FilePlus2 },
  { id: 'analyze', label: 'Analisar', icon: Gavel },
  { id: 'history', label: 'Histórico', icon: History },
];

function getRiskBadgeClass(rawRisk) {
  const key = String(rawRisk || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const map = { CRITICO: 'badge-critical', ALTO: 'badge-high', MEDIO: 'badge-medium', BAIXO: 'badge-low' };
  return map[key] || 'badge-medium';
}

function formatDateSafe(dateValue, fallback = '-') {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString('pt-BR');
}

export default function ContratosPage() {
  const [tab, setTab] = useState('generate');

  // Análise
  const [inputMode, setInputMode] = useState('text');
  const [text, setText] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [title, setTitle] = useState('');
  const [result, setResult] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // Geração
  const [contractTypes, setContractTypes] = useState([]);
  const [genType, setGenType] = useState('');
  const [genDetails, setGenDetails] = useState('');
  const [genResult, setGenResult] = useState(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [generatedList, setGeneratedList] = useState([]);
  const [loadingGenList, setLoadingGenList] = useState(true);

  const selectedTypeConfig = contractTypes.find((t) => t.key === genType);

  useEffect(() => {
    getContracts()
      .then(setContracts)
      .catch(() => {})
      .finally(() => setLoadingList(false));

    getContractGenerateTypes()
      .then((types) => {
        setContractTypes(types);
        if (types.length > 0) setGenType(types[0].key);
      })
      .catch(() => {});

    getGeneratedContracts()
      .then(setGeneratedList)
      .catch(() => {})
      .finally(() => setLoadingGenList(false));
  }, []);

  async function handleAnalyze(e) {
    e.preventDefault();
    if (inputMode === 'text' && !text.trim()) return;
    if (inputMode === 'pdf' && !pdfFile) {
      setResult({ error: 'Selecione um arquivo PDF para analisar.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = inputMode === 'pdf'
        ? await analyzeContractPdf(pdfFile, title || pdfFile?.name || 'Contrato PDF')
        : await analyzeContract(text, title || 'Sem titulo');
      setResult(data);
      getContracts().then(setContracts).catch(() => {});
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setGenError('');
    setGenResult(null);
    if (!genType) { setGenError('Selecione o tipo de contrato.'); return; }
    if (!genDetails.trim() || genDetails.trim().length < 20) {
      setGenError('Preencha os detalhes do contrato (partes, valores, prazo, etc.).');
      return;
    }
    setGenLoading(true);
    try {
      const data = await generateContract({ type: genType, details: genDetails });
      setGenResult(data);
      getGeneratedContracts().then(setGeneratedList).catch(() => {});
    } catch (err) {
      setGenError(err.message || 'Erro ao gerar o contrato.');
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Contratos com IA
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Contratos</h1>
        <p className="text-surface-400 text-lg">
          Gere contratos profissionais em PDF ou revise cláusulas com apoio de IA.
        </p>
      </header>

      <div className="mb-6 inline-flex gap-1 rounded-2xl border border-surface-200/80 bg-white p-1 shadow-sm">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={[
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-brand-700 text-white shadow-lg shadow-brand-700/25'
                  : 'text-surface-500 hover:text-surface-900 hover:bg-surface-100',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ─── ABA GERAR ─── */}
      {tab === 'generate' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Gerar contrato</h3>
            <p className="text-sm text-surface-400 mb-5">
              A IA monta o contrato completo com suas informações e gera o PDF para download.
            </p>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">
                  Tipo de contrato
                </label>
                <select
                  className="input-field w-full"
                  value={genType}
                  onChange={(e) => { setGenType(e.target.value); setGenResult(null); setGenError(''); }}
                >
                  {contractTypes.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              {selectedTypeConfig && (
                <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-xs text-brand-800">
                  <p className="font-semibold mb-1">Informações necessárias:</p>
                  <p className="leading-relaxed">{selectedTypeConfig.hints}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">
                  Detalhes do contrato
                </label>
                <textarea
                  className="input-field min-h-[220px] resize-y text-sm"
                  placeholder={`Ex: Contratante: João da Silva, CPF 123.456.789-00\nContratado: Maria Souza, CPF 987.654.321-00\nServiços: Consultoria jurídica mensal\nValor: R$ 2.000/mês\nPrazo: 12 meses a partir de 01/04/2026`}
                  value={genDetails}
                  onChange={(e) => setGenDetails(e.target.value)}
                />
              </div>

              {genError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 inline-flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
                  <span>{genError}</span>
                </div>
              )}

              <button type="submit" disabled={genLoading} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                {genLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />Gerando contrato...</>
                  : <><FilePlus2 className="h-4 w-4" strokeWidth={2.2} />Gerar Contrato em PDF</>
                }
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm flex flex-col">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Contrato gerado</h3>
            <p className="text-sm text-surface-400 mb-5">Revise o texto e baixe o PDF.</p>

            {genLoading ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-3 text-surface-400">
                <Loader2 className="h-8 w-8 animate-spin" strokeWidth={1.8} />
                <p className="text-sm">A IA está redigindo o contrato...</p>
              </div>
            ) : genResult ? (
              <div className="space-y-4 flex-1">
                <a
                  href={genResult.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full inline-flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" strokeWidth={2.2} />
                  Baixar PDF
                </a>
                <div className="rounded-2xl border border-surface-100 bg-surface-50 px-4 py-3 text-xs text-surface-500">
                  <p className="font-semibold text-surface-700 mb-0.5">{genResult.title}</p>
                  <p>Arquivo: {genResult.fileName}</p>
                </div>
                <div className="overflow-auto max-h-[420px] rounded-2xl border border-surface-200 bg-white p-4">
                  <pre className="text-xs text-surface-700 whitespace-pre-wrap font-sans leading-relaxed">
                    {genResult.contractText}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-surface-500 py-10">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
                  <FilePlus2 className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <p className="font-medium text-surface-700">Nenhum contrato gerado ainda</p>
                <p className="text-sm mt-1">Preencha as informações e clique em Gerar.</p>
                {generatedList.length > 0 && (
                  <div className="mt-6 w-full text-left">
                    <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-2">Contratos anteriores</p>
                    <div className="space-y-2">
                      {generatedList.slice(0, 5).map((g) => (
                        <a
                          key={g.id}
                          href={g.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50 px-3 py-2 hover:bg-surface-100 transition-colors"
                        >
                          <div>
                            <p className="text-xs font-semibold text-surface-800">{g.title}</p>
                            <p className="text-[11px] text-surface-400">{formatDateSafe(g.created_at)}</p>
                          </div>
                          <Download className="h-3.5 w-3.5 text-surface-400 shrink-0" strokeWidth={2.2} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ─── ABA ANALISAR ─── */}
      {tab === 'analyze' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Analisar contrato</h3>
            <p className="text-sm text-surface-400 mb-5">
              Revise riscos, pontos críticos e sugestões de melhoria por texto ou PDF.
            </p>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <div className="inline-flex gap-1 rounded-xl border border-surface-200 bg-surface-50 p-1">
                <button type="button" onClick={() => setInputMode('text')}
                  className={['rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', inputMode === 'text' ? 'bg-brand-700 text-white' : 'text-surface-600 hover:text-surface-900'].join(' ')}>
                  Texto
                </button>
                <button type="button" onClick={() => setInputMode('pdf')}
                  className={['rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', inputMode === 'pdf' ? 'bg-brand-700 text-white' : 'text-surface-600 hover:text-surface-900'].join(' ')}>
                  PDF
                </button>
              </div>

              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                className="input-field" placeholder="Título do contrato (opcional)" />

              {inputMode === 'text' ? (
                <textarea value={text} onChange={(e) => setText(e.target.value)}
                  className="input-field min-h-[320px] resize-y font-mono text-sm"
                  placeholder="Cole o texto do contrato aqui." required />
              ) : (
                <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                  <label className="block text-sm font-medium text-surface-700 mb-2">Arquivo PDF do contrato</label>
                  <input type="file" accept="application/pdf,.pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-surface-700 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-700 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-800"
                    required />
                  <p className="text-xs text-surface-400 mt-2">Limite de 10MB por arquivo.</p>
                  {pdfFile && <p className="mt-2 text-xs text-surface-600">Arquivo: <span className="font-semibold">{pdfFile.name}</span></p>}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />Analisando...</>
                  : <>{inputMode === 'pdf' ? <FileUp className="h-4 w-4" strokeWidth={2.2} /> : <FileSearch className="h-4 w-4" strokeWidth={2.2} />}{inputMode === 'pdf' ? 'Analisar PDF' : 'Analisar contrato'}</>
                }
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Resultado da análise</h3>
            <p className="text-sm text-surface-400 mb-5">Retorno estruturado para acelerar sua revisão jurídica.</p>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-surface-100 rounded w-full" />
                  </div>
                ))}
                <div className="inline-flex items-center gap-2 text-sm text-surface-500">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />IA em processamento...
                </div>
              </div>
            ) : result?.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm inline-flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} /><span>{result.error}</span>
              </div>
            ) : result?.analysis ? (
              <div className="space-y-4">
                {(result.riskLevel || result.analysis?.risk_level) && (
                  <span className={`badge ${getRiskBadgeClass(result.riskLevel || result.analysis?.risk_level)}`}>
                    Risco: {result.riskLevel || result.analysis?.risk_level}
                  </span>
                )}
                {typeof result.analysis?.score === 'number' && (
                  <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                    <p className="text-sm text-surface-500">Score de segurança</p>
                    <p className="text-2xl font-bold text-surface-900">{result.analysis.score}/10</p>
                  </div>
                )}
                {Array.isArray(result.analysis?.clausulas_risco) && result.analysis.clausulas_risco.length > 0 && (
                  <div className="rounded-2xl border border-surface-200 bg-white p-4">
                    <p className="text-sm font-semibold text-surface-800 mb-3">Cláusulas de risco</p>
                    <div className="space-y-3 max-h-80 overflow-auto pr-1">
                      {result.analysis.clausulas_risco.slice(0, 6).map((item, idx) => (
                        <div key={`${item.clausula || 'clausula'}-${idx}`} className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-surface-800">{item.clausula || `Cláusula ${idx + 1}`}</p>
                            {item.risco && <span className={`badge ${getRiskBadgeClass(item.risco)}`}>{item.risco}</span>}
                          </div>
                          {item.explicacao && <p className="text-xs text-surface-600 mt-2">{item.explicacao}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.analysis?.recomendacao && (
                  <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
                    <p className="font-semibold mb-1">Recomendação final</p>
                    <p>{result.analysis.recomendacao}</p>
                  </div>
                )}
              </div>
            ) : result?.text ? (
              <div>
                {result.analysis?.risk_level && (
                  <div className="mb-4">
                    <span className={`badge ${getRiskBadgeClass(result.analysis.risk_level)}`}>Risco: {result.analysis.risk_level}</span>
                  </div>
                )}
                <div className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4 whitespace-pre-wrap text-surface-800 text-sm leading-relaxed">
                  {result.text}
                </div>
              </div>
            ) : (
              <div className="py-14 text-center text-surface-500">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
                  <FileText className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <p className="font-medium text-surface-700">Nenhuma análise gerada</p>
                <p className="text-sm mt-1">Preencha o contrato e execute a análise para ver o resultado.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ─── ABA HISTÓRICO ─── */}
      {tab === 'history' && (
        <section className="rounded-3xl border border-surface-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-surface-200/80 px-6 py-4">
            <h3 className="font-display text-2xl text-surface-900">Histórico de contratos</h3>
            <p className="text-sm text-surface-400 mt-1">Análises e contratos gerados para consulta rápida.</p>
          </div>

          {loadingList || loadingGenList ? (
            <div className="p-8 text-center text-surface-400 inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />Carregando histórico...
            </div>
          ) : contracts.length === 0 && generatedList.length === 0 ? (
            <div className="p-12 text-center text-surface-500">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-surface-100 text-surface-600 flex items-center justify-center">
                <History className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <p className="font-medium text-surface-700">Nenhum contrato ainda</p>
              <button onClick={() => setTab('generate')} className="btn-primary mt-5 inline-flex items-center gap-2">
                <FilePlus2 className="h-4 w-4" strokeWidth={2.2} />Gerar primeiro contrato
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {generatedList.map((g) => (
                <div key={`gen-${g.id}`} className="px-6 py-4 hover:bg-surface-50/80 transition-colors flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">Gerado</span>
                      <p className="font-semibold text-surface-900 text-sm">{g.title}</p>
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5">{formatDateSafe(g.created_at)}</p>
                  </div>
                  <a href={g.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 shrink-0">
                    <Download className="h-3.5 w-3.5" strokeWidth={2.2} />PDF
                  </a>
                </div>
              ))}
              {contracts.map((contract) => (
                <div key={`ana-${contract.id}`} className="px-6 py-4 hover:bg-surface-50/80 transition-colors flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-100 text-surface-500">Analisado</span>
                      <p className="font-semibold text-surface-900 text-sm">{contract.title || 'Sem título'}</p>
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5">{formatDateSafe(contract.created_at)}</p>
                  </div>
                  {contract.risk_level ? (
                    <span className={`badge ${getRiskBadgeClass(contract.risk_level)}`}>{contract.risk_level}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 text-surface-500 px-2.5 py-1 text-xs font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2.2} />Sem classificação
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
