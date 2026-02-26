'use client';
import { useState, useEffect } from 'react';
import { getDeadlines, createDeadline, calculateDeadline, getCPCDeadlines, getUser } from '@/lib/api';

export default function PrazosPage() {
  const [tab, setTab] = useState('list');
  const [deadlines, setDeadlines] = useState([]);
  const [cpcTypes, setCpcTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [calcResult, setCalcResult] = useState(null);
  const [form, setForm] = useState({
    processNumber: '',
    description: '',
    deadlineType: 'contestacao',
    startDate: new Date().toISOString().split('T')[0],
    dias: 15,
    diasUteis: true,
  });

  useEffect(() => {
    Promise.all([
      getDeadlines().catch(() => []),
      getCPCDeadlines().catch(() => []),
    ]).then(([d, c]) => {
      setDeadlines(d);
      setCpcTypes(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCalculate() {
    setCalcResult(null);
    try {
      const result = await calculateDeadline({
        startDate: form.startDate,
        dias: parseInt(form.dias),
        diasUteis: form.diasUteis,
      });
      setCalcResult(result);
    } catch (err) {
      setCalcResult({ error: err.message });
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const user = getUser();
      await createDeadline({
        userId: user.id,
        processNumber: form.processNumber,
        description: form.description,
        deadlineType: form.deadlineType,
        startDate: form.startDate,
        dias: parseInt(form.dias),
        diasUteis: form.diasUteis,
      });
      const updated = await getDeadlines();
      setDeadlines(updated);
      setTab('list');
      setForm({ processNumber: '', description: '', deadlineType: 'contestacao', startDate: new Date().toISOString().split('T')[0], dias: 15, diasUteis: true });
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  function daysUntil(date) {
    const diff = Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function formatDateSafe(dateValue, options, fallback = 'Data invalida') {
    if (!dateValue) return fallback;
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return parsed.toLocaleDateString('pt-BR', options);
  }

  function urgencyBadge(date) {
    const days = daysUntil(date);
    if (days < 0) return <span className="badge badge-critical">Vencido</span>;
    if (days <= 2) return <span className="badge badge-critical">⚠ {days}d restante{days !== 1 ? 's' : ''}</span>;
    if (days <= 5) return <span className="badge badge-high">{days}d restantes</span>;
    if (days <= 10) return <span className="badge badge-medium">{days}d restantes</span>;
    return <span className="badge badge-low">{days}d restantes</span>;
  }

  const calculatedDate =
    calcResult?.deadlineDate || calcResult?.deadline_date || calcResult?.vencimento || null;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-surface-900 mb-1">Prazos</h1>
          <p className="text-surface-300">Gerencie prazos processuais com cálculo automático CPC</p>
        </div>
        <button onClick={() => setTab(tab === 'create' ? 'list' : 'create')} className="btn-primary">
          {tab === 'create' ? '← Voltar' : '+ Novo prazo'}
        </button>
      </div>

      {/* Create Tab */}
      {tab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">Cadastrar prazo</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-800 mb-2">Nº do processo</label>
                <input type="text" value={form.processNumber} onChange={(e) => update('processNumber', e.target.value)}
                  className="input-field" placeholder="0000000-00.0000.0.00.0000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-800 mb-2">Descrição</label>
                <input type="text" value={form.description} onChange={(e) => update('description', e.target.value)}
                  className="input-field" placeholder="Ex: Contestação - Autor João x Réu Maria" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-800 mb-2">Data de início</label>
                  <input type="date" value={form.startDate} onChange={(e) => update('startDate', e.target.value)}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-800 mb-2">Dias</label>
                  <input type="number" value={form.dias} onChange={(e) => update('dias', e.target.value)}
                    className="input-field" min="1" required />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.diasUteis} onChange={(e) => update('diasUteis', e.target.checked)}
                  className="w-4 h-4 rounded border-surface-300 text-brand-600" />
                <span className="text-sm text-surface-800">Dias úteis (Art. 219 CPC)</span>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={handleCalculate} className="btn-secondary flex-1">
                  🧮 Calcular
                </button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? 'Salvando...' : '💾 Salvar prazo'}
                </button>
              </div>
            </form>
          </div>

          {/* Calc result */}
          <div className="card p-6">
            <h3 className="font-semibold text-surface-900 mb-4">Resultado do cálculo</h3>
            {calcResult?.error ? (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm">{calcResult.error}</div>
            ) : calcResult ? (
              <div className="space-y-4">
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
                  <p className="text-sm text-brand-700 font-medium">Data final do prazo:</p>
                  <p className="text-2xl font-bold text-brand-900 mt-1">
                    {formatDateSafe(
                      calculatedDate,
                      { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
                      calcResult.vencimentoFormatado || 'Data invalida'
                    )}
                  </p>
                </div>
                {calcResult.details && (
                  <div className="text-sm text-surface-800 whitespace-pre-wrap">{calcResult.details}</div>
                )}
              </div>
            ) : (
              <div className="text-center text-surface-300 py-12">
                <span className="text-4xl block mb-3">🧮</span>
                <p>Preencha os dados e clique em &quot;Calcular&quot;</p>
                <p className="text-xs mt-2">Considera dias úteis, feriados nacionais e prorrogação</p>
              </div>
            )}

            {cpcTypes.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-surface-800 mb-3">Prazos comuns CPC:</h4>
                <div className="space-y-2">
                  {cpcTypes.slice(0, 8).map((t, i) => (
                    <button
                      key={i}
                      onClick={() => { update('dias', t.dias); update('description', t.nome); update('diasUteis', t.diasUteis !== false); }}
                      className="w-full text-left p-3 rounded-lg hover:bg-surface-100 transition-colors text-sm"
                    >
                      <span className="font-medium text-surface-900">{t.nome}</span>
                      <span className="text-surface-300 ml-2">— {t.dias} dias {t.diasUteis !== false ? 'úteis' : 'corridos'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* List Tab */}
      {tab === 'list' && (
        <div className="card">
          {loading ? (
            <div className="p-8 text-center text-surface-300">Carregando...</div>
          ) : deadlines.length === 0 ? (
            <div className="p-12 text-center text-surface-300">
              <span className="text-4xl block mb-3">⏰</span>
              <p>Nenhum prazo cadastrado</p>
              <button onClick={() => setTab('create')} className="btn-primary mt-4">
                Cadastrar primeiro prazo
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {deadlines
                .sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date))
                .map((d) => (
                  <div key={d.id} className="p-5 hover:bg-surface-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-surface-900">{d.description}</p>
                        <p className="text-xs text-surface-300 mt-1">
                          {d.process_number && `Processo: ${d.process_number} · `}
                          Vence em {new Date(d.deadline_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      {urgencyBadge(d.deadline_date)}
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
