'use client';
import { useState } from 'react';
import { AlarmClock, FileText, Newspaper, Scale, ShieldCheck, Sparkles, Star } from 'lucide-react';
import { login } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  const highlights = [
    {
      icon: FileText,
      title: 'Analise de contratos em segundos',
      detail: 'Identifique risco juridico e clausulas criticas com IA.',
    },
    {
      icon: AlarmClock,
      title: 'Prazos processuais automatizados',
      detail: 'Contagem no padrao CPC com alertas inteligentes.',
    },
    {
      icon: Newspaper,
      title: 'Monitoramento de diarios oficiais 24/7',
      detail: 'Publicacoes relevantes sem acompanhamento manual.',
    },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface-950 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/50 via-surface-950 to-surface-950" />
        <div className="absolute top-0 right-0 w-[34rem] h-[34rem] bg-brand-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-[24rem] h-[24rem] bg-accent-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-xl px-12 py-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg shadow-brand-700/40">
              <Scale className="h-5 w-5 text-white" strokeWidth={2.2} />
            </div>
            <h1 className="font-display text-3xl text-white">Dr. Lex</h1>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-brand-300/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-200">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
            Plataforma premium para advocacia
          </span>

          <p className="mt-5 text-surface-200 text-lg leading-relaxed">
            Seu assistente juridico com inteligencia artificial para analise de contratos, prazos processuais e monitoramento de diarios oficiais.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-white font-semibold text-sm">4.9/5</p>
              <p className="text-surface-300 text-xs mt-0.5">Satisfacao</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-white font-semibold text-sm">24/7</p>
              <p className="text-surface-300 text-xs mt-0.5">Assistente ativo</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-white font-semibold text-sm">CPC</p>
              <p className="text-surface-300 text-xs mt-0.5">Regras aplicadas</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="group rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-white/10">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700/25 text-brand-200">
                      <Icon className="h-4 w-4" strokeWidth={2.3} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-surface-300 mt-1">{item.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-4 text-xs text-surface-300">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-300" strokeWidth={2.2} />
              Ambiente seguro
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 text-amber-300" strokeWidth={2.2} />
              Experiencia premium
            </span>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-surface-50">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
              <Scale className="h-4 w-4 text-white" strokeWidth={2.2} />
            </div>
            <h1 className="font-display text-2xl text-surface-900">Dr. Lex</h1>
          </div>

          <h2 className="font-display text-3xl text-surface-900 mb-2">Bem-vindo de volta</h2>
          <p className="text-surface-300 mb-8">Entre na sua conta para continuar</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-800 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="seu@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-800 mb-2">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="********"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-surface-300 text-sm mt-8">
            Nao tem conta?{' '}
            <a href="/register" className="text-brand-600 hover:text-brand-700 font-semibold">
              Criar conta gratis
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
