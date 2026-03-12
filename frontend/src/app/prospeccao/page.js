'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Sparkles,
  Target,
  User,
  X,
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
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return String(value).slice(0, 10);
}

function sanitizeError(msg) {
  return String(msg || 'Erro ao realizar a busca.')
    .replace(/datajud/gi, 'sistema')
    .replace(/api_publica_\w+/gi, 'tribunal selecionado');
}

function renderMarkdown(text) {
  if (!text) return [];
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    );
  });
}

// Retorna: 'sem_advogado' | 'com_advogado' | 'desconhecido'
function statusAdvogado(partes) {
  if (!Array.isArray(partes) || partes.length === 0) return 'desconhecido';
  const temNome = partes.some((p) => p.nome);
  if (!temNome) return 'desconhecido';
  const algumTemAdv = partes.some((p) => Array.isArray(p.advogados) && p.advogados.length > 0);
  if (algumTemAdv) return 'com_advogado';
  return 'sem_advogado';
}

function scoreColor(score) {
  if (score >= 8) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (score >= 6) return 'bg-brand-100 text-brand-700 border-brand-200';
  return 'bg-surface-100 text-surface-500 border-surface-200';
}

function faseLabel(fase) {
  if (fase === 'inicial') return { label: 'Fase inicial', color: 'bg-emerald-50 text-emerald-700' };
  if (fase === 'intermediaria') return { label: 'Em andamento', color: 'bg-brand-50 text-brand-600' };
  if (fase === 'avancada') return { label: 'Fase avançada', color: 'bg-surface-100 text-surface-500' };
  return null;
}

function urgencyLabel(days) {
  if (days == null) return null;
  if (days <= 30) return { label: 'Recente', color: 'text-emerald-600 bg-emerald-50' };
  if (days <= 90) return { label: `${days}d`, color: 'text-brand-600 bg-brand-50' };
  if (days <= 180) return { label: `${days}d`, color: 'text-amber-600 bg-amber-50' };
  return { label: `${days}d`, color: 'text-surface-400 bg-surface-100' };
}

const SPECIALTY_TRIBUNAL_HINTS = {
  trabalhista: { hint: 'Use TRT1–TRT5 ou TST', aliases: ['trt1', 'trt2', 'trt3', 'trt4', 'trt5', 'tst'] },
  previdenciario: { hint: 'Use TRF1–TRF5 (Justiça Federal)', aliases: ['trf1', 'trf2', 'trf3', 'trf4', 'trf5'] },
  tributario: { hint: 'Use TRF1–TRF5 ou TJs estaduais', aliases: ['trf1', 'trf2', 'trf3', 'trf4', 'trf5'] },
  consumidor: { hint: 'Use TJs estaduais (TJBA, TJSP...)', aliases: ['tjba', 'tjsp', 'tjmg', 'tjrj', 'tjrs'] },
  civil: { hint: 'Use TJs estaduais (TJBA, TJSP...)', aliases: ['tjba', 'tjsp', 'tjmg', 'tjrj', 'tjrs'] },
  familia: { hint: 'Use TJs estaduais (TJBA, TJSP...)', aliases: ['tjba', 'tjsp', 'tjmg', 'tjrj', 'tjrs'] },
  criminal: { hint: 'Use TJs estaduais', aliases: ['tjba', 'tjsp', 'tjmg', 'tjrj', 'tjrs'] },
  empresarial: { hint: 'Use TJs estaduais ou TRFs', aliases: ['tjba', 'tjsp', 'tjmg', 'tjrj', 'tjrs'] },
  imobiliario: { hint: 'Use TJs estaduais', aliases: ['tjba', 'tjsp', 'tjmg', 'tjrj', 'tjrs'] },
  ambiental: { hint: 'Use TRFs ou TJs estaduais', aliases: ['trf1', 'trf2', 'trf3', 'trf4', 'trf5'] },
};

