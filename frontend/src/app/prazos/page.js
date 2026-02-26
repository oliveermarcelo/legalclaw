'use client';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Calculator,
  CheckCircle2,
  Clock3,
  Loader2,
  Plus,
  Save,
  Sparkles,
} from 'lucide-react';
import { calculateDeadline, createDeadline, getCPCDeadlines, getDeadlines, getUser } from '@/lib/api';

function parseDateSafe(dateValue) {
  if (!dateValue) return null;
  let parsed = new Date(dateValue);

  if (Number.isNaN(parsed.getTime()) && typeof dateValue === 'string') {
    const match = dateValue.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
  }

  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatDateSafe(dateValue, options, fallback = 'Data invalida') {
  const parsed = parseDateSafe(dateValue);
  if (!parsed) return fallback;
  return parsed.toLocaleDateString('pt-BR', options);
}

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
    Promise.all([getDeadlines().catch(() => []), getCPCDeadlines().catch(() => [])]).then(([deadlineData, cpcData]) => {
      setDeadlines(deadlineData);
      setCpcTypes(Array.isArray(cpcData) ? cpcData : []);
      setLoading(false);
    });
  }, []);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm({
      processNumber: '',
      description: '',
      deadlineType: 'contestacao',
      startDate: new Date().toISOString().split('T')[0],
      dias: 15,
      diasUteis: true,
    });
  }

  async function handleCalculate() {
    setCalcResult(null);
    try {
      const result = await calculateDeadline({
        startDate: form.startDate,
        dias: parseInt(form.dias, 10),
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
        dias: parseInt(form.dias, 10),
        diasUteis: form.diasUteis,
      });

      const updated = await getDeadlines();
      setDeadlines(updated);
      setTab('list');
      resetForm();
      setCalcResult(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  function daysUntil(date) {
    const parsed = parseDateSafe(date);
    if (!parsed) return Number.NaN;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  }

  function urgencyBadge(date) {
    const days = daysUntil(date);
    if (Number.isNaN(days)) return <span className="badge badge-medium">Sem data valida</span>;
    if (days < 0) return <span className="badge badge-critical">Vencido</span>;

    if (days <= 2) {
      return (
        <span className="badge badge-critical inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.2} />
          {days}d restante{days !== 1 ? 's' : ''}
        </span>
      );
    }

    if (days <= 5) return <span className="badge badge-high">{days}d restantes</span>;
    if (days <= 10) return <span className="badge badge-medium">{days}d restantes</span>;
    return <span className="badge badge-low">{days}d restantes</span>;
  }

  const calculatedDate = calcResult?.deadlineDate || calcResult?.deadline_date || calcResult?.vencimento || null;
  const createMode = tab === 'create';

  return (
    <div className="animate-fade-in">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
            Controle de prazos premium
          </span>
          <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Prazos processuais</h1>
          <p className="text-surface-400 text-lg">
            Gestao de vencimentos com calculo automatizado segundo regras do CPC.
          </p>
        </div>

        <button
          onClick={() => setTab(createMode ? 'list' : 'create')}
          className="btn-primary inline-flex items-center gap-2 shrink-0"
        >
          {createMode ? (
            <>
              <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
              Voltar para lista
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              Novo prazo
            </>
          )}
        </button>
      </header>

      {createMode && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Cadastrar prazo</h3>
            <p className="text-sm text-surface-400 mb-5">
              Informe dados do processo e valide o vencimento antes de salvar.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-800 mb-2">Numero do processo</label>
                <input
                  type="text"
                  value={form.processNumber}
                  onChange={(e) => update('processNumber', e.target.value)}
                  className="input-field"
                  placeholder="0000000-00.0000.0.00.0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-800 mb-2">Descricao</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  className="input-field"
                  placeholder="Ex: Contestacao - Autor x Reu"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-800 mb-2">Data de inicio</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => update('startDate', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-800 mb-2">Quantidade de dias</label>
                  <input
                    type="number"
                    value={form.dias}
                    onChange={(e) => update('dias', e.target.value)}
                    className="input-field"
                    min="1"
                    required
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.diasUteis}
                  onChange={(e) => update('diasUteis', e.target.checked)}
                  className="h-4 w-4 rounded border-surface-300 text-brand-600"
                />
                <span className="text-sm text-surface-700">Contar apenas dias uteis (Art. 219 CPC)</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={handleCalculate} className="btn-secondary inline-flex items-center justify-center gap-2">
                  <Calculator className="h-4 w-4" strokeWidth={2.2} />
                  Calcular
                </button>
                <button type="submit" disabled={creating} className="btn-primary inline-flex items-center justify-center gap-2">
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" strokeWidth={2.2} />
                      Salvar prazo
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-display text-2xl text-surface-900 mb-1">Resultado do calculo</h3>
            <p className="text-sm text-surface-400 mb-5">
              Simule o vencimento para validar prazo final antes do cadastro.
            </p>

            {calcResult?.error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 text-sm inline-flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
                <span>{calcResult.error}</span>
              </div>
            ) : calcResult ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
                  <p className="text-sm text-brand-700 font-medium">Vencimento calculado</p>
                  <p className="text-2xl font-bold text-brand-900 mt-1">
                    {formatDateSafe(
                      calculatedDate,
                      { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
                      calcResult.vencimentoFormatado || 'Data invalida'
                    )}
                  </p>
                </div>

                {calcResult.details && (
                  <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-700 whitespace-pre-wrap">
                    {calcResult.details}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-14 text-center text-surface-500">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center">
                  <Calculator className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <p className="font-medium text-surface-700">Nenhum calculo executado</p>
                <p className="text-sm mt-1">Informe os dados e clique em calcular para visualizar o vencimento.</p>
              </div>
            )}

            {cpcTypes.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-surface-800 mb-3">Prazos comuns do CPC</h4>
                <div className="space-y-2">
                  {cpcTypes.slice(0, 8).map((item, i) => (
                    <button
                      key={`${item.nome}-${i}`}
                      onClick={() => {
                        update('dias', item.dias);
                        update('description', item.nome);
                        update('diasUteis', item.diasUteis !== false);
                      }}
                      className="w-full rounded-xl border border-surface-200/80 bg-white text-left px-3 py-2.5 hover:border-brand-200 hover:bg-brand-50/40 transition-colors"
                    >
                      <p className="text-sm font-medium text-surface-900">{item.nome}</p>
                      <p className="text-xs text-surface-400 mt-0.5">
                        {item.dias} dias {item.diasUteis !== false ? 'uteis' : 'corridos'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {!createMode && (
        <section className="rounded-3xl border border-surface-200/80 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-surface-200/80 px-6 py-4">
            <h3 className="font-display text-2xl text-surface-900">Agenda de prazos</h3>
            <p className="text-sm text-surface-400 mt-1">Visualize vencimentos em ordem de prioridade.</p>
          </div>

          {loading ? (
            <div className="p-8 text-center text-surface-400 inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
              Carregando prazos...
            </div>
          ) : deadlines.length === 0 ? (
            <div className="p-12 text-center text-surface-500">
              <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-surface-100 text-surface-600 flex items-center justify-center">
                <Clock3 className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <p className="font-medium text-surface-700">Nenhum prazo cadastrado</p>
              <button onClick={() => setTab('create')} className="btn-primary mt-5 inline-flex items-center gap-2">
                <Plus className="h-4 w-4" strokeWidth={2.2} />
                Cadastrar primeiro prazo
              </button>
            </div>
          ) : (
            <div className="divide-y divide-surface-100">
              {[...deadlines]
                .sort((a, b) => {
                  const left = parseDateSafe(a.deadline_date)?.getTime() || Number.MAX_SAFE_INTEGER;
                  const right = parseDateSafe(b.deadline_date)?.getTime() || Number.MAX_SAFE_INTEGER;
                  return left - right;
                })
                .map((deadline) => (
                  <div key={deadline.id} className="px-6 py-5 hover:bg-surface-50/80 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-surface-900 break-words">{deadline.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-surface-500">
                          {deadline.process_number && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1">
                              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                              Processo: {deadline.process_number}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2.5 py-1">
                            <Calendar className="h-3.5 w-3.5" strokeWidth={2.2} />
                            Vence em {formatDateSafe(deadline.deadline_date)}
                          </span>
                        </div>
                      </div>
                      {urgencyBadge(deadline.deadline_date)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
