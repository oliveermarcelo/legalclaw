'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { getWhatsappQRCode, getWhatsappStatus } from '@/lib/api';

function normalizeState(rawState) {
  const state = String(rawState || '').toLowerCase();

  if (state === 'open' || state.includes('connected')) return 'open';
  if (state === 'connecting' || state.includes('pairing')) return 'connecting';
  if (state === 'close' || state === 'closed' || state.includes('disconnected')) return 'close';
  if (state.includes('error')) return 'error';

  return 'unknown';
}

export default function WhatsappPage() {
  const [status, setStatus] = useState('unknown');
  const [statusLoading, setStatusLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrImage, setQrImage] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [error, setError] = useState('');

  const refreshStatus = useCallback(async (silent = false) => {
    if (!silent) setStatusLoading(true);

    try {
      const data = await getWhatsappStatus();
      setStatus(normalizeState(data?.state || data?.data?.instance?.state));
    } catch (err) {
      setStatus('error');
      if (!silent) setError(err?.message || 'Erro ao consultar status do WhatsApp.');
    } finally {
      if (!silent) setStatusLoading(false);
    }
  }, []);

  const loadQRCode = useCallback(async () => {
    setQrLoading(true);
    setError('');

    try {
      const data = await getWhatsappQRCode();
      const image = data?.qrImage || data?.data?.raw?.base64 || '';
      const normalized = normalizeState(data?.data?.instance?.state || status);

      setQrImage(image);
      setEndpoint(data?.endpoint || '');
      setStatus(normalized);

      if (!image) {
        setError('QR Code indisponivel no momento. Tente novamente em alguns segundos.');
      }
    } catch (err) {
      setError(err?.message || 'Erro ao gerar QR Code.');
    } finally {
      setQrLoading(false);
    }
  }, [status]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status === 'open') return undefined;

    const timer = setInterval(() => {
      refreshStatus(true);
    }, 8000);

    return () => clearInterval(timer);
  }, [status, refreshStatus]);

  const badge = useMemo(() => {
    switch (status) {
      case 'open':
        return {
          icon: CheckCircle2,
          className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
          label: 'Conectado',
        };
      case 'connecting':
        return {
          icon: Wifi,
          className: 'bg-amber-100 text-amber-700 border border-amber-200',
          label: 'Conectando',
        };
      case 'close':
        return {
          icon: WifiOff,
          className: 'bg-surface-100 text-surface-600 border border-surface-200',
          label: 'Desconectado',
        };
      case 'error':
        return {
          icon: AlertTriangle,
          className: 'bg-red-100 text-red-700 border border-red-200',
          label: 'Erro de conexao',
        };
      default:
        return {
          icon: LoaderCircle,
          className: 'bg-surface-100 text-surface-600 border border-surface-200',
          label: 'Status indefinido',
        };
    }
  }, [status]);

  const BadgeIcon = badge.icon;

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Smartphone className="h-3.5 w-3.5" strokeWidth={2.2} />
          Integracao WhatsApp
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Conectar WhatsApp por QR Code</h1>
        <p className="text-surface-400 text-lg">
          Conecte sua instancia para receber alertas e usar o Dr. Lex diretamente no WhatsApp.
        </p>
      </header>

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <article className="xl:col-span-3 rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-surface-900">Status da conexao</h2>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
              <BadgeIcon
                className={`h-3.5 w-3.5 ${status === 'connecting' || statusLoading ? 'animate-spin' : ''}`}
                strokeWidth={2.3}
              />
              {statusLoading ? 'Atualizando...' : badge.label}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => refreshStatus()}
              disabled={statusLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-2.5 text-sm font-semibold text-surface-700 hover:border-brand-200 hover:text-brand-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${statusLoading ? 'animate-spin' : ''}`} strokeWidth={2.2} />
              Atualizar status
            </button>

            <button
              onClick={loadQRCode}
              disabled={qrLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <QrCode className="h-4 w-4" strokeWidth={2.2} />
              {qrLoading ? 'Gerando QR...' : 'Gerar QR Code'}
            </button>
          </div>

          {endpoint && (
            <p className="mt-4 text-xs text-surface-400">
              Endpoint utilizado: <code className="text-surface-600">{endpoint}</code>
            </p>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 inline-flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-surface-200 bg-surface-50 p-4">
            <h3 className="text-sm font-semibold text-surface-800 mb-2">Como conectar</h3>
            <ol className="text-sm text-surface-600 space-y-1.5">
              <li>1. Clique em Gerar QR Code.</li>
              <li>2. Abra o WhatsApp no celular e toque em Dispositivos conectados.</li>
              <li>3. Escaneie o QR exibido nesta tela.</li>
              <li>4. Aguarde o status mudar para Conectado.</li>
            </ol>
          </div>
        </article>

        <article className="xl:col-span-2 rounded-3xl border border-surface-200/80 bg-white p-6 shadow-sm">
          <h2 className="font-display text-2xl text-surface-900 mb-4">QR Code</h2>

          {status === 'open' ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-3" strokeWidth={2.2} />
              <p className="font-semibold text-emerald-700">WhatsApp conectado com sucesso</p>
              <p className="text-sm text-emerald-700/80 mt-1">Nao e necessario gerar um novo QR agora.</p>
            </div>
          ) : qrImage ? (
            <div className="rounded-2xl border border-surface-200 bg-white p-4">
              <img
                src={qrImage}
                alt="QR Code de conexao do WhatsApp"
                className="w-full max-w-xs mx-auto rounded-xl border border-surface-200"
              />
              <p className="text-xs text-surface-400 text-center mt-3">
                Este codigo expira rapidamente. Gere novamente se necessario.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-8 text-center">
              <QrCode className="h-10 w-10 text-surface-400 mx-auto mb-3" strokeWidth={2.1} />
              <p className="text-sm font-semibold text-surface-700">QR Code ainda nao gerado</p>
              <p className="text-xs text-surface-400 mt-1">Use o botao Gerar QR Code para iniciar a conexao.</p>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
