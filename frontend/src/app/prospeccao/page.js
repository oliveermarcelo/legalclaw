'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  getExternalProvidersStatus,
  getProspectingSpecialties,
  getProspectingHistory,
  searchProspectingOpportunities,
} from '@/lib/api';

function prettyAlias(alias) {
  return String(alias || '').replace(/^api_publica_/i, '').toUpperCase();
}

function formatDate(value) {
  if (!value) return '-';
  // Aceita já formatado como DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  // Extrai YYYY-MM-DD de strings ISO
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return String(value).slice(0, 10);
}

function sanitizeError(msg) {
  return String(msg || 'Erro ao realizar a busca.')
    .replace(/datajud/gi, 'sistema')
    .replace(/api_publica_\w+/gi, 'tribunal selecionado');
}

export default function ProspeccaoPage() {
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [aliases, setAliases] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [history, setHistory] = useState([]);

  const [tribunalAlias, setTribunalAlias] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [size, setSize] = useState(15);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadMeta() {
      try {
        const [providerData, specialtyData, historyData] = await Promise.all([
          getExternalProvidersStatus(),
          getProspectingSpecialties(),
          getProspectingHistory(),
        ]);

        if (!active) return;

        const activeProvider = providerData?.provider || '';
        const providerConfig = providerData?.providers?.find((p) => p.id === activeProvider);
        const aliasList = Array.isArray(providerConfig?.aliases) ? providerConfig.aliases : [];
        setAliases(aliasList);
        if (aliasList.length > 0) setTribunalAlias(aliasList[0]);

        setSpecialties(Array.isArray(specialtyData) ? specialtyData : []);
        if (Array.isArray(specialtyData) && specialtyData.length > 0) {
          setSpecialty(specialtyData[0].key);
        }

        setHistory(Array.isArray(historyData) ? historyData : []);
      } catch {
        // silencioso
      } finally {
        if (active) setLoadingMeta(false);
      }
    }

    loadMeta();
    return () => { active = false; };
  }, []);

  async function handleSearch() {
    setError('');
    setResult(null);

    if (!tribunalAlias) {
      setError('Selecione um tribunal.');
      return;
    }
    if (!specialty) {
      setError('Selecione uma área jurídica.');
      return;
    }

    setRunning(true);
    try {
      const data = await searchProspectingOpportunities({ tribunalAlias, specialty, size });
      setResult(data);
      // Recarrega histórico
      const h = await getProspectingHistory();
      setHistory(Array.isArray(h) ? h : []);
    } catch (err) {
      setError(sanitizeError(err?.message));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Target className="h-3.5 w-3.5" strokeWidth={2.3} />
          Inteligência de mercado jurídico
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Prospecção de Oportunidades</h1>
        <p className="text-surface-400 text-lg">
          Identifique demandas processuais recentes e oportunidades de captação na sua área de atuação.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Painel de busca */}
        <section className="xl:col-span-1 rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-surface-900 mb-5 flex items-center gap-2">
            <Search className="h-5 w-5 text-brand-500" strokeWidth={2.2} />
            Configurar Busca
          </h2>

          {loadingMeta ? (
            <div className="inline-flex items-center gap-2 text-surface-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Carregando...
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">
                  Tribunal
                </label>
                <select
                  className="input-field w-full"
                  value={tribunalAlias}
                  onChange={(e) => setTribunalAlias(e.target.value)}
                >
                  <option value="">Selecionar tribunal</option>
                  {aliases.map((alias) => (
                    <option key={alias} value={alias}>{prettyAlias(alias)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">
                  Área Jurídica
                </label>
                <select
                  className="input-field w-full"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                >
                  <option value="">Selecionar área</option>
                  {specialties.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">
                  Quantidade de processos
                </label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value || 15))}
                  min={5}
                  max={50}
                />
              </div>

              <button
                className="btn-primary w-full inline-flex items-center justify-center gap-2"
                disabled={running}
                onClick={handleSearch}
              >
                {running
                  ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                  : <Sparkles className="h-4 w-4" strokeWidth={2.2} />}
                {running ? 'Buscando...' : 'Buscar Oportunidades'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 inline-flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          )}

          {/* Histórico */}
          {history.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" strokeWidth={2.2} />
                Buscas recentes
              </h3>
              <div className="space-y-2">
                {history.slice(0, 5).map((h) => (
                  <div key={h.id} className="rounded-xl border border-surface-100 bg-surface-50 px-3 py-2">
                    <p className="text-xs font-semibold text-surface-800">
                      {String(h.specialty || '').charAt(0).toUpperCase() + String(h.specialty || '').slice(1)} — {prettyAlias(h.tribunal_alias)}
                    </p>
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      {h.total_found} processo(s) · {formatDate(h.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Resultados */}
        <section className="xl:col-span-2 space-y-6">
          {result ? (
            <>
              {/* Resumo IA */}
              <div className="rounded-3xl border border-brand-200/60 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-9 w-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl text-surface-900">Análise de Oportunidades</h2>
                    <p className="text-sm text-surface-400 mt-0.5">
                      {result.specialty} · {prettyAlias(result.tribunalAlias)} · {result.filteredCount ?? result.opportunities?.length ?? 0} oportunidade(s) de {result.totalFound} processo(s)
                    </p>
                  </div>
                </div>

                {(result.filteredCount ?? 0) > 0 && (
                  <div className="inline-flex items-center gap-1.5 mb-4 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                    {result.filteredCount} oportunidade(s) identificada(s)
                  </div>
                )}

                <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">
                  {result.aiSummary}
                </p>
              </div>

              {/* Lista de processos */}
              {result.opportunities && result.opportunities.length > 0 && (
                <div className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
                  <h2 className="font-display text-xl text-surface-900 mb-4">
                    Oportunidades Identificadas
                    <span className="ml-2 text-sm font-normal text-surface-400">({result.opportunities.length})</span>
                  </h2>

                  <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
                    {result.opportunities.map((opp, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-surface-100 bg-surface-50 px-4 py-3 hover:border-brand-200 hover:bg-brand-50/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-mono text-surface-500 mb-1">
                              {opp.numeroProcesso || 'Número não disponível'}
                            </p>
                            <p className="text-sm font-semibold text-surface-800">
                              {opp.classe || 'Classe não informada'}
                            </p>
                            {opp.assuntos && opp.assuntos.length > 0 && (
                              <p className="text-xs text-surface-500 mt-0.5 truncate">
                                {opp.assuntos.join(' · ')}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            {opp.opportunityScore != null && (
                              <span className={[
                                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                                opp.opportunityScore >= 8 ? 'bg-emerald-100 text-emerald-700' :
                                opp.opportunityScore >= 6 ? 'bg-brand-100 text-brand-700' :
                                'bg-surface-100 text-surface-500',
                              ].join(' ')}>
                                {opp.opportunityScore}/10
                              </span>
                            )}
                            <p className="text-[11px] text-surface-400">{opp.grau || ''}</p>
                            <p className="text-[11px] text-surface-400">{formatDate(opp.dataAjuizamento)}</p>
                          </div>
                        </div>
                        {opp.orgaoJulgador && (
                          <p className="text-[11px] text-surface-400 mt-1.5 border-t border-surface-100 pt-1.5">
                            {opp.orgaoJulgador}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50/50 p-12 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-brand-400" strokeWidth={2} />
              </div>
              <p className="text-surface-700 font-semibold mb-1">Nenhuma busca realizada ainda</p>
              <p className="text-surface-400 text-sm max-w-xs">
                Selecione o tribunal e a área jurídica para identificar oportunidades de prospecção de clientes.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
