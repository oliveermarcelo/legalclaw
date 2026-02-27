'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  getExternalProcessRefreshStatus,
  getExternalProvidersStatus,
  requestExternalProcessRefresh,
  searchExternalProcessByCnj,
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
  const [includeInvolved, setIncludeInvolved] = useState(false);
  const [includePublicDocuments, setIncludePublicDocuments] = useState(false);
  const [autos, setAutos] = useState(true);
  const [useCertificate, setUseCertificate] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadMeta() {
      try {
        const data = await getExternalProvidersStatus();
        if (!active) return;
        setProviderStatus(data);
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

  async function runAction(action) {
    setError('');
    setSuccess('');
    setResult(null);

    if (!cnj.trim()) {
      setError('Informe o numero CNJ.');
      return;
    }

    setRunning(true);
    try {
      if (action === 'search') {
        const data = await searchExternalProcessByCnj({
          numeroCnj: cnj.trim(),
          includeInvolved,
          includePublicDocuments,
        });
        setResult(data);
        setSuccess('Consulta do processo realizada com sucesso.');
      }

      if (action === 'refresh') {
        const data = await requestExternalProcessRefresh({
          numeroCnj: cnj.trim(),
          autos,
          useCertificate,
        });
        setResult(data);
        setSuccess('Solicitacao de atualizacao enviada.');
      }

      if (action === 'status') {
        const data = await getExternalProcessRefreshStatus({ numeroCnj: cnj.trim() });
        setResult(data);
        setSuccess('Status de atualizacao consultado.');
      }
    } catch (err) {
      setError(err?.message || 'Erro na consulta externa');
    } finally {
      setRunning(false);
    }
  }

  const activeProvider = providerStatus?.provider || '-';
  const providerConfigured = providerStatus?.providers?.find((p) => p.id === activeProvider)?.configured;

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Integracao com sistemas juridicos externos
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Consultas Externas</h1>
        <p className="text-surface-400 text-lg">
          Consulte processo por CNJ, solicite atualizacao e acompanhe status em base externa.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-surface-900 mb-1">Consulta de processo</h2>
          <p className="text-sm text-surface-400 mb-5">
            Provider ativo: <span className="font-semibold text-surface-700">{activeProvider}</span>
            {' | '}
            Configurado: <span className="font-semibold text-surface-700">{providerConfigured ? 'sim' : 'nao'}</span>
          </p>

          {loadingMeta ? (
            <div className="inline-flex items-center gap-2 text-surface-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Carregando status...
            </div>
          ) : (
            <div className="space-y-4">
              <input
                className="input-field"
                value={cnj}
                onChange={(e) => setCnj(e.target.value)}
                placeholder="Numero CNJ (ex: 0000000-00.0000.0.00.0000)"
              />

              <label className="flex items-center gap-2 text-sm text-surface-700">
                <input type="checkbox" checked={includeInvolved} onChange={(e) => setIncludeInvolved(e.target.checked)} />
                Incluir envolvidos
              </label>
              <label className="flex items-center gap-2 text-sm text-surface-700">
                <input type="checkbox" checked={includePublicDocuments} onChange={(e) => setIncludePublicDocuments(e.target.checked)} />
                Incluir documentos publicos
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  className="btn-primary inline-flex items-center justify-center gap-2"
                  disabled={running}
                  onClick={() => runAction('search')}
                >
                  {running ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} /> : <Search className="h-4 w-4" strokeWidth={2.2} />}
                  Consultar
                </button>

                <button
                  className="btn-secondary inline-flex items-center justify-center gap-2"
                  disabled={running}
                  onClick={() => runAction('refresh')}
                >
                  <RefreshCcw className="h-4 w-4" strokeWidth={2.2} />
                  Solicitar atualizacao
                </button>

                <button
                  className="btn-secondary inline-flex items-center justify-center gap-2"
                  disabled={running}
                  onClick={() => runAction('status')}
                >
                  <Search className="h-4 w-4" strokeWidth={2.2} />
                  Ver status
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-surface-700">
                  <input type="checkbox" checked={autos} onChange={(e) => setAutos(e.target.checked)} />
                  Atualizar autos
                </label>
                <label className="flex items-center gap-2 text-sm text-surface-700">
                  <input type="checkbox" checked={useCertificate} onChange={(e) => setUseCertificate(e.target.checked)} />
                  Usar certificado digital
                </label>
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
          <p className="text-sm text-surface-400 mb-5">Resposta bruta da integracao externa.</p>

          <pre className="rounded-2xl border border-surface-200 bg-surface-50 p-4 text-xs leading-relaxed text-surface-800 overflow-auto max-h-[70vh] whitespace-pre-wrap break-all">
            {result ? prettyJson(result) : 'Sem resultado ainda.'}
          </pre>
        </section>
      </div>
    </div>
  );
}

