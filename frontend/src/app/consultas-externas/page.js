'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  getExternalProvidersStatus,
  searchExternalProcessByCnj,
  searchExternalProcesses,
} from '@/lib/api';

function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value || '');
  }
}

export default function ConsultasExternasPage() {
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [providerStatus, setProviderStatus] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const [cnj, setCnj] = useState('');
  const [tribunalAlias, setTribunalAlias] = useState('');
  const [termoLivre, setTermoLivre] = useState('');
  const [classeCodigo, setClasseCodigo] = useState('');
  const [orgaoJulgadorCodigo, setOrgaoJulgadorCodigo] = useState('');
  const [assuntoCodigo, setAssuntoCodigo] = useState('');
  const [size, setSize] = useState(10);

  useEffect(() => {
    let active = true;

    async function loadMeta() {
      try {
        const data = await getExternalProvidersStatus();
        if (!active) return;
        setProviderStatus(data);

        const currentProvider = data?.provider;
        const providerConfig = data?.providers?.find((item) => item.id === currentProvider);
        const firstAlias = providerConfig?.aliases?.[0] || '';
        setTribunalAlias(firstAlias);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Erro ao carregar status das integracoes externas');
      } finally {
        if (active) setLoadingMeta(false);
      }
    }

    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  const activeProvider = providerStatus?.provider || '-';
  const providerConfig = useMemo(
    () => providerStatus?.providers?.find((item) => item.id === activeProvider) || null,
    [providerStatus, activeProvider]
  );
  const aliases = Array.isArray(providerConfig?.aliases) ? providerConfig.aliases : [];

  async function handleSearchByCnj() {
    setError('');
    setSuccess('');
    setResult(null);

    if (!cnj.trim()) {
      setError('Informe o numero CNJ.');
      return;
    }

    setRunning(true);
    try {
      const data = await searchExternalProcessByCnj({
        numeroCnj: cnj.trim(),
        tribunalAlias: tribunalAlias.trim() || undefined,
        size,
      });
      setResult(data);
      setSuccess('Consulta por CNJ realizada com sucesso.');
    } catch (err) {
      setError(err?.message || 'Erro na consulta por CNJ');
    } finally {
      setRunning(false);
    }
  }

  async function handleAdvancedSearch() {
    setError('');
    setSuccess('');
    setResult(null);

    if (!tribunalAlias.trim()) {
      setError('Selecione um tribunal (alias) para a busca avancada.');
      return;
    }

    if (!cnj.trim() && !termoLivre.trim() && !classeCodigo.trim() && !orgaoJulgadorCodigo.trim() && !assuntoCodigo.trim()) {
      setError('Informe ao menos um filtro para a busca avancada.');
      return;
    }

    setRunning(true);
    try {
      const data = await searchExternalProcesses({
        tribunalAlias: tribunalAlias.trim(),
        numeroCnj: cnj.trim() || undefined,
        termoLivre: termoLivre.trim() || undefined,
        classeCodigo: classeCodigo.trim() || undefined,
        orgaoJulgadorCodigo: orgaoJulgadorCodigo.trim() || undefined,
        assuntoCodigo: assuntoCodigo.trim() || undefined,
        size,
      });
      setResult(data);
      setSuccess('Busca avancada realizada com sucesso.');
    } catch (err) {
      setError(err?.message || 'Erro na busca avancada');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Integracao com sistemas juridicos externos
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Consultas Externas</h1>
        <p className="text-surface-400 text-lg">
          DataJud/CNJ: busque processos por CNJ e por filtros juridicos.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-surface-900 mb-1">Consulta DataJud</h2>
          <p className="text-sm text-surface-400 mb-5">
            Provider ativo: <span className="font-semibold text-surface-700">{activeProvider}</span>
            {' | '}
            Configurado: <span className="font-semibold text-surface-700">{providerConfig?.configured ? 'sim' : 'nao'}</span>
          </p>

          {loadingMeta ? (
            <div className="inline-flex items-center gap-2 text-surface-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Carregando status...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="input-field"
                  value={cnj}
                  onChange={(e) => setCnj(e.target.value)}
                  placeholder="Numero CNJ"
                />

                <select
                  className="input-field"
                  value={tribunalAlias}
                  onChange={(e) => setTribunalAlias(e.target.value)}
                >
                  <option value="">Selecionar alias</option>
                  {aliases.map((alias) => (
                    <option key={alias} value={alias}>{alias}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="input-field"
                  value={termoLivre}
                  onChange={(e) => setTermoLivre(e.target.value)}
                  placeholder="Termo livre (classe, assunto, movimento...)"
                />
                <input
                  type="number"
                  className="input-field"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value || 10))}
                  min={1}
                  max={50}
                  placeholder="Quantidade"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  className="input-field"
                  value={classeCodigo}
                  onChange={(e) => setClasseCodigo(e.target.value)}
                  placeholder="Codigo da classe"
                />
                <input
                  className="input-field"
                  value={orgaoJulgadorCodigo}
                  onChange={(e) => setOrgaoJulgadorCodigo(e.target.value)}
                  placeholder="Codigo do orgao"
                />
                <input
                  className="input-field"
                  value={assuntoCodigo}
                  onChange={(e) => setAssuntoCodigo(e.target.value)}
                  placeholder="Codigo do assunto"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  className="btn-primary inline-flex items-center justify-center gap-2"
                  disabled={running}
                  onClick={handleSearchByCnj}
                >
                  {running ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} /> : <Search className="h-4 w-4" strokeWidth={2.2} />}
                  Buscar por CNJ
                </button>

                <button
                  className="btn-secondary inline-flex items-center justify-center gap-2"
                  disabled={running}
                  onClick={handleAdvancedSearch}
                >
                  <Search className="h-4 w-4" strokeWidth={2.2} />
                  Busca avancada
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 inline-flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 inline-flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>{success}</span>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-surface-900 mb-1">Resultado</h2>
          <p className="text-sm text-surface-400 mb-5">Resposta bruta da API DataJud.</p>

          <pre className="rounded-2xl border border-surface-200 bg-surface-50 p-4 text-xs leading-relaxed text-surface-800 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
            {result ? prettyJson(result) : 'Sem resultado ainda.'}
          </pre>
        </section>
      </div>
    </div>
  );
}

