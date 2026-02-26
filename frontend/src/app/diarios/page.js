'use client';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  ExternalLink,
  Loader2,
  Newspaper,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { createMonitor, getMonitors, getUser, searchDiario } from '@/lib/api';

const TABS = [
  { id: 'search', label: 'Pesquisar', icon: Search },
  { id: 'monitors', label: 'Monitores', icon: BellRing },
];

export default function DiariosPage() {
  const [tab, setTab] = useState('search');
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [monitorForm, setMonitorForm] = useState({
    keywords: '',
    diarioType: 'DOU',
  });

  useEffect(() => {
    getMonitors()
      .then(setMonitors)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);

    try {
      const data = await searchDiario({ query: searchQuery });
      setSearchResults(data);
    } catch (err) {
      setSearchResults({ error: err.message });
    } finally {
      setSearching(false);
    }
  }

  async function handleCreateMonitor(e) {
    e.preventDefault();
    if (!monitorForm.keywords.trim()) return;
    setCreating(true);

    try {
      const user = getUser();
      await createMonitor({
        userId: user.id,
        keywords: monitorForm.keywords
          .split(',')
          .map((keyword) => keyword.trim())
          .filter(Boolean),
        diarioType: monitorForm.diarioType,
      });

      const updated = await getMonitors();
      setMonitors(updated);
      setMonitorForm({ keywords: '', diarioType: 'DOU' });
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  function formatDateSafe(dateValue, fallback = '-') {
    if (!dateValue) return fallback;
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed.toLocaleDateString('pt-BR');
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Inteligencia de diarios oficiais
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Diarios oficiais</h1>
        <p className="text-surface-400 text-lg">
          Pesquise publicacoes e receba alertas automaticos para termos estrategicos.
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

      {tab === 'search' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Buscar no diario</h3>
            <p className="text-sm text-surface-400 mb-5">
              Consulte publicacoes por palavra-chave, nome, empresa ou CNPJ.
            </p>

            <form onSubmit={handleSearch} className="space-y-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                placeholder="Digite termo de busca"
                required
              />
              <button type="submit" disabled={searching} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                {searching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" strokeWidth={2.2} />
                    Buscar no DOU
                  </>
                )}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm max-h-[680px] overflow-y-auto">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Resultados</h3>
            <p className="text-sm text-surface-400 mb-5">Visualize rapidamente as ocorrencias encontradas.</p>

            {searching ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-surface-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-surface-100 rounded w-full" />
                  </div>
                ))}
              </div>
            ) : searchResults?.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm inline-flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
                <span>{searchResults.error}</span>
              </div>
            ) : searchResults?.results?.length > 0 ? (
              <div className="space-y-3">
                {searchResults.results.map((result, i) => (
                  <article key={i} className="rounded-2xl border border-surface-200/80 bg-surface-50/70 p-4">
                    <p className="font-semibold text-surface-900 text-sm">{result.title || result.titulo || 'Publicacao'}</p>
                    <p className="text-xs text-surface-500 mt-1 line-clamp-3">{result.excerpt || result.resumo || '-'}</p>

                    {result.url && (
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                      >
                        Abrir publicacao
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ) : searchResults ? (
              <div className="py-12 text-center text-surface-500">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-surface-100 text-surface-600 flex items-center justify-center">
                  <Search className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <p className="font-medium text-surface-700">Nenhum resultado encontrado</p>
              </div>
            ) : (
              <div className="py-12 text-center text-surface-500">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
                  <Newspaper className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <p className="font-medium text-surface-700">Nenhuma busca executada</p>
                <p className="text-sm mt-1">Digite um termo para iniciar a pesquisa.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'monitors' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Novo monitor</h3>
            <p className="text-sm text-surface-400 mb-5">
              Configure termos para receber alertas automaticos por publicacao.
            </p>

            <form onSubmit={handleCreateMonitor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-800 mb-2">Palavras-chave</label>
                <input
                  type="text"
                  value={monitorForm.keywords}
                  onChange={(e) => setMonitorForm((prev) => ({ ...prev, keywords: e.target.value }))}
                  className="input-field"
                  placeholder="empresa, cnpj, nome"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-800 mb-2">Diario</label>
                <select
                  value={monitorForm.diarioType}
                  onChange={(e) => setMonitorForm((prev) => ({ ...prev, diarioType: e.target.value }))}
                  className="input-field"
                >
                  <option value="DOU">DOU - Diario Oficial da Uniao</option>
                  <option value="DOE">DOE - Diario Oficial do Estado</option>
                  <option value="DOM">DOM - Diario Oficial do Municipio</option>
                </select>
              </div>

              <button type="submit" disabled={creating} className="btn-primary w-full inline-flex items-center justify-center gap-2">
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                    Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" strokeWidth={2.2} />
                    Criar monitor
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-surface-400 mt-4">
              Verificacao automatica em dias uteis com envio de alertas no WhatsApp.
            </p>
          </section>

          <section className="xl:col-span-2 rounded-3xl border border-surface-200/80 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-surface-200/80 px-6 py-4">
              <h3 className="font-display text-2xl text-surface-900">Seus monitores</h3>
              <p className="text-sm text-surface-400 mt-1">Acompanhe status e termos configurados.</p>
            </div>

            {loading ? (
              <div className="p-8 text-center text-surface-400 inline-flex items-center justify-center gap-2 w-full">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                Carregando monitores...
              </div>
            ) : monitors.length === 0 ? (
              <div className="p-12 text-center text-surface-500">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-surface-100 text-surface-600 flex items-center justify-center">
                  <BellRing className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <p className="font-medium text-surface-700">Nenhum monitor configurado</p>
                <p className="text-sm mt-1">Crie seu primeiro monitor para iniciar os alertas.</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-100">
                {monitors.map((monitor) => (
                  <div key={monitor.id} className="px-6 py-5 hover:bg-surface-50/80 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${monitor.active ? 'bg-emerald-500' : 'bg-surface-300'}`}
                          />
                          <p className="font-semibold text-surface-900 text-sm">{monitor.diario_type || '-'}</p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(monitor.keywords || []).map((keyword, i) => (
                            <span key={`${keyword}-${i}`} className="rounded-full bg-brand-50 text-brand-700 px-2 py-0.5 text-xs font-medium">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>

                      <span className="text-xs text-surface-400 whitespace-nowrap">
                        {formatDateSafe(monitor.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
