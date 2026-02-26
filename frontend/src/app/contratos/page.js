'use client';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  FileSearch,
  FileText,
  Gavel,
  History,
  Loader2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { analyzeContract, getContracts } from '@/lib/api';

const TABS = [
  { id: 'analyze', label: 'Analisar', icon: Gavel },
  { id: 'history', label: 'Historico', icon: History },
];

function getRiskBadgeClass(rawRisk) {
  const key = String(rawRisk || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  const map = {
    CRITICO: 'badge-critical',
    ALTO: 'badge-high',
    MEDIO: 'badge-medium',
    BAIXO: 'badge-low',
  };

  return map[key] || 'badge-medium';
}

function formatDateSafe(dateValue, fallback = '-') {
  if (!dateValue) return fallback;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString('pt-BR');
}

export default function ContratosPage() {
  const [tab, setTab] = useState('analyze');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [result, setResult] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    getContracts()
      .then(setContracts)
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  async function handleAnalyze(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const data = await analyzeContract(text, title || 'Sem titulo');
      setResult(data);
      getContracts().then(setContracts).catch(() => {});
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Analise juridica premium
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Contratos</h1>
        <p className="text-surface-400 text-lg">
          Revise clausulas, identifique riscos e tome decisoes com apoio de IA.
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

      {tab === 'analyze' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Analisar contrato</h3>
            <p className="text-sm text-surface-400 mb-5">
              Cole o texto para revisar riscos, pontos criticos e sugestoes de melhoria.
            </p>

            <form onSubmit={handleAnalyze} className="space-y-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="Titulo do contrato (opcional)"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="input-field min-h-[320px] resize-y font-mono text-sm"
                placeholder="Cole o texto do contrato aqui."
                required
              />

              <button type="submit" disabled={loading} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                    Analisando...
                  </>
                ) : (
                  <>
                    <FileSearch className="h-4 w-4" strokeWidth={2.2} />
                    Analisar contrato
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Resultado da analise</h3>
            <p className="text-sm text-surface-400 mb-5">
              Retorno estruturado para acelerar sua revisao juridica.
            </p>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-surface-100 rounded w-full" />
                  </div>
                ))}
                <div className="inline-flex items-center gap-2 text-sm text-surface-500">
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                  IA em processamento...
                </div>
              </div>
            ) : result?.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm inline-flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
                <span>{result.error}</span>
              </div>
            ) : result?.text ? (
              <div>
                {result.analysis?.risk_level && (
                  <div className="mb-4">
                    <span className={`badge ${getRiskBadgeClass(result.analysis.risk_level)}`}>
                      Risco: {result.analysis.risk_level}
                    </span>
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
                <p className="font-medium text-surface-700">Nenhuma analise gerada</p>
                <p className="text-sm mt-1">Preencha o contrato e execute a analise para ver o resultado.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'history' && (
        <section className="rounded-3xl border border-surface-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-surface-200/80 px-6 py-4">
            <h3 className="font-display text-2xl text-surface-900">Historico de analises</h3>
            <p className="text-sm text-surface-400 mt-1">Contratos processados para consulta rapida.</p>
          </div>

          {loadingList ? (
            <div className="p-8 text-center text-surface-400 inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Carregando historico...
            </div>
          ) : contracts.length === 0 ? (
            <div className="p-12 text-center text-surface-500">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-surface-100 text-surface-600 flex items-center justify-center">
                <History className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <p className="font-medium text-surface-700">Nenhum contrato analisado ainda</p>
              <button onClick={() => setTab('analyze')} className="btn-primary mt-5 inline-flex items-center gap-2">
                <Gavel className="h-4 w-4" strokeWidth={2.2} />
                Analisar primeiro contrato
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {contracts.map((contract) => (
                <div key={contract.id} className="px-6 py-5 hover:bg-surface-50/80 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-surface-900">{contract.title || 'Sem titulo'}</p>
                      <p className="text-xs text-surface-400 mt-1">{formatDateSafe(contract.created_at)}</p>
                    </div>

                    {contract.risk_level ? (
                      <span className={`badge ${getRiskBadgeClass(contract.risk_level)}`}>{contract.risk_level}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 text-surface-500 px-2.5 py-1 text-xs font-semibold">
                        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2.2} />
                        Sem classificacao
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
