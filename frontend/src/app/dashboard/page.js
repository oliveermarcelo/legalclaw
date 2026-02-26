'use client';
import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Clock3,
  FileText,
  Gavel,
  MessageSquareText,
  Newspaper,
  Search,
  Sparkles,
} from 'lucide-react';
import { getMe, getUser } from '@/lib/api';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    getMe()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || {};

  const cards = [
    {
      label: 'Contratos no mes',
      value: stats.contracts_month || 0,
      total: stats.total_contracts || 0,
      icon: FileText,
      href: '/contratos',
      accent: 'from-brand-50 to-brand-100/40',
      iconWrap: 'bg-brand-700/12 text-brand-700',
    },
    {
      label: 'Prazos ativos',
      value: stats.active_deadlines || 0,
      urgent: stats.urgent_deadlines || 0,
      icon: Clock3,
      href: '/prazos',
      accent: 'from-amber-50 to-amber-100/40',
      iconWrap: 'bg-amber-500/15 text-amber-700',
    },
    {
      label: 'Monitores ativos',
      value: stats.active_monitors || 0,
      alerts: stats.unread_alerts || 0,
      icon: Newspaper,
      href: '/diarios',
      accent: 'from-emerald-50 to-emerald-100/40',
      iconWrap: 'bg-emerald-500/15 text-emerald-700',
    },
  ];

  const quickActions = [
    {
      label: 'Analisar contrato',
      icon: Gavel,
      href: '/contratos',
      desc: 'Cole ou envie um contrato para analise com IA.',
    },
    {
      label: 'Novo prazo',
      icon: Clock3,
      href: '/prazos',
      desc: 'Cadastre um prazo processual com calculo automatico.',
    },
    {
      label: 'Buscar no DOU',
      icon: Search,
      href: '/diarios',
      desc: 'Pesquise publicacoes no Diario Oficial.',
    },
    {
      label: 'Chat com Dr. Lex',
      icon: MessageSquareText,
      href: '/dashboard/chat',
      desc: 'Tire duvidas juridicas com assistente especializado.',
    },
  ];

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Workspace premium
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">
          Ola, {user?.name?.split(' ')[0] || 'Doutor'}
        </h1>
        <p className="text-surface-400 text-lg">Resumo estrategico do escritorio no dia de hoje.</p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl border border-surface-200/80 bg-white p-6 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-1/2 mb-4" />
              <div className="h-10 bg-surface-200 rounded w-1/3 mb-4" />
              <div className="h-3 bg-surface-200 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {cards.map((card, i) => {
            const Icon = card.icon;

            return (
              <a
                key={card.label}
                href={card.href}
                className="relative overflow-hidden rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 group"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />

                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${card.iconWrap}`}>
                    <Icon className="h-5 w-5" strokeWidth={2.3} />
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-surface-400 group-hover:text-brand-700 transition-colors">
                    Ver detalhes
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.3} />
                  </span>
                </div>

                <p className="mt-5 text-4xl font-bold tracking-tight text-surface-900">{card.value}</p>
                <p className="text-sm mt-1 text-surface-400">{card.label}</p>

                {card.urgent > 0 && (
                  <span className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-red-100 text-red-700 px-2.5 py-1 text-xs font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.3} />
                    {card.urgent} urgente{card.urgent > 1 ? 's' : ''}
                  </span>
                )}

                {card.alerts > 0 && (
                  <span className="inline-flex items-center gap-1.5 mt-3 rounded-full bg-amber-100 text-amber-700 px-2.5 py-1 text-xs font-semibold">
                    <BellRing className="h-3.5 w-3.5" strokeWidth={2.3} />
                    {card.alerts} alerta{card.alerts > 1 ? 's' : ''}
                  </span>
                )}

                {card.total > 0 && (
                  <p className="text-xs text-surface-400 mt-2">{card.total} no historico total</p>
                )}
              </a>
            );
          })}
        </section>
      )}

      <section>
        <h2 className="font-display text-2xl text-surface-900 mb-4">Acoes rapidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <a
                key={action.label}
                href={action.href}
                className="rounded-2xl border border-surface-200/80 bg-white p-5 shadow-sm hover:shadow-lg hover:border-brand-200 transition-all duration-200 group"
              >
                <div className="h-10 w-10 rounded-xl bg-surface-100 group-hover:bg-brand-50 text-surface-700 group-hover:text-brand-700 flex items-center justify-center mb-3 transition-colors">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <p className="font-semibold text-surface-900 text-sm">{action.label}</p>
                <p className="text-xs text-surface-400 mt-1">{action.desc}</p>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