function DetailPanel({ opp, onClose }) {
  if (!opp) return null;
  const advStatus = statusAdvogado(opp.partes);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-surface-100 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <p className="text-[11px] font-mono text-surface-400">{opp.numeroProcesso}</p>
            <h3 className="font-semibold text-surface-900 text-base mt-0.5">{opp.classe || 'Classe não informada'}</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-surface-100 flex items-center justify-center shrink-0 mt-0.5">
            <X className="h-4 w-4 text-surface-400" strokeWidth={2.2} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 flex-1">
          {/* Score e urgência */}
          <div className="flex items-center gap-2 flex-wrap">
            {opp.opportunityScore != null && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${scoreColor(opp.opportunityScore)}`}>
                Score {opp.opportunityScore}/10
              </span>
            )}
            {(() => { const u = urgencyLabel(opp.diasDesdeAjuizamento); return u ? (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${u.color}`}>{u.label}</span>
            ) : null; })()}
            {advStatus === 'sem_advogado' && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Sem advogado cadastrado
              </span>
            )}
            {advStatus === 'com_advogado' && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-surface-100 text-surface-500">
                Com advogado
              </span>
            )}
            {advStatus === 'desconhecido' && (
              <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                Representação não informada
              </span>
            )}
            {(() => { const f = faseLabel(opp.faseProcessual); return f ? (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${f.color}`}>{f.label}</span>
            ) : null; })()}
          </div>

          {/* Dados gerais */}
          <div className="rounded-2xl border border-surface-100 bg-surface-50 divide-y divide-surface-100">
            {[
              { label: 'Tribunal', value: opp.tribunal || prettyAlias(opp.tribunalAlias) },
              { label: 'Grau', value: opp.grau },
              { label: 'Órgão Julgador', value: opp.orgaoJulgador },
              { label: 'Ajuizamento', value: opp.dataAjuizamento },
              { label: 'Última atualização', value: opp.dataAtualizacao },
            ].filter((r) => r.value).map((row) => (
              <div key={row.label} className="flex justify-between px-3 py-2 gap-2">
                <span className="text-xs text-surface-400 shrink-0">{row.label}</span>
                <span className="text-xs font-medium text-surface-800 text-right">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Assuntos */}
          {opp.assuntos?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Assuntos</p>
              <div className="flex flex-wrap gap-1.5">
                {opp.assuntos.map((a, i) => (
                  <span key={i} className="text-xs bg-brand-50 text-brand-700 border border-brand-100 rounded-lg px-2 py-0.5">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Partes */}
          {opp.partes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" strokeWidth={2.2} />
                Partes
              </p>
              <div className="space-y-2">
                {opp.partes.map((p, i) => (
                  <div key={i} className="rounded-xl border border-surface-100 bg-surface-50 px-3 py-2">
                    <p className="text-xs font-semibold text-surface-800">{p.nome || 'Nome não disponível'}</p>
                    {p.tipo && <p className="text-[11px] text-surface-400 mt-0.5">{p.tipo}</p>}
                    {p.advogados?.length > 0 && (
                      <p className="text-[11px] text-brand-600 mt-1">Adv: {p.advogados.join(', ')}</p>
                    )}
                    {(!p.advogados || p.advogados.length === 0) && (
                      <p className="text-[11px] text-emerald-600 mt-1 font-semibold">Sem advogado cadastrado</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Movimentos */}
          {opp.movimentos?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Últimos movimentos</p>
              <div className="space-y-1.5">
                {opp.movimentos.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-surface-300 shrink-0 mt-0.5">•</span>
                    <span className="text-surface-600">{m.nome || '-'}</span>
                    {m.data && <span className="text-surface-400 shrink-0 ml-auto">{m.data}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProspeccaoPage() {
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [aliases, setAliases] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [history, setHistory] = useState([]);

  const [tribunalAlias, setTribunalAlias] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [size, setSize] = useState(20);
  const [monthsBack, setMonthsBack] = useState(6);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);

  const tribunalHint = specialty ? SPECIALTY_TRIBUNAL_HINTS[specialty] : null;
  const tribunalMismatch = tribunalHint && tribunalAlias
    ? !tribunalHint.aliases.some((a) => tribunalAlias.includes(a))
    : false;

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
        if (Array.isArray(specialtyData) && specialtyData.length > 0) setSpecialty(specialtyData[0].key);
        setHistory(Array.isArray(historyData) ? historyData : []);
      } catch { /* silencioso */ }
      finally { if (active) setLoadingMeta(false); }
    }
    loadMeta();
    return () => { active = false; };
  }, []);

  async function handleSearch() {
    setError('');
    setResult(null);
    setSelected(null);
    if (!tribunalAlias) { setError('Selecione um tribunal.'); return; }
    if (!specialty) { setError('Selecione uma área jurídica.'); return; }
    setRunning(true);
    try {
      const data = await searchProspectingOpportunities({ tribunalAlias, specialty, size, monthsBack });
      setResult(data);
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
      {selected && <DetailPanel opp={selected} onClose={() => setSelected(null)} />}

      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Target className="h-3.5 w-3.5" strokeWidth={2.3} />
          Inteligência de mercado jurídico
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Prospecção de Oportunidades</h1>
        <p className="text-surface-400 text-lg">
          Identifique processos recentes sem advogado e oportunidades de captação na sua área.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Painel de busca */}
        <section className="xl:col-span-1 rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-xl text-surface-900 mb-5">Configurar Busca</h2>

          {loadingMeta ? (
            <div className="inline-flex items-center gap-2 text-surface-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Carregando...
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">Tribunal</label>
                <select className="input-field w-full" value={tribunalAlias} onChange={(e) => setTribunalAlias(e.target.value)}>
                  <option value="">Selecionar tribunal</option>
                  {aliases.map((alias) => (
                    <option key={alias} value={alias}>{prettyAlias(alias)}</option>
                  ))}
                </select>
                {tribunalHint && (
                  <p className="text-[11px] text-surface-400 mt-1">
                    Recomendado: <span className="font-semibold text-brand-600">{tribunalHint.hint}</span>
                  </p>
                )}
                {tribunalMismatch && (
                  <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={2.2} />
                    <span>Este tribunal pode não ter processos dessa área. {tribunalHint.hint}.</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">Área Jurídica</label>
                <select className="input-field w-full" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                  <option value="">Selecionar área</option>
                  {specialties.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">Resultados</label>
                  <input type="number" className="input-field w-full" value={size}
                    onChange={(e) => setSize(Number(e.target.value || 20))} min={5} max={50} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-500 uppercase tracking-wide mb-1.5">Meses atrás</label>
                  <input type="number" className="input-field w-full" value={monthsBack}
                    onChange={(e) => setMonthsBack(Number(e.target.value || 6))} min={1} max={24} />
                </div>
              </div>

              <button className="btn-primary w-full inline-flex items-center justify-center gap-2" disabled={running} onClick={handleSearch}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} /> : <Sparkles className="h-4 w-4" strokeWidth={2.2} />}
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
                      {h.total_found} oportunidade(s) · {formatDate(h.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Resultados */}
        <section className="xl:col-span-2 space-y-5">
          {result ? (
            <>
              {/* Análise IA */}
              <div className="rounded-3xl border border-brand-200/60 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm">
                <div className="flex items-start gap-3 mb-4">
                  <div className="h-9 w-9 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-brand-600" strokeWidth={2.2} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl text-surface-900">Análise de Oportunidades</h2>
                    <p className="text-sm text-surface-400 mt-0.5">
                      {result.specialty} · {prettyAlias(result.tribunalAlias)} · {result.filteredCount ?? 0} de {result.totalFound} processo(s)
                    </p>
                  </div>
                </div>

                {(result.filteredCount ?? 0) > 0 && (
                  <div className="inline-flex items-center gap-1.5 mb-4 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs text-emerald-700 font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                    {result.filteredCount} oportunidade(s) identificada(s)
                  </div>
                )}

                <div className="text-sm text-surface-700 leading-relaxed">
                  {renderMarkdown(result.aiSummary)}
                </div>
              </div>

              {/* Lista de oportunidades */}
              {result.opportunities?.length > 0 && (
                <div className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
                  <h2 className="font-display text-xl text-surface-900 mb-1">
                    Oportunidades Identificadas
                    <span className="ml-2 text-sm font-normal text-surface-400">({result.opportunities.length})</span>
                  </h2>
                  <p className="text-xs text-surface-400 mb-4">Clique em um processo para ver os detalhes</p>

                  <div className="space-y-2.5 max-h-[62vh] overflow-auto pr-1">
                    {result.opportunities.map((opp, idx) => {
                      const advStatus = statusAdvogado(opp.partes);
                      const urgency = urgencyLabel(opp.diasDesdeAjuizamento);
                      const fase = faseLabel(opp.faseProcessual);
                      return (
                        <button
                          key={idx}
                          onClick={() => setSelected(opp)}
                          className="w-full text-left rounded-2xl border border-surface-100 bg-surface-50 px-4 py-3 hover:border-brand-300 hover:bg-brand-50/30 transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-mono text-surface-400 mb-0.5">{opp.numeroProcesso}</p>
                              <p className="text-sm font-semibold text-surface-800">{opp.classe || 'Classe não informada'}</p>
                              {opp.assuntos?.length > 0 && (
                                <p className="text-xs text-surface-500 mt-0.5 truncate">{opp.assuntos.join(' · ')}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {advStatus === 'sem_advogado' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Sem advogado</span>
                                )}
                                {advStatus === 'desconhecido' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Representação ?</span>
                                )}
                                {fase && (
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${fase.color}`}>{fase.label}</span>
                                )}
                                {urgency && (
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgency.color}`}>{urgency.label}</span>
                                )}
                                {opp.orgaoJulgador && (
                                  <span className="text-[10px] text-surface-400 truncate">{opp.orgaoJulgador}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {opp.opportunityScore != null && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scoreColor(opp.opportunityScore)}`}>
                                  {opp.opportunityScore}/10
                                </span>
                              )}
                              <ChevronRight className="h-4 w-4 text-surface-300 group-hover:text-brand-400 transition-colors" strokeWidth={2} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
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
                Selecione o tribunal e a área jurídica para identificar oportunidades de captação.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
