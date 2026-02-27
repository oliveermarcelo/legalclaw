'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Loader2,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import { chat as chatApi } from '@/lib/api';

function normalizeHistory(messages) {
  return messages
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({
      role: item.role,
      content: String(item.content || ''),
    }))
    .slice(-12);
}

export default function DashboardChatPage() {
  const [messages, setMessages] = useState([
    {
      id: 'seed',
      role: 'assistant',
      content:
        'Sou o Dr. Lex. Envie sua duvida juridica para eu responder com base na sua base de conhecimento e no contexto do caso.',
      sources: [],
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [fatalError, setFatalError] = useState('');
  const viewportRef = useRef(null);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  useEffect(() => {
    if (!viewportRef.current) return;
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages, sending]);

  async function handleSubmit(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || sending) return;

    setFatalError('');
    setInput('');

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      sources: [],
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setSending(true);

    try {
      const response = await chatApi(question, normalizeHistory(nextMessages));
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response?.text || 'Nao foi possivel gerar resposta agora.',
        sources: Array.isArray(response?.sources) ? response.sources : [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = err?.message || 'Erro ao conversar com o assistente';
      setFatalError(errorMessage);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: `Nao foi possivel responder agora: ${errorMessage}`,
          sources: [],
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.3} />
          Chat juridico com RAG
        </span>
        <h1 className="font-display text-4xl text-surface-900 mt-3 mb-2">Assistente IA</h1>
        <p className="text-surface-400 text-lg">
          Converse com o Dr. Lex e receba respostas com citacoes de fontes cadastradas.
        </p>
      </header>

      <section className="rounded-3xl border border-surface-200/80 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-surface-200/80 px-6 py-4 flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-brand-700" strokeWidth={2.2} />
          <p className="text-sm font-semibold text-surface-800">Conversa ativa</p>
        </div>

        <div ref={viewportRef} className="max-h-[62vh] overflow-y-auto px-6 py-6 space-y-4 bg-surface-50/60">
          {messages.map((message) => {
            const isUser = message.role === 'user';

            return (
              <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <article
                  className={[
                    'max-w-3xl rounded-2xl px-4 py-3 border',
                    isUser
                      ? 'bg-brand-600 text-white border-brand-600 shadow-lg shadow-brand-800/20'
                      : 'bg-white text-surface-800 border-surface-200',
                  ].join(' ')}
                >
                  <p className={`whitespace-pre-wrap text-sm leading-relaxed ${isUser ? 'text-white' : 'text-surface-800'}`}>
                    {message.content}
                  </p>

                  {!isUser && Array.isArray(message.sources) && message.sources.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.sources.map((source) => (
                        <div key={`${message.id}-${source.id}`} className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                              Fonte {source.id}
                            </span>
                            <p className="text-xs font-semibold text-surface-800">{source.title}</p>
                          </div>
                          {source.sourceRef && (
                            <p className="text-[11px] text-surface-500 mt-1">{source.sourceRef}</p>
                          )}
                          {source.excerpt && (
                            <p className="text-xs text-surface-600 mt-2 line-clamp-4">{source.excerpt}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </div>
            );
          })}

          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3 inline-flex items-center gap-2 text-sm text-surface-500">
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                Processando resposta...
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-surface-200/80 p-4 bg-white">
          {fatalError && (
            <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 inline-flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={2.2} />
              <span>{fatalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="input-field flex-1"
              placeholder="Digite sua pergunta juridica..."
            />
            <button
              type="submit"
              disabled={!canSend}
              className="btn-primary inline-flex items-center justify-center gap-2 md:min-w-[180px]"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                  Enviando...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
                  Enviar pergunta
                </>
              )}
            </button>
          </form>

          <p className="mt-3 text-xs text-surface-400 inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" strokeWidth={2.2} />
            As respostas podem citar fontes da sua base como [Fonte 1], [Fonte 2], etc.
          </p>
        </div>
      </section>
    </div>
  );
}
