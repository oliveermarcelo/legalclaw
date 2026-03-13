'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  FileText,
  Layers,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  Users,
  X,
} from 'lucide-react';
import {
  adminGetStats,
  adminGetUsers,
  adminUpdateUser,
  adminGetOrgs,
  adminUpdateOrg,
  adminGetPlans,
  adminUpdateFeature,
  adminGetActivity,
} from '@/lib/api';

const TABS = [
  { key: 'overview', label: 'Visão Geral', icon: Activity },
  { key: 'users', label: 'Usuários', icon: Users },
  { key: 'orgs', label: 'Organizações', icon: Building2 },
  { key: 'plans', label: 'Planos & Features', icon: Layers },
  { key: 'activity', label: 'Atividade', icon: FileText },
];

const PLANS = ['solo', 'escritorio', 'enterprise'];

const FEATURE_LABELS = {
  contracts_analyze: 'Análise de Contratos',
  contracts_generate: 'Geração de Contratos',
  deadlines: 'Gestão de Prazos',
  diario_monitor: 'Monitor de Diários',
  knowledge_base: 'Base de Conhecimento',
  external_processes: 'Consultas Externas',
  prospecting: 'Prospecção',
  whatsapp: 'WhatsApp',
  workflows: 'Fluxos Jurídicos',
};

function StatCard({ label, value, sub, accent = 'bg-brand-600/15 text-brand-300' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs text-surface-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value ?? '—'}</p>
      {sub && <p className="mt-1 text-xs text-surface-400">{sub}</p>}
    </div>
  );
}

