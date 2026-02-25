'use client';
import { useEffect, useState } from 'react';
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
      label: 'Contratos este mês',
      value: stats.contracts_month || 0,
      total: stats.total_contracts || 0,
      icon: '📋',
      color: 'brand',
      href: '/contratos',
    },
    {
      label: 'Prazos ativos',
      value: stats.active_deadlines || 0,
      urgent: stats.urgent_deadlines || 0,
      icon: '⏰',
      color: 'amber',
      href: '/prazos',
    },
    {
      label: 'Monitores ativos',
      value: stats.active_monitors || 0,
      alerts: stats.unread_alerts || 0,
      icon: '📰',
      color: 'emerald',
      href: '/diarios',
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl text-surface-900 mb-1">
          Olá, {user?.name?.split(' ')[0] || 'Doutor'}
        </h1>
        <p className="text-surface-300">
          Aqui está o resumo do seu escritório hoje.
        </p>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-surface-200 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {cards.map((card, i) => (
            <a
              key={i}
              href={card.href}
              className="stat-card group hover:border-brand-200"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{card.icon}</span>
                <span className="text-xs text-surface-300 group-hover:text-brand-500 transition-colors">
                  Ver todos →
                </span>
              </div>
              <p className="text-3xl font-bold text-surface-900 mt-2">{card.value}</p>
              <p className="text-sm text-surface-300">{card.label}</p>
              {card.urgent > 0 && (
                <span className="badge badge-critical mt-2">⚠ {card.urgent} urgente{card.urgent > 1 ? 's' : ''}</span>
              )}
              {card.alerts > 0 && (
                <span className="badge badge-medium mt-2">🔔 {card.alerts} alerta{card.alerts > 1 ? 's' : ''} novo{card.alerts > 1 ? 's' : ''}</span>
              )}
              {card.total > 0 && (
                <span className="text-xs text-surface-300 mt-1">{card.total} total</span>
              )}
            </a>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <h2 className="font-display text-xl text-surface-900 mb-4">Ações rápidas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Analisar contrato', icon: '📋', href: '/contratos', desc: 'Cole ou envie um contrato para análise com IA' },
          { label: 'Novo prazo', icon: '⏰', href: '/prazos', desc: 'Cadastre um prazo processual com cálculo automático' },
          { label: 'Buscar no DOU', icon: '🔍', href: '/diarios', desc: 'Pesquise publicações no Diário Oficial' },
          { label: 'Chat com Dr. Lex', icon: '💬', href: '/dashboard/chat', desc: 'Tire dúvidas jurídicas com a IA' },
        ].map((action, i) => (
          <a
            key={i}
            href={action.href}
            className="card p-5 hover:border-brand-200 group"
          >
            <span className="text-2xl mb-3 block">{action.icon}</span>
            <p className="font-semibold text-surface-900 text-sm group-hover:text-brand-700 transition-colors">
              {action.label}
            </p>
            <p className="text-xs text-surface-300 mt-1">{action.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
