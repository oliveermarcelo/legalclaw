'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  createKnowledgeSource,
  listKnowledgeSources,
  searchKnowledge,
  setKnowledgeSourceActive,
} from '@/lib/api';

function formatDateSafe(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
}

function getSourceTypeLabel(type) {
  const map = {
    manual: 'Manual',
    contract: 'Contrato',
    law: 'Legislacao',
    jurisprudence: 'Jurisprudencia',
    note: 'Anotacao',
  };
  return map[String(type || '').toLowerCase()] || type || 'Manual';
}

export default function ConhecimentoPage() {
  const [sources, setSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchError, setSearchError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingSourceId, setUpdatingSourceId] = useState(null);

  const [form, setForm] = useState({
    title: '',
    sourceType: 'manual',
    sourceRef: '',
    content: '',
  });

  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const data = await listKnowledgeSources(100);
      setSources(Array.isArray(data) ? data : []);
    } catch (err) {
      setFormError(err.message || 'Erro ao carregar fontes');
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  async function handleCreateSource(event) {
    event.preventDefault();
    setFormError('');
    setFeedback(null);

    if (!form.title.trim()) {
      setFormError('Informe o titulo da fonte.');
      return;
    }

    if (form.content.trim().length < 120) {
      setFormError('O conteudo precisa ter no minimo 120 caracteres.');
      return;
    }

    setSaving(true);
    try {
      const created = await createKnowledgeSource({
        title: form.title.trim(),
        sourceType: form.sourceType,
        sourceRef: form.sourceRef.trim() || null,
        content: form.content.trim(),
        metadata: {},
      });

      setFeedback(created);
      setForm((prev) => ({
        ...prev,
        title: '',
        sourceRef: '',
        content: '',
      }));

      await loadSources();
    } catch (err) {
      setFormError(err.message || 'Erro ao salvar fonte');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSource(source) {
    setUpdatingSourceId(source.id);
    try {
      const updated = await setKnowledgeSourceActive(source.id, !source.active);
      setSources((prev) => prev.map((item) => (item.id === source.id ? updated : item)));
    } catch (err) {
      setFormError(err.message || 'Erro ao atualizar fonte');
    } finally {
      setUpdatingSourceId(null);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();
    setSearchError('');
    setSearchResults([]);

    if (searchQuery.trim().length < 3) {
      setSearchError('Digite pelo menos 3 caracteres para buscar.');
      return;
    }

    setSearching(true);
    try {
      const data = await searchKnowledge(searchQuery.trim(), 8);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setSearchError(err.message || 'Erro ao buscar na base');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Base de conhecimento RAG
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Conhecimento</h1>
        <p className="text-surface-400 text-lg">
          Centralize leis, modelos e notas internas para respostas com contexto real.
        </p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-surface-900 mb-1">Nova fonte</h2>
          <p className="text-sm text-surface-400 mb-5">
            Cadastre conteudo para indexacao e uso pelo chat juridico.
          </p>

          <form onSubmit={handleCreateSource} className="space-y-4">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="input-field"
              placeholder="Titulo da fonte"
              required
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                value={form.sourceType}
                onChange={(e) => setForm((prev) => ({ ...prev, sourceType: e.target.value }))}
                className="input-field"
              >
                <option value="manual">Manual</option>
                <option value="law">Legislacao</option>
                <option value="jurisprudence">Jurisprudencia</option>
                <option value="contract">Contrato</option>
                <option value="note">Anotacao interna</option>
              </select>

              <input
                type="text"
                value={form.sourceRef}
                onChange={(e) => setForm((prev) => ({ ...prev, sourceRef: e.target.value }))}
                className="input-field"
                placeholder="Referencia (URL, numero da lei, etc.)"
              />
            </div>

            <textarea
              value={form.content}
              onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
              className="input-field min-h-[220px] resize-y text-sm leading-relaxed"
              placeholder="Cole o conteudo que deve ser indexado na base..."
              required
            />

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                  Indexando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" strokeWidth={2.2} />
                  Salvar fonte
                </>
              )}
            </button>
          </form>

          {formError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 inline-flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>{formError}</span>
            </div>
          )}

          {feedback && (
            <div
              className={`mt-4 rounded-2xl px-4 py-3 text-sm inline-flex items-start gap-2 border ${
                feedback.duplicated
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {feedback.duplicated ? (
                <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              ) : (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              )}
              <span>
                {feedback.duplicated
                  ? 'Fonte ja existente. Reutilizando indexacao anterior.'
                  : `Fonte salva com sucesso (${feedback.chunkCount || 0} blocos indexados).`}
              </span>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-surface-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-surface-200/80 px-6 py-4">
            <h2 className="font-display text-2xl text-surface-900">Fontes cadastradas</h2>
            <p className="text-sm text-surface-400 mt-1">Ative apenas o que deve influenciar respostas do chat.</p>
          </div>

          {loadingSources ? (
            <div className="p-8 text-center text-surface-400 inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Carregando fontes...
            </div>
          ) : sources.length === 0 ? (
            <div className="p-12 text-center text-surface-500">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-surface-100 text-surface-600 flex items-center justify-center">
                <FileText className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <p className="font-medium text-surface-700">Nenhuma fonte cadastrada</p>
              <p className="text-sm mt-1">Adicione a primeira fonte para habilitar o contexto RAG.</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-100 max-h-[560px] overflow-y-auto">
              {sources.map((source) => (
                <article key={source.id} className="px-6 py-4 hover:bg-surface-50/80 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-900">{source.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-xs font-medium">
                          {getSourceTypeLabel(source.sourceType)}
                        </span>
                        <span className="text-xs text-surface-400">
                          {source.chunkCount || 0} blocos
                        </span>
                        <span className="text-xs text-surface-400">
                          {formatDateSafe(source.createdAt)}
                        </span>
                      </div>

                      {source.sourceRef && (
                        <p className="mt-1 text-xs text-surface-500 inline-flex items-center gap-1">
                          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.2} />
                          <span className="truncate">{source.sourceRef}</span>
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleToggleSource(source)}
                      disabled={updatingSourceId === source.id}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold border transition-colors',
                        source.active
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-surface-200 bg-surface-100 text-surface-600 hover:bg-surface-200',
                      ].join(' ')}
                    >
                      {updatingSourceId === source.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.2} />
                      ) : source.active ? (
                        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2.2} />
                      )}
                      {source.active ? 'Ativa' : 'Inativa'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
        <h2 className="font-display text-2xl text-surface-900 mb-1">Busca semantica</h2>
        <p className="text-sm text-surface-400 mb-5">
          Teste rapidamente o que a base atual retorna para perguntas reais.
        </p>

        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field flex-1"
            placeholder="Ex: prazo para embargos de declaracao no CPC"
          />
          <button
            type="submit"
            disabled={searching}
            className="btn-primary inline-flex items-center justify-center gap-2 md:min-w-[180px]"
          >
            {searching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                Buscando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" strokeWidth={2.2} />
                Buscar na base
              </>
            )}
          </button>
        </form>

        {searchError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 inline-flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
            <span>{searchError}</span>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mt-5 space-y-3">
            {searchResults.map((result, index) => (
              <article key={`${result.sourceId}-${index}`} className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-xs font-medium">
                    Fonte {index + 1}
                  </span>
                  <p className="text-sm font-semibold text-surface-900">{result.title}</p>
                </div>
                <p className="text-xs text-surface-500 mt-2 leading-relaxed">{result.excerpt}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