function Badge({ children, color = 'gray' }) {
  const colors = {
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    red: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    blue: 'bg-brand-500/15 text-brand-300 border-brand-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    gray: 'bg-white/8 text-surface-300 border-white/10',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${colors[color]}`}>
      {children}
    </span>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ stats }) {
  if (!stats) return <div className="text-surface-400 py-10 text-center">Carregando...</div>;
  const s = stats.stats || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Usuários ativos" value={s.total_users} sub={`+${s.new_users_month} este mês`} />
        <StatCard label="Organizações" value={s.total_orgs} />
        <StatCard label="Contratos" value={s.total_contracts} sub={`${s.contracts_month} este mês`} />
        <StatCard label="Prazos ativos" value={s.active_deadlines} />
        <StatCard label="Chamadas API (7d)" value={s.api_calls_week} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Distribuição por Plano</h3>
          <div className="space-y-2">
            {(stats.planBreakdown || []).map((row) => (
              <div key={row.plan} className="flex items-center justify-between">
                <span className="text-sm text-surface-300 capitalize">{row.plan}</span>
                <Badge color={row.plan === 'enterprise' ? 'amber' : row.plan === 'escritorio' ? 'blue' : 'gray'}>
                  {row.count} usuários
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Contratos por Dia (30d)</h3>
          <div className="flex items-end gap-1 h-24">
            {(stats.dailyActivity || []).map((d) => {
              const max = Math.max(...(stats.dailyActivity || []).map((x) => x.contracts), 1);
              const pct = Math.round((d.contracts / max) * 100);
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-brand-500/50"
                    style={{ height: `${Math.max(pct, 4)}%` }}
                    title={`${d.day}: ${d.contracts}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetUsers({ search, plan: planFilter });
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  }, [search, planFilter]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(id, patch) {
    setSaving(true);
    try {
      await adminUpdateUser(id, patch);
      setMsg({ type: 'ok', text: 'Salvo!' });
      setEditing(null);
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/50"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
        >
          <option value="">Todos os planos</option>
          {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-surface-300 text-sm">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
          {msg.type === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      <p className="text-xs text-surface-500">{total} usuários encontrados</p>

      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-surface-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Contratos</th>
              <th className="px-4 py-3 text-left">Prazos</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={6} className="text-center text-surface-500 py-8">Carregando...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-surface-500 py-8">Nenhum usuário</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-white/3">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{u.name}</div>
                  <div className="text-xs text-surface-500">{u.email}</div>
                  {u.is_super_admin && <Badge color="amber">Super Admin</Badge>}
                </td>
                <td className="px-4 py-3">
                  {editing?.id === u.id ? (
                    <select
                      className="bg-surface-900 border border-white/20 rounded-lg px-2 py-1 text-xs text-white"
                      value={editing.plan}
                      onChange={(e) => setEditing({ ...editing, plan: e.target.value })}
                    >
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <Badge color={u.plan === 'enterprise' ? 'amber' : u.plan === 'escritorio' ? 'blue' : 'gray'}>
                      {u.plan}
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleSave(u.id, { active: !u.active })}
                    className="flex items-center gap-1 text-xs"
                  >
                    {u.active
                      ? <><ToggleRight className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">Ativo</span></>
                      : <><ToggleLeft className="h-4 w-4 text-surface-500" /><span className="text-surface-500">Inativo</span></>}
                  </button>
                </td>
                <td className="px-4 py-3 text-surface-300">{u.contract_count}</td>
                <td className="px-4 py-3 text-surface-300">{u.active_deadlines}</td>
                <td className="px-4 py-3 text-right">
                  {editing?.id === u.id ? (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleSave(u.id, { plan: editing.plan })}
                        disabled={saving}
                        className="px-2 py-1 bg-brand-600 text-white rounded-lg text-xs hover:bg-brand-500"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="px-2 py-1 border border-white/10 text-surface-300 rounded-lg text-xs hover:bg-white/5"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditing({ id: u.id, plan: u.plan })}
                      className="text-xs text-brand-300 hover:text-brand-100"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Orgs Tab ──────────────────────────────────────────────────────────────────
function OrgsTab() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetOrgs({ search });
      setOrgs(data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(org) {
    try {
      await adminUpdateOrg(org.id, { active: !org.active });
      load();
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
      setTimeout(() => setMsg(null), 3000);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
          <input
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/50"
            placeholder="Buscar organização..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-surface-300 text-sm">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {msg && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-rose-500/15 text-rose-300">
          <AlertTriangle className="h-4 w-4" />{msg.text}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-surface-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Organização</th>
              <th className="px-4 py-3 text-left">Plano</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-left">Membros</th>
              <th className="px-4 py-3 text-left">Contratos</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr><td colSpan={6} className="text-center text-surface-500 py-8">Carregando...</td></tr>
            ) : orgs.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-surface-500 py-8">Nenhuma organização</td></tr>
            ) : orgs.map((o) => (
              <tr key={o.id} className="hover:bg-white/3">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{o.name}</div>
                  <div className="text-xs text-surface-500">{o.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge color={o.plan === 'enterprise' ? 'amber' : o.plan === 'escritorio' ? 'blue' : 'gray'}>
                    {o.plan}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="text-surface-300">{o.owner_name}</div>
                  <div className="text-xs text-surface-500">{o.owner_email}</div>
                </td>
                <td className="px-4 py-3 text-surface-300">{o.member_count}</td>
                <td className="px-4 py-3 text-surface-300">{o.contract_count}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(o)} className="flex items-center gap-1 text-xs">
                    {o.active
                      ? <><ToggleRight className="h-4 w-4 text-emerald-400" /><span className="text-emerald-400">Ativa</span></>
                      : <><ToggleLeft className="h-4 w-4 text-surface-500" /><span className="text-surface-500">Inativa</span></>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Plans Tab ─────────────────────────────────────────────────────────────────
function PlansTab() {
  const [plans, setPlans] = useState(null);
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    adminGetPlans().then(setPlans).catch((e) => setMsg({ type: 'error', text: e.message }));
  }, []);

  async function toggle(plan, feature, current) {
    setSaving(`${plan}:${feature}`);
    try {
      await adminUpdateFeature(plan, feature, { enabled: !current });
      setPlans((prev) => ({
        ...prev,
        [plan]: prev[plan].map((f) => f.key === feature ? { ...f, enabled: !current } : f),
      }));
      setMsg({ type: 'ok', text: 'Feature atualizada!' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    } finally {
      setSaving(null);
      setTimeout(() => setMsg(null), 2500);
    }
  }

  const allFeatures = Object.keys(FEATURE_LABELS);

  return (
    <div className="space-y-4">
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${msg.type === 'ok' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
          {msg.type === 'ok' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {msg.text}
        </div>
      )}

      {!plans ? (
        <div className="text-surface-400 py-10 text-center">Carregando...</div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-surface-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Feature</th>
                {PLANS.map((p) => (
                  <th key={p} className="px-4 py-3 text-center capitalize">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allFeatures.map((feat) => (
                <tr key={feat} className="hover:bg-white/3">
                  <td className="px-4 py-3 text-white font-medium">
                    {FEATURE_LABELS[feat]}
                    <div className="text-xs text-surface-500">{feat}</div>
                  </td>
                  {PLANS.map((plan) => {
                    const planFeats = plans[plan] || [];
                    const f = planFeats.find((x) => x.key === feat);
                    const enabled = f?.enabled ?? false;
                    const key = `${plan}:${feat}`;
                    return (
                      <td key={plan} className="px-4 py-3 text-center">
                        <button
                          onClick={() => toggle(plan, feat, enabled)}
                          disabled={saving === key}
                          className="mx-auto flex items-center justify-center"
                        >
                          {saving === key ? (
                            <RefreshCw className="h-4 w-4 text-surface-400 animate-spin" />
                          ) : enabled ? (
                            <Check className="h-5 w-5 text-emerald-400" />
                          ) : (
                            <X className="h-5 w-5 text-surface-600" />
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Activity Tab ──────────────────────────────────────────────────────────────
function ActivityTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    adminGetActivity().then(setData).catch(() => {});
  }, []);

  if (!data) return <div className="text-surface-400 py-10 text-center">Carregando...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Contratos Recentes</h3>
        {(data.recentContracts || []).map((c) => (
          <div key={`${c.type}-${c.created_at}`} className="rounded-xl border border-white/8 bg-white/3 p-3">
            <div className="text-sm text-white truncate">{c.label || 'Sem título'}</div>
            <div className="text-xs text-surface-500 mt-0.5">{c.user_name} · {c.meta && <Badge color={c.meta === 'alto' ? 'red' : c.meta === 'médio' ? 'amber' : 'green'}>{c.meta}</Badge>}</div>
            <div className="text-xs text-surface-600 mt-1">{new Date(c.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Prazos Recentes</h3>
        {(data.recentDeadlines || []).map((d) => (
          <div key={`deadline-${d.created_at}`} className="rounded-xl border border-white/8 bg-white/3 p-3">
            <div className="text-sm text-white truncate">{d.label}</div>
            <div className="text-xs text-surface-500 mt-0.5">{d.user_name}</div>
            <div className="text-xs text-surface-600 mt-1">Vence: {d.meta}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-surface-300 uppercase tracking-wider">Usuários Recentes</h3>
        {(data.recentUsers || []).map((u) => (
          <div key={u.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
            <div className="text-sm text-white">{u.name}</div>
            <div className="text-xs text-surface-500 mt-0.5">{u.email}</div>
            <div className="text-xs text-surface-600 mt-1">{new Date(u.created_at).toLocaleDateString('pt-BR')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    adminGetStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-950 via-[#0d1230] to-[#070b1c] text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-rose-600/80 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-white" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Painel Super Admin</h1>
            <p className="text-xs text-surface-400">Controle total do sistema Dr. Lex</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-2xl p-1 w-fit flex-wrap">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all',
                tab === key
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-surface-400 hover:text-white hover:bg-white/5',
              ].join(' ')}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === 'overview' && <OverviewTab stats={stats} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'orgs' && <OrgsTab />}
        {tab === 'plans' && <PlansTab />}
        {tab === 'activity' && <ActivityTab />}
      </div>
    </div>
  );
}
