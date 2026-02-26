'use client';
import { useState } from 'react';
import { register } from '@/lib/api';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', whatsapp: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      return setError('Senha deve ter pelo menos 6 caracteres');
    }
    setLoading(true);
    try {
      await register(form.name, form.email, form.password, form.whatsapp);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left - Brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-surface-950 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 via-surface-950 to-surface-950" />
        <div className="absolute top-0 left-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-md px-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-display text-xl">⚖</span>
            </div>
            <h1 className="font-display text-3xl text-white">Dr. Lex</h1>
          </div>
          <p className="text-surface-300 text-lg leading-relaxed mb-6">
            Comece a usar o assistente juridico mais inteligente do Brasil.
          </p>

          <div className="rounded-2xl p-6 border border-white/30 bg-white/95 shadow-xl shadow-black/20">
            <p className="text-brand-700 font-semibold text-sm mb-2">Plano Solo</p>
            <p className="text-accent-600 text-3xl font-display mb-4">
              R$ 197<span className="text-surface-800 text-sm font-body ml-1">/mes</span>
            </p>
            <ul className="space-y-2 text-sm text-surface-800">
              {[
                'Analise ilimitada de contratos',
                'Calculo de prazos CPC',
                'Monitoramento de diarios',
                'Alertas via WhatsApp',
                'Chat com IA juridica',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 bg-surface-50">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-display text-lg">⚖</span>
            </div>
            <h1 className="font-display text-2xl text-surface-900">Dr. Lex</h1>
          </div>

          <h2 className="font-display text-3xl text-surface-900 mb-2">Criar sua conta</h2>
          <p className="text-surface-300 mb-8">Preencha seus dados para comecar</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-surface-800 mb-2">Nome completo</label>
              <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)}
                className="input-field" placeholder="Dr. Joao Silva" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-800 mb-2">Email</label>
              <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)}
                className="input-field" placeholder="seu@email.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-800 mb-2">WhatsApp (opcional)</label>
              <input type="tel" value={form.whatsapp} onChange={(e) => update('whatsapp', e.target.value)}
                className="input-field" placeholder="(74) 99999-9999" />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-800 mb-2">Senha</label>
              <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)}
                className="input-field" placeholder="Minimo 6 caracteres" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>

          <p className="text-center text-surface-300 text-sm mt-8">
            Ja tem conta?{' '}
            <a href="/login" className="text-brand-600 hover:text-brand-700 font-semibold">Entrar</a>
          </p>
        </div>
      </div>
    </div>
  );
}
