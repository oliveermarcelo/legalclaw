'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { getChatModels, getWorkflowModes, runWorkflow } from '@/lib/api';

const MODE_HINTS = {
  manifestacao_processual: 'Ex: Impugnacao a contestacao com foco em preliminar de incompetencia e pedido subsidiario.',
  criacao_peca: 'Ex: Minuta de peticao inicial de obrigacao de fazer com tutela de urgencia.',
  pesquisa_juridica: 'Ex: Pesquisa sobre responsabilidade civil por negativacao indevida em contrato bancario.',
  parecer_juridico: 'Ex: Parecer sobre viabilidade de rescisao unilateral e danos emergentes.',
  analise_caso: 'Ex: Analise estrategica de caso trabalhista com risco de reconhecimento de vinculo.',
  fundamentacao: 'Ex: Fundamentar pedido de tutela de urgencia em revisional de contrato.',
  revisao_texto: 'Ex: Revisar minuta de embargos de declaracao para clareza e coerencia.',
};

export default function FluxosPage() {
  const [modes, setModes] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [result, setResult] = useState(null);

  const [model, setModel] = useState('');
  const [modelOptions, setModelOptions] = useState([]);
  const [provider, setProvider] = useState('');

  const [form, setForm] = useState({
    mode: '',
    objective: '',
    context: '',
    documentText: '',
    audience: '',
    desiredOutput: '',
  });

  useEffect(() => {
    let active = true;

    async function loadMeta() {
      try {
        const [loadedModes, loadedModels] = await Promise.all([
          getWorkflowModes(),
          getChatModels(),
        ]);

        if (!active) return;

        const safeModes = Array.isArray(loadedModes) ? loadedModes : [];
        const firstMode = safeModes[0]?.id || '';
        setModes(safeModes);
        setForm((prev) => ({ ...prev, mode: prev.mode || firstMode }));

        const options = Array.isArray(loadedModels?.models) ? loadedModels.models : [];
        setProvider(loadedModels?.provider || '');
        setModelOptions(options);
        setModel(loadedModels?.defaultModel || options[0] || '');
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Erro ao carregar metadados dos fluxos');
      } finally {
        if (active) setLoadingMeta(false);
      }
    }

    loadMeta();
    return () => {
      active = false;
    };
  }, []);

  const selectedMode = useMemo(
    () => modes.find((item) => item.id === form.mode) || null,
    [modes, form.mode]
  );

  async function handleRun(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setResult(null);

    if (!form.mode) {
      setError('Selecione um modo de fluxo.');
      return;
    }

    if (!form.objective.trim() && !form.documentText.trim()) {
      setError('Informe objetivo ou documento base.');
      return;
    }

    setRunning(true);
    try {
      const data = await runWorkflow({
        mode: form.mode,
        objective: form.objective.trim(),
        context: form.context.trim(),
        documentText: form.documentText.trim(),
        audience: form.audience.trim(),
        desiredOutput: form.desiredOutput.trim(),
        model,
      });

      setResult(data);
      setSuccess('Fluxo executado com sucesso.');
    } catch (err) {
      setError(err?.message || 'Erro ao executar fluxo juridico');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Fluxos juridicos especializados
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Fluxos Juridicos</h1>
        <p className="text-surface-400 text-lg">
          Transforme tarefas recorrentes em respostas estruturadas com controle de modelo.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-surface-900 mb-1">Executar fluxo</h2>
          <p className="text-sm text-surface-400 mb-5">
            Escolha o modo, descreva o objetivo e opcionalmente inclua o texto base.
          </p>

          {loadingMeta ? (
            <div className="inline-flex items-center gap-2 text-surface-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Carregando configuracoes...
            </div>
          ) : (
            <form onSubmit={handleRun} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <select
                  className="input-field"
                  value={form.mode}
                  onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value }))}
                  required
                >
                  {modes.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>

                <select
                  className="input-field"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  disabled={modelOptions.length === 0}
                >
                  {modelOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <textarea
                className="input-field min-h-[110px] resize-y text-sm leading-relaxed"
                value={form.objective}
                onChange={(e) => setForm((prev) => ({ ...prev, objective: e.target.value }))}
                placeholder={MODE_HINTS[form.mode] || 'Descreva objetivo e resultado esperado'}
              />

              <textarea
                className="input-field min-h-[110px] resize-y text-sm leading-relaxed"
                value={form.context}
                onChange={(e) => setForm((prev) => ({ ...prev, context: e.target.value }))}
                placeholder="Contexto do caso (partes, fase processual, pontos sensiveis)"
              />

              <textarea
                className="input-field min-h-[150px] resize-y text-sm leading-relaxed"
                value={form.documentText}
                onChange={(e) => setForm((prev) => ({ ...prev, documentText: e.target.value }))}
                placeholder="Documento base (peticao, contrato, rascunho, trecho de caso)"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="input-field"
                  value={form.audience}
                  onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
                  placeholder="Publico alvo (juizo, cliente, socio, etc.)"
                />
                <input
                  className="input-field"
                  value={form.desiredOutput}
                  onChange={(e) => setForm((prev) => ({ ...prev, desiredOutput: e.target.value }))}
                  placeholder="Formato desejado (minuta, parecer, lista, etc.)"
                />
              </div>

              <button
                type="submit"
                disabled={running}
                className="btn-primary w-full inline-flex items-center justify-center gap-2"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                    Executando fluxo...
                  </>
                ) : (
                  <>
                    <ClipboardList className="h-4 w-4" strokeWidth={2.2} />
                    Executar fluxo
                  </>
                )}
              </button>
            </form>
          )}

          {provider && (
            <p className="text-xs text-surface-500 mt-4">
              Provider atual: <span className="font-semibold text-surface-700">{provider}</span>
            </p>
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
          <p className="text-sm text-surface-400 mb-5">
            Saida estruturada do modo selecionado.
          </p>

          {!result ? (
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-5 text-sm text-surface-500">
              Execute um fluxo para visualizar o resultado aqui.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-50 text-brand-700 px-2.5 py-1 text-xs font-semibold">
                  Modo: {selectedMode?.label || result.mode}
                </span>
                {result.model && (
                  <span className="rounded-full bg-surface-100 text-surface-700 px-2.5 py-1 text-xs font-semibold">
                    Modelo: {result.model}
                  </span>
                )}
              </div>

              <article className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-surface-800">
                  {result.text || 'Sem resposta'}
                </p>
              </article>

              {Array.isArray(result.sources) && result.sources.length > 0 && (
                <div className="space-y-2">
                  {result.sources.map((source) => (
                    <div key={`${source.id}-${source.title}`} className="rounded-xl border border-surface-200 p-3">
                      <p className="text-xs font-semibold text-surface-800">
                        Fonte {source.id}: {source.title}
                      </p>
                      {source.sourceRef && (
                        <p className="text-[11px] text-surface-500 mt-1">{source.sourceRef}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

