'use client';
import { useState, useEffect } from 'react';
import { analyzeContract, getContracts } from '@/lib/api';

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
      const data = await analyzeContract(text, title || 'Sem título');
      setResult(data);
      // Refresh list
      getContracts().then(setContracts).catch(() => {});
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  }

  const riskColors = {
    'CRÍTICO': 'badge-critical',
    'ALTO': 'badge-high',
    'MÉDIO': 'badge-medium',
    'BAIXO': 'badge-low',
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-surface-900 mb-1">Contratos</h1>
        <p className="text-surface-300">Analise contratos com IA e identifique riscos</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-100 rounded-xl p-1 w-fit">
        {[
          { id: 'analyze', label: '📋 Analisar' },
          { id: 'history', label: '📁 Histórico' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-surface-900 shadow-sm'
                : 'text-surface-300 hover:text-surface-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Analyze Tab */}
      {tab === 'analyze' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">Cole o contrato</h3>
            <form onSubmit={handleAnalyze} className="space-y-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="Título do contrato (opcional)"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="input-field min-h-[300px] resize-y font-mono text-sm"
                placeholder="Cole o texto do contrato aqui...&#10;&#10;A IA vai identificar cláusulas abusivas, riscos, e sugerir melhorias."
                required
              />
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? '🔍 Analisando...' : '⚖ Analisar contrato'}
              </button>
            </form>
          </div>

          {/* Result */}
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">Resultado da análise</h3>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-surface-100 rounded w-full" />
                  </div>
                ))}
                <p className="text-sm text-surface-300 text-center mt-4">
                  ⏳ Analisando com IA, pode levar alguns segundos...
                </p>
              </div>
            ) : result?.error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
                {result.error}
              </div>
            ) : result?.text ? (
              <div className="prose prose-sm max-w-none">
                {result.analysis?.risk_level && (
                  <div className="mb-4">
                    <span className={`badge ${riskColors[result.analysis.risk_level] || 'badge-medium'}`}>
                      Risco: {result.analysis.risk_level}
                    </span>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-surface-800 text-sm leading-relaxed">
                  {result.text}
                </div>
              </div>
            ) : (
              <div className="text-center text-surface-300 py-12">
                <span className="text-4xl block mb-3">📋</span>
                <p>Cole um contrato ao lado e clique em &quot;Analisar&quot;</p>
                <p className="text-xs mt-2">A IA identificará riscos, cláusulas abusivas e sugestões</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="card">
          {loadingList ? (
            <div className="p-8 text-center text-surface-300">Carregando...</div>
          ) : contracts.length === 0 ? (
            <div className="p-12 text-center text-surface-300">
              <span className="text-4xl block mb-3">📁</span>
              <p>Nenhum contrato analisado ainda</p>
              <button onClick={() => setTab('analyze')} className="btn-primary mt-4">
                Analisar primeiro contrato
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {contracts.map((c) => (
                <div key={c.id} className="p-5 hover:bg-surface-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-surface-900">{c.title}</p>
                      <p className="text-xs text-surface-300 mt-1">
                        {new Date(c.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {c.risk_level && (
                      <span className={`badge ${riskColors[c.risk_level] || 'badge-medium'}`}>
                        {c.risk_level}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
