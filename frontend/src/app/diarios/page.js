'use client';
import { useState, useEffect } from 'react';
import { getMonitors, createMonitor, searchDiario, getUser } from '@/lib/api';

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
        keywords: monitorForm.keywords.split(',').map((k) => k.trim()).filter(Boolean),
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

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-surface-900 mb-1">Diários Oficiais</h1>
        <p className="text-surface-300">Monitore e pesquise publicações no DOU, DOE e DOM</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface-100 rounded-xl p-1 w-fit">
        {[
          { id: 'search', label: '🔍 Pesquisar' },
          { id: 'monitors', label: '📡 Monitores' },
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

      {/* Search Tab */}
      {tab === 'search' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">Buscar no Diário Oficial</h3>
            <form onSubmit={handleSearch} className="space-y-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                placeholder="Digite uma palavra-chave, nome, CNPJ..."
                required
              />
              <button type="submit" disabled={searching} className="btn-primary w-full">
                {searching ? '🔍 Buscando...' : '🔍 Buscar no DOU'}
              </button>
            </form>
          </div>

          <div className="card p-6 max-h-[600px] overflow-y-auto">
            <h3 className="font-semibold text-surface-900 mb-4">Resultados</h3>
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
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">
                {searchResults.error}
              </div>
            ) : searchResults?.results?.length > 0 ? (
              <div className="space-y-3">
                {searchResults.results.map((r, i) => (
                  <div key={i} className="p-4 rounded-xl bg-surface-50 border border-surface-100">
                    <p className="font-medium text-surface-900 text-sm">{r.title || r.titulo}</p>
                    <p className="text-xs text-surface-300 mt-1 line-clamp-3">{r.excerpt || r.resumo}</p>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline mt-2 block">
                        Ver publicação →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : searchResults ? (
              <div className="text-center text-surface-300 py-8">
                <p>Nenhum resultado encontrado</p>
              </div>
            ) : (
              <div className="text-center text-surface-300 py-12">
                <span className="text-4xl block mb-3">🔍</span>
                <p>Digite uma palavra-chave para buscar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monitors Tab */}
      {tab === 'monitors' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create monitor */}
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">Novo monitor</h3>
            <form onSubmit={handleCreateMonitor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-800 mb-2">Palavras-chave</label>
                <input
                  type="text"
                  value={monitorForm.keywords}
                  onChange={(e) => setMonitorForm((p) => ({ ...p, keywords: e.target.value }))}
                  className="input-field"
                  placeholder="empresa, cnpj, nome (separar por vírgula)"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-800 mb-2">Diário</label>
                <select
                  value={monitorForm.diarioType}
                  onChange={(e) => setMonitorForm((p) => ({ ...p, diarioType: e.target.value }))}
                  className="input-field"
                >
                  <option value="DOU">DOU - Diário Oficial da União</option>
                  <option value="DOE">DOE - Diário Oficial do Estado</option>
                  <option value="DOM">DOM - Diário Oficial do Município</option>
                </select>
              </div>
              <button type="submit" disabled={creating} className="btn-primary w-full">
                {creating ? 'Criando...' : '📡 Criar monitor'}
              </button>
            </form>
            <p className="text-xs text-surface-300 mt-4">
              O monitor verifica automaticamente de seg-sex às 7h e envia alertas por WhatsApp.
            </p>
          </div>

          {/* List monitors */}
          <div className="lg:col-span-2 card">
            <div className="p-5 border-b border-surface-100">
              <h3 className="font-semibold text-surface-900">Seus monitores</h3>
            </div>
            {loading ? (
              <div className="p-8 text-center text-surface-300">Carregando...</div>
            ) : monitors.length === 0 ? (
              <div className="p-12 text-center text-surface-300">
                <span className="text-4xl block mb-3">📡</span>
                <p>Nenhum monitor configurado</p>
                <p className="text-xs mt-2">Crie um ao lado para receber alertas automáticos</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-100">
                {monitors.map((m) => (
                  <div key={m.id} className="p-5 hover:bg-surface-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${m.active ? 'bg-green-500' : 'bg-surface-300'}`} />
                          <p className="font-semibold text-surface-900 text-sm">{m.diario_type}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(m.keywords || []).map((kw, i) => (
                            <span key={i} className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full text-xs font-medium">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-surface-300">
                        {new Date(m.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
