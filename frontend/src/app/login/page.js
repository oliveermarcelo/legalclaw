'use client';
import { useState } from 'react';
import { AlarmClock, FileText, Newspaper, Scale } from 'lucide-react';
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
    { icon: FileText, text: 'Análise de contratos em segundos' },
    { icon: AlarmClock, text: 'Prazos processuais automatizados' },
    { icon: Newspaper, text: 'Monitoramento de diários oficiais 24/7' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface-950 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 via-surface-950 to-surface-950" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent-500/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-md px-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
              <Scale className="h-5 w-5 text-white" strokeWidth={2.2} />
            </div>
            <h1 className="font-display text-3xl text-white">Dr. Lex</h1>
          </div>
          <p className="text-surface-300 text-lg leading-relaxed mb-8">
            Seu assistente jurídico com inteligência artificial. Análise de contratos, gestão de prazos e monitoramento de diários oficiais.
          </p>
          <div className="space-y-4">
            {highlights.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-3 text-surface-200">
                  <Icon className="h-4 w-4 text-brand-300" strokeWidth={2.3} />
                  <span className="text-sm">{item.text}</span>
                </div>
              );
            })}
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
                placeholder="••••••••"
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
            Não tem conta?{' '}
            <a href="/register" className="text-brand-600 hover:text-brand-700 font-semibold">
              Criar conta grátis
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
